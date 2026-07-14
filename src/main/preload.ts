import { contextBridge, ipcRenderer } from 'electron';
import type {
  EmulatorConfig,
  EmulatorState,
  GameEntry,
  SystemInfo,
  AppSettings,
  InstallProgress,
  ConfigPreset,
  GameMetadata,
  AchievementInfo,
  SyncthingStatus,
} from '../shared/types';

const api = {
  system: {
    info: (): Promise<SystemInfo> => ipcRenderer.invoke('system:info'),
    platformName: (): Promise<string> => ipcRenderer.invoke('system:platform-name'),
  },

  emulators: {
    list: (): Promise<EmulatorConfig[]> => ipcRenderer.invoke('emulators:list'),
    systemAssignments: (): Promise<Record<string, string[]>> =>
      ipcRenderer.invoke('emulators:system-assignments'),
    states: (): Promise<EmulatorState[]> => ipcRenderer.invoke('emulators:states'),
    check: (id: string): Promise<EmulatorState> =>
      ipcRenderer.invoke('emulators:check', id),

    /** Download + install emulator directly. Returns final EmulatorState */
    install: (id: string): Promise<EmulatorState> =>
      ipcRenderer.invoke('emulators:install', id),

    /** Launch emulator standalone (no ROM) */
    launch: (id: string): Promise<boolean> =>
      ipcRenderer.invoke('emulators:launch', id),

    /** Uninstall an emulator */
    uninstall: (id: string): Promise<{ removed: boolean; state: EmulatorState }> =>
      ipcRenderer.invoke('emulators:uninstall', id),

    /** Apply recommended config preset to an installed emulator */
    configure: (id: string, installPath: string): Promise<{ success: boolean; state: EmulatorState }> =>
      ipcRenderer.invoke('emulators:configure', id, installPath),

    /** Get available config presets for an emulator */
    presets: (id: string): Promise<ConfigPreset[]> =>
      ipcRenderer.invoke('emulators:presets', id),

    /** Check if an emulator has been configured */
    configured: (id: string, installPath?: string): Promise<boolean> =>
      ipcRenderer.invoke('emulators:configured', id, installPath),

    /** Open the emulator's website in browser (fallback) */
    openWebsite: (id: string): Promise<boolean> =>
      ipcRenderer.invoke('emulators:open-website', id),

    /** Apply controller config to an installed emulator */
    updateControllerConfig: (id: string, installPath: string, controllerName?: string): Promise<boolean> =>
      ipcRenderer.invoke('emulators:update-controller-config', id, installPath, controllerName),

    /** Listen for install progress updates */
    onInstallProgress: (cb: (progress: InstallProgress) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, p: InstallProgress) => cb(p);
      ipcRenderer.on('emulators:install-progress', handler);
      return () => ipcRenderer.removeListener('emulators:install-progress', handler);
    },
  },

  roms: {
    scan: (directory?: string): Promise<GameEntry[]> =>
      ipcRenderer.invoke('roms:scan', directory),
    selectDirectory: (): Promise<string | null> =>
      ipcRenderer.invoke('roms:select-directory'),
  },

  game: {
    launch: (emulatorId: string, romPath: string): Promise<boolean> =>
      ipcRenderer.invoke('game:launch', emulatorId, romPath),
    recent: (): Promise<GameEntry[]> => ipcRenderer.invoke('games:recent'),
    clearRecent: (): Promise<boolean> => ipcRenderer.invoke('games:clear-recent'),
    scrapeArt: (title: string, platform: string): Promise<string | undefined> =>
      ipcRenderer.invoke('games:scrape-art', title, platform),
    cacheCovers: (entries: { romPath: string; coverUrl: string }[]): Promise<boolean> =>
      ipcRenderer.invoke('games:cache-covers', entries),
    searchCoverSGDB: (title: string, platform: string): Promise<any[]> =>
      ipcRenderer.invoke('games:search-cover-sgdb', title, platform),
    scrapeMetadata: (romPath: string, title: string, platform: string): Promise<GameMetadata> =>
      ipcRenderer.invoke('games:scrape-metadata', romPath, title, platform),
    achievements: (romPath: string, title: string, platform: string): Promise<AchievementInfo | null> =>
      ipcRenderer.invoke('games:achievements', romPath, title, platform),
  },

  bios: {
    listKnown: (): Promise<any[]> => ipcRenderer.invoke('bios:list-known'),
    scan: (directory?: string): Promise<any[]> =>
      ipcRenderer.invoke('bios:scan', directory),
    selectDirectory: (): Promise<string | null> =>
      ipcRenderer.invoke('bios:select-directory'),
    configureRetroArch: (configDir: string, biosDir: string): Promise<boolean> =>
      ipcRenderer.invoke('bios:configure-retroarch', configDir, biosDir),
  },

  settings: {
    get: (): Promise<AppSettings> => ipcRenderer.invoke('settings:get'),
    save: (s: Partial<AppSettings>): Promise<AppSettings> =>
      ipcRenderer.invoke('settings:save', s),
    reset: (): Promise<AppSettings> => ipcRenderer.invoke('settings:reset'),
  },

  paths: {
    romsDirectory: (): Promise<string> => ipcRenderer.invoke('paths:roms-directory'),
    emulatorsDirectory: (): Promise<string> =>
      ipcRenderer.invoke('paths:emulators-directory'),
  },

  utilities: {
    regenerateRomsStructure: (): Promise<boolean> =>
      ipcRenderer.invoke('utilities:regenerate-roms-structure'),
  },

  saves: {
    list: (): Promise<any[]> => ipcRenderer.invoke('saves:list'),
    delete: (filePath: string): Promise<boolean> =>
      ipcRenderer.invoke('saves:delete', filePath),
    backup: (filePath: string): Promise<string | null> =>
      ipcRenderer.invoke('saves:backup', filePath),
    openFolder: (folderPath: string): Promise<boolean> =>
      ipcRenderer.invoke('saves:open-folder', folderPath),
    selectDirectory: (): Promise<string | null> =>
      ipcRenderer.invoke('saves:select-directory'),
    setDirectory: (emulatorId: string, dir: string): Promise<boolean> =>
      ipcRenderer.invoke('saves:set-directory', emulatorId, dir),
  },

  retroachievements: {
    save: (username: string, password: string): Promise<Record<string, boolean>> =>
      ipcRenderer.invoke('retroachievements:save', username, password),
  },

  updates: {
    check: (): Promise<boolean> => ipcRenderer.invoke('updates:check'),
    download: (): Promise<boolean> => ipcRenderer.invoke('updates:download'),
    quitAndInstall: (): Promise<boolean> => ipcRenderer.invoke('updates:quit-and-install'),
    onStatus: (cb: (status: Record<string, unknown>) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, s: Record<string, unknown>) => cb(s);
      ipcRenderer.on('updates:status', handler);
      return () => ipcRenderer.removeListener('updates:status', handler);
    },
    onDownloadProgress: (cb: (progress: Record<string, unknown>) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, p: Record<string, unknown>) => cb(p);
      ipcRenderer.on('updates:download-progress', handler);
      return () => ipcRenderer.removeListener('updates:download-progress', handler);
    },
  },

  cloud: {
    status: (): Promise<SyncthingStatus> => ipcRenderer.invoke('cloud:status'),
    install: (): Promise<boolean> => ipcRenderer.invoke('cloud:install'),
    start: (): Promise<SyncthingStatus | null> => ipcRenderer.invoke('cloud:start'),
    stop: (): Promise<SyncthingStatus> => ipcRenderer.invoke('cloud:stop'),
    addDevice: (deviceId: string, name: string): Promise<boolean> =>
      ipcRenderer.invoke('cloud:add-device', deviceId, name),
    removeDevice: (deviceId: string): Promise<boolean> =>
      ipcRenderer.invoke('cloud:remove-device', deviceId),
    addFolder: (id: string, label: string, path: string, deviceIds: string[]): Promise<boolean> =>
      ipcRenderer.invoke('cloud:add-folder', id, label, path, deviceIds),
    removeFolder: (folderId: string): Promise<boolean> =>
      ipcRenderer.invoke('cloud:remove-folder', folderId),
    openWebUI: (): Promise<boolean> => ipcRenderer.invoke('cloud:open-web-ui'),
    onInstallProgress: (cb: (progress: { stage: string; percent: number; message: string }) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, p: { stage: string; percent: number; message: string }) => cb(p);
      ipcRenderer.on('cloud:install-progress', handler);
      return () => ipcRenderer.removeListener('cloud:install-progress', handler);
    },
  },
};

contextBridge.exposeInMainWorld('omni', api);

export type OmniApi = typeof api;
