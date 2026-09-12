const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('qaromiErp', {
  openInBrowser: (url) => ipcRenderer.invoke('open-in-browser', url),
  platform: process.platform,
  version: '1.0.0'
});
