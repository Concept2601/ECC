const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('woodquoteDesktop', {
  platform: process.platform,
  /** Write a file to a temp folder and open it with the default app. */
  openFile: (name, bytes) => ipcRenderer.invoke('woodquote:open-file', name, bytes),
  /** Write a save point to Documents\\WoodQuote\\Backups; resolves to the file path. */
  saveBackup: (name, json) => ipcRenderer.invoke('woodquote:save-backup', name, json),
  /** Show the app's commands and shortcut keys in the menu bar. */
  setMenu: (items) => ipcRenderer.send('woodquote:set-menu', items),
  /** CPU, memory and graphics card of this PC. */
  systemInfo: () => ipcRenderer.invoke('woodquote:system-info'),
  /** Called when a menu item is clicked. */
  onCommand: (fn) => {
    ipcRenderer.removeAllListeners('woodquote:command');
    ipcRenderer.on('woodquote:command', (_e, id) => fn(id));
  },
});
