import { existsSync, mkdirSync, readFileSync, rmSync, readdirSync, writeFileSync, copyFileSync } from 'fs';
import { join, extname, basename } from 'path';
import { app, shell } from 'electron';
import { spawn, execSync } from 'child_process';
import { DecompProject, DecompState, Platform } from '../shared/types';
import { getPlatform } from './platform';
import { settings } from './settings';

const platform = getPlatform();

export const knownDecomps: DecompProject[] = [
  // ── N64 Ports ──────────────────────────────────────────────
  {
    id: 'soh',
    name: 'Ship of Harkinian',
    description: 'The Legend of Zelda: Ocarina of Time — 60 FPS, 4K, randomizer, mods',
    platform: 'N64',
    githubUrl: 'https://github.com/HarbourMasters/Shipwright',
    githubRepo: 'HarbourMasters/Shipwright',
    executablePath: {
      win32: 'soh.exe',
      darwin: 'soh.app/Contents/MacOS/soh',
      linux: 'soh',
    },
    romExtensions: ['.z64', '.n64', '.v64'],
    requiresRom: true,
    features: ['60 FPS game logic', '4K rendering', 'Built-in randomizer', 'Mod loader', 'Gyro / motion aiming', 'HD texture replacement'],
  },
  {
    id: '2s2h',
    name: '2Ship2Harkinian',
    description: "The Legend of Zelda: Majora's Mask — 60 FPS, widescreen, randomizer mods",
    platform: 'N64',
    githubUrl: 'https://github.com/HarbourMasters/2ship2harkinian',
    githubRepo: 'HarbourMasters/2ship2harkinian',
    executablePath: {
      win32: '2s2h.exe',
      darwin: '2s2h.app/Contents/MacOS/2s2h',
      linux: '2s2h',
    },
    romExtensions: ['.z64', '.n64', '.v64'],
    requiresRom: true,
    features: ['60 FPS game logic', 'Widescreen & 4K', 'Randomizer mod support', 'Shared engine with SoH'],
  },
  {
    id: 'sm64pc',
    name: 'Super Mario 64',
    description: 'SM64 PC Port — uncapped FPS, 4K, mod loader, analog camera',
    platform: 'N64',
    githubUrl: 'https://github.com/sm64pc/sm64ex',
    githubRepo: 'sm64pc/sm64ex',
    executablePath: {
      win32: 'build\\release\\sm64.pex64.exe',
      darwin: 'build/release/sm64.fat.macos',
      linux: 'build/release/sm64.pex64',
    },
    romExtensions: ['.z64', '.n64', '.v64'],
    requiresRom: true,
    features: ['Uncapped framerate', '4K & ultrawide', 'Mod loader', 'Analog camera', 'Controller remapping'],
  },
  {
    id: 'starship',
    name: 'Star Fox 64',
    description: 'Starship — widescreen, gyro aiming, rumble, HD textures',
    platform: 'N64',
    githubUrl: 'https://github.com/HarbourMasters/Starship',
    githubRepo: 'HarbourMasters/Starship',
    executablePath: {
      win32: 'starship.exe',
      darwin: 'starship.app/Contents/MacOS/starship',
      linux: 'starship',
    },
    romExtensions: ['.z64', '.n64', '.v64'],
    requiresRom: true,
    features: ['Widescreen & ultrawide', 'Gyro aiming', 'HD texture packs', 'Force feedback / rumble'],
  },
  {
    id: 'banjo-recomp',
    name: 'Banjo-Kazooie',
    description: 'Banjo: Recompiled — dual-stick camera, ultrawide, instant loading',
    platform: 'N64',
    githubUrl: 'https://github.com/Wiseguy/Banjo-Recompiled',
    githubRepo: 'Wiseguy/Banjo-Recompiled',
    executablePath: {
      win32: 'Banjo.exe',
      darwin: '',
      linux: 'banjo',
    },
    romExtensions: ['.z64', '.n64', '.v64'],
    requiresRom: true,
    features: ['Dual-stick free camera', 'Ultrawide support', 'Near-instant loading', 'High-resolution rendering'],
  },
  {
    id: 'perfect-dark',
    name: 'Perfect Dark',
    description: 'Perfect Dark PC — high-res, modern dual-stick controls, bots',
    platform: 'N64',
    githubUrl: 'https://github.com/perfect-dark-decomp/perfect-dark',
    githubRepo: 'perfect-dark-decomp/perfect-dark',
    executablePath: {
      win32: 'pd.exe',
      darwin: '',
      linux: 'perfect-dark',
    },
    romExtensions: ['.z64', '.n64', '.v64'],
    requiresRom: true,
    features: ['High-resolution output', 'Modern dual-stick controls', 'Bot support', 'Widescreen', 'Improved framerate'],
  },
  {
    id: 'mk64recomp',
    name: 'Mario Kart 64',
    description: 'SpaghettiKart — widescreen, higher FPS, online multiplayer',
    platform: 'N64',
    githubUrl: 'https://github.com/n64decomp/mk64',
    githubRepo: 'n64decomp/mk64',
    executablePath: {
      win32: 'mk64.exe',
      darwin: '',
      linux: 'mk64',
    },
    romExtensions: ['.z64', '.n64', '.v64'],
    requiresRom: true,
    features: ['Widescreen & ultrawide', 'Higher framerate', 'Online multiplayer via mods', 'Custom track loading'],
  },
  {
    id: 'bm64recomp',
    name: 'Bomberman 64',
    description: 'BM64Recomp — native PC rendering, widescreen, configurable controls',
    platform: 'N64',
    githubUrl: 'https://github.com/Bomberman64Recomp/BM64Recomp',
    githubRepo: 'Bomberman64Recomp/BM64Recomp',
    executablePath: {
      win32: 'BM64.exe',
      darwin: '',
      linux: 'bm64',
    },
    romExtensions: ['.z64', '.n64', '.v64'],
    requiresRom: true,
    features: ['Native PC rendering', 'Widescreen support', 'Configurable controls'],
  },
  {
    id: 'bmherorecomp',
    name: 'Bomberman Hero',
    description: 'BMHeroRecomp — native PC recompilation with modern controls',
    platform: 'N64',
    githubUrl: 'https://github.com/BombermanHeroRecomp/BMHeroRecomp',
    githubRepo: 'BombermanHeroRecomp/BMHeroRecomp',
    executablePath: {
      win32: 'BMHero.exe',
      darwin: '',
      linux: 'bmhero',
    },
    romExtensions: ['.z64', '.n64', '.v64'],
    requiresRom: true,
    features: ['Native PC rendering', 'Widescreen support', 'Companion to BM64Recomp'],
  },
  {
    id: 'banjo-tooie-recomp',
    name: 'Banjo-Tooie',
    description: 'Banjo-Tooie Recomp — native PC with widescreen and higher framerates',
    platform: 'N64',
    githubUrl: 'https://github.com/banjo-tooie-recomp/banjo-tooie-recomp',
    githubRepo: 'banjo-tooie-recomp/banjo-tooie-recomp',
    executablePath: {
      win32: 'BanjoTooie.exe',
      darwin: '',
      linux: 'banjo-tooie',
    },
    romExtensions: ['.z64', '.n64', '.v64'],
    requiresRom: true,
    features: ['Native PC executable', 'Widescreen support', 'Higher framerates', 'Controller remapping'],
  },
  {
    id: 'dk64recomp',
    name: 'Donkey Kong 64',
    description: "DK64 Recomp — Rare's DK64 with native rendering and modern controls",
    platform: 'N64',
    githubUrl: 'https://github.com/DK64Recomp/DK64Recomp',
    githubRepo: 'DK64Recomp/DK64Recomp',
    executablePath: {
      win32: 'DK64.exe',
      darwin: '',
      linux: 'dk64',
    },
    romExtensions: ['.z64', '.n64', '.v64'],
    requiresRom: true,
    features: ['Native rendering', 'High resolution', 'Widescreen support', 'Modern controller support'],
  },
  {
    id: 'kirby64recomp',
    name: 'Kirby 64: The Crystal Shards',
    description: 'Kirby64 Recomp — native PC with higher resolutions and widescreen',
    platform: 'N64',
    githubUrl: 'https://github.com/Kirby64Recomp/Kirby64Recomp',
    githubRepo: 'Kirby64Recomp/Kirby64Recomp',
    executablePath: {
      win32: 'Kirby64.exe',
      darwin: '',
      linux: 'kirby64',
    },
    romExtensions: ['.z64', '.n64', '.v64'],
    requiresRom: true,
    features: ['Native rendering', 'Higher resolutions', 'Widescreen support', 'Controller remapping'],
  },
  // ── GameCube Ports ─────────────────────────────────────────
  {
    id: 'dusklight',
    name: 'Zelda: Twilight Princess',
    description: 'Dusklight — native 60 FPS, 4K, HD textures, mod loader',
    platform: 'GameCube',
    githubUrl: 'https://github.com/TwilitRealm/dusklight',
    githubRepo: 'TwilitRealm/dusklight',
    executablePath: {
      win32: 'dusklight.exe',
      darwin: '',
      linux: 'dusklight',
    },
    romExtensions: ['.iso', '.gcm', '.rvz', '.gcz'],
    requiresRom: true,
    features: ['Native 60 FPS', '4K rendering', 'HD texture packs', 'Mod loader', 'Widescreen & ultrawide'],
  },
  // ── SNES Ports ─────────────────────────────────────────────
  {
    id: 'zelda3',
    name: 'Zelda: A Link to the Past',
    description: 'zelda3 — clean decompilation, widescreen, higher resolution',
    platform: 'SNES',
    githubUrl: 'https://github.com/snesrev/zelda3',
    githubRepo: 'snesrev/zelda3',
    executablePath: {
      win32: 'zelda3.exe',
      darwin: 'zelda3',
      linux: 'zelda3',
    },
    romExtensions: ['.sfc', '.smc'],
    requiresRom: true,
    features: ['Clean annotated codebase', 'Widescreen support', 'Higher resolution rendering', 'Mod-friendly structure'],
  },
  // ── GBA Ports ──────────────────────────────────────────────
  {
    id: 'tmcpicori',
    name: 'Zelda: The Minish Cap',
    description: 'Project Picori — native PC port with higher resolution',
    platform: 'GBA',
    githubUrl: 'https://github.com/999sian/tmc',
    githubRepo: '999sian/tmc',
    executablePath: {
      win32: 'tmc.exe',
      darwin: '',
      linux: 'tmc',
    },
    romExtensions: ['.gba'],
    requiresRom: true,
    features: ['Native PC rendering', 'Higher internal resolution', 'Preservation-focused build'],
  },
  // ── PS2 Ports ──────────────────────────────────────────────
  {
    id: 'opengoal',
    name: 'Jak and Daxter',
    description: 'OpenGOAL — full trilogy (Jak 1, 2, 3) with modding language',
    platform: 'PS2',
    githubUrl: 'https://github.com/open-goal/jak-project',
    githubRepo: 'open-goal/jak-project',
    executablePath: {
      win32: 'gk.exe',
      darwin: 'gk.app/Contents/MacOS/gk',
      linux: 'gk',
    },
    romExtensions: ['.iso'],
    requiresRom: true,
    features: ['Full trilogy (Jak 1, 2, 3)', 'OpenGOAL modding language', 'Widescreen & 4K', 'Launcher with auto-updates'],
  },
  // ── Xbox 360 / PS3 Ports ──────────────────────────────────
  {
    id: 'unleashedrecomp',
    name: 'Sonic Unleashed',
    description: 'UnleashedRecomp — Hedgehog Engine RT, 60 FPS+, ultrawide',
    platform: 'Xbox 360 / PS3',
    githubUrl: 'https://github.com/hedge-dev/UnleashedRecomp',
    githubRepo: 'hedge-dev/UnleashedRecomp',
    executablePath: {
      win32: 'UnleashedRecomp.exe',
      darwin: '',
      linux: '',
    },
    romExtensions: ['.iso'],
    requiresRom: true,
    features: ['Hedgehog Engine path tracing', '60 FPS+ with fixed logic', 'Ultrawide support', 'Mod support via HMM'],
  },
];

// ── State Management ──────────────────────────────────────────

function getDecompDir(id: string): string {
  return join(app.getPath('userData'), 'emulators', id);
}

function getMarkerFile(id: string): string {
  return join(getDecompDir(id), '.installed');
}

function getRomConfigFile(): string {
  return join(app.getPath('userData'), 'decomps', 'roms.json');
}

function readRomPaths(): Record<string, string> {
  try {
    return JSON.parse(readFileSync(getRomConfigFile(), 'utf-8'));
  } catch {
    return {};
  }
}

function writeRomPaths(paths: Record<string, string>): void {
  const dir = join(app.getPath('userData'), 'decomps');
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(getRomConfigFile(), JSON.stringify(paths, null, 2), 'utf-8');
}

function detectDecompVersion(installDir: string): string | undefined {
  const versionFile = join(installDir, '.version');
  try {
    return readFileSync(versionFile, 'utf-8').trim();
  } catch {
    return undefined;
  }
}

function findDecompExecutable(config: DecompProject): string | undefined {
  const installDir = getDecompDir(config.id);
  const markerPath = getMarkerFile(config.id);

  // Check marker file first
  try {
    const execPath = readFileSync(markerPath, 'utf-8').trim();
    if (execPath && existsSync(execPath)) return execPath;
  } catch { /* no marker */ }

  // Try platform-specific default path
  const defaultExec = config.executablePath[platform];
  if (defaultExec) {
    const fullPath = join(installDir, defaultExec);
    if (existsSync(fullPath)) return fullPath;
  }

  // Fallback: look for any executable in the install dir
  try {
    const files = readdirSync(installDir);
    const execExts = platform === 'win32' ? ['.exe'] : ['', '.app'];
    for (const file of files) {
      if (execExts.some(ext => file.endsWith(ext))) {
        return join(installDir, file);
      }
    }
  } catch { /* empty dir */ }

  return undefined;
}

function findDecompRom(config: DecompProject): string | undefined {
  const romPaths = readRomPaths();
  if (romPaths[config.id] && existsSync(romPaths[config.id])) {
    return romPaths[config.id];
  }

  // Search common ROM directories
  const s = settings.get();
  const romDirs = [
    s.romsDirectory,
    join(app.getPath('userData'), 'roms'),
  ].filter(Boolean) as string[];

  for (const romDir of romDirs) {
    const platformDir = join(romDir, config.platform.toLowerCase().replace(/\s+/g, '-'));
    if (!existsSync(platformDir)) continue;

    try {
      const files = readdirSync(platformDir);
      for (const file of files) {
        if (config.romExtensions.includes(extname(file).toLowerCase())) {
          return join(platformDir, file);
        }
      }
    } catch { /* skip */ }

    // Also check the root rom directory
    try {
      const files = readdirSync(romDir);
      for (const file of files) {
        if (config.romExtensions.includes(extname(file).toLowerCase())) {
          return join(romDir, file);
        }
      }
    } catch { /* skip */ }
  }

  return undefined;
}

export function checkDecomp(id: string): DecompState {
  const config = knownDecomps.find(d => d.id === id);
  if (!config) {
    return {
      installed: false,
      hasRom: false,
      config: {
        id, name: id, description: '', platform: '',
        githubUrl: '', githubRepo: '', executablePath: { win32: '', darwin: '', linux: '' },
        romExtensions: [], requiresRom: true, features: [],
      },
    };
  }

  const execPath = findDecompExecutable(config);
  const version = execPath ? detectDecompVersion(getDecompDir(config.id)) : undefined;
  const romPath = findDecompRom(config);

  return {
    installed: !!execPath,
    version,
    path: execPath,
    config,
    hasRom: !!romPath,
    romPath: romPath || undefined,
  };
}

export function getAllDecompStates(): DecompState[] {
  const s = settings.get();
  if (!s.decompProjects) return [];
  return knownDecomps.map(d => checkDecomp(d.id));
}

export function setDecompRomPath(id: string, romPath: string): boolean {
  const romPaths = readRomPaths();
  romPaths[id] = romPath;
  writeRomPaths(romPaths);
  return true;
}

export function launchDecomp(id: string): boolean {
  const state = checkDecomp(id);
  if (!state.installed || !state.path) return false;

  const installDir = getDecompDir(id);

  // Ensure the executable has execute permission on macOS/Linux
  if (platform !== 'win32') {
    try { execSync(`chmod +x "${state.path}"`, { timeout: 3000 }); } catch { /* ignore */ }
  }

  // Copy ROM into the install dir so the port can find it
  if (state.romPath && existsSync(state.romPath)) {
    const romBase = basename(state.romPath);
    const dest = join(installDir, romBase);
    if (state.romPath !== dest) {
      try { copyFileSync(state.romPath, dest); } catch { /* ignore */ }
    }
  }

  try {
    const child = spawn(state.path, [], { cwd: installDir, detached: true, stdio: 'ignore' });
    child.on('error', (err) => { console.error(`Decomp launch error (${id}):`, err.message); });
    child.unref();
  } catch (err: any) {
    console.error(`Decomp spawn failed (${id}):`, err.message);
    return false;
  }

  return true;
}

export function uninstallDecomp(id: string): boolean {
  const installDir = getDecompDir(id);
  let removed = false;

  if (existsSync(installDir)) {
    rmSync(installDir, { recursive: true, force: true });
    removed = true;
  }

  return removed;
}

export function openDecompWebsite(id: string): boolean {
  const config = knownDecomps.find(d => d.id === id);
  if (config?.githubUrl) {
    shell.openExternal(config.githubUrl);
    return true;
  }
  return false;
}

// ── GitHub Release Download ──────────────────────────────────

interface GitHubRelease {
  tag_name: string;
  assets: GitHubAsset[];
}

interface GitHubAsset {
  name: string;
  browser_download_url: string;
  size: number;
}

async function fetchLatestRelease(githubRepo: string): Promise<GitHubRelease | null> {
  try {
    const url = `https://api.github.com/repos/${githubRepo}/releases/latest`;
    const response = await fetch(url, {
      headers: { 'Accept': 'application/vnd.github.v3+json' },
    });
    if (!response.ok) return null;
    return await response.json() as GitHubRelease;
  } catch {
    return null;
  }
}

function pickBestAsset(assets: GitHubAsset[], config: DecompProject): GitHubAsset | undefined {
  const platformHints: Record<Platform, string[]> = {
    win32: ['windows', 'win64', 'win32', 'x64', '.exe', '.zip'],
    darwin: ['macos', 'mac', 'osx', 'darwin', '.dmg', '.app'],
    linux: ['linux', 'ubuntu', 'appimage', 'x86_64', 'amd64'],
  };

  const hints = platformHints[platform];

  // Score each asset
  const scored = assets.map(asset => {
    const name = asset.name.toLowerCase();
    let score = 0;
    for (const hint of hints) {
      if (name.includes(hint)) score += 10;
    }
    // Prefer zip/tar over exe installers
    if (name.endsWith('.zip') || name.endsWith('.tar.gz')) score += 5;
    // Penalize source code archives
    if (name.includes('source')) score -= 20;
    if (name.endsWith('.tar.gz') && name.includes('src')) score -= 20;
    return { asset, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored[0]?.score > 0 ? scored[0].asset : undefined;
}

export interface DecompInstallProgress {
  decompId: string;
  stage: 'downloading' | 'extracting' | 'configuring' | 'done' | 'error';
  percent: number;
  message: string;
  error?: string;
}

export async function installDecomp(
  id: string,
  onProgress: (p: DecompInstallProgress) => void,
): Promise<DecompState> {
  const config = knownDecomps.find(d => d.id === id);
  if (!config) throw new Error(`Unknown decomp: ${id}`);

  const installDir = getDecompDir(id);
  if (!existsSync(installDir)) {
    mkdirSync(installDir, { recursive: true });
  }

  try {
    onProgress({ decompId: id, stage: 'downloading', percent: 0, message: 'Fetching latest release...' });

    const release = await fetchLatestRelease(config.githubRepo);
    if (!release) throw new Error('Could not fetch latest release from GitHub');

    const asset = pickBestAsset(release.assets, config);
    if (!asset) throw new Error('No compatible release asset found for your platform');

    onProgress({ decompId: id, stage: 'downloading', percent: 10, message: `Downloading ${asset.name}...` });

    // Download to temp file
    const tmpDir = join(app.getPath('userData'), 'downloads');
    if (!existsSync(tmpDir)) mkdirSync(tmpDir, { recursive: true });
    const tmpFile = join(tmpDir, `${id}-${Date.now()}-${asset.name}`);

    await downloadFile(asset.browser_download_url, tmpFile, (pct) => {
      onProgress({ decompId: id, stage: 'downloading', percent: 10 + pct * 0.6, message: `Downloading ${asset.name}...` });
    });

    onProgress({ decompId: id, stage: 'extracting', percent: 70, message: 'Extracting...' });

    // Detect format and extract
    const isZip = asset.name.endsWith('.zip');
    const isTar = asset.name.endsWith('.tar.gz') || asset.name.endsWith('.tgz');
    const is7z = asset.name.endsWith('.7z');

    if (isZip || isTar || is7z) {
      await extractArchive(tmpFile, installDir, asset.name, onProgress, id);
    } else {
      // It might be a standalone executable
      const { copyFileSync } = require('fs');
      const targetPath = join(installDir, asset.name);
      copyFileSync(tmpFile, targetPath);
      writeFileSync(join(installDir, '.installed'), targetPath, 'utf-8');
    }

    // Clean up temp file
    try { rmSync(tmpFile, { force: true }); } catch { /* ignore */ }

    // Write version marker
    writeFileSync(join(installDir, '.version'), release.tag_name, 'utf-8');

    // Write .installed marker with the executable path
    const execPath = findDecompExecutable(config);
    if (execPath) {
      writeFileSync(join(installDir, '.installed'), execPath, 'utf-8');
    }

    onProgress({ decompId: id, stage: 'done', percent: 100, message: `Installed ${config.name}` });

    return checkDecomp(id);
  } catch (err: any) {
    onProgress({ decompId: id, stage: 'error', percent: 0, message: 'Installation failed', error: err.message });
    throw err;
  }
}

async function downloadFile(url: string, dest: string, onProgress: (pct: number) => void): Promise<void> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Download failed: ${response.status}`);

  const total = Number(response.headers.get('content-length')) || 0;
  const reader = response.body?.getReader();
  if (!reader) throw new Error('No response body');

  const { createWriteStream } = require('fs');
  const stream = createWriteStream(dest);
  let received = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    stream.write(value);
    received += value.length;
    if (total > 0) onProgress(Math.round((received / total) * 100));
  }

  stream.end();
  await new Promise<void>((resolve) => stream.on('finish', resolve));
}

async function extractArchive(
  archivePath: string,
  destDir: string,
  archiveName: string,
  onProgress: (p: DecompInstallProgress) => void,
  decompId: string,
): Promise<void> {
  try {
    if (archiveName.endsWith('.zip')) {
      onProgress({ decompId, stage: 'extracting', percent: 75, message: 'Extracting zip archive...' });
      if (platform === 'win32') {
        // Windows: use PowerShell Expand-Archive, fallback to 7z
        try {
          execSync(`powershell -NoProfile -Command "Expand-Archive -Path '${archivePath}' -DestinationPath '${destDir}' -Force"`, { timeout: 300000 });
        } catch {
          // Fallback: try 7z for zip
          try {
            const sevenZip = require('7zip-bin').path7za;
            execSync(`"${sevenZip}" x "${archivePath}" -o"${destDir}" -y`, { timeout: 300000 });
          } catch {
            execSync(`7z x "${archivePath}" -o"${destDir}" -y`, { timeout: 300000 });
          }
        }
      } else {
        execSync(`unzip -o "${archivePath}" -d "${destDir}"`, { timeout: 300000 });
      }
    } else if (archiveName.endsWith('.tar.gz') || archiveName.endsWith('.tgz')) {
      onProgress({ decompId, stage: 'extracting', percent: 75, message: 'Extracting tar archive...' });
      execSync(`tar -xzf "${archivePath}" -C "${destDir}"`, { timeout: 300000 });
    } else if (archiveName.endsWith('.7z')) {
      onProgress({ decompId, stage: 'extracting', percent: 75, message: 'Extracting 7z archive...' });
      // Try bundled 7za first, then system 7z
      let extracted = false;
      try {
        const sevenZip = require('7zip-bin').path7za;
        execSync(`"${sevenZip}" x "${archivePath}" -o"${destDir}" -y`, { timeout: 300000 });
        extracted = true;
      } catch { /* bundled 7za failed */ }
      if (!extracted) {
        execSync(`7z x "${archivePath}" -o"${destDir}" -y`, { timeout: 300000 });
      }
    }
  } catch (err: any) {
    throw new Error(`Extraction failed: ${err.message}`);
  }
}
