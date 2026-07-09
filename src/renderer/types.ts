import type {
  EmulatorConfig,
  EmulatorState,
  GameEntry,
  SystemInfo,
  AppSettings,
  InstallProgress,
  ConfigPreset,
} from '../shared/types';

declare global {
  interface Window {
    omni: {
      system: {
        info: () => Promise<SystemInfo>;
        platformName: () => Promise<string>;
      };
      emulators: {
        list: () => Promise<EmulatorConfig[]>;
        states: () => Promise<EmulatorState[]>;
        check: (id: string) => Promise<EmulatorState>;
        install: (id: string) => Promise<EmulatorState>;
        configure: (id: string, installPath: string) => Promise<{ success: boolean; state: EmulatorState }>;
        presets: (id: string) => Promise<ConfigPreset[]>;
        configured: (id: string, installPath?: string) => Promise<boolean>;
        openWebsite: (id: string) => Promise<boolean>;
        onInstallProgress: (cb: (p: InstallProgress) => void) => () => void;
      };
      roms: {
        scan: (directory?: string) => Promise<GameEntry[]>;
        selectDirectory: () => Promise<string | null>;
      };
      game: {
        launch: (emulatorId: string, romPath: string) => Promise<boolean>;
      };
      settings: {
        get: () => Promise<AppSettings>;
        save: (s: Partial<AppSettings>) => Promise<AppSettings>;
        reset: () => Promise<AppSettings>;
      };
      paths: {
        romsDirectory: () => Promise<string>;
        emulatorsDirectory: () => Promise<string>;
      };
    };
  }
}

export interface NavItem {
  page: string;
  label: string;
  icon: string;
}
