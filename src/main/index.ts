import { app, BrowserWindow, Tray, Menu, nativeImage } from 'electron';
import { join } from 'path';
import { existsSync } from 'fs';
import { registerIpcHandlers } from './ipc';
import { settings } from './settings';
import { isMacOS, isLinux } from './platform';
import { ensureRomsStructure } from './emulators';
import { setupAutoUpdater } from './updater';
import { generatePegasusCollectionsForRomDir } from './configurator';
import { startSyncthing } from './syncthing';

// ---------------------------------------------------------------------------
// Steam Deck / SteamOS (Gamescope) compatibility
// ---------------------------------------------------------------------------
// When launched in Gaming Mode the app runs inside Gamescope, a Wayland
// compositor that does NOT expose the kernel features Chromium's sandbox
// relies on.  Without the flags below the renderer process segfaults
// immediately on launch.  Desktop Mode works fine because Gamescope is not
// involved.
// ---------------------------------------------------------------------------

function isSteamDeck(): boolean {
  if (!isLinux()) return false;
  const steamos =
    existsSync('/usr/bin/steamos-session-select') ||
    existsSync('/etc/os-release') &&
      (() => {
        try {
          const os = require('fs').readFileSync('/etc/os-release', 'utf-8');
          return os.includes('SteamOS');
        } catch { return false; }
      })();
  return steamos;
}

function applySteamDeckFlags(): void {
  if (!isLinux()) return;

  if (isSteamDeck()) {
    // Chromium sandbox — Gamescope does not support the required kernel
    // namespacing so the sandbox must be disabled or it segfaults.
    app.commandLine.appendSwitch('no-sandbox');

    // GPU sandbox — Gamescope already composites; letting Chromium create a
    // second GPU sandbox causes a driver conflict.
    app.commandLine.appendSwitch('disable-gpu-sandbox');

    // ForceANGLE + SwiftShader — fallback to software GL when the native
    // Mesa driver misbehaves inside Gamescope.  On a real Steam Deck the
    // ANGLE OpenGL-ES path still hits the AMD driver for performance, but
    // this prevents the "lost device" crash on session transitions.
    app.commandLine.appendSwitch('use-gl', 'angle');
    app.commandLine.appendSwitch('use-angle', 'swiftshader');
    app.commandLine.appendSwitch('enable-features', 'VaapiVideoDecoder');
  }

  // Disable the GPU blacklisting — Steam Deck's custom Mesa driver is
  // frequently mis-identified as "too old" by Chromium's blocklist.
  app.commandLine.appendSwitch('ignore-gpu-blocklist');

  // Disable GPU compositing to let Gamescope handle all compositing.
  app.commandLine.appendSwitch('disable-gpu-compositing');

  // /dev/shm on SteamOS is too small for Chromium's shared memory
  // segments — use /tmp instead.
  app.commandLine.appendSwitch('disable-dev-shm-usage');
}

applySteamDeckFlags();

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

// Prevent multiple instances — if a stale lock file from a previous
// session (e.g. Desktop Mode) is lingering, force-remove it so Gaming
// Mode can start cleanly.
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

  // On SteamOS, /tmp is a small tmpfs that fills up fast with Chromium
  // caches.  Point the disk cache at the user data directory instead so
  // it persists across sessions and has more room.
  if (isLinux()) {
    const cacheDir = join(app.getPath('userData'), 'cache');
    if (!existsSync(cacheDir)) {
      try { require('fs').mkdirSync(cacheDir, { recursive: true }); } catch { /* ignore */ }
    }
    app.commandLine.appendSwitch('disk-cache-dir', cacheDir);
  }

  app.whenReady().then(() => {
    ensureRomsStructure();
    setupAutoUpdater();
    registerIpcHandlers();

    try {
      createWindow();
    } catch (err) {
      // If the window creation fails (common on Steam Deck Gaming Mode
      // when hardware acceleration misbehaves), retry with GPU disabled.
      console.error('Window creation failed, retrying without GPU:', err);
      app.commandLine.appendSwitch('disable-gpu');
      app.commandLine.appendSwitch('disable-software-rasterizer');
      try { createWindow(); } catch { /* fatal */ }
    }

    createTray();

    // Auto-generate Pegasus collection files if Pegasus is configured
    try {
      const s = settings.get();
      if (s.frontendSupport && s.romsDirectory) {
        generatePegasusCollectionsForRomDir(s.romsDirectory);
      }
    } catch { /* ignore */ }

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
      else mainWindow?.show();
    });
  });
}

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
