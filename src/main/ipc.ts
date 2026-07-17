import { ipcMain, shell, dialog, BrowserWindow, safeStorage } from 'electron';
import { join } from 'path';
import { writeFileSync, rmSync, existsSync } from 'fs';
import { app } from 'electron';
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
import {
  getAllDecompStates,
  checkDecomp,
  installDecomp,
  uninstallDecomp,
  launchDecomp,
  openDecompWebsite,
  setDecompRomPath,
} from './decomps';
import { installEmulator, findInstalledBinary, installRetroArchCores } from './installer';
import { applyRecommendedConfig, getPresets, checkConfigured, applyControllerConfig, applyRetroAchievements, patchEmulatorFullscreen } from './configurator';
import { settings } from './settings';
import { getSystemInfo, platformName, getPlatform, getArch } from './platform';
import { checkForUpdates, downloadUpdate, quitAndInstall } from './updater';
import { InstallProgress, AppSettings, GameEntry, AchievementInfo } from '../shared/types';
import { addRecentGame, parseGameTitle, buildScrapeTitle, findValidThumbnail, cacheCovers, clearCoverCache, scrapeGameMetadata, searchSteamGridDB, autoApplyCovers } from './scraper';
import { getGameAchievements, raSupportedPlatforms } from './ra';
import { FILTER_PRESETS, applyFilterPreset } from './filters';
import { scanBiosDirectory, getKnownBiosList, getDefaultBiosDir, updateRetroarchBiosPath } from './bios';
import { listAllSaves, deleteSave, backupSave, listBackups, restoreBackup, openBackupFolder } from './saveManager';
import {
  installSyncthing,
  startSyncthing,
  stopSyncthing,
  uninstallSyncthing,
  getSyncthingStatus,
  addRemoteDevice,
  removeRemoteDevice,
  addSharedFolder,
  removeSharedFolder,
  getPendingDevices,
  acceptPendingDevice,
  getPendingFolders,
  acceptPendingFolder,
} from './syncthing';
import { guessSavePathFromLabel, getEmulatorSaveDirs } from './saveManager';

export function registerIpcHandlers(): void {
  // System
  ipcMain.handle('system:info', () => getSystemInfo());
  ipcMain.handle('system:platform-name', () => platformName());

  // Emulators
  ipcMain.handle('emulators:list', () => {
    const plat = getPlatform();
    const s = settings.get();
    const includeFrontends = s.frontendSupport;
    const FRONTEND_IDS = new Set(['esde', 'neostation', 'pegasus']);
    return knownEmulators.filter(e => {
      if (!includeFrontends && (FRONTEND_IDS.has(e.id) || e.id === 'emubuddy')) return false;
      const hasDownload = e.downloads?.[plat] && e.downloads[plat]!.length > 0;
      const hasPackage = !!e.packageNames?.[plat];
      return hasDownload || hasPackage;
    });
  });
  ipcMain.handle('emulators:system-assignments', () => getSystemEmulators());
  ipcMain.handle('emulators:states', () => getAllEmulatorStates());
  ipcMain.handle('emulators:check', (_event, id: string) => checkEmulator(id));

  // Apply recommended settings to all installed emulators
  ipcMain.handle('emulators:apply-recommended-all', async (_event, fullscreen: boolean) => {
    const states = getAllEmulatorStates();
    const installed = states.filter(s => s.installed);
    const results: { id: string; ok: boolean }[] = [];
    for (const emu of installed) {
      try {
        const ok = await applyRecommendedConfig(emu.config.id, emu.path || '', (p) => {});
        if (ok) patchEmulatorFullscreen(emu.config.id, emu.path || '', fullscreen);
        results.push({ id: emu.config.id, ok });
      } catch {
        results.push({ id: emu.config.id, ok: false });
      }
    }
    return results;
  });

  // Install emulator - direct download + install
  ipcMain.handle(
    'emulators:install',
    async (event, emulatorId: string) => {
      const config = findEmulator(emulatorId);
      if (!config) throw new Error(`Unknown emulator: ${emulatorId}`);

      // ES-DE on macOS: manual install (DMG requires license acceptance in Finder)
      if (emulatorId === 'esde' && getPlatform() === 'darwin') {
        const win = BrowserWindow.fromWebContents(event.sender);
        if (win) {
          const result = await dialog.showMessageBox(win, {
            type: 'info',
            title: 'Install ES-DE',
            message: 'ES-DE must be installed manually on macOS',
            detail: 'OmniEmu will open the ES-DE download page. Please download and install ES-DE, then return to OmniEmu and click Configure.',
            buttons: ['Open Download Page', 'Cancel'],
            defaultId: 0,
          });
          if (result.response === 0) {
            shell.openExternal('https://es-de.org/#Download');
          }
        }
        return checkEmulator(emulatorId);
      }

      // NeoStation on macOS: manual install (DMG requires license acceptance in Finder)
      if (emulatorId === 'neostation' && getPlatform() === 'darwin') {
        const win = BrowserWindow.fromWebContents(event.sender);
        if (win) {
          const result = await dialog.showMessageBox(win, {
            type: 'info',
            title: 'Install NeoStation',
            message: 'NeoStation must be installed manually on macOS',
            detail: 'OmniEmu will open the NeoStation download page. Please download and install NeoStation, then return to OmniEmu and click Configure.',
            buttons: ['Open Download Page', 'Cancel'],
            defaultId: 0,
          });
          if (result.response === 0) {
            shell.openExternal('https://neostation.dev/downloads/');
          }
        }
        return checkEmulator(emulatorId);
      }

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

      // On macOS, download RetroArch cores individually (no bulk archive exists)
      if (emulatorId === 'retroarch' && platform === 'darwin') {
        await installRetroArchCores(installDir, arch, sendProgress);
      }

      // Try to find the binary and create a symlink or record it
      const download = (downloads ?? []).filter((d) => !d.arch || d.arch === arch)[0];
      const binary = findInstalledBinary(emulatorId, installDir, download?.executablePath);
      if (binary) {
        const marker = join(installDir, '.installed');
        writeFileSync(marker, binary);
      }

      // Apply recommended settings after install
      try {
        sendProgress({ emulatorId, stage: 'configuring', percent: 0, message: 'Applying recommended settings...' });
        await applyRecommendedConfig(emulatorId, installDir, sendProgress);
      } catch { /* non-fatal */ }

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

  // Decomps
  ipcMain.handle('decomps:states', () => getAllDecompStates());
  ipcMain.handle('decomps:check', (_event, id: string) => checkDecomp(id));

  ipcMain.handle('decomps:install', async (event, id: string) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    const sendProgress = (p: any) => {
      win?.webContents.send('decomps:install-progress', p);
    };
    try {
      const state = await installDecomp(id, sendProgress);
      return state;
    } catch (err: any) {
      sendProgress({ decompId: id, stage: 'error', percent: 0, message: 'Failed', error: err.message });
      return checkDecomp(id);
    }
  });

  ipcMain.handle('decomps:uninstall', (_event, id: string) => {
    const removed = uninstallDecomp(id);
    return { removed, state: checkDecomp(id) };
  });

  ipcMain.handle('decomps:launch', (_event, id: string) => launchDecomp(id));

  ipcMain.handle('decomps:open-website', (_event, id: string) => openDecompWebsite(id));

  ipcMain.handle('decomps:set-rom', (_event, id: string, romPath: string) => {
    setDecompRomPath(id, romPath);
    return checkDecomp(id);
  });

  ipcMain.handle('decomps:select-rom', async (_event, id: string) => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      title: 'Select ROM file',
    });
    if (!result.canceled && result.filePaths.length > 0) {
      setDecompRomPath(id, result.filePaths[0]);
      return { romPath: result.filePaths[0], state: checkDecomp(id) };
    }
    return { romPath: null, state: checkDecomp(id) };
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

  // Clear all cached covers
  ipcMain.handle('games:clear-cover-cache', () => {
    clearCoverCache();
    return true;
  });

  // Recommended video filters
  ipcMain.handle('filters:list', () => FILTER_PRESETS);
  ipcMain.handle('filters:apply', async (_event, presetId: string) => {
    return applyFilterPreset(presetId);
  });

  // Search SteamGridDB for cover art options
  ipcMain.handle('games:search-cover-sgdb', async (_event, title: string, platform: string) => {
    const s = settings.get();
    if (!s.steamGridDbApiKey) return [];
    return searchSteamGridDB(buildScrapeTitle(title), platform, s.steamGridDbApiKey);
  });

  // Scrape game metadata (description, year, genre, publisher, screenshots)
  ipcMain.handle('games:scrape-metadata', async (_event, romPath: string, title: string, platform: string) => {
    return scrapeGameMetadata(romPath, buildScrapeTitle(title), platform);
  });

  // Fetch RetroAchievements for a game
  ipcMain.handle('games:achievements', async (_event, romPath: string, title: string, platform: string) => {
    if (!raSupportedPlatforms.has(platform)) return null;
    const s = settings.get();
    if (!s.retroAchievementsApiKey || !s.retroAchievementsUsername) return null;
    return getGameAchievements(romPath, title, platform, s.retroAchievementsApiKey, s.retroAchievementsUsername);
  });

  // Auto-apply covers from SteamGridDB
  ipcMain.handle('games:auto-apply-covers', async (event) => {
    const s = settings.get();
    if (!s.steamGridDbApiKey) return { total: 0, alreadyHadCover: 0, applied: 0, failed: 0, skippedNoKey: true };
    const romsDir = getRomsDirectory();
    const games = scanRoms(romsDir);
    const win = BrowserWindow.fromWebContents(event.sender);
    return autoApplyCovers(games, s.steamGridDbApiKey, (current, total, title) => {
      win?.webContents.send('games:auto-apply-covers-progress', { current, total, title });
    });
  });

  // Settings
  ipcMain.handle('settings:get', async () => {
    const s = settings.get();
    if (s.retroAchievementsPassword && safeStorage.isEncryptionAvailable()) {
      try {
        s.retroAchievementsPassword = safeStorage.decryptString(Buffer.from(s.retroAchievementsPassword, 'base64'));
      } catch { /* unencrypted legacy value, return as-is */ }
    }
    return s;
  });
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
      const encrypted = safeStorage.isEncryptionAvailable()
        ? safeStorage.encryptString(password).toString('base64')
        : password;
      settings.save({ retroAchievementsUsername: username, retroAchievementsPassword: encrypted });
      const results = await applyRetroAchievements(username, password);
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

  // Save Manager
  ipcMain.handle('saves:list', () => listAllSaves());

  ipcMain.handle('saves:delete', (_event, filePath: string) => deleteSave(filePath));

  ipcMain.handle('saves:backup', (_event, filePath: string) => backupSave(filePath));

  ipcMain.handle('saves:list-backups', () => listBackups());

  ipcMain.handle('saves:restore', (_event, backupPath: string) => restoreBackup(backupPath));

  ipcMain.handle('saves:open-backup-folder', () => openBackupFolder());

  ipcMain.handle('saves:open-folder', async (_event, folderPath: string) => {
    shell.showItemInFolder(folderPath);
    return true;
  });

  ipcMain.handle('saves:select-directory', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory'],
      title: 'Select Save Directory',
    });
    if (!result.canceled && result.filePaths.length > 0) {
      return result.filePaths[0];
    }
    return null;
  });

  ipcMain.handle('saves:set-directory', (_event, emulatorId: string, dir: string) => {
    const s = settings.get();
    const dirs = s.saveDirectories || {};
    dirs[emulatorId] = dir;
    settings.save({ saveDirectories: dirs });
    return true;
  });

  // Cloud Sync (Syncthing)
  ipcMain.handle('cloud:status', async () => {
    try {
      return await getSyncthingStatus();
    } catch (err) {
      console.error('cloud:status error:', err);
      return { installed: false, running: false, deviceId: '', apiAddress: '', apiKey: '', version: '', folders: [], remoteDevices: [] };
    }
  });

  ipcMain.handle('cloud:install', async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    const ok = await installSyncthing((stage, percent, message) => {
      win?.webContents.send('cloud:install-progress', { stage, percent, message });
    });
    return ok;
  });

  ipcMain.handle('cloud:start', async () => {
    try {
      // Fire-and-forget: start the process, don't block IPC
      startSyncthing().catch(err => console.error('cloud:start background error:', err));
      // Give it a moment to see if it comes up quickly
      await new Promise(r => setTimeout(r, 2000));
      return await getSyncthingStatus();
    } catch (err) {
      console.error('cloud:start error:', err);
      return null;
    }
  });

  ipcMain.handle('cloud:stop', async () => {
    try {
      await stopSyncthing();
    } catch (err) {
      console.error('cloud:stop error:', err);
    }
    return getSyncthingStatus();
  });

  ipcMain.handle('cloud:add-device', async (_event, deviceId: string, name: string) => {
    return addRemoteDevice(deviceId, name);
  });

  ipcMain.handle('cloud:remove-device', async (_event, deviceId: string) => {
    return removeRemoteDevice(deviceId);
  });

  ipcMain.handle('cloud:add-folder', async (_event, id: string, label: string, path: string, deviceIds: string[]) => {
    return addSharedFolder(id, label, path, deviceIds);
  });

  ipcMain.handle('cloud:remove-folder', async (_event, folderId: string) => {
    return removeSharedFolder(folderId);
  });

  ipcMain.handle('cloud:open-web-ui', async () => {
    const status = await getSyncthingStatus();
    if (status.running && status.apiAddress) {
      shell.openExternal(status.apiAddress);
      return true;
    }
    return false;
  });

  ipcMain.handle('cloud:uninstall', async () => {
    return uninstallSyncthing();
  });

  // Pending devices and folders
  ipcMain.handle('cloud:pending-devices', async () => {
    try {
      return await getPendingDevices();
    } catch {
      return [];
    }
  });

  ipcMain.handle('cloud:accept-pending-device', async (_event, deviceId: string) => {
    try {
      return await acceptPendingDevice(deviceId);
    } catch {
      return false;
    }
  });

  ipcMain.handle('cloud:pending-folders', async () => {
    try {
      return await getPendingFolders();
    } catch {
      return [];
    }
  });

  ipcMain.handle('cloud:accept-pending-folder', async (_event, folderId: string, folderLabel: string, localPath: string, deviceId: string) => {
    try {
      return await acceptPendingFolder(folderId, folderLabel, localPath, deviceId);
    } catch {
      return false;
    }
  });

  ipcMain.handle('cloud:guess-path', (_event, label: string) => {
    return guessSavePathFromLabel(label);
  });

  ipcMain.handle('cloud:emulator-dirs', async () => {
    return getEmulatorSaveDirs();
  });

  ipcMain.handle('cloud:toggle-folder-sync', async (_event, emuId: string, sync: boolean) => {
    try {
      const dirs = getEmulatorSaveDirs();
      const emu = dirs.find(d => d.id === emuId);
      if (!emu || !emu.saves) return false;
      const folderId = `saves-${emuId}`;
      if (sync) {
        // Create the folder and share with all paired devices
        const status = await getSyncthingStatus();
        const deviceIds = status.remoteDevices.map(d => d.id);
        return await addSharedFolder(folderId, `${emu.name} Saves`, emu.saves, deviceIds);
      } else {
        // Remove the folder
        return await removeSharedFolder(folderId);
      }
    } catch {
      return false;
    }
  });

  // Nuke all app data
  ipcMain.handle('app:nuke-data', async () => {
    const dataDir = app.getPath('userData');
    const dirs = ['emulators', 'downloads', 'syncthing', 'decomps', 'cache'];
    for (const d of dirs) {
      const p = join(dataDir, d);
      if (existsSync(p)) rmSync(p, { recursive: true, force: true });
    }
    const s = settings.reset();
    s.firstSetupComplete = false;
    settings.save(s);
    return true;
  });
}
