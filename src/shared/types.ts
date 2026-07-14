export type Platform = 'win32' | 'darwin' | 'linux';
export type Arch = 'x64' | 'arm64';

export interface EmulatorDownload {
  url: string;
  /** Archive type: 'exe' = direct installer, 'msi' = windows msi,
   *  'dmg' = macOS disk image, 'appimage' = linux appimage,
   *  'tar.gz' | 'tar.bz2' | 'tar.xz' | 'zip' = archive to extract,
   *  'pkg' = macOS installer, '7z' = 7zip archive */
  format: string;
  /** Path inside archive to the executable (if archive format) */
  executablePath?: string;
  /** Expected file size in bytes (for validation) */
  size?: number;
  /** Only for this arch (omitted = all arches) */
  arch?: Arch;
  /** Installer type for exe format: 'nsis' (default), 'inno' */
  installerType?: 'nsis' | 'inno';
}

export interface EmulatorConfig {
  id: string;
  name: string;
  description: string;
  platforms: string[];
  defaultPath: Record<Platform, string>;
  /** Direct download sources per platform */
  downloads: Partial<Record<Platform, EmulatorDownload[]>>;
  /** Package manager names for auto-install via system pkg manager */
  packageNames?: Partial<Record<Platform, string>>;
  supported: boolean;
  /** URL to fetch recommended config presets from */
  presetUrl?: string;
  /** Website URL for manual/fallback */
  websiteUrl?: Record<Platform, string>;
}

export interface InstallProgress {
  emulatorId: string;
  stage: 'downloading' | 'extracting' | 'installing' | 'configuring' | 'done' | 'error';
  percent: number;
  message: string;
  error?: string;
}

export interface ConfigPreset {
  /** Name of the preset (e.g. "Performance", "Quality", "Recommended") */
  name: string;
  /** Description of what this preset does */
  description: string;
  /** Platform-specific config files to write: relative path -> file content */
  files: Record<string, string>;
  /** Registry/settings changes for Windows */
  registry?: Record<string, string>;
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

export interface GameMetadata {
  description?: string;
  year?: number;
  genre?: string;
  publisher?: string;
  screenshots?: string[];
  rating?: number;
}

export interface GameEntry {
  id: string;
  romPath: string;
  title: string;
  platform: string;
  emulatorId: string;
  coverUrl?: string;
  description?: string;
  year?: number;
  genre?: string;
  publisher?: string;
  screenshots?: string[];
  rating?: number;
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
  theme: 'light' | 'dark' | 'system' | 'midnight' | 'ember' | 'lavender' | 'jade';
  minimiseToTray: boolean;
  launchInFullscreen: boolean;
  closeToTray: boolean;
  /** URL to fetch recommended config presets from */
  presetSourceUrl: string;
  /** Recently played games (max 10) */
  recentGames: GameEntry[];
  /** Directory for BIOS files */
  biosDirectory: string;
  /** Per-system preferred emulator override: systemId -> emulatorId */
  systemEmulators?: Record<string, string>;
  /** RetroAchievements username */
  retroAchievementsUsername?: string;
  /** RetroAchievements password/token */
  retroAchievementsPassword?: string;
  /** RetroAchievements Web API Key (from retroachievements.org/settings) */
  retroAchievementsApiKey?: string;
  /** Enable experimental/beta features (ES-DE, NeoStation, etc.) */
  betaFeatures?: boolean;
  /** SteamGridDB API key (free account at steamgriddb.com) */
  steamGridDbApiKey?: string;
}

export interface RetroAchievement {
  id: number;
  title: string;
  description: string;
  points: number;
  badgeName: string;
  dateEarned?: string;
  dateEarnedHardcore?: string;
}

export interface AchievementInfo {
  gameId: number;
  gameTitle: string;
  consoleName: string;
  totalAchievements: number;
  totalPoints: number;
  userProgress: number;
  achievements: RetroAchievement[];
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
  configured: boolean;
}

export interface UpdateInfo {
  available: boolean;
  latestVersion: string;
  currentVersion: string;
  releaseUrl: string;
  assetName?: string;
  assetUrl?: string;
  assetSize?: number;
  releaseNotes?: string;
}
