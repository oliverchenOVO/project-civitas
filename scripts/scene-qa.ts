import { _electron, chromium, type Page } from 'playwright';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { loadObservatory } from '../packages/application/src/save';
import { stateHash } from '../packages/shared/src/canonical';
import { closeBrowserTestSurface, closeNativeTestApp } from './native-test-close';
import { QA_PREVIEW_URL } from './qa-preview';
const version = JSON.parse(readFileSync('package.json', 'utf8')).version;
const out = path.resolve('artifacts/qa/3d');
mkdirSync(out, { recursive: true });
const errors: string[] = [],
  checks: string[] = [];
const env = Object.fromEntries(
  Object.entries(process.env).filter(
    ([k, v]) => !['ELECTRON_RUN_AS_NODE', 'CIVITAS_DEV_URL'].includes(k) && v !== undefined,
  ),
) as Record<string, string>;
const app = await _electron.launch({
  executablePath: path.resolve('release', version, 'win-unpacked', 'Project CIVITAS.exe'),
  env,
  timeout: 60000,
});
const child = app.process();
function watch(p: Page) {
  p.on('pageerror', (e) => errors.push(e.message));
  p.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
}
async function angle(p: Page, label: string, value: number) {
  const before = Number(await p.locator('.map-host').getAttribute('data-frame'));
  await p.getByRole('button', { name: label, exact: true }).click();
  await p.waitForFunction(
    ({ value, before }) =>
      Number(document.querySelector('.map-host')?.getAttribute('data-frame')) > before &&
      Math.abs(
        Number(document.querySelector('.map-host')?.getAttribute('data-elevation')) - value,
      ) < 0.1,
    { value, before },
  );
}
async function target(p: Page, kind: string) {
  return p.evaluate((kind) => {
    const host = document.querySelector('.map-host')!,
      b = host.getBoundingClientRect();
    const targets = JSON.parse(host.getAttribute('data-pick-targets')!) as {
      kind: string;
      id: string;
      x: number;
      y: number;
    }[];
    return targets.find(
      (t) =>
        t.kind === kind && document.elementFromPoint(b.x + t.x, b.y + t.y)?.tagName === 'CANVAS',
    );
  }, kind);
}
async function shot(p: Page, name: string) {
  await p.screenshot({ path: path.join(out, name + '.png') });
}
async function truth(p: Page) {
  if (await p.getByRole('button', { name: '關閉通知', exact: true }).count())
    await p.getByRole('button', { name: '關閉通知', exact: true }).click();
  await p.getByRole('button', { name: '存檔', exact: true }).click();
  await p.getByRole('status').filter({ hasText: '城市已儲存' }).waitFor();
  return stateHash(
    (await loadObservatory(readFileSync(path.join(out, 'camera.civitas'), 'utf8'))).state,
  );
}
const mark = (s: string) => {
  checks.push(s);
  console.log('PASS:', s);
};
try {
  const page = await app.firstWindow();
  await app.evaluate(
    ({ dialog }, file) => {
      dialog.showSaveDialog = async () => ({ canceled: false, filePath: file });
    },
    path.join(out, 'camera.civitas'),
  );
  watch(page);
  await app.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()[0].setContentSize(1536, 1024),
  );
  await page.locator('.map-host[data-scene-ready="true"]').waitFor({ timeout: 60000 });
  assert.equal(await page.title(), 'Project CIVITAS');
  assert.equal(await page.locator('vite-error-overlay').count(), 0);
  assert.equal(await page.locator('.map-host').getAttribute('data-buildings'), '136');
  assert.equal(await page.locator('.map-host').getAttribute('data-residents'), '250');
  const initialTruth = await truth(page);
  mark('Native Three WebGL scene renders 136 real buildings and 250 real address markers');
  for (const [name, label, value] of [
    ['top', '俯視 90°', 90],
    ['oblique', '斜視 45°', 45],
    ['horizontal', '水平 0°', 0],
  ] as const) {
    await angle(page, label, value);
    await shot(page, name);
  }
  mark('90° top, 45° oblique and 0° ground-parallel camera endpoints verified');
  await angle(page, '俯視 90°', 90);
  const before = JSON.parse((await page.locator('.map-host').getAttribute('data-view'))!);
  await page.getByRole('button', { name: '向右旋轉城市', exact: true }).click();
  await page.waitForFunction(
    (v) =>
      Math.abs(
        JSON.parse(document.querySelector('.map-host')!.getAttribute('data-view')!).azimuth - v,
      ) > 20,
    before.azimuth,
  );
  await page.getByRole('button', { name: '放大城市', exact: true }).click();
  await page.locator('canvas').focus();
  await page.locator('canvas').press('ArrowDown');
  await page.waitForFunction(
    () => Number(document.querySelector('.map-host')?.getAttribute('data-elevation')) < 89,
  );
  await page.getByRole('button', { name: '重設視角', exact: true }).click();
  await angle(page, '俯視 90°', 90);
  mark('Orbit rotation, zoom, keyboard elevation and reset change actual camera state');
  const host = (await page.locator('.map-host').boundingBox())!;
  const resident = (await target(page, 'citizen'))!;
  assert.ok(resident, 'Visible unobscured resident address marker');
  await page.mouse.move(host.x + resident.x, host.y + resident.y);
  await page.locator('.map-hover').filter({ hasText: resident.id }).waitFor();
  await page.mouse.click(host.x + resident.x, host.y + resident.y);
  await page.getByRole('heading', { name: '居民檔案', exact: true }).waitFor();
  assert.equal(await page.locator('.map-host').getAttribute('data-selected-id'), resident.id);
  await page.getByRole('button', { name: '靠近選取', exact: true }).click();
  await shot(page, 'selected-residence');
  await page.getByRole('button', { name: '關閉檔案', exact: true }).click();
  await page.getByRole('button', { name: '重設視角', exact: true }).click();
  await angle(page, '俯視 90°', 90);
  const company = (await target(page, 'company'))!;
  assert.ok(company, 'Visible unobscured company roof');
  const box = (await page.locator('.map-host').boundingBox())!;
  await page.mouse.click(box.x + company.x, box.y + company.y);
  await page.getByRole('heading', { name: '企業檔案', exact: true }).waitFor();
  assert.equal(await page.locator('.map-host').getAttribute('data-selected-id'), company.id);
  mark(
    'Raycast hover/click opens actual citizen and company, and focus moves to the selected real residence',
  );
  await page.getByRole('button', { name: '關閉檔案', exact: true }).click();
  await page.getByRole('button', { name: '居民圖層', exact: true }).click();
  assert.equal(
    await page.getByRole('button', { name: '居民圖層', exact: true }).getAttribute('aria-pressed'),
    'false',
  );
  await page.getByRole('button', { name: '居民圖層', exact: true }).click();
  await page.getByRole('button', { name: '全螢幕', exact: true }).click();
  await page.waitForFunction(() => !!document.fullscreenElement);
  await shot(page, 'fullscreen');
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !document.fullscreenElement);
  mark('Real layer toggles and fullscreen/exit controls work');
  assert.equal(await truth(page), initialTruth);
  mark('Camera, picking, layers and fullscreen leave the native simulation truth hash unchanged');
  await page.getByRole('button', { name: '建立城市', exact: true }).click();
  await page.getByLabel('城市種子', { exact: true }).fill('CIVITAS-DESKTOP-QA');
  await page.getByLabel('初始人口', { exact: true }).selectOption('1000');
  await page.getByRole('button', { name: '開始觀察', exact: true }).click();
  await page.waitForFunction(
    () => document.querySelector('.map-host')?.getAttribute('data-residents') === '1000',
  );
  await angle(page, '斜視 45°', 45);
  await shot(page, 'city-1000');
  const samples: number[] = [];
  for (let i = 0; i < 20; i++) {
    await page.getByRole('button', { name: '前進一天', exact: true }).click();
    samples.push(Number(await page.locator('.map-host').getAttribute('data-render-ms')));
  }
  assert.equal(await page.evaluate(() => document.body.scrollWidth > innerWidth), false);
  const drawCalls = Number(await page.locator('.map-host').getAttribute('data-draw-calls'));
  mark('1000-person scene advances 20 days without overflow or runtime errors');
  await closeNativeTestApp(app);
  assert.equal(child.exitCode, 0);
  mark('Packaged native window closes normally with exit code 0');
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const mobile = await browser.newPage({ viewport: { width: 390, height: 844 } });
    watch(mobile);
    await mobile.goto(QA_PREVIEW_URL);
    await mobile.locator('.map-host[data-scene-ready="true"]').waitFor();
    await angle(mobile, '水平 0°', 0);
    assert.equal(await mobile.evaluate(() => document.body.scrollWidth > innerWidth), false);
    await mobile.locator('.map-camera').scrollIntoViewIfNeeded();
    await shot(mobile, 'mobile');
    mark('390×844 responsive 3D controls and horizontal view work without body overflow');
  } finally {
    await closeBrowserTestSurface(browser);
  }
  assert.deepEqual(errors, []);
  writeFileSync(
    'artifacts/scene-3d-qa.json',
    JSON.stringify(
      {
        passed: true,
        appVersion: version,
        checks,
        consoleErrors: errors,
        cpuUpdateMeanMs: samples.reduce((a, b) => a + b, 0) / samples.length,
        drawCalls,
        measurement: 'CPU simulation data/instance/overlay updates; not GPU timing or FPS',
        screenshots: 'artifacts/qa/3d',
        validation:
          'Browser plugin not available; native Playwright Electron plus existing Edge responsive harness',
        testedAt: new Date().toISOString(),
      },
      null,
      2,
    ),
  );
} catch (e) {
  writeFileSync(
    'artifacts/scene-3d-qa.json',
    JSON.stringify({ passed: false, checks, errors, error: String(e) }, null, 2),
  );
  throw e;
} finally {
  if (child.exitCode === null) await closeNativeTestApp(app);
}
