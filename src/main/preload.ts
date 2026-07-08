import { contextBridge, ipcRenderer } from 'electron';
import {
  EmulatorConfig,
  EmulatorState,
  GameEntry,
  SystemInfo,
  AppSettings,
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
    openInstallUrl: (id: string): Promise<string | null> =>
      ipcRenderer.invoke('emulators:install-url', id),
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
