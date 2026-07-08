import { ipcMain, shell, dialog, BrowserWindow } from 'electron';
import {
  getAllEmulatorStates,
  checkEmulator,
  launchGame,
  scanRoms,
  knownEmulators,
  findEmulator,
  getRomsDirectory,
  getEmulatorsDirectory,
} from './emulators';
import { installEmulator } from './installer';
import { applyRecommendedConfig, getPresets, checkConfigured } from './configurator';
import { settings } from './settings';
import { getSystemInfo, platformName, getPlatform, getArch } from './platform';
import { InstallProgress, AppSettings } from '../shared/types';

export function registerIpcHandlers(): void {
  // System
  ipcMain.handle('system:info', () => getSystemInfo());
  ipcMain.handle('system:platform-name', () => platformName());

  // Emulators
  ipcMain.handle('emulators:list', () => knownEmulators);
  ipcMain.handle('emulators:states', () => getAllEmulatorStates());
  ipcMain.handle('emulators:check', (_event, id: string) => checkEmulator(id));

  // Install emulator - direct download + install
  ipcMain.handle(
    'emulators:install',
    async (event, emulatorId: string) => {
      const config = findEmulator(emulatorId);
      if (!config) throw new Error(`Unknown emulator: ${emulatorId}`);
      if (!config.downloads) throw new Error(`No downloads configured for ${emulatorId}`);

      const platform = getPlatform();
      const arch = getArch();
      const downloads = config.downloads[platform];
      if (!downloads || downloads.length === 0)
        throw new Error(`No downloads available for ${emulatorId} on ${platform}`);

      const win = BrowserWindow.fromWebContents(event.sender);
      const sendProgress = (p: InstallProgress) => {
        win?.webContents.send('emulators:install-progress', p);
      };

      await installEmulator(emulatorId, downloads, platform, arch, sendProgress);

      // Re-check state after install
      return checkEmulator(emulatorId);
    }
  );

  // Configure emulator with recommended settings
  ipcMain.handle(
    'emulators:configure',
    async (_event, emulatorId: string, installPath: string) => {
      const success = await applyRecommendedConfig(emulatorId, installPath);
      return { success, state: checkEmulator(emulatorId) };
    }
  );

  // Get available presets for an emulator
  ipcMain.handle(
    'emulators:presets',
    async (_event, emulatorId: string) => {
      return getPresets(emulatorId);
    }
  );

  // Check if configured
  ipcMain.handle(
    'emulators:configured',
    (_event, emulatorId: string, installPath?: string) => {
      return checkConfigured(emulatorId, installPath);
    }
  );

  // Open website (fallback for manual download)
  ipcMain.handle('emulators:open-website', (_event, id: string) => {
    const emu = findEmulator(id);
    if (emu?.websiteUrl?.[getPlatform()]) {
      shell.openExternal(emu.websiteUrl[getPlatform()]!);
      return true;
    }
    return false;
  });

  // ROMs / Games
  ipcMain.handle('roms:scan', (_event, directory?: string) => {
    const dir = directory || getRomsDirectory();
    return scanRoms(dir);
  });

  ipcMain.handle('roms:select-directory', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory'],
    });
    if (!result.canceled && result.filePaths.length > 0) {
      return result.filePaths[0];
    }
    return null;
  });

  // Launch
  ipcMain.handle(
    'game:launch',
    (_event, emulatorId: string, romPath: string) => {
      return !!launchGame(emulatorId, romPath);
    }
  );

  // Settings
  ipcMain.handle('settings:get', () => settings.get());
  ipcMain.handle('settings:save', (_event, s: Partial<AppSettings>) =>
    settings.save(s)
  );
  ipcMain.handle('settings:reset', () => settings.reset());

  // Paths
  ipcMain.handle('paths:roms-directory', () => getRomsDirectory());
  ipcMain.handle('paths:emulators-directory', () => getEmulatorsDirectory());
}
