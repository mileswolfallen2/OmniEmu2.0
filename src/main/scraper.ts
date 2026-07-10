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
  'dreamcast': 'Sega_-_Dreamcast',
};

function safeTitle(title: string): string {
  return title.replace(/[:]/g, '').replace(/[/\\?*]/g, '_').trim();
}

function buildEncodedUrl(dir: string, subdir: string, title: string): string {
  const safe = safeTitle(title);
  const raw = `${thumbBase}/${dir}/${subdir}/${safe}.png`;
  return encodeURI(raw);
}

function buildMobyGamesUrl(title: string): string {
  const q = encodeURIComponent(title.trim());
  return `https://www.mobygames.com/search/quick?q=${q}&search=Go`;
}

async function tryFetchImage(url: string): Promise<string | undefined> {
  try {
    const valid = await urlExists(url);
    if (valid) return url;
  } catch { /* skip */ }
  return undefined;
}

async function tryMobyGames(title: string): Promise<string | undefined> {
  const searchUrl = buildMobyGamesUrl(title);
  try {
    const html = await fetchText(searchUrl);
    // Extract first game cover image from search results
    const match = html.match(/<img[^>]*class="[^"]*cover[^"]*"[^>]*src="([^"]+)"/i)
      || html.match(/<img[^>]*src="([^"]+)"[^>]*alt="[^"]*Cover[^"]*"/i);
    if (match) {
      const imgUrl = match[1].startsWith('http') ? match[1] : `https://www.mobygames.com${match[1]}`;
      const valid = await urlExists(imgUrl);
      if (valid) return imgUrl;
    }
  } catch { /* skip */ }
  return undefined;
}

/** Try multiple URL patterns and return the first valid URL */
export async function findValidThumbnail(title: string, platform: string): Promise<string | undefined> {
  // Source 1: libretro-thumbnails
  const dir = platformThumbDir[platform];
  if (dir) {
    const subdirs = ['Named_Boxarts', 'Named_Snaps', 'Named_Titles', 'Named_Logos'];
    const titles = new Set<string>();

    titles.add(safeTitle(title));
    // Without region codes
    const stripped = title.replace(/\([^)]*\)/g, '').trim();
    const safeStripped = safeTitle(stripped);
    if (safeStripped && safeStripped !== safeTitle(title)) titles.add(safeStripped);

    for (const sub of subdirs) {
      for (const t of titles) {
        const url = buildEncodedUrl(dir, sub, t);
        const result = await tryFetchImage(url);
        if (result) return result;
      }
    }
  }

  // Source 2: MobyGames (generic)
  const mbResult = await tryMobyGames(title);
  if (mbResult) return mbResult;

  return undefined;
}

function fetchText(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const req = httpsGet(url, { headers: { 'User-Agent': 'OmniEmu/0.1.2' }, timeout: 10000 }, (res) => {
      let data = '';
      res.on('data', (chunk: string) => data += chunk);
      res.on('end', () => resolve(data));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
  });
}

function urlExists(url: string): Promise<boolean> {
  return new Promise((resolve) => {
    const req = httpsGet(url, {
      method: 'GET',
      headers: { 'User-Agent': 'OmniEmu/0.1.2' },
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
