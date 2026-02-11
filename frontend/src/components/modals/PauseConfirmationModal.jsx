import React from 'react';
import { useTranslation } from 'react-i18next';
import { XIcon, PauseIcon } from '@/components/ui/Icon';
import '@/styles/components/modal.css'; 

const PauseConfirmationModal = ({ 
  isOpen, 
  onClose, 
  onConfirm,
  currentRound,
  maxRounds
}) => {
  const { t } = useTranslation();
  if (!isOpen) return null;

  const handleConfirm = () => {
    onConfirm(`Paused Game - Round ${currentRound}/${maxRounds}`);
  };

  return (
    <div className="modal-overlay">
      <div className="modal-container pause-confirmation-modal">
        <div className="modal-header">
          <h2>{t('settings.pauseGame')}</h2>
          <button className="close-btn" onClick={onClose}>
            <XIcon size={20} />
          </button>
        </div>
        <div className="modal-content">
          <strong>{t('settings.pauseConfirm')}</strong>
          <p className="pause-description">
            Your game progress will be saved and you can resume it later from the Paused Games tab in the New Game page.
          </p>
        </div>
        <div className="modal-actions">
            <button className="modal-button secondary" onClick={onClose}>
              {t('common.cancel')}
            </button>
            <button className="modal-button primary" onClick={handleConfirm}>
              Pause
            </button>
          </div>
      </div>
    </div>
  );
};

export default PauseConfirmationModal;
