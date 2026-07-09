import React, { useEffect, useState } from 'react';
import type { AppSettings } from '../../shared/types';

export function SettingsPage() {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    window.omni.settings.get().then(setSettings);
  }, []);

  const update = async (partial: Partial<AppSettings>) => {
    if (!settings) return;
    setSaving(true);
    const updated = await window.omni.settings.save(partial);
    setSettings(updated);
    setSaving(false);
  };

  if (!settings) {
    return <div className="loading">Loading settings...</div>;
  }

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
        <h3>Appearance</h3>

        <div className="setting-row">
          <div>
            <div className="setting-label">Theme</div>
            <div className="setting-desc">Application color scheme</div>
          </div>
          <select
            value={settings.theme}
            onChange={(e) =>
              update({ theme: e.target.value as AppSettings['theme'] })
            }
          >
            <option value="dark">Dark</option>
            <option value="light">Light</option>
            <option value="system">System</option>
          </select>
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
        <h3>About</h3>
        <p className="text-sm text-muted">
          OmniEmu v0.1.0 · Cross-platform emulator manager
          <br />
          Built with Electron + React + TypeScript
        </p>
      </div>
    </div>
  );
}
