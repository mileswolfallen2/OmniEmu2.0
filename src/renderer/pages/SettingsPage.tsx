import React, { useEffect, useState } from 'react';
import type { AppSettings } from '../../shared/types';
import { BiosCheckPanel } from '../components/BiosCheckPanel';
import { ReleaseNotesModal } from '../components/ReleaseNotesModal';
import { applyTheme } from '../App';

const systemLabels: Record<string, string> = {
  nes: 'NES', snes: 'SNES', n64: 'N64',
  gb: 'GB', gbc: 'GBC', gba: 'GBA',
  nds: 'NDS', ps1: 'PlayStation', ps2: 'PS2',
  ps3: 'PS3', psp: 'PSP', gc: 'GameCube',
  wii: 'Wii', switch: 'Switch',
  arcade: 'Arcade', pce: 'PC Engine',
  'sega-md': 'Sega Mega Drive',
  'sega-saturn': 'Sega Saturn',
  'sega-dc': 'Sega Dreamcast',
  dreamcast: 'Dreamcast',
};

export function SettingsPage() {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [systemAssignments, setSystemAssignments] = useState<Record<string, string[]> | null>(null);
  const [emuNameMap, setEmuNameMap] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<{
    status: string;
    version?: string;
    releaseNotes?: string;
    message?: string;
    manualLink?: string;
  } | null>(null);
  const [checking, setChecking] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [showReleaseNotes, setShowReleaseNotes] = useState(false);
  const [showAppearance, setShowAppearance] = useState(false);
  const [showExperimental, setShowExperimental] = useState(false);

  useEffect(() => {
    const unsubStatus = window.omni.updates.onStatus((s) => {
      setChecking(false);
      if (s.status === 'available') {
        setUpdateInfo({
          status: 'available',
          version: s.version as string,
          releaseNotes: s.releaseNotes as string | undefined,
        });
      } else if (s.status === 'not-available') {
        setUpdateInfo({ status: 'not-available', version: s.version as string });
      } else if (s.status === 'downloaded') {
        setDownloading(false);
        setUpdateInfo((prev) => prev ? { ...prev, status: 'downloaded' } : null);
      } else if (s.status === 'error') {
        setChecking(false);
        setDownloading(false);
        setUpdateInfo({
          status: 'error',
          message: s.message as string,
          manualLink: s.manualLink as string | undefined,
        });
      }
    });
    const unsubProgress = window.omni.updates.onDownloadProgress((p) => {
      setDownloadProgress(p.percent as number);
    });
    return () => { unsubStatus(); unsubProgress(); };
  }, []);

  useEffect(() => {
    Promise.all([
      window.omni.settings.get(),
      window.omni.emulators.systemAssignments(),
      window.omni.emulators.list(),
    ]).then(([s, assignments, emulators]) => {
      setSettings(s);
      setSystemAssignments(assignments);
      const nameMap: Record<string, string> = {};
      for (const e of emulators) nameMap[e.id] = e.name;
      setEmuNameMap(nameMap);
    });
  }, []);

  const update = async (partial: Partial<AppSettings>) => {
    if (!settings) return;
    setSaving(true);
    const updated = await window.omni.settings.save(partial);
    setSettings(updated);
    setSaving(false);
  };

  const handleCheckUpdates = async () => {
    setChecking(true);
    setUpdateInfo(null);
    await window.omni.updates.check();
  };

  const handleDownloadUpdate = async () => {
    setDownloading(true);
    setDownloadProgress(0);
    await window.omni.updates.download();
  };

  const handleQuitAndInstall = async () => {
    await window.omni.updates.quitAndInstall();
  };

  if (!settings || !systemAssignments) {
    return <div className="loading">Loading settings...</div>;
  }

  const multiSystems = Object.entries(systemAssignments)
    .filter(([, emus]) => emus.length > 1)
    .sort(([a], [b]) => a.localeCompare(b));

  return (
    <div>
      <div className="settings-section">
        <h3>Directories</h3>

        <div className="setting-row">
          <div>
            <div className="setting-label">ROMs Directory</div>
            <div className="setting-desc">
              {settings.romsDirectory || 'Default (~/OmniEmu/roms)'}
            </div>
          </div>
          <button
            className="btn btn-secondary btn-sm"
            onClick={async () => {
              const dir = await window.omni.roms.selectDirectory();
              if (dir) update({ romsDirectory: dir });
            }}
          >
            Browse
          </button>
        </div>

        <div className="setting-row">
          <div>
            <div className="setting-label">Emulators Directory</div>
            <div className="setting-desc">
              {settings.emulatorsDirectory || 'Default (~/OmniEmu/emulators)'}
            </div>
          </div>
          <button
            className="btn btn-secondary btn-sm"
            onClick={async () => {
              const dir = await window.omni.roms.selectDirectory();
              if (dir) update({ emulatorsDirectory: dir });
            }}
          >
            Browse
          </button>
        </div>
      </div>

      <div className="settings-section">
        <h3>BIOS</h3>
        <BiosCheckPanel
          biosDir={settings.biosDirectory}
          onBiosDirChange={(dir) => update({ biosDirectory: dir })}
        />
      </div>

      <div className="settings-section">
        <h3>Emulator Assignments</h3>
        <p className="text-sm text-muted" style={{ marginBottom: 12 }}>
          Choose which emulator handles each system when multiple options exist.
          Re-scan your ROMs after changing these preferences.
        </p>
        {multiSystems.length === 0 ? (
          <p className="text-sm text-muted">No systems with multiple emulator options available.</p>
        ) : (
          multiSystems.map(([system, emus]) => (
            <div className="setting-row" key={system}>
              <div>
                <div className="setting-label">
                  {systemLabels[system] || system}
                </div>
                <div className="setting-desc">
                  {emus.map((e) => emuNameMap[e] || e).join(', ')}
                </div>
              </div>
              <select
                value={settings.systemEmulators?.[system] ?? emus[0]}
                onChange={(e) =>
                  update({
                    systemEmulators: {
                      ...(settings.systemEmulators ?? {}),
                      [system]: e.target.value,
                    },
                  })
                }
              >
                {emus.map((emu) => (
                  <option key={emu} value={emu}>
                    {emuNameMap[emu] || emu}
                  </option>
                ))}
              </select>
            </div>
          ))
        )}
      </div>

      <div className="settings-section clickable-section" onClick={() => setShowAppearance(true)}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3>Appearance</h3>
            <div className="setting-desc" style={{ marginTop: 4 }}>Theme: {settings.theme.charAt(0).toUpperCase() + settings.theme.slice(1)}</div>
          </div>
          <span style={{ color: 'var(--text-muted)', fontSize: 18 }}>&rsaquo;</span>
        </div>
      </div>

      <div className="settings-section clickable-section" onClick={() => setShowExperimental(true)}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3>Experimental</h3>
            <div className="setting-desc" style={{ marginTop: 4 }}>
              Beta emulators, decomp projects, and frontends
            </div>
          </div>
          <span style={{ color: 'var(--text-muted)', fontSize: 18 }}>&rsaquo;</span>
        </div>
      </div>

      <div className="settings-section">
        <h3>Presets</h3>

        <div className="setting-row">
          <div>
            <div className="setting-label">Preset Source URL</div>
            <div className="setting-desc">
              URL to fetch recommended emulator config presets from
            </div>
          </div>
          <input
            type="text"
            value={settings.presetSourceUrl}
            onChange={(e) => update({ presetSourceUrl: e.target.value })}
            style={{ width: 300 }}
          />
        </div>
      </div>

      <div className="settings-section">
        <h3>Behavior</h3>

        <div className="setting-row">
          <div>
            <div className="setting-label">Minimise to tray</div>
            <div className="setting-desc">
              Minimise to system tray instead of taskbar
            </div>
          </div>
          <label className="toggle">
            <input
              type="checkbox"
              checked={settings.minimiseToTray}
              onChange={(e) => update({ minimiseToTray: e.target.checked })}
            />
            <span className="toggle-slider" />
          </label>
        </div>

        <div className="setting-row">
          <div>
            <div className="setting-label">Close to tray</div>
            <div className="setting-desc">
              Closing the window keeps the app running in the tray
            </div>
          </div>
          <label className="toggle">
            <input
              type="checkbox"
              checked={settings.closeToTray}
              onChange={(e) => update({ closeToTray: e.target.checked })}
            />
            <span className="toggle-slider" />
          </label>
        </div>

        <div className="setting-row">
          <div>
            <div className="setting-label">Launch in fullscreen</div>
            <div className="setting-desc">Start the app in fullscreen mode</div>
          </div>
          <label className="toggle">
            <input
              type="checkbox"
              checked={settings.launchInFullscreen}
              onChange={(e) => update({ launchInFullscreen: e.target.checked })}
            />
            <span className="toggle-slider" />
          </label>
        </div>
      </div>

      <div className="settings-section">
        <h3>Updates</h3>
        <div className="setting-row">
          <div>
            <div className="setting-label">Check for updates</div>
            <div className="setting-desc">
              {updateInfo?.status === 'available' && `v${updateInfo.version} available`}
              {updateInfo?.status === 'not-available' && `v${updateInfo.version} — up to date`}
              {updateInfo?.status === 'downloaded' && 'Ready to install — restart the app to apply'}
              {updateInfo?.status === 'error' && updateInfo.manualLink && (
                <span>
                  {updateInfo.message}
                </span>
              )}
              {updateInfo?.status === 'error' && !updateInfo.manualLink && (
                `Error: ${updateInfo.message}`
              )}
              {!updateInfo && 'Check GitHub for new releases'}
            </div>
          </div>
          {updateInfo?.status === 'error' && updateInfo.manualLink ? (
            <button
              className="btn btn-primary btn-sm"
              onClick={() => window.open(updateInfo.manualLink!, '_blank')}
            >
              Manual Download
            </button>
          ) : updateInfo?.status !== 'downloaded' ? (
            <button
              className="btn btn-secondary btn-sm"
              disabled={checking || downloading}
              onClick={handleCheckUpdates}
            >
              {checking ? 'Checking...' : updateInfo ? 'Check Again' : 'Check'}
            </button>
          ) : (
            <button
              className="btn btn-primary btn-sm"
              onClick={handleQuitAndInstall}
            >
              Restart & Install
            </button>
          )}
        </div>
        {updateInfo?.status === 'available' && (
          <div className="setting-row">
            <div>
              <div className="setting-label">
                {downloading ? `Downloading... ${downloadProgress}%` : 'Download update'}
              </div>
              <div className="setting-desc">
                {downloading
                  ? `Downloading v${updateInfo.version}`
                  : downloadProgress > 0
                    ? `Downloaded ${downloadProgress}%`
                    : `v${updateInfo.version} will be downloaded and installed on restart`}
              </div>
            </div>
            <button
              className="btn btn-primary btn-sm"
              disabled={downloading || downloadProgress > 0}
              onClick={handleDownloadUpdate}
            >
              {downloading ? `${downloadProgress}%` : downloadProgress > 0 ? 'Downloading...' : 'Download'}
            </button>
          </div>
        )}
        {updateInfo?.releaseNotes && (
          <div style={{ marginTop: 8 }}>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => setShowReleaseNotes(true)}
            >
              View Release Notes
            </button>
          </div>
        )}

        {showReleaseNotes && updateInfo?.releaseNotes && (
          <ReleaseNotesModal
            version={updateInfo.version || ''}
            releaseNotes={
              typeof updateInfo.releaseNotes === 'string'
                ? updateInfo.releaseNotes
                : JSON.stringify(updateInfo.releaseNotes, null, 2)
            }
            onClose={() => setShowReleaseNotes(false)}
          />
        )}
      </div>

      <div className="settings-section">
        <h3>About</h3>
        <p className="text-sm text-muted">
          OmniEmu v{updateInfo?.version || '0.3.2'} · Cross-platform emulator manager
          <br />
          Built with Electron + React + TypeScript
        </p>
      </div>

      <div className="settings-section" style={{ borderColor: 'var(--error)' }}>
        <h3 style={{ color: 'var(--error)' }}>Danger Zone</h3>
        <p className="text-sm text-muted" style={{ marginBottom: 12 }}>
          Delete all installed emulators, downloaded data, Syncthing config, and reset settings to defaults. Your ROMs will not be affected.
        </p>
        <button
          className="btn btn-danger"
          onClick={async () => {
            if (!confirm('This will delete all emulators, settings, and app data. Your ROMs are safe. Continue?')) return;
            if (!confirm('Are you really sure? This cannot be undone.')) return;
            await window.omni.app.nukeData();
            window.location.reload();
          }}
        >
          Wipe All Data
        </button>
      </div>

      {/* ── Appearance Panel ─────────────────────────────── */}
      {showAppearance && (
        <div className="modal-overlay" onClick={() => setShowAppearance(false)}>
          <div className="settings-panel" onClick={(e) => e.stopPropagation()}>
            <div className="settings-panel-header">
              <h2>Appearance</h2>
              <button className="btn btn-secondary btn-sm" onClick={() => setShowAppearance(false)}>Close</button>
            </div>
            <p className="text-sm text-muted" style={{ marginBottom: 16 }}>
              Select your preferred theme. Changes apply instantly.
            </p>
            <div className="theme-grid">
              {([
                { id: 'dark', name: 'Dark', accent: '#00d4ff', bg: '#0a0a18', secondary: '#ff0080', text: '#e8f4ff' },
                { id: 'light', name: 'Light', accent: '#0099e5', bg: '#f0f4f8', secondary: '#e5007e', text: '#1a1a2e' },
                { id: 'midnight', name: 'Midnight', accent: '#06b6d4', bg: '#050814', secondary: '#06b6d4', text: '#e0f0ff' },
                { id: 'ember', name: 'Ember', accent: '#ff6b35', bg: '#120a08', secondary: '#ff356b', text: '#fff4e8' },
                { id: 'lavender', name: 'Lavender', accent: '#b868ff', bg: '#0c0818', secondary: '#ff68b8', text: '#f4e8ff' },
                { id: 'jade', name: 'Jade', accent: '#20d0a0', bg: '#08100c', secondary: '#d0a020', text: '#e8f8f0' },
              ]).map((t) => (
                <button
                  key={t.id}
                  className={`theme-swatch ${settings.theme === t.id ? 'active' : ''}`}
                  onClick={() => {
                    applyTheme(t.id as AppSettings['theme']);
                    update({ theme: t.id as AppSettings['theme'] });
                  }}
                >
                  <div
                    className="theme-swatch-preview"
                    style={{ background: t.bg, border: settings.theme === t.id ? `2px solid ${t.accent}` : '2px solid rgba(255,255,255,0.08)' }}
                  >
                    <div className="theme-swatch-preview-bar" style={{ background: t.secondary }}>
                      <span style={{ color: t.text, fontSize: 10, fontWeight: 700 }}>OmniEmu</span>
                    </div>
                    <div style={{ padding: '6px 8px' }}>
                      <div style={{ height: 6, width: '70%', background: t.accent, borderRadius: 3, marginBottom: 4 }} />
                      <div style={{ height: 4, width: '50%', background: `${t.text}40`, borderRadius: 2 }} />
                    </div>
                    <div className="theme-swatch-preview-dots">
                      <span style={{ background: t.accent }} />
                      <span style={{ background: t.secondary }} />
                      <span style={{ background: `${t.text}60` }} />
                    </div>
                  </div>
                  <span className="theme-swatch-name" style={{ color: settings.theme === t.id ? t.accent : 'var(--text-secondary)' }}>
                    {t.name}
                  </span>
                  {settings.theme === t.id && <span className="theme-swatch-check" style={{ color: t.accent }}>&#10003;</span>}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Experimental Panel ───────────────────────────── */}
      {showExperimental && (
        <div className="modal-overlay" onClick={() => setShowExperimental(false)}>
          <div className="settings-panel" onClick={(e) => e.stopPropagation()}>
            <div className="settings-panel-header">
              <h2>Experimental</h2>
              <button className="btn btn-secondary btn-sm" onClick={() => setShowExperimental(false)}>Close</button>
            </div>
            <p className="text-sm text-muted" style={{ marginBottom: 16 }}>
              Toggle individual beta features on or off. These features are under active development and may be unstable.
            </p>

            <div className="experimental-features">
              <div className="experimental-feature">
                <div className="experimental-feature-info">
                  <div className="experimental-feature-label">Frontend Support</div>
                  <div className="experimental-feature-desc">
                    Launch alternative frontends directly from OmniEmu for a more console-like experience.
                  </div>
                </div>
                <label className="toggle">
                  <input
                    type="checkbox"
                    checked={!!settings.frontendSupport}
                    onChange={(e) => update({ frontendSupport: e.target.checked })}
                  />
                  <span className="toggle-slider" />
                </label>
              </div>

              <div className="experimental-feature">
                <div className="experimental-feature-info">
                  <div className="experimental-feature-label">Beta Emulators</div>
                  <div className="experimental-feature-desc">Unlocks additional experimental emulators beyond the stable set</div>
                </div>
                <label className="toggle">
                  <input
                    type="checkbox"
                    checked={!!settings.betaFeatures}
                    onChange={(e) => update({ betaFeatures: e.target.checked })}
                  />
                  <span className="toggle-slider" />
                </label>
              </div>

              <div className="experimental-feature">
                <div className="experimental-feature-info">
                  <div className="experimental-feature-label">Decomp Projects</div>
                  <div className="experimental-feature-desc">Native PC ports from reverse-engineered source (Ship of Harkinian, SM64, and more)</div>
                </div>
                <label className="toggle">
                  <input
                    type="checkbox"
                    checked={!!settings.decompProjects}
                    onChange={(e) => update({ decompProjects: e.target.checked })}
                  />
                  <span className="toggle-slider" />
                </label>
              </div>

              <div className="experimental-feature">
                <div className="experimental-feature-info">
                  <div className="experimental-feature-label">Remote Presets</div>
                  <div className="experimental-feature-desc">Fetch recommended config presets from a remote URL</div>
                </div>
                <label className="toggle">
                  <input
                    type="checkbox"
                    checked={!!settings.remotePresets}
                    onChange={(e) => update({ remotePresets: e.target.checked })}
                  />
                  <span className="toggle-slider" />
                </label>
              </div>

              <div className="experimental-feature">
                <div className="experimental-feature-info">
                  <div className="experimental-feature-label">Cloud Sync</div>
                  <div className="experimental-feature-desc">Sync save files between devices via Syncthing</div>
                </div>
                <label className="toggle">
                  <input
                    type="checkbox"
                    checked={!!settings.cloudSyncEnabled}
                    onChange={async (e) => {
                      const on = e.target.checked;
                      if (on) {
                        try { await window.omni.cloud.start(); } catch { /* retry on next launch */ }
                      } else {
                        try { await window.omni.cloud.stop(); } catch { /* best effort */ }
                      }
                      update({ cloudSyncEnabled: on });
                    }}
                  />
                  <span className="toggle-slider" />
                </label>
              </div>

            </div>
          </div>
        </div>
      )}
    </div>
  );
}
