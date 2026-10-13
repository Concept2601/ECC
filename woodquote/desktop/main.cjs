// WoodQuote desktop (Windows) shell: serves the built web app from the
// app:// scheme so storage, PDF export and the AI reader behave like the
// mobile app, and opens outside links in the normal browser.
const { app, BrowserWindow, ipcMain, net, protocol, shell } = require('electron');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const ROOT = path.join(__dirname, 'app');
const START = 'app://woodquote/index.html';

protocol.registerSchemesAsPrivileged([{ scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true } }]);

if (!app.requestSingleInstanceLock()) app.quit();

let win = null;

function createWindow() {
  win = new BrowserWindow({
    width: 1360,
    height: 880,
    minWidth: 380,
    minHeight: 600,
    show: false,
    autoHideMenuBar: true,
    title: 'WoodQuote by 2601',
    backgroundColor: '#f5f5f4',
    icon: path.join(__dirname, 'app', 'icon-512.png'),
    webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, sandbox: true },
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
  // PDFs and backups: ask where to save, starting in Documents\WoodQuote
  win.webContents.session.on('will-download', (_e, item) => {
    const dir = path.join(app.getPath('documents'), 'WoodQuote');
    fs.mkdirSync(dir, { recursive: true });
    item.setSaveDialogOptions({ defaultPath: path.join(dir, item.getFilename()) });
  });
  win.loadURL(START);
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
    const dir = path.join(os.tmpdir(), 'WoodQuote');
    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, safe);
    fs.writeFileSync(file, Buffer.from(bytes));
    const err = await shell.openPath(file);
    return err || file;
  });

  createWindow();
  app.on('activate', () => BrowserWindow.getAllWindows().length === 0 && createWindow());
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
