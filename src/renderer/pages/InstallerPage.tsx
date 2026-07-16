import React, { useEffect, useState, useCallback } from 'react';
import type { EmulatorState, InstallProgress } from '../../shared/types';

type View = 'pick' | 'installing';

const QUICK_PICK_IDS = [
  'retroarch', 'dolphin', 'duckstation', 'pcsx2',
  'ppsspp', 'flycast', 'mgba', 'melonds',
];

const QUICK_PICK_INFO: Record<string, { systems: string; icon: string }> = {
  retroarch:   { systems: 'NES, SNES, N64, GBA, GB, Genesis, PS1 & more', icon: '🕹️' },
  dolphin:     { systems: 'GameCube, Wii', icon: '🎮' },
  duckstation: { systems: 'PlayStation 1', icon: '💿' },
  pcsx2:       { systems: 'PlayStation 2', icon: '💿' },
  ppsspp:      { systems: 'PSP', icon: '🎮' },
  flycast:     { systems: 'Dreamcast, Naomi', icon: '🎮' },
  mgba:        { systems: 'GBA, GB, GBC', icon: '🎮' },
  melonds:     { systems: 'Nintendo DS', icon: '🎮' },
};

interface InstallJob {
  id: string;
  name: string;
  status: 'queued' | 'installing' | 'done' | 'error';
  progress: number;
  message: string;
}

interface Props {
  onClose: () => void;
}

export function InstallerPage({ onClose }: Props) {
  const [view, setView] = useState<View>('pick');
  const [mode, setMode] = useState<'quick' | 'custom'>('quick');
  const [allStates, setAllStates] = useState<EmulatorState[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set(QUICK_PICK_IDS));
  const [jobs, setJobs] = useState<InstallJob[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [loading, setLoading] = useState(true);

  const handleClose = async () => {
    await window.omni.settings.save({ firstSetupComplete: true });
    onClose();
  };

  const load = useCallback(async () => {
    setLoading(true);
    const states = await window.omni.emulators.states();
    setAllStates(states);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const unsub = window.omni.emulators.onInstallProgress((p: InstallProgress) => {
      setJobs(prev => prev.map(j => {
        if (j.id === p.emulatorId && j.status === 'installing') {
          return { ...j, progress: p.percent, message: p.message };
        }
        return j;
      }));
    });
    return unsub;
  }, []);

  const toggleQuickPick = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    const installable = allStates
      .filter(s => !s.installed && s.config.downloads && Object.keys(s.config.downloads).length > 0)
      .map(s => s.config.id);
    if (selected.size === installable.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(installable));
    }
  };

  const startInstall = async () => {
    const toInstall = allStates
      .filter(s => selected.has(s.config.id) && !s.installed)
      .map(s => ({ id: s.config.id, name: s.config.name }));

    if (toInstall.length === 0) return;

    const initial: InstallJob[] = toInstall.map(t => ({
      id: t.id, name: t.name, status: 'queued', progress: 0, message: '',
    }));
    setJobs(initial);
    setView('installing');
    setCurrentIdx(0);

    for (let i = 0; i < toInstall.length; i++) {
      setCurrentIdx(i);
      setJobs(prev => prev.map((j, idx) =>
        idx === i ? { ...j, status: 'installing' as const, message: 'Starting...' } : j
      ));

      try {
        await window.omni.emulators.install(toInstall[i].id);
        setJobs(prev => prev.map((j, idx) =>
          idx === i ? { ...j, status: 'done' as const, progress: 100, message: 'Installed' } : j
        ));
      } catch {
        setJobs(prev => prev.map((j, idx) =>
          idx === i ? { ...j, status: 'error' as const, message: 'Failed' } : j
        ));
      }
    }

    await load();
  };

  const installable = allStates.filter(s => !s.installed && s.config.downloads && Object.keys(s.config.downloads).length > 0);
  const alreadyInstalled = allStates.filter(s => s.installed);
  const notAvailable = allStates.filter(s => !s.installed && (!s.config.downloads || Object.keys(s.config.downloads).length === 0));

  if (loading) return <div className="loading">Loading emulators...</div>;

  const allDone = view === 'installing' && jobs.every(j => j.status === 'done' || j.status === 'error');

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <h2 style={{ margin: 0 }}>Welcome to OmniEmu</h2>
        <button className="btn btn-secondary btn-sm" onClick={handleClose}>Skip for now</button>
      </div>
      <p className="text-muted" style={{ marginBottom: 24 }}>
        Get started by installing the emulators you need. You can always add more later from the Emulators page.
      </p>

      {alreadyInstalled.length > 0 && (
        <div className="info-bar" style={{ marginBottom: 16 }}>
          {alreadyInstalled.length} emulator{alreadyInstalled.length !== 1 ? 's' : ''} already installed
        </div>
      )}

      {view === 'pick' && (
        <>
          {/* Mode selector */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
            <button
              className="btn"
              onClick={() => { setMode('quick'); setSelected(new Set(QUICK_PICK_IDS)); }}
              style={{
                flex: 1, padding: '16px 20px', borderRadius: 12, textAlign: 'left',
                border: `2px solid ${mode === 'quick' ? 'var(--accent)' : 'var(--border)'}`,
                background: mode === 'quick' ? 'var(--accent-dim)' : 'var(--bg-secondary)',
                transition: 'all 0.2s ease',
              }}
            >
              <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 4, color: 'var(--text-primary)' }}>
                ⚡ Quick Install
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                {QUICK_PICK_IDS.length} essential emulators covering the most popular systems
              </div>
            </button>

            <button
              className="btn"
              onClick={() => {
                setMode('custom');
                setSelected(new Set(installable.map(s => s.config.id)));
              }}
              style={{
                flex: 1, padding: '16px 20px', borderRadius: 12, textAlign: 'left',
                border: `2px solid ${mode === 'custom' ? 'var(--accent)' : 'var(--border)'}`,
                background: mode === 'custom' ? 'var(--accent-dim)' : 'var(--bg-secondary)',
                transition: 'all 0.2s ease',
              }}
            >
              <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 4, color: 'var(--text-primary)' }}>
                🎛️ Custom Install
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                Pick exactly which emulators to install
              </div>
            </button>
          </div>

          {/* Quick Install — curated grid */}
          {mode === 'quick' && (
            <div style={{ marginBottom: 24 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 10 }}>
                {QUICK_PICK_IDS.map(id => {
                  const state = allStates.find(s => s.config.id === id);
                  if (!state) return null;
                  const info = QUICK_PICK_INFO[id];
                  const checked = selected.has(id);
                  const alreadyDone = state.installed;
                  return (
                    <div
                      key={id}
                      onClick={() => !alreadyDone && toggleQuickPick(id)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 12,
                        padding: '12px 14px', borderRadius: 10, cursor: alreadyDone ? 'default' : 'pointer',
                        border: `1px solid ${alreadyDone ? 'var(--success)' : checked ? 'var(--accent)' : 'var(--border)'}`,
                        background: alreadyDone ? 'var(--bg-tertiary)' : checked ? 'var(--accent-dim)' : 'var(--bg-secondary)',
                        opacity: alreadyDone ? 0.6 : 1,
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <div style={{
                        width: 22, height: 22, borderRadius: 6, display: 'flex', alignItems: 'center',
                        justifyContent: 'center', fontSize: 13, fontWeight: 700, flexShrink: 0,
                        border: `2px solid ${alreadyDone ? 'var(--success)' : checked ? 'var(--accent)' : 'var(--border)'}`,
                        background: alreadyDone ? 'var(--success)' : checked ? 'var(--accent)' : 'transparent',
                        color: alreadyDone || checked ? '#fff' : 'transparent',
                        transition: 'all 0.15s ease',
                      }}>
                        {alreadyDone ? '✓' : checked ? '✓' : ''}
                      </div>
                      <span style={{ fontSize: 20 }}>{info?.icon || '🎮'}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)' }}>
                          {state.config.name}
                          {alreadyDone && <span style={{ color: 'var(--success)', marginLeft: 6, fontSize: 11 }}>Installed</span>}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                          {info?.systems || state.config.platforms.join(', ')}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Custom Install — full list */}
          {mode === 'custom' && (
            <div style={{ marginBottom: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                  {selected.size} of {installable.length} selected
                </span>
                <button className="btn btn-secondary btn-sm" onClick={toggleAll}>
                  {selected.size === installable.length ? 'Deselect All' : 'Select All'}
                </button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {installable.map(state => {
                  const checked = selected.has(state.config.id);
                  return (
                    <div
                      key={state.config.id}
                      onClick={() => toggleQuickPick(state.config.id)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 12,
                        padding: '10px 14px', borderRadius: 8, cursor: 'pointer',
                        border: `1px solid ${checked ? 'var(--accent)' : 'var(--border)'}`,
                        background: checked ? 'var(--accent-dim)' : 'var(--bg-secondary)',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <div style={{
                        width: 20, height: 20, borderRadius: 5, display: 'flex', alignItems: 'center',
                        justifyContent: 'center', fontSize: 12, fontWeight: 700, flexShrink: 0,
                        border: `2px solid ${checked ? 'var(--accent)' : 'var(--border)'}`,
                        background: checked ? 'var(--accent)' : 'transparent',
                        color: checked ? '#fff' : 'transparent',
                        transition: 'all 0.15s ease',
                      }}>
                        ✓
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)' }}>{state.config.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                          {state.config.platforms.join(', ')}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {notAvailable.length > 0 && (
                <div style={{ marginTop: 16 }}>
                  <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 6, fontWeight: 600 }}>
                    Not available on this platform
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {notAvailable.map(s => (
                      <span key={s.config.id} style={{
                        padding: '4px 10px', borderRadius: 6, fontSize: 11,
                        background: 'var(--bg-tertiary)', color: 'var(--text-muted)',
                      }}>
                        {s.config.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Install button */}
          {selected.size > 0 && (
            <button
              className="btn btn-primary"
              onClick={startInstall}
              style={{ fontSize: 16, padding: '14px 32px', width: '100%' }}
            >
              Install {selected.size} Emulator{selected.size !== 1 ? 's' : ''}
            </button>
          )}
        </>
      )}

      {/* Installing view */}
      {view === 'installing' && (
        <div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 24 }}>
            {jobs.map((job, i) => (
              <div key={job.id} style={{
                padding: '10px 14px', borderRadius: 8,
                border: `1px solid ${
                  job.status === 'done' ? 'var(--success)'
                  : job.status === 'error' ? 'var(--error)'
                  : job.status === 'installing' ? 'var(--accent)'
                  : 'var(--border)'
                }`,
                background: job.status === 'done'
                  ? 'var(--bg-tertiary)'
                  : job.status === 'error'
                    ? 'var(--bg-tertiary)'
                    : job.status === 'installing'
                      ? 'var(--accent-dim)'
                      : 'var(--bg-secondary)',
                transition: 'all 0.2s ease',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: job.status === 'installing' ? 8 : 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{
                      width: 22, height: 22, borderRadius: '50%', display: 'flex', alignItems: 'center',
                      justifyContent: 'center', fontSize: 11, fontWeight: 700, flexShrink: 0,
                      background: job.status === 'done' ? 'var(--success)'
                        : job.status === 'error' ? 'var(--error)'
                        : job.status === 'installing' ? 'var(--accent)'
                        : 'var(--bg-tertiary)',
                      color: job.status === 'queued' ? 'var(--text-muted)' : '#fff',
                    }}>
                      {job.status === 'done' ? '✓' : job.status === 'error' ? '✗' : i + 1}
                    </span>
                    <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)' }}>{job.name}</span>
                  </div>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    {job.status === 'done' ? 'Done' : job.status === 'error' ? 'Failed' : job.status === 'installing' ? `${job.progress}%` : 'Waiting...'}
                  </span>
                </div>
                {job.status === 'installing' && (
                  <div style={{ height: 4, borderRadius: 2, background: 'var(--bg-tertiary)', overflow: 'hidden' }}>
                    <div style={{
                      height: '100%', borderRadius: 2, width: `${job.progress}%`,
                      background: 'var(--accent-gradient)',
                      transition: 'width 0.3s ease',
                    }} />
                  </div>
                )}
                {job.status === 'installing' && job.message && (
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{job.message}</div>
                )}
              </div>
            ))}
          </div>

          {allDone && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div className="info-bar" style={{ textAlign: 'center' }}>
                {jobs.filter(j => j.status === 'done').length} installed
                {jobs.filter(j => j.status === 'error').length > 0 && ` · ${jobs.filter(j => j.status === 'error').length} failed`}
              </div>
              <button
                className="btn btn-primary"
                onClick={handleClose}
                style={{ width: '100%' }}
              >
                Done
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
