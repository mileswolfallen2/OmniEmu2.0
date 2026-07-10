import { autoUpdater } from 'electron-updater';
import { BrowserWindow } from 'electron';

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
    sendToWindows('updates:status', { status: 'error', message: err.message });
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
