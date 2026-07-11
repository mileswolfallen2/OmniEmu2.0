import React, { useEffect, useCallback, useState } from 'react';
import type { GameEntry, GameMetadata, AchievementInfo, RetroAchievement } from '../../shared/types';

interface Props {
  game: GameEntry;
  onClose: () => void;
  onLaunch: (game: GameEntry) => void;
}

const platformLabels: Record<string, string> = {
  nes: 'NES', snes: 'SNES', n64: 'Nintendo 64',
  gb: 'Game Boy', gbc: 'Game Boy Color', gba: 'Game Boy Advance',
  nds: 'Nintendo DS', gc: 'GameCube', wii: 'Wii',
  ps1: 'PlayStation', ps2: 'PlayStation 2', ps3: 'PlayStation 3',
  psp: 'PSP', pce: 'PC Engine',
  'sega-md': 'Sega Genesis', 'sega-saturn': 'Sega Saturn', 'sega-dc': 'Sega Dreamcast',
  dreamcast: 'Dreamcast', arcade: 'Arcade',
};

const badgeBase = 'https://retroachievements.org/Badge/';

export function GameDetailModal({ game, onClose, onLaunch }: Props) {
  const [metadata, setMetadata] = useState<GameMetadata | null>(null);
  const [loadingMeta, setLoadingMeta] = useState(false);
  const [achievements, setAchievements] = useState<AchievementInfo | null>(null);
  const [loadingAchievements, setLoadingAchievements] = useState(false);
  const [currentScreenshot, setCurrentScreenshot] = useState(0);

  useEffect(() => {
    setLoadingMeta(true);
    window.omni.game.scrapeMetadata(game.romPath, game.title, game.platform)
      .then((m) => { setMetadata(m); setLoadingMeta(false); })
      .catch(() => setLoadingMeta(false));
  }, [game.romPath, game.title, game.platform]);

  useEffect(() => {
    setLoadingAchievements(true);
    window.omni.game.achievements(game.romPath, game.title, game.platform)
      .then((a) => { setAchievements(a); setLoadingAchievements(false); })
      .catch(() => setLoadingAchievements(false));
  }, [game.romPath, game.title, game.platform]);

  const screenshots = metadata?.screenshots || [];
  const hasScreenshots = screenshots.length > 0;
  const displayScreenshot = hasScreenshots ? screenshots[currentScreenshot] : game.coverUrl;

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
  }, [onClose]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="game-detail-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
            <h2 style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {game.title}
            </h2>
            <span className="platform-tag">{platformLabels[game.platform] || game.platform.toUpperCase()}</span>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={onClose}>
            Close
          </button>
        </div>

        <div className="game-detail-body">
          <div className="game-detail-left">
            <div className="game-detail-cover">
              {displayScreenshot ? (
                <img
                  src={displayScreenshot}
                  alt={game.title}
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
              ) : (
                <div className="game-detail-cover-placeholder">?</div>
              )}
            </div>
            {hasScreenshots && (
              <div className="game-detail-thumbnails">
                {screenshots.map((src, i) => (
                  <div
                    key={i}
                    className={`game-detail-thumb ${i === currentScreenshot ? 'active' : ''}`}
                    onClick={() => setCurrentScreenshot(i)}
                  >
                    <img src={src} alt={`Screenshot ${i + 1}`} />
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="game-detail-right">
            <div className="game-detail-right-scroll">
              {loadingMeta ? (
                <div className="text-sm text-muted" style={{ padding: 12 }}>Loading metadata...</div>
              ) : (
                <>
                  <div className="game-detail-meta">
                    {metadata?.year && (
                      <div className="meta-row">
                        <span className="meta-label">Year</span>
                        <span>{metadata.year}</span>
                      </div>
                    )}
                    {metadata?.genre && (
                      <div className="meta-row">
                        <span className="meta-label">Genre</span>
                        <span>{metadata.genre}</span>
                      </div>
                    )}
                    {metadata?.publisher && (
                      <div className="meta-row">
                        <span className="meta-label">Publisher</span>
                        <span>{metadata.publisher}</span>
                      </div>
                    )}
                    {metadata?.rating !== undefined && metadata.rating > 0 && (
                      <div className="meta-row">
                        <span className="meta-label">Rating</span>
                        <span>{'★'.repeat(Math.round(metadata.rating))}{'☆'.repeat(5 - Math.round(metadata.rating))}</span>
                      </div>
                    )}
                    <div className="meta-row">
                      <span className="meta-label">Emulator</span>
                      <span>{game.emulatorId}</span>
                    </div>
                    <div className="meta-row">
                      <span className="meta-label">Played</span>
                      <span>{game.playCount} time{game.playCount !== 1 ? 's' : ''}</span>
                    </div>
                  </div>

                  {metadata?.description && (
                    <div className="game-detail-description">
                      <h4>About</h4>
                      <p>{metadata.description}</p>
                    </div>
                  )}
                </>
              )}

              <div className="game-detail-achievements">
                <h4>
                  Achievements
                  {achievements && (
                    <span className="text-sm text-muted" style={{ fontWeight: 400, marginLeft: 8 }}>
                      {achievements.userProgress}/{achievements.totalAchievements} · {achievements.totalPoints} pts
                    </span>
                  )}
                </h4>

                {loadingAchievements ? (
                  <p className="text-sm text-muted">Loading achievements...</p>
                ) : achievements ? (
                  <div className="achievement-list">
                    {achievements.achievements.map((a) => (
                      <AchievementRow key={a.id} achievement={a} />
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted">
                    Add your RetroAchievements Web API Key in Settings &gt; Utilities to see achievements here.
                  </p>
                )}
              </div>
            </div>

            <button
              className="btn btn-primary game-detail-launch"
              onClick={() => { onLaunch(game); onClose(); }}
            >
              Launch Game
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function AchievementRow({ achievement }: { achievement: RetroAchievement }) {
  const earned = !!achievement.dateEarned;
  return (
    <div className={`achievement-row ${earned ? 'earned' : 'locked'}`}>
      <img
        className="achievement-badge"
        src={`${badgeBase}${achievement.badgeName}.png`}
        alt={achievement.title}
        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
      />
      <div className="achievement-info">
        <div className="achievement-title">{achievement.title}</div>
        <div className="achievement-desc">{achievement.description}</div>
      </div>
      <div className="achievement-points">{achievement.points}</div>
    </div>
  );
}
