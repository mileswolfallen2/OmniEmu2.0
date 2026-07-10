import { ipcMain, shell, dialog, BrowserWindow } from 'electron';
import { join } from 'path';
import { writeFileSync } from 'fs';
import {
  getAllEmulatorStates,
  checkEmulator,
  uninstallEmulator,
  launchEmulator,
  launchGame,
  scanRoms,
  knownEmulators,
  findEmulator,
  getRomsDirectory,
  getEmulatorsDirectory,
  getSystemEmulators,
  ensureRomsStructure,
} from './emulators';
import { installEmulator, findInstalledBinary } from './installer';
import { applyRecommendedConfig, getPresets, checkConfigured, applyControllerConfig, applyRetroAchievements } from './configurator';
import { settings } from './settings';
import { getSystemInfo, platformName, getPlatform, getArch } from './platform';
import { checkForUpdates, downloadUpdate, quitAndInstall } from './updater';
import { InstallProgress, AppSettings, GameEntry } from '../shared/types';
import { addRecentGame, parseGameTitle, buildScrapeTitle, findValidThumbnail, cacheCovers } from './scraper';
import { scanBiosDirectory, getKnownBiosList, getDefaultBiosDir, updateRetroarchBiosPath } from './bios';

export function registerIpcHandlers(): void {
  // System
  ipcMain.handle('system:info', () => getSystemInfo());
  ipcMain.handle('system:platform-name', () => platformName());

  // Emulators
  ipcMain.handle('emulators:list', () => {
    const plat = getPlatform();
    return knownEmulators.filter(e => {
      const hasDownload = e.downloads?.[plat] && e.downloads[plat]!.length > 0;
      const hasPackage = !!e.packageNames?.[plat];
      return hasDownload || hasPackage;
    });
  });
  ipcMain.handle('emulators:system-assignments', () => getSystemEmulators());
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
      const packageName = config.packageNames?.[platform];
      if ((!downloads || downloads.length === 0) && !packageName)
        throw new Error(`No downloads available for ${emulatorId} on ${platform}`);

      const win = BrowserWindow.fromWebContents(event.sender);
      const sendProgress = (p: InstallProgress) => {
        win?.webContents.send('emulators:install-progress', p);
      };

      const installDir = await installEmulator(emulatorId, downloads ?? [], platform, arch, sendProgress, config.packageNames?.[platform]);

      // Try to find the binary and create a symlink or record it
      const download = (downloads ?? []).filter((d) => !d.arch || d.arch === arch)[0];
      const binary = findInstalledBinary(emulatorId, installDir, download?.executablePath);
      if (binary) {
        const marker = join(installDir, '.installed');
        writeFileSync(marker, binary);
      }

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

  // Launch emulator standalone (no ROM)
  ipcMain.handle('emulators:launch', (_event, id: string) => launchEmulator(id));

  // Uninstall emulator
  ipcMain.handle('emulators:uninstall', (_event, id: string) => {
    const removed = uninstallEmulator(id);
    return { removed, state: checkEmulator(id) };
  });

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
      const launched = launchGame(emulatorId, romPath);
      if (launched) {
        const emu = findEmulator(emulatorId);
        const filename = romPath.split('/').pop() || romPath.split('\\').pop() || romPath;
        const title = parseGameTitle(filename);
        const entry: GameEntry = {
          id: `${emulatorId}-${Date.now()}`,
          romPath,
          title,
          platform: emu?.platforms?.[0] || '',
          emulatorId,
          lastPlayed: new Date().toISOString(),
          playCount: 1,
          addedAt: new Date().toISOString(),
        };
        const s = settings.get();
        settings.save({ recentGames: addRecentGame(s.recentGames || [], entry) });
      }
      return !!launched;
    }
  );

  // Recent games
  ipcMain.handle('games:recent', () => {
    const s = settings.get();
    return s.recentGames || [];
  });

  // Clear recent games
  ipcMain.handle('games:clear-recent', () => {
    settings.save({ recentGames: [] });
    return true;
  });

  // Scrape a game's art URL — accepts display title, uses scrape-friendly title internally
  ipcMain.handle('games:scrape-art', async (_event, title: string, platform: string) => {
    return findValidThumbnail(buildScrapeTitle(title), platform);
  });

  // Cache scraped cover URLs
  ipcMain.handle('games:cache-covers', (_event, entries: { romPath: string; coverUrl: string }[]) => {
    cacheCovers(entries);
    return true;
  });

  // Settings
  ipcMain.handle('settings:get', () => settings.get());
  ipcMain.handle('settings:save', (_event, s: Partial<AppSettings>) =>
    settings.save(s)
  );
  ipcMain.handle('settings:reset', () => settings.reset());

  // Controller config
  ipcMain.handle(
    'emulators:update-controller-config',
    (_event, emulatorId: string, installPath: string, controllerName?: string) => {
      return applyControllerConfig(emulatorId, installPath, controllerName);
    }
  );

  // BIOS
  ipcMain.handle('bios:list-known', () => getKnownBiosList());

  ipcMain.handle('bios:scan', (_event, directory?: string) => {
    const dir = directory || settings.get().biosDirectory || getDefaultBiosDir();
    return scanBiosDirectory(dir);
  });

  ipcMain.handle('bios:select-directory', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory'],
      title: 'Select BIOS Directory',
    });
    if (!result.canceled && result.filePaths.length > 0) {
      const dir = result.filePaths[0];
      settings.save({ biosDirectory: dir });
      return dir;
    }
    return null;
  });

  ipcMain.handle('bios:configure-retroarch', (_event, configDir: string, biosDir: string) => {
    return updateRetroarchBiosPath(configDir, biosDir);
  });

  // Paths
  ipcMain.handle('paths:roms-directory', () => getRomsDirectory());
  ipcMain.handle('paths:emulators-directory', () => getEmulatorsDirectory());

  // RetroAchievements
  ipcMain.handle(
    'retroachievements:save',
    async (_event, username: string, password: string) => {
      const s = settings.get();
      settings.save({ retroAchievementsUsername: username, retroAchievementsPassword: password });
      const results = applyRetroAchievements(username, password);
      return results;
    }
  );

  // Utilities
  ipcMain.handle('utilities:regenerate-roms-structure', () => {
    ensureRomsStructure();
    return true;
  });

  // Updates
  ipcMain.handle('updates:check', async () => {
    await checkForUpdates();
    return true;
  });

  ipcMain.handle('updates:download', async () => {
    await downloadUpdate();
    return true;
  });

  ipcMain.handle('updates:quit-and-install', async () => {
    quitAndInstall();
    return true;
  });
}
