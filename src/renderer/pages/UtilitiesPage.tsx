import React, { useState, useEffect } from 'react';

export function UtilitiesPage() {
  const [regenerating, setRegenerating] = useState(false);
  const [raUsername, setRaUsername] = useState('');
  const [raPassword, setRaPassword] = useState('');
  const [raApiKey, setRaApiKey] = useState('');
  const [raResults, setRaResults] = useState<Record<string, boolean> | null>(null);
  const [saving, setSaving] = useState(false);
  const [sgdbKey, setSgdbKey] = useState('');
  const [sgdbSaved, setSgdbSaved] = useState(false);

  useEffect(() => {
    window.omni.settings.get().then((s) => {
      setRaUsername(s.retroAchievementsUsername || '');
      setRaPassword(s.retroAchievementsPassword || '');
      setRaApiKey(s.retroAchievementsApiKey || '');
      setSgdbKey(s.steamGridDbApiKey || '');
    });
  }, []);

  const handleRecreate = async () => {
    setRegenerating(true);
    await window.omni.utilities.regenerateRomsStructure();
    setTimeout(() => setRegenerating(false), 1500);
  };

  const handleRaSave = async () => {
    setSaving(true);
    setRaResults(null);
    try {
      await window.omni.settings.save({
        retroAchievementsUsername: raUsername,
        retroAchievementsPassword: raPassword,
        retroAchievementsApiKey: raApiKey,
      });
      const results = await window.omni.retroachievements.save(raUsername, raPassword);
      setRaResults(results);
    } catch {
      setRaResults({});
    }
    setTimeout(() => setSaving(false), 500);
  };

  const emuLabels: Record<string, string> = {
    retroarch: 'RetroArch',
    pcsx2: 'PCSX2',
    duckstation: 'DuckStation',
    flycast: 'Flycast',
    melonds: 'melonDS',
  };

  return (
    <div>
      <div className="settings-section">
        <h3>ROM Folder Structure</h3>

        <div className="setting-row">
          <div>
            <div className="setting-label">Regenerate ROM folders</div>
            <div className="setting-desc">
              Recreate the ~/Documents/roms/ folder and all system
              subdirectories if any were deleted.
            </div>
          </div>
          <button
            className="btn btn-secondary btn-sm"
            disabled={regenerating}
            onClick={handleRecreate}
          >
            {regenerating ? 'Done!' : 'Recreate'}
          </button>
        </div>
      </div>

      <div className="settings-section">
        <h3>RetroAchievements</h3>
        <p className="text-sm text-muted" style={{ marginBottom: 12 }}>
          Enable RetroAchievements across all supported emulators and view
          per-game achievements in the game detail modal. The username and
          password are used to configure emulators; the Web API Key (from
          retroachievements.org/settings) is used to fetch achievement data.
        </p>

        <div className="setting-row">
          <div>
            <div className="setting-label">Username</div>
          </div>
          <input
            type="text"
            className="input"
            value={raUsername}
            onChange={(e) => setRaUsername(e.target.value)}
            placeholder="your RetroAchievements username"
            style={{ width: 240 }}
          />
        </div>

        <div className="setting-row">
          <div>
            <div className="setting-label">Password</div>
          </div>
          <input
            type="password"
            className="input"
            value={raPassword}
            onChange={(e) => setRaPassword(e.target.value)}
            placeholder="your RetroAchievements password"
            style={{ width: 240 }}
          />
        </div>

        <div className="setting-row">
          <div>
            <div className="setting-label">Web API Key</div>
            <div className="setting-desc">
              From retroachievements.org/settings
            </div>
          </div>
          <input
            type="password"
            className="input"
            value={raApiKey}
            onChange={(e) => setRaApiKey(e.target.value)}
            placeholder="your Web API Key"
            style={{ width: 240 }}
          />
        </div>

        <div className="setting-row">
          <div />
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button
              className="btn btn-primary btn-sm"
              disabled={saving || !raUsername || !raPassword}
              onClick={handleRaSave}
            >
              {saving ? 'Saving...' : 'Save & Apply'}
            </button>

            {raResults && (
              <div style={{ fontSize: 13 }}>
                {Object.keys(raResults).length === 0 ? (
                  <span style={{ color: 'var(--error)' }}>Failed to apply</span>
                ) : (
                  Object.entries(raResults).map(([emu, ok]) => (
                    <span
                      key={emu}
                      style={{
                        color: ok ? 'var(--success)' : 'var(--error)',
                        marginRight: 10,
                      }}
                    >
                      {emuLabels[emu] || emu}: {ok ? '✓' : '✗'}
                    </span>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="settings-section">
        <h3>SteamGridDB Cover Art</h3>
        <p className="text-sm text-muted" style={{ marginBottom: 12 }}>
          Search and pick cover art from SteamGridDB. Get a free API key at{' '}
          <a href="https://www.steamgriddb.com/profile/preferences" target="_blank" rel="noreferrer">
            steamgriddb.com/profile/preferences
          </a>.
        </p>

        <div className="setting-row">
          <div>
            <div className="setting-label">API Key</div>
          </div>
          <input
            type="password"
            className="input"
            value={sgdbKey}
            onChange={(e) => { setSgdbKey(e.target.value); setSgdbSaved(false); }}
            placeholder="your SteamGridDB API key"
            style={{ width: 240 }}
          />
        </div>

        <div className="setting-row">
          <div />
          <button
            className="btn btn-primary btn-sm"
            onClick={async () => {
              await window.omni.settings.save({ steamGridDbApiKey: sgdbKey });
              setSgdbSaved(true);
            }}
          >
            {sgdbSaved ? 'Saved!' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}