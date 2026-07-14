import React, { useEffect, useState, useCallback, useRef } from 'react';
import type { SyncthingStatus } from '../../shared/types';

type SetupStep = 'install' | 'start' | 'setup' | 'ready';

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
  const [folderLabel, setFolderLabel] = useState('');
  const [folderPath, setFolderPath] = useState('');
  const [showAddFolder, setShowAddFolder] = useState(false);
  const [copied, setCopied] = useState(false);
  const [cloudEnabled, setCloudEnabled] = useState(false);
  const uninstallRef = useRef<HTMLTextAreaElement>(null);

  const DEFAULT_STATUS: SyncthingStatus = {
    installed: false, running: false, deviceId: '', apiAddress: '',
    apiKey: '', version: '', folders: [], remoteDevices: [],
  };

  const loadStatus = useCallback(async () => {
    setLoading(true);
    try {
      const s = await Promise.race([
        window.omni.cloud.status(),
        new Promise<null>((_, reject) => setTimeout(() => reject(new Error('timeout')), 8000)),
      ]);
      if (s) setStatus(s);
      else setStatus(DEFAULT_STATUS);
    } catch {
      setStatus(DEFAULT_STATUS);
    }
    setLoading(false);
  }, []);

  const loadSettings = useCallback(async () => {
    try {
      const s = await window.omni.settings.get();
      setCloudEnabled(!!s.cloudSyncEnabled);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { loadStatus(); loadSettings(); }, [loadStatus, loadSettings]);

  useEffect(() => {
    const unsub = window.omni.cloud.onInstallProgress((p) => {
      setInstallMsg(p.message);
      setInstallPercent(p.percent);
      if (p.stage === 'done' || p.stage === 'error') {
        setInstalling(false);
        if (p.stage === 'done') {
          loadStatus();
        }
      }
    });
    return unsub;
  }, [loadStatus]);

  const showSuccess = (msg: string) => {
    setSuccess(msg);
    setError('');
    setTimeout(() => setSuccess(''), 4000);
  };

  const showError = (msg: string) => {
    setError(msg);
    setSuccess('');
    setTimeout(() => setError(''), 4000);
  };

  const saveCloudEnabled = async (enabled: boolean) => {
    setCloudEnabled(enabled);
    try { await window.omni.settings.save({ cloudSyncEnabled: enabled }); } catch { /* ignore */ }
  };

  const handleInstall = async () => {
    setInstalling(true);
    setInstallPercent(0);
    setInstallMsg('Starting download...');
    try {
      const ok = await window.omni.cloud.install();
      if (!ok) {
        setInstalling(false);
        showError('Installation failed');
      }
    } catch (err) {
      setInstalling(false);
      showError(`Install error: ${err}`);
    }
  };

  const handleStart = async () => {
    setLoading(true);
    try {
      // Start kicks off the process in the background
      const s = await window.omni.cloud.start();
      if (s) {
        setStatus(s);
        if (s.running) {
          await saveCloudEnabled(true);
          showSuccess('Syncthing started! Auto-start enabled.');
        } else {
          // Process was kicked off but may need more time — poll
          let attempts = 0;
          const poll = setInterval(async () => {
            attempts++;
            try {
              const latest = await window.omni.cloud.status();
              setStatus(latest);
              if (latest.running) {
                clearInterval(poll);
                await saveCloudEnabled(true);
                showSuccess('Syncthing started! Auto-start enabled.');
                setLoading(false);
              } else if (attempts >= 15) {
                clearInterval(poll);
                showError('Syncthing took too long to start. Check that the binary is not blocked by your OS.');
                setLoading(false);
              }
            } catch {
              if (attempts >= 15) {
                clearInterval(poll);
                showError('Could not reach Syncthing.');
                setLoading(false);
              }
            }
          }, 1000);
        }
      } else {
        showError('Failed to start Syncthing — binary not found');
      }
    } catch (err) {
      showError(`Start error: ${err}`);
    }
    setLoading(false);
  };

  const handleStop = async () => {
    setLoading(true);
    try {
      const s = await window.omni.cloud.stop();
      setStatus(s);
      await saveCloudEnabled(false);
      showSuccess('Syncthing stopped. Auto-start disabled.');
    } catch (err) {
      showError(`Stop error: ${err}`);
    }
    setLoading(false);
  };

  const handleAddDevice = async () => {
    if (!remoteDeviceId.trim()) {
      showError('Enter a device ID');
      return;
    }
    setAddingDevice(true);
    try {
      const ok = await window.omni.cloud.addDevice(remoteDeviceId.trim(), remoteDeviceName.trim());
      if (ok) {
        showSuccess('Device added! Wait for it to accept, or add this device on the other machine.');
        setRemoteDeviceId('');
        setRemoteDeviceName('');
        loadStatus();
      } else {
        showError('Failed to add device');
      }
    } catch (err) {
      showError(`Error: ${err}`);
    }
    setAddingDevice(false);
  };

  const handleRemoveDevice = async (deviceId: string) => {
    try {
      await window.omni.cloud.removeDevice(deviceId);
      showSuccess('Device removed');
      loadStatus();
    } catch { /* ignore */ }
  };

  const handleAddFolder = async () => {
    if (!folderLabel.trim() || !folderPath.trim()) {
      showError('Enter folder label and path');
      return;
    }
    const id = folderLabel.toLowerCase().replace(/[^a-z0-9]/g, '-');
    const deviceIds = status?.remoteDevices?.map(d => d.id) || [];
    try {
      const ok = await window.omni.cloud.addFolder(id, folderLabel.trim(), folderPath.trim(), deviceIds);
      if (ok) {
        showSuccess('Shared folder added');
        setFolderLabel('');
        setFolderPath('');
        setShowAddFolder(false);
        loadStatus();
      } else {
        showError('Failed to add folder');
      }
    } catch (err) {
      showError(`Error: ${err}`);
    }
  };

  const handleRemoveFolder = async (folderId: string) => {
    try {
      await window.omni.cloud.removeFolder(folderId);
      showSuccess('Folder removed');
      loadStatus();
    } catch { /* ignore */ }
  };

  const handleCopyDeviceId = () => {
    if (status?.deviceId) {
      navigator.clipboard.writeText(status.deviceId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleCopyApiKey = () => {
    if (status?.apiKey) {
      navigator.clipboard.writeText(status.apiKey);
      showSuccess('API key copied');
    }
  };

  const handleOpenWebUI = async () => {
    await window.omni.cloud.openWebUI();
  };

  if (loading && !status) {
    return <div className="loading">Checking Syncthing status...</div>;
  }

  const installed = status?.installed ?? false;
  const running = status?.running ?? false;

  // Determine current step
  let step: SetupStep;
  if (!installed) step = 'install';
  else if (!running) step = 'start';
  else if (!cloudEnabled || (status?.remoteDevices?.length ?? 0) === 0) step = 'setup';
  else step = 'ready';

  return (
    <div>
      <h2 style={{ marginTop: 0, marginBottom: 16 }}>Cloud Sync</h2>
      <p className="text-muted" style={{ marginBottom: 20 }}>
        Sync your game saves between devices using Syncthing. Once set up, it runs automatically on launch.
      </p>

      {error && (
        <div className="info-bar mb-4" style={{ color: 'var(--danger, #ff4444)' }}>{error}</div>
      )}
      {success && (
        <div className="info-bar mb-4" style={{ color: 'var(--success, #44ff44)' }}>{success}</div>
      )}

      {/* Progress indicator */}
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
              background: step === s
                ? 'var(--accent)'
                : (['install', 'start', 'setup', 'ready'].indexOf(step) > i
                    ? 'var(--success, #44ff44)' : 'var(--bg-tertiary, #333)'),
              color: step === s ? '#fff' : 'var(--text-muted, #888)',
              transition: 'all 0.2s ease',
            }}>
              {['install', 'start', 'setup', 'ready'].indexOf(step) > i ? '✓' : i + 1}
            </div>
            <span style={{
              fontSize: 12, fontWeight: step === s ? 600 : 400,
              color: step === s ? 'var(--text)' : 'var(--text-muted, #888)',
              marginRight: i < 3 ? 8 : 0,
            }}>
              {s === 'install' ? 'Install' : s === 'start' ? 'Start' : s === 'setup' ? 'Pair' : 'Syncing'}
            </span>
            {i < 3 && <div style={{
              flex: 1, height: 2, background: 'var(--bg-tertiary, #333)',
              maxWidth: 40,
            }} />}
          </React.Fragment>
        ))}
      </div>

      {/* Status badge */}
      {running && (
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 14px',
          borderRadius: 20, marginBottom: 20, fontSize: 13, fontWeight: 600,
          background: cloudEnabled ? 'rgba(68,255,68,0.1)' : 'rgba(255,200,68,0.1)',
          border: `1px solid ${cloudEnabled ? 'rgba(68,255,68,0.3)' : 'rgba(255,200,68,0.3)'}`,
          color: cloudEnabled ? 'var(--success, #44ff44)' : '#ffc844',
        }}>
          <span style={{
            width: 8, height: 8, borderRadius: '50%',
            background: cloudEnabled ? 'var(--success, #44ff44)' : '#ffc844',
          }} />
          {cloudEnabled ? 'Cloud sync active' : 'Running — not yet paired'}
        </div>
      )}

      {/* Step 1: Install */}
      {!installed && !installing && (
        <div className="card mb-4" style={{
          border: '2px solid var(--accent)',
          background: 'linear-gradient(135deg, rgba(108,99,255,0.08), rgba(108,99,255,0.02))',
        }}>
          <div className="card-header">
            <h3 style={{ margin: 0 }}>Install Syncthing</h3>
          </div>
          <div style={{ padding: 16 }}>
            <p className="text-muted" style={{ marginBottom: 16 }}>
              Syncthing is the engine behind cloud sync. It's free, open-source, and runs locally — no third-party accounts needed.
            </p>
            <button
              className="btn btn-primary"
              onClick={handleInstall}
              style={{ fontSize: 15, padding: '12px 28px' }}
            >
              ⬇ Install Syncthing
            </button>
          </div>
        </div>
      )}

      {installing && (
        <div className="card mb-4">
          <div className="card-header">
            <h3>Installing Syncthing...</h3>
          </div>
          <div style={{ padding: 16 }}>
            <div style={{ marginBottom: 10, fontSize: 13 }}>{installMsg}</div>
            <div style={{
              height: 8, borderRadius: 4, background: 'var(--bg-tertiary, #333)',
              overflow: 'hidden', width: '100%',
            }}>
              <div style={{
                height: '100%', borderRadius: 4,
                width: `${installPercent}%`,
                background: 'linear-gradient(90deg, var(--accent), rgba(108,99,255,0.7))',
                transition: 'width 0.3s ease',
              }} />
            </div>
          </div>
        </div>
      )}

      {/* Step 2: Start */}
      {installed && !running && (
        <div className="card mb-4" style={{
          border: '2px solid var(--accent)',
          background: 'linear-gradient(135deg, rgba(108,99,255,0.08), rgba(108,99,255,0.02))',
        }}>
          <div className="card-header">
            <h3 style={{ margin: 0 }}>Start Syncthing</h3>
          </div>
          <div style={{ padding: 16 }}>
            <p className="text-muted" style={{ marginBottom: 16 }}>
              Start the sync service. It will auto-start on future app launches once enabled.
            </p>
            <button
              className="btn btn-primary"
              onClick={handleStart}
              disabled={loading}
              style={{ fontSize: 15, padding: '12px 28px' }}
            >
              ▶ Start Syncthing
            </button>
          </div>
        </div>
      )}

      {/* Steps 3-4: Host & Pair (running) */}
      {running && (
        <>
          {/* Host section — show your device ID */}
          <div className="card mb-4">
            <div className="card-header">
              <h3>Host — Share This Device</h3>
            </div>
            <div style={{ padding: 16 }}>
              <p className="text-muted text-sm" style={{ marginBottom: 12 }}>
                Copy this Device ID and paste it into the other machine's OmniEmu or Syncthing to pair.
              </p>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <textarea
                  ref={uninstallRef}
                  readOnly
                  value={status?.deviceId || ''}
                  style={{
                    flex: 1, fontFamily: 'monospace', fontSize: 12, padding: 8,
                    borderRadius: 6, border: '1px solid var(--border, #555)',
                    background: 'var(--bg-tertiary, #222)', color: 'var(--text, #fff)',
                    resize: 'none', height: 48,
                  }}
                />
                <button className="btn btn-primary btn-sm" onClick={handleCopyDeviceId} style={{ whiteSpace: 'nowrap' }}>
                  {copied ? 'Copied!' : 'Copy ID'}
                </button>
              </div>
            </div>
          </div>

          {/* Pair section — connect to another device */}
          <div className="card mb-4">
            <div className="card-header">
              <h3>Pair — Connect Another Device</h3>
            </div>
            <div style={{ padding: 16 }}>
              <p className="text-muted text-sm" style={{ marginBottom: 12 }}>
                Enter the Device ID from another machine to connect. Both devices must add each other.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <input
                  type="text"
                  placeholder="Remote Device ID"
                  value={remoteDeviceId}
                  onChange={e => setRemoteDeviceId(e.target.value)}
                  style={{
                    fontFamily: 'monospace', fontSize: 12, padding: '8px 10px',
                    borderRadius: 6, border: '1px solid var(--border, #555)',
                    background: 'var(--bg-tertiary, #222)', color: 'var(--text, #fff)',
                  }}
                />
                <input
                  type="text"
                  placeholder="Device name (optional)"
                  value={remoteDeviceName}
                  onChange={e => setRemoteDeviceName(e.target.value)}
                  style={{
                    padding: '8px 10px', borderRadius: 6,
                    border: '1px solid var(--border, #555)',
                    background: 'var(--bg-tertiary, #222)', color: 'var(--text, #fff)',
                  }}
                />
                <button
                  className="btn btn-primary"
                  onClick={handleAddDevice}
                  disabled={addingDevice || !remoteDeviceId.trim()}
                  style={{ alignSelf: 'flex-start' }}
                >
                  {addingDevice ? 'Adding...' : '🔗 Pair Device'}
                </button>
              </div>
            </div>
          </div>

          {/* Paired Devices */}
          {status?.remoteDevices && status.remoteDevices.length > 0 && (
            <div className="card mb-4">
              <div className="card-header">
                <h3>Paired Devices</h3>
              </div>
              <div style={{ padding: '0 12px 12px' }}>
                {status.remoteDevices.filter(d => d.id).map(device => (
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
                      <span style={{
                        fontSize: 11, color: device.connected ? 'var(--success, #44ff44)' : 'var(--text-muted, #888)',
                      }}>
                        {device.connected ? 'Connected' : 'Not connected'}
                      </span>
                      <button
                        className="btn btn-danger btn-sm"
                        onClick={() => handleRemoveDevice(device.id)}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Shared Folders */}
          <div className="card mb-4">
            <div className="card-header">
              <h3>Shared Folders</h3>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => setShowAddFolder(!showAddFolder)}
              >
                {showAddFolder ? 'Cancel' : '+ Add Folder'}
              </button>
            </div>
            <div style={{ padding: 12 }}>
              {showAddFolder && (
                <div style={{
                  marginBottom: 12, padding: 12, borderRadius: 8,
                  border: '1px solid var(--border, #555)', background: 'var(--bg-tertiary, #222)',
                }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <input
                      type="text"
                      placeholder="Folder label (e.g. RetroArch Saves)"
                      value={folderLabel}
                      onChange={e => setFolderLabel(e.target.value)}
                      style={{
                        padding: '8px 10px', borderRadius: 6,
                        border: '1px solid var(--border, #555)',
                        background: 'var(--bg-secondary, #1a1a1a)', color: 'var(--text, #fff)',
                      }}
                    />
                    <input
                      type="text"
                      placeholder="Folder path (e.g. ~/Documents/RetroArch/saves)"
                      value={folderPath}
                      onChange={e => setFolderPath(e.target.value)}
                      style={{
                        padding: '8px 10px', borderRadius: 6,
                        border: '1px solid var(--border, #555)',
                        background: 'var(--bg-secondary, #1a1a1a)', color: 'var(--text, #fff)',
                      }}
                    />
                    <button className="btn btn-primary btn-sm" onClick={handleAddFolder} style={{ alignSelf: 'flex-start' }}>
                      Add Shared Folder
                    </button>
                  </div>
                </div>
              )}

              {status?.folders && status.folders.length > 0 ? (
                status.folders.map(folder => (
                  <div key={folder.id} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '8px 10px', borderRadius: 8,
                    border: '1px solid var(--border, #555)', marginBottom: 4,
                    background: 'var(--bg-tertiary, #222)',
                  }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{folder.label}</div>
                      <div className="text-sm text-muted" style={{ fontFamily: 'monospace', fontSize: 10 }}>
                        {folder.path}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span className="badge badge-installed" style={{ fontSize: 10 }}>
                        {folder.type}
                      </span>
                      <button
                        className="btn btn-danger btn-sm"
                        onClick={() => handleRemoveFolder(folder.id)}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-muted text-sm">No shared folders. Add one to start syncing.</p>
              )}
            </div>
          </div>

          {/* Control bar */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '12px 16px', borderRadius: 10,
            background: 'var(--bg-secondary, #1a1a2e)', border: '1px solid var(--border, #333)',
            marginBottom: 16,
          }}>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-secondary btn-sm" onClick={handleOpenWebUI}>
                Open Web UI
              </button>
              <button className="btn btn-secondary btn-sm" onClick={loadStatus} disabled={loading}>
                Refresh
              </button>
            </div>
            <button className="btn btn-danger btn-sm" onClick={handleStop} disabled={loading}>
              Stop Syncthing
            </button>
          </div>

          {/* Advanced */}
          {status?.apiKey && (
            <details style={{ marginBottom: 16 }}>
              <summary style={{
                cursor: 'pointer', fontSize: 13, color: 'var(--text-muted, #888)',
                padding: '8px 0',
              }}>
                Advanced Settings
              </summary>
              <div className="card" style={{ marginTop: 8 }}>
                <div className="card-header">
                  <h3>Advanced</h3>
                </div>
                <div style={{ padding: 12 }}>
                  <p className="text-muted text-sm" style={{ marginBottom: 8 }}>
                    API Key for the Syncthing Web UI.
                  </p>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <code style={{
                      flex: 1, padding: '6px 10px', borderRadius: 6,
                      background: 'var(--bg-tertiary, #222)', fontSize: 11,
                      wordBreak: 'break-all',
                    }}>
                      {status.apiKey}
                    </code>
                    <button className="btn btn-secondary btn-sm" onClick={handleCopyApiKey}>
                      Copy
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
