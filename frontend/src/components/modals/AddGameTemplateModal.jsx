import React, { useState, useEffect } from 'react';
import { XIcon } from '@/components/ui/Icon';
import '@/styles/components/AddGameTemplateModal.css';

const AddGameTemplateModal = ({ isOpen, onClose, onSave, onSuggest, onSyncToCloud, editMode = false, initialData = null }) => {
  const [gameName, setGameName] = useState('');
  const [targetNumber, setTargetNumber] = useState('');
  const [lowIsBetter, setLowIsBetter] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      if (editMode && initialData) {
        // Populate with existing data when editing
        setGameName(initialData.name || '');
        setTargetNumber(initialData.targetNumber ? initialData.targetNumber.toString() : '');
        setLowIsBetter(initialData.lowIsBetter || false);
      } else {
        // Clear fields when creating new
        setGameName('');
        setTargetNumber('');
        setLowIsBetter(false);
      }
      setError('');
    }
  }, [isOpen, editMode, initialData]);

  const handleSave = () => {
    const trimmedName = gameName.trim();
    
    if (!trimmedName) {
      setError('Please enter a game name');
      return;
    }

    // Parse target number if provided
    const target = targetNumber.trim() ? parseInt(targetNumber, 10) : null;
    
    if (targetNumber.trim() && (isNaN(target) || target <= 0)) {
      setError('Target number must be a positive number');
      return;
    }

    onSave(trimmedName, { targetNumber: target, lowIsBetter });
    onClose();
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleSave();
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="add-game-modal-overlay" onClick={onClose}>
      <div className="add-game-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{editMode ? 'Edit Game Type' : 'Create New Game'}</h2>
          <button className="modal-close-btn" onClick={onClose} aria-label="Close">
            <XIcon size={20} />
          </button>
        </div>

        <div className="add-game-modal-content">
          <div className="add-section">
            <label htmlFor="game-name-input" className="game-name-label">
              Enter a name for the new game:
            </label>
            <input
              id="game-name-input"
              type="text"
              value={gameName}
              onChange={(e) => {
                setGameName(e.target.value);
                setError('');
              }}
              onKeyDown={handleKeyDown}
              placeholder="e.g., Wizard, Poker Night, Friday Games..."
              className="game-name-input"
              autoFocus
            />
          </div>

          <div className="add-section">
          <label htmlFor="target-number-input" className="game-name-label">
            Target Number (optional):
          </label>
          <input
            id="target-number-input"
            type="number"
            min="1"
            value={targetNumber}
            onChange={(e) => {
              setTargetNumber(e.target.value);
              setError('');
            }}
            onKeyDown={handleKeyDown}
            placeholder="e.g., 100, 500..."
            className="game-name-input"
          />
          </div>
          
          <div className="add-section">
            <label className="game-name-label">
              Scoring Preference:
            </label>
            <div className="scoring-prefernce-type" style={{ display: 'flex'}}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                <input
                  type="radio"
                  name="scoring-preference"
                  checked={!lowIsBetter}
                  onChange={() => setLowIsBetter(false)}
                />
                <span>High Score</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                <input
                  type="radio"
                  name="scoring-preference"
                  checked={lowIsBetter}
                  onChange={() => setLowIsBetter(true)}
                />
                <span>Low Score </span>
              </label>
            </div>
          </div>
          
          {error && <div className="error-message">{error}</div>}
        </div>

        <div className="add-game-modal-actions">
          <button className="modal-btn cancel-btn" onClick={onClose}>
            Cancel
          </button>
          {/* {editMode && onSyncToCloud && (
            <button className="modal-btn sync-btn" onClick={onSyncToCloud}>
              ☁️ Sync to Cloud
            </button>
          )} */}
          {editMode && onSuggest && (
            <button className="modal-btn suggest-btn" onClick={onSuggest}>
              Suggest game type
            </button>
          )}
          <button className="modal-btn save-btn" onClick={handleSave}>
            {editMode ? 'Save Changes' : 'Create Game'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AddGameTemplateModal;
