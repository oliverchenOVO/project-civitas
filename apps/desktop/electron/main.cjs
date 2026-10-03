const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('node:path');
const fs = require('node:fs/promises');
let window;
function trusted(event) {
  if (!window || event.sender !== window.webContents) throw new Error('Unauthorized IPC sender');
}
app.whenReady().then(() => {
  window = new BrowserWindow({
    width: 1536,
    height: 1024,
    minWidth: 960,
    minHeight: 700,
    backgroundColor: '#101b25',
    title: 'Project CIVITAS',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  window.setMenu(null);
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', (event) => event.preventDefault());
  if (process.env.CIVITAS_DEV_URL) window.loadURL(process.env.CIVITAS_DEV_URL);
  else window.loadFile(path.join(__dirname, '../../../dist/index.html'));
  ipcMain.handle('city:save', async (event, text) => {
    trusted(event);
    if (typeof text !== 'string' || text.length > 100000000) throw new Error('Invalid save');
    JSON.parse(text);
    const result = await dialog.showSaveDialog(window, {
      title: '儲存 CIVITAS 城市',
      defaultPath: 'city.civitas',
      filters: [{ name: 'CIVITAS city', extensions: ['civitas'] }],
    });
    if (result.canceled || !result.filePath) return false;
    const temporary = result.filePath + '.tmp';
    await fs.writeFile(temporary, text, 'utf8');
    await fs.rename(temporary, result.filePath);
    return true;
  });
  ipcMain.handle('city:load', async (event) => {
    trusted(event);
    const result = await dialog.showOpenDialog(window, {
      title: '載入 CIVITAS 城市',
      properties: ['openFile'],
      filters: [{ name: 'CIVITAS city', extensions: ['civitas'] }],
    });
    if (result.canceled || !result.filePaths[0]) return null;
    const stat = await fs.stat(result.filePaths[0]);
    if (stat.size > 100000000) throw new Error('Save exceeds 100 MB');
    return fs.readFile(result.filePaths[0], 'utf8');
  });
});
app.on('window-all-closed', () => app.quit());
