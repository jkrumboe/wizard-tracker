"use client"

import { useState, useEffect, useCallback } from "react"
import { useNavigate } from "react-router-dom"
import { useGameStateContext } from "../hooks/useGameState"
import { LocalGameStorage } from "../services/localGameStorage"

const NewGame = () => {
  
  const navigate = useNavigate()
  // const { players, loading } = usePlayers()
  const { 
    gameState, 
    addPlayer, 
    removePlayer, 
    updatePlayerName, 
    startGame, 
    setMaxRounds, 
    getSavedGames, 
    resumeGame, 
    deleteSavedGame 
  } = useGameStateContext()

  // No longer need index since we generate unique IDs in addPlayer
  // Always default to the new-game tab, never auto-switch
  const [activeTab, setActiveTab] = useState('new-game')
  const [pausedGames, setPausedGames] = useState([])
  
  // Function to load paused games
  const loadPausedGames = useCallback(async () => {
    try {
      // Debug local storage
      // LocalGameStorage.debugStorage();
      
      // Get all saved games
      const games = await getSavedGames();
      
      // Filter to only include games that are not finished and are marked as paused
      const paused = games.filter(game => 
        !game.gameFinished && game.isPaused === true
      );
      
      setPausedGames(paused);
    
      // We want the new-game tab to always be the default
    } catch (error) {
      console.error("Error loading paused games:", error);
    }
  }, [getSavedGames]);
    
  // Load paused games only when the component mounts (first render)
  useEffect(() => {
    loadPausedGames();
  }, [loadPausedGames]);
  
  // Also refresh when activeTab changes to 'paused-games'
  useEffect(() => {
    if (activeTab === 'paused-games') {
      loadPausedGames();
    }
  }, [activeTab, loadPausedGames]);

  const handleAddPlayer = () => {
    // Call addPlayer without any arguments as it now generates unique IDs internally
    addPlayer()
  }

  const handlePlayerNameChange = (playerId, e) => {
    const newName = e.target.value
    updatePlayerName(playerId, newName)
  }

  const handleRemovePlayer = (playerId) => {
    removePlayer(playerId)
  }

  const handleStartGame = () => {
    startGame()
    navigate("/game/current")
  }

  // Handle loading a saved game
  const handleLoadGame = async (gameId) => {
    try {
      const result = await resumeGame(gameId);
      if (result && result.success) {
        navigate("/game/current");
        return { success: true };
      } else {
        return { 
          success: false, 
          error: result && result.error ? result.error : "Failed to load game"
        };
      }
    } catch (error) {
      console.error("Error loading game:", error);
      return { 
        success: false, 
        error: error.message 
      };
    }
  }

  // Handle deleting a saved game
  const handleDeleteGame = async (gameId) => {
    try {
      const result = await deleteSavedGame(gameId);
      if (result && result.success) {
        setPausedGames(prevGames => prevGames.filter(game => game.id !== gameId));
        return { success: true };
      } else {
        return { 
          success: false, 
          error: result && result.error ? result.error : "Failed to delete game"
        };
      }
    } catch (error) {
      console.error("Error deleting game:", error);
      return { 
        success: false, 
        error: error.message 
      };
    }
  }
  
  const handleMaxRoundsChange = (value) => {    
    // Ensure the value is between 0 and 20 (the maximum possible)
    const validValue = Math.max(0, Math.min(value, 20));
    setMaxRounds(validValue);
  }

  // Calculate the recommended rounds once (memoized)
  const recommendedRounds = gameState.players.length > 2 && gameState.players.length <= 6 
    ? Math.floor(60 / gameState.players.length)
    : 20; // Default max

  const normalizeDate = (date) => {
    if (!date) return "Unknown Date";
    const d = new Date(date);
    return d.toLocaleString("en-US", {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

  return (
    <div className="new-game-container">
      {activeTab === 'new-game' && (
        <div className={`tab-panel players-${gameState.players.length}`}>
          <div className="setup-section">
            <div className="tab-controls">
              <button 
                className={`tab-button ${activeTab === 'new-game' ? 'active' : ''}`}
                onClick={() => setActiveTab('new-game')}
              >
                New Game
              </button>
              <button 
                className={`tab-button ${activeTab === 'paused-games' ? 'active' : ''}`}
                onClick={() => setActiveTab('paused-games')}
              >
                Paused Games
              </button>
            </div>

            {/*Adding Players*/}
            <div className="selected-players">
              <div className="player-list">
                {gameState.players.map((player, index) => (
                  <div key={player.id} className="player-item">
                    <span>{index + 1}</span>
                    <input 
                      className="inputPlayerName" 
                      value={player.name} 
                      inputMode="text" 
                      onChange={(e) => handlePlayerNameChange(player.id, e)}
                    />
                    <button className="remove-btn" onClick={() => handleRemovePlayer(player.id)}>
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <button className="addPlayer" onClick={handleAddPlayer}>
              +
            </button>
            
            <div className="settings-group">
              <div className="setting-item">
                <div className="setting-content">
                  <div id="rounds">
                    <label htmlFor="rounds-input">Number of Rounds:</label>
                    <input
                      id="rounds-input"
                      type="tel"
                      value={gameState.maxRounds}
                      onChange={(e) => handleMaxRoundsChange(parseInt(e.target.value) || 0)}
                      min={1}
                      max={recommendedRounds ? recommendedRounds : 20}
                      inputMode="numeric"
                      pattern="[0-9]*"
                    />
                  </div>
                  <div className="rounds-hint">
                        Recommended: {recommendedRounds} rounds
                  </div>
                </div>
              </div>
            </div>
          </div>

          <button 
            className="start-game-btn" 
            disabled={gameState.players.length < 2 || gameState.players.length > 6} 
            onClick={handleStartGame}
          >
            Start Game
          </button>
          
          {gameState.players.length < 3 && (
            <div className="error-message">At least 3 players are needed to start a game</div>
          )}
          
          {gameState.players.length > 6 && (
            <div className="error-message">Maximum of 6 players are supported</div>
          )}
        </div>
      )}

      {activeTab === 'paused-games' && (
        <div className="tab-panel">
          <div className="paused-games-section">
            <div className="tab-controls">
              <button 
                className={`tab-button ${activeTab === 'new-game' ? 'active' : ''}`}
                onClick={() => setActiveTab('new-game')}
              >
                New Game
              </button>
              <button 
                className={`tab-button ${activeTab === 'paused-games' ? 'active' : ''}`}
                onClick={() => setActiveTab('paused-games')}
              >
                Paused Games
              </button>
            </div>
            
            
            { pausedGames.length === 0 ? (
              <div className="empty-paused-games">
                <p>No paused games found</p>
                <p>When you pause a game, it will appear here</p>
              </div>
            ) : (
              <div className="paused-games-list">
                {pausedGames.map(game => (
                  <div key={game.id} className="paused-game-item">
                    <div className="game-date">
                      <span>Paused on: {normalizeDate(game.lastPlayed)}</span>
                    </div>
                    <div className="game-mode-rounds">
                      <span>Mode: {game.game_mode || game.mode || (game.gameState && game.gameState.mode) || "Local"} | <span>Round {game.roundsCompleted + 1}/{game.totalRounds}</span></span>
                    </div>
                    <div className="game-info">
                       <div className="paused-game-details" >
                        <label>Players: </label>
                        <span>{game.players && game.players.join(', ')}</span>
                        
                      </div>
                    </div>
                    
                    <div className="game-actions" >
                      <button 
                        className="resume-btn" 
                        onClick={() => handleLoadGame(game.id)}
                      >
                        Resume
                      </button>
                      <button 
                        className="delete-btn" 
                        onClick={() => handleDeleteGame(game.id)}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default NewGame
