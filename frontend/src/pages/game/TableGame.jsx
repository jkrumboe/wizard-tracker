import React, { useState } from "react";
import { ArrowLeftIcon, ArrowRightIcon, XIcon, ArrowLeftCircleIcon, SaveIcon } from "../../components/ui/Icon";
import { LocalTableGameTemplate, LocalTableGameStorage } from "../../shared/api";
import GameTemplateSelector from "../../components/game/GameTemplateSelector";
import "../../styles/components/TableGame.css";

const MIN_PLAYERS = 2;

const TableGame = () => {
  const [rows, setRows] = useState(12);
  const [players, setPlayers] = useState([
    { name: "Player 1", points: [] },
    { name: "Player 2", points: [] },
    { name: "Player 3", points: [] }
  ]);
  const [showTemplateSelector, setShowTemplateSelector] = useState(true);
  const [currentGameName, setCurrentGameName] = useState("");

  const handleNameChange = (idx, value) => {
    const updated = [...players];
    updated[idx].name = value;
    setPlayers(updated);
  };

  const handlePointChange = (playerIdx, rowIdx, value) => {
    const updated = [...players];
    if (value === "") {
      updated[playerIdx].points[rowIdx] = "";
    } else {
      const parsed = parseInt(value, 10);
      updated[playerIdx].points[rowIdx] = isNaN(parsed) ? "" : parsed;
    }
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

  const loadGame = (gameData) => {
    try {
      if (gameData && gameData.players) {
        setPlayers(gameData.players);
        setRows(gameData.rows || 12);
        setShowTemplateSelector(false);
        
        // Set the game name from the loaded game
        const loadedGameName = gameData.gameName || "Loaded Game";
        setCurrentGameName(loadedGameName);
      }
    } catch (error) {
      console.error("Error loading table game:", error);
    }
  };

  const handleSelectTemplate = (templateName) => {
    setCurrentGameName(templateName);
    setShowTemplateSelector(false);
    // Reset the game state
    setPlayers([
      { name: "Player 1", points: [] },
      { name: "Player 2", points: [] },
      { name: "Player 3", points: [] }
    ]);
    setRows(12);
  };

  const handleCreateNewGame = (newGameName) => {
    if (newGameName && newGameName.trim()) {
      const trimmedName = newGameName.trim();
      // Save as a template
      LocalTableGameTemplate.saveTemplate(trimmedName);
      // Start the game with this name
      handleSelectTemplate(trimmedName);
    }
  };

  const handleBackToTemplates = () => {
    setShowTemplateSelector(true);
    setCurrentGameName("");
  };

  const saveGame = () => {
    try {
      const gameData = {
        players: players,
        rows: rows,
        timestamp: new Date().toISOString()
      };

      const name = currentGameName || `Table Game - ${new Date().toLocaleDateString()}`;
      LocalTableGameStorage.saveTableGame(gameData, name);
      
      // Show a brief success message (you could add state for this if you want a toast notification)
      alert(`Game "${name}" saved successfully!`);
    } catch (error) {
      console.error("Error saving table game:", error);
      alert("Failed to save game. Please try again.");
    }
  };

  return (
    <div className="table-game-container">
      {showTemplateSelector ? (
        <GameTemplateSelector
          onSelectTemplate={handleSelectTemplate}
          onCreateNew={handleCreateNewGame}
          onLoadGame={loadGame}
        />
      ) : (
        <>
          <div className="table-game-header">
            <button
              className="back-to-templates-btn"
              onClick={handleBackToTemplates}
              title="Back to Game Selection"
            >
              <ArrowLeftCircleIcon size={20} />
              Back
            </button>
            <button
              className="table-game-add-player-above"
              title="Add Player"
              onClick={() => insertPlayer(players.length)}
            >
              Add Player
            </button>
            <button
              className="table-game-save-btn"
              onClick={saveGame}
              title="Save Game"
            >
              <SaveIcon size={20} />
              Save
            </button>
          </div>

          
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
                      value={player.points[rowIdx] ?? ""}
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
        </>
      )}
    </div>
  );
};

export default TableGame;
