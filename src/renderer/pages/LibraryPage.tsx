import React, { useEffect, useState, useCallback } from 'react';
import type { GameEntry } from '../../shared/types';

const platformIcons: Record<string, string> = {
  nes: '🕹️',
  snes: '🕹️',
  n64: '🎮',
  gba: '🎮',
  gbc: '🎮',
  ps1: '💿',
  ps2: '💿',
  ps3: '💿',
  wii: '📀',
  gc: '📀',
  switch: '🕹️',
  arcade: '🕹️',
};

export function LibraryPage() {
  const [games, setGames] = useState<GameEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedDir, setSelectedDir] = useState<string | null>(null);

  const handleScan = useCallback(async () => {
    const dir = await window.omni.roms.selectDirectory();
    if (!dir) return;
    setSelectedDir(dir);
    setLoading(true);
    const results = await window.omni.roms.scan(dir);
    setGames(results);
    setLoading(false);
  }, []);

  const handleLaunch = async (game: GameEntry) => {
    await window.omni.game.launch(game.emulatorId, game.romPath);
  };

  const handleOpenDirectory = async () => {
    const dir = await window.omni.roms.selectDirectory();
    if (!dir) return;
    setSelectedDir(dir);
    setLoading(true);
    const results = await window.omni.roms.scan(dir);
    setGames(results);
    setLoading(false);
  };

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <button className="btn btn-primary" onClick={handleScan}>
          Scan for ROMs
        </button>
        {selectedDir && (
          <span className="text-sm text-muted" style={{ padding: '8px 0' }}>
            {selectedDir}
          </span>
        )}
      </div>

      {loading && <div className="loading">Scanning for games...</div>}

      {!loading && games.length === 0 && (
        <div className="scan-area" onClick={handleOpenDirectory}>
          <div style={{ fontSize: 48 }}>📂</div>
          <p>Click to select a ROM directory</p>
          <p className="text-sm text-muted mt-2">
            Supported formats: .nes, .sfc, .n64, .gba, .iso, .wbfs, .nsp, .ps2, and more
          </p>
        </div>
      )}

      {games.length > 0 && (
        <div>
          <div className="info-bar">
            <span>{games.length} games found</span>
            <span>{(games.length / 10).toFixed(1)} GB estimated</span>
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
                    {game.platform.toUpperCase()}
                    {' · '}
                    {game.emulatorId}
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
