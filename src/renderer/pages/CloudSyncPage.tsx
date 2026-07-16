import React, { useEffect, useState, useCallback, useRef } from 'react';
import type { SyncthingStatus, SyncthingPendingDevice, SyncthingPendingFolder } from '../../shared/types';

type SetupStep = 'install' | 'start' | 'setup' | 'ready';

interface EmuDir {
  id: string;
  name: string;
  saves: string | null;
}

export function CloudSyncPage() {
  const [status, setStatus] = useState<SyncthingStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [installing, setInstalling] = useState(false);
  const [installMsg, setInstallMsg] = useState('');
  const [installPercent, setInstallPercent] = useState(0);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [remoteDeviceId, setRemoteDeviceId] = useState('');
  const [remoteDeviceName, setRemoteDeviceName] = useState('');
  const [addingDevice, setAddingDevice] = useState(false);
  const [copied, setCopied] = useState(false);
  const [cloudEnabled, setCloudEnabled] = useState(false);
  const [forceReady, setForceReady] = useState(false);
  const [pendingDevices, setPendingDevices] = useState<SyncthingPendingDevice[]>([]);
  const [pendingFolders, setPendingFolders] = useState<SyncthingPendingFolder[]>([]);
  const [pendingFolderPaths, setPendingFolderPaths] = useState<Record<string, string>>({});
  const [emuDirs, setEmuDirs] = useState<EmuDir[]>([]);
  const [emuSynced, setEmuSynced] = useState<Record<string, boolean>>({});
  const [togglingSync, setTogglingSync] = useState('');
  const [acceptingDevice, setAcceptingDevice] = useState('');
  const [acceptingFolder, setAcceptingFolder] = useState('');
  const [setupComplete, setSetupComplete] = useState(false);
  const [showAddDevice, setShowAddDevice] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const idRef = useRef<HTMLTextAreaElement>(null);

  const DEFAULT_STATUS: SyncthingStatus = {
    installed: false, running: false, deviceId: '', apiAddress: '',
    apiKey: '', version: '', folders: [], remoteDevices: [],
  };

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [s, cloudStatus, pendingDev, pendingFol, dirs] = await Promise.all([
        window.omni.settings.get(),
        window.omni.cloud.status().catch(() => null),
        window.omni.cloud.pendingDevices().catch(() => [] as SyncthingPendingDevice[]),
        window.omni.cloud.pendingFolders().catch(() => [] as SyncthingPendingFolder[]),
        window.omni.cloud.emulatorDirs().catch(() => [] as EmuDir[]),
      ]);
      setCloudEnabled(!!s.cloudSyncEnabled);
      setSetupComplete(!!s.cloudSyncSetupComplete);
      if (cloudStatus) {
        setStatus(cloudStatus);
        const synced: Record<string, boolean> = {};
        for (const d of dirs) {
          synced[d.id] = cloudStatus.folders.some(f => f.id === `saves-${d.id}`);
        }
        setEmuSynced(synced);
      }
      setPendingDevices(pendingDev);
      setPendingFolders(pendingFol);
      setEmuDirs(dirs);
      const paths: Record<string, string> = {};
      for (const fol of pendingFol) {
        const resolved = await window.omni.cloud.guessPath(fol.folderLabel).catch(() => null);
        paths[fol.folderId] = resolved || '';
      }
      setPendingFolderPaths(paths);
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  useEffect(() => {
    const unsub = window.omni.cloud.onInstallProgress((p) => {
      setInstallMsg(p.message);
      setInstallPercent(p.percent);
      if (p.stage === 'done' || p.stage === 'error') {
        setInstalling(false);
        if (p.stage === 'done') loadData();
      }
    });
    return unsub;
  }, [loadData]);

  const showSuccess = (msg: string) => { setSuccess(msg); setError(''); setTimeout(() => setSuccess(''), 4000); };
  const showError = (msg: string) => { setError(msg); setSuccess(''); setTimeout(() => setError(''), 4000); };

  const saveCloudEnabled = async (enabled: boolean) => {
    setCloudEnabled(enabled);
    try { await window.omni.settings.save({ cloudSyncEnabled: enabled }); } catch { /* ignore */ }
  };

  const markSetupComplete = async () => {
    setSetupComplete(true);
    try { await window.omni.settings.save({ cloudSyncSetupComplete: true }); } catch { /* ignore */ }
  };

  const handleInstall = async () => {
    setInstalling(true); setInstallPercent(0); setInstallMsg('Starting download...');
    try {
      const ok = await window.omni.cloud.install();
      if (!ok) { setInstalling(false); showError('Installation failed'); }
    } catch (err) { setInstalling(false); showError(`Install error: ${err}`); }
  };

  const handleStart = async () => {
    setLoading(true);
    try {
      const s = await window.omni.cloud.start();
      if (s) {
        setStatus(s);
        if (s.running) {
          await saveCloudEnabled(true);
          if (!setupComplete) await markSetupComplete();
          showSuccess('Syncthing started!');
          setLoading(false);
        } else {
          let attempts = 0;
          pollRef.current = setInterval(async () => {
            attempts++;
            try {
              const latest = await window.omni.cloud.status();
              setStatus(latest);
              if (latest.running) {
                clearInterval(pollRef.current!); pollRef.current = null;
                await saveCloudEnabled(true);
                if (!setupComplete) await markSetupComplete();
                showSuccess('Syncthing started!');
                setLoading(false);
              } else if (attempts >= 15) {
                clearInterval(pollRef.current!); pollRef.current = null;
                showError('Syncthing took too long to start.');
                setLoading(false);
              }
            } catch {
              if (attempts >= 15) {
                clearInterval(pollRef.current!); pollRef.current = null;
                showError('Could not reach Syncthing.');
                setLoading(false);
              }
            }
          }, 1000);
        }
      } else { showError('Failed to start Syncthing'); setLoading(false); }
    } catch (err) { showError(`Start error: ${err}`); setLoading(false); }
  };

  const handleStop = async () => {
    setLoading(true);
    try {
      const s = await window.omni.cloud.stop();
      setStatus(s);
      await saveCloudEnabled(false);
      showSuccess('Syncthing stopped.');
    } catch (err) { showError(`Stop error: ${err}`); }
    setLoading(false);
  };

  const handleAddDevice = async () => {
    if (!remoteDeviceId.trim()) { showError('Enter a device ID'); return; }
    setAddingDevice(true);
    try {
      const ok = await window.omni.cloud.addDevice(remoteDeviceId.trim(), remoteDeviceName.trim());
      if (ok) { showSuccess('Device added!'); setRemoteDeviceId(''); setRemoteDeviceName(''); setShowAddDevice(false); loadData(); }
      else showError('Failed to add device');
    } catch (err) { showError(`Error: ${err}`); }
    setAddingDevice(false);
  };

  const handleAcceptPendingDevice = async (deviceId: string) => {
    setAcceptingDevice(deviceId);
    try {
      const ok = await window.omni.cloud.acceptPendingDevice(deviceId);
      if (ok) { showSuccess('Device paired!'); loadData(); } else showError('Failed to accept device');
    } catch (err) { showError(`Error: ${err}`); }
    setAcceptingDevice('');
  };

  const handleAcceptPendingFolder = async (fol: SyncthingPendingFolder) => {
    const localPath = pendingFolderPaths[fol.folderId];
    if (!localPath?.trim()) { showError('Set a local path first'); return; }
    setAcceptingFolder(fol.folderId);
    try {
      const ok = await window.omni.cloud.acceptPendingFolder(fol.folderId, fol.folderLabel, localPath.trim(), fol.deviceId);
      if (ok) { showSuccess(`Folder "${fol.folderLabel}" accepted!`); loadData(); } else showError('Failed to accept folder');
    } catch (err) { showError(`Error: ${err}`); }
    setAcceptingFolder('');
  };

  const handleToggleSync = async (emuId: string, sync: boolean) => {
    setTogglingSync(emuId);
    try {
      const ok = await window.omni.cloud.toggleFolderSync(emuId, sync);
      if (ok) { showSuccess(sync ? 'Sync enabled' : 'Sync disabled'); loadData(); }
      else showError('Failed to toggle sync');
    } catch (err) { showError(`Error: ${err}`); }
    setTogglingSync('');
  };

  const handleRemoveDevice = async (deviceId: string) => {
    try { await window.omni.cloud.removeDevice(deviceId); showSuccess('Device removed'); loadData(); } catch { /* ignore */ }
  };

  const handleCopyDeviceId = () => {
    if (status?.deviceId) { navigator.clipboard.writeText(status.deviceId); setCopied(true); setTimeout(() => setCopied(false), 2000); }
  };

  if (loading && !status) return <div className="loading">Checking Syncthing status...</div>;

  const installed = status?.installed ?? false;
  const running = status?.running ?? false;

  let step: SetupStep;
  if (!installed) step = 'install';
  else if (!running) step = 'start';
  else if (!forceReady && !setupComplete && (status?.remoteDevices?.length ?? 0) === 0) step = 'setup';
  else step = 'ready';

  const showStepCounter = !setupComplete;

  const stepLabel = (s: SetupStep) => s === 'install' ? 'Install' : s === 'start' ? 'Start' : s === 'setup' ? 'Pair' : 'Sync';
  const stepIdx = (s: SetupStep) => (['install', 'start', 'setup', 'ready'] as SetupStep[]).indexOf(s);
  const currentIdx = stepIdx(step);

  return (
    <div>
      <h2 style={{ marginTop: 0, marginBottom: 16 }}>Cloud Sync <span className="badge-beta">Beta</span></h2>
      <p className="text-muted" style={{ marginBottom: 20 }}>
        Sync your game saves between devices. Once set up, it runs automatically.
      </p>

      {error && <div className="info-bar mb-4" style={{ color: 'var(--danger, #ff4444)' }}>{error}</div>}
      {success && <div className="info-bar mb-4" style={{ color: 'var(--success, #44ff44)' }}>{success}</div>}

      {/* Step indicator — only during initial setup */}
      {showStepCounter && (
        <div style={{
          display: 'flex', gap: 8, marginBottom: 24, alignItems: 'center',
          padding: '12px 16px', borderRadius: 10,
          background: 'var(--bg-secondary, #1a1a2e)', border: '1px solid var(--border, #333)',
        }}>
          {(['install', 'start', 'setup', 'ready'] as SetupStep[]).map((s, i) => (
            <React.Fragment key={s}>
              <div style={{
                width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center',
                justifyContent: 'center', fontSize: 12, fontWeight: 700,
                background: step === s ? 'var(--accent)' : currentIdx > i ? 'var(--success, #44ff44)' : 'var(--bg-tertiary, #333)',
                color: step === s ? '#fff' : 'var(--text-muted, #888)', transition: 'all 0.2s ease',
              }}>
                {currentIdx > i ? '✓' : i + 1}
              </div>
              <span style={{
                fontSize: 12, fontWeight: step === s ? 600 : 400,
                color: step === s ? 'var(--text)' : 'var(--text-muted, #888)', marginRight: i < 3 ? 8 : 0,
              }}>
                {stepLabel(s)}
              </span>
              {i < 3 && <div style={{ flex: 1, height: 2, background: 'var(--bg-tertiary, #333)', maxWidth: 40 }} />}
            </React.Fragment>
          ))}
        </div>
      )}

      {/* Status badge */}
      {(running || setupComplete) && (
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 14px',
          borderRadius: 20, marginBottom: 20, fontSize: 13, fontWeight: 600,
          background: running && cloudEnabled ? 'rgba(68,255,68,0.1)' : running ? 'rgba(255,200,68,0.1)' : 'rgba(255,100,100,0.1)',
          border: `1px solid ${running && cloudEnabled ? 'rgba(68,255,68,0.3)' : running ? 'rgba(255,200,68,0.3)' : 'rgba(255,100,100,0.3)'}`,
          color: running && cloudEnabled ? 'var(--success, #44ff44)' : running ? '#ffc844' : 'var(--danger, #ff4444)',
        }}>
          <span style={{
            width: 8, height: 8, borderRadius: '50%',
            background: running && cloudEnabled ? 'var(--success, #44ff44)' : running ? '#ffc844' : 'var(--danger, #ff4444)',
          }} />
          {running ? (cloudEnabled ? 'Cloud sync active' : 'Running — not yet paired') : 'Syncthing stopped'}
        </div>
      )}

      {/* Pending Device Requests */}
      {running && pendingDevices.length > 0 && (
        <div className="card mb-4" style={{ border: '2px solid rgba(68,200,255,0.4)' }}>
          <div className="card-header" style={{ background: 'rgba(68,200,255,0.06)' }}>
            <h3 style={{ margin: 0 }}>⏳ Pending Device Requests</h3>
          </div>
          <div style={{ padding: 12 }}>
            {pendingDevices.map(dev => (
              <div key={dev.id} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '10px 12px', borderRadius: 8,
                border: '1px solid rgba(68,200,255,0.25)', marginBottom: 4,
                background: 'rgba(68,200,255,0.04)',
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{dev.name || 'Unknown Device'}</div>
                  <div className="text-sm text-muted" style={{ fontFamily: 'monospace', fontSize: 10 }}>
                    {dev.id.slice(0, 12)}...{dev.id.slice(-6)}
                  </div>
                </div>
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => handleAcceptPendingDevice(dev.id)}
                  disabled={acceptingDevice === dev.id}
                  style={{ fontSize: 12 }}
                >
                  {acceptingDevice === dev.id ? 'Pairing...' : '✓ Accept'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Initial Setup: Step 1 — Install ──────────────── */}
      {!setupComplete && !installed && !installing && (
        <div className="card mb-4" style={{
          border: '2px solid var(--accent)',
          background: 'linear-gradient(135deg, rgba(108,99,255,0.08), rgba(108,99,255,0.02))',
        }}>
          <div className="card-header"><h3 style={{ margin: 0 }}>Install Syncthing</h3></div>
          <div style={{ padding: 16 }}>
            <p className="text-muted" style={{ marginBottom: 16 }}>
              Syncthing is the engine behind cloud sync. Free, open-source, runs locally — no accounts needed.
            </p>
            <button className="btn btn-primary" onClick={handleInstall} style={{ fontSize: 15, padding: '12px 28px' }}>
              ⬇ Install Syncthing
            </button>
          </div>
        </div>
      )}

      {!setupComplete && installing && (
        <div className="card mb-4">
          <div className="card-header"><h3>Installing Syncthing...</h3></div>
          <div style={{ padding: 16 }}>
            <div style={{ marginBottom: 10, fontSize: 13 }}>{installMsg}</div>
            <div style={{ height: 8, borderRadius: 4, background: 'var(--bg-tertiary, #333)', overflow: 'hidden', width: '100%' }}>
              <div style={{
                height: '100%', borderRadius: 4, width: `${installPercent}%`,
                background: 'linear-gradient(90deg, var(--accent), rgba(108,99,255,0.7))', transition: 'width 0.3s ease',
              }} />
            </div>
          </div>
        </div>
      )}

      {/* ── Initial Setup: Step 2 — Start ────────────────── */}
      {!setupComplete && installed && !running && (
        <div className="card mb-4" style={{
          border: '2px solid var(--accent)',
          background: 'linear-gradient(135deg, rgba(108,99,255,0.08), rgba(108,99,255,0.02))',
        }}>
          <div className="card-header"><h3 style={{ margin: 0 }}>Start Syncthing</h3></div>
          <div style={{ padding: 16 }}>
            <p className="text-muted" style={{ marginBottom: 16 }}>
              Start the sync service. It will auto-start on future launches.
            </p>
            <button className="btn btn-primary" onClick={handleStart} disabled={loading} style={{ fontSize: 15, padding: '12px 28px' }}>
              ▶ Start Syncthing
            </button>
          </div>
        </div>
      )}

      {/* ── Initial Setup: Step 3 — Pair ─────────────────── */}
      {!setupComplete && step === 'setup' && (
        <>
          <div className="card mb-4">
            <div className="card-header"><h3>Step 3 — Pair a Device</h3></div>
            <div style={{ padding: 16 }}>
              <p className="text-muted text-sm" style={{ marginBottom: 12 }}>
                Copy this ID and paste it into the other device. Then enter their ID below.
              </p>
              <div style={{ marginBottom: 16 }}>
                <label className="text-sm text-muted" style={{ display: 'block', marginBottom: 4 }}>Your Device ID</label>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <textarea
                    ref={idRef}
                    readOnly
                    value={status?.deviceId || ''}
                    style={{
                      flex: 1, fontFamily: 'monospace', fontSize: 11, padding: 8,
                      borderRadius: 6, border: '1px solid var(--border, #555)',
                      background: 'var(--bg-tertiary, #222)', color: 'var(--text, #fff)',
                      resize: 'none', height: 40,
                    }}
                  />
                  <button className="btn btn-primary btn-sm" onClick={handleCopyDeviceId} style={{ whiteSpace: 'nowrap' }}>
                    {copied ? 'Copied!' : 'Copy ID'}
                  </button>
                </div>
              </div>

              <label className="text-sm text-muted" style={{ display: 'block', marginBottom: 4 }}>Add Remote Device</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <input
                  type="text" placeholder="Remote Device ID"
                  value={remoteDeviceId} onChange={e => setRemoteDeviceId(e.target.value)}
                  style={{
                    fontFamily: 'monospace', fontSize: 12, padding: '8px 10px',
                    borderRadius: 6, border: '1px solid var(--border, #555)',
                    background: 'var(--bg-tertiary, #222)', color: 'var(--text, #fff)',
                  }}
                />
                <input
                  type="text" placeholder="Device name (optional)"
                  value={remoteDeviceName} onChange={e => setRemoteDeviceName(e.target.value)}
                  style={{
                    padding: '8px 10px', borderRadius: 6,
                    border: '1px solid var(--border, #555)',
                    background: 'var(--bg-tertiary, #222)', color: 'var(--text, #fff)',
                  }}
                />
                <button className="btn btn-primary" onClick={handleAddDevice} disabled={addingDevice || !remoteDeviceId.trim()}>
                  {addingDevice ? 'Adding...' : '🔗 Pair Device'}
                </button>
              </div>
            </div>
          </div>

          <button
            className="btn btn-primary"
            onClick={() => { setForceReady(true); markSetupComplete(); saveCloudEnabled(true); }}
            style={{ fontSize: 15, padding: '12px 28px', width: '100%', marginBottom: 16 }}
          >
            Next →
          </button>
        </>
      )}

      {/* ═══════════════════════════════════════════════════════
          POST-SETUP MANAGEMENT VIEW
         ═══════════════════════════════════════════════════════ */}
      {setupComplete && (
        <>
          {/* ── Start Syncthing (if stopped) ─────────────── */}
          {installed && !running && (
            <div className="card mb-4" style={{
              border: '2px solid var(--accent)',
              background: 'linear-gradient(135deg, rgba(108,99,255,0.08), rgba(108,99,255,0.02))',
            }}>
              <div className="card-header"><h3 style={{ margin: 0 }}>Syncthing is stopped</h3></div>
              <div style={{ padding: 16 }}>
                <p className="text-muted" style={{ marginBottom: 16 }}>
                  Start the sync service to manage devices and share saves.
                </p>
                <button className="btn btn-primary" onClick={handleStart} disabled={loading} style={{ fontSize: 15, padding: '12px 28px' }}>
                  ▶ Start Syncthing
                </button>
              </div>
            </div>
          )}

          {/* ── Paired Devices ──────────────────────────── */}
          {running && (
            <div className="card mb-4">
              <div className="card-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <h3 style={{ margin: 0 }}>Paired Devices</h3>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <button className="btn btn-secondary btn-sm" onClick={loadData} disabled={loading} style={{ fontSize: 12 }}>
                    Refresh
                  </button>
                  <button className="btn btn-primary btn-sm" onClick={() => setShowAddDevice(!showAddDevice)} style={{ fontSize: 12 }}>
                    {showAddDevice ? 'Cancel' : '+ Add Device'}
                  </button>
                </div>
              </div>
              <div style={{ padding: '0 12px 12px' }}>
                {/* Add Device form — inline */}
                {showAddDevice && (
                  <div style={{
                    padding: 12, borderRadius: 8, marginBottom: 8,
                    border: '1px solid rgba(108,99,255,0.3)', background: 'rgba(108,99,255,0.04)',
                  }}>
                    <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8 }}>Add New Device</div>
                    <div style={{ marginBottom: 8 }}>
                      <label className="text-sm text-muted" style={{ display: 'block', marginBottom: 4 }}>Your Device ID</label>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <textarea
                          ref={idRef}
                          readOnly
                          value={status?.deviceId || ''}
                          style={{
                            flex: 1, fontFamily: 'monospace', fontSize: 11, padding: 8,
                            borderRadius: 6, border: '1px solid var(--border, #555)',
                            background: 'var(--bg-tertiary, #222)', color: 'var(--text, #fff)',
                            resize: 'none', height: 40,
                          }}
                        />
                        <button className="btn btn-primary btn-sm" onClick={handleCopyDeviceId} style={{ whiteSpace: 'nowrap' }}>
                          {copied ? 'Copied!' : 'Copy ID'}
                        </button>
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <input
                        type="text" placeholder="Remote Device ID"
                        value={remoteDeviceId} onChange={e => setRemoteDeviceId(e.target.value)}
                        style={{
                          fontFamily: 'monospace', fontSize: 12, padding: '8px 10px',
                          borderRadius: 6, border: '1px solid var(--border, #555)',
                          background: 'var(--bg-tertiary, #222)', color: 'var(--text, #fff)',
                        }}
                      />
                      <input
                        type="text" placeholder="Device name (optional)"
                        value={remoteDeviceName} onChange={e => setRemoteDeviceName(e.target.value)}
                        style={{
                          padding: '8px 10px', borderRadius: 6,
                          border: '1px solid var(--border, #555)',
                          background: 'var(--bg-tertiary, #222)', color: 'var(--text, #fff)',
                        }}
                      />
                      <button className="btn btn-primary" onClick={handleAddDevice} disabled={addingDevice || !remoteDeviceId.trim()}>
                        {addingDevice ? 'Adding...' : '🔗 Pair Device'}
                      </button>
                    </div>
                  </div>
                )}

                {/* Device list */}
                {status?.remoteDevices && status.remoteDevices.filter(d => d.id).length > 0 ? (
                  status.remoteDevices.filter(d => d.id).map(device => (
                    <div key={device.id} style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '8px 10px', borderRadius: 8,
                      border: '1px solid var(--border, #555)', marginBottom: 4,
                      background: 'var(--bg-tertiary, #222)',
                    }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: 13 }}>{device.name || 'Unknown Device'}</div>
                        <div className="text-sm text-muted" style={{ fontFamily: 'monospace', fontSize: 10 }}>
                          {device.id.slice(0, 12)}...{device.id.slice(-6)}
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 11, color: device.connected ? 'var(--success, #44ff44)' : 'var(--text-muted, #888)' }}>
                          {device.connected ? 'Connected' : 'Offline'}
                        </span>
                        <button className="btn btn-danger btn-sm" onClick={() => handleRemoveDevice(device.id)}>
                          Remove
                        </button>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-muted text-sm" style={{ padding: 8 }}>No devices paired yet. Click "Add Device" to get started.</p>
                )}
              </div>
            </div>
          )}

          {/* ── Pending Folder Requests ──────────────────── */}
          {running && pendingFolders.length > 0 && (
            <div className="card mb-4" style={{ border: '2px solid rgba(255,200,68,0.4)' }}>
              <div className="card-header" style={{ background: 'rgba(255,200,68,0.06)' }}>
                <h3 style={{ margin: 0 }}>Incoming Folders</h3>
              </div>
              <div style={{ padding: 12 }}>
                {pendingFolders.map(fol => (
                  <div key={fol.folderId} style={{
                    padding: '10px 12px', borderRadius: 8,
                    border: '1px solid rgba(255,200,68,0.25)', marginBottom: 8,
                    background: 'rgba(255,200,68,0.04)',
                  }}>
                    <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 6 }}>{fol.folderLabel}</div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <input
                        type="text"
                        value={pendingFolderPaths[fol.folderId] || ''}
                        onChange={e => setPendingFolderPaths(prev => ({ ...prev, [fol.folderId]: e.target.value }))}
                        placeholder="Save location (auto-detected)"
                        style={{
                          flex: 1, padding: '6px 10px', borderRadius: 6,
                          border: '1px solid var(--border, #555)',
                          background: 'var(--bg-secondary, #1a1a1a)', color: 'var(--text, #fff)',
                          fontFamily: 'monospace', fontSize: 11,
                        }}
                      />
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={() => handleAcceptPendingFolder(fol)}
                        disabled={acceptingFolder === fol.folderId || !(pendingFolderPaths[fol.folderId] || '').trim()}
                        style={{ fontSize: 12, whiteSpace: 'nowrap' }}
                      >
                        {acceptingFolder === fol.folderId ? '...' : '✓ Accept'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Save Directories — Sync Toggles ──────────── */}
          {running && (
            <div className="card mb-4">
              <div className="card-header">
                <h3>Save Directories</h3>
              </div>
              <div style={{ padding: '0 12px 12px' }}>
                <p className="text-muted text-sm" style={{ padding: '4px 0 8px' }}>
                  Toggle sync on for each emulator to start sharing its saves with paired devices.
                </p>
                {emuDirs.map(emu => {
                  const synced = !!emuSynced[emu.id];
                  const busy = togglingSync === emu.id;
                  return (
                    <div key={emu.id} style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '10px 12px', borderRadius: 8,
                      border: `1px solid ${synced ? 'rgba(68,255,68,0.3)' : 'var(--border, #555)'}`,
                      marginBottom: 4,
                      background: synced ? 'rgba(68,255,68,0.04)' : 'var(--bg-tertiary, #222)',
                      transition: 'all 0.2s ease',
                    }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: 13 }}>{emu.name}</div>
                        <div className="text-sm text-muted" style={{ fontFamily: 'monospace', fontSize: 10 }}>
                          {emu.saves}
                        </div>
                      </div>
                      <button
                        className="btn btn-sm"
                        onClick={() => handleToggleSync(emu.id, !synced)}
                        disabled={busy}
                        style={{
                          padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600,
                          background: synced ? 'var(--success, #44ff44)' : 'var(--bg-secondary, #1a1a2e)',
                          color: synced ? '#000' : 'var(--text-muted, #888)',
                          border: `1px solid ${synced ? 'var(--success, #44ff44)' : 'var(--border, #555)'}`,
                          transition: 'all 0.2s ease',
                        }}
                      >
                        {busy ? '...' : synced ? 'Syncing' : 'Off'}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Stop Syncthing ──────────────────────────── */}
          {running && (
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              marginBottom: 16,
            }}>
              <button className="btn btn-secondary btn-sm" onClick={() => window.omni.cloud.openWebUI()}>
                Open Web UI
              </button>
              <button className="btn btn-danger btn-sm" onClick={handleStop} disabled={loading}>
                Stop Syncthing
              </button>
            </div>
          )}

          {/* ── Advanced Settings ────────────────────────── */}
          {running && status?.apiKey && (
            <details style={{ marginBottom: 16 }}>
              <summary style={{ cursor: 'pointer', fontSize: 13, color: 'var(--text-muted, #888)', padding: '8px 0' }}>
                Advanced Settings
              </summary>
              <div className="card" style={{ marginTop: 8 }}>
                <div className="card-header"><h3>Advanced</h3></div>
                <div style={{ padding: 12 }}>
                  <p className="text-muted text-sm" style={{ marginBottom: 8 }}>Syncthing API Key</p>
                  <code style={{
                    display: 'block', padding: '6px 10px', borderRadius: 6,
                    background: 'var(--bg-tertiary, #222)', fontSize: 11, wordBreak: 'break-all',
                  }}>
                    {status.apiKey}
                  </code>
                  <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid var(--border, #333)' }}>
                    <p className="text-muted text-sm" style={{ marginBottom: 8 }}>
                      Uninstall Syncthing and remove all its data. You can reinstall it anytime.
                    </p>
                    <button
                      className="btn btn-danger btn-sm"
                      onClick={async () => {
                        if (!confirm('Uninstall Syncthing? This removes the binary and all sync data.')) return;
                        setLoading(true);
                        try {
                          const ok = await window.omni.cloud.uninstall();
                          if (ok) {
                            await window.omni.settings.save({ cloudSyncEnabled: false, cloudSyncSetupComplete: false });
                            setCloudEnabled(false);
                            setSetupComplete(false);
                            setStatus(null);
                            showSuccess('Syncthing uninstalled.');
                            loadData();
                          } else showError('Failed to uninstall');
                        } catch (err) { showError(`Error: ${err}`); }
                        setLoading(false);
                      }}
                    >
                      Uninstall Syncthing
                    </button>
                  </div>
                </div>
              </div>
            </details>
          )}
        </>
      )}
    </div>
  );
}
