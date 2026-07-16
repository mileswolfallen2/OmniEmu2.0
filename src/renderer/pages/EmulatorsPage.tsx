import React, { useEffect, useState, useCallback, useRef } from 'react';
import type { EmulatorState, InstallProgress, DecompState } from '../../shared/types';

interface DecompProgressMap {
  [decompId: string]: { stage: string; percent: number; message: string; error?: string };
}

const isMacOS = navigator.userAgent.includes('Mac');

const FRONTEND_IDS = new Set(['esde', 'neostation', 'pegasus']);
const EMUBUDDY_ID = 'emubuddy';
type TabId = 'all' | 'emulators' | 'frontends' | 'decomps';

export function EmulatorsPage() {
  const [states, setStates] = useState<EmulatorState[]>([]);
  const [decompStates, setDecompStates] = useState<DecompState[]>([]);
  const [betaFeatures, setBetaFeatures] = useState(false);
  const [decompProjects, setDecompProjects] = useState(false);
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState<Record<string, InstallProgress>>({});
  const [decompProgress, setDecompProgress] = useState<DecompProgressMap>({});
  const [actioning, setActioning] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>('all');
  const cleanups = useRef<(() => void)[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    const [emuResult, decompResult, settings] = await Promise.all([
      window.omni.emulators.states(),
      window.omni.decomps.states(),
      window.omni.settings.get(),
    ]);
    setStates(emuResult);
    setDecompStates(decompResult);
    setBetaFeatures(!!settings.betaFeatures);
    setDecompProjects(!!settings.decompProjects);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();

    const unsubEmu = window.omni.emulators.onInstallProgress((p: InstallProgress) => {
      setProgress((prev) => ({ ...prev, [p.emulatorId]: p }));
      if (p.stage === 'done' || p.stage === 'error') {
        setActioning(null);
      }
    });

    const unsubDecomp = window.omni.decomps.onInstallProgress((p) => {
      setDecompProgress((prev) => ({
        ...prev,
        [p.decompId]: { stage: p.stage, percent: p.percent, message: p.message, error: (p as any).error },
      }));
      if (p.stage === 'done' || p.stage === 'error') {
        setActioning(null);
        load();
      }
    });

    cleanups.current.push(unsubEmu, unsubDecomp);

    return () => {
      cleanups.current.forEach((fn) => fn());
    };
  }, [load]);

  // ── Emulator handlers ─────────────────────────────────────

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

  // ── Decomp handlers ───────────────────────────────────────

  const handleDecompInstall = async (id: string) => {
    setActioning(id);
    setDecompProgress((prev) => ({
      ...prev,
      [id]: { stage: 'downloading', percent: 0, message: 'Starting...' },
    }));
    await window.omni.decomps.install(id);
    await load();
  };

  const handleDecompUninstall = async (id: string) => {
    if (!confirm(`Uninstall this port and remove all its files?`)) return;
    setActioning(id);
    await window.omni.decomps.uninstall(id);
    setActioning(null);
    await load();
  };

  const handleDecompLaunch = async (id: string) => {
    setActioning(id);
    await window.omni.decomps.launch(id);
    setActioning(null);
  };

  const handleDecompSelectRom = async (id: string) => {
    const result = await window.omni.decomps.selectRom(id);
    if (result.state) {
      setDecompStates((prev) =>
        prev.map((d) => (d.config.id === id ? result.state : d))
      );
    }
  };

  const handleRefresh = () => load();

  if (loading) {
    return <div className="loading">Checking emulators...</div>;
  }

  const currentProgress = (id: string) => progress[id];

  const emulators = states.filter((s) => s.config.id !== 'emubuddy' && !FRONTEND_IDS.has(s.config.id));
  const frontends = states.filter((s) => FRONTEND_IDS.has(s.config.id) || s.config.id === 'emubuddy');
  const installedCount = states.filter((s) => s.installed).length;
  const configuredCount = states.filter((s) => s.configured).length;

  const filteredStates = activeTab === 'emulators'
    ? emulators
    : activeTab === 'frontends'
    ? frontends
    : states;

  const showDecomps = decompProjects && (activeTab === 'all' || activeTab === 'decomps');

  return (
    <div>
      <div className="info-bar">
        <span>
          {installedCount} installed
          {' · '}
          {configuredCount} configured
          {Object.keys(progress).length > 0 && ' · Installing...'}
        </span>
        <button className="btn btn-secondary btn-sm" onClick={handleRefresh}>
          Refresh
        </button>
      </div>

      {/* ── Tabs ─────────────────────────────────────────── */}
      <div className="page-tabs">
        <button
          className={`page-tab ${activeTab === 'all' ? 'active' : ''}`}
          onClick={() => setActiveTab('all')}
        >
          All
          <span className="page-tab-count">{states.length + (showDecomps ? decompStates.length : 0)}</span>
        </button>
        <button
          className={`page-tab ${activeTab === 'emulators' ? 'active' : ''}`}
          onClick={() => setActiveTab('emulators')}
        >
          Emulators
          <span className="page-tab-count">{emulators.length}</span>
        </button>
        <button
          className={`page-tab ${activeTab === 'frontends' ? 'active' : ''}`}
          onClick={() => setActiveTab('frontends')}
        >
          Frontends
          <span className="page-tab-count">{frontends.length}</span>
        </button>
        {decompProjects && (
          <button
            className={`page-tab ${activeTab === 'decomps' ? 'active' : ''}`}
            onClick={() => setActiveTab('decomps')}
          >
            Decomps
            <span className="page-tab-count">{decompStates.length}</span>
          </button>
        )}
      </div>

      {/* ── Emulators Grid ───────────────────────────────── */}
      <div className="card-grid">
        {filteredStates.map((state) => {
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
                    {(state.config.id === 'esde' || state.config.id === 'neostation') && isMacOS ? (
                      <button
                        className="btn btn-primary btn-sm"
                        disabled={isActioning}
                        onClick={() => handleInstall(state.config.id)}
                      >
                        {isActioning ? 'Working...' : 'Install Manually'}
                      </button>
                    ) : (
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

      {/* ── Decompilations Section ───────────────────────── */}
      {showDecomps && (<>
      <div style={{ marginTop: 40 }}>
        <div className="info-bar" style={{ marginBottom: 16 }}>
          <h2 style={{ fontSize: 20, fontWeight: 600 }}>Decompilations <span className="badge-beta">Beta</span></h2>
          <span className="text-sm text-muted">
            Native PC ports built from reverse-engineered source code — bring your own ROM
          </span>
        </div>

        <div className="card-grid">
          {decompStates.map((decomp) => {
            const dprog = decompProgress[decomp.config.id];
            const isActioning = actioning === decomp.config.id;

            return (
              <div className="card" key={decomp.config.id}>
                <div className="card-header">
                  <h3>{decomp.config.name}</h3>
                  <span
                    className={`badge ${
                      decomp.installed
                        ? decomp.hasRom
                          ? 'badge-installed'
                          : 'badge-installed'
                        : 'badge-missing'
                    }`}
                  >
                    {decomp.installed
                      ? decomp.hasRom
                        ? 'Ready to Play'
                        : 'Needs ROM'
                      : 'Not installed'}
                  </span>
                </div>

                <p>{decomp.config.description}</p>

                <div style={{ marginTop: 8 }}>
                  <span className="platform-tag">{decomp.config.platform}</span>
                  {decomp.config.features.slice(0, 3).map((f) => (
                    <span className="platform-tag" key={f} style={{ background: 'var(--accent-dim)', color: 'var(--accent)' }}>
                      {f}
                    </span>
                  ))}
                </div>

                {decomp.version && (
                  <p className="text-sm text-muted mt-2">Version: {decomp.version}</p>
                )}

                {dprog && (
                  <div className="mt-2">
                    <div className="progress-bar">
                      <div
                        className="progress-fill"
                        style={{
                          width: `${dprog.percent}%`,
                          background: dprog.stage === 'error' ? 'var(--error)' : 'var(--accent)',
                        }}
                      />
                    </div>
                    <p className="text-sm text-muted mt-2">
                      {dprog.stage === 'error'
                        ? `Error: ${dprog.error || dprog.message}`
                        : dprog.message}
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
                  {!decomp.installed && (
                    <button
                      className="btn btn-primary btn-sm"
                      disabled={isActioning}
                      onClick={() => handleDecompInstall(decomp.config.id)}
                    >
                      {isActioning ? 'Working...' : 'Install'}
                    </button>
                  )}

                  {decomp.installed && (
                    <>
                      <button
                        className="btn btn-primary btn-sm"
                        disabled={isActioning}
                        onClick={() => handleDecompLaunch(decomp.config.id)}
                      >
                        Launch
                      </button>
                      <button
                        className="btn btn-secondary btn-sm"
                        disabled={isActioning}
                        onClick={() => handleDecompSelectRom(decomp.config.id)}
                      >
                        {decomp.hasRom ? 'Change ROM' : 'Select ROM'}
                      </button>
                      <button
                        className="btn btn-danger btn-sm"
                        disabled={isActioning}
                        onClick={() => handleDecompUninstall(decomp.config.id)}
                      >
                        Uninstall
                      </button>
                    </>
                  )}

                  <button
                    className="btn-icon"
                    title="View on GitHub"
                    onClick={() => window.open(decomp.config.githubUrl, '_blank')}
                    style={{ marginLeft: 'auto' }}
                  >
                    ↗
                  </button>
                </div>

                {decomp.installed && !decomp.hasRom && (
                  <p className="text-sm mt-2" style={{ color: 'var(--warning)' }}>
                    Supply a legal ROM dump to play. Click "Select ROM" above.
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>
      </>)}
    </div>
  );
}
