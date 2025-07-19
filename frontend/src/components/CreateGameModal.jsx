import React from 'react';
import '@/styles/modal.css';
import { XIcon} from "@/components/Icon"

const CreateGameModal = ({ 
  isOpen, 
  onClose, 
  onSubmit, 
  gameSettings, 
  onSettingsChange
}) => {
  if (!isOpen) return null;
  
  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-container create-game-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Create New Game</h2>
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
                <option value="classic">Classic</option>
                <option value="ranked">Ranked</option>
                <option value="quick">Quick Game</option>
                <option value="tournament">Tournament</option>
              </select>
            </div>

            <div className="form-group">
              <select
                id="maxPlayers"
                value={gameSettings.maxPlayers}
                onChange={(e) => onSettingsChange({ ...gameSettings, maxPlayers: parseInt(e.target.value) })}
              >
                <option value={2}>2 Players</option>
                <option value={3}>3 Players</option>
                <option value={4}>4 Players</option>
                <option value={5}>5 Players</option>
                <option value={6}>6 Players</option>
              </select>
            </div>

            <div className="form-group checkbox-group">
              <label>
                <input
                  type="checkbox"
                  checked={gameSettings.isPrivate}
                  onChange={(e) => onSettingsChange({ ...gameSettings, isPrivate: e.target.checked })}
                />
                Private Game
              </label>
            </div>

            {gameSettings.isPrivate && (
              <div className="form-group">
                <label htmlFor="password">Password</label>
                <input
                  type="password"
                  id="password"
                  value={gameSettings.password}
                  onChange={(e) => onSettingsChange({ ...gameSettings, password: e.target.value })}
                  placeholder="Enter Password For Private Game"
                  required
                />
              </div>
            )}

            <div className="modal-actions">
              <button type="button" onClick={onClose} className="cancel-button">
                Cancel
              </button>
              <button type="submit" className="create-button">
                Create Game
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default CreateGameModal;
