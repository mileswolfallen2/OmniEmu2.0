import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { app } from 'electron';
import { AppSettings } from '../shared/types';

const SETTINGS_FILE = 'settings.json';

function getSettingsPath(): string {
  return join(app.getPath('userData'), SETTINGS_FILE);
}

const defaultSettings: AppSettings = {
  romsDirectory: '',
  emulatorsDirectory: '',
  theme: 'dark',
  minimiseToTray: true,
  launchInFullscreen: false,
  closeToTray: true,
  presetSourceUrl: 'https://raw.githubusercontent.com/mileswolfallen2/omniemu-presets/main/presets.json',
};

let cached: AppSettings | null = null;

export const settings = {
  get(): AppSettings {
    if (cached) return { ...cached };

    const settingsPath = getSettingsPath();
    try {
      const data = readFileSync(settingsPath, 'utf-8');
      cached = { ...defaultSettings, ...JSON.parse(data) };
    } catch {
      cached = { ...defaultSettings };
      settings.save(cached);
    }

    return { ...cached! };
  },

  save(s: Partial<AppSettings>): AppSettings {
    const current = settings.get();
    cached = { ...current, ...s };

    const settingsPath = getSettingsPath();
    const dir = dirname(settingsPath);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

    writeFileSync(settingsPath, JSON.stringify(cached, null, 2), 'utf-8');
    return { ...cached };
  },

  reset(): AppSettings {
    cached = { ...defaultSettings };
    const settingsPath = getSettingsPath();
    writeFileSync(settingsPath, JSON.stringify(cached, null, 2), 'utf-8');
    return { ...cached };
  },
};
