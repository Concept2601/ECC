const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('woodquoteDesktop', {
  platform: process.platform,
  /** Write a file to a temp folder and open it with the default app. */
  openFile: (name, bytes) => ipcRenderer.invoke('woodquote:open-file', name, bytes),
});
