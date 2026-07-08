import { existsSync, mkdirSync, writeFileSync, readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { app } from 'electron';
import { ConfigPreset, InstallProgress, Platform } from '../shared/types';
import { getPlatform, isWindows, isMacOS } from './platform';

const platform = getPlatform();

/**
 * Built-in recommended presets for each emulator.
 * These are known-good configs curated by the EmuDeck community and
 * adapted for OmniEmu. They set optimal performance/quality balances.
 */
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
  ryujinx: [
    {
      name: 'OmniEmu Recommended',
      description: 'Best settings for Ryujinx Switch emulation',
      files: {
        'Config.json': `{
  "graphics_backend": "Vulkan",
  "resolution_scale": 2,
  "docked_mode": true,
  "anisotropy_filtering": 4,
  "aspect_ratio": "16:9",
  "enable_vsync": true,
  "shader_cache": true,
  "audio_backend": "OpenAL"
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
input_driver = "udev"
video_fullscreen = true
video_vsync = true
video_scale_integer = false
video_smooth = true
audio_sync = true
savestate_thumbnail_enable = true
notification_show_autoconfig = false
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
`,
      },
    },
  ],
};

const presetSourceUrl = 'https://raw.githubusercontent.com/mileswolfallen2/omniemu-presets/main/presets.json';

/** Fetch remote presets, falling back to built-in */
async function fetchRemotePresets(): Promise<Record<string, ConfigPreset[]> | null> {
  try {
    const { get } = await import('https');
    const data = await new Promise<string>((resolve, reject) => {
      get(presetSourceUrl, (res) => {
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

export function getBuiltInPresets(): Record<string, ConfigPreset[]> {
  return builtInPresets;
}

export async function getPresets(emulatorId: string): Promise<ConfigPreset[]> {
  // Try remote first, fall back to built-in
  const remote = await fetchRemotePresets();
  if (remote && remote[emulatorId]) return remote[emulatorId];
  return builtInPresets[emulatorId] || [];
}

/** Get the config directory for an emulator given its install path */
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
    ryujinx: {
      win32: join(process.env.APPDATA || '', 'Ryujinx'),
      darwin: join(require('os').homedir(), 'Library', 'Application Support', 'Ryujinx'),
      linux: join(require('os').homedir(), '.config', 'Ryujinx'),
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
  };
  return platformDirs[emulatorId]?.[platform] || dirname(installPath);
}

/** Check if an emulator has been configured with OmniEmu presets */
export function checkConfigured(emulatorId: string, installPath?: string): boolean {
  if (!installPath) return false;
  const marker = join(app.getPath('userData'), 'configs', `${emulatorId}.configured`);
  return existsSync(marker);
}

/** Apply a config preset to the emulator's config directory */
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

  // Write marker so we know this emulator was configured
  const markerDir = join(app.getPath('userData'), 'configs');
  if (!existsSync(markerDir)) mkdirSync(markerDir, { recursive: true });
  writeFileSync(join(markerDir, `${emulatorId}.configured`), new Date().toISOString(), 'utf-8');

  report(100, `${emulatorId} configured with "${preset.name}"`);
}

/** Apply the recommended preset (first preset available) */
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
