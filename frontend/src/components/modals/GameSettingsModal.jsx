import React, { useState, useEffect } from 'react';
import { XIcon, ChevronUpIcon, ChevronDownIcon } from '@/components/ui/Icon';

const GameSettingsModal = ({ isOpen, onClose, gameState, onUpdateSettings }) => {
  const [dealerIndex, setDealerIndex] = useState(0);
  const [maxRounds, setMaxRounds] = useState(1);
  const [playerOrder, setPlayerOrder] = useState([]);

  useEffect(() => {
    if (gameState) {
      // Use startingDealerIndex from gameState or calculate from current round
      const currentDealerIndex = gameState.startingDealerIndex !== undefined 
        ? gameState.startingDealerIndex 
        : gameState.players.findIndex(p => p.isDealer);
      setDealerIndex(currentDealerIndex >= 0 ? currentDealerIndex : 0);
      
      // Set max rounds
      setMaxRounds(parseInt(gameState.maxRounds, 10) || 1);
      
      // Set player order
      setPlayerOrder(gameState.players.map((p, idx) => idx));
    }
  }, [gameState, isOpen]);

  if (!isOpen || !gameState) return null;

  const handleDealerChange = (newDealerIndex) => {
    setDealerIndex(newDealerIndex);
  };

  const handleMaxRoundsChange = (newMaxRounds) => {
    // Minimum 1 round, reasonable maximum based on player count
    const currentRound = parseInt(gameState.currentRound, 10) || 1;
    if (newMaxRounds >= currentRound && newMaxRounds <= 60) {
      setMaxRounds(newMaxRounds);
    }
  };

  const movePlayerUp = (index) => {
    if (index > 0) {
      const newOrder = [...playerOrder];
      [newOrder[index], newOrder[index - 1]] = [newOrder[index - 1], newOrder[index]];
      setPlayerOrder(newOrder);
    }
  };

  const movePlayerDown = (index) => {
    if (index < playerOrder.length - 1) {
      const newOrder = [...playerOrder];
      [newOrder[index], newOrder[index + 1]] = [newOrder[index + 1], newOrder[index]];
      setPlayerOrder(newOrder);
    }
  };

  const handleSave = () => {
    // Calculate new caller index (one after dealer)
    const newCallerIndex = (dealerIndex + 1) % gameState.players.length;
    
    onUpdateSettings({
      dealerIndex,
      callerIndex: newCallerIndex,
      maxRounds,
      playerOrder
    });
    onClose();
  };

  const orderedPlayers = playerOrder.map(idx => gameState.players[idx]);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content game-settings-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Game Settings</h2>
          <button className="close-btn" onClick={onClose} aria-label="Close">
            <XIcon size={24} />
          </button>
        </div>

        <div className="modal-body">
          {/* Max Rounds Setting */}
          <div className="setting-section">
            <h3>Max Rounds</h3>
            <div className="setting-control">
              <button 
                className="round-control-btn"
                onClick={() => handleMaxRoundsChange(maxRounds - 1)}
                disabled={maxRounds <= parseInt(gameState.currentRound, 10)}
              >
                -
              </button>
              <input
                type="number"
                value={maxRounds}
                onChange={(e) => handleMaxRoundsChange(parseInt(e.target.value, 10))}
                min={gameState.currentRound}
                max="60"
                className="round-input"
              />
              <button 
                className="round-control-btn"
                onClick={() => handleMaxRoundsChange(maxRounds + 1)}
                disabled={maxRounds >= 60}
              >
                +
              </button>
            </div>
            <p className="setting-hint">
              Currently on round {gameState.currentRound}. Max rounds: {maxRounds}
            </p>
          </div>

          {/* Dealer Selection */}
          <div className="setting-section">
            <h3>Dealer</h3>
            <div className="dealer-selection">
              {gameState.players.map((player, index) => (
                <label key={player.id} className="dealer-option">
                  <input
                    type="radio"
                    name="dealer"
                    checked={dealerIndex === index}
                    onChange={() => handleDealerChange(index)}
                  />
                  <span>{player.name}</span>
                  {dealerIndex === index && <span className="badge">Dealer</span>}
                  {(dealerIndex + 1) % gameState.players.length === index && (
                    <span className="badge caller-badge">Caller</span>
                  )}
                </label>
              ))}
            </div>
          </div>

          {/* Player Order */}
          <div className="setting-section">
            <h3>Player Order</h3>
            <div className="player-order-list">
              {orderedPlayers.map((player, index) => (
                <div key={player.id} className="player-order-item">
                  <span className="player-position">{index + 1}</span>
                  <span className="player-name">{player.name}</span>
                  <div className="player-order-controls">
                    <button
                      className="order-btn"
                      onClick={() => movePlayerUp(index)}
                      disabled={index === 0}
                      aria-label="Move up"
                    >
                      <ChevronUpIcon size={20} />
                    </button>
                    <button
                      className="order-btn"
                      onClick={() => movePlayerDown(index)}
                      disabled={index === orderedPlayers.length - 1}
                      aria-label="Move down"
                    >
                      <ChevronDownIcon size={20} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={handleSave}>
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
};

export default GameSettingsModal;
