// Booky desktop app (Windows & macOS). Wraps the same single-file app the browser uses,
// so books, layouts and exports are identical on both systems (Electron ships the same
// Chromium engine everywhere). Adds: native menus, vector PDF export, .booky file opening,
// microphone access for voice typing, and links that open in the default browser / mail app.
const { app, BrowserWindow, Menu, shell, dialog, ipcMain, session, nativeTheme } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');

const isMac = process.platform === 'darwin';
const APP_HTML = path.join(__dirname, '..', 'dist', 'index.html');
const stateFile = () => path.join(app.getPath('userData'), 'window-state.json');
let win = null;
let closeReady = false;
const pendingFiles = [];

app.setName('Booky');
if (!app.requestSingleInstanceLock()) app.quit();

function loadState() {
  try { return JSON.parse(fs.readFileSync(stateFile(), 'utf8')); } catch { return { width: 1440, height: 920 }; }
}
function saveState() {
  if (!win || win.isDestroyed()) return;
  const b = win.getNormalBounds();
  try { fs.writeFileSync(stateFile(), JSON.stringify({ ...b, maximized: win.isMaximized() })); } catch { /* ignore */ }
}

function createWindow() {
  const st = loadState();
  win = new BrowserWindow({
    x: st.x, y: st.y, width: st.width || 1440, height: st.height || 920, minWidth: 900, minHeight: 600,
    title: 'Booky', show: false,
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#12052a' : '#12052a', // matches the splash screen
    icon: path.join(__dirname, '..', 'build', isMac ? 'icon.png' : 'icon.ico'),
    titleBarStyle: isMac ? 'hiddenInset' : 'default',
    trafficLightPosition: { x: 14, y: 18 },
    webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, sandbox: true, spellcheck: true },
  });
  if (st.maximized) win.maximize();
  win.once('ready-to-show', () => win.show());
  win.on('close', saveState);
  // Give the page a moment to save and write a folder backup before the window closes.
  win.on('close', (e) => {
    if (closeReady || !win.webContents || win.webContents.isDestroyed()) return;
    e.preventDefault();
    win.webContents.send('booky:before-close');
    setTimeout(() => { closeReady = true; win?.close(); }, 4000);
  });
  win.loadFile(APP_HTML);

  // Links: web pages and email open outside the app; the app itself never navigates away.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^(https?:|mailto:)/i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (e, url) => {
    if (url.startsWith('file:') && url.split('#')[0] === win.webContents.getURL().split('#')[0]) return;
    e.preventDefault();
    if (/^(https?:|mailto:)/i.test(url)) shell.openExternal(url);
  });
  win.webContents.on('did-finish-load', () => flushFiles());
}

// ---------- opening .booky / .bookyreview files ----------
function queueFile(file) {
  if (!file || !/\.(booky|bookyreview)$/i.test(file)) return;
  pendingFiles.push(file);
  flushFiles();
}
function flushFiles() {
  if (!win || win.webContents.isLoading()) return;
  while (pendingFiles.length) {
    const file = pendingFiles.shift();
    try { win.webContents.send('booky:open-file', { name: path.basename(file), text: fs.readFileSync(file, 'utf8') }); } catch { /* unreadable */ }
  }
  if (win.isMinimized()) win.restore();
  win.focus();
}
app.on('open-file', (e, file) => { e.preventDefault(); queueFile(file); }); // macOS
app.on('second-instance', (e, argv) => { argv.slice(1).forEach(queueFile); if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });
process.argv.slice(1).forEach(queueFile); // Windows: file passed on the command line

// ---------- vector PDF: typeset in a hidden window and print it to PDF ----------
async function renderPdf(html) {
  const tmp = path.join(os.tmpdir(), `booky-print-${Date.now()}-${Math.random().toString(36).slice(2, 7)}.html`);
  fs.writeFileSync(tmp, html);
  const pw = new BrowserWindow({ show: false, width: 1200, height: 900, webPreferences: { sandbox: true, contextIsolation: true } });
  try {
    await pw.loadFile(tmp);
    const started = Date.now();
    // Paged.js marks every page with its folio when typesetting has finished.
    for (;;) {
      const done = await pw.webContents.executeJavaScript("(function(){var p=document.querySelectorAll('.pagedjs_page');return p.length>0&&Array.prototype.every.call(p,function(x){return x.hasAttribute('data-folio')})})()");
      if (done) break;
      if (Date.now() - started > 10 * 60 * 1000) throw new Error('Typesetting took too long.');
      await new Promise((r) => setTimeout(r, 300));
    }
    await pw.webContents.executeJavaScript('document.fonts ? document.fonts.ready.then(function(){return true}) : true');
    await new Promise((r) => setTimeout(r, 300)); // let images settle
    return await pw.webContents.printToPDF({ preferCSSPageSize: true, printBackground: true, margins: { top: 0, bottom: 0, left: 0, right: 0 }, generateDocumentOutline: true, generateTaggedPDF: true });
  } finally {
    pw.destroy();
    fs.rm(tmp, () => {});
  }
}

// Returns the PDF bytes to the page (used for print packages, which post-process and zip them).
ipcMain.handle('booky:render-pdf', async (_e, { html }) => renderPdf(html));

// Renders and asks where to save (“Save vector PDF…”). The page may pass already-finished bytes.
ipcMain.handle('booky:print-pdf', async (_e, { html, bytes, fileName }) => {
  const pdf = bytes ? Buffer.from(bytes) : await renderPdf(html);
  const { canceled, filePath } = await dialog.showSaveDialog(win, {
    title: 'Save PDF', defaultPath: path.join(app.getPath('documents'), fileName || 'book.pdf'), filters: [{ name: 'PDF', extensions: ['pdf'] }],
  });
  if (canceled || !filePath) return { canceled: true };
  fs.writeFileSync(filePath, pdf);
  return { filePath, bytes: pdf.length };
});
ipcMain.handle('booky:show-file', (_e, file) => { if (file) shell.showItemInFolder(file); });
ipcMain.on('booky:ready-to-close', () => { closeReady = true; win?.close(); });

// ---------- folder backups ----------
ipcMain.handle('booky:backup-choose', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog(win, { title: 'Choose a folder for Booky backups', properties: ['openDirectory', 'createDirectory'], defaultPath: app.getPath('documents') });
  return canceled || !filePaths[0] ? null : filePaths[0];
});
ipcMain.handle('booky:backup-check', (_e, dir) => {
  try { fs.accessSync(dir, fs.constants.W_OK); return true; } catch { return false; }
});
// Writes one backup and keeps only the newest `keep` for that book (same rule as src/core/backup.js).
ipcMain.handle('booky:backup-write', (_e, { dir, name, data, prefix, keep }) => {
  if (!dir || path.basename(name) !== name || /[\\/:*?"<>|]/.test(name) || !name.endsWith('.booky') || !prefix || !name.startsWith(prefix)) throw new Error('Bad backup name');
  const file = path.join(dir, name);
  fs.writeFileSync(file, data, 'utf8');
  const mine = fs.readdirSync(dir).filter((n) => n.startsWith(prefix) && /\d{4}-\d\d-\d\d_\d{4}(-\d+)?\.booky$/.test(n)).sort();
  for (const old of mine.slice(0, Math.max(0, mine.length - (keep || 10)))) { try { fs.unlinkSync(path.join(dir, old)); } catch { /* in use */ } }
  return { file };
});

// ---------- menus ----------
function buildMenu() {
  const send = (cmd) => () => win?.webContents.send('booky:menu', cmd);
  const template = [
    ...(isMac ? [{ role: 'appMenu' }] : []),
    {
      label: 'File',
      submenu: [
        { label: 'Library', accelerator: 'CmdOrCtrl+Shift+L', click: send('library') },
        { label: 'Open Backup…', accelerator: 'CmdOrCtrl+O', click: async () => {
          const { canceled, filePaths } = await dialog.showOpenDialog(win, { properties: ['openFile', 'multiSelections'], filters: [{ name: 'Booky files', extensions: ['booky', 'bookyreview'] }] });
          if (!canceled) filePaths.forEach(queueFile);
        } },
        { type: 'separator' },
        { label: 'Settings…', accelerator: 'CmdOrCtrl+,', click: send('settings') },
        { type: 'separator' },
        isMac ? { role: 'close' } : { role: 'quit' },
      ],
    },
    { role: 'editMenu' },
    {
      label: 'View',
      submenu: [
        { role: 'reload' }, { role: 'toggleDevTools' }, { type: 'separator' },
        { role: 'resetZoom' }, { role: 'zoomIn' }, { role: 'zoomOut' }, { type: 'separator' }, { role: 'togglefullscreen' },
      ],
    },
    { role: 'windowMenu' },
    {
      role: 'help',
      submenu: [
        { label: 'Keyboard Shortcuts', click: send('shortcuts') },
        { label: 'Booky on GitHub', click: () => shell.openExternal('https://github.com/ebenezar15/Booky') },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

app.whenReady().then(() => {
  // Voice typing needs the microphone; nothing else is requested.
  session.defaultSession.setPermissionRequestHandler((_wc, permission, cb) => cb(['media', 'clipboard-sanitized-write', 'clipboard-read'].includes(permission)));
  session.defaultSession.setPermissionCheckHandler((_wc, permission) => ['media', 'clipboard-sanitized-write', 'clipboard-read'].includes(permission));
  buildMenu();
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on('window-all-closed', () => { if (!isMac) app.quit(); });
