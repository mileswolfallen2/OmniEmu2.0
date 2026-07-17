import React, { useEffect, useState } from 'react';
import type { EmulatorState, SystemInfo, GameEntry } from '../../shared/types';

export function Dashboard({ onNavigate }: { onNavigate?: (tab: 'dashboard' | 'emulators' | 'library' | 'settings' | 'controller' | 'utilities') => void }) {
  const [emulators, setEmulators] = useState<EmulatorState[]>([]);
  const [system, setSystem] = useState<SystemInfo | null>(null);
  const [recent, setRecent] = useState<GameEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [states, info, recentGames] = await Promise.all([
          window.omni.emulators.states(),
          window.omni.system.info(),
          window.omni.game.recent(),
        ]);
        if (cancelled) return;
        setEmulators(states);
        setSystem(info);
        setRecent(recentGames || []);
      } catch { /* ignore */ }
      if (!cancelled) setLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, []);

  const installed = emulators.filter((e) => e.installed).length;
  const total = emulators.filter((e) => e.config.supported).length;

  if (loading) {
    return <div className="loading">Loading dashboard...</div>;
  }

  return (
    <div>
      <div className="info-bar">
        <span className="info-item">
          {system?.platform === 'darwin' ? '🍎' : system?.platform === 'win32' ? '🪟' : '🐧'}
          {system?.platform} ({system?.arch})
        </span>
      </div>

      <div className="card-grid">
        <div className="card">
          <div className="card-header">
            <h3>Emulators</h3>
          </div>
          <p>
            {installed} of {total} supported emulators installed
          </p>
          <div style={{ marginTop: 12, display: 'flex', gap: 4 }}>
            {Array.from({ length: total }).map((_, i) => (
              <span
                key={i}
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: i < installed
                    ? 'var(--success)'
                    : 'var(--border)',
                }}
              />
            ))}
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h3>Game Library</h3>
          </div>
          <p style={{ fontSize: 32, fontWeight: 700, color: 'var(--accent)' }}>
            {recent.filter(g => g.playCount > 0).length || 0}
          </p>
          <p>games played</p>
        </div>

        <div className="card">
          <div className="card-header">
            <h3>Platform</h3>
          </div>
          <p>
            {system?.arch === 'arm64' ? 'ARM64' : 'x86-64'} architecture
          </p>
          <p className="text-sm text-muted mt-2">
            Running on {system?.platform === 'darwin'
              ? 'macOS'
              : system?.platform === 'win32'
              ? 'Windows'
              : 'Linux'}
          </p>
        </div>
      </div>

      {recent.length > 0 && (
        <>
          <h3 className="mt-4 mb-2" style={{ fontSize: 16, fontWeight: 600 }}>
            Resume Games
          </h3>
          <div className="library-grid">
            {recent.slice(0, 6).map((game) => (
              <div
                key={game.id}
                className="game-card"
                tabIndex={0}
                role="button"
                onClick={async () => {
                  try {
                    await window.omni.game.launch(game.emulatorId, game.romPath);
                    const updated = await window.omni.game.recent();
                    setRecent(updated || []);
                  } catch { /* ignore */ }
                }}
              >
                <div className="game-card-cover">
                  {game.coverUrl ? (
                    <img src={game.coverUrl} alt={game.title} />
                  ) : (
                    <div className="game-card-placeholder">
                      {game.platform.slice(0, 2).toUpperCase()}
                    </div>
                  )}
                </div>
                <div className="game-card-info">
                  <strong>{game.title}</strong>
                  <span className="text-muted text-sm">{game.lastPlayed ? new Date(game.lastPlayed).toLocaleDateString() : ''}</span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <h3 className="mt-4 mb-2" style={{ fontSize: 16, fontWeight: 600 }}>
        Quick Actions
      </h3>
      <div style={{ display: 'flex', gap: 8 }}>
        <button className="btn btn-primary" onClick={() => onNavigate?.('emulators')}>
          Manage Emulators
        </button>
        <button className="btn btn-secondary" onClick={() => {
          window.omni.roms.selectDirectory();
        }}>
          Scan for ROMs
        </button>
      </div>
    </div>
  );
}
