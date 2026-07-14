import { existsSync, readdirSync, statSync, unlinkSync, copyFileSync, mkdirSync } from 'fs';
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

function emulatorSaveDirs(emuId: string): SaveDirConfig | null {
  const configs: Record<string, SaveDirConfig> = {
    retroarch: {
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
    },
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
  '.save', '.Save',
  '.SVS',
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

function scanDir(dir: string): SaveEntry[] {
  if (!existsSync(dir)) return [];
  const entries: SaveEntry[] = [];
  try {
    const files = readdirSync(dir);
    for (const file of files) {
      const fullPath = join(dir, file);
      try {
        const st = statSync(fullPath);
        if (!st.isFile()) continue;
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
