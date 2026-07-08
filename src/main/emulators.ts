import { execSync, exec, ChildProcess } from 'child_process';
import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { app } from 'electron';
import {
  EmulatorConfig,
  EmulatorState,
  Platform,
  GameEntry,
  RomFile,
} from '../shared/types';
import { getPlatform, getArch, isWindows, isMacOS, isLinux } from './platform';
import { settings } from './settings';

const platform = getPlatform();

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
    installUrl: {
      win32: 'https://dolphin-emu.org/download/',
      darwin: 'https://dolphin-emu.org/download/',
      linux: null,
    },
    installVia: 'download',
    supported: true,
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
    installUrl: {
      win32: 'https://rpcs3.net/download',
      darwin: null,
      linux: null,
    },
    installVia: 'download',
    supported: true,
  },
  {
    id: 'yuzu',
    name: 'Yuzu',
    description: 'Nintendo Switch emulator',
    platforms: ['switch'],
    defaultPath: {
      win32: 'C:\\Program Files\\Yuzu\\yuzu.exe',
      darwin: '/Applications/Yuzu.app/Contents/MacOS/yuzu',
      linux: '/usr/bin/yuzu',
    },
    installUrl: {
      win32: 'https://yuzu-emu.org/downloads/',
      darwin: null,
      linux: null,
    },
    installVia: 'download',
    supported: false,
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
    installUrl: {
      win32: 'https://ryujinx.org/download',
      darwin: 'https://ryujinx.org/download',
      linux: 'https://ryujinx.org/download',
    },
    installVia: 'download',
    supported: true,
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
    installUrl: {
      win32: 'https://pcsx2.net/downloads/',
      darwin: 'https://pcsx2.net/downloads/',
      linux: null,
    },
    installVia: 'downloacd',
    supported: true,
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
    installUrl: {
      win32: 'https://www.mamedev.org/release.html',
      darwin: null,
      linux: null,
    },
    installVia: 'download',
    supported: true,
  },
  {
    id: 'retroarch',
    name: 'RetroArch',
    description: 'Multi-system emulator frontend',
    platforms: [
      'nes', 'snes', 'n64', 'gb', 'gba', 'gbc',
      'ps1', 'pce', 'sega-md', 'sega-saturn', 'sega-dc',
    ],
    defaultPath: {
      win32: 'C:\\Program Files\\RetroArch\\retroarch.exe',
      darwin: '/Applications/RetroArch.app/Contents/MacOS/RetroArch',
      linux: '/usr/bin/retroarch',
    },
    installUrl: {
      win32: 'https://retroarch.com/?page=platforms',
      darwin: 'https://retroarch.com/?page=platforms',
      linux: 'https://retroarch.com/?page=platforms',
    },
    installVia: 'download',
    supported: true,
  },
];

function findEmulator(id: string): EmulatorConfig | undefined {
  return knownEmulators.find((e) => e.id === id);
}

function detectEmulatorPath(config: EmulatorConfig): string | undefined {
  const path = config.defaultPath[platform];
  if (path && existsSync(path)) return path;

  // Search common alternative paths
  const alternatives = alternativePaths(config.id);
  for (const alt of alternatives) {
    if (existsSync(alt)) return alt;
  }

  // Try which/where command
  try {
    const cmd = isWindows() ? 'where' : 'which';
    const result = execSync(`${cmd} ${config.id} 2>${isWindows() ? 'nul' : '/dev/null'}`)
      .toString().trim();
    if (result) return result.split('\n')[0];
  } catch {
    // not found via path
  }

  return undefined;
}

function alternativePaths(emulatorId: string): string[] {
  const home = require('os').homedir();
  const common: Record<string, string[]> = {
    dolphin: [
      join(home, 'Applications', 'Dolphin.app', 'Contents', 'MacOS', 'Dolphin'),
      '/usr/local/bin/dolphin-emu',
      '/snap/bin/dolphin-emu',
    ],
    retroarch: [
      join(home, 'Applications', 'RetroArch.app', 'Contents', 'MacOS', 'RetroArch'),
      '/usr/local/bin/retroarch',
      '/snap/bin/retroarch',
    ],
  };
  return common[emulatorId] || [];
}

export function checkEmulator(id: string): EmulatorState {
  const config = findEmulator(id);
  if (!config) {
    return {
      installed: false,
      config: {
        id,
        name: id,
        description: '',
        platforms: [],
        defaultPath: { win32: '', darwin: '', linux: '' },
        installUrl: { win32: null, darwin: null, linux: null },
        installVia: 'manual',
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
    cwd: require('path').dirname(state.path),
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

  const home = require('os').homedir();
  const defaultDir = join(home, 'OmniEmu', 'emulators');
  if (!existsSync(defaultDir)) {
    mkdirSync(defaultDir, { recursive: true });
  }
  return defaultDir;
}

export function scanRoms(directory: string): GameEntry[] {
  const { readdirSync, statSync } = require('fs');
  const { extname, basename, join: pathJoin } = require('path');

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
      const files = readdirSync(dir);
      for (const file of files) {
        const fullPath = pathJoin(dir, file);
        const stat = statSync(fullPath);
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
    } catch {
      // skip unreadable dirs
    }
  }

  scanDir(directory);
  return entries;
}

function guessPlatform(ext: string): string {
  const map: Record<string, string> = {
    '.nes': 'nes',
    '.sfc': 'snes',
    '.smc': 'snes',
    '.n64': 'n64',
    '.z64': 'n64',
    '.v64': 'n64',
    '.gba': 'gba',
    '.gb': 'gb',
    '.gbc': 'gbc',
    '.nds': 'nds',
    '.iso': 'ps1',
    '.bin': 'ps1',
    '.cue': 'ps1',
    '.wbfs': 'wii',
    '.wad': 'wii',
    '.nsp': 'switch',
    '.xci': 'switch',
    '.pkg': 'ps3',
    '.chd': 'ps1',
    '.gcm': 'gc',
    '.gcz': 'gc',
    '.rvz': 'gc',
    '.ps2': 'ps2',
    '.cso': 'ps2',
  };
  return map[ext] || 'other';
}

function guessEmulator(ext: string): string {
  const map: Record<string, string> = {
    '.nes': 'retroarch',
    '.sfc': 'retroarch',
    '.smc': 'retroarch',
    '.n64': 'retroarch',
    '.z64': 'retroarch',
    '.v64': 'retroarch',
    '.gba': 'retroarch',
    '.gb': 'retroarch',
    '.gbc': 'retroarch',
    '.wbfs': 'dolphin',
    '.wad': 'dolphin',
    '.gcm': 'dolphin',
    '.gcz': 'dolphin',
    '.rvz': 'dolphin',
    '.nsp': 'ryujinx',
    '.xci': 'ryujinx',
    '.pkg': 'rpcs3',
    '.ps2': 'pcsx2',
    '.cso': 'pcsx2',
  };
  return map[ext] || 'retroarch';
}
