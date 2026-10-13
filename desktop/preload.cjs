// The small, safe bridge between the Booky page and the desktop app.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('bookyDesktop', {
  platform: process.platform,
  printPdf: (html, fileName) => ipcRenderer.invoke('booky:print-pdf', { html, fileName }),
  savePdf: (bytes, fileName) => ipcRenderer.invoke('booky:print-pdf', { bytes, fileName }),
  renderPdf: (html) => ipcRenderer.invoke('booky:render-pdf', { html }),
  showFile: (file) => ipcRenderer.invoke('booky:show-file', file),
  onOpenFile: (cb) => ipcRenderer.on('booky:open-file', (_e, f) => cb(f)),
  onMenu: (cb) => ipcRenderer.on('booky:menu', (_e, cmd) => cb(cmd)),
  chooseBackupFolder: () => ipcRenderer.invoke('booky:backup-choose'),
  checkBackupFolder: (dir) => ipcRenderer.invoke('booky:backup-check', dir),
  writeBackup: (opts) => ipcRenderer.invoke('booky:backup-write', opts),
  onBeforeClose: (cb) => ipcRenderer.on('booky:before-close', () => cb()),
  readyToClose: () => ipcRenderer.send('booky:ready-to-close'),
});
