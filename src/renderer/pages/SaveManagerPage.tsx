import React, { useEffect, useState, useCallback } from 'react';
import type { GameEntry, EmulatorSaves, SaveEntry } from '../../shared/types';

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function matchScore(gameTitle: string, saveName: string): number {
  const g = normalize(gameTitle);
  const s = normalize(saveName);
  if (!g || !s) return 0;
  if (s === g) return 100;
  if (s.includes(g) || g.includes(s)) return 80;
  const gWords = g.split(/\s+/);
  let matched = 0;
  for (const w of gWords) {
    if (w.length > 2 && s.includes(w)) matched++;
  }
  return matched > 0 ? Math.round((matched / gWords.length) * 60) : 0;
}

interface GameSaves {
  game: GameEntry;
  saves: SaveEntry[];
}

export function SaveManagerPage() {
  const [games, setGames] = useState<GameEntry[]>([]);
  const [allSaves, setAllSaves] = useState<EmulatorSaves[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedGame, setExpandedGame] = useState<string | null>(null);
  const [status, setStatus] = useState('');
  const [view, setView] = useState<'games' | 'emulators'>('games');

  const loadData = useCallback(async () => {
    setLoading(true);
    const [settings, saves] = await Promise.all([
      window.omni.settings.get(),
      window.omni.saves.list(),
    ]);
    setAllSaves(saves);
    if (settings.romsDirectory) {
      const roms = await window.omni.roms.scan(settings.romsDirectory);
      setGames(roms);
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const showStatus = (msg: string) => {
    setStatus(msg);
    setTimeout(() => setStatus(''), 3000);
  };

  const allSaveFiles = allSaves.flatMap(e => e.saves);

  const gameSaves: GameSaves[] = games.map(game => {
    const matching: SaveEntry[] = [];
    for (const save of allSaveFiles) {
      const score = matchScore(game.title, save.gameName);
      if (score >= 50) matching.push(save);
    }
    return { game, saves: matching };
  }).filter(gs => gs.saves.length > 0)
    .sort((a, b) => b.saves.length - a.saves.length);

  const unmatchedSaves = allSaveFiles.filter(save => {
    return !games.some(game => matchScore(game.title, save.gameName) >= 50);
  });

  const totalSaves = allSaveFiles.length;

  const handleDelete = async (entry: SaveEntry) => {
    if (!confirm(`Delete ${entry.fileName}?`)) return;
    const ok = await window.omni.saves.delete(entry.filePath);
    if (ok) {
      showStatus(`Deleted ${entry.fileName}`);
      loadData();
    }
  };

  const handleBackup = async (entry: SaveEntry) => {
    const path = await window.omni.saves.backup(entry.filePath);
    if (path) {
      showStatus(`Backed up to ${path}`);
    } else {
      showStatus('Backup failed');
    }
  };

  const handleOpenEmuFolder = (emu: EmulatorSaves) => {
    window.omni.saves.openFolder(emu.saveDir);
  };

  return (
    <div>
      <div className="info-bar mb-4" style={{ justifyContent: 'space-between' }}>
        <span>{totalSaves} save file{totalSaves !== 1 ? 's' : ''} found</span>
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            className={`btn btn-sm ${view === 'games' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setView('games')}
          >
            By Game
          </button>
          <button
            className={`btn btn-sm ${view === 'emulators' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setView('emulators')}
          >
            By Emulator
          </button>
          <button className="btn btn-secondary btn-sm" onClick={loadData}>
            Refresh
          </button>
        </div>
      </div>

      {status && (
        <div className="info-bar mb-4" style={{ color: 'var(--success)' }}>
          {status}
        </div>
      )}

      {loading && <div className="loading">Scanning save directories...</div>}

      {!loading && totalSaves === 0 && (
        <div className="empty-state">
          <div className="empty-state-icon">💾</div>
          <h3>No save files found</h3>
          <p>Saves will appear here once you play games through configured emulators.</p>
        </div>
      )}

      {!loading && view === 'games' && totalSaves > 0 && (
        <>
          {gameSaves.length > 0 && (
            <>
              <h3 className="mb-2" style={{ fontSize: 16, fontWeight: 600 }}>
                Games with Saves ({gameSaves.length})
              </h3>
              <div className="library-grid mb-4">
                {gameSaves.map(({ game, saves }) => (
                  <div
                    key={game.id}
                    className="game-card"
                    tabIndex={0}
                    role="button"
                    onClick={() => setExpandedGame(expandedGame === game.id ? null : game.id)}
                  >
                    <div className="game-card-cover">
                      {game.coverUrl ? (
                        <img
                          src={game.coverUrl}
                          alt={game.title}
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                        />
                      ) : (
                        <span style={{ fontSize: 32 }}>{game.platform.slice(0, 2).toUpperCase()}</span>
                      )}
                    </div>
                    <div className="game-card-info">
                      <div className="game-card-title">{game.title}</div>
                      <div className="game-card-platform">
                        {saves.length} save{saves.length !== 1 ? 's' : ''} · {game.platform.toUpperCase()}
                      </div>
                    </div>

                    {expandedGame === game.id && (
                      <div style={{ width: '100%', padding: '8px 0 0', borderTop: '1px solid var(--border)', marginTop: 8 }}>
                        {saves.map((save) => (
                          <SaveRow
                            key={save.id}
                            save={save}
                            onDelete={handleDelete}
                            onBackup={handleBackup}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}

          {unmatchedSaves.length > 0 && (
            <>
              <h3 className="mb-2" style={{ fontSize: 16, fontWeight: 600 }}>
                Other Saves ({unmatchedSaves.length})
              </h3>
              <div className="card mb-4">
                <div style={{ padding: 12 }}>
                  {unmatchedSaves.map((save) => (
                    <SaveRow
                      key={save.id}
                      save={save}
                      onDelete={handleDelete}
                      onBackup={handleBackup}
                    />
                  ))}
                </div>
              </div>
            </>
          )}
        </>
      )}

      {!loading && view === 'emulators' && totalSaves > 0 && (
        allSaves.map((emu) => (
          <div key={emu.emulatorId} className="card mb-4">
            <div className="card-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <h3>{emu.emulatorName}</h3>
                <span className="badge badge-installed">
                  {emu.saves.length} file{emu.saves.length !== 1 ? 's' : ''}
                </span>
              </div>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => handleOpenEmuFolder(emu)}
              >
                Open Folder
              </button>
            </div>
            {emu.saves.length === 0 ? (
              <p className="text-sm text-muted" style={{ padding: '0 12px 12px' }}>No saves.</p>
            ) : (
              <div style={{ padding: '0 12px 12px' }}>
                {emu.saves.map((save) => (
                  <SaveRow
                    key={save.id}
                    save={save}
                    onDelete={handleDelete}
                    onBackup={handleBackup}
                  />
                ))}
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );
}

function SaveRow({ save, onDelete, onBackup }: {
  save: SaveEntry;
  onDelete: (s: SaveEntry) => void;
  onBackup: (s: SaveEntry) => void;
}) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      padding: '8px 10px',
      borderRadius: 8,
      border: '1px solid var(--border)',
      marginBottom: 4,
      background: 'var(--bg-tertiary)',
    }}>
      <span style={{ fontSize: 16, flexShrink: 0 }}>
        {save.type === 'state' ? '⏱️' : '💾'}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {save.gameName}
        </div>
        <div className="text-sm text-muted" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {save.fileName} · {formatSize(save.fileSize)} · {formatDate(save.lastModified)}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
        <button className="btn btn-secondary btn-sm" onClick={() => onBackup(save)}>Backup</button>
        <button className="btn btn-danger btn-sm" onClick={() => onDelete(save)}>Delete</button>
      </div>
    </div>
  );
}
