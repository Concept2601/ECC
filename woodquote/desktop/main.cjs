// En-Quote desktop (Windows) shell: serves the built web app from the
// app:// scheme so storage, PDF export and the AI reader behave like the
// mobile app, and opens outside links in the normal browser.
const { app, BrowserWindow, dialog, ipcMain, Menu, net, protocol, shell } = require('electron');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const ROOT = path.join(__dirname, 'app');
const START = 'app://woodquote/index.html';

// Use the machine properly: the main graphics card, GPU drawing and plenty of memory
const ramMb = Math.round(os.totalmem() / 1048576);
// Chromium caps one page's JavaScript memory at 4 GB, so ask for up to that
const heapMb = Math.max(2048, Math.min(4096, Math.round(ramMb / 2)));
app.commandLine.appendSwitch('ignore-gpu-blocklist');
app.commandLine.appendSwitch('enable-gpu-rasterization');
app.commandLine.appendSwitch('enable-zero-copy');
app.commandLine.appendSwitch('force_high_performance_gpu');
app.commandLine.appendSwitch('js-flags', `--max-old-space-size=${heapMb}`);

protocol.registerSchemesAsPrivileged([{ scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true } }]);

// Renamed to En-Quote: keep using the WoodQuote data folder so quotations, prices and the licence carry over
const legacyData = path.join(app.getPath('appData'), 'WoodQuote by 2601');
app.setPath('userData', fs.existsSync(legacyData) ? legacyData : path.join(app.getPath('appData'), 'En-Quote'));

if (!app.requestSingleInstanceLock()) app.quit();

let win = null;

function createWindow() {
  win = new BrowserWindow({
    width: 1360,
    height: 880,
    minWidth: 380,
    minHeight: 600,
    show: false,
    autoHideMenuBar: false,
    title: 'En-Quote',
    backgroundColor: '#f5f5f4',
    icon: path.join(__dirname, 'app', 'icon-512.png'),
    webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, sandbox: true, backgroundThrottling: false },
  });
  // never leave the user stuck on a frozen window
  win.on('unresponsive', async () => {
    const { response } = await dialog.showMessageBox(win, { type: 'warning', title: 'En-Quote is busy', message: 'En-Quote is not responding.', detail: 'Your work is saved as you go. Reload to carry on, or wait a little longer.', buttons: ['Reload', 'Wait'], defaultId: 0, cancelId: 1 });
    if (response === 0) win.webContents.reloadIgnoringCache();
  });
  win.webContents.on('render-process-gone', (_e, d) => {
    if (d.reason !== 'clean-exit') win.webContents.reload();
  });
  win.once('ready-to-show', () => {
    win.maximize();
    win.show();
  });
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('mailto:') || url.startsWith('tel:')) {
      shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'allow', overrideBrowserWindowOptions: { autoHideMenuBar: true } };
  });
  win.webContents.on('will-navigate', (e, url) => {
    if (!url.startsWith('app://')) {
      e.preventDefault();
      shell.openExternal(url);
    }
  });
  // PDFs and backups: ask where to save, starting in Documents\En-Quote
  win.webContents.session.on('will-download', (_e, item) => {
    const dir = path.join(app.getPath('documents'), 'En-Quote');
    fs.mkdirSync(dir, { recursive: true });
    item.setSaveDialogOptions({ defaultPath: path.join(dir, item.getFilename()) });
  });
  win.loadURL(START);
}

/* ---------------------------------------------------------------- menu */

// The page sends its commands and current shortcut keys; menu clicks are sent
// back as commands. Keys themselves are handled by the page (so custom keys
// and text boxes behave), the menu only shows them.
let menuItems = [];
function send(id) {
  if (win) win.webContents.send('woodquote:command', id);
}
function buildMenu() {
  const item = (id) => {
    const a = menuItems.find((m) => m.id === id);
    if (!a) return null;
    return { label: a.label, accelerator: a.accelerator, registerAccelerator: false, click: () => send(id) };
  };
  const list = (...ids) => ids.map((id) => (id === '-' ? { type: 'separator' } : item(id))).filter(Boolean);
  const template = [
    { label: '&File', submenu: [...list('newQuote', 'newInvoice', 'spaceFit', '-', 'save', 'pdf', '-'), { role: 'quit', label: 'Exit' }] },
    {
      label: '&Edit',
      submenu: [...list('undo', 'redo', '-'), { role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { role: 'selectAll' }, ...list('-', 'duplicate', 'delete', 'insert')],
    },
    {
      label: '&View',
      submenu: [...list('refresh', '-', 'goHome', 'goQuotes', 'goInvoices', 'goPrices', 'goSettings', 'goReader', '-', 'back', '-'), { role: 'zoomIn' }, { role: 'zoomOut' }, { role: 'resetZoom' }, { role: 'togglefullscreen' }, { type: 'separator' }, { role: 'toggleDevTools' }],
    },
    { label: '&Design', submenu: list('addUnit', 'addKitchen', 'room', '-', 'prev', 'next', 'moveLeft', 'moveRight', 'edit') },
    { label: '&Help', submenu: [...list('help'), { label: 'About En-Quote', click: () => dialog.showMessageBox(win, { type: 'info', title: 'En-Quote', message: `En-Quote\nJoinery · Ceilings · Tiling\nVersion ${app.getVersion()}` }) }] },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

app.on('second-instance', () => {
  if (!win) return;
  if (win.isMinimized()) win.restore();
  win.focus();
});

app.whenReady().then(() => {
  protocol.handle('app', (req) => {
    const { pathname } = new URL(req.url);
    const file = path.normalize(path.join(ROOT, decodeURIComponent(pathname)));
    if (!file.startsWith(ROOT)) return new Response('Not found', { status: 404 });
    return net.fetch(pathToFileURL(fs.existsSync(file) && fs.statSync(file).isFile() ? file : path.join(ROOT, 'index.html')).toString());
  });

  // "Share" on the desktop: open the PDF in the default viewer (print / email from there)
  ipcMain.handle('woodquote:open-file', async (_e, name, bytes) => {
    const safe = String(name).replace(/[^\w.-]+/g, '_');
    const dir = path.join(os.tmpdir(), 'En-Quote');
    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, safe);
    fs.writeFileSync(file, Buffer.from(bytes));
    const err = await shell.openPath(file);
    return err || file;
  });

  ipcMain.on('woodquote:set-menu', (_e, items) => {
    menuItems = Array.isArray(items) ? items : [];
    buildMenu();
  });

  // Save points also written as files: Documents\En-Quote\Backups (newest 30 kept)
  ipcMain.handle('woodquote:save-backup', async (_e, name, json) => {
    const dir = path.join(app.getPath('documents'), 'En-Quote', 'Backups');
    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, String(name).replace(/[^\w.-]+/g, '_'));
    fs.writeFileSync(file, String(json));
    const old = fs.readdirSync(dir).filter((f) => (f.startsWith('En-Quote-') || f.startsWith('WoodQuote-')) && f.endsWith('.json')).sort().reverse().slice(30);
    for (const f of old) fs.rmSync(path.join(dir, f), { force: true });
    return file;
  });

  ipcMain.handle('woodquote:system-info', async () => {
    const cpus = os.cpus();
    let gpu = null;
    try {
      const info = await app.getGPUInfo('basic');
      gpu = (info.gpuDevice || []).map((g) => g.deviceString || `${g.vendorId}:${g.deviceId}`).filter(Boolean);
    } catch {
      gpu = null;
    }
    return { os: `${os.type()} ${os.release()} (${os.arch()})`, cpu: cpus[0]?.model ?? 'unknown', cores: cpus.length, ramMb, heapMb, gpu, gpuStatus: app.getGPUFeatureStatus(), electron: process.versions.electron, chrome: process.versions.chrome };
  });

  buildMenu();
  createWindow();
  app.on('activate', () => BrowserWindow.getAllWindows().length === 0 && createWindow());
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
