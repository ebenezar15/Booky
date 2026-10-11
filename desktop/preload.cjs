// The small, safe bridge between the Booky page and the desktop app.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('bookyDesktop', {
  platform: process.platform,
  printPdf: (html, fileName) => ipcRenderer.invoke('booky:print-pdf', { html, fileName }),
  showFile: (file) => ipcRenderer.invoke('booky:show-file', file),
  onOpenFile: (cb) => ipcRenderer.on('booky:open-file', (_e, f) => cb(f)),
  onMenu: (cb) => ipcRenderer.on('booky:menu', (_e, cmd) => cb(cmd)),
});
