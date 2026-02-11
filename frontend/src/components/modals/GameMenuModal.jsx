import React from 'react';
import { useTranslation } from 'react-i18next';
import { XIcon} from "@/components/ui/Icon"
import '@/styles/components/modal.css';


import { useNavigate } from 'react-router-dom';

const GameMenuModal = ({ 
  isOpen, 
  onClose, 
  onLoadGame, 
  onSaveGame, 
  onPauseGame, 
  onLeaveGame
}) => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-container">
        <div className="modal-header">
          <h2>{t('settings.gameSettings')}</h2>
          <button className="close-btn" onClick={onClose}>
            <XIcon size={20} />
          </button>
        </div>
        
        <div className="modal-content game-menu-content">
          <button className="modal-button" onClick={onLoadGame}>
            {t('loadGameDialog.loadGame')}
          </button>
          <button className="modal-button" onClick={onSaveGame}>
            Save & Continue
          </button>
          <button className="modal-button" onClick={onPauseGame}>
            {t('settings.pauseGame')}
          </button>
          <button className="modal-button" onClick={() => { onClose(); navigate('/game/table'); }}>
            {t('tableGame.defaultGameName')}
          </button>
          <button className="modal-button danger" onClick={onLeaveGame}>
            {t('settings.leaveGame')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default GameMenuModal;
