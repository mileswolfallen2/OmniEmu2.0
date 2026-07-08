import React, { useEffect, useState, useCallback } from 'react';
import type { EmulatorState } from '../../shared/types';

export function EmulatorsPage() {
  const [states, setStates] = useState<EmulatorState[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const result = await window.omni.emulators.states();
    setStates(result);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleInstall = async (id: string) => {
    await window.omni.emulators.openInstallUrl(id);
  };

  const handleRefresh = () => {
    load();
  };

  if (loading) {
    return <div className="loading">Checking emulators...</div>;
  }

  if (states.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">🕹️</div>
        <h3>No emulators configured</h3>
        <p>Add emulator definitions to get started.</p>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
        <button className="btn btn-secondary btn-sm" onClick={handleRefresh}>
          Refresh
        </button>
      </div>

      <div className="card-grid">
        {states.map((state) => (
          <div className="card" key={state.config.id}>
            <div className="card-header">
              <h3>{state.config.name}</h3>
              <span
                className={`badge ${
                  !state.config.supported
                    ? 'badge-unsupported'
                    : state.installed
                    ? 'badge-installed'
                    : 'badge-missing'
                }`}
              >
                {!state.config.supported
                  ? 'Unsupported'
                  : state.installed
                  ? 'Installed'
                  : 'Not installed'}
              </span>
            </div>

            <p>{state.config.description}</p>

            <div style={{ marginTop: 8 }}>
              {state.config.platforms.map((p) => (
                <span className="platform-tag" key={p}>
                  {p}
                </span>
              ))}
            </div>

            {state.version && (
              <p className="text-sm text-muted mt-2">
                Version: {state.version}
              </p>
            )}

            <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
              {!state.installed && state.config.installUrl && (
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => handleInstall(state.config.id)}
                >
                  Install
                </button>
              )}
              {state.installed && state.path && (
                <span className="text-sm text-muted" style={{ padding: '4px 0' }}>
                  {state.path}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
