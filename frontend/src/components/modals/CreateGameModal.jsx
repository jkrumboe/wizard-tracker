import React from 'react';
import { useTranslation } from 'react-i18next';
import '@/styles/components/modal.css';
import { XIcon} from "@/components/ui/Icon"

const CreateGameModal = ({ 
  isOpen, 
  onClose, 
  onSubmit, 
  gameSettings, 
  onSettingsChange
}) => {
  const { t } = useTranslation();

  if (!isOpen) return null;
  
  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-container create-game-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{t('createGame.title')}</h2>
          <button className="close-btn" onClick={onClose}>
            <XIcon size={20} />
          </button>
        </div>
        
        <div className="modal-content">
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <select
                id="gameMode"
                value={gameSettings.gameMode}
                onChange={(e) => onSettingsChange({ ...gameSettings, gameMode: e.target.value })}
              >
                <option value="classic">{t('createGame.classic')}</option>
                <option value="ranked">{t('createGame.ranked')}</option>
                {/* <option value="quick">Quick Game</option>
                <option value="tournament">Tournament</option> */}
              </select>
            </div>

            <div className="form-group">
              <select
                id="maxPlayers"
                value={gameSettings.maxPlayers}
                onChange={(e) => onSettingsChange({ ...gameSettings, maxPlayers: parseInt(e.target.value) })}
              >
                <option value={3}>{t('createGame.playersCount', { count: 3 })}</option>
                <option value={4}>{t('createGame.playersCount', { count: 4 })}</option>
                <option value={5}>{t('createGame.playersCount', { count: 5 })}</option>
                <option value={6}>{t('createGame.playersCount', { count: 6 })}</option>
              </select>
            </div>

            <div className="form-group checkbox-group">
              <label>
                <input
                  type="checkbox"
                  checked={gameSettings.isPrivate}
                  onChange={(e) => onSettingsChange({ ...gameSettings, isPrivate: e.target.checked })}
                />
                {t('createGame.privateGame')}
              </label>
            </div>

            {gameSettings.isPrivate && (
              <div className="form-group">
                <label htmlFor="password">{t('createGame.passwordLabel')}</label>
                <input
                  type="password"
                  id="password"
                  value={gameSettings.password}
                  onChange={(e) => onSettingsChange({ ...gameSettings, password: e.target.value })}
                  placeholder={t('createGame.passwordPlaceholder')}
                  required
                />
              </div>
            )}

            <div className="modal-actions">
              <button type="button" onClick={onClose} className="cancel-button">
                {t('common.cancel')}
              </button>
              <button type="submit" className="create-button">
                {t('createGame.createGame')}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default CreateGameModal;
