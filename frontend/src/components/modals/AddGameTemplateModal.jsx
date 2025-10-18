import React, { useState, useEffect } from 'react';
import { XIcon } from '@/components/ui/Icon';
import '@/styles/components/AddGameTemplateModal.css';

const AddGameTemplateModal = ({ isOpen, onClose, onSave }) => {
  const [gameName, setGameName] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      setGameName('');
      setError('');
    }
  }, [isOpen]);

  const handleSave = () => {
    const trimmedName = gameName.trim();
    
    if (!trimmedName) {
      setError('Please enter a game name');
      return;
    }

    onSave(trimmedName);
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
        <div className="add-game-modal-header">
          <h2>Create New Game</h2>
          <button className="modal-close-btn" onClick={onClose} aria-label="Close">
            <XIcon size={20} />
          </button>
        </div>

        <div className="add-game-modal-content">
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
          {error && <div className="error-message">{error}</div>}
        </div>

        <div className="add-game-modal-actions">
          <button className="modal-btn cancel-btn" onClick={onClose}>
            Cancel
          </button>
          <button className="modal-btn save-btn" onClick={handleSave}>
            Create Game
          </button>
        </div>
      </div>
    </div>
  );
};

export default AddGameTemplateModal;
