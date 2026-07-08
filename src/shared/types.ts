export type Platform = 'win32' | 'darwin' | 'linux';
export type Arch = 'x64' | 'arm64';

export interface EmulatorConfig {
  id: string;
  name: string;
  description: string;
  platforms: string[];
  defaultPath: Record<Platform, string>;
  installUrl: Record<Platform, string | null>;
  installVia: 'download' | 'brew' | 'apt' | 'winget' | 'manual';
  supported: boolean;
}

export interface RomFile {
  path: string;
  name: string;
  size: number;
  format: string;
  platform: string;
  lastPlayed?: string;
  playCount: number;
}

export interface GameEntry {
  id: string;
  romPath: string;
  title: string;
  platform: string;
  emulatorId: string;
  coverUrl?: string;
  lastPlayed?: string;
  playCount: number;
  addedAt: string;
}

export interface ScanResult {
  emulatorId: string;
  games: GameEntry[];
}

export interface AppSettings {
  romsDirectory: string;
  emulatorsDirectory: string;
  theme: 'light' | 'dark' | 'system';
  minimiseToTray: boolean;
  launchInFullscreen: boolean;
  closeToTray: boolean;
}

export interface SystemInfo {
  platform: Platform;
  arch: Arch;
  homeDir: string;
  appDataDir: string;
}

export interface EmulatorState {
  installed: boolean;
  version?: string;
  path?: string;
  config: EmulatorConfig;
}
