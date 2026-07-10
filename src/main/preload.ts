import { contextBridge, ipcRenderer } from 'electron';
import type {
  EmulatorConfig,
  EmulatorState,
  GameEntry,
  SystemInfo,
  AppSettings,
  InstallProgress,
  ConfigPreset,
} from '../shared/types';

const api = {
  system: {
    info: (): Promise<SystemInfo> => ipcRenderer.invoke('system:info'),
    platformName: (): Promise<string> => ipcRenderer.invoke('system:platform-name'),
  },

  emulators: {
    list: (): Promise<EmulatorConfig[]> => ipcRenderer.invoke('emulators:list'),
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
};

contextBridge.exposeInMainWorld('omni', api);

export type OmniApi = typeof api;
