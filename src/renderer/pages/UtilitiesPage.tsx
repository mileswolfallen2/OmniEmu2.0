import React, { useState, useEffect, useRef } from 'react';

interface FilterPreset {
  id: string;
  name: string;
  description: string;
}

export function UtilitiesPage() {
  const [regenerating, setRegenerating] = useState(false);
  const [raUsername, setRaUsername] = useState('');
  const [raPassword, setRaPassword] = useState('');
  const [raApiKey, setRaApiKey] = useState('');
  const [raResults, setRaResults] = useState<Record<string, boolean> | null>(null);
  const [saving, setSaving] = useState(false);
  const [sgdbKey, setSgdbKey] = useState('');
  const [sgdbSaved, setSgdbSaved] = useState(false);
  const [autoApplying, setAutoApplying] = useState(false);
  const [autoApplyProgress, setAutoApplyProgress] = useState<{ current: number; total: number; title: string } | null>(null);
  const [autoApplyResult, setAutoApplyResult] = useState<{ total: number; alreadyHadCover: number; applied: number; failed: number; skippedNoKey?: boolean } | null>(null);
  const [clearingCovers, setClearingCovers] = useState(false);
  const [filterPresets, setFilterPresets] = useState<FilterPreset[]>([]);
  const [applyingFilter, setApplyingFilter] = useState<string | null>(null);
  const [filterResult, setFilterResult] = useState<{ message: string; ok: boolean } | null>(null);
  const [applyingAll, setApplyingAll] = useState(false);
  const [applyAllResult, setApplyAllResult] = useState<string | null>(null);
  const timerRefs = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clearTimer = (ref: ReturnType<typeof setTimeout>) => {
    clearTimeout(ref);
    const idx = timerRefs.current.indexOf(ref);
    if (idx >= 0) timerRefs.current.splice(idx, 1);
  };

  const addTimer = (ms: number, cb: () => void): ReturnType<typeof setTimeout> => {
    const t = setTimeout(() => {
      const idx = timerRefs.current.indexOf(t);
      if (idx >= 0) timerRefs.current.splice(idx, 1);
      cb();
    }, ms);
    timerRefs.current.push(t);
    return t;
  };

  useEffect(() => { return () => { timerRefs.current.forEach(clearTimeout); }; }, []);

  useEffect(() => {
    window.omni.settings.get().then((s) => {
      setRaUsername(s.retroAchievementsUsername || '');
      setRaPassword(s.retroAchievementsPassword || '');
      setRaApiKey(s.retroAchievementsApiKey || '');
      setSgdbKey(s.steamGridDbApiKey || '');
    }).catch(() => { /* ignore */ });
    window.omni.filters.list().then(setFilterPresets).catch(() => { /* ignore */ });
  }, []);

  const handleRecreate = async () => {
    setRegenerating(true);
    await window.omni.utilities.regenerateRomsStructure();
    addTimer(1500, () => setRegenerating(false));
  };

  const handleAutoApply = async () => {
    setAutoApplying(true);
    setAutoApplyResult(null);
    setAutoApplyProgress(null);
    const unsub = window.omni.game.onAutoApplyCoversProgress((p) => {
      setAutoApplyProgress(p);
    });
    try {
      const result = await window.omni.game.autoApplyCovers();
      setAutoApplyResult(result);
    } catch {
      setAutoApplyResult(null);
    }
    unsub();
    setAutoApplying(false);
    setAutoApplyProgress(null);
  };

  const handleApplyFilter = async (presetId: string) => {
    setApplyingFilter(presetId);
    setFilterResult(null);
    try {
      const result = await window.omni.filters.apply(presetId);
      setFilterResult({ message: result.message, ok: result.success });
    } catch {
      setFilterResult({ message: 'Failed to apply filter', ok: false });
    }
    addTimer(2500, () => { setApplyingFilter(null); setFilterResult(null); });
  };

  const handleApplyAll = async () => {
    setApplyingAll(true);
    setApplyAllResult(null);
    try {
      const results = await window.omni.emulators.applyRecommendedAll(true);
      const ok = results.filter(r => r.ok).length;
      const fail = results.length - ok;
      setApplyAllResult(fail === 0 ? `Applied to ${ok} emulator${ok !== 1 ? 's' : ''} (fullscreen enabled)` : `Applied to ${ok}, failed on ${fail}`);
    } catch {
      setApplyAllResult('Failed to apply settings');
    }
    addTimer(3000, () => { setApplyingAll(false); setApplyAllResult(null); });
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
    addTimer(500, () => setSaving(false));
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

      <div className="settings-section">
        <h3>Auto Apply Covers</h3>
        <p className="text-sm text-muted" style={{ marginBottom: 12 }}>
          Automatically search SteamGridDB for every ROM in your library that
          doesn't have cover art and download the first match. Requires a
          SteamGridDB API key above.
        </p>

        <div className="setting-row">
          <div>
            {autoApplyProgress && (
              <div className="setting-desc">
                {autoApplyProgress.title} ({autoApplyProgress.current}/{autoApplyProgress.total})
              </div>
            )}
          </div>
          <button
            className="btn btn-secondary btn-sm"
            disabled={autoApplying || !sgdbKey}
            onClick={handleAutoApply}
          >
            {autoApplying ? 'Running...' : 'Auto Apply Covers'}
          </button>
        </div>

        {autoApplyResult && (
          <div style={{ fontSize: 13, marginTop: 8 }}>
            {autoApplyResult.skippedNoKey ? (
              <span style={{ color: 'var(--error)' }}>No SteamGridDB API key set</span>
            ) : (
              <>
                <span style={{ color: 'var(--muted)', marginRight: 10 }}>{autoApplyResult.total} ROMs scanned</span>
                <span style={{ color: 'var(--muted)', marginRight: 10 }}>{autoApplyResult.alreadyHadCover} already had covers</span>
                <span style={{ color: 'var(--success)', marginRight: 10 }}>{autoApplyResult.applied} applied</span>
                {autoApplyResult.failed > 0 && (
                  <span style={{ color: 'var(--error)' }}>{autoApplyResult.failed} failed</span>
                )}
              </>
            )}
          </div>
        )}
      </div>

      <div className="settings-section">
        <h3>Recommended Filters</h3>
        <p className="text-sm text-muted" style={{ marginBottom: 12 }}>
          Apply video filters and shaders to RetroArch. CRT shaders are
          downloaded from the libretro shader repository on first use.
        </p>

        {filterPresets.map((preset) => (
          <div className="setting-row" key={preset.id}>
            <div>
              <div className="setting-label">{preset.name}</div>
              <div className="setting-desc">{preset.description}</div>
            </div>
            <button
              className="btn btn-secondary btn-sm"
              disabled={applyingFilter !== null}
              onClick={() => handleApplyFilter(preset.id)}
            >
              {applyingFilter === preset.id ? 'Applied!' : 'Apply'}
            </button>
          </div>
        ))}

        {filterResult && (
          <div style={{ fontSize: 13, marginTop: 8, color: filterResult.ok ? 'var(--success)' : 'var(--error)' }}>
            {filterResult.message}
          </div>
        )}
      </div>

      <div className="settings-section">
        <h3>Apply Recommended Settings</h3>
        <p className="text-sm text-muted" style={{ marginBottom: 12 }}>
          Apply the recommended configuration preset to every installed emulator
          at once with fullscreen enabled. This writes optimal defaults for
          video, audio, and input.
        </p>

        <div className="setting-row">
          <div />
          <button
            className="btn btn-primary btn-sm"
            disabled={applyingAll}
            onClick={handleApplyAll}
          >
            {applyingAll ? 'Applying...' : 'Apply to All Emulators'}
          </button>
        </div>

        {applyAllResult && (
          <div style={{ fontSize: 13, marginTop: 8, color: 'var(--success)' }}>
            {applyAllResult}
          </div>
        )}
      </div>

      <div className="settings-section">
        <h3 style={{ color: 'var(--error)' }}>Danger Zone</h3>

        <div className="setting-row">
          <div>
            <div className="setting-label">Clear game covers</div>
            <div className="setting-desc">
              Remove all downloaded cover art. Covers will be re-fetched from
              SteamGridDB or libretro-thumbnails when you re-scrape.
            </div>
          </div>
          <button
            className="btn btn-sm"
            style={{ background: 'var(--error)', color: '#fff' }}
            disabled={clearingCovers}
            onClick={async () => {
              if (!window.confirm('Are you sure you want to clear all game covers? This cannot be undone.')) return;
              setClearingCovers(true);
              await window.omni.game.clearCoverCache();
              addTimer(1500, () => setClearingCovers(false));
            }}
          >
            {clearingCovers ? 'Cleared!' : 'Clear Covers'}
          </button>
        </div>
      </div>
    </div>
  );
}