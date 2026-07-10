import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { app } from 'electron';
import { ConfigPreset, InstallProgress, Platform } from '../shared/types';
import { getPlatform, isWindows, isMacOS } from './platform';

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
};

// ---- Remote presets URL ----

const presetSourceUrl = 'https://raw.githubusercontent.com/mileswolfallen2/OmniEmu2.0/main/presets.json';

async function fetchRemotePresets(): Promise<Record<string, ConfigPreset[]> | null> {
  try {
    const { get } = await import('https');
    const data = await new Promise<string>((resolve, reject) => {
      get(presetSourceUrl, {
        headers: { 'User-Agent': 'OmniEmu/0.1.1' },
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
  const presets = await getPresets(emulatorId);
  if (presets.length === 0) return false;
  await applyPreset(emulatorId, presets[0], installPath, onProgress);
  return true;
}

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
  }
  return false;
}
