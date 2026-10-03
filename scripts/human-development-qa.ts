import { _electron, chromium, type ElectronApplication, type Page } from 'playwright';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { loadObservatory } from '../packages/application/src/save';
import { verifyScenarios } from '../packages/application/src/scenarios';
import { stateHash } from '../packages/shared/src/canonical';
import { age } from '../packages/domain/src/index';
import { advance } from '../packages/simulation/src/index';
import { qualification } from '../packages/domain/src/occupations';
import type { Occupation } from '../packages/domain/src/index';

const version = JSON.parse(readFileSync('package.json', 'utf8')).version;
const out = path.resolve('artifacts/qa/phase2a');
mkdirSync(out, { recursive: true });
const file = path.join(out, 'human.civitas');
const errors: string[] = [],
  checks: string[] = [];
const env = Object.fromEntries(
  Object.entries(process.env).filter(
    ([k, v]) => !['ELECTRON_RUN_AS_NODE', 'CIVITAS_DEV_URL'].includes(k) && v !== undefined,
  ),
) as Record<string, string>;
let app: ElectronApplication | undefined;
const mark = (s: string) => {
  checks.push(s);
  console.log('PASS:', s);
};
function watch(p: Page) {
  p.on('pageerror', (e) => errors.push(e.message));
  p.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
}
async function dialogs(target: string) {
  await app!.evaluate(({ dialog }, target) => {
    dialog.showSaveDialog = async () => ({ canceled: false, filePath: target });
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [target] });
  }, target);
}
async function launch() {
  app = await _electron.launch({
    executablePath: path.resolve('release', version, 'win-unpacked', 'Project CIVITAS.exe'),
    env,
    timeout: 60000,
  });
  const p = await app.firstWindow();
  watch(p);
  await p.getByRole('heading', { name: '城市觀察', exact: true }).waitFor();
  await app.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()[0].setContentSize(1536, 1024),
  );
  await dialogs(file);
  return p;
}
async function close() {
  const child = app!.process();
  await app!.close();
  assert.equal(child.exitCode, 0);
  app = undefined;
}
async function save(p: Page) {
  if (await p.getByRole('button', { name: '關閉通知', exact: true }).count())
    await p.getByRole('button', { name: '關閉通知', exact: true }).click();
  await p.getByRole('button', { name: '存檔', exact: true }).click();
  await p.getByRole('status').filter({ hasText: '城市已儲存' }).waitFor();
  return loadObservatory(readFileSync(file, 'utf8'));
}
async function select(p: Page, id: string) {
  await p.getByLabel('全域搜尋', { exact: true }).fill(id);
  await p.locator('.search-results').getByRole('button').filter({ hasText: id }).click();
  await p.getByRole('heading', { name: '居民檔案', exact: true }).waitFor();
}
async function shot(p: Page, name: string) {
  await p.screenshot({ path: path.join(out, `${name}.png`) });
}
try {
  let p = await launch();
  await p.getByRole('button', { name: '建立城市', exact: true }).click();
  await p.getByLabel('城市種子', { exact: true }).fill('CIVITAS-HUMAN-30');
  await p.getByRole('button', { name: '開始觀察', exact: true }).click();
  const initial = await save(p);
  const children = initial.state.citizens.filter(
    (c) => age(initial.state, c) >= 14 && age(initial.state, c) < 18,
  );
  assert.ok(children.length > 0);
  // Predict only to choose a surviving subject; the native UI must independently
  // generate and persist every event. No state is injected into the renderer.
  const prediction = structuredClone(initial.state);
  advance(prediction, 5475);
  const subject = children.find((c) => {
    const adult = prediction.citizens.find((x) => x.id === c.id)!;
    return (
      adult.lifecycleStatus === 'alive' &&
      adult.humanCapital.adultComparison &&
      prediction.events.some(
        (e) => e.type === 'EDUCATION_COMPLETED' && e.actorIds.includes(c.id),
      ) &&
      prediction.events.some(
        (e) => e.type === 'CITIZEN_HIRED' && e.actorIds.includes(c.id) && e.tick > 0,
      )
    );
  });
  assert.ok(subject);
  await select(p, subject.id);
  await p.locator('.human-citizen').scrollIntoViewIfNeeded();
  assert.ok((await p.locator('.human-citizen').innerText()).includes('基礎'));
  await shot(p, 'child-education');
  mark('Native child education, skills and explicit initial-history boundary are visible');
  await p.getByRole('button', { name: 'Max', exact: true }).click();
  await p.waitForFunction(
    () =>
      Number(document.querySelector('.clock small')?.textContent?.match(/第\s*(\d+)/)?.[1]) >= 5475,
    undefined,
    { timeout: 240000 },
  );
  await p.getByRole('button', { name: '暫停', exact: true }).click();
  const observed = await save(p);
  const grown = observed.state.citizens.find((c) => c.id === subject.id);
  assert.ok(grown);
  assert.equal(grown.lifecycleStatus, 'alive');
  assert.ok(
    observed.state.events.some(
      (e) => e.type === 'EDUCATION_COMPLETED' && e.actorIds.includes(grown.id),
    ),
  );
  assert.ok(
    grown.humanCapital.skills.general > subject.humanCapital.skills.general ||
      grown.humanCapital.skills.technical > subject.humanCapital.skills.technical,
  );
  assert.ok(age(observed.state, grown) >= 25);
  assert.ok(grown.humanCapital.adultComparison);
  await select(p, grown.id);
  const section = p.locator('.human-citizen');
  await section.getByRole('button', { name: '教育', exact: true }).click();
  await section.scrollIntoViewIfNeeded();
  await shot(p, 'adult-education');
  await section.getByRole('button', { name: '職涯', exact: true }).click();
  assert.ok((await section.innerText()).includes('薪'));
  await shot(p, 'career-qualification');
  await section.getByRole('button', { name: '流動', exact: true }).click();
  assert.ok((await section.innerText()).includes('25'));
  await shot(p, 'intergenerational-mobility');
  const hires = observed.state.events.filter(
    (e) => e.type === 'CITIZEN_HIRED' && e.actorIds.includes(grown.id) && e.tick > 0,
  );
  assert.ok(
    hires.every((e) =>
      e.causeEventIds.some(
        (id) => observed.state.events.find((x) => x.id === id)?.type === 'QUALIFICATION_GAINED',
      ),
    ),
  );
  const other = observed.state.citizens.find(
    (c) =>
      c.lifecycleStatus === 'alive' &&
      c.humanCapital.origin.class !== grown.humanCapital.origin.class,
  );
  assert.ok(other);
  await select(p, other.id);
  await p.locator('.human-citizen').getByRole('button', { name: '流動', exact: true }).click();
  await shot(p, 'different-household-origin');
  mark(
    'Actual initial children become adults; native career qualification and age-25 origin comparison agree with recorded events; different origins are inspectable',
  );
  await p.getByRole('button', { name: /^人力發展/ }).click();
  await p.getByRole('heading', { name: '人力發展與社會流動', exact: true }).waitFor();
  await p.getByLabel('社會流動同群', { exact: true }).selectOption('low');
  await shot(p, 'city-development-cohort');
  await p.getByLabel('社會流動同群', { exact: true }).selectOption('born');
  assert.ok((await p.locator('.human-development').innerText()).includes('同群 n='));
  mark(
    'Education, unemployment denominators, class rates and cohort sample sizes render in the native city analytics',
  );
  await p.getByRole('button', { name: '情境比較 Simulation comparison', exact: true }).click();
  await p.getByRole('button', { name: '從目前城市 / 已載入存檔 Fork A / B', exact: true }).click();
  await p.getByLabel('情境政策', { exact: true }).selectOption('higherEducationSubsidy');
  await p.getByLabel('情境政策數值', { exact: true }).fill('500');
  await p.getByRole('button', { name: '套用至 B', exact: true }).click();
  await p.getByRole('button', { name: '兩分支推進 10 年', exact: true }).click();
  await p
    .getByRole('status')
    .filter({ hasText: '兩分支各推進 3650 日' })
    .waitFor({ timeout: 240000 });
  await p.getByRole('button', { name: 'Replay A / B', exact: true }).click();
  await p.getByRole('status').filter({ hasText: 'Replay A / B 通過' }).waitFor({ timeout: 240000 });
  await shot(p, 'education-policy-comparison');
  await p.getByText('高等 完成教育（成年 cohort）', { exact: true }).scrollIntoViewIfNeeded();
  await shot(p, 'education-policy-outcomes');
  await p.getByRole('button', { name: '兩分支推進 20 年', exact: true }).click();
  await p
    .getByRole('status')
    .filter({ hasText: '兩分支各推進 7300 日' })
    .waitFor({ timeout: 240000 });
  await p.getByRole('button', { name: 'Replay A / B', exact: true }).click();
  await p.getByRole('status').filter({ hasText: 'Replay A / B 通過' }).waitFor({ timeout: 240000 });
  await p.getByText('高等 完成教育（成年 cohort）', { exact: true }).scrollIntoViewIfNeeded();
  await shot(p, 'education-policy-20-year-outcomes');
  const persisted = await save(p);
  assert.ok(persisted.scenarios);
  assert.equal((await verifyScenarios(persisted.scenarios)).ok, true);
  assert.equal(
    persisted.scenarios.branches[0].state.day - persisted.scenarios.checkpoint.day,
    10950,
  );
  writeFileSync(path.join(out, 'education-scenarios.civitas'), readFileSync(file, 'utf8'));
  assert.equal(persisted.scenarios.branches[1].state.commands.at(-1)?.command.type, 'SET_POLICY');
  const integrity = await stateHash(persisted);
  mark(
    'Native higher-education policy branches run 10 then 20 years with real budget accounts, education/mobility/class comparison and identical A/B replay',
  );
  await close();
  p = await launch();
  await p.getByRole('button', { name: '載入', exact: true }).click();
  await p.getByRole('status').filter({ hasText: '城市已載入' }).waitFor();
  assert.equal(await stateHash(await save(p)), integrity);
  mark('Normal native close/relaunch/load preserves state, history and scenario container exactly');
  const legacy = path.resolve('tests/fixtures/phase1-save-v2.json');
  await dialogs(legacy);
  await p.getByRole('button', { name: '載入', exact: true }).click();
  await p.getByRole('status').filter({ hasText: '城市已載入' }).waitFor();
  await p.getByRole('button', { name: /^人力發展/ }).click();
  await shot(p, 'legacy-availability');
  await dialogs(file);
  const migrated = await save(p);
  assert.equal(migrated.state.day, 30);
  assert.equal(migrated.history.humanDevelopment.availableFromDay, 30);
  assert.ok(migrated.state.citizens.every((c) => c.humanCapital.provenance === 'legacy-inferred'));
  assert.equal((await verifyScenarios(migrated.scenarios!)).ok, true);
  const retained = migrated.state.citizens.find(
    (c) =>
      c.employmentStatus === 'employed' &&
      c.humanCapital.legacyOccupation &&
      !qualification(c, c.occupation as Occupation).checks.every((x) => x.actual >= x.required),
  );
  assert.ok(retained);
  await select(p, retained.id);
  const legacySection = p.locator('.human-citizen');
  await legacySection.getByRole('button', { name: '職涯', exact: true }).click();
  await legacySection
    .getByLabel('檢查職業資格', { exact: true })
    .selectOption(retained.occupation!);
  assert.ok((await legacySection.innerText()).includes('既有遷移任用可保留；未達新版招聘能力門檻'));
  await shot(p, 'legacy-retained-job-qualification');
  mark(
    'Genuine released v0.2.0 save loads through native IPC, exposes the upgrade availability boundary, saves as v3 and preserves branch replay',
  );
  await close();
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const mobile = await browser.newPage({ viewport: { width: 390, height: 844 } });
    watch(mobile);
    await mobile.goto('http://127.0.0.1:4173/');
    await mobile.getByRole('button', { name: /^人力發展/ }).click();
    await mobile.getByLabel('社會流動同群', { exact: true }).selectOption('tertiary');
    assert.equal(await mobile.evaluate(() => document.body.scrollWidth > innerWidth), false);
    await shot(mobile, 'development-mobile');
    mark(
      '390×844 human-development analytics and cohort controls remain usable without body overflow',
    );
  } finally {
    await browser.close();
  }
  assert.deepEqual(errors, []);
  writeFileSync(
    'artifacts/phase2a-human-qa.json',
    JSON.stringify(
      {
        passed: true,
        appVersion: version,
        checks,
        errors,
        citizen: grown.id,
        observedDay: observed.state.day,
        integrity,
        screenshots: out,
        testedAt: new Date().toISOString(),
      },
      null,
      2,
    ),
  );
} catch (e) {
  writeFileSync(
    'artifacts/phase2a-human-qa.json',
    JSON.stringify({ passed: false, checks, errors, error: String(e) }, null, 2),
  );
  throw e;
} finally {
  if (app) await close();
}
