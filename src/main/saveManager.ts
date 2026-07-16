import { existsSync, readdirSync, statSync, unlinkSync, copyFileSync, mkdirSync, readFileSync } from 'fs';
import { join, extname, basename } from 'path';
import { app } from 'electron';
import { homedir } from 'os';
import { getPlatform } from './platform';
import { settings } from './settings';
import { knownEmulators } from './emulators';
import { SaveEntry, EmulatorSaves } from '../shared/types';

const platform = getPlatform();
const home = homedir();

interface SaveDirConfig {
  saves: string;
  states?: string;
}

function parseRetroarchConfig(cfgPath: string): Record<string, string> {
  try {
    if (!existsSync(cfgPath)) return {};
    const content = readFileSync(cfgPath, 'utf-8');
    const result: Record<string, string> = {};
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx < 0) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      let val = trimmed.slice(eqIdx + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      result[key] = val;
    }
    return result;
  } catch { return {}; }
}

function resolveRetroarchSaveDirs(): SaveDirConfig {
  const candidates: string[] = [];

  if (platform === 'win32') {
    candidates.push(join(process.env.APPDATA || join(home, 'AppData', 'Roaming'), 'RetroArch'));
    // Standalone/portable RetroArch on Windows: saves live next to retroarch.exe
    // Check the emulator's install directory from settings
    try {
      const emuDir = settings.get().emulatorsDirectory || join(home, 'OmniEmu', 'emulators');
      const portableRetroarch = join(emuDir, 'retroarch');
      if (existsSync(portableRetroarch)) candidates.push(portableRetroarch);
    } catch { /* ignore */ }
    // Also check common standalone locations
    candidates.push(join('C:', 'Program Files', 'RetroArch'));
    candidates.push(join('C:', 'Program Files (x86)', 'RetroArch'));
  } else if (platform === 'darwin') {
    candidates.push(join(home, 'Library', 'Application Support', 'RetroArch'));
    candidates.push(join(home, 'Documents', 'RetroArch'));
    candidates.push(join(home, 'Desktop', 'RetroArch'));
  } else {
    candidates.push(join(home, '.config', 'retroarch'));
  }

  const customDirs = settings.get().saveDirectories || {};
  if (customDirs.retroarch) {
    candidates.unshift(customDirs.retroarch);
  }

  for (const dir of candidates) {
    const cfgPath = join(dir, 'retroarch.cfg');
    if (existsSync(cfgPath)) {
      const cfg = parseRetroarchConfig(cfgPath);
      const saveDir = cfg['savefile_directory'];
      const stateDir = cfg['savestate_directory'];

      let saves: string;
      let states: string | undefined;

      if (saveDir && saveDir !== 'default') {
        saves = (saveDir.startsWith('/') || /^[A-Za-z]:\\/.test(saveDir)) ? saveDir : join(dir, saveDir);
      } else {
        saves = join(dir, 'saves');
      }

      if (stateDir && stateDir !== 'default') {
        states = (stateDir.startsWith('/') || /^[A-Za-z]:\\/.test(stateDir)) ? stateDir : join(dir, stateDir);
      } else {
        states = join(dir, 'states');
      }

      if (existsSync(saves) || existsSync(states || '')) {
        return { saves, states };
      }
    }

    const saves = join(dir, 'saves');
    const states = join(dir, 'states');
    if (existsSync(saves) || existsSync(states)) {
      return { saves, states };
    }
  }

  return {
    saves: platform === 'win32'
      ? join(process.env.APPDATA || join(home, 'AppData', 'Roaming'), 'RetroArch', 'saves')
      : platform === 'darwin'
      ? join(home, 'Library', 'Application Support', 'RetroArch', 'saves')
      : join(home, '.config', 'retroarch', 'saves'),
    states: platform === 'win32'
      ? join(process.env.APPDATA || join(home, 'AppData', 'Roaming'), 'RetroArch', 'states')
      : platform === 'darwin'
      ? join(home, 'Library', 'Application Support', 'RetroArch', 'states')
      : join(home, '.config', 'retroarch', 'states'),
  };
}

let _retroarchDirs: SaveDirConfig | null = null;
function getRetroarchSaveDirs(): SaveDirConfig {
  if (!_retroarchDirs) _retroarchDirs = resolveRetroarchSaveDirs();
  return _retroarchDirs;
}

function emulatorSaveDirs(emuId: string): SaveDirConfig | null {
  const configs: Record<string, SaveDirConfig> = {
    retroarch: getRetroarchSaveDirs(),
    dolphin: {
      saves: platform === 'win32'
        ? join(home, 'Documents', 'Dolphin Emulator', 'GC')
        : platform === 'darwin'
        ? join(home, 'Library', 'Application Support', 'Dolphin', 'GC')
        : join(home, '.local', 'share', 'dolphin-emu', 'GC'),
      states: undefined,
    },
    rpcs3: {
      saves: platform === 'win32'
        ? join(process.env.APPDATA || join(home, 'AppData', 'Roaming'), 'RPCS3', 'savedata')
        : platform === 'darwin'
        ? join(home, 'Library', 'Application Support', 'rpcs3', 'savedata')
        : join(home, '.config', 'rpcs3', 'savedata'),
    },
    eden: {
      saves: platform === 'win32'
        ? join(process.env.APPDATA || join(home, 'AppData', 'Roaming'), 'Eden', 'sdmc', '0000000000000000')
        : platform === 'darwin'
        ? join(home, 'Library', 'Application Support', 'Eden', 'sdmc', '0000000000000000')
        : join(home, '.local', 'share', 'eden', 'sdmc', '0000000000000000'),
    },
    pcsx2: {
      saves: platform === 'win32'
        ? join(process.env.USERPROFILE || home, 'Documents', 'PCSX2', 'memcards')
        : platform === 'darwin'
        ? join(home, 'Library', 'Application Support', 'PCSX2', 'memcards')
        : join(home, '.config', 'PCSX2', 'memcards'),
      states: platform === 'win32'
        ? join(process.env.USERPROFILE || home, 'Documents', 'PCSX2', 'snapshots')
        : platform === 'darwin'
        ? join(home, 'Library', 'Application Support', 'PCSX2', 'snapshots')
        : join(home, '.config', 'PCSX2', 'snapshots'),
    },
    duckstation: {
      saves: platform === 'win32'
        ? join(process.env.APPDATA || join(home, 'AppData', 'Roaming'), 'DuckStation', 'memcards')
        : platform === 'darwin'
        ? join(home, 'Library', 'Application Support', 'DuckStation', 'memcards')
        : join(home, '.config', 'DuckStation', 'memcards'),
      states: platform === 'win32'
        ? join(process.env.APPDATA || join(home, 'AppData', 'Roaming'), 'DuckStation', 'save-states')
        : platform === 'darwin'
        ? join(home, 'Library', 'Application Support', 'DuckStation', 'save-states')
        : join(home, '.config', 'DuckStation', 'save-states'),
    },
    flycast: {
      saves: platform === 'win32'
        ? join(process.env.APPDATA || join(home, 'AppData', 'Roaming'), 'Flycast', 'data')
        : platform === 'darwin'
        ? join(home, 'Library', 'Application Support', 'Flycast', 'data')
        : join(home, '.config', 'flycast', 'data'),
    },
    ppsspp: {
      saves: platform === 'win32'
        ? join(home, 'Documents', 'PPSSPP', 'PPSSPP', 'memstick', 'PSP', 'SAVEDATA')
        : platform === 'darwin'
        ? join(home, 'Library', 'Application Support', 'PPSSPP', 'memstick', 'PSP', 'SAVEDATA')
        : join(home, '.config', 'ppsspp', 'memstick', 'PSP', 'SAVEDATA'),
    },
  };
  return configs[emuId] || null;
}

const SAVE_EXTENSIONS = new Set([
  '.sav', '.sa1', '.sa2', '.sa3', '.sa4', '.sa5', '.sa6', '.sa7', '.sa8', '.sa9',
  '.srm', '.eep', '.fla', '.sra', '.ss0', '.ss1', '.ss2', '.ss3', '.ss4',
  '.mcd', '.mcr', '.mc0', '.mc1', '.mc2', '.mc3',
  '.gci', '.raw', '.ags',
  '.mem', '.psm',
  '.save', '.Save', '.svs',
  '.pfd',
  '.bin',
]);

const STATE_EXTENSIONS = new Set([
  '.state', '.State', '.STATE',
  '.state0', '.state1', '.state2', '.state3', '.state4',
  '.state5', '.state6', '.state7', '.state8', '.state9',
  '.quickstate',
  '.snap',
]);

function isSaveFile(name: string): 'save' | 'state' | null {
  const ext = extname(name).toLowerCase();
  if (STATE_EXTENSIONS.has(ext)) return 'state';
  if (SAVE_EXTENSIONS.has(ext)) return 'save';
  return null;
}

function gameNameFromSave(fileName: string): string {
  let name = fileName;
  const ext = extname(name);
  name = name.slice(0, -ext.length || undefined);
  name = name.replace(/_/g, ' ').replace(/-/g, ' ');
  name = name.replace(/\b\w/g, c => c.toUpperCase());
  return name.trim() || fileName;
}

function scanDir(dir: string, maxDepth = 3): SaveEntry[] {
  if (!existsSync(dir)) return [];
  const entries: SaveEntry[] = [];
  const scan = (d: string, depth: number) => {
    if (depth > maxDepth) return;
    try {
      const files = readdirSync(d);
      for (const file of files) {
        const fullPath = join(d, file);
        try {
          const st = statSync(fullPath);
          if (st.isDirectory()) {
            scan(fullPath, depth + 1);
            continue;
          }
          const type = isSaveFile(file);
          if (!type) continue;
          entries.push({
            id: fullPath,
            emulatorId: '',
            gameName: gameNameFromSave(file),
            fileName: file,
            filePath: fullPath,
            fileSize: st.size,
            lastModified: st.mtime.toISOString(),
            type,
          });
        } catch { /* skip unreadable */ }
      }
    } catch { /* skip unreadable dir */ }
  };
  scan(dir, 0);
  return entries;
}

export function listAllSaves(): EmulatorSaves[] {
  const customDirs = settings.get().saveDirectories || {};
  const results: EmulatorSaves[] = [];

  for (const emu of knownEmulators) {
    const defaultPaths = emulatorSaveDirs(emu.id);
    const customDir = customDirs[emu.id];

    const saveDir = customDir || defaultPaths?.saves || '';
    const stateDir = defaultPaths?.states || '';

    const saves = scanDir(saveDir);
    const states = stateDir ? scanDir(stateDir) : [];

    for (const s of saves) s.emulatorId = emu.id;
    for (const s of states) s.emulatorId = emu.id;

    const all = [...saves, ...states];
    if (all.length === 0 && !customDir && !defaultPaths) continue;

    results.push({
      emulatorId: emu.id,
      emulatorName: emu.name,
      saveDir: saveDir || '(not configured)',
      stateDir: stateDir || undefined,
      saves: all,
    });
  }
  return results;
}

export function deleteSave(filePath: string): boolean {
  try {
    if (existsSync(filePath)) {
      unlinkSync(filePath);
      return true;
    }
  } catch { /* ignore */ }
  return false;
}

export function backupSave(filePath: string): string | null {
  try {
    if (!existsSync(filePath)) return null;
    const backupDir = join(app.getPath('userData'), 'save-backups');
    if (!existsSync(backupDir)) mkdirSync(backupDir, { recursive: true });
    const name = basename(filePath);
    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const dest = join(backupDir, `${stamp}_${name}`);
    copyFileSync(filePath, dest);
    return dest;
  } catch { /* ignore */ }
  return null;
}

export function getSaveDir(emuId: string): string | null {
  const customDirs = settings.get().saveDirectories || {};
  if (customDirs[emuId]) return customDirs[emuId];
  const paths = emulatorSaveDirs(emuId);
  return paths?.saves || null;
}

export { emulatorSaveDirs };

export function guessSavePathFromLabel(label: string): string | null {
  const lower = label.toLowerCase();
  for (const emu of ['retroarch', 'dolphin', 'rpcs3', 'eden', 'pcsx2', 'duckstation', 'flycast', 'ppsspp']) {
    if (lower.includes(emu)) return getSaveDir(emu);
  }
  return null;
}

const EMU_SAVE_META: { id: string; name: string }[] = [
  { id: 'retroarch', name: 'RetroArch' },
  { id: 'dolphin', name: 'Dolphin' },
  { id: 'rpcs3', name: 'RPCS3' },
  { id: 'eden', name: 'Eden' },
  { id: 'pcsx2', name: 'PCSX2' },
  { id: 'duckstation', name: 'DuckStation' },
  { id: 'flycast', name: 'Flycast' },
  { id: 'ppsspp', name: 'PPSSPP' },
];

export function getEmulatorSaveDirs() {
  return EMU_SAVE_META.map(e => ({
    ...e,
    saves: getSaveDir(e.id),
  })).filter(e => e.saves);
}
