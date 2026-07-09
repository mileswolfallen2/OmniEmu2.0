import { existsSync, readdirSync, statSync } from 'fs';
import { join, extname } from 'path';
import { app } from 'electron';

export interface BiosEntry {
  /** Emulator(s) that need this BIOS */
  emulators: string[];
  /** Platform it belongs to */
  platform: string;
  /** Known filenames (any match counts) */
  files: string[];
  /** Friendly name */
  name: string;
  /** Optional MD5 hash (not checked currently) */
  md5?: string;
  /** Size in bytes (for validation) */
  size?: number;
}

const knownBiosFiles: BiosEntry[] = [
  {
    emulators: ['duckstation', 'retroarch'],
    platform: 'ps1',
    files: ['scph5500.bin', 'scph5501.bin', 'scph5502.bin'],
    name: 'PlayStation BIOS',
    size: 524288,
  },
  {
    emulators: ['duckstation', 'retroarch'],
    platform: 'ps1',
    files: ['scph1001.bin', 'scph3000.bin', 'scph7001.bin', 'scph7502.bin'],
    name: 'PlayStation BIOS (alt)',
  },
  {
    emulators: ['pcsx2'],
    platform: 'ps2',
    files: ['scph39001.bin', 'scph70012.bin', 'scph77001.bin', 'scph90001.bin', 'PS2_ROM.BIN', 'PS2DRV.BIN'],
    name: 'PlayStation 2 BIOS',
  },
  {
    emulators: ['rpcs3'],
    platform: 'ps3',
    files: ['PS3UPDAT.PUP'],
    name: 'PlayStation 3 Firmware',
  },
  {
    emulators: ['retroarch'],
    platform: 'sega-md',
    files: ['bios_MD.bin', 'bios_SegaCD.bin', 'bios_U.bin', 'bios_E.bin', 'bios_J.bin'],
    name: 'Sega Mega Drive / CD BIOS',
  },
  {
    emulators: ['retroarch'],
    platform: 'sega-saturn',
    files: ['sega_101.bin', 'mpr-17933.bin', 'mpr-17934.bin', 'mpr-17935.bin'],
    name: 'Sega Saturn BIOS',
  },
  {
    emulators: ['retroarch'],
    platform: 'sega-dc',
    files: ['dc_boot.bin', 'dc_flash.bin'],
    name: 'Sega Dreamcast BIOS',
  },
  {
    emulators: ['retroarch'],
    platform: 'pce',
    files: ['syscard3.pce', 'syscard2.pce', 'syscard1.pce', 'gexpress.pce'],
    name: 'PC Engine BIOS',
  },
  {
    emulators: ['retroarch'],
    platform: 'nds',
    files: ['bios7.bin', 'bios9.bin', 'firmware.bin'],
    name: 'Nintendo DS BIOS',
  },
  {
    emulators: ['retroarch'],
    platform: 'gba',
    files: ['gba_bios.bin'],
    name: 'Game Boy Advance BIOS',
    size: 16384,
  },
];

export function getKnownBiosList(): BiosEntry[] {
  return knownBiosFiles;
}

export interface BiosCheckResult {
  entry: BiosEntry;
  present: boolean;
  foundFiles: string[];
  directory: string;
}

/** Scan a directory for known BIOS files */
export function scanBiosDirectory(biosDir: string): BiosCheckResult[] {
  if (!existsSync(biosDir)) {
    return knownBiosFiles.map(entry => ({
      entry,
      present: false,
      foundFiles: [],
      directory: biosDir,
    }));
  }

  const files: string[] = [];
  try {
    const scan = (dir: string) => {
      const entries = readdirSync(dir, { withFileTypes: true });
      for (const e of entries) {
        const full = join(dir, e.name);
        if (e.isDirectory()) scan(full);
        else files.push(e.name.toLowerCase());
      }
    };
    scan(biosDir);
  } catch { /* ignore */ }

  return knownBiosFiles.map(entry => {
    const foundFiles = entry.files.filter(f => files.includes(f.toLowerCase()));
    return {
      entry,
      present: foundFiles.length > 0,
      foundFiles,
      directory: biosDir,
    };
  });
}

/** Get the default BIOS directory */
export function getDefaultBiosDir(): string {
  const home = require('os').homedir();
  const candidates = [
    join(home, 'OmniEmu', 'bios'),
    join(home, 'Library', 'Application Support', 'RetroArch', 'system'),
    join(app.getPath('userData'), 'bios'),
  ];
  for (const dir of candidates) {
    if (existsSync(dir)) return dir;
  }
  return candidates[0];
}

/** Update RetroArch config to point system_directory at the BIOS folder */
export function updateRetroarchBiosPath(configDir: string, biosDir: string): boolean {
  const cfgPath = join(configDir, 'retroarch.cfg');
  if (!existsSync(configDir)) return false;

  let content = '';
  if (existsSync(cfgPath)) {
    content = require('fs').readFileSync(cfgPath, 'utf-8');
  }

  const lines = content.split('\n').filter(l =>
    !l.startsWith('system_directory') && !l.trim().startsWith('system_directory')
  );
  lines.push(`system_directory = "${biosDir}"`);

  require('fs').writeFileSync(cfgPath, lines.join('\n'), 'utf-8');
  return true;
}
