import React, { useEffect, useState, useCallback } from 'react';

interface BiosEntry {
  emulators: string[];
  platform: string;
  files: string[];
  name: string;
}

interface BiosCheckResult {
  entry: BiosEntry;
  present: boolean;
  foundFiles: string[];
  directory: string;
}

interface Props {
  biosDir: string;
  onBiosDirChange: (dir: string) => void;
}

export function BiosCheckPanel({ biosDir, onBiosDirChange }: Props) {
  const [results, setResults] = useState<BiosCheckResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [retroarchConfigMsg, setRetroarchConfigMsg] = useState('');

  const scan = useCallback(async (dir?: string) => {
    setLoading(true);
    const res = await window.omni.bios.scan(dir);
    setResults(res);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (biosDir) scan(biosDir);
  }, [biosDir, scan]);

  const presentCount = results.filter(r => r.present).length;
  const totalCount = results.length;

  const handleSelectDir = async () => {
    const dir = await window.omni.bios.selectDirectory();
    if (dir) {
      onBiosDirChange(dir);
      scan(dir);
    }
  };

  const handleConfigureRetroarch = async () => {
    const info = await window.omni.system.info();
    const homeDir = info.homeDir;
    const configDir = homeDir + '/Library/Application Support/RetroArch';
    const ok = await window.omni.bios.configureRetroArch(configDir, biosDir);
    setRetroarchConfigMsg(ok ? 'RetroArch BIOS path updated' : 'Failed to update RetroArch config');
    setTimeout(() => setRetroarchConfigMsg(''), 4000);
  };

  return (
    <div>
      <div className="setting-row">
        <div>
          <div className="setting-label">BIOS Directory</div>
          <div className="setting-desc">
            {biosDir || 'Not set — default locations will be scanned'}
          </div>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={handleSelectDir}>
          Browse
        </button>
      </div>

      {retroarchConfigMsg && (
        <div className="info-bar" style={{ color: 'var(--success)', marginBottom: 8 }}>
          {retroarchConfigMsg}
        </div>
      )}

      {loading && <div className="loading">Scanning BIOS files...</div>}

      {!loading && results.length > 0 && (
        <div style={{ marginTop: 8 }}>
          <div className="info-bar">
            <span>{presentCount} of {totalCount} BIOS files found</span>
            <button className="btn btn-secondary btn-sm" onClick={() => scan()}>
              Rescan
            </button>
            <button className="btn btn-primary btn-sm" onClick={handleConfigureRetroarch}>
              Update RetroArch BIOS Path
            </button>
          </div>

          <div className="bios-grid" style={{ marginTop: 8 }}>
            {results.map((r, i) => (
              <div key={i} className={`bios-entry ${r.present ? 'present' : 'missing'}`}>
                <div className="bios-entry-header">
                  <span className={`bios-indicator ${r.present ? 'present' : 'missing'}`}>
                    {r.present ? '✓' : '✗'}
                  </span>
                  <span className="bios-entry-name">{r.entry.name}</span>
                  <span className="platform-tag">{r.entry.platform}</span>
                </div>
                <div className="bios-entry-files">
                  {r.entry.files.map(f => (
                    <span key={f} className={`bios-file ${r.foundFiles.includes(f) ? 'found' : ''}`}>
                      {f}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {!loading && results.length === 0 && !biosDir && (
        <p className="text-sm text-muted mt-2">
          Select a BIOS directory to scan for required firmware files.
        </p>
      )}
    </div>
  );
}
