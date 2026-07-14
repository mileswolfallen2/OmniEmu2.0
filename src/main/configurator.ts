import { existsSync, mkdirSync, writeFileSync, readFileSync, readdirSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { app } from 'electron';
import { ConfigPreset, InstallProgress, Platform } from '../shared/types';
import { getPlatform, isWindows, isMacOS } from './platform';
import { knownEmulators, checkEmulator } from './emulators';
import { settings } from './settings';

const platform = getPlatform();

// ---- Built-in presets ----

const builtInPresets: Record<string, ConfigPreset[]> = {
  dolphin: [
    {
      name: 'OmniEmu Recommended',
      description: 'Best balance of performance and quality for most systems',
      files: {
        'Config/Dolphin.ini': `[General]
LastFilename =
ShowLag = False
ShowRenderTimes = False
[Display]
FullscreenDisplayRes = Auto
Fullscreen = True
RenderToMain = True
[Interface]
ConfirmStop = False
PauseOnFocusLost = False
[Core]
CPUCore = 3
Fastmem = True
MMU = False
[Enhancements]
InternalResolution = 3
MaxAnisotropy = 4
[Android]
SIDevice0 = 6
AdapterRumble0 = True
`,
        'Config/GFX.ini': `[Settings]
Backend = Vulkan
ShaderCompilationMode = 2
WaitForShadersBeforeStarting = True
HiresTextures = False
CacheHiresTextures = True
[Enhancements]
ForceFiltering = False
WidescreenHack = True
`,
      },
    },
  ],
  rpcs3: [
    {
      name: 'OmniEmu Recommended',
      description: 'Optimized settings for RPCS3 with Vulkan backend',
      files: {
        'config.yml': `Video:
  Format: Vulkan
  FrameLimit: Auto
  Resolution: 1920x1080
  AntiAliasing: Disabled
  RenderScale: 100
Audio:
  Format: XAudio2
  Device: Default
Input:
  PadHandler: DualShock4
  MouseHandler: Basic
CPU:
  PPUDecoder: LLVM
  SPUDecoder: ASMJIT
  ThreadScheduler: OS
`,
      },
    },
  ],
  eden: [
    {
      name: 'OmniEmu Recommended',
      description: 'Best settings for Eden Switch emulation',
      files: {
        'Config.json': `{
  "graphics_backend": "Vulkan",
  "resolution_scale": 2,
  "docked_mode": true,
  "anisotropy_filtering": 4,
  "aspect_ratio": "16:9",
  "enable_vsync": true,
  "shader_cache": true,
  "audio_backend": "OpenAL",
  "controller": "SDL"
}`,
      },
    },
  ],
  pcsx2: [
    {
      name: 'OmniEmu Recommended',
      description: 'Optimal PCSX2 configuration for modern hardware',
      files: {
        'inis/PCSX2.ini': `[Filenames]
[Settings]
UserMode = 0
EnableVSync = 1
[EmuCore]
GSRenderer = 13
EnableCheats = 0
EnableWideScreenPatches = 1
[GS]
Renderer = Vulkan
UpscaleMultiplier = 3
BilinearFilter = 1
TrilinearFilter = 1
[Pad]
MultitapPort0_Enabled = false
MultitapPort1_Enabled = false
Pad1 = SDL
`,
      },
    },
  ],
  retroarch: [
    {
      name: 'OmniEmu Recommended',
      description: 'Universal RetroArch config with optimal defaults',
      files: {
        'retroarch.cfg': `video_driver = "vulkan"
audio_driver = "pulseaudio"
video_fullscreen = true
video_vsync = true
video_scale_integer = false
video_smooth = true
audio_sync = true
savestate_thumbnail_enable = true
notification_show_autoconfig = false
input_autodetect_enable = "true"
input_player1_joypad_index = "0"
# Default cores per system
nes_default_core = "nestopia_libretro"
snes_default_core = "snes9x_libretro"
n64_default_core = "mupen64plus_next_libretro"
gb_default_core = "gambatte_libretro"
gbc_default_core = "gambatte_libretro"
gba_default_core = "mgba_libretro"
nds_default_core = "melonds_libretro"
`,
      },
    },
    {
      name: 'OmniEmu Performance',
      description: 'Performance-focused RetroArch config',
      files: {
        'retroarch.cfg': `video_driver = "vulkan"
audio_driver = "pulseaudio"
video_fullscreen = true
video_threaded = true
video_vsync = false
video_max_swapchain_images = 2
video_scale_integer = false
video_smooth = false
audio_sync = false
audio_rate_control = false
rewind_enable = false
savestate_auto_load = false
savestate_auto_save = false
input_autodetect_enable = "true"
input_player1_joypad_index = "0"
`,
      },
    },
  ],
  mame: [
    {
      name: 'OmniEmu Recommended',
      description: 'MAME optimized settings',
      files: {
        'mame.ini': `#
# OmniEmu Recommended MAME Config
#
video auto
screen auto
aspect 4:3
effect none
waitvsync 1
syncrefresh 0
sleep 0
autosave 0
joystick 1
keyboard 0
`,
      },
    },
  ],
  duckstation: [
    {
      name: 'OmniEmu Recommended',
      description: 'Optimal DuckStation settings for PS1 emulation',
      files: {
        'settings.ini': `[General]
UserMode = 0
StartFullscreen = True
[Display]
RenderToMain = True
Fullscreen = True
VSync = True
[GPU]
Renderer = Vulkan
ResolutionScale = 3
Multisamples = 1
PGXPEnable = True
PGXPCulling = True
WidescreenHack = True
[Input]
ControllerBackend = SDL
[ControllerPort0]
MultitapPort1 = false
`,
      },
    },
  ],
  flycast: [
    {
      name: 'OmniEmu Recommended',
      description: 'Optimal Flycast settings for Dreamcast emulation',
      files: {
        'emu.cfg': `[config]
renderer = vulkan
fullscreen = yes
vsync = yes
auto_region = yes
cable_type = vga
broadcast = ntsc
frameskip = 0
[network]
enable = no
[input]
enable_mouse = no
`,
      },
    },
  ],
  melonds: [
    {
      name: 'OmniEmu Recommended',
      description: 'Optimized melonDS settings',
      files: {
        'melonDS.ini': `[General]
fullscreen = 1
[Video]
renderer = OpenGL
vsync = 1
[Audio]
volume = 100
[Controls]
`,
      },
    },
  ],
  esde: [
    {
      name: 'OmniEmu Recommended',
      description: 'Pre-configures ES-DE with your ROM directory and installed emulators',
      files: {},
    },
  ],
  neostation: [
    {
      name: 'OmniEmu Recommended',
      description: 'Pre-configures NeoStation with your ROM directory and installed emulators',
      files: {},
    },
  ],
  pegasus: [
    {
      name: 'OmniEmu Recommended',
      description: 'Generates Pegasus collection files for all your ROMs with correct launch commands',
      files: {},
    },
  ],
};

// ---- Remote presets URL ----

const presetSourceUrl = 'https://raw.githubusercontent.com/mileswolfallen2/OmniEmu2.0/main/presets.json';

async function fetchRemotePresets(): Promise<Record<string, ConfigPreset[]> | null> {
  try {
    const { get } = await import('https');
    const data = await new Promise<string>((resolve, reject) => {
      get(presetSourceUrl, {
        headers: { 'User-Agent': 'OmniEmu/0.3.1' },
        timeout: 10000,
      }, (res) => {
        if (res.statusCode !== 200) { reject(new Error(`HTTP ${res.statusCode}`)); return; }
        const chunks: Buffer[] = [];
        res.on('data', (c: Buffer) => chunks.push(c));
        res.on('end', () => resolve(Buffer.concat(chunks).toString()));
      }).on('error', reject);
    });
    return JSON.parse(data);
  } catch {
    return null;
  }
}

/** Load presets from a local file in userData (user can drop their own presets.json there) */
function loadLocalPresets(): Record<string, ConfigPreset[]> | null {
  const localPath = join(app.getPath('userData'), 'presets.json');
  try {
    return JSON.parse(readFileSync(localPath, 'utf-8'));
  } catch {
    return null;
  }
}

function isPSController(name?: string): boolean {
  if (!name) return false;
  const l = name.toLowerCase();
  return l.includes('dualsense') || l.includes('dualshock') || l.includes('sony')
    || l.includes('ps4') || l.includes('ps5') || l.includes('playstation');
}

function isXboxController(name?: string): boolean {
  if (!name) return false;
  const l = name.toLowerCase();
  return l.includes('xbox') || l.includes('x-input') || l.includes('microsoft');
}

// ---- Exported API ----

export function getBuiltInPresets(): Record<string, ConfigPreset[]> {
  return builtInPresets;
}

export async function getPresets(emulatorId: string): Promise<ConfigPreset[]> {
  // Priority: remote > local file > built-in
  const remote = await fetchRemotePresets();
  if (remote && remote[emulatorId]) return remote[emulatorId];
  const local = loadLocalPresets();
  if (local && local[emulatorId]) return local[emulatorId];
  return builtInPresets[emulatorId] || [];
}

function getConfigDir(emulatorId: string, installPath: string): string {
  const platformDirs: Record<string, Record<string, string>> = {
    dolphin: {
      win32: join(process.env.APPDATA || join(require('os').homedir(), 'AppData', 'Roaming'), 'Dolphin'),
      darwin: join(require('os').homedir(), 'Library', 'Application Support', 'Dolphin'),
      linux: join(require('os').homedir(), '.config', 'dolphin-emu'),
    },
    rpcs3: {
      win32: join(process.env.APPDATA || '', 'RPCS3'),
      darwin: join(require('os').homedir(), 'Library', 'Application Support', 'rpcs3'),
      linux: join(require('os').homedir(), '.config', 'rpcs3'),
    },
    pcsx2: {
      win32: join(process.env.APPDATA || '', 'PCSX2'),
      darwin: join(require('os').homedir(), 'Library', 'Application Support', 'PCSX2'),
      linux: join(require('os').homedir(), '.config', 'PCSX2'),
    },
    retroarch: {
      win32: join(process.env.APPDATA || '', 'RetroArch'),
      darwin: join(require('os').homedir(), 'Library', 'Application Support', 'RetroArch'),
      linux: join(require('os').homedir(), '.config', 'retroarch'),
    },
    mame: {
      win32: dirname(installPath),
      darwin: dirname(installPath),
      linux: join(require('os').homedir(), '.mame'),
    },
    duckstation: {
      win32: join(process.env.APPDATA || '', 'duckstation'),
      darwin: join(require('os').homedir(), 'Library', 'Application Support', 'DuckStation'),
      linux: join(require('os').homedir(), '.config', 'duckstation'),
    },
    eden: {
      win32: join(process.env.APPDATA || '', 'Eden'),
      darwin: join(require('os').homedir(), 'Library', 'Application Support', 'Eden'),
      linux: join(require('os').homedir(), '.config', 'Eden'),
    },
    flycast: {
      win32: join(process.env.APPDATA || '', 'flycast'),
      darwin: join(require('os').homedir(), 'Library', 'Application Support', 'flycast'),
      linux: join(require('os').homedir(), '.config', 'flycast'),
    },
    melonds: {
      win32: join(process.env.APPDATA || '', 'melonDS'),
      darwin: join(require('os').homedir(), 'Library', 'Application Support', 'melonDS'),
      linux: join(require('os').homedir(), '.config', 'melonDS'),
    },
    esde: {
      win32: join(require('os').homedir(), 'ES-DE'),
      darwin: join(require('os').homedir(), 'ES-DE'),
      linux: join(require('os').homedir(), 'ES-DE'),
    },
    neostation: {
      win32: join(process.env.LOCALAPPDATA || join(require('os').homedir(), 'AppData', 'Local'), 'neostation'),
      darwin: join(require('os').homedir(), 'Library', 'Application Support', 'neostation'),
      linux: join(require('os').homedir(), '.local', 'share', 'neostation'),
    },
    pegasus: {
      win32: join(process.env.LOCALAPPDATA || join(require('os').homedir(), 'AppData', 'Local'), 'pegasus-frontend'),
      darwin: join(require('os').homedir(), 'Library', 'Preferences', 'pegasus-frontend'),
      linux: join(require('os').homedir(), '.config', 'pegasus-frontend'),
    },
  };
  return platformDirs[emulatorId]?.[platform] || dirname(installPath);
}

export function checkConfigured(emulatorId: string, installPath?: string): boolean {
  if (!installPath) return false;
  const marker = join(app.getPath('userData'), 'configs', `${emulatorId}.configured`);
  return existsSync(marker);
}

export async function applyPreset(
  emulatorId: string,
  preset: ConfigPreset,
  installPath: string,
  onProgress?: (p: InstallProgress) => void
): Promise<void> {
  const configDir = getConfigDir(emulatorId, installPath);
  const report = onProgress
    ? (percent: number, message: string) =>
        onProgress({ emulatorId, stage: 'configuring', percent, message })
    : () => {};

  report(0, `Configuring ${emulatorId} with "${preset.name}"...`);

  const totalFiles = Object.keys(preset.files).length;
  let done = 0;

  for (const [relativePath, content] of Object.entries(preset.files)) {
    const fullPath = join(configDir, relativePath);
    const parentDir = dirname(fullPath);

    if (!existsSync(parentDir)) {
      mkdirSync(parentDir, { recursive: true });
    }
    writeFileSync(fullPath, content, 'utf-8');

    done++;
    report(Math.round((done / totalFiles) * 100), `Wrote ${relativePath}`);
  }

  const markerDir = join(app.getPath('userData'), 'configs');
  if (!existsSync(markerDir)) mkdirSync(markerDir, { recursive: true });
  writeFileSync(join(markerDir, `${emulatorId}.configured`), new Date().toISOString(), 'utf-8');

  report(100, `${emulatorId} configured with "${preset.name}"`);
}

export async function applyRecommendedConfig(
  emulatorId: string,
  installPath: string,
  onProgress?: (p: InstallProgress) => void
): Promise<boolean> {
  if (emulatorId === 'esde') {
    return configureEsde(installPath, onProgress);
  }
  if (emulatorId === 'neostation') {
    return configureNeostation(installPath, onProgress);
  }
  if (emulatorId === 'pegasus') {
    return configurePegasus(installPath, onProgress);
  }
  const presets = await getPresets(emulatorId);
  if (presets.length === 0) return false;
  await applyPreset(emulatorId, presets[0], installPath, onProgress);
  return true;
}

// ---- ES-DE Configuration ----

/** Map OmniEmu emulator IDs to ES-DE find-rules emulator names */
const esdeEmulatorNames: Record<string, string> = {
  retroarch: 'RETROARCH',
  dolphin: 'DOLPHIN',
  rpcs3: 'RPCS3',
  pcsx2: 'PCSX2',
  duckstation: 'DUCKSTATION',
  mame: 'MAME',
  ppsspp: 'PPSSPP',
  melonds: 'MELONDS',
  flycast: 'FLYCAST',
  eden: 'EDEN',
};

function getEsdeEmulatorName(emulatorId: string): string | undefined {
  return esdeEmulatorNames[emulatorId];
}

function generateEsFindRules(): string {
  const lines: string[] = [
    '<?xml version="1.0"?>',
    '<!-- ES-DE find rules generated by OmniEmu -->',
    '<ruleList>',
  ];

  for (const emu of knownEmulators) {
    if (emu.id === 'esde') continue;
    const esdeName = getEsdeEmulatorName(emu.id);
    if (!esdeName) continue;

    const state = checkEmulator(emu.id);
    if (!state.installed || !state.path) continue;

    lines.push(`    <emulator name="${esdeName}">`);
    lines.push('        <rule type="staticpath">');
    lines.push(`            <entry>${state.path}</entry>`);
    lines.push('        </rule>');
    lines.push('    </emulator>');
  }

  lines.push('</ruleList>');
  return lines.join('\n');
}

function generateEsSettingsXml(romDir: string, mediaDir: string): string {
  return [
    '<?xml version="1.0"?>',
    '<!-- ES-DE settings generated by OmniEmu -->',
    '<viewSettings>',
    `    <string name="ROMDirectory" value="${romDir}" />`,
    `    <string name="MediaDirectory" value="${mediaDir}" />`,
    '</viewSettings>',
  ].join('\n');
}

async function configureEsde(
  installPath: string,
  onProgress?: (p: InstallProgress) => void
): Promise<boolean> {
  const report = onProgress
    ? (percent: number, message: string) =>
        onProgress({ emulatorId: 'esde', stage: 'configuring', percent, message })
    : () => {};

  report(0, 'Configuring ES-DE...');

  const esdeConfigDir = getConfigDir('esde', installPath);
  const settingsDir = join(esdeConfigDir, 'settings');
  const customSystemsDir = join(esdeConfigDir, 'custom_systems');

  if (!existsSync(settingsDir)) mkdirSync(settingsDir, { recursive: true });
  if (!existsSync(customSystemsDir)) mkdirSync(customSystemsDir, { recursive: true });

  report(25, 'Writing ES-DE settings...');

  const romDir = settings.get().romsDirectory || join(require('os').homedir(), 'Documents', 'roms');
  const mediaDir = join(esdeConfigDir, 'downloaded_media');

  const settingsXml = generateEsSettingsXml(romDir, mediaDir);
  writeFileSync(join(settingsDir, 'es_settings.xml'), settingsXml, 'utf-8');

  report(50, 'Writing emulator find rules...');

  const findRules = generateEsFindRules();
  writeFileSync(join(customSystemsDir, 'es_find_rules.xml'), findRules, 'utf-8');

  report(75, 'Creating media directory...');

  if (!existsSync(mediaDir)) mkdirSync(mediaDir, { recursive: true });

  report(100, 'ES-DE configured');

  const markerDir = join(app.getPath('userData'), 'configs');
  if (!existsSync(markerDir)) mkdirSync(markerDir, { recursive: true });
  writeFileSync(join(markerDir, 'esde.configured'), new Date().toISOString(), 'utf-8');

  return true;
}

// ---- NeoStation Configuration ----

function generateNeostationConfig(romDir: string): string {
  const emulatorsDir = settings.get().emulatorsDirectory || join(app.getPath('userData'), 'emulators');

  // Build emulator paths map from installed emulators
  const emulatorPaths: Record<string, string> = {};
  for (const emu of knownEmulators) {
    if (emu.id === 'neostation' || emu.id === 'esde') continue;
    const state = checkEmulator(emu.id);
    if (state.installed && state.path) {
      emulatorPaths[emu.id] = state.path;
    }
  }

  return JSON.stringify({
    roms_directory: romDir,
    emulators_directory: emulatorsDir,
    emulators: emulatorPaths,
  }, null, 2);
}

async function configureNeostation(
  installPath: string,
  onProgress?: (p: InstallProgress) => void
): Promise<boolean> {
  const report = onProgress
    ? (percent: number, message: string) =>
        onProgress({ emulatorId: 'neostation', stage: 'configuring', percent, message })
    : () => {};

  report(0, 'Configuring NeoStation...');

  const configDir = getConfigDir('neostation', installPath);
  if (!existsSync(configDir)) mkdirSync(configDir, { recursive: true });

  report(25, 'Writing NeoStation configuration...');

  const romDir = settings.get().romsDirectory || join(require('os').homedir(), 'Documents', 'roms');
  const configContent = generateNeostationConfig(romDir);
  writeFileSync(join(configDir, 'omniemu_config.json'), configContent, 'utf-8');

  report(50, 'Discovering installed emulators...');

  // Create symlinks to ROM directories for NeoStation to discover
  const romsLink = join(configDir, 'roms');
  try {
    if (!existsSync(romsLink)) {
      const { symlinkSync } = require('fs');
      symlinkSync(romDir, romsLink);
    }
  } catch { /* ignore if symlink fails */ }

  report(75, 'Finalizing...');

  report(100, 'NeoStation configured');

  const markerDir = join(app.getPath('userData'), 'configs');
  if (!existsSync(markerDir)) mkdirSync(markerDir, { recursive: true });
  writeFileSync(join(markerDir, 'neostation.configured'), new Date().toISOString(), 'utf-8');

  return true;
}

// ---- Pegasus Frontend Configuration ----

interface PegasusSystemMeta {
  name: string;
  shortname: string;
  extensions: string[];
}

const pegasusSystemMeta: Record<string, PegasusSystemMeta> = {
  nes:           { name: 'Nintendo Entertainment System', shortname: 'nes', extensions: ['nes', 'fds'] },
  snes:          { name: 'Super Nintendo Entertainment System', shortname: 'snes', extensions: ['smc', 'sfc', 'fig', 'swc'] },
  n64:           { name: 'Nintendo 64', shortname: 'n64', extensions: ['n64', 'z64', 'v64'] },
  gb:            { name: 'Game Boy', shortname: 'gb', extensions: ['gb'] },
  gbc:           { name: 'Game Boy Color', shortname: 'gbc', extensions: ['gbc'] },
  gba:           { name: 'Game Boy Advance', shortname: 'gba', extensions: ['gba'] },
  nds:           { name: 'Nintendo DS', shortname: 'nds', extensions: ['nds'] },
  ps1:           { name: 'PlayStation', shortname: 'psx', extensions: ['bin', 'cue', 'iso', 'chd', 'pbp'] },
  ps2:           { name: 'PlayStation 2', shortname: 'ps2', extensions: ['iso', 'bin', 'chd', 'gz'] },
  ps3:           { name: 'PlayStation 3', shortname: 'ps3', extensions: ['iso'] },
  psp:           { name: 'PlayStation Portable', shortname: 'psp', extensions: ['iso', 'cso', 'pbp'] },
  gc:            { name: 'GameCube', shortname: 'gamecube', extensions: ['gcm', 'gcz', 'iso', 'rvz'] },
  wii:           { name: 'Wii', shortname: 'wii', extensions: ['wbfs', 'iso', 'gcz', 'rvz'] },
  switch:        { name: 'Nintendo Switch', shortname: 'switch', extensions: ['nsp', 'xci'] },
  arcade:        { name: 'Arcade', shortname: 'arcade', extensions: ['zip', '7z'] },
  dreamcast:     { name: 'Sega Dreamcast', shortname: 'dreamcast', extensions: ['gdi', 'cdi', 'chd'] },
  'sega-md':     { name: 'Sega Mega Drive', shortname: 'genesis', extensions: ['bin', 'md', 'smd'] },
  'sega-saturn': { name: 'Sega Saturn', shortname: 'saturn', extensions: ['bin', 'cue', 'chd'] },
  pce:           { name: 'PC Engine', shortname: 'pce', extensions: ['pce'] },
};

function getPegasusLaunchCommand(emulatorPath: string, emulatorId: string): string {
  const fp = '{file.path}';
  const esc = (s: string) => `"${s}"`;
  switch (emulatorId) {
    case 'retroarch': {
      const core = isWindows() ? '_libretro.dll' : '_libretro.so';
      return esc(emulatorPath) + ' -L ' + esc('{core_dir}/' + core) + ' ' + esc(fp);
    }
    case 'dolphin':   return esc(emulatorPath) + ' --exec=' + esc(fp);
    case 'rpcs3':     return esc(emulatorPath) + ' ' + esc(fp);
    case 'pcsx2':     return esc(emulatorPath) + ' ' + esc(fp);
    case 'duckstation':return esc(emulatorPath) + ' ' + esc(fp);
    case 'mame':      return esc(emulatorPath) + ' ' + esc(fp);
    case 'flycast':   return esc(emulatorPath) + ' ' + esc(fp);
    case 'melonDS':   return esc(emulatorPath) + ' ' + esc(fp);
    case 'eden':      return esc(emulatorPath) + ' ' + esc(fp);
    case 'ppsspp':    return esc(emulatorPath) + ' ' + esc(fp);
    default:          return esc(emulatorPath) + ' ' + esc(fp);
  }
}

function generatePegasusCollection(systemId: string, romDir: string, launchCmd: string): string {
  const meta = pegasusSystemMeta[systemId];
  if (!meta) return '';

  const systemDir = join(romDir, systemId);
  const lines: string[] = [];

  lines.push(`collection: ${meta.name}`);
  lines.push(`shortname: ${meta.shortname}`);
  lines.push(`extensions: ${meta.extensions.join(', ')}`);
  lines.push(`launch: ${launchCmd}`);
  lines.push('');

  // Scan for ROM files in this system directory
  if (existsSync(systemDir)) {
    try {
      const files = readdirSync(systemDir);
      for (const file of files) {
        const filePath = join(systemDir, file);
        const stat = statSync(filePath);
        if (!stat.isFile()) continue;

        const ext = file.split('.').pop()?.toLowerCase() || '';
        if (!meta.extensions.includes(ext)) continue;

        const title = file.replace(/\.[^/.]+$/, '').replace(/ \(.*\)$/, '');

        lines.push(`game: ${title}`);
        lines.push(`file: ${file}`);
        lines.push(`launch: ${launchCmd}`);
        lines.push('');
      }
    } catch { /* skip unreadable */ }
  }

  return lines.join('\n');
}

/** Generate Pegasus collection files in each ROM subdirectory. Called on app startup. */
export function generatePegasusCollectionsForRomDir(romDir: string): void {
  if (!existsSync(romDir)) return;

  const emuPaths: Record<string, string> = {};
  for (const emu of knownEmulators) {
    if (emu.id === 'pegasus' || emu.id === 'esde' || emu.id === 'neostation' || emu.id === 'emubuddy') continue;
    const state = checkEmulator(emu.id);
    if (state.installed && state.path) {
      emuPaths[emu.id] = state.path;
    }
  }
  const defaultEmu = emuPaths['retroarch'] || Object.values(emuPaths)[0] || 'retroarch';

  const emuPrefs: Record<string, string> = {
    nes: 'retroarch', snes: 'retroarch', n64: 'retroarch',
    gb: 'retroarch', gbc: 'retroarch', gba: 'retroarch', nds: 'retroarch',
    ps1: 'duckstation', ps2: 'pcsx2', psp: 'ppsspp',
    gc: 'dolphin', wii: 'dolphin', switch: 'eden',
    arcade: 'mame', dreamcast: 'flycast',
    'sega-md': 'retroarch', 'sega-saturn': 'retroarch', pce: 'retroarch',
  };

  for (const [systemId, meta] of Object.entries(pegasusSystemMeta)) {
    const systemDir = join(romDir, systemId);
    if (!existsSync(systemDir)) continue;

    const preferredEmu = emuPrefs[systemId] || 'retroarch';
    const emuPath = emuPaths[preferredEmu] || defaultEmu;
    const launchCmd = getPegasusLaunchCommand(emuPath, preferredEmu);

    const collection = generatePegasusCollection(systemId, romDir, launchCmd);
    if (!collection) continue;

    writeFileSync(join(systemDir, 'metadata.pegasus.txt'), collection, 'utf-8');
  }
}

async function configurePegasus(
  installPath: string,
  onProgress?: (p: InstallProgress) => void
): Promise<boolean> {
  const report = onProgress
    ? (percent: number, message: string) =>
        onProgress({ emulatorId: 'pegasus', stage: 'configuring', percent, message })
    : () => {};

  report(0, 'Configuring Pegasus Frontend...');

  const configDir = getConfigDir('pegasus', installPath);
  const metafilesDir = join(configDir, 'metafiles');
  if (!existsSync(metafilesDir)) mkdirSync(metafilesDir, { recursive: true });

  report(10, 'Scanning ROM directories...');

  const romDir = settings.get().romsDirectory || join(require('os').homedir(), 'Documents', 'roms');

  // Get installed emulator paths
  const emuPaths: Record<string, string> = {};
  for (const emu of knownEmulators) {
    if (emu.id === 'pegasus' || emu.id === 'esde' || emu.id === 'neostation' || emu.id === 'emubuddy') continue;
    const state = checkEmulator(emu.id);
    if (state.installed && state.path) {
      emuPaths[emu.id] = state.path;
    }
  }
  const defaultEmu = emuPaths['retroarch'] || Object.values(emuPaths)[0] || 'retroarch';

  const emuPrefs: Record<string, string> = {
    nes: 'retroarch', snes: 'retroarch', n64: 'retroarch',
    gb: 'retroarch', gbc: 'retroarch', gba: 'retroarch', nds: 'retroarch',
    ps1: 'duckstation', ps2: 'pcsx2', psp: 'ppsspp',
    gc: 'dolphin', wii: 'dolphin', switch: 'eden',
    arcade: 'mame', dreamcast: 'flycast',
    'sega-md': 'retroarch', 'sega-saturn': 'retroarch', pce: 'retroarch',
  };

  report(25, 'Writing collection files to ROM directories...');

  let systemsProcessed = 0;
  const totalSystems = Object.keys(pegasusSystemMeta).length;

  // Write a metadata.pegasus.txt directly into each ROM subdirectory
  for (const [systemId, meta] of Object.entries(pegasusSystemMeta)) {
    systemsProcessed++;
    report(25 + Math.round((systemsProcessed / totalSystems) * 50),
      `Processing ${meta.name}...`);

    const systemDir = join(romDir, systemId);
    if (!existsSync(systemDir)) continue;

    // Pick the best emulator for this system
    const preferredEmu = emuPrefs[systemId] || 'retroarch';
    const emuPath = emuPaths[preferredEmu] || defaultEmu;
    const launchCmd = getPegasusLaunchCommand(emuPath, preferredEmu);

    // Generate collection content for this system
    const collection = generatePegasusCollection(systemId, romDir, launchCmd);
    if (!collection) continue;

    // Write metadata.pegasus.txt directly into the ROM subdirectory
    writeFileSync(join(systemDir, 'metadata.pegasus.txt'), collection, 'utf-8');

    // Also write a copy to Pegasus's central metafiles dir as backup
    writeFileSync(join(metafilesDir, `${systemId}.pegasus.txt`), collection, 'utf-8');
  }

  report(80, 'Writing Pegasus settings...');

  // Point Pegasus at the ROMs directory
  const settingsFile = join(configDir, 'settings.txt');
  const settingsContent = [
    '# Pegasus settings generated by OmniEmu',
    'game_dirs:',
    `  ${romDir}`,
  ].join('\n');
  writeFileSync(settingsFile, settingsContent, 'utf-8');

  report(100, 'Pegasus Frontend configured');

  const markerDir = join(app.getPath('userData'), 'configs');
  if (!existsSync(markerDir)) mkdirSync(markerDir, { recursive: true });
  writeFileSync(join(markerDir, 'pegasus.configured'), new Date().toISOString(), 'utf-8');

  return true;
}

// ---- Controller Configuration ----

/** Write controller config for a given emulator — PS-aware */
export function applyControllerConfig(emulatorId: string, installPath: string, controllerName?: string): boolean {
  const configDir = getConfigDir(emulatorId, installPath);
  if (!existsSync(configDir)) {
    mkdirSync(configDir, { recursive: true });
  }

  const isPS = isPSController(controllerName);
  const isXbox = isXboxController(controllerName);

  switch (emulatorId) {
    case 'retroarch': {
      const cfgPath = join(configDir, 'retroarch.cfg');
      const existing = existsSync(cfgPath) ? readFileSync(cfgPath, 'utf-8') : '';
      const lines = existing.split('\n').filter(l =>
        !l.startsWith('input_player1_joypad_index') &&
        !l.startsWith('input_driver') &&
        !l.startsWith('input_autodetect_enable')
      );
      lines.push('input_player1_joypad_index = "0"');
      lines.push('input_autodetect_enable = "true"');

      if (isMacOS()) lines.push('input_driver = "hid"');
      else if (isWindows()) lines.push('input_driver = "dinput"');
      else lines.push('input_driver = "udev"');

      // PS controller-specific RetroArch bindings
      if (isPS) {
        lines.push('input_player1_a_btn = "1"');
        lines.push('input_player1_b_btn = "2"');
        lines.push('input_player1_x_btn = "0"');
        lines.push('input_player1_y_btn = "3"');
        lines.push(`input_player1_l_btn = "4"`);
        lines.push(`input_player1_r_btn = "5"`);
        lines.push(`input_player1_l2_btn = "6"`);
        lines.push(`input_player1_r2_btn = "7"`);
        lines.push(`input_player1_select_btn = "8"`);
        lines.push(`input_player1_start_btn = "9"`);
      } else if (isXbox) {
        lines.push('input_player1_a_btn = "0"');
        lines.push('input_player1_b_btn = "1"');
        lines.push('input_player1_x_btn = "2"');
        lines.push('input_player1_y_btn = "3"');
        lines.push(`input_player1_l_btn = "4"`);
        lines.push(`input_player1_r_btn = "5"`);
        lines.push(`input_player1_l2_btn = "6"`);
        lines.push(`input_player1_r2_btn = "7"`);
        lines.push(`input_player1_select_btn = "6"`);
        lines.push(`input_player1_start_btn = "7"`);
      }

      writeFileSync(cfgPath, lines.join('\n'), 'utf-8');
      return true;
    }

    case 'duckstation': {
      const iniPath = join(configDir, 'settings.ini');
      const existing = existsSync(iniPath) ? readFileSync(iniPath, 'utf-8') : '';
      const lines = existing.split('\n').filter(l =>
        !l.startsWith('ControllerBackend') &&
        !l.startsWith('MultitapPort1')
      );
      lines.push('[Input]');
      lines.push('ControllerBackend = "SDL"');
      lines.push('[ControllerPort0]');
      lines.push('MultitapPort1 = false');
      writeFileSync(iniPath, lines.join('\n'), 'utf-8');
      return true;
    }

    case 'pcsx2': {
      const iniPath = join(configDir, 'inis', 'PCSX2.ini');
      const dir = dirname(iniPath);
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
      const existing = existsSync(iniPath) ? readFileSync(iniPath, 'utf-8') : '';
      const lines = existing.split('\n').filter(l =>
        !l.startsWith('Multitap') && !l.startsWith('Pad1')
      );
      lines.push('[Pad]');
      lines.push('MultitapPort0_Enabled = false');
      lines.push('MultitapPort1_Enabled = false');
      lines.push(isPS ? 'Pad1 = SDL (DualShock4)' : 'Pad1 = SDL');
      writeFileSync(iniPath, lines.join('\n'), 'utf-8');
      return true;
    }

    case 'dolphin': {
      const iniPath = join(configDir, 'Config', 'Dolphin.ini');
      const dir = dirname(iniPath);
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
      const existing = existsSync(iniPath) ? readFileSync(iniPath, 'utf-8') : '';
      const lines = existing.split('\n').filter(l =>
        !l.startsWith('SIDevice') && !l.startsWith('AdapterRumble')
      );
      lines.push('[Android]');
      // 6 = Standard controller, 12 = DualShock 4
      lines.push(isPS ? 'SIDevice0 = 12' : 'SIDevice0 = 6');
      lines.push('AdapterRumble0 = True');
      writeFileSync(iniPath, lines.join('\n'), 'utf-8');
      return true;
    }

    case 'eden': {
      const cfgPath = join(configDir, 'Config.json');
      let cfg: any = {};
      if (existsSync(cfgPath)) {
        try { cfg = JSON.parse(readFileSync(cfgPath, 'utf-8')); } catch {}
      }
      cfg.controller = isPS ? 'DualShock4' : 'SDL';
      writeFileSync(cfgPath, JSON.stringify(cfg, null, 2), 'utf-8');
      return true;
    }

    case 'rpcs3': {
      const cfgPath = join(configDir, 'config.yml');
      const existing = existsSync(cfgPath) ? readFileSync(cfgPath, 'utf-8') : '';
      const lines = existing.split('\n').filter(l => !l.startsWith('  PadHandler:'));
      lines.push(isPS ? '  PadHandler: DualShock4' : '  PadHandler: SDL');
      writeFileSync(cfgPath, lines.join('\n'), 'utf-8');
      return true;
    }

    case 'mame': {
      const iniPath = join(configDir, 'mame.ini');
      const existing = existsSync(iniPath) ? readFileSync(iniPath, 'utf-8') : '';
      const lines = existing.split('\n').filter(l =>
        !l.startsWith('joystick') && !l.startsWith('keyboard')
      );
      lines.push('joystick 1');
      lines.push('keyboard 0');
      writeFileSync(iniPath, lines.join('\n'), 'utf-8');
      return true;
    }

    case 'flycast': {
      const cfgPath = join(configDir, 'emu.cfg');
      const existing = existsSync(cfgPath) ? readFileSync(cfgPath, 'utf-8') : '';
      const lines = existing.split('\n').filter(l =>
        !l.startsWith('enable_mouse')
      );
      lines.push('[input]');
      lines.push('enable_mouse = no');
      writeFileSync(cfgPath, lines.join('\n'), 'utf-8');
      return true;
    }

    case 'melonds': {
      const iniPath = join(configDir, 'melonDS.ini');
      const existing = existsSync(iniPath) ? readFileSync(iniPath, 'utf-8') : '';
      const lines = existing.split('\n').filter(l =>
        !l.startsWith('fullscreen') && !l.startsWith('JoystickID')
      );
      lines.push('fullscreen = 1');
      lines.push('JoystickID = 0');
      writeFileSync(iniPath, lines.join('\n'), 'utf-8');
      return true;
    }
  }
  return false;
}

async function getRetroAchievementsToken(username: string, password: string): Promise<string | null> {
  try {
    const https = await import('https');
    const { URLSearchParams } = await import('url');
    const params = new URLSearchParams();
    params.append('u', username);
    params.append('p', password);
    params.append('r', 'login');

    const data = await new Promise<string>((resolve, reject) => {
      const body = params.toString();
      const req = https.request('https://retroachievements.org/dorequest.php', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': Buffer.byteLength(body),
        },
        timeout: 15000,
      }, (res: import('http').IncomingMessage) => {
        const chunks: Buffer[] = [];
        res.on('data', (c: Buffer) => chunks.push(c));
        res.on('end', () => resolve(Buffer.concat(chunks).toString()));
      });
      req.on('error', reject);
      req.write(body);
      req.end();
    });

    const parsed = JSON.parse(data);
    if (parsed.Success && parsed.Token) return parsed.Token;
    return null;
  } catch {
    return null;
  }
}

const raEmulatorConfigs: Record<string, {
  file: string;
  enabled: string;
  username: string;
  token: string;
  section?: string;
  extra?: string[];
}> = {
  retroarch: {
    file: 'retroarch.cfg',
    enabled: 'cheevos_enable = "true"',
    username: 'cheevos_username = "%s"',
    token: 'cheevos_token = "%s"',
  },
  pcsx2: {
    file: 'inis/PCSX2.ini',
    section: 'Achievements',
    enabled: 'Enabled = True',
    username: 'Username = %s',
    token: 'Token = %s',
    extra: ['LoginTimestamp = %d'],
  },
  duckstation: {
    file: 'settings.ini',
    section: 'Cheevos',
    enabled: 'Enabled = True',
    username: 'Username = %s',
    token: 'Token = %s',
    extra: ['LoginTimestamp = %d'],
  },
  flycast: {
    file: 'emu.cfg',
    section: 'achievements',
    enabled: 'enable = yes',
    username: 'username = %s',
    token: 'password = %s',
  },
  melonds: {
    file: 'melonDS.ini',
    section: 'Achievements',
    enabled: 'Enabled = 1',
    username: 'Username = %s',
    token: 'Password = %s',
  },
};

export async function applyRetroAchievements(username: string, password: string): Promise<Record<string, boolean>> {
  const results: Record<string, boolean> = {};

  // Try to get a connect token from the RA API
  const token = await getRetroAchievementsToken(username, password);
  // Fall back to using the password directly if API fails
  const effectiveToken = token || password;

  for (const [emuId, cfg] of Object.entries(raEmulatorConfigs)) {
    try {
      const configDir = getConfigDir(emuId, '');
      if (!configDir || configDir === '.') { results[emuId] = false; continue; }

      const filePath = join(configDir, cfg.file);
      const parentDir = dirname(filePath);
      if (!existsSync(parentDir)) mkdirSync(parentDir, { recursive: true });

      let content = '';
      if (existsSync(filePath)) content = readFileSync(filePath, 'utf-8');

      const lines = content.split('\n');

      if (cfg.section) {
        const sectionStart = findOrCreateSection(lines, cfg.section);
        // Remove any existing matching keys in this section
        stripKeysInSection(lines, cfg.section, cfg.enabled.split('=')[0].trim());
        stripKeysInSection(lines, cfg.section, cfg.username.split('=')[0].trim());
        stripKeysInSection(lines, cfg.section, cfg.token.split('=')[0].trim());
        if (cfg.extra) {
          for (const extra of cfg.extra) {
            stripKeysInSection(lines, cfg.section, extra.split('=')[0].trim());
          }
        }
        // Insert new values right after section header
        const insertIdx = lines.findIndex(l => l.trim() === `[${cfg.section}]`) + 1;
        const insertLines = [cfg.enabled, cfg.username.replace('%s', username), cfg.token.replace('%s', effectiveToken)];
        if (cfg.extra) {
          const now = Math.floor(Date.now() / 1000);
          for (const extra of cfg.extra) {
            insertLines.push(extra.replace('%d', String(now)));
          }
        }
        lines.splice(insertIdx, 0, ...insertLines.map(l => l));
      } else {
        // RetroArch-style flat config
        const setLine = (prefix: string, value: string) => {
          const idx = lines.findIndex(l => l.trim().startsWith(prefix));
          if (idx !== -1) lines[idx] = value;
          else lines.push(value);
        };
        // Remove cheevos_password if it exists (token takes precedence)
        const passIdx = lines.findIndex(l => l.trim().startsWith('cheevos_password'));
        if (passIdx !== -1) lines.splice(passIdx, 1);
        setLine('cheevos_enable', cfg.enabled);
        setLine('cheevos_username', cfg.username.replace('%s', username));
        setLine('cheevos_token', cfg.token.replace('%s', effectiveToken));
      }

      writeFileSync(filePath, lines.join('\n'), 'utf-8');
      results[emuId] = true;
    } catch {
      results[emuId] = false;
    }
  }

  return results;
}

function findOrCreateSection(lines: string[], section: string): number {
  const idx = lines.findIndex(l => l.trim() === `[${section}]`);
  if (idx !== -1) return idx;
  lines.push('', `[${section}]`);
  return lines.length - 1;
}

function stripKeysInSection(lines: string[], section: string, key: string): void {
  let inSection = false;
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (trimmed === `[${section}]`) { inSection = true; continue; }
    if (inSection) {
      if (trimmed.startsWith('[')) break;
      if (trimmed.startsWith(key) || trimmed.startsWith(key.toLowerCase()) || trimmed.startsWith(key.charAt(0).toUpperCase() + key.slice(1))) {
        lines.splice(i, 1);
        i--;
      }
    }
  }
}
