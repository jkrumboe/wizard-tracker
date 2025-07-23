import React from 'react';
import { XIcon, PauseIcon } from '@/components/ui/Icon';
import '@/styles/components/modal.css'; 

const PauseConfirmationModal = ({ 
  isOpen, 
  onClose, 
  onConfirm,
  currentRound,
  maxRounds
}) => {
  if (!isOpen) return null;

  const handleConfirm = () => {
    onConfirm(`Paused Game - Round ${currentRound}/${maxRounds}`);
  };

  return (
    <div className="modal-overlay">
      <div className="modal-container pause-confirmation-modal">
        <div className="modal-header">
          <h2>Pause Game</h2>
          <button className="close-btn" onClick={onClose}>
            <XIcon size={20} />
          </button>
        </div>
        
        <div className="modal-content">
          <h3>Are you sure you want to pause the current game?</h3>
          <p className="pause-description">
            Your game progress will be saved and you can resume it later from the Paused Games tab in the New Game page.
          </p>

          <div className="modal-actions">
          <button className="modal-button secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="modal-button primary" onClick={handleConfirm}>
            Pause Game
          </button>
        </div>
        </div>
        
        
      </div>
    </div>
  );
};

export default PauseConfirmationModal;
