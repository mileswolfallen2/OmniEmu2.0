import React, { useEffect, useState, useCallback, useRef } from 'react';
import type { EmulatorState, InstallProgress } from '../../shared/types';

interface ProgressMap {
  [emulatorId: string]: InstallProgress;
}

export function EmulatorsPage() {
  const [states, setStates] = useState<EmulatorState[]>([]);
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState<ProgressMap>({});
  const [actioning, setActioning] = useState<string | null>(null);
  const cleanups = useRef<(() => void)[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    const result = await window.omni.emulators.states();
    setStates(result);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();

    const unsub = window.omni.emulators.onInstallProgress((p: InstallProgress) => {
      setProgress((prev) => ({ ...prev, [p.emulatorId]: p }));
      if (p.stage === 'done' || p.stage === 'error') {
        setActioning(null);
      }
    });
    cleanups.current.push(unsub);

    return () => {
      cleanups.current.forEach((fn) => fn());
    };
  }, [load]);

  const handleInstall = async (id: string) => {
    setActioning(id);
    setProgress((prev) => ({
      ...prev,
      [id]: { emulatorId: id, stage: 'downloading', percent: 0, message: 'Starting...' },
    }));
    await window.omni.emulators.install(id);
    await load();
  };

  const handleInstallAndConfigure = async (id: string) => {
    setActioning(id);
    setProgress((prev) => ({
      ...prev,
      [id]: { emulatorId: id, stage: 'downloading', percent: 0, message: 'Starting...' },
    }));
    const result = await window.omni.emulators.install(id);
    if (result.installed && result.path) {
      await window.omni.emulators.configure(id, result.path);
    }
    await load();
  };

  const handleConfigure = async (state: EmulatorState) => {
    if (!state.path) return;
    setActioning(state.config.id);
    setProgress((prev) => ({
      ...prev,
      [state.config.id]: {
        emulatorId: state.config.id,
        stage: 'configuring', percent: 0, message: 'Applying recommended settings...',
      },
    }));
    await window.omni.emulators.configure(state.config.id, state.path);
    setProgress((prev) => ({
      ...prev,
      [state.config.id]: {
        emulatorId: state.config.id,
        stage: 'done', percent: 100,
        message: 'Configuration applied',
      },
    }));
    setActioning(null);
    await load();
  };

  const handleOpen = async (id: string) => {
    setActioning(id);
    await window.omni.emulators.launch(id);
    setActioning(null);
  };

  const handleUninstall = async (id: string) => {
    if (!confirm(`Uninstall ${id} and remove all its files?`)) return;
    setActioning(id);
    await window.omni.emulators.uninstall(id);
    setActioning(null);
    await load();
  };

  const handleOpenWebsite = async (id: string) => {
    await window.omni.emulators.openWebsite(id);
  };

  const handleRefresh = () => load();

  if (loading) {
    return <div className="loading">Checking emulators...</div>;
  }

  if (states.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">🕹️</div>
        <h3>No emulators configured</h3>
        <p>Ready to install and configure emulators automatically.</p>
      </div>
    );
  }

  const currentProgress = (id: string) => progress[id];

  return (
    <div>
      <div className="info-bar">
        <span>
          {states.filter((s) => s.installed).length} installed
          {' · '}
          {states.filter((s) => s.configured).length} configured
          {' · '}
          {Object.keys(progress).length > 0 && ' Installing...'}
        </span>
        <button className="btn btn-secondary btn-sm" onClick={handleRefresh}>
          Refresh
        </button>
      </div>

      <div className="card-grid">
        {states.map((state) => {
          const prog = currentProgress(state.config.id);
          const isActioning = actioning === state.config.id;

          return (
            <div className="card" key={state.config.id}>
              <div className="card-header">
                <h3>{state.config.name}</h3>
                <span
                  className={`badge ${
                    !state.config.supported
                      ? 'badge-unsupported'
                      : state.installed
                      ? state.configured
                        ? 'badge-installed'
                        : 'badge-installed'
                      : 'badge-missing'
                  }`}
                >
                  {!state.config.supported
                    ? 'Unsupported'
                    : state.installed
                    ? state.configured
                      ? 'Configured'
                      : 'Installed'
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
                <p className="text-sm text-muted mt-2">Version: {state.version}</p>
              )}

              {prog && (
                <div className="mt-2">
                  <div className="progress-bar">
                    <div
                      className="progress-fill"
                      style={{
                        width: `${prog.percent}%`,
                        background:
                          prog.stage === 'error'
                            ? 'var(--error)'
                            : 'var(--accent)',
                      }}
                    />
                  </div>
                  <p className="text-sm text-muted mt-2">
                    {prog.stage === 'error'
                      ? `Error: ${prog.error || prog.message}`
                      : prog.message}
                  </p>
                </div>
              )}

              <div
                style={{
                  marginTop: 12,
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 6,
                  alignItems: 'center',
                }}
              >
                {!state.installed && state.config.supported && (
                  <>
                    <button
                      className="btn btn-primary btn-sm"
                      disabled={isActioning}
                      onClick={() => handleInstallAndConfigure(state.config.id)}
                    >
                      {isActioning ? 'Working...' : 'Install & Configure'}
                    </button>
                    <button
                      className="btn btn-secondary btn-sm"
                      disabled={isActioning}
                      onClick={() => handleInstall(state.config.id)}
                    >
                      Install Only
                    </button>
                  </>
                )}

                {!state.installed && !state.config.supported && (
                  <span className="text-sm text-muted">Not supported on this platform</span>
                )}

                {state.installed && !state.configured && (
                  <button
                    className="btn btn-primary btn-sm"
                    disabled={isActioning}
                    onClick={() => handleConfigure(state)}
                  >
                    Apply Recommended Settings
                  </button>
                )}

                {state.installed && state.configured && (
                  <>
                    <button
                      className="btn btn-secondary btn-sm"
                      disabled={isActioning}
                      onClick={() => handleConfigure(state)}
                    >
                      Re-apply Settings
                    </button>
                    <span className="badge badge-installed" style={{ fontSize: 11 }}>
                      Configured
                    </span>
                  </>
                )}

                {state.installed && (
                  <>
                    <button
                      className="btn btn-primary btn-sm"
                      disabled={isActioning}
                      onClick={() => handleOpen(state.config.id)}
                    >
                      Open
                    </button>
                    <button
                      className="btn btn-danger btn-sm"
                      disabled={isActioning}
                      onClick={() => handleUninstall(state.config.id)}
                    >
                      Uninstall
                    </button>
                  </>
                )}

                {state.config.websiteUrl && (
                  <button
                    className="btn-icon"
                    title="Open website"
                    onClick={() => handleOpenWebsite(state.config.id)}
                  >
                    ↗
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
