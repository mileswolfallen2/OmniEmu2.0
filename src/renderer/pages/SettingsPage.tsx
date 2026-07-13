import React, { useEffect, useState } from 'react';
import type { AppSettings, EmulatorConfig } from '../../shared/types';
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

      <div className="settings-section">
        <h3>Appearance</h3>

        <div className="setting-row">
          <div>
            <div className="setting-label">Theme</div>
            <div className="setting-desc">Application color scheme</div>
          </div>
          <select
            value={settings.theme}
            onChange={(e) => {
              const t = e.target.value as AppSettings['theme'];
              applyTheme(t);
              update({ theme: t });
            }}
          >
            <option value="dark">Dark</option>
            <option value="light">Light</option>
            <option value="system">System</option>
          </select>
        </div>
      </div>

      <div className="settings-section">
        <h3>Experimental</h3>

        <div className="setting-row">
          <div>
            <div className="setting-label">Enable Beta Features</div>
            <div className="setting-desc">
              Unlocks experimental emulators and frontends (ES-DE, NeoStation)
            </div>
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
          OmniEmu v{updateInfo?.version || '0.1.3'} · Cross-platform emulator manager
          <br />
          Built with Electron + React + TypeScript
        </p>
      </div>
    </div>
  );
}
