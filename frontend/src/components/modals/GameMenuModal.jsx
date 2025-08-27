import React from 'react';
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
  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-container">
        <div className="modal-header">
          <h2>Game Menu</h2>
          <button className="close-btn" onClick={onClose}>
            <XIcon size={20} />
          </button>
        </div>
        
        <div className="modal-content game-menu-content">
          <button className="modal-button" onClick={onLoadGame}>
            Load Game
          </button>
          <button className="modal-button" onClick={onSaveGame}>
            Save & Continue
          </button>
          <button className="modal-button" onClick={onPauseGame}>
            Pause Game
          </button>
          <button className="modal-button" onClick={() => { onClose(); navigate('/game/table'); }}>
            Table Game
          </button>
          <button className="modal-button danger" onClick={onLeaveGame}>
            Leave Game
          </button>
        </div>
      </div>
    </div>
  );
};

export default GameMenuModal;
