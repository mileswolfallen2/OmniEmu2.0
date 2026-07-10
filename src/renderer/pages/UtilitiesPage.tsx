import React, { useState } from 'react';

export function UtilitiesPage() {
  const [regenerating, setRegenerating] = useState(false);

  const handleRecreate = async () => {
    setRegenerating(true);
    await window.omni.utilities.regenerateRomsStructure();
    setTimeout(() => setRegenerating(false), 1500);
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
    </div>
  );
}
