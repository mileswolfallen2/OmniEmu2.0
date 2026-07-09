import { execSync, exec, ChildProcess } from 'child_process';
import { existsSync, mkdirSync } from 'fs';
import { join, dirname, basename, extname } from 'path';
import { app } from 'electron';
import {
  EmulatorConfig,
  EmulatorState,
  GameEntry,
  InstallProgress,
} from '../shared/types';
import { getPlatform, getArch, isWindows, isMacOS, isLinux } from './platform';
import { settings } from './settings';

const platform = getPlatform();
const arch = getArch();

export const knownEmulators: EmulatorConfig[] = [
  {
    id: 'dolphin',
    name: 'Dolphin',
    description: 'GameCube & Wii emulator',
    platforms: ['gc', 'wii'],
    defaultPath: {
      win32: 'C:\\Program Files\\Dolphin\\Dolphin.exe',
      darwin: '/Applications/Dolphin.app/Contents/MacOS/Dolphin',
      linux: '/usr/bin/dolphin-emu',
    },
    downloads: {
      win32: [
        {
          url: 'https://dl.dolphin-emu.org/releases/2412/dolphin-2412-x64.7z',
          format: '7z',
          executablePath: 'Dolphin.exe',
          arch: 'x64',
        },
      ],
      darwin: [
        {
          url: 'https://dl.dolphin-emu.org/releases/2412/dolphin-2412-universal.dmg',
          format: 'dmg',
          arch: 'arm64',
        },
        {
          url: 'https://dl.dolphin-emu.org/releases/2412/dolphin-2412-x64.dmg',
          format: 'dmg',
          arch: 'x64',
        },
      ],
      linux: [
        {
          url: 'https://dl.dolphin-emu.org/releases/2412/dolphin-2412-x86_64.AppImage',
          format: 'appimage',
        },
      ],
    },
    packageNames: { linux: 'dolphin-emu' },
    supported: true,
    websiteUrl: {
      win32: 'https://dolphin-emu.org/download/',
      darwin: 'https://dolphin-emu.org/download/',
      linux: 'https://dolphin-emu.org/download/',
    },
  },
  {
    id: 'rpcs3',
    name: 'RPCS3',
    description: 'PlayStation 3 emulator',
    platforms: ['ps3'],
    defaultPath: {
      win32: 'C:\\Program Files\\RPCS3\\rpcs3.exe',
      darwin: '/Applications/RPCS3.app/Contents/MacOS/rpcs3',
      linux: '/usr/bin/rpcs3',
    },
    downloads: {
      win32: [
        {
          url: 'https://github.com/RPCS3/rpcs3-binaries-win/releases/download/build-d2c3b344332efc6e545a09ad44b9f083c2a1a519/rpcs3-v0.0.34-17491-d2c3b344_win64.7z',
          format: '7z',
          executablePath: 'rpcs3.exe',
        },
      ],
      linux: [
        {
          url: 'https://github.com/RPCS3/rpcs3-binaries-linux/releases/download/build-d2c3b344332efc6e545a09ad44b9f083c2a1a519/rpcs3-v0.0.34-17491-d2c3b344_linux64.AppImage',
          format: 'appimage',
        },
      ],
    },
    supported: true,
    websiteUrl: {
      win32: 'https://rpcs3.net/download',
      darwin: 'https://rpcs3.net/download',
      linux: 'https://rpcs3.net/download',
    },
  },
  {
    id: 'ryujinx',
    name: 'Ryujinx',
    description: 'Nintendo Switch emulator',
    platforms: ['switch'],
    defaultPath: {
      win32: 'C:\\Program Files\\Ryujinx\\Ryujinx.exe',
      darwin: '/Applications/Ryujinx.app/Contents/MacOS/Ryujinx',
      linux: '/usr/bin/Ryujinx',
    },
    downloads: {
      win32: [
        {
          url: 'https://github.com/Ryujinx/release-channel-master/releases/latest/download/ryujinx-1.2.0-win_x64.zip',
          format: 'zip',
          executablePath: 'Ryujinx.exe',
        },
      ],
      darwin: [
        {
          url: 'https://github.com/Ryujinx/release-channel-master/releases/latest/download/ryujinx-1.2.0-mac_universal.zip',
          format: 'zip',
          executablePath: 'Ryujinx.app/Contents/MacOS/Ryujinx',
        },
      ],
      linux: [
        {
          url: 'https://github.com/Ryujinx/release-channel-master/releases/latest/download/ryujinx-1.2.0-linux_x64.zip',
          format: 'zip',
          executablePath: 'Ryujinx',
        },
      ],
    },
    supported: true,
    websiteUrl: {
      win32: 'https://ryujinx.org/download',
      darwin: 'https://ryujinx.org/download',
      linux: 'https://ryujinx.org/download',
    },
  },
  {
    id: 'pcsx2',
    name: 'PCSX2',
    description: 'PlayStation 2 emulator',
    platforms: ['ps2'],
    defaultPath: {
      win32: 'C:\\Program Files\\PCSX2\\pcsx2.exe',
      darwin: '/Applications/PCSX2.app/Contents/MacOS/PCSX2',
      linux: '/usr/bin/pcsx2',
    },
    downloads: {
      win32: [
        {
          url: 'https://github.com/PCSX2/pcsx2/releases/download/v2.3.200/pcsx2-v2.3.200-windows-x64-installer.exe',
          format: 'exe',
        },
      ],
      darwin: [
        {
          url: 'https://github.com/PCSX2/pcsx2/releases/download/v2.3.200/pcsx2-v2.3.200-macos-arm64.dmg',
          format: 'dmg',
          arch: 'arm64',
        },
        {
          url: 'https://github.com/PCSX2/pcsx2/releases/download/v2.3.200/pcsx2-v2.3.200-macos-x64.dmg',
          format: 'dmg',
          arch: 'x64',
        },
      ],
      linux: [
        {
          url: 'https://github.com/PCSX2/pcsx2/releases/download/v2.3.200/pcsx2-v2.3.200-linux-x86_64.AppImage',
          format: 'appimage',
        },
      ],
    },
    packageNames: { linux: 'pcsx2' },
    supported: true,
    websiteUrl: {
      win32: 'https://pcsx2.net/downloads/',
      darwin: 'https://pcsx2.net/downloads/',
      linux: 'https://pcsx2.net/downloads/',
    },
  },
  {
    id: 'mame',
    name: 'MAME',
    description: 'Multi Arcade Machine Emulator',
    platforms: ['arcade'],
    defaultPath: {
      win32: 'C:\\Program Files\\MAME\\mame.exe',
      darwin: '/Applications/MAME.app/Contents/MacOS/mame',
      linux: '/usr/bin/mame',
    },
    downloads: {
      win32: [
        {
          url: 'https://github.com/mamedev/mame/releases/download/mame0276/mame0276_64bit.7z',
          format: '7z',
          executablePath: 'mame64.exe',
        },
      ],
      linux: [
        {
          url: 'https://github.com/mamedev/mame/releases/download/mame0276/mame0276-x86_64.AppImage',
          format: 'appimage',
        },
      ],
    },
    packageNames: { linux: 'mame' },
    supported: true,
    websiteUrl: {
      win32: 'https://www.mamedev.org/release.html',
      darwin: 'https://www.mamedev.org/release.html',
      linux: 'https://www.mamedev.org/release.html',
    },
  },
  {
    id: 'retroarch',
    name: 'RetroArch',
    description: 'Multi-system emulator frontend (NES, SNES, N64, GB, GBA, PS1, etc.)',
    platforms: [
      'nes', 'snes', 'n64', 'gb', 'gba', 'gbc',
      'ps1', 'pce', 'sega-md', 'sega-saturn', 'sega-dc',
    ],
    defaultPath: {
      win32: 'C:\\Program Files\\RetroArch\\retroarch.exe',
      darwin: '/Applications/RetroArch.app/Contents/MacOS/RetroArch',
      linux: '/usr/bin/retroarch',
    },
    downloads: {
      win32: [
        {
          url: 'https://buildbot.libretro.com/stable/1.19.1/windows/x86_64/RetroArch.7z',
          format: '7z',
          executablePath: 'RetroArch.exe',
        },
      ],
      darwin: [
        {
          url: 'https://buildbot.libretro.com/stable/1.19.1/apple/osx/universal/RetroArch.dmg',
          format: 'dmg',
        },
      ],
      linux: [
        {
          url: 'https://buildbot.libretro.com/stable/1.19.1/linux/x86_64/RetroArch.7z',
          format: '7z',
          executablePath: 'retroarch',
        },
      ],
    },
    packageNames: {
      linux: 'retroarch',
      darwin: 'retroarch',
    },
    supported: true,
    websiteUrl: {
      win32: 'https://retroarch.com/?page=platforms',
      darwin: 'https://retroarch.com/?page=platforms',
      linux: 'https://retroarch.com/?page=platforms',
    },
  },
];

export function findEmulator(id: string): EmulatorConfig | undefined {
  return knownEmulators.find((e) => e.id === id);
}

function detectEmulatorPath(config: EmulatorConfig): string | undefined {
  const path = config.defaultPath[platform];
  if (path && existsSync(path)) return path;

  const alternatives = alternativePaths(config.id);
  for (const alt of alternatives) {
    if (existsSync(alt)) return alt;
  }

  try {
    const cmd = isWindows() ? 'where' : 'which';
    const result = execSync(`${cmd} ${config.id} 2>${isWindows() ? 'nul' : '/dev/null'}`)
      .toString().trim();
    if (result) return result.split('\n')[0];
  } catch {
    // not found
  }

  return undefined;
}

function alternativePaths(emulatorId: string): string[] {
  const home = require('os').homedir();
  const userData = app.getPath('userData');
  const omniEmuDir = join(userData, 'emulators', emulatorId);

  // Check marker file first (written after a successful install)
  const markerFile = join(omniEmuDir, '.installed');
  try {
    const markerPath = require('fs').readFileSync(markerFile, 'utf-8').trim();
    if (markerPath && existsSync(markerPath)) return [markerPath];
  } catch { /* no marker */ }

  const common: Record<string, string[]> = {
    dolphin: [
      join(omniEmuDir, 'Dolphin.exe'),
      join(omniEmuDir, 'Dolphin'),
      join(omniEmuDir, 'dolphin-emu'),
      join(home, 'Applications', 'Dolphin.app', 'Contents', 'MacOS', 'Dolphin'),
      '/usr/local/bin/dolphin-emu',
      '/snap/bin/dolphin-emu',
    ],
    retroarch: [
      join(omniEmuDir, 'RetroArch.exe'),
      join(omniEmuDir, 'RetroArch'),
      join(omniEmuDir, 'retroarch'),
      join(home, 'Applications', 'RetroArch.app', 'Contents', 'MacOS', 'RetroArch'),
      '/usr/local/bin/retroarch',
      '/snap/bin/retroarch',
    ],
    rpcs3: [
      join(omniEmuDir, 'rpcs3.exe'),
      join(omniEmuDir, 'rpcs3'),
      join(omniEmuDir, 'RPCS3.AppImage'),
    ],
    ryujinx: [
      join(omniEmuDir, 'Ryujinx.exe'),
      join(omniEmuDir, 'Ryujinx'),
    ],
    pcsx2: [
      join(omniEmuDir, 'pcsx2.exe'),
      join(omniEmuDir, 'PCSX2'),
      join(omniEmuDir, 'pcsx2.AppImage'),
    ],
    mame: [
      join(omniEmuDir, 'mame64.exe'),
      join(omniEmuDir, 'mame'),
      join(omniEmuDir, 'MAME.AppImage'),
    ],
  };
  return common[emulatorId] || [join(omniEmuDir)];
}

export function checkEmulator(id: string): EmulatorState {
  const config = findEmulator(id);
  if (!config) {
    return {
      installed: false,
      configured: false,
      config: {
        id,
        name: id,
        description: '',
        platforms: [],
        defaultPath: { win32: '', darwin: '', linux: '' },
        downloads: {},
        supported: false,
      },
    };
  }

  const path = detectEmulatorPath(config);
  let version: string | undefined;

  if (path) {
    try {
      const result = execSync(`"${path}" --version 2>&1 || "${path}" -v 2>&1`)
        .toString().trim().split('\n')[0];
      version = result || undefined;
    } catch {
      version = undefined;
    }
  }

  return {
    installed: !!path,
    version,
    path,
    config,
    configured: !!path && existsSync(join(app.getPath('userData'), 'configs', `${id}.configured`)),
  };
}

export function getAllEmulatorStates(): EmulatorState[] {
  return knownEmulators.map((e) => checkEmulator(e.id));
}

export function launchGame(emulatorId: string, romPath: string): ChildProcess | null {
  const state = checkEmulator(emulatorId);
  if (!state.installed || !state.path) return null;

  const emu = findEmulator(emulatorId);
  if (!emu) return null;

  const args = launchArgs(emulatorId, romPath);
  const cmd = `"${state.path}" ${args}`;

  const proc = exec(cmd, {
    cwd: dirname(state.path),
  });

  return proc;
}

function launchArgs(emulatorId: string, romPath: string): string {
  switch (emulatorId) {
    case 'dolphin':
      return `--exec="${romPath}"`;
    case 'rpcs3':
      return `"${romPath}"`;
    case 'ryujinx':
      return `"${romPath}"`;
    case 'pcsx2':
      return `"${romPath}"`;
    case 'mame':
      return `"${romPath}"`;
    case 'retroarch':
      return `-L "${romPath}"`;
    default:
      return `"${romPath}"`;
  }
}

export function getRomsDirectory(): string {
  const s = settings.get();
  if (s.romsDirectory && existsSync(s.romsDirectory)) return s.romsDirectory;

  const home = require('os').homedir();
  const defaultDir = join(home, 'OmniEmu', 'roms');
  if (!existsSync(defaultDir)) {
    mkdirSync(defaultDir, { recursive: true });
  }
  return defaultDir;
}

export function getEmulatorsDirectory(): string {
  const s = settings.get();
  if (s.emulatorsDirectory && existsSync(s.emulatorsDirectory)) return s.emulatorsDirectory;

  const dir = join(app.getPath('userData'), 'emulators');
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return dir;
}

export function scanRoms(directory: string): GameEntry[] {
  const romExtensions = [
    '.nes', '.sfc', '.smc', '.n64', '.z64', '.v64',
    '.gba', '.gb', '.gbc', '.nds', '.iso', '.bin', '.cue',
    '.wbfs', '.wad', '.nsp', '.xci', '.pkg', '.chd',
    '.gcm', '.gcz', '.rvz', '.m3u', '.ps2', '.cso',
    '.rom', '.zip', '.7z',
  ];

  const entries: GameEntry[] = [];

  function scanDir(dir: string) {
    try {
      const files = require('fs').readdirSync(dir);
      for (const file of files) {
        const fullPath = join(dir, file);
        const stat = require('fs').statSync(fullPath);
        if (stat.isDirectory()) {
          scanDir(fullPath);
        } else {
          const ext = extname(file).toLowerCase();
          if (romExtensions.includes(ext)) {
            entries.push({
              id: fullPath,
              romPath: fullPath,
              title: basename(file, ext),
              platform: guessPlatform(ext),
              emulatorId: guessEmulator(ext),
              playCount: 0,
              addedAt: new Date().toISOString(),
            });
          }
        }
      }
    } catch { /* skip unreadable */ }
  }

  scanDir(directory);
  return entries;
}

function guessPlatform(ext: string): string {
  const map: Record<string, string> = {
    '.nes': 'nes', '.sfc': 'snes', '.smc': 'snes',
    '.n64': 'n64', '.z64': 'n64', '.v64': 'n64',
    '.gba': 'gba', '.gb': 'gb', '.gbc': 'gbc', '.nds': 'nds',
    '.iso': 'ps1', '.bin': 'ps1', '.cue': 'ps1',
    '.wbfs': 'wii', '.wad': 'wii',
    '.nsp': 'switch', '.xci': 'switch',
    '.pkg': 'ps3', '.chd': 'ps1',
    '.gcm': 'gc', '.gcz': 'gc', '.rvz': 'gc',
    '.ps2': 'ps2', '.cso': 'ps2',
  };
  return map[ext] || 'other';
}

function guessEmulator(ext: string): string {
  const map: Record<string, string> = {
    '.nes': 'retroarch', '.sfc': 'retroarch', '.smc': 'retroarch',
    '.n64': 'retroarch', '.z64': 'retroarch', '.v64': 'retroarch',
    '.gba': 'retroarch', '.gb': 'retroarch', '.gbc': 'retroarch',
    '.wbfs': 'dolphin', '.wad': 'dolphin', '.gcm': 'dolphin',
    '.gcz': 'dolphin', '.rvz': 'dolphin',
    '.nsp': 'ryujinx', '.xci': 'ryujinx',
    '.pkg': 'rpcs3',
    '.ps2': 'pcsx2', '.cso': 'pcsx2',
  };
  return map[ext] || 'retroarch';
}
