import { _electron, chromium, type Page } from 'playwright';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createCity } from '../packages/simulation/src/index';
import { createCityLayout, type Point } from '../apps/desktop/src/scene/layout';
import { projectSceneData } from '../apps/desktop/src/scene/data';

const version = JSON.parse(readFileSync('package.json', 'utf8')).version as string;
const out = path.resolve('artifacts/qa/phase1-1/scene');
mkdirSync(out, { recursive: true });
const errors: string[] = [],
  checks: string[] = [];
const timings: { population: number; phase: string; renderMs: number }[] = [];
const env = Object.fromEntries(
  Object.entries(process.env).filter(
    ([k, v]) => k !== 'ELECTRON_RUN_AS_NODE' && k !== 'CIVITAS_DEV_URL' && v !== undefined,
  ),
) as Record<string, string>;
const hash = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
function watch(page: Page) {
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
}
async function newCity(page: Page, population: number) {
  await page.getByRole('button', { name: '建立城市', exact: true }).click();
  await page.getByLabel('城市種子', { exact: true }).fill('CIVITAS-DESKTOP-QA');
  await page.getByLabel('初始人口', { exact: true }).selectOption(String(population));
  await page.getByRole('button', { name: '開始觀察', exact: true }).click();
  await page.locator('.map-host[data-scene-ready="true"]').waitFor();
  await page.waitForFunction(
    (count) =>
      Number(document.querySelector('.map-host')?.getAttribute('data-residents')) === count,
    population,
  );
}
async function checkGeometry(page: Page) {
  const result = await page.evaluate(() => {
    const host = document.querySelector('.map-host')!,
      bounds = host.getBoundingClientRect();
    const labels = [...host.querySelectorAll('.district-label')].map((label) => {
      const r = label.getBoundingClientRect();
      return {
        name: label.textContent,
        inside:
          r.left >= bounds.left &&
          r.right <= bounds.right &&
          r.top >= bounds.top &&
          r.bottom <= bounds.bottom,
        fontSize: getComputedStyle(label.querySelector('strong')!).fontSize,
      };
    });
    const legend = host.querySelector('.map-legend')!.getBoundingClientRect();
    return {
      overflow: document.body.scrollWidth > innerWidth,
      labels,
      legend,
      labelLegendOverlap: [...host.querySelectorAll('.district-label')].some((label) => {
        const r = label.getBoundingClientRect();
        return r.bottom > legend.top && r.top < legend.bottom;
      }),
    };
  });
  assert.equal(result.overflow, false);
  assert.equal(result.labels.length, 4);
  assert.ok(result.labels.every((l) => l.inside && parseFloat(l.fontSize) >= 12));
  assert.equal(result.labelLegendOverlap, false);
  return result;
}
async function worldPoint(page: Page, point: Point) {
  const bounds = (await page.locator('canvas').boundingBox())!;
  const view = JSON.parse((await page.locator('.map-host').getAttribute('data-view'))!);
  return {
    x: bounds.x + view.x + point.x * view.scale,
    y: bounds.y + view.y + point.y * view.scale,
  };
}
async function unobscured(page: Page, points: Point[]) {
  const labels = await page.locator('.district-label').evaluateAll((items) =>
    items.map((item) => {
      const r = item.getBoundingClientRect();
      return { x: r.x, y: r.y, w: r.width, h: r.height };
    }),
  );
  for (const point of points) {
    const p = await worldPoint(page, point);
    if (!labels.some((r) => p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h))
      return point;
  }
  throw new Error('No unobscured map interaction target');
}
async function shot(page: Page, name: string) {
  await page.screenshot({ path: path.join(out, name + '.png') });
}
const app = await _electron.launch({
  executablePath: path.resolve('release', version, 'win-unpacked', 'Project CIVITAS.exe'),
  env,
  timeout: 60000,
});
const child = app.process();
try {
  const page = await app.firstWindow();
  watch(page);
  await page.getByRole('heading', { name: '城市觀察', exact: true }).waitFor();
  await app.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()[0].setContentSize(1536, 1024),
  );
  await newCity(page, 250);
  assert.equal(await page.title(), 'Project CIVITAS');
  const runtime = await app.evaluate(() => ({
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    node: process.versions.node,
  }));
  const source = createCity({ seed: 'CIVITAS-DESKTOP-QA', population: 250 });
  const layout = createCityLayout(source),
    data = projectSceneData(source, layout);
  assert.equal(
    Number(await page.locator('.map-host').getAttribute('data-buildings')),
    source.buildings.length,
  );
  await checkGeometry(page);
  await shot(page, 'city-1536');
  checks.push(
    '1536×1024 native scene: real building/resident counts, four readable labels, no label/legend overlap or body overflow',
  );
  await page.getByRole('button', { name: '選取行政區 Northbank', exact: true }).click();
  await page.getByRole('heading', { name: '行政區檔案', exact: true }).waitFor();
  assert.ok((await page.locator('.inspector').innerText()).includes('district-1'));
  await shot(page, 'district-selected');
  checks.push('District label selects real district and inspector links');
  const residentPoint = await unobscured(page, data.residents);
  const resident = data.residents.find((r) => r.x === residentPoint.x && r.y === residentPoint.y)!;
  let pos = await worldPoint(page, resident);
  await page.mouse.move(pos.x, pos.y);
  await page.getByRole('status').filter({ hasText: resident.id }).waitFor();
  await page.mouse.click(pos.x, pos.y);
  await page.getByRole('heading', { name: '居民檔案', exact: true }).waitFor();
  assert.equal(await page.locator('.map-host').getAttribute('data-selected-id'), resident.id);
  await shot(page, 'citizen-selected');
  checks.push(
    'Canvas resident hover and click opens actual citizen inspector with residence highlight',
  );
  await page.mouse.move(20, 20);
  const canvasOn = hash(await page.locator('canvas').screenshot());
  await page.getByRole('button', { name: '居民圖層', exact: true }).click();
  assert.equal(
    await page.getByRole('button', { name: '居民圖層', exact: true }).getAttribute('aria-pressed'),
    'false',
  );
  assert.notEqual(hash(await page.locator('canvas').screenshot()), canvasOn);
  const occupied = data.buildings.filter((b) => b.householdIds.length);
  const homePoint = await unobscured(
    page,
    occupied.map((b) => b.parcel),
  );
  const home = occupied.find((b) => b.parcel.x === homePoint.x && b.parcel.y === homePoint.y)!;
  pos = await worldPoint(page, home.parcel);
  await page.mouse.click(pos.x, pos.y);
  await page.getByRole('heading', { name: '家庭檔案', exact: true }).waitFor();
  assert.equal(
    await page.locator('.map-host').getAttribute('data-selected-id'),
    home.householdIds[0],
  );
  await shot(page, 'household-selected');
  checks.push('Resident layer changes rendered canvas; housing click opens actual household');
  const firms = data.buildings.filter((b) => b.companyId);
  const firmPoint = await unobscured(
    page,
    firms.map((b) => b.parcel),
  );
  const firm = firms.find((b) => b.parcel.x === firmPoint.x && b.parcel.y === firmPoint.y)!;
  pos = await worldPoint(page, firm.parcel);
  await page.mouse.click(pos.x, pos.y);
  await page.getByRole('heading', { name: '企業檔案', exact: true }).waitFor();
  assert.equal(await page.locator('.map-host').getAttribute('data-selected-id'), firm.companyId);
  await shot(page, 'company-selected');
  checks.push('Canvas company footprint opens actual business with selection outline');
  for (const label of ['住宅', '企業']) {
    await page.mouse.move(20, 20);
    const before = hash(await page.locator('canvas').screenshot());
    await page.getByRole('button', { name: label + '圖層', exact: true }).click();
    assert.notEqual(hash(await page.locator('canvas').screenshot()), before);
    await page.getByRole('button', { name: label + '圖層', exact: true }).click();
  }
  await page.getByRole('button', { name: '居民圖層', exact: true }).click();
  checks.push('Housing and company layer toggles alter actual canvas and restore');
  await app.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()[0].setContentSize(1280, 800),
  );
  await page.getByRole('button', { name: '關閉檔案', exact: true }).click();
  await checkGeometry(page);
  await shot(page, 'city-1280');
  checks.push('1280×800 native overview remains readable and contained');
  await newCity(page, 1000);
  await checkGeometry(page);
  await shot(page, 'city-1000-1280');
  const samples: number[] = [];
  for (let i = 0; i < 20; i++) {
    await page.getByRole('button', { name: '前進一天', exact: true }).click();
    samples.push(Number(await page.locator('.map-host').getAttribute('data-render-ms')));
  }
  timings.push({
    population: 1000,
    phase: 'daily data projection and graphics rebuild; terrain retained',
    renderMs: samples.reduce((a, b) => a + b, 0) / samples.length,
  });
  checks.push(
    '1000 residents render and advance 20 days without errors; per-update CPU timing recorded',
  );
  await page.getByRole('button', { name: 'Max', exact: true }).click();
  await page.waitForFunction(
    () =>
      Number(document.querySelector('.clock small')?.textContent?.match(/第\s*(\d+)/)?.[1]) >= 365,
  );
  await page.getByRole('button', { name: '暫停', exact: true }).click();
  await page.getByRole('button', { name: '解釋失業率', exact: true }).click();
  await page.getByRole('button', { name: '365 日', exact: true }).click();
  await page.getByRole('button', { name: 'Explain · 解釋這個數字', exact: true }).click();
  await page.getByRole('button', { name: 'Focus on Map · 受影響實體', exact: true }).click();
  assert.ok(Number(await page.locator('.map-host').getAttribute('data-affected-count')) > 0);
  const overlaySamples: number[] = [];
  const totalSamples: number[] = [];
  for (let i = 0; i < 20; i++) {
    await page.getByRole('button', { name: '前進一天', exact: true }).click();
    overlaySamples.push(Number(await page.locator('.map-host').getAttribute('data-overlay-ms')));
    totalSamples.push(Number(await page.locator('.map-host').getAttribute('data-render-ms')));
  }
  timings.push({
    population: 1000,
    phase: 'recorded affected overlay only, 20 updates',
    renderMs: overlaySamples.reduce((a, b) => a + b, 0) / overlaySamples.length,
  });
  timings.push({
    population: 1000,
    phase: 'base scene plus affected overlay, 20 updates',
    renderMs: totalSamples.reduce((a, b) => a + b, 0) / totalSamples.length,
  });
  await shot(page, 'affected-1000');
  checks.push(
    '1000-person recorded affected overlay has separately measured CPU cost and no console errors',
  );
  await app.close();
  assert.equal(child.exitCode, 0);
  checks.push('Packaged scene QA exits normally with code 0, no force kill');
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const mobile = await browser.newPage({ viewport: { width: 390, height: 844 } });
    watch(mobile);
    await mobile.goto('http://127.0.0.1:4173/');
    await newCity(mobile, 250);
    await checkGeometry(mobile);
    await shot(mobile, 'city-mobile');
    await mobile.getByRole('button', { name: '選取行政區 Riverside', exact: true }).click();
    await mobile.getByRole('heading', { name: '行政區檔案', exact: true }).waitFor();
    assert.equal(await mobile.locator('.map-host').getAttribute('data-selected-id'), 'district-3');
    checks.push(
      '390×844 production responsive scene: readable labels, no overflow, district selection works',
    );
  } finally {
    await browser.close();
  }
  assert.deepEqual(errors, []);
  const report = {
    passed: true,
    appVersion: version,
    runtime,
    checks,
    consoleErrors: errors,
    timings,
    screenshots: 'artifacts/qa/phase1-1/scene',
    testedAt: new Date().toISOString(),
    screenshotMethod:
      'Playwright Electron, native packaged renderer; Edge headless production responsive. Earlier interactive review used IAB; final packaged captures are inspected as local images.',
    geometry: {
      buildings: source.buildings.length,
      residents: data.residents.length,
      unlocated: data.unlocated,
    },
    limitations:
      'CPU timing includes presentation projection/graphics commands, excludes GPU rasterization; no traffic/at-work inference or physical scale.',
  };
  writeFileSync('artifacts/phase1-1-scene-qa.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} catch (error) {
  writeFileSync(
    'artifacts/phase1-1-scene-qa.json',
    JSON.stringify({ passed: false, checks, errors, error: String(error) }, null, 2),
  );
  throw error;
} finally {
  if (child.exitCode === null) {
    await app.close();
    assert.equal(child.exitCode, 0);
  }
}
