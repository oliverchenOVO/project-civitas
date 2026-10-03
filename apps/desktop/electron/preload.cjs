const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('civitas', {
  save: (text) => ipcRenderer.invoke('city:save', text),
  load: () => ipcRenderer.invoke('city:load'),
});
