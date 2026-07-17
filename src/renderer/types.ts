import type {
  EmulatorConfig,
  EmulatorState,
  DecompProject,
  DecompState,
  GameEntry,
  GameMetadata,
  AchievementInfo,
  SystemInfo,
  AppSettings,
  InstallProgress,
  ConfigPreset,
  EmulatorSaves,
  BackupEntry,
  SyncthingStatus,
  SyncthingPendingDevice,
  SyncthingPendingFolder,
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
        applyRecommendedAll: (fullscreen: boolean) => Promise<{ id: string; ok: boolean }[]>;
        onInstallProgress: (cb: (p: InstallProgress) => void) => () => void;
      };
      decomps: {
        states: () => Promise<DecompState[]>;
        check: (id: string) => Promise<DecompState>;
        install: (id: string) => Promise<DecompState>;
        uninstall: (id: string) => Promise<{ removed: boolean; state: DecompState }>;
        launch: (id: string) => Promise<boolean>;
        openWebsite: (id: string) => Promise<boolean>;
        setRom: (id: string, romPath: string) => Promise<DecompState>;
        selectRom: (id: string) => Promise<{ romPath: string | null; state: DecompState }>;
        onInstallProgress: (cb: (p: { decompId: string; stage: string; percent: number; message: string }) => void) => () => void;
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
        clearCoverCache: () => Promise<boolean>;
        searchCoverSGDB: (title: string, platform: string) => Promise<any[]>;
        scrapeMetadata: (romPath: string, title: string, platform: string) => Promise<GameMetadata>;
        achievements: (romPath: string, title: string, platform: string) => Promise<AchievementInfo | null>;
        autoApplyCovers: () => Promise<{ total: number; alreadyHadCover: number; applied: number; failed: number; skippedNoKey?: boolean }>;
        onAutoApplyCoversProgress: (cb: (progress: { current: number; total: number; title: string }) => void) => () => void;
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
      saves: {
        list: () => Promise<EmulatorSaves[]>;
        delete: (filePath: string) => Promise<boolean>;
        backup: (filePath: string) => Promise<string | null>;
        listBackups: () => Promise<BackupEntry[]>;
        restore: (backupPath: string) => Promise<boolean>;
        openBackupFolder: () => Promise<boolean>;
        openFolder: (folderPath: string) => Promise<boolean>;
        selectDirectory: () => Promise<string | null>;
        setDirectory: (emulatorId: string, dir: string) => Promise<boolean>;
      };
      retroachievements: {
        save: (username: string, password: string) => Promise<Record<string, boolean>>;
      };
      filters: {
        list: () => Promise<{ id: string; name: string; description: string }[]>;
        apply: (presetId: string) => Promise<{ success: boolean; message: string; appliedPreset: string }>;
      };
      updates: {
        check: () => Promise<boolean>;
        download: () => Promise<boolean>;
        quitAndInstall: () => Promise<boolean>;
        onStatus: (cb: (status: Record<string, unknown>) => void) => () => void;
        onDownloadProgress: (cb: (progress: Record<string, unknown>) => void) => () => void;
      };
      cloud: {
        status: () => Promise<SyncthingStatus>;
        install: () => Promise<boolean>;
        start: () => Promise<SyncthingStatus | null>;
        stop: () => Promise<SyncthingStatus>;
        addDevice: (deviceId: string, name: string) => Promise<boolean>;
        removeDevice: (deviceId: string) => Promise<boolean>;
        addFolder: (id: string, label: string, path: string, deviceIds: string[]) => Promise<boolean>;
        removeFolder: (folderId: string) => Promise<boolean>;
        openWebUI: () => Promise<boolean>;
        pendingDevices: () => Promise<SyncthingPendingDevice[]>;
        acceptPendingDevice: (deviceId: string) => Promise<boolean>;
        pendingFolders: () => Promise<SyncthingPendingFolder[]>;
        acceptPendingFolder: (folderId: string, folderLabel: string, localPath: string, deviceId: string) => Promise<boolean>;
        guessPath: (label: string) => Promise<string | null>;
        emulatorDirs: () => Promise<{ id: string; name: string; saves: string | null }[]>;
        toggleFolderSync: (emuId: string, sync: boolean) => Promise<boolean>;
        uninstall: () => Promise<boolean>;
        onInstallProgress: (cb: (progress: { stage: string; percent: number; message: string }) => void) => () => void;
      };
      app: {
        nukeData: () => Promise<boolean>;
      };
    };
  }
}

export interface NavItem {
  page: string;
  label: string;
  icon: string;
}
