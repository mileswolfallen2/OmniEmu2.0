import React, { useEffect, useCallback } from 'react';
import { markdownToHtml } from '../utils/markdown';

interface Props {
  version: string;
  releaseNotes: string;
  onClose: () => void;
}

export function ReleaseNotesModal({ version, releaseNotes, onClose }: Props) {
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
  }, [onClose]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const html = markdownToHtml(releaseNotes);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-full" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>v{version} Release Notes</h2>
          <button className="btn btn-secondary btn-sm" onClick={onClose}>
            Close
          </button>
        </div>
        <div
          className="modal-body markdown"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </div>
    </div>
  );
}
