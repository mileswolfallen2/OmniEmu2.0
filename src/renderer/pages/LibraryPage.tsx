import React, { useEffect, useState, useCallback } from 'react';
import type { GameEntry } from '../../shared/types';

const platformIcons: Record<string, string> = {
  nes: '🕹️', snes: '🕹️', n64: '🎮',
  gba: '🎮', gbc: '🎮',
  ps1: '💿', ps2: '💿', ps3: '💿',
  wii: '📀', gc: '📀',
  switch: '🕹️', arcade: '🕹️',
};

export function LibraryPage() {
  const [games, setGames] = useState<GameEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [romsDir, setRomsDir] = useState<string>('');

  // Load saved ROM directory on mount
  useEffect(() => {
    (async () => {
      const settings = await window.omni.settings.get();
      if (settings.romsDirectory) {
        setRomsDir(settings.romsDirectory);
        setLoading(true);
        const results = await window.omni.roms.scan(settings.romsDirectory);
        setGames(results);
        setLoading(false);
      }
    })();
  }, []);

  const scanDirectory = useCallback(async (dir: string) => {
    setRomsDir(dir);
    setLoading(true);
    // Save to persistent settings
    await window.omni.settings.save({ romsDirectory: dir });
    const results = await window.omni.roms.scan(dir);
    setGames(results);
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
            <button className="btn btn-secondary btn-sm" onClick={handleScan}>
              Rescan
            </button>
          </div>

          <div className="library-grid">
            {games.map((game) => (
              <div
                className="game-card"
                key={game.id}
                onClick={() => handleLaunch(game)}
                title={`Launch ${game.title} via ${game.emulatorId}`}
              >
                <div className="game-card-cover">
                  {platformIcons[game.platform] || '🎮'}
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
    </div>
  );
}
