import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { get as httpsGet } from 'https';
import { getRetroArchConfigDir } from './configurator';

export interface FilterPreset {
  id: string;
  name: string;
  description: string;
  /** Keys to set in retroarch.cfg */
  cfgOverrides: Record<string, string>;
  /** Keys to remove from retroarch.cfg */
  cfgRemove?: string[];
}

export const FILTER_PRESETS: FilterPreset[] = [
  {
    id: 'none',
    name: 'None (Default)',
    description: 'No shader or filter — raw pixels as the game intended.',
    cfgOverrides: {
      video_smooth: 'false',
      video_scale_integer: 'false',
    },
    cfgRemove: ['video_shader'],
  },
  {
    id: 'pixel-perfect',
    name: 'Pixel Perfect',
    description: 'Integer-scaled pixels with no smoothing. Sharp and crisp at native multiples.',
    cfgOverrides: {
      video_smooth: 'false',
      video_scale_integer: 'true',
    },
    cfgRemove: ['video_shader'],
  },
  {
    id: 'smooth',
    name: 'Smooth (Bilinear)',
    description: 'Bilinear filtering for a softer, modern look. Good for 3D games.',
    cfgOverrides: {
      video_smooth: 'true',
      video_scale_integer: 'false',
    },
    cfgRemove: ['video_shader'],
  },
  {
    id: 'crt-geom',
    name: 'CRT (Geometry)',
    description: 'Classic CRT curvature and phosphor glow. Best for 2D retro games.',
    cfgOverrides: {
      video_smooth: 'false',
      video_scale_integer: 'false',
    },
  },
];

function readRetroarchCfg(cfgPath: string): string[] {
  if (!existsSync(cfgPath)) return [];
  return readFileSync(cfgPath, 'utf-8').split('\n');
}

function writeRetroarchCfg(cfgPath: string, lines: string[]): void {
  writeFileSync(cfgPath, lines.filter(l => l.trim() !== '').join('\n') + '\n', 'utf-8');
}

function httpsGetBuffer(url: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const req = httpsGet(url, {
      headers: { 'User-Agent': 'OmniEmu/0.3.2' },
      timeout: 15000,
    }, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        const loc = res.headers.location;
        if (loc) { httpsGetBuffer(loc).then(resolve, reject); return; }
      }
      const chunks: Buffer[] = [];
      res.on('data', (chunk: Buffer) => chunks.push(chunk));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
  });
}

async function downloadCrtShader(configDir: string): Promise<string | null> {
  const shadersDir = join(configDir, 'shaders');
  if (!existsSync(shadersDir)) mkdirSync(shadersDir, { recursive: true });

  const crtDir = join(shadersDir, 'crt');
  if (!existsSync(crtDir)) mkdirSync(crtDir, { recursive: true });

  const presetPath = join(crtDir, 'crt-geom.slangp');
  if (existsSync(presetPath)) return presetPath;

  const base = 'https://raw.githubusercontent.com/libretro/slang-shaders/master/crt';

  try {
    const [presetBuf, shaderBuf] = await Promise.all([
      httpsGetBuffer(`${base}/crt-geom.slangp`),
      httpsGetBuffer(`${base}/crt-geom.slang`),
    ]);
    writeFileSync(presetPath, presetBuf);
    writeFileSync(join(crtDir, 'crt-geom.slang'), shaderBuf);

    // Try to download commonly referenced helper shaders (non-fatal if missing)
    const helpers = ['linearize.slang', 'corner.slang', 'glass.slang', 'ntsc-pass1.slang', 'ntsc-pass2.slang'];
    for (const h of helpers) {
      try {
        const buf = await httpsGetBuffer(`${base}/${h}`);
        writeFileSync(join(crtDir, h), buf);
      } catch { /* ok */ }
    }

    return presetPath;
  } catch (err) {
    console.error('[filters] failed to download CRT shader:', err);
    return null;
  }
}

export interface ApplyFilterResult {
  success: boolean;
  message: string;
  appliedPreset: string;
}

export async function applyFilterPreset(presetId: string): Promise<ApplyFilterResult> {
  const preset = FILTER_PRESETS.find(p => p.id === presetId);
  if (!preset) return { success: false, message: 'Unknown filter preset', appliedPreset: '' };

  const configDir = getRetroArchConfigDir();
  if (!existsSync(configDir)) {
    mkdirSync(configDir, { recursive: true });
  }

  const cfgPath = join(configDir, 'retroarch.cfg');
  let lines = readRetroarchCfg(cfgPath);

  // Remove old filter keys
  const removeKeys = [
    ...(preset.cfgRemove || []),
    ...FILTER_PRESETS.flatMap(p => Object.keys(p.cfgOverrides)),
    'video_shader',
  ];
  lines = lines.filter(l => {
    const trimmed = l.trim();
    if (trimmed.startsWith('#') || trimmed === '') return true;
    const key = trimmed.split(/[= ]/)[0]?.trim();
    return key ? !removeKeys.includes(key) : true;
  });

  // Apply new overrides (unquoted values for RetroArch config parser)
  for (const [key, value] of Object.entries(preset.cfgOverrides)) {
    lines.push(`${key} = ${value}`);
  }

  // Download CRT shader if needed
  if (preset.id === 'crt-geom') {
    const shaderPath = await downloadCrtShader(configDir);
    if (shaderPath) {
      lines.push(`video_shader = ${shaderPath}`);
    } else {
      writeRetroarchCfg(cfgPath, lines);
      return {
        success: true,
        message: 'Applied CRT settings (shader download failed — using fallback config)',
        appliedPreset: preset.name,
      };
    }
  }

  writeRetroarchCfg(cfgPath, lines);
  return { success: true, message: `Applied "${preset.name}" filter`, appliedPreset: preset.name };
}
