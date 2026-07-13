import type {
  EmulatorConfig,
  EmulatorState,
  GameEntry,
  GameMetadata,
  AchievementInfo,
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
        systemAssignments: () => Promise<Record<string, string[]>>;
        states: () => Promise<EmulatorState[]>;
        check: (id: string) => Promise<EmulatorState>;
        install: (id: string) => Promise<EmulatorState>;
        launch: (id: string) => Promise<boolean>;
        uninstall: (id: string) => Promise<{ removed: boolean; state: EmulatorState }>;
        configure: (id: string, installPath: string) => Promise<{ success: boolean; state: EmulatorState }>;
        presets: (id: string) => Promise<ConfigPreset[]>;
        configured: (id: string, installPath?: string) => Promise<boolean>;
        openWebsite: (id: string) => Promise<boolean>;
        updateControllerConfig: (id: string, installPath: string, controllerName?: string) => Promise<boolean>;
        onInstallProgress: (cb: (p: InstallProgress) => void) => () => void;
      };
      roms: {
        scan: (directory?: string) => Promise<GameEntry[]>;
        selectDirectory: () => Promise<string | null>;
      };
      game: {
        launch: (emulatorId: string, romPath: string) => Promise<boolean>;
        recent: () => Promise<GameEntry[]>;
        clearRecent: () => Promise<boolean>;
        scrapeArt: (title: string, platform: string) => Promise<string | undefined>;
        cacheCovers: (entries: { romPath: string; coverUrl: string }[]) => Promise<boolean>;
        scrapeMetadata: (romPath: string, title: string, platform: string) => Promise<GameMetadata>;
        achievements: (romPath: string, title: string, platform: string) => Promise<AchievementInfo | null>;
      };
      bios: {
        listKnown: () => Promise<any[]>;
        scan: (directory?: string) => Promise<any[]>;
        selectDirectory: () => Promise<string | null>;
        configureRetroArch: (configDir: string, biosDir: string) => Promise<boolean>;
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
      utilities: {
        regenerateRomsStructure: () => Promise<boolean>;
      };
      retroachievements: {
        save: (username: string, password: string) => Promise<Record<string, boolean>>;
      };
      updates: {
        check: () => Promise<boolean>;
        download: () => Promise<boolean>;
        quitAndInstall: () => Promise<boolean>;
        onStatus: (cb: (status: Record<string, unknown>) => void) => () => void;
        onDownloadProgress: (cb: (progress: Record<string, unknown>) => void) => () => void;
      };
    };
  }
}

export interface NavItem {
  page: string;
  label: string;
  icon: string;
}
