import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { XIcon, SaveIcon, PauseIcon, PlayIcon } from '@/components/ui/Icon';

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
  title
}) => {
  const { t } = useTranslation();
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
    const roundInfo = `${t('common.round')} ${gameState.currentRound}/${gameState.maxRounds}`;
    return `${playerNames} - ${roundInfo}`;
  };

  return (
    <div className="dialog-overlay">
      <div className="dialog-modal">
        <div className="dialog-header">
          <h2>{title || t('saveGame.title')}</h2>
          <button onClick={onClose} className="dialog-close-btn" disabled={loading}>
            <XIcon size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="dialog-content">
          <div className="form-group">
            <label htmlFor="gameName">{t('saveGame.gameNameLabel')}</label>
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
                  {t('saveGame.saveAndContinue')}
                </div>
                <div className="radio-option-description">
                  {t('saveGame.saveAndContinueDesc')}
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
                    {t('saveGame.pauseGame')}
                  </div>
                  <div className="radio-option-description">
                    {t('saveGame.pauseGameDesc')}
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
                    {t('saveGame.saveAndLeave')}
                  </div>
                  <div className="radio-option-description">
                    {t('saveGame.saveAndLeaveDesc')}
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
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              className="dialog-btn primary"
              disabled={loading}
            >
              {loading ? t('saveGame.saving') : 
               saveOption === 'save' ? t('saveGame.saveGameBtn') :
               saveOption === 'pause' ? t('saveGame.pauseGameBtn') :
               t('saveGame.saveAndLeave')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default SaveGameDialog;
