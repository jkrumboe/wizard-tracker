import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { XIcon, UserIcon } from '@/components/ui/Icon';
import '@/styles/components/modal.css';

const ImportGamePlayerSelectModal = ({ 
  isOpen, 
  onClose, 
  onConfirm,
  players = [],
  currentUser = null
}) => {
  const { t } = useTranslation();
  const [selectedPlayerId, setSelectedPlayerId] = useState(null);

  if (!isOpen) return null;

  const handleConfirm = () => {
    onConfirm(selectedPlayerId);
    onClose();
  };

  const handleSkip = () => {
    onConfirm(null);
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-container" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{t('importGame.title')}</h2>
          <button className="close-btn" onClick={onClose} aria-label={t('common.close')}>
            <XIcon size={20} />
          </button>
        </div>
        
        <div className="modal-content">
          <p className="modal-description">
            {t('importGame.description')}
          </p>

          {currentUser && (
            <div className="current-user-info">
              <UserIcon size={16} />
              <span>{t('importGame.loggedInAs')} <strong>{currentUser.username || currentUser.name}</strong></span>
            </div>
          )}

          <div className="player-selection-list">
            {players.map((player) => (
              <label 
                key={player.id} 
                className={`player-selection-item ${selectedPlayerId === player.id ? 'selected' : ''}`}
              >
                <input
                  type="radio"
                  name="player-select"
                  value={player.id}
                  checked={selectedPlayerId === player.id}
                  onChange={() => setSelectedPlayerId(player.id)}
                />
                <div className="player-info">
                  <span className="player-name">{player.name}</span>
                  {player.final_score !== undefined && (
                    <span className="player-score">{player.final_score} {t('common.points')}</span>
                  )}
                </div>
              </label>
            ))}
          </div>

          <div className="modal-actions">
            <button 
              className="btn-secondary"
              onClick={handleSkip}
            >
              {t('importGame.skipNotMyGame')}
            </button>
            <button 
              className="btn-primary"
              onClick={handleConfirm}
              disabled={!selectedPlayerId}
            >
              {t('importGame.importGame')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ImportGamePlayerSelectModal;
