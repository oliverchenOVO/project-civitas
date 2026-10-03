// Isolated Windows shutdown probe. No CIVITAS code, Pixi, IPC or simulation.
/* eslint-disable @typescript-eslint/no-require-imports -- Electron CommonJS entrypoint */
const { app, BrowserWindow } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const directory = path.resolve('artifacts/qa');
fs.mkdirSync(directory, { recursive: true });
const log = (event) =>
  fs.appendFileSync(path.join(directory, 'repro-quit.log'), `${new Date().toISOString()} ${event}\n`);
app.whenReady().then(() => {
  const window = new BrowserWindow({ title: 'Project CIVITAS' });
  window.on('close', () => log('close'));
  window.on('closed', () => log('closed'));
  window.loadURL('data:text/html,<title>Project CIVITAS</title><p>Native quit probe</p>');
});
app.on('window-all-closed', () => {
  log('window-all-closed');
  app.exit(0);
});
app.on('will-quit', () => log('will-quit'));
