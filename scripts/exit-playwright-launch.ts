import { _electron } from 'playwright';
import { writeFileSync } from 'node:fs';
import path from 'node:path';
const env = Object.fromEntries(
  Object.entries(process.env).filter(
    ([key, value]) =>
      value !== undefined && key !== 'ELECTRON_RUN_AS_NODE' && key !== 'CIVITAS_DEV_URL',
  ),
) as Record<string, string>;
const app = await _electron.launch({
  executablePath: path.resolve(process.argv[2]),
  args: process.argv[3] === 'stress' ? [] : [path.resolve('scripts/repro-electron-quit.cjs')],
  env,
});
const page = await app.firstWindow();
if (process.argv[3] === 'stress') {
  await page.locator('.map-host[data-scene-ready="true"]').waitFor({ timeout: 60000 });
  await page.getByRole('button', { name: '建立城市', exact: true }).click();
  await page.getByLabel('城市種子', { exact: true }).fill('CIVITAS-DESKTOP-QA');
  await page.getByLabel('初始人口', { exact: true }).selectOption('1000');
  await page.getByRole('button', { name: '開始觀察', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('.map-host')?.getAttribute('data-residents') === '1000');
  for (let i = 0; i < 20; i++) await page.getByRole('button', { name: '前進一天', exact: true }).click();
  await page.getByRole('button', { name: '斜視 45°', exact: true }).click();
} else {
  await page.getByText('Native quit probe').waitFor();
}
writeFileSync(
  path.join(path.dirname(process.env.CIVITAS_EXIT_LOG!), 'playwright-owner.json'),
  JSON.stringify({
    driverPid: process.pid,
    wrapperPid: app.process().pid,
    electron: await app.evaluate(() => ({ pid: process.pid, versions: process.versions })),
    stress: process.argv[3] === 'stress',
  }),
);
await new Promise<void>((resolve) => app.once('close', () => resolve()));
process.exit(0);
