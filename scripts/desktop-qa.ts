import {
  _electron,
  chromium,
  type Page as BrowserPage,
  type ElectronApplication,
} from 'playwright';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import type { ChildProcess } from 'node:child_process';
import { loadCity, replayCity } from '../packages/simulation/src/persistence';
import { advance } from '../packages/simulation/src/index';
import { stateHash } from '../packages/shared/src/canonical';
const out = path.resolve('artifacts/qa');
mkdirSync(out, { recursive: true });
const savePath = path.join(out, 'qa-city.civitas');
const appVersion = JSON.parse(readFileSync('package.json', 'utf8')).version as string;
const executable = path.resolve('release', appVersion, 'win-unpacked', 'Project CIVITAS.exe');
const errors: string[] = [];
const steps: string[] = [];
const appProcesses = new WeakMap<ElectronApplication, ChildProcess>();
function mark(message: string) {
  steps.push(message);
  console.log('PASS:', message);
}
const env = Object.fromEntries(
  Object.entries(process.env).filter(
    ([k, v]) => k !== 'ELECTRON_RUN_AS_NODE' && k !== 'CIVITAS_DEV_URL' && v !== undefined,
  ),
) as Record<string, string>;
function watch(page: BrowserPage) {
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
}
async function launch() {
  const app = await _electron.launch({ executablePath: executable, env, timeout: 60000 });
  appProcesses.set(app, app.process());
  const page = await app.firstWindow();
  watch(page);
  await page.getByRole('heading', { name: '城市觀察', exact: true }).waitFor();
  await page.locator('canvas').waitFor();
  return { app, page };
}
async function screenshot(page: BrowserPage, name: string) {
  await page.screenshot({ path: path.join(out, `${name}.png`) });
}
async function configureDialogs(app: ElectronApplication) {
  await app.evaluate(({ dialog }, file) => {
    dialog.showSaveDialog = async () => ({ canceled: false, filePath: file });
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [file] });
  }, savePath);
}
async function contentSize(app: ElectronApplication, width: number, height: number) {
  await app.evaluate(
    ({ BrowserWindow }, size) =>
      BrowserWindow.getAllWindows()[0].setContentSize(size.width, size.height),
    { width, height },
  );
}
async function closeTestApp(app: ElectronApplication) {
  // Playwright destroys its dispatcher after close; retain the actual child
  // before shutdown rather than asking app.process() after disposal.
  const child = appProcesses.get(app)!;
  if (child.exitCode === null) await app.close();
  assert.equal(child.exitCode, 0);
}
async function day(page: BrowserPage) {
  const text = await page.locator('.clock small').innerText();
  return Number(text.match(/第\s*(\d+)/)?.[1]);
}
let desktop: Awaited<ReturnType<typeof launch>> | undefined;
try {
  desktop = await launch();
  let { app, page } = desktop;
  await configureDialogs(app);
  await contentSize(app, 1536, 1024);
  await page.getByRole('button', { name: '建立城市', exact: true }).click();
  await page.getByLabel('城市種子', { exact: true }).fill('CIVITAS-DESKTOP-QA');
  await page.getByLabel('初始人口', { exact: true }).selectOption('250');
  await page.getByRole('button', { name: '開始觀察', exact: true }).click();
  assert.equal(await day(page), 0);
  mark('Packaged app launches and creates seeded 250-person city');
  await screenshot(page, 'city-1536');
  await page.getByRole('button', { name: '20x', exact: true }).click();
  await page.waitForFunction(() => {
    const t = document.querySelector('.clock small')?.textContent ?? '';
    return Number(t.match(/第\s*(\d+)/)?.[1]) >= 60;
  });
  await page.getByRole('button', { name: '暫停', exact: true }).click();
  const paused = await day(page);
  assert.ok(paused >= 60);
  mark('20x advances and Pause stops simulation');
  await page.getByRole('button', { name: '居民 People & households', exact: true }).click();
  await page.getByLabel('搜尋居民', { exact: true }).fill('Anna');
  assert.ok((await page.locator('tbody tr').count()) > 0);
  await page.getByLabel('就業篩選', { exact: true }).selectOption('employed');
  await page.locator('tbody .name-button').first().click();
  await page.locator('.inspector').getByText('真實人生履歷', { exact: false }).waitFor();
  await screenshot(page, 'citizen-1536');
  mark('Citizen search, employment filter, inspector and real life history');
  await page.locator('.inspector .field').filter({ hasText: '雇主' }).getByRole('button').click();
  await page.getByRole('heading', { name: '企業檔案', exact: true }).waitFor();
  await screenshot(page, 'company-inspector-1536');
  mark('Citizen employer link opens actual company finances and history');
  await page.getByRole('button', { name: '企業 Firms & economy', exact: true }).click();
  await screenshot(page, 'companies-1536');
  assert.ok((await page.locator('tbody tr').count()) > 0);
  await page.getByRole('button', { name: '政府 Policies & institutions', exact: true }).click();
  const slider = page.getByLabel('所得稅率', { exact: true });
  await slider.focus();
  await slider.press('ArrowRight');
  await page
    .locator('.policy')
    .filter({ hasText: '所得稅率' })
    .getByRole('button', { name: '套用政策' })
    .click();
  await page.getByRole('status').filter({ hasText: '所得稅率已生效' }).waitFor();
  const construct = page.getByRole('button', { name: '興建住宅 · $40,000', exact: true });
  assert.equal(await construct.isEnabled(), true);
  await construct.focus();
  await construct.press('Enter');
  await page.getByRole('status').filter({ hasText: '已新增 5 戶住宅' }).waitFor();
  await screenshot(page, 'government-1536');
  mark('Tax policy command and funded construction modify simulation');
  await page.getByRole('button', { name: '事件 History & evidence', exact: true }).click();
  await page.getByRole('button', { name: '政策', exact: true }).click();
  assert.ok((await page.locator('.main-view').innerText()).includes('incomeTax'));
  await screenshot(page, 'events-1536');
  mark('News displays real policy event and related entities');
  await page.getByRole('button', { name: '存檔', exact: true }).click();
  await page.getByRole('status').filter({ hasText: '城市已儲存' }).waitFor();
  const saved = await loadCity(readFileSync(savePath, 'utf8'));
  const savedHash = await stateHash(saved);
  assert.equal(saved.commands.length, 2);
  assert.equal(saved.day, paused);
  mark('Native IPC writes validated versioned save including command ledger');
  await closeTestApp(app);
  desktop = undefined;
  desktop = await launch();
  app = desktop.app;
  page = desktop.page;
  await configureDialogs(app);
  await page.getByRole('button', { name: '載入', exact: true }).click();
  await page.getByRole('status').filter({ hasText: '城市已載入' }).waitFor();
  assert.equal(await day(page), saved.day);
  await page.getByRole('button', { name: '存檔', exact: true }).click();
  await page.getByRole('status').filter({ hasText: '城市已儲存' }).waitFor();
  assert.equal(await stateHash(await loadCity(readFileSync(savePath, 'utf8'))), savedHash);
  mark('Close, relaunch, load restores identical canonical SHA-256');
  await page.getByRole('button', { name: '前進一天', exact: true }).click();
  assert.equal(await day(page), saved.day + 1);
  await page.getByRole('button', { name: '存檔', exact: true }).click();
  await page.getByRole('status').filter({ hasText: '城市已儲存' }).waitFor();
  const continued = await loadCity(readFileSync(savePath, 'utf8'));
  advance(saved);
  assert.equal(await stateHash(continued), await stateHash(saved));
  assert.equal(await stateHash(continued), await stateHash(replayCity(continued)));
  mark('Continued packaged simulation equals uninterrupted run and full replay');
  await page.getByRole('button', { name: '診斷與重播', exact: true }).click();
  await page.getByRole('button', { name: '驗證完整重播', exact: true }).click();
  await page.getByRole('status').filter({ hasText: '重播通過' }).waitFor();
  await screenshot(page, 'replay-verified');
  await page.getByRole('button', { name: '關閉診斷', exact: true }).click();
  mark('UI replay verification reports matching SHA-256');
  await contentSize(app, 1280, 800);
  await screenshot(page, 'city-1280');
  await page.getByRole('button', { name: '建立城市', exact: true }).click();
  await page.getByLabel('初始人口', { exact: true }).selectOption('1000');
  await page.getByRole('button', { name: '開始觀察', exact: true }).click();
  await page.getByRole('button', { name: '前進一天', exact: true }).click();
  await screenshot(page, 'city-1000-1280');
  mark('1000-person city creates, renders and advances at 1280×800');
  for (const speed of ['1x', '5x', 'Max']) {
    const before = await day(page);
    await page.getByRole('button', { name: speed, exact: true }).click();
    await page.waitForFunction(
      (previous) =>
        Number(
          (document.querySelector('.clock small')?.textContent ?? '').match(/第\s*(\d+)/)?.[1],
        ) > previous,
      before,
    );
    await page.getByRole('button', { name: '暫停', exact: true }).click();
  }
  mark('1x, 5x and bounded Max all advance the actual 1000-citizen city');
  assert.equal(await page.title(), 'Project CIVITAS');
  assert.ok((await page.locator('body').innerText()).includes('CIVITAS'));
  assert.equal(await page.locator('vite-error-overlay').count(), 0);
  await closeTestApp(app);
  desktop = undefined;
  // Browser responsive QA in addition to the real packaged Windows executable.
  const browserServer = await chromium.launchServer({ channel: 'msedge', headless: true });
  const browser = await chromium.connect(browserServer.wsEndpoint());
  try {
    const mobile = await browser.newPage({ viewport: { width: 390, height: 844 } });
    watch(mobile);
    mobile.setDefaultTimeout(30000);
    console.log('QA: mobile navigation');
    await mobile.goto('http://127.0.0.1:4173/', { waitUntil: 'domcontentloaded', timeout: 30000 });
    console.log('QA: mobile canvas');
    await mobile.locator('canvas').waitFor();
    assert.ok(
      await mobile.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    );
    await screenshot(mobile, 'city-mobile');
    await mobile.getByRole('button', { name: '政府 Policies & institutions', exact: true }).click();
    await screenshot(mobile, 'government-mobile');
    mark('390×844 responsive browser layout and policy controls render without body overflow');
  } finally {
    await browser.close();
    await browserServer.close();
  }
  assert.deepEqual(errors, []);
  writeFileSync(
    'artifacts/desktop-qa.json',
    JSON.stringify(
      {
        passed: true,
        executable,
        viewports: ['1536×1024', '1280×800', '390×844'],
        steps,
        consoleErrors: errors,
        dialogAutomation:
          'Native dialog result paths controlled by test harness; actual packaged IPC/filesystem/save validation exercised. Electron app.close() exits normally with code 0; no force kill. Separate WM_CLOSE acceptance verifies all owned processes for both Windows variants.',
        saveHash: savedHash,
      },
      null,
      2,
    ),
  );
  console.log(`PASS: ${steps.length} desktop/responsive checks, no console errors.`);
} catch (e) {
  writeFileSync(
    'artifacts/desktop-qa.json',
    JSON.stringify({ passed: false, steps, errors, error: String(e) }, null, 2),
  );
  throw e;
} finally {
  if (desktop) await closeTestApp(desktop.app);
}
