// Isolated Windows shutdown probe. No CIVITAS code, Pixi, IPC or simulation.
/* eslint-disable @typescript-eslint/no-require-imports -- Electron CommonJS entrypoint */
const { app, BrowserWindow } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const logPath = process.env.CIVITAS_EXIT_LOG || path.resolve('artifacts/qa/repro-quit.jsonl');
fs.mkdirSync(path.dirname(logPath), { recursive: true });
function resources() {
  return {
    resources: process.getActiveResourcesInfo(),
    handles: process._getActiveHandles().map((handle) => ({
      type: handle.constructor?.name,
      fd: handle.fd,
      hasRef: typeof handle.hasRef === 'function' ? handle.hasRef() : undefined,
    })),
    requests: process._getActiveRequests().map((request) => request.constructor?.name),
  };
}
const log = (event, details = {}) =>
  fs.appendFileSync(
    logPath,
    JSON.stringify({ timestamp: new Date().toISOString(), pid: process.pid, event, ...details }) +
      '\n',
  );
log('startup', {
  versions: process.versions,
  execPath: process.execPath,
  argv: process.argv,
  isPackaged: app.isPackaged,
  gpuDisabled: process.env.CIVITAS_EXIT_GPU_OFF === '1',
  exitMode: process.env.CIVITAS_EXIT_MODE || 'quit',
});
if (process.env.CIVITAS_EXIT_GPU_OFF === '1') app.disableHardwareAcceleration();
for (const event of ['before-quit', 'will-quit', 'quit']) {
  app.on(event, () => log(event, resources()));
}
process.on('beforeExit', (code) => log('node-beforeExit', { code, ...resources() }));
process.on('exit', (code) => log('node-exit', { code, ...resources() }));
app.whenReady().then(() => {
  const window = new BrowserWindow({ title: 'Project CIVITAS' });
  window.on('close', () => {
    log('close', resources());
    // Diagnostic timers must never keep the process alive.
    for (const delay of [100, 1000, 5000, 9000, 59000]) {
      setTimeout(() => log(`post-close-${delay}ms`, resources()), delay).unref();
    }
  });
  window.on('closed', () => log('closed', resources()));
  window.webContents.on('did-finish-load', () => log('loaded', resources()));
  window.loadURL('data:text/html,<title>Project CIVITAS</title><p>Native quit probe</p>');
});
app.on('window-all-closed', () => {
  log('window-all-closed', resources());
  if (process.env.CIVITAS_EXIT_MODE === 'exit') app.exit(0);
  else app.quit();
  log('after-quit-call', resources());
});
