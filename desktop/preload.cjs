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
  ttsVoices: () => ipcRenderer.invoke('booky:tts-voices'),
  ttsSpeak: (text, voice, rate) => ipcRenderer.invoke('booky:tts-speak', { text, voice, rate }),
  ttsStop: () => ipcRenderer.invoke('booky:tts-stop'),
  ttsPause: (pause) => ipcRenderer.invoke('booky:tts-pause', pause),
  dictate: () => ipcRenderer.invoke('booky:dictate'),
  micAccess: () => ipcRenderer.invoke('booky:mic-access'),
  readyToClose: () => ipcRenderer.send('booky:ready-to-close'),
});
