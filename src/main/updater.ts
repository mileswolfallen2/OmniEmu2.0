import { autoUpdater } from 'electron-updater';
import { BrowserWindow } from 'electron';
import { platform } from 'os';

autoUpdater.autoDownload = false;
autoUpdater.autoInstallOnAppQuit = false;

export function setupAutoUpdater() {
  autoUpdater.on('checking-for-update', () => {
    sendToWindows('updates:status', { status: 'checking' });
  });

  autoUpdater.on('update-available', (info) => {
    sendToWindows('updates:status', {
      status: 'available',
      version: info.version,
      releaseDate: info.releaseDate,
      releaseNotes: info.releaseNotes,
    });
  });

  autoUpdater.on('update-not-available', (info) => {
    sendToWindows('updates:status', {
      status: 'not-available',
      version: info.version,
    });
  });

  autoUpdater.on('error', (err) => {
    const isSigningError = platform() === 'darwin' &&
      /code signature|not signed|code object/i.test(err.message);
    sendToWindows('updates:status', {
      status: 'error',
      message: isSigningError
        ? 'macOS requires a one-time manual download for this update. After that, future updates will install automatically.'
        : err.message,
      manualLink: isSigningError
        ? 'https://github.com/mileswolfallen2/OmniEmu2.0/releases/latest'
        : undefined,
    });
  });

  autoUpdater.on('download-progress', (progress) => {
    sendToWindows('updates:download-progress', {
      percent: Math.round(progress.percent),
      bytesPerSecond: progress.bytesPerSecond,
      transferred: progress.transferred,
      total: progress.total,
    });
  });

  autoUpdater.on('update-downloaded', (info) => {
    sendToWindows('updates:status', {
      status: 'downloaded',
      version: info.version,
    });
  });
}

function sendToWindows(channel: string, data: unknown) {
  BrowserWindow.getAllWindows().forEach((w) => w.webContents.send(channel, data));
}

export function checkForUpdates() {
  return autoUpdater.checkForUpdates();
}

export function downloadUpdate() {
  return autoUpdater.downloadUpdate();
}

export function quitAndInstall() {
  autoUpdater.quitAndInstall();
}

export { autoUpdater };
