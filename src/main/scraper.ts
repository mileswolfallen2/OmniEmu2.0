import { get as httpsGet, request as httpsRequest } from 'https';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { app } from 'electron';
import { GameEntry, GameMetadata } from '../shared/types';

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
    const req = httpsGet(url, { headers: { 'User-Agent': 'OmniEmu/0.1.3' }, timeout: 10000 }, (res) => {
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
      headers: { 'User-Agent': 'OmniEmu/0.1.3' },
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

// ---- Metadata scraping ----

interface MetadataCache {
  [romPath: string]: GameMetadata;
}

function metadataCachePath(): string {
  const dir = join(app.getPath('userData'), 'cache');
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return join(dir, 'metadata-cache.json');
}

function readMetadataCache(): MetadataCache {
  try {
    return JSON.parse(readFileSync(metadataCachePath(), 'utf-8'));
  } catch {
    return {};
  }
}

function writeMetadataCache(cache: MetadataCache): void {
  try {
    writeFileSync(metadataCachePath(), JSON.stringify(cache, null, 2), 'utf-8');
  } catch { /* ignore */ }
}

export function getCachedMetadata(romPath: string): GameMetadata | undefined {
  return readMetadataCache()[romPath];
}

export function cacheMetadata(romPath: string, metadata: GameMetadata): void {
  const cache = readMetadataCache();
  cache[romPath] = metadata;
  writeMetadataCache(cache);
}

const mobygamesUA = 'Mozilla/5.0 (compatible; OmniEmu/0.1.3; +https://github.com/mileswolfallen2/OmniEmu2.0)';

function mobyFetch(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const req = httpsRequest(url, {
      method: 'GET',
      headers: { 'User-Agent': mobygamesUA },
      timeout: 15000,
    }, (res) => {
      let data = '';
      res.on('data', (chunk: string) => data += chunk);
      res.on('end', () => resolve(data));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
    req.end();
  });
}

function buildMobySearchUrl(title: string): string {
  const q = encodeURIComponent(title.trim());
  return `https://www.mobygames.com/search/quick?q=${q}&search=Go`;
}

async function searchMobyGames(title: string): Promise<string | null> {
  try {
    const html = await mobyFetch(buildMobySearchUrl(title));
    const match = html.match(/<a[^>]*href="(\/game\/[^"]+)"[^>]*>/i)
      || html.match(/href="(\/game\/[^"]+)"/i);
    if (match) return `https://www.mobygames.com${match[1]}`;
    return null;
  } catch {
    return null;
  }
}

async function scrapeMobyPage(url: string): Promise<GameMetadata | null> {
  try {
    const html = await mobyFetch(url);

    // Description
    let description: string | undefined;
    const descMatch = html.match(/<div[^>]*class="[^"]*description[^"]*"[^>]*>([\s\S]*?)<\/div>/i)
      || html.match(/<meta[^>]*name="description"[^>]*content="([^"]+)"/i);
    if (descMatch) {
      description = descMatch[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
    }

    // Release year
    let year: number | undefined;
    const yearMatch = html.match(/Released[:\s]+([A-Za-z]+)\s+(\d{4})/i)
      || html.match(/Released[:\s]+(\d{4})/i)
      || html.match(/(\d{4})\s*\)/); // " (2024)"
    if (yearMatch) {
      const y = parseInt(yearMatch[yearMatch[2] ? 2 : 1]);
      if (y > 1970 && y < 2030) year = y;
    }

    // Genre
    let genre: string | undefined;
    const genreMatch = html.match(/Genre[:\s]+([^<]+)/i)
      || html.match(/<dt>Genre<\/dt>\s*<dd>([^<]+)/i);
    if (genreMatch) {
      genre = genreMatch[1].replace(/&amp;/g, '&').trim();
    }

    // Publisher
    let publisher: string | undefined;
    const pubMatch = html.match(/Publisher[:\s]+([^<]+)/i)
      || html.match(/<dt>Publisher<\/dt>\s*<dd>([^<]+)/i)
      || html.match(/Published by[:\s]+([^<]+)/i);
    if (pubMatch) {
      publisher = pubMatch[1].replace(/&amp;/g, '&').trim();
    }

    // Screenshots
    const screenshots: string[] = [];
    const imgRegex = /<img[^>]*src="([^"]+)"[^>]*>/gi;
    let imgMatch;
    while ((imgMatch = imgRegex.exec(html)) !== null) {
      const src = imgMatch[1];
      if (src.includes('screenshot') || src.includes('/screens/') || src.includes('/shots/')) {
        const fullUrl = src.startsWith('http') ? src : `https://www.mobygames.com${src}`;
        screenshots.push(fullUrl);
      }
    }

    return {
      description,
      year,
      genre,
      publisher,
      screenshots: screenshots.slice(0, 10),
    };
  } catch {
    return null;
  }
}

/** Try to get a screenshot from libretro Named_Snaps (reliable, same source as covers) */
async function tryLibretroScreenshots(title: string, platform: string): Promise<string[]> {
  const dir = platformThumbDir[platform];
  if (!dir) return [];

  const titles = new Set<string>();
  titles.add(safeTitle(title));
  const stripped = title.replace(/\([^)]*\)/g, '').trim();
  const safeStripped = safeTitle(stripped);
  if (safeStripped && safeStripped !== safeTitle(title)) titles.add(safeStripped);

  const results: string[] = [];
  for (const t of titles) {
    const url = buildEncodedUrl(dir, 'Named_Snaps', t);
    try {
      const valid = await urlExists(url);
      if (valid) results.push(url);
    } catch { /* skip */ }
  }
  return results;
}

export async function scrapeGameMetadata(romPath: string, title: string, platform: string): Promise<GameMetadata> {
  // Check cache first
  const cached = getCachedMetadata(romPath);
  if (cached) return cached;

  // Try MobyGames
  let metadata: GameMetadata | null = null;
  const gameUrl = await searchMobyGames(title);
  if (gameUrl) {
    metadata = await scrapeMobyPage(gameUrl);
  }

  // Try libretro screenshots as fallback
  let screenshots = metadata?.screenshots || [];
  if (screenshots.length === 0) {
    screenshots = await tryLibretroScreenshots(title, platform);
  }

  const result: GameMetadata = {
    description: metadata?.description,
    year: metadata?.year,
    genre: metadata?.genre,
    publisher: metadata?.publisher,
    screenshots, rating: metadata?.rating,
  };

  // Cache and return
  cacheMetadata(romPath, result);
  return result;
}
