import { get as httpsGet } from 'https';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { app } from 'electron';
import { GameEntry } from '../shared/types';

/** Clean a filename into a display title */
export function parseGameTitle(filename: string): string {
  let name = filename.replace(/\.[^.]+$/, '');
  name = name.replace(/\([^)]*\)/g, '');
  name = name.replace(/\[[^\]]*\]/g, '');
  name = name.replace(/[._]/g, ' ');
  name = name.replace(/\s+/g, ' ').trim();
  return name;
}

/** Build a scrape-friendly title (keeps region info like (World), (USA), etc.) */
export function buildScrapeTitle(filename: string): string {
  let name = filename.replace(/\.[^.]+$/, '');
  name = name.replace(/\[[^\]]*\]/g, '');
  name = name.replace(/[._]/g, ' ');
  name = name.replace(/[!]/g, '');
  name = name.replace(/\s+/g, ' ').trim();
  return name;
}

const thumbBase = 'https://raw.githubusercontent.com/libretro-thumbnails/libretro-thumbnails/master';

const platformThumbDir: Record<string, string> = {
  'nes': 'Nintendo_-_Nintendo_Entertainment_System',
  'snes': 'Nintendo_-_Super_Nintendo_Entertainment_System',
  'n64': 'Nintendo_-_Nintendo_64',
  'gba': 'Nintendo_-_Game_Boy_Advance',
  'gb': 'Nintendo_-_Game_Boy',
  'gbc': 'Nintendo_-_Game_Boy_Color',
  'nds': 'Nintendo_-_Nintendo_DS',
  'switch': 'Nintendo_-_Nintendo_Switch',
  'ps1': 'Sony_-_PlayStation',
  'ps2': 'Sony_-_PlayStation_2',
  'ps3': 'Sony_-_PlayStation_3',
  'psp': 'Sony_-_PSP',
  'pce': 'NEC_-_PC_Engine_-_TurboGrafx_16',
  'sega-md': 'Sega_-_Mega_Drive_-_Genesis',
  'sega-saturn': 'Sega_-_Saturn',
  'sega-dc': 'Sega_-_Dreamcast',
  'gc': 'Nintendo_-_GameCube',
  'wii': 'Nintendo_-_Wii',
  'arcade': 'MAME',
};

function safeTitle(title: string): string {
  return title.replace(/[:]/g, '').replace(/[/\\?*]/g, '_').trim();
}

/** Build a properly URL-encoded thumbnail URL */
function buildEncodedUrl(dir: string, subdir: string, title: string): string {
  const safe = safeTitle(title);
  const raw = `${thumbBase}/${dir}/${subdir}/${safe}.png`;
  return encodeURI(raw);
}

/** Try multiple URL patterns via GET and return the first valid URL */
export async function findValidThumbnail(title: string, platform: string): Promise<string | undefined> {
  const dir = platformThumbDir[platform];
  if (!dir) return undefined;

  const urls: string[] = [];
  const subdirs = ['Named_Boxarts', 'Named_Snaps'];
  const titles = new Set<string>();

  // Try raw title (with region codes)
  titles.add(safeTitle(title));
  // Try title without region codes
  const stripped = title.replace(/\([^)]*\)/g, '').trim();
  const safeStripped = safeTitle(stripped);
  if (safeStripped && safeStripped !== safeTitle(title)) titles.add(safeStripped);

  for (const sub of subdirs) {
    for (const t of titles) {
      urls.push(buildEncodedUrl(dir, sub, t));
    }
  }

  for (const url of urls) {
    try {
      const valid = await urlExists(url);
      if (valid) return url;
    } catch { /* try next */ }
  }
  return undefined;
}

function urlExists(url: string): Promise<boolean> {
  return new Promise((resolve) => {
    const req = httpsGet(url, {
      method: 'GET',
      headers: { 'User-Agent': 'OmniEmu/0.1.0' },
      timeout: 10000,
    }, (res) => {
      // GitHub raw returns 200 for existing or redirects to it
      resolve(res.statusCode === 200);
      res.resume(); // drain response
    });
    req.on('error', () => resolve(false));
    req.on('timeout', () => { req.destroy(); resolve(false); });
  });
}

// --- Scrape Cache ---

interface ScrapeCache {
  [key: string]: string; // "romPath" -> "coverUrl"
}

function cachePath(): string {
  const dir = join(app.getPath('userData'), 'cache');
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return join(dir, 'scrape-cache.json');
}

function readCache(): ScrapeCache {
  try {
    return JSON.parse(readFileSync(cachePath(), 'utf-8'));
  } catch {
    return {};
  }
}

function writeCache(cache: ScrapeCache): void {
  try {
    writeFileSync(cachePath(), JSON.stringify(cache, null, 2), 'utf-8');
  } catch { /* ignore */ }
}

/** Get cached cover URL for a ROM */
export function getCachedCover(romPath: string): string | undefined {
  return readCache()[romPath];
}

/** Save cover URLs to cache */
export function cacheCovers(entries: { romPath: string; coverUrl: string }[]): void {
  const cache = readCache();
  for (const e of entries) {
    if (e.coverUrl) cache[e.romPath] = e.coverUrl;
  }
  writeCache(cache);
}

/** Apply cached covers to an array of GameEntry objects (mutates in place) */
export function applyCachedCovers(entries: GameEntry[]): GameEntry[] {
  const cache = readCache();
  for (const entry of entries) {
    const cached = cache[entry.romPath];
    if (cached) entry.coverUrl = cached;
  }
  return entries;
}

/** Track a game launch in the recent games list */
export function addRecentGame(games: GameEntry[], game: GameEntry, max: number = 10): GameEntry[] {
  const updated = [game, ...games.filter(g => g.romPath !== game.romPath)];
  return updated.slice(0, max);
}
