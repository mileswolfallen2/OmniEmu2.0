import { ipcMain, shell, dialog } from 'electron';
import {
  getAllEmulatorStates,
  checkEmulator,
  launchGame,
  scanRoms,
  knownEmulators,
  getRomsDirectory,
  getEmulatorsDirectory,
} from './emulators';
import { settings } from './settings';
import { getSystemInfo, platformName } from './platform';
import { GameEntry, AppSettings } from '../shared/types';

export function registerIpcHandlers(): void {
  // System
  ipcMain.handle('system:info', () => getSystemInfo());
  ipcMain.handle('system:platform-name', () => platformName());

  // Emulators
  ipcMain.handle('emulators:list', () => knownEmulators);
  ipcMain.handle('emulators:states', () => getAllEmulatorStates());
  ipcMain.handle('emulators:check', (_event, id: string) => checkEmulator(id));
  ipcMain.handle('emulators:install-url', (_event, id: string) => {
    const emu = knownEmulators.find((e) => e.id === id);
    if (emu?.installUrl) {
      const platform = getSystemInfo().platform;
      const url = emu.installUrl[platform];
      if (url) shell.openExternal(url);
      return url;
    }
    return null;
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
