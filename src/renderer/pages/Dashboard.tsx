import React, { useEffect, useState } from 'react';
import type { EmulatorState, SystemInfo } from '../../shared/types';

export function Dashboard() {
  const [emulators, setEmulators] = useState<EmulatorState[]>([]);
  const [system, setSystem] = useState<SystemInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [states, info] = await Promise.all([
        window.omni.emulators.states(),
        window.omni.system.info(),
      ]);
      setEmulators(states);
      setSystem(info);
      setLoading(false);
    }
    load();
  }, []);

  const installed = emulators.filter((e) => e.installed).length;
  const total = emulators.filter((e) => e.config.supported).length;
  const gamesCount = 0; // would come from library scan

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
            {gamesCount}
          </p>
          <p>games in your library</p>
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

      <h3 className="mt-4 mb-2" style={{ fontSize: 16, fontWeight: 600 }}>
        Quick Actions
      </h3>
      <div style={{ display: 'flex', gap: 8 }}>
        <button className="btn btn-primary" onClick={() => {
          const nav = document.querySelector('[data-nav-emulators]') as HTMLButtonElement;
          nav?.click();
        }}>
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
