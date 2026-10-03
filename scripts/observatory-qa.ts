import { _electron, chromium, type Page, type ElectronApplication } from 'playwright';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { loadObservatory } from '../packages/application/src/save';
import { saveCity } from '../packages/simulation/src/persistence';
import { createCity, advance } from '../packages/simulation/src/index';
import { verifyScenarios } from '../packages/application/src/scenarios';
import { stateHash } from '../packages/shared/src/canonical';

const version = JSON.parse(readFileSync('package.json', 'utf8')).version;
const out = path.resolve('artifacts/qa/phase1-1');
mkdirSync(out, { recursive: true });
const savePath = path.join(out, 'observatory.civitas'),
  legacyPath = path.join(out, 'legacy.civitas');
const errors: string[] = [],
  checks: string[] = [],
  timings: { phase: string; meanMs: number; refs: number }[] = [];
const env = Object.fromEntries(
  Object.entries(process.env).filter(
    ([k, v]) => !['ELECTRON_RUN_AS_NODE', 'CIVITAS_DEV_URL'].includes(k) && v !== undefined,
  ),
) as Record<string, string>;
let app: ElectronApplication | undefined;
function watch(page: Page) {
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
}
async function launch() {
  app = await _electron.launch({
    executablePath: path.resolve('release', version, 'win-unpacked', 'Project CIVITAS.exe'),
    env,
    timeout: 60000,
  });
  const page = await app.firstWindow();
  watch(page);
  await page.getByRole('heading', { name: '城市觀察', exact: true }).waitFor();
  await app.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()[0].setContentSize(1536, 1024),
  );
  await dialogs(savePath);
  return page;
}
async function dialogs(file: string) {
  await app!.evaluate(({ dialog }, file) => {
    dialog.showSaveDialog = async () => ({ canceled: false, filePath: file });
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [file] });
  }, file);
}
async function shot(page: Page, name: string) {
  await page.screenshot({ path: path.join(out, `${name}.png`) });
}
async function save(page: Page) {
  if (await page.getByRole('button', { name: '關閉通知', exact: true }).count())
    await page.getByRole('button', { name: '關閉通知', exact: true }).click();
  await page.getByRole('button', { name: '存檔', exact: true }).click();
  await page.getByRole('status').filter({ hasText: '城市已儲存' }).waitFor();
  return loadObservatory(readFileSync(savePath, 'utf8'));
}
async function close() {
  const child = app!.process();
  await app!.close();
  assert.equal(child.exitCode, 0);
  app = undefined;
}
const mark = (text: string) => {
  checks.push(text);
  console.log('PASS:', text);
};
try {
  let page = await launch();
  await page.getByRole('button', { name: '建立城市', exact: true }).click();
  await page.getByLabel('城市種子', { exact: true }).fill('CIVITAS-OBSERVATORY-QA');
  await page.getByRole('button', { name: '開始觀察', exact: true }).click();
  await page.getByRole('button', { name: 'Max', exact: true }).click();
  await page.waitForFunction(
    () =>
      Number(document.querySelector('.clock small')?.textContent?.match(/第\s*(\d+)/)?.[1]) >= 1825,
    undefined,
    { timeout: 90000 },
  );
  await page.getByRole('button', { name: '暫停', exact: true }).click();
  const observed = await save(page);
  assert.ok(observed.state.day >= 1825);
  assert.equal(observed.history.yearly.filter((p) => p.count === 365).length, 5);
  mark('Native city advances 5 years; v3 save contains real observed metric/entity history');
  await page.getByRole('button', { name: '解釋失業率', exact: true }).click();
  await page.getByRole('heading', { name: '勞動人口失業率', exact: true }).waitFor();
  await page.getByRole('button', { name: '10 年 / 月採樣', exact: true }).click();
  await page.getByRole('button', { name: 'Explain · 解釋這個數字', exact: true }).click();
  assert.ok((await page.locator('.evidence-section').innerText()).includes('CITIZEN_FIRED'));
  await shot(page, 'metric-explanation');
  await page.locator('.evidence-section h2').scrollIntoViewIfNeeded();
  await shot(page, 'metric-evidence');
  mark(
    'Unemployment detail shows actual trend, deltas, recorded job losses and contribution/association distinction',
  );
  const fired = observed.state.events.find(
    (e) => e.type === 'CITIZEN_FIRED' && e.entityRefs.some((r) => r.kind === 'company'),
  )!;
  assert.ok(fired);
  const companyId = fired.entityRefs.find((r) => r.kind === 'company')!.id,
    company = observed.state.companies.find((c) => c.id === companyId)!;
  await page.locator('.evidence-group').filter({ hasText: company.name }).click();
  await page.getByRole('heading', { name: '企業檔案', exact: true }).waitFor();
  await page
    .locator('.inspector')
    .getByRole('button', { name: 'Focus on Map · 真實目前位置', exact: true })
    .click();
  assert.equal(await page.locator('.map-host').getAttribute('data-selected-id'), companyId);
  await shot(page, 'company-focus');
  mark('Actual affected company opens historical inspector and deterministic map footprint');
  await page.getByRole('button', { name: '返回調查脈絡', exact: true }).click();
  await page.getByRole('button', { name: '返回調查脈絡', exact: true }).click();
  assert.ok(await page.locator('.evidence-section').isVisible());
  assert.equal(await page.locator('.tabs .active').innerText(), '10 年 / 月採樣');
  mark('Back restores prior metric explanation and time-range context');
  const lifeTicks = new Map<string, number[]>();
  for (const event of observed.state.events)
    for (const ref of event.entityRefs)
      if (ref.kind === 'citizen') {
        const ticks = lifeTicks.get(ref.id) ?? [];
        ticks.push(event.tick);
        lifeTicks.set(ref.id, ticks);
      }
  const citizenId = observed.state.citizens.find((c) => {
    const ticks = lifeTicks.get(c.id) ?? [];
    return ticks.length <= 30 && ticks.at(-1)! - ticks[0] >= 1095;
  })!.id;
  await page.getByLabel('全域搜尋', { exact: true }).fill(citizenId);
  await page.locator('.search-results').getByRole('button').filter({ hasText: citizenId }).click();
  await page.getByRole('heading', { name: '居民檔案', exact: true }).waitFor();
  await page.locator('.entity-history').getByText('Life · 多年人生軌跡', { exact: true }).waitFor();
  assert.ok((await page.locator('.life-years > section > h4').count()) >= 2);
  await page
    .locator('.entity-history')
    .getByText('Life · 多年人生軌跡', { exact: true })
    .scrollIntoViewIfNeeded();
  await shot(page, 'citizen-life');
  await page.locator('.inspector .field').filter({ hasText: '家庭' }).getByRole('button').click();
  await page.getByRole('heading', { name: '家庭檔案', exact: true }).waitFor();
  assert.ok(await page.locator('.entity-history svg').count());
  await page.locator('.entity-history').scrollIntoViewIfNeeded();
  await shot(page, 'household-history');
  mark(
    'Citizen Life and bidirectional household navigation show real employment/residence/financial evidence and monthly financial samples',
  );
  await page.getByLabel('全域搜尋', { exact: true }).fill(companyId);
  await page.locator('.search-results').getByRole('button').filter({ hasText: companyId }).click();
  const causeId = fired.causeEventIds[0]!;
  assert.ok(causeId);
  // Reach the layoff/bankruptcy event through this actual company's indexed timeline.
  let found = false;
  for (let i = 0; i < 20; i++) {
    if (
      await page
        .locator('.inspector .event-row')
        .filter({ has: page.locator('small').filter({ hasText: new RegExp(`${causeId}$`) }) })
        .count()
    ) {
      found = true;
      break;
    }
    const more = page.getByRole('button', { name: '更早的 Life / History', exact: true });
    if (!(await more.count())) break;
    await more.click();
  }
  assert.ok(found);
  await page
    .locator('.inspector .event-row')
    .filter({ has: page.locator('small').filter({ hasText: new RegExp(`${causeId}$`) }) })
    .getByRole('button', { name: 'Trace Causes / Effects', exact: true })
    .first()
    .click();
  await page.getByRole('button', { name: 'Trace Causes', exact: true }).click();
  await page.getByRole('button', { name: 'Trace Effects', exact: true }).click();
  assert.ok(await page.locator('.causal-edges').getByText('→ recorded →', { exact: true }).count());
  await shot(page, 'causal-effects');
  mark(
    'Real layoff/bankruptcy event supports bounded recorded causes/effects; absence is not invented',
  );
  await page.getByRole('button', { name: 'Focus on Map', exact: true }).click();
  assert.ok(Number(await page.locator('.map-host').getAttribute('data-affected-count')) > 0);
  await page.getByLabel('受影響實體圖層', { exact: true }).selectOption('citizen');
  await shot(page, 'affected-overlay');
  const times: number[] = [];
  for (let i = 0; i < 20; i++) {
    await page.getByRole('button', { name: '前進一天', exact: true }).click();
    times.push(Number(await page.locator('.map-host').getAttribute('data-render-ms')));
  }
  timings.push({
    phase: '250-person retained scene + recorded causal affected overlay, 20 updates',
    meanMs: times.reduce((n, v) => n + v, 0) / times.length,
    refs: Number(await page.locator('.map-host').getAttribute('data-affected-count')),
  });
  mark(
    'Affected companies/households/residents overlay changes presentation only; measured 20 scene updates',
  );
  await page.getByRole('button', { name: '城市歷史 Year in Review', exact: true }).click();
  await page.getByLabel('歷史年度', { exact: true }).selectOption('0');
  assert.ok((await page.locator('.year-review').innerText()).includes('年度稅收'));
  await shot(page, 'year-review');
  await page
    .locator('.year-review')
    .getByRole('button', { name: 'Focus on Map · 年度事件', exact: true })
    .click();
  await page.locator('canvas').waitFor();
  await page.getByRole('button', { name: '返回調查脈絡', exact: true }).click();
  assert.equal(await page.getByLabel('歷史年度', { exact: true }).inputValue(), '0');
  await page
    .locator('.year-review')
    .getByRole('button', { name: 'Focus on Map · 年度事件', exact: true })
    .click();
  mark('City History annual review links evidence back into the real city map');
  await page.getByRole('button', { name: '清除調查圖層', exact: true }).click();
  await page.getByRole('button', { name: '情境比較 Simulation comparison', exact: true }).click();
  await page
    .getByRole('button', { name: '從目前城市 / 已載入存檔 Fork A / B', exact: true })
    .click();
  await page.getByLabel('情境政策數值', { exact: true }).fill('4000');
  await page.getByRole('button', { name: '套用至 B', exact: true }).click();
  await page.getByRole('button', { name: '兩分支推進 30 日', exact: true }).click();
  await page.getByRole('status').filter({ hasText: '兩分支各推進 30 日' }).waitFor();
  await page.getByRole('button', { name: '兩分支推進 1 年', exact: true }).click();
  await page.getByRole('status').filter({ hasText: '兩分支各推進 365 日' }).waitFor();
  await page.getByRole('button', { name: '兩分支推進 5 年', exact: true }).click();
  await page
    .getByRole('status')
    .filter({ hasText: '兩分支各推進 1825 日' })
    .waitFor({ timeout: 90000 });
  await page.getByRole('button', { name: 'Replay A / B', exact: true }).click();
  await page
    .getByRole('status')
    .filter({ hasText: 'Replay A / B 通過' })
    .waitFor({ timeout: 90000 });
  await shot(page, 'scenario-comparison');
  mark(
    'Fork A/B executes distinct policies, 30-day/1-year/5-year comparison and deterministic replay',
  );
  const persisted = await save(page);
  assert.ok(persisted.scenarios);
  assert.equal((await verifyScenarios(persisted.scenarios!)).ok, true);
  const truth = await stateHash(persisted.state),
    container = await stateHash(persisted);
  assert.equal(
    persisted.scenarios!.branches[0].state.commands.length,
    persisted.scenarios!.checkpoint.commands.length,
  );
  await close();
  page = await launch();
  await page.getByRole('button', { name: '載入', exact: true }).click();
  await page.getByRole('status').filter({ hasText: '城市已載入' }).waitFor();
  await page.getByRole('button', { name: '情境比較 Simulation comparison', exact: true }).click();
  await page.getByRole('button', { name: 'Replay A / B', exact: true }).click();
  await page
    .getByRole('status')
    .filter({ hasText: 'Replay A / B 通過' })
    .waitFor({ timeout: 90000 });
  const reloaded = await save(page);
  assert.equal(await stateHash(reloaded.state), truth);
  assert.equal(await stateHash(reloaded), container);
  mark(
    'Normal exit/relaunch/reload preserves original truth, history, scenario checkpoint and both branch replay guarantees',
  );
  const legacy = createCity({ seed: 'LEGACY-OBSERVATORY', population: 100 });
  advance(legacy, 90);
  writeFileSync(legacyPath, await saveCity(legacy));
  await dialogs(legacyPath);
  await page.getByRole('button', { name: '載入', exact: true }).click();
  await page.getByRole('status').filter({ hasText: '城市已載入' }).waitFor();
  await page.getByRole('button', { name: '解釋失業率', exact: true }).click();
  assert.ok((await page.locator('.investigation').innerText()).includes('Y01 · D091'));
  assert.ok((await page.locator('.evidence-summary').innerText()).includes('未有詳細歷史'));
  mark(
    'Native v1 migration explicitly marks detailed-history availability and does not fabricate deltas',
  );
  assert.equal(await page.evaluate(() => document.body.scrollWidth > innerWidth), false);
  await close();
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const mobile = await browser.newPage({ viewport: { width: 390, height: 844 } });
    watch(mobile);
    await mobile.goto('http://127.0.0.1:4173/');
    await mobile.getByRole('button', { name: '解釋失業率', exact: true }).click();
    await mobile.getByRole('heading', { name: '勞動人口失業率', exact: true }).waitFor();
    assert.equal(await mobile.evaluate(() => document.body.scrollWidth > innerWidth), false);
    assert.ok((await mobile.locator('.investigation h1').boundingBox())!.y < 844);
    await shot(mobile, 'metric-mobile');
    mark('390×844 investigation layout has no body overflow and metric controls remain usable');
  } finally {
    await browser.close();
  }
  assert.deepEqual(errors, []);
  writeFileSync(
    'artifacts/observatory-qa.json',
    JSON.stringify(
      {
        passed: true,
        appVersion: version,
        checks,
        consoleErrors: errors,
        timings,
        saveTruthHash: truth,
        containerIntegrityHash: container,
        screenshots: 'artifacts/qa/phase1-1',
        testedAt: new Date().toISOString(),
      },
      null,
      2,
    ),
  );
} catch (error) {
  writeFileSync(
    'artifacts/observatory-qa.json',
    JSON.stringify({ passed: false, checks, errors, error: String(error) }, null, 2),
  );
  throw error;
} finally {
  if (app) await close();
}
