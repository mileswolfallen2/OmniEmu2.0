import React, { useEffect, useState, useCallback } from 'react';

interface CoverResult {
  id: number;
  name: string;
  url: string;
  width: number;
  height: number;
  thumb: string;
}

interface Props {
  gameTitle: string;
  platform: string;
  onSelect: (url: string) => void;
  onClose: () => void;
}

export function CoverPickerModal({ gameTitle, platform, onSelect, onClose }: Props) {
  const [results, setResults] = useState<CoverResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    window.omni.settings.get().then((s) => {
      if (cancelled) return;
      if (!s.steamGridDbApiKey) {
        setLoading(false);
        setError('No SteamGridDB API key set. Add one in Utilities.');
        return;
      }
      window.omni.game.searchCoverSGDB(gameTitle, platform)
        .then((data) => {
          if (cancelled) return;
          setResults(data);
          setLoading(false);
          if (data.length === 0) setError('No results found. Try a different search term.');
        })
        .catch((err) => {
          if (cancelled) return;
          setLoading(false);
          setError(`Search failed: ${err?.message || 'Unknown error'}`);
        });
    });
    return () => { cancelled = true; };
  }, [gameTitle, platform]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
  }, [onClose]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="cover-picker-modal" onClick={(e) => e.stopPropagation()}>
        <div className="cover-picker-header">
          <h3>Choose Cover Art</h3>
          <span className="cover-picker-subtitle">SteamGridDB — {gameTitle}</span>
          <button className="btn btn-secondary btn-sm" onClick={onClose}>Close</button>
        </div>

        <div className="cover-picker-body">
          {loading && (
            <div className="cover-picker-loading">Searching SteamGridDB...</div>
          )}

          {error && (
            <div className="cover-picker-error">{error}</div>
          )}

          {!loading && !error && results.length > 0 && (
            <div className="cover-picker-grid">
              {results.map((item) => (
                <div
                  key={item.id}
                  className={`cover-picker-item ${selectedId === item.id ? 'selected' : ''}`}
                  onClick={() => setSelectedId(item.id)}
                  onDoubleClick={() => onSelect(item.thumb || item.url)}
                >
                  <img src={item.thumb} alt={item.name} />
                  <div className="cover-picker-item-info">
                    <span>{item.width}x{item.height}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {selectedId !== null && (
          <div className="cover-picker-footer">
            <button
              className="btn btn-primary"
              onClick={() => {
                const item = results.find(r => r.id === selectedId);
                if (item) onSelect(item.thumb || item.url);
              }}
            >
              Use This Cover
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
