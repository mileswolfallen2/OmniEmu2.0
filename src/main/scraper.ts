import { get as httpsGet } from 'https';
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

export function buildThumbnailUrl(title: string, platform: string): string | undefined {
  const dir = platformThumbDir[platform];
  if (!dir) return undefined;
  const safe = safeTitle(title);
  return `${thumbBase}/${dir}/Named_Boxarts/${safe}.png`;
}

/** Try multiple URL patterns and return the first that resolves */
export async function findValidThumbnail(title: string, platform: string): Promise<string | undefined> {
  const dir = platformThumbDir[platform];
  if (!dir) return undefined;

  const urls: string[] = [];
  const safe = safeTitle(title);
  // Try with and without region info
  const regionStripped = title.replace(/\([^)]*\)/g, '').trim();
  const safeStripped = safeTitle(regionStripped);

  const basePaths = [`${thumbBase}/${dir}`];
  const subdirs = ['Named_Boxarts', 'Named_Snaps'];
  const titles = new Set<string>();

  if (safe) titles.add(safe);
  if (safeStripped && safeStripped !== safe) titles.add(safeStripped);

  for (const base of basePaths) {
    for (const sub of subdirs) {
      for (const t of titles) {
        urls.push(`${base}/${sub}/${t}.png`);
      }
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
    const req = httpsGet(url, { method: 'HEAD' }, (res) => {
      resolve(res.statusCode === 200);
    });
    req.on('error', () => resolve(false));
    req.setTimeout(5000, () => { req.destroy(); resolve(false); });
  });
}

/** Track a game launch in the recent games list */
export function addRecentGame(games: GameEntry[], game: GameEntry, max: number = 10): GameEntry[] {
  const updated = [game, ...games.filter(g => g.romPath !== game.romPath)];
  return updated.slice(0, max);
}
