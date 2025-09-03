import React, { useState } from "react";
import { ArrowLeftIcon, ArrowRightIcon, XIcon, SaveIcon, UploadIcon } from "../../components/ui/Icon";
import { LocalTableGameStorage } from "../../shared/api";
import LoadTableGameDialog from "../../components/modals/LoadTableGameDialog";
import "../../styles/components/TableGame.css";

const MIN_PLAYERS = 2;

const TableGame = () => {
  const [rows, setRows] = useState(12);
  const [players, setPlayers] = useState([
    { name: "Player 1", points: [] },
    { name: "Player 2", points: [] },
    { name: "Player 3", points: [] }
  ]);
  const [gameName, setGameName] = useState("");
  const [saveMessage, setSaveMessage] = useState({ text: "", type: "" });
  const [showLoadDialog, setShowLoadDialog] = useState(false);

  const handleNameChange = (idx, value) => {
    const updated = [...players];
    updated[idx].name = value;
    setPlayers(updated);
  };

  const handlePointChange = (playerIdx, rowIdx, value) => {
    const updated = [...players];
    updated[playerIdx].points[rowIdx] = value === "" ? "" : parseInt(value, 10) || 0;
    setPlayers(updated);
  };

  // Insert a player at a specific index
  const insertPlayer = (idx) => {
    const newPlayers = [...players];
    newPlayers.splice(idx, 0, { name: `Player ${players.length + 1}`, points: [] });
    setPlayers(newPlayers);
  };

  // Remove a player at a specific index
  const removePlayer = (idx) => {
    if (players.length <= MIN_PLAYERS) return; // Prevent removing below minimum
    const newPlayers = [...players];
    newPlayers.splice(idx, 1);
    setPlayers(newPlayers);
  };

  // Move player to the left
  const movePlayerLeft = (idx) => {
    if (idx === 0) return; // Can't move first player left
    const newPlayers = [...players];
    [newPlayers[idx - 1], newPlayers[idx]] = [newPlayers[idx], newPlayers[idx - 1]];
    setPlayers(newPlayers);
  };

  // Move player to the right
  const movePlayerRight = (idx) => {
    if (idx === players.length - 1) return; // Can't move last player right
    const newPlayers = [...players];
    [newPlayers[idx], newPlayers[idx + 1]] = [newPlayers[idx + 1], newPlayers[idx]];
    setPlayers(newPlayers);
  };

  const addRow = () => {
    setRows(rows + 1);
  };

  const getTotal = (player) => {
    return player.points.reduce((sum, val) => sum + (parseInt(val, 10) || 0), 0);
  };

  const saveGame = () => {
    try {
      const gameData = {
        players: players,
        rows: rows,
        timestamp: new Date().toISOString()
      };

      const name = gameName.trim() || `Table Game - ${new Date().toLocaleDateString()}`;
      const gameId = LocalTableGameStorage.saveTableGame(gameData, name);
      
      setSaveMessage({ 
        text: `Game saved successfully! (ID: ${gameId.substring(0, 8)}...)`, 
        type: "success" 
      });
      
      // Clear the message after 3 seconds
      setTimeout(() => {
        setSaveMessage({ text: "", type: "" });
      }, 3000);
      
    } catch (error) {
      console.error("Error saving table game:", error);
      setSaveMessage({ 
        text: "Failed to save game. Please try again.", 
        type: "error" 
      });
      
      // Clear the message after 5 seconds
      setTimeout(() => {
        setSaveMessage({ text: "", type: "" });
      }, 5000);
    }
  };

  const loadGame = (gameData) => {
    try {
      if (gameData && gameData.players) {
        setPlayers(gameData.players);
        setRows(gameData.rows || 12);
        setSaveMessage({ 
          text: "Game loaded successfully!", 
          type: "success" 
        });
        
        // Clear the message after 3 seconds
        setTimeout(() => {
          setSaveMessage({ text: "", type: "" });
        }, 3000);
      }
    } catch (error) {
      console.error("Error loading table game:", error);
      setSaveMessage({ 
        text: "Failed to load game. Please try again.", 
        type: "error" 
      });
      
      // Clear the message after 5 seconds
      setTimeout(() => {
        setSaveMessage({ text: "", type: "" });
      }, 5000);
    }
  };

  const deleteGame = (gameId) => {
    // This function is called when a game is deleted from the load dialog
    // We don't need to do anything special here as the dialog handles the deletion
    console.log(`Table game ${gameId} deleted`);
  };

  return (
    <div className="table-game-container">
      <button
        className="table-game-add-player-above"
        title="Add Player"
        onClick={() => insertPlayer(players.length)}
      >
        + Add Player
      </button>
      <div className="table-game-scroll">
        <table className="table-game-table">
          <thead>
            {/* Player Names Row */}
            <tr>
              {players.map((player, idx) => (
                <th key={idx}>
                  <div className="table-game-player-header">
                    <input
                      type="text"
                      value={player.name}
                      onChange={(e) => handleNameChange(idx, e.target.value)}
                      className="table-game-player-input"
                    />
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[...Array(rows)].map((_, rowIdx) => (
              <tr key={rowIdx}>
                {players.map((player, playerIdx) => (
                  <td key={playerIdx}>
                    <input
                      type="tel"
                      value={player.points[rowIdx] || ""}
                      onChange={(e) => handlePointChange(playerIdx, rowIdx, e.target.value)}
                      className="table-game-point-input"
                      inputMode="numeric"
                      pattern="[0-9]*"
                    />
                  </td>
                ))}
              </tr>
            ))}
            <tr>
              <td colSpan={players.length}>
                <button
                  className="table-game-add-row-inline"
                  title="Add Row"
                  onClick={addRow}
                >
                  Add Row
                </button>
              </td>
            </tr>
          </tbody>
          <tfoot>
            <tr>
              {players.map((player, idx) => (
                <td key={idx} className="table-game-total">
                  {getTotal(player)}
                </td>
              ))}
            </tr>
            {/* Controls Row */}
            <tr className="table-game-controls-row">
              {players.map((_, idx) => (
                <td key={`controls-${idx}`} className="table-game-controls-cell">
                  <div className="table-game-controls">
                    <button
                      className={`table-game-control-btn table-game-move-btn ${idx === 0 ? 'disabled' : ''}`}
                      title="Move Left"
                      onClick={() => movePlayerLeft(idx)}
                      disabled={idx === 0}
                    >
                      <ArrowLeftIcon size={16} />
                    </button>
                    {players.length > MIN_PLAYERS && (
                      <button
                        className="table-game-control-btn table-game-remove-btn"
                        title="Remove Player"
                        onClick={() => removePlayer(idx)}
                      >
                        <XIcon size={16} />
                      </button>
                    )}
                    <button
                      className={`table-game-control-btn table-game-move-btn ${idx === players.length - 1 ? 'disabled' : ''}`}
                      title="Move Right"
                      onClick={() => movePlayerRight(idx)}
                      disabled={idx === players.length - 1}
                    >
                      <ArrowRightIcon size={16} />
                    </button>
                  </div>
                </td>
              ))}
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Save Game Section */}
      <div className="table-game-save-section">
        <div className="save-controls">
          <input
            type="text"
            placeholder="Enter game name (optional)"
            value={gameName}
            onChange={(e) => setGameName(e.target.value)}
            className="table-game-name-input"
          />
          <button
            className="table-game-save-button"
            onClick={saveGame}
            title="Save Game"
          >
            <SaveIcon size={16} />
            Save Game
          </button>
          <button
            className="table-game-load-button"
            onClick={() => setShowLoadDialog(true)}
            title="Load Saved Game"
          >
            <UploadIcon size={16} />
            Load Game
          </button>
        </div>
        {saveMessage.text && (
          <div className={`save-message ${saveMessage.type}`}>
            {saveMessage.text}
          </div>
        )}
      </div>

      {/* Load Table Game Dialog */}
      <LoadTableGameDialog
        isOpen={showLoadDialog}
        onClose={() => setShowLoadDialog(false)}
        onLoadGame={loadGame}
        onDeleteGame={deleteGame}
      />
    </div>
  );
};

export default TableGame;
