import { get as httpsGet, request as httpsRequest } from 'https';
import { createHash } from 'crypto';
import { createReadStream, readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { app } from 'electron';
import { createGunzip } from 'zlib';
import type { RetroAchievement, AchievementInfo } from '../shared/types';

// Platform -> RA console ID mapping
const raConsoleIds: Record<string, number> = {
  nes: 7, snes: 3, n64: 2, gb: 4, gbc: 6, gba: 5,
  nds: 18, gc: 16, wii: 19,
  ps1: 12, ps2: 20, ps3: 41, psp: 24,
  pce: 8,
  'sega-md': 1, 'sega-saturn': 28, 'sega-dc': 27,
  dreamcast: 27, arcade: 99,
};

/** Platforms where RetroAchievements is actually supported and has a decent game count */
export const raSupportedPlatforms = new Set(Object.keys(raConsoleIds));

const userAgent = 'OmniEmu/0.3.3';

function fetchText(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const req = httpsGet(url, {
      headers: { 'User-Agent': userAgent, 'Accept-Encoding': 'gzip, deflate' },
      timeout: 15000,
    }, (res) => {
      const encoding = res.headers['content-encoding'];
      let stream: NodeJS.ReadableStream = res;
      if (encoding === 'gzip') {
        stream = res.pipe(createGunzip());
      }
      const chunks: Buffer[] = [];
      stream.on('data', (chunk: Buffer) => chunks.push(chunk));
      stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
      stream.on('error', reject);
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
  });
}

function postForm(url: string, body: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const req = httpsRequest(url, {
      method: 'POST',
      headers: {
        'User-Agent': userAgent,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(body),
        'Accept-Encoding': 'gzip, deflate',
      },
      timeout: 15000,
    }, (res) => {
      const encoding = res.headers['content-encoding'];
      let stream: NodeJS.ReadableStream = res;
      if (encoding === 'gzip') {
        stream = res.pipe(createGunzip());
      }
      const chunks: Buffer[] = [];
      stream.on('data', (chunk: Buffer) => chunks.push(chunk));
      stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
      stream.on('error', reject);
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
    req.write(body);
    req.end();
  });
}

function computeMD5(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = createHash('md5');
    const stream = createReadStream(filePath);
    stream.on('data', (d: string | Buffer) => hash.update(d));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', reject);
  });
}

// ---- Cached game list for each console ----

interface RaGameListEntry {
  id: number;
  title: string;
}

interface GameListCache {
  [consoleId: number]: RaGameListEntry[];
}

function gameListCachePath(): string {
  const dir = join(app.getPath('userData'), 'cache');
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return join(dir, 'ra-game-list-cache.json');
}

function readGameListCache(): GameListCache {
  try {
    return JSON.parse(readFileSync(gameListCachePath(), 'utf-8'));
  } catch { return {}; }
}

function writeGameListCache(cache: GameListCache): void {
  try { writeFileSync(gameListCachePath(), JSON.stringify(cache, null, 2), 'utf-8'); } catch { /* */ }
}

async function fetchGameList(consoleId: number, apiKey: string, username: string): Promise<RaGameListEntry[]> {
  const url = `https://retroachievements.org/API/API_GetGameList.php?z=${encodeURIComponent(username)}&y=${encodeURIComponent(apiKey)}&c=${consoleId}`;
  const json = await fetchText(url);
  let data: any;
  try { data = JSON.parse(json); } catch { return []; }
  if (!Array.isArray(data)) return [];
  return data.map((g: any) => ({ id: g.ID, title: g.Title }));
}

async function getGameList(consoleId: number, apiKey: string, username: string): Promise<RaGameListEntry[]> {
  const cache = readGameListCache();
  if (cache[consoleId] && cache[consoleId].length > 0) return cache[consoleId];
  const list = await fetchGameList(consoleId, apiKey, username);
  if (list.length > 0) {
    cache[consoleId] = list;
    writeGameListCache(cache);
  }
  return list;
}

function normalizeTitle(title: string): string {
  return title.toLowerCase()
    .replace(/\b(the|a|an|and|of|in|to|for)\b/g, '')
    .replace(/[^a-z0-9]/g, '')
    .replace(/\s+/g, '')
    .trim();
}

function findGameIdByTitle(gameList: RaGameListEntry[], title: string): number | undefined {
  const search = normalizeTitle(title);
  // Exact match first
  const exact = gameList.find(g => normalizeTitle(g.title) === search);
  if (exact) return exact.id;
  // Contains match
  const contains = gameList.find(g => normalizeTitle(g.title).includes(search) || search.includes(normalizeTitle(g.title)));
  if (contains) return contains.id;
  // Prefix match (first 8 chars)
  const prefix = search.slice(0, 8);
  const prefixMatch = gameList.find(g => normalizeTitle(g.title).slice(0, 8) === prefix);
  return prefixMatch?.id;
}

// ---- Main API ----

/** Look up RA game ID by ROM hash (Connect API) */
async function lookupGameIdByHash(romPath: string, username: string): Promise<number | null> {
  try {
    const hash = await computeMD5(romPath);
    const body = `r=gameid&m=${hash}&u=${encodeURIComponent(username)}`;
    const response = await postForm('https://retroachievements.org/dorequest.php', body);
    const parsed = JSON.parse(response);
    console.log('[ra] hash lookup response:', JSON.stringify(parsed).slice(0, 200));
    if (parsed.Success && (parsed.ID || parsed.GameID)) return parsed.ID || parsed.GameID;
    return null;
  } catch (err) {
    console.error('[ra] hash lookup error:', err);
    return null;
  }
}

/** Look up RA game ID by title + platform (Web API) */
async function lookupGameIdByTitle(
  title: string, platform: string, apiKey: string, username: string
): Promise<number | null> {
  const consoleId = raConsoleIds[platform];
  if (!consoleId) return null;
  try {
    const list = await getGameList(consoleId, apiKey, username);
    if (list.length === 0) return null;
    const id = findGameIdByTitle(list, title);
    return id ?? null;
  } catch {
    return null;
  }
}

/** Fetch achievements + user progress from the RA Web API */
async function fetchAchievements(
  gameId: number, apiKey: string, username: string
): Promise<AchievementInfo | null> {
  try {
    const url = `https://retroachievements.org/API/API_GetGameInfoAndUserProgress.php`
      + `?z=${encodeURIComponent(username)}&y=${encodeURIComponent(apiKey)}`
      + `&g=${gameId}&u=${encodeURIComponent(username)}`;
    const json = await fetchText(url);
    const data = JSON.parse(json);
    if (!data || !data.Achievements) return null;

    const achievements: RetroAchievement[] = Object.values(data.Achievements).map((a: any) => ({
      id: a.ID,
      title: a.Title,
      description: a.Description,
      points: a.Points,
      badgeName: a.BadgeName,
      dateEarned: a.DateEarned || undefined,
      dateEarnedHardcore: a.DateEarnedHardcore || undefined,
    }));

    return {
      gameId: data.ID,
      gameTitle: data.Title,
      consoleName: data.ConsoleName,
      totalAchievements: achievements.length,
      totalPoints: achievements.reduce((sum, a) => sum + a.points, 0),
      userProgress: achievements.filter(a => a.dateEarned).length,
      achievements,
    };
  } catch (err) {
    console.error('[ra] fetchAchievements error:', err);
    return null;
  }
}

/** High-level function: get achievements for a game */
export async function getGameAchievements(
  romPath: string, title: string, platform: string,
  apiKey: string, username: string
): Promise<AchievementInfo | null> {
  if (!apiKey || !username) return null;

  // Try hash-based lookup first
  let gameId = await lookupGameIdByHash(romPath, username);

  // Fall back to title-based lookup
  if (!gameId) {
    gameId = await lookupGameIdByTitle(title, platform, apiKey, username);
  }

  if (!gameId) return null;

  return fetchAchievements(gameId, apiKey, username);
}
