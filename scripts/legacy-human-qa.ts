import { _electron, chromium } from 'playwright';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { loadObservatory } from '../packages/application/src/save';
import { qualification } from '../packages/domain/src/occupations';
import type { Occupation } from '../packages/domain/src/index';
import { closeBrowserTestSurface, closeNativeTestApp } from './native-test-close';

const version = JSON.parse(readFileSync('package.json', 'utf8')).version;
const fixture = path.resolve('tests/fixtures/phase1-save-v2.json');
const migrated = await loadObservatory(readFileSync(fixture, 'utf8'));
const retained = migrated.state.citizens.find(
  (c) => c.employmentStatus === 'employed' && c.humanCapital.legacyOccupation &&
    !qualification(c, c.occupation as Occupation).checks.every((x) => x.actual >= x.required),
)!;
assert.ok(retained);
const errors: string[] = [];
const app = await _electron.launch({
  executablePath: path.resolve('release', version, 'win-unpacked', 'Project CIVITAS.exe'),
  env: Object.fromEntries(Object.entries(process.env).filter(
    ([k, v]) => !['ELECTRON_RUN_AS_NODE', 'CIVITAS_DEV_URL'].includes(k) && v !== undefined,
  )) as Record<string, string>,
  timeout: 60000,
});
let functionalPassed = false;
let closePassed = false;
let failure: string | undefined;
try {
  const p = await app.firstWindow();
  p.on('pageerror', (e) => errors.push(e.message));
  p.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await app.evaluate(({ dialog }, file) => {
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [file] });
  }, fixture);
  await p.getByRole('button', { name: '載入', exact: true }).click();
  await p.getByRole('status').filter({ hasText: '城市已載入' }).waitFor();
  await p.getByRole('button', { name: /^人力發展/ }).click();
  await p.screenshot({ path: 'artifacts/qa/phase2a/legacy-availability.png' });
  await p.getByLabel('全域搜尋', { exact: true }).fill(retained.id);
  await p.locator('.search-results').getByRole('button').filter({ hasText: retained.id }).click();
  const section = p.locator('.human-citizen');
  await section.getByRole('button', { name: '職涯', exact: true }).click();
  await section.getByLabel('檢查職業資格', { exact: true }).selectOption(retained.occupation!);
  assert.ok((await section.innerText()).includes('既有遷移任用可保留；未達新版招聘能力門檻'));
  await p.screenshot({ path: 'artifacts/qa/phase2a/legacy-retained-job-qualification.png' });
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const mobile = await browser.newPage({ viewport: { width: 390, height: 844 } });
    mobile.on('pageerror', (e) => errors.push(e.message));
    await mobile.goto('http://127.0.0.1:4173/');
    await mobile.getByRole('button', { name: /^人力發展/ }).click();
    await mobile.getByLabel('社會流動同群', { exact: true }).selectOption('tertiary');
    assert.equal(await mobile.evaluate(() => document.body.scrollWidth > innerWidth), false);
    await mobile.screenshot({ path: 'artifacts/qa/phase2a/development-mobile.png' });
    assert.deepEqual(errors, []);
    functionalPassed = true;
    console.log('PASS: Genuine released legacy qualification and 390px development UI');
  } finally { await closeBrowserTestSurface(browser); }
  assert.deepEqual(errors, []);
} catch (e) { failure = String(e); }
try {
  const child = app.process();
  await closeNativeTestApp(app);
  assert.equal(child.exitCode, 0);
  closePassed = true;
} catch (e) { failure = [failure, String(e)].filter(Boolean).join('; '); }
writeFileSync('artifacts/phase2a-legacy-ui-qa.json', JSON.stringify({
  passed: functionalPassed && closePassed && !failure, appVersion: version,
  functionalPassed, closePassed, errors, failure, citizen: retained.id,
  fixture, testedAt: new Date().toISOString(),
}, null, 2));
if (!functionalPassed || !closePassed || failure) throw new Error(failure ?? 'Legacy UI QA failed');
