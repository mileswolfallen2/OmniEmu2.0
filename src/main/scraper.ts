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
    const req = httpsGet(url, { headers: { 'User-Agent': 'OmniEmu/0.3.1' }, timeout: 10000 }, (res) => {
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
      headers: { 'User-Agent': 'OmniEmu/0.3.1' },
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

/** Save cover URLs to cache (empty string removes the entry) */
export function cacheCovers(entries: { romPath: string; coverUrl: string }[]): void {
  const cache = readCache();
  for (const e of entries) {
    if (e.coverUrl) {
      cache[e.romPath] = e.coverUrl;
    } else {
      delete cache[e.romPath];
    }
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

const mobygamesUA = 'Mozilla/5.0 (compatible; OmniEmu/0.3.1; +https://github.com/mileswolfallen2/OmniEmu2.0)';

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

// ---- SteamGridDB cover art search ----

export interface SGDBSearchResult {
  id: number;
  name: string;
  url: string;
  width: number;
  height: number;
  thumb: string;
}

/** Platform ID mapping for SteamGridDB */
const sgdbPlatformMap: Record<string, number> = {
  nes: 3, snes: 4, n64: 6, gb: 9, gbc: 10, gba: 11, nds: 13,
  ps1: 28, ps2: 29, ps3: 30, psp: 31,
  gc: 17, wii: 18, switch: 146,
  'sega-md': 29, 'sega-saturn': 29, dreamcast: 17,
  arcade: 52, pce: 15,
};

function sgdbFetch(url: string, apiKey: string, retries = 2): Promise<string> {
  return new Promise((resolve, reject) => {
    const req = httpsGet(url, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'User-Agent': 'OmniEmu/0.3.1',
      },
      timeout: 10000,
    }, (res) => {
      let data = '';
      res.on('data', (chunk: string) => data += chunk);
      res.on('end', () => {
        if (res.statusCode === 429 && retries > 0) {
          const retryAfter = parseInt(res.headers['retry-after'] as string) || 5;
          setTimeout(() => {
            sgdbFetch(url, apiKey, retries - 1).then(resolve, reject);
          }, retryAfter * 1000);
          return;
        }
        if (res.statusCode && res.statusCode >= 400) {
          reject(new Error(`SGDB ${res.statusCode}: ${data}`));
        } else {
          resolve(data);
        }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
  });
}

function sgdbDownloadBuffer(url: string, apiKey: string, retries = 2): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const req = httpsGet(url, {
      headers: {
        'User-Agent': 'OmniEmu/0.3.1',
      },
      timeout: 15000,
    }, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (chunk: Buffer) => chunks.push(chunk));
      res.on('end', () => {
        if (res.statusCode === 429 && retries > 0) {
          const retryAfter = parseInt(res.headers['retry-after'] as string) || 5;
          setTimeout(() => {
            sgdbDownloadBuffer(url, apiKey, retries - 1).then(resolve, reject);
          }, retryAfter * 1000);
          return;
        }
        if (res.statusCode && res.statusCode >= 400) {
          reject(new Error(`SGDB download ${res.statusCode}`));
        } else {
          resolve(Buffer.concat(chunks));
        }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
  });
}

function sgdbCacheDir(): string {
  const dir = join(app.getPath('userData'), 'cache', 'sgdb');
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return dir;
}

/** Download a remote image to local cache, return file:// path */
async function downloadToCache(remoteUrl: string, filename: string, apiKey: string): Promise<string> {
  const buf = await sgdbDownloadBuffer(remoteUrl, apiKey);
  const ext = remoteUrl.includes('.png') ? '.png' : remoteUrl.includes('.jpg') ? '.jpg' : '.webp';
  const safeName = filename.replace(/[^a-zA-Z0-9_-]/g, '_');
  const localPath = join(sgdbCacheDir(), `${safeName}${ext}`);
  writeFileSync(localPath, buf);
  return `file://${localPath}`;
}

/** Search SteamGridDB for cover art options — returns local file:// paths */
export async function searchSteamGridDB(
  title: string,
  platform: string,
  apiKey: string
): Promise<SGDBSearchResult[]> {
  if (!apiKey) return [];

  const q = encodeURIComponent(title.trim());
  const searchUrl = `https://www.steamgriddb.com/api/v2/search/autocomplete/${q}`;

  try {
    const html = await sgdbFetch(searchUrl, apiKey);
    const parsed = JSON.parse(html);
    if (!parsed.data || !Array.isArray(parsed.data) || parsed.data.length === 0) return [];

    const game = parsed.data[0];
    if (!game || !game.id) return [];

    const artUrl = `https://www.steamgriddb.com/api/v2/grids/game/${game.id}?dimensions=600x900`;
    const artHtml = await sgdbFetch(artUrl, apiKey);
    const artParsed = JSON.parse(artHtml);
    if (!artParsed.data || !Array.isArray(artParsed.data)) return [];

    const results: SGDBSearchResult[] = [];
    const items = artParsed.data.slice(0, 20);
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const remoteThumb = item.thumb || item.url || '';
      if (!remoteThumb) continue;
      try {
        const localPath = await downloadToCache(remoteThumb, `sgdb_${game.id}_${item.id}`, apiKey);
        results.push({
          id: item.id,
          name: item.name || 'Cover',
          url: remoteThumb,
          width: item.width || 0,
          height: item.height || 0,
          thumb: localPath,
        });
      } catch {
        results.push({
          id: item.id,
          name: item.name || 'Cover',
          url: remoteThumb,
          width: item.width || 0,
          height: item.height || 0,
          thumb: '',
        });
      }
      if (i < items.length - 1) {
        await new Promise(r => setTimeout(r, 100));
      }
    }
    return results;
  } catch (e: any) {
    const msg = e?.message || String(e);
    if (msg.includes('429')) {
      console.error('SteamGridDB rate limited — try again in a minute');
      throw new Error('Rate limited by SteamGridDB. Try again in a minute.');
    }
    console.error('SteamGridDB search failed:', e);
    throw new Error(`SteamGridDB search failed: ${msg}`);
  }
}
