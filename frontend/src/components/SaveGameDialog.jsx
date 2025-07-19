import React, { useState } from 'react';
import { XIcon, SaveIcon, PauseIcon, PlayIcon } from '@/components/Icon';

const SaveGameDialog = ({ 
  isOpen, 
  onClose, 
  onSave, 
  onPause, 
  onLeave,
  gameState,
  showPauseOption = true,
  showLeaveOption = true,
  initialOption = 'save',
  title = "Save Game"
}) => {
  const [gameName, setGameName] = useState(gameState?.gameName || '');
  const [saveOption, setSaveOption] = useState(initialOption); // 'save', 'pause', 'leave'
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const customName = gameName.trim() || null;
      let result;

      switch (saveOption) {
        case 'save':
          result = await onSave(customName);
          break;
        case 'pause':
          result = await onPause(customName);
          break;
        case 'leave':
          result = await onLeave(true, customName);
          break;
        default:
          result = { success: false, error: 'Invalid option' };
      }

      if (result.success) {
        onClose();
      } else {
        alert(`Error: ${result.error}`);
      }
    } catch (error) {
      alert(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const getDefaultGameName = () => {
    const playerNames = gameState.players.map(p => p.name).join(', ');
    const roundInfo = `Round ${gameState.currentRound}/${gameState.maxRounds}`;
    return `${playerNames} - ${roundInfo}`;
  };

  return (
    <div className="dialog-overlay">
      <div className="dialog-modal">
        <div className="dialog-header">
          <h2>{title}</h2>
          <button onClick={onClose} className="dialog-close-btn" disabled={loading}>
            <XIcon size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="dialog-content">
          <div className="form-group">
            <label htmlFor="gameName">Game Name (Optional)</label>
            <input
              type="text"
              id="gameName"
              value={gameName}
              onChange={(e) => setGameName(e.target.value)}
              placeholder={getDefaultGameName()}
              disabled={loading}
              className="game-name-input"
            />
          </div>

          <div className="radio-group">
            <div className="radio-option">
              <input
                type="radio"
                id="save"
                name="saveOption"
                value="save"
                checked={saveOption === 'save'}
                onChange={(e) => setSaveOption(e.target.value)}
                disabled={loading}
              />
              <label htmlFor="save" className="radio-option-content">
                <div className="radio-option-title">
                  <SaveIcon size={16} style={{ marginRight: '8px', display: 'inline' }} />
                  Save & Continue
                </div>
                <div className="radio-option-description">
                  Save your progress and keep playing
                </div>
              </label>
            </div>

            {showPauseOption && (
              <div className="radio-option">
                <input
                  type="radio"
                  id="pause"
                  name="saveOption"
                  value="pause"
                  checked={saveOption === 'pause'}
                  onChange={(e) => setSaveOption(e.target.value)}
                  disabled={loading}
                />
                <label htmlFor="pause" className="radio-option-content">
                  <div className="radio-option-title">
                    <PauseIcon size={16} style={{ marginRight: '8px', display: 'inline' }} />
                    Pause Game
                  </div>
                  <div className="radio-option-description">
                    Save and pause the game for later
                  </div>
                </label>
              </div>
            )}

            {showLeaveOption && (
              <div className="radio-option">
                <input
                  type="radio"
                  id="leave"
                  name="saveOption"
                  value="leave"
                  checked={saveOption === 'leave'}
                  onChange={(e) => setSaveOption(e.target.value)}
                  disabled={loading}
                />
                <label htmlFor="leave" className="radio-option-content">
                  <div className="radio-option-title">
                    <XIcon size={16} style={{ marginRight: '8px', display: 'inline' }} />
                    Save & Leave
                  </div>
                  <div className="radio-option-description">
                    Save your progress and exit the game
                  </div>
                </label>
              </div>
            )}
          </div>

          <div className="dialog-actions">
            <button
              type="button"
              onClick={onClose}
              className="dialog-btn secondary"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="dialog-btn primary"
              disabled={loading}
            >
              {loading ? 'Saving...' : 
               saveOption === 'save' ? 'Save Game' :
               saveOption === 'pause' ? 'Pause Game' :
               'Save & Leave'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default SaveGameDialog;
