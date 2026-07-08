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
