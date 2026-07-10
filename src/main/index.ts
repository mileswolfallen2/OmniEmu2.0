import { app, BrowserWindow, Tray, Menu, nativeImage } from 'electron';
import { join } from 'path';
import { existsSync } from 'fs';
import { registerIpcHandlers } from './ipc';
import { settings } from './settings';
import { isMacOS } from './platform';
import { ensureRomsStructure } from './emulators';
import { setupAutoUpdater } from './updater';

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;

const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL;

function createAppIcon() {
  const iconPaths = [
    join(__dirname, '../../assets/icon.png'),
    join(__dirname, '../renderer/assets/icon.png'),
    join(__dirname, '../../build/icon.png'),
  ];
  for (const p of iconPaths) {
    try {
      if (existsSync(p)) return nativeImage.createFromPath(p);
    } catch { /* skip */ }
  }
  // Fallback: 16x16 purple pixel
  const size = 16;
  const buf = Buffer.alloc(size * size * 4 + 8);
  buf.writeUInt32LE(size, 0);
  buf.writeUInt32LE(size, 4);
  for (let i = 8; i < buf.length; i += 4) {
    buf[i] = 108; buf[i + 1] = 99; buf[i + 2] = 255; buf[i + 3] = 255;
  }
  return nativeImage.createFromBuffer(buf, { width: size, height: size });
}

function createWindow(): void {
  const icon = createAppIcon();

  if (isMacOS()) {
    app.dock?.setIcon(icon);
  }

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: 'OmniEmu',
    backgroundColor: '#1a1a2e',
    show: false,
    icon,
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  if (VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(VITE_DEV_SERVER_URL);
    if (process.env.OMNIEMU_DEVTOOLS) {
      mainWindow.webContents.openDevTools();
    }
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  mainWindow.on('close', (event) => {
    const s = settings.get();
    if (s.closeToTray && tray) {
      event.preventDefault();
      mainWindow?.hide();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function createTray(): void {
  const icon = createAppIcon();
  const trayIcon = icon.resize({ width: 22, height: 22 });
  if (isMacOS()) trayIcon.setTemplateImage(true);

  tray = new Tray(trayIcon);
  tray.setToolTip('OmniEmu');

  const contextMenu = Menu.buildFromTemplate([
    { label: 'Show OmniEmu', click: () => mainWindow?.show() },
    { type: 'separator' },
    { label: 'Quit', click: () => { tray = null; app.quit(); } },
  ]);

  tray.setContextMenu(contextMenu);
  tray.on('click', () => mainWindow?.show());
}

// Prevent multiple instances
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

app.whenReady().then(() => {
  ensureRomsStructure();
  setupAutoUpdater();
  registerIpcHandlers();
  createWindow();
  createTray();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
    else mainWindow?.show();
  });
});

app.on('window-all-closed', () => {
  if (tray) {
    // Keep app alive in tray
    return;
  }
  if (!isMacOS()) app.quit();
});

app.on('before-quit', () => {
  tray = null;
});
