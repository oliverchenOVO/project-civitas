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
  args: [path.resolve('scripts/repro-electron-quit.cjs')],
  env,
});
const page = await app.firstWindow();
await page.getByText('Native quit probe').waitFor();
writeFileSync(
  path.join(path.dirname(process.env.CIVITAS_EXIT_LOG!), 'playwright-owner.json'),
  JSON.stringify({ driverPid: process.pid, mainPid: app.process().pid }),
);
await new Promise<void>((resolve) => app.once('close', () => resolve()));
process.exit(0);
