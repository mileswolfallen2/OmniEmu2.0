import React, { useEffect, useState, useCallback } from 'react';
import type { GameEntry, DecompState } from '../../shared/types';
import { GameDetailModal } from '../components/GameDetailModal';

const platformIcons: Record<string, string> = {
  nes: '🕹️', snes: '🕹️', n64: '🎮',
  gba: '🎮', gbc: '🎮',
  ps1: '💿', ps2: '💿', ps3: '💿',
  wii: '📀', gc: '📀',
  switch: '🕹️', arcade: '🕹️',
};

export function LibraryPage() {
  const [games, setGames] = useState<GameEntry[]>([]);
  const [decompGames, setDecompGames] = useState<DecompState[]>([]);
  const [decompProjects, setDecompProjects] = useState(false);
  const [loading, setLoading] = useState(false);
  const [romsDir, setRomsDir] = useState<string>('');
  const [selectedGame, setSelectedGame] = useState<GameEntry | null>(null);

  useEffect(() => {
    (async () => {
      const settings = await window.omni.settings.get();
      setDecompProjects(!!settings.decompProjects);
      if (settings.romsDirectory) {
        setRomsDir(settings.romsDirectory);
        setLoading(true);
        const results = await window.omni.roms.scan(settings.romsDirectory);
        setGames(await scrapeMissingArt(results));
        setLoading(false);
      }
      // Load installed decomps
      const decompStates = await window.omni.decomps.states();
      setDecompGames(decompStates.filter(d => d.installed));
    })();
  }, []);

  const scrapeMissingArt = async (list: GameEntry[]): Promise<GameEntry[]> => {
    const updated = await Promise.all(list.map(async (g) => {
      if (!g.coverUrl) {
        const url = await window.omni.game.scrapeArt(g.title, g.platform);
        if (url) g.coverUrl = url;
      }
      return g;
    }));
    // Persist found covers
    const toCache = updated.filter(g => g.coverUrl).map(g => ({ romPath: g.romPath, coverUrl: g.coverUrl! }));
    if (toCache.length > 0) window.omni.game.cacheCovers(toCache);
    return updated;
  };

  const scanDirectory = useCallback(async (dir: string) => {
    setRomsDir(dir);
    setLoading(true);
    await window.omni.settings.save({ romsDirectory: dir });
    const results = await window.omni.roms.scan(dir);
    setGames(await scrapeMissingArt(results));
    setLoading(false);
  }, []);

  const handleScan = useCallback(async () => {
    const dir = await window.omni.roms.selectDirectory();
    if (!dir) return;
    await scanDirectory(dir);
  }, [scanDirectory]);

  const handleLaunch = async (game: GameEntry) => {
    await window.omni.game.launch(game.emulatorId, game.romPath);
  };

  const handleDecompLaunch = async (decomp: DecompState) => {
    if (decomp.romPath) {
      await window.omni.decomps.launch(decomp.config.id);
    }
  };

  const handleShowDetail = (game: GameEntry) => {
    setSelectedGame(game);
  };

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, alignItems: 'center' }}>
        <button className="btn btn-primary" onClick={handleScan}>
          Select ROM Folder
        </button>
        {romsDir && (
          <span className="text-sm text-muted" style={{ padding: '8px 0', maxWidth: 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {romsDir}
          </span>
        )}
      </div>

      {loading && <div className="loading">Scanning for games...</div>}

      {!loading && games.length === 0 && !romsDir && (
        <div className="scan-area" onClick={handleScan}>
          <div style={{ fontSize: 48 }}>📂</div>
          <p>Select a folder to scan for ROMs</p>
          <p className="text-sm text-muted mt-2">
            Your ROM directory will be saved for next time
          </p>
        </div>
      )}

      {!loading && games.length === 0 && romsDir && (
        <div className="empty-state">
          <div className="empty-state-icon">🔍</div>
          <p>No ROMs found in that folder</p>
          <p className="text-sm text-muted mt-2">
            Supported: .nes, .sfc, .n64, .gba, .iso, .wbfs, .nsp, .ps2, .chd, and more
          </p>
          <button className="btn btn-secondary mt-4" onClick={handleScan}>
            Choose another folder
          </button>
        </div>
      )}

      {games.length > 0 && (
        <div>
          <div className="info-bar">
            <span>{games.length} games found</span>
            <div style={{ display: 'flex', gap: 6 }}>
              <button className="btn btn-secondary btn-sm" onClick={async () => {
                setLoading(true);
                setGames(await scrapeMissingArt(games));
                setLoading(false);
              }}>
                Scrape All Art
              </button>
              <button className="btn btn-secondary btn-sm" onClick={handleScan}>
                Rescan
              </button>
            </div>
          </div>

          <div className="library-grid">
            {games.map((game) => (
              <div
                className="game-card"
                key={game.id}
                onClick={() => handleShowDetail(game)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleShowDetail(game); }}
                tabIndex={0}
                role="button"
                title={`View ${game.title}`}
              >
                <div className="game-card-cover">
                  {game.coverUrl ? (
                    <img
                      src={game.coverUrl}
                      alt={game.title}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    />
                  ) : (
                    <span style={{ fontSize: 32 }}>{platformIcons[game.platform] || '🎮'}</span>
                  )}
                </div>
                <div className="game-card-info">
                  <div className="game-card-title">{game.title}</div>
                  <div className="game-card-platform">
                    {game.platform.toUpperCase()} · {game.emulatorId}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Installed Decomps as Games (Beta) ──────────────── */}
      {decompProjects && decompGames.length > 0 && (
        <div style={{ marginTop: 32 }}>
          <div className="info-bar">
            <span style={{ fontWeight: 600 }}>Decompilations <span className="badge-beta">Beta</span></span>
            <span className="text-sm text-muted">
              {decompGames.filter(d => d.hasRom).length} ready · {decompGames.length} installed
            </span>
          </div>

          <div className="library-grid">
            {decompGames.map((decomp) => (
              <div
                className="game-card"
                key={decomp.config.id}
                onClick={() => decomp.hasRom && handleDecompLaunch(decomp)}
                onKeyDown={(e) => {
                  if ((e.key === 'Enter' || e.key === ' ') && decomp.hasRom) handleDecompLaunch(decomp);
                }}
                tabIndex={0}
                role="button"
                title={decomp.hasRom ? `Launch ${decomp.config.name}` : `${decomp.config.name} — needs ROM`}
                style={!decomp.hasRom ? { opacity: 0.6 } : undefined}
              >
                <div className="game-card-cover">
                  <span style={{ fontSize: 32 }}>{platformIcons[decomp.config.platform.toLowerCase()] || '🎮'}</span>
                </div>
                <div className="game-card-info">
                  <div className="game-card-title">{decomp.config.name}</div>
                  <div className="game-card-platform">
                    {decomp.config.platform} · decomp
                    {!decomp.hasRom && ' · needs ROM'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {selectedGame && (
        <GameDetailModal
          game={selectedGame}
          onClose={() => setSelectedGame(null)}
          onLaunch={handleLaunch}
        />
      )}
    </div>
  );
}
