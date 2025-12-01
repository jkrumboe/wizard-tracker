import React, { useState, useEffect } from 'react';
import { XIcon, ChevronUpIcon, ChevronDownIcon, PlusIcon, MinusIcon } from '@/components/ui/Icon';

const MIN_PLAYERS = 2;

const TableGameSettingsModal = ({ 
  isOpen, 
  onClose, 
  players, 
  rows,
  currentRound,
  targetNumber,
  lowIsBetter,
  onUpdateSettings,
  gameFinished 
}) => {
  const [localPlayers, setLocalPlayers] = useState([]);
  const [localRows, setLocalRows] = useState(10);
  const [localTargetNumber, setLocalTargetNumber] = useState(null);
  const [localLowIsBetter, setLocalLowIsBetter] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setLocalPlayers(players.map((p, idx) => ({ ...p, originalIndex: idx })));
      setLocalRows(rows);
      setLocalTargetNumber(targetNumber);
      setLocalLowIsBetter(lowIsBetter);
    }
  }, [isOpen, players, rows, targetNumber, lowIsBetter]);

  if (!isOpen) return null;

  const handleSave = () => {
    onUpdateSettings({
      players: localPlayers,
      rows: localRows,
      targetNumber: localTargetNumber,
      lowIsBetter: localLowIsBetter
    });
  };

  const handlePlayerNameChange = (index, newName) => {
    const updated = [...localPlayers];
    updated[index].name = newName;
    setLocalPlayers(updated);
  };

  const movePlayerUp = (index) => {
    if (index > 0) {
      const newPlayers = [...localPlayers];
      [newPlayers[index], newPlayers[index - 1]] = [newPlayers[index - 1], newPlayers[index]];
      setLocalPlayers(newPlayers);
    }
  };

  const movePlayerDown = (index) => {
    if (index < localPlayers.length - 1) {
      const newPlayers = [...localPlayers];
      [newPlayers[index], newPlayers[index + 1]] = [newPlayers[index + 1], newPlayers[index]];
      setLocalPlayers(newPlayers);
    }
  };

  const handleAddPlayer = () => {
    const newPlayer = {
      name: `Player ${localPlayers.length + 1}`,
      points: []
    };
    setLocalPlayers([...localPlayers, newPlayer]);
  };

  const handleRemovePlayer = (index) => {
    if (localPlayers.length > MIN_PLAYERS) {
      const updated = localPlayers.filter((_, idx) => idx !== index);
      setLocalPlayers(updated);
    }
  };

  const handleRowsChange = (newRows) => {
    // Can't set rows below current round
    if (newRows >= currentRound && newRows <= 100) {
      setLocalRows(newRows);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content game-settings-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Game Settings</h2>
          <button className="modal-close-btn" onClick={onClose}>
            <XIcon size={24} />
          </button>
        </div>

        <div className="modal-body">
          {/* Max Rounds Setting */}
          <div className="settings-section">
            <h3>Maximum Rounds</h3>
            <div className="setting-control">
              <button 
                className="control-btn"
                onClick={() => handleRowsChange(localRows - 1)}
                disabled={localRows <= currentRound || gameFinished}
              >
                <ChevronDownIcon size={20} />
              </button>
              <span className="control-value">{localRows}</span>
              <button 
                className="control-btn"
                onClick={() => handleRowsChange(localRows + 1)}
                disabled={localRows >= 100 || gameFinished}
              >
                <ChevronUpIcon size={20} />
              </button>
            </div>
            <p className="setting-description">
              Current round: {currentRound}
            </p>
          </div>

          {/* Target Score Setting */}
          <div className="settings-section">
            <h3>Target Score (Optional)</h3>
            <div className="setting-control">
              <input
                type="number"
                className="target-input"
                value={localTargetNumber || ''}
                onChange={(e) => setLocalTargetNumber(e.target.value ? parseInt(e.target.value, 10) : null)}
                placeholder="No target"
                disabled={gameFinished}
              />
            </div>
            <div className="checkbox-control">
              <label>
                <input
                  type="checkbox"
                  checked={localLowIsBetter}
                  onChange={(e) => setLocalLowIsBetter(e.target.checked)}
                  disabled={gameFinished}
                />
                <span>Lower score wins</span>
              </label>
            </div>
          </div>

          {/* Player Order */}
          <div className="settings-section">
            <h3>Players</h3>
            <div className="player-order-list">
              {localPlayers.map((player, index) => (
                <div key={index} className="player-order-item">
                  <div className="player-order-controls">
                    <button
                      className="order-btn"
                      onClick={() => movePlayerUp(index)}
                      disabled={index === 0 || gameFinished}
                    >
                      <ChevronUpIcon size={16} />
                    </button>
                    <button
                      className="order-btn"
                      onClick={() => movePlayerDown(index)}
                      disabled={index === localPlayers.length - 1 || gameFinished}
                    >
                      <ChevronDownIcon size={16} />
                    </button>
                  </div>
                  <input
                    type="text"
                    className="player-name-input"
                    value={player.name}
                    onChange={(e) => handlePlayerNameChange(index, e.target.value)}
                    disabled={gameFinished}
                  />
                  {localPlayers.length > MIN_PLAYERS && (
                    <button
                      className="remove-player-btn"
                      onClick={() => handleRemovePlayer(index)}
                      disabled={gameFinished}
                    >
                      <MinusIcon size={16} />
                    </button>
                  )}
                </div>
              ))}
            </div>
            <button
              className="add-player-modal-btn"
              onClick={handleAddPlayer}
              disabled={gameFinished}
            >
              <PlusIcon size={16} />
              Add Player
            </button>
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button 
            className="btn-primary" 
            onClick={handleSave}
            disabled={gameFinished}
          >
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
};

export default TableGameSettingsModal;
