"use client"

import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { useGameStateContext } from "../hooks/useGameState"

const NewGame = () => {
  
  const navigate = useNavigate()
  // const { players, loading } = usePlayers()
  const { gameState, addPlayer, removePlayer, updatePlayerName, startGame, setMaxRounds } = useGameStateContext()

  const [index, setIndex] = useState(1)
  const [manualRounds, setManualRounds] = useState(false)
  
  // Calculate the recommended number of rounds based on player count
  useEffect(() => {
    // Only auto-adjust rounds if manual mode is not enabled
    if (!manualRounds) {
      const playerCount = gameState.players.length;
      if (playerCount >= 2 && playerCount <= 6) {
        // Standard rule: 60 cards divided by number of players
        const recommendedRounds = Math.floor(60 / playerCount);
        // Only update if it's different to avoid unnecessary renders
        if (gameState.maxRounds !== recommendedRounds) {
          setMaxRounds(recommendedRounds);
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState.players.length, setMaxRounds, manualRounds]);

  const handleAddPlayer = () => {
    setIndex(index + 1)
    addPlayer(index)
    
    // Don't auto-adjust rounds when in manual mode
    // This way manually selected rounds will be preserved when adding players
  }

  const handlePlayerNameChange = (playerId, e) => {
    const newName = e.target.value
    updatePlayerName(playerId, newName)
  }

  const handleRemovePlayer = (playerId) => {
    setIndex(index - 1)
    removePlayer(playerId)
    
    // Don't auto-adjust rounds when in manual mode
    // This way manually selected rounds will be preserved when removing players
  }

  const handleStartGame = () => {
    startGame()
    navigate("/game/current")
  }
  
  const handleMaxRoundsChange = (value) => {
    // If the user manually changes the value, enable manual rounds mode
    setManualRounds(true);
    
    // Ensure the value is between 1 and 20 (the maximum possible)
    const validValue = Math.max(0, Math.min(value, 20));
    setMaxRounds(validValue);
  }

  // Calculate the recommended rounds once (memoized)
  const recommendedRounds = gameState.players.length >= 2 && gameState.players.length <= 6 
    ? Math.floor(60 / gameState.players.length)
    : 20; // Default max

  // if (loading) {
  //   return <div className="loading">Loading players...</div>
  // }

  return (
    <div className={`new-game-container players-${gameState.players.length}`}>
      <h1>New Game</h1>

      <div className="setup-section">
        <h2>Add Players</h2>

        {/*Adding Players*/}
        <div className="selected-players">

          <div className="player-list">
            {gameState.players.map((player) => (
              <div key={player.id} className="player-item">
                <span>{player.id}</span>
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
                  max={manualRounds ? 20 : recommendedRounds}
                  inputMode="numeric"
                  pattern="[0-9]*"
                />
              </div>

              <div className="toggle-container">
                <label className="toggle-label">
                  <span className="toggle-text">Don't auto adjust rounds:</span>
                  <br />
                </label>

                <label className="toggle-label" id="manual-rounds-toggle">
                  <input
                    type="checkbox"
                    checked={manualRounds}
                    onChange={() => setManualRounds(!manualRounds)}
                  />
                {manualRounds && (
                  <div className="rounds-hint">
                    Recommended: {recommendedRounds} rounds
                  </div>
                )}
                </label>
              </div>
              
            </div>
          </div>
        </div>
    </div>

      <button className="start-game-btn" disabled={gameState.players.length < 2 || gameState.players.length > 6} onClick={handleStartGame}>
        Start Game
      </button>
      {gameState.players.length < 3 && (
        <div className="error-message">At least 3 players are recommended for a standard game</div>
      )}
      {gameState.players.length > 6 && (
        <div className="error-message">Maximum of 6 players are supported</div>
      )}
    </div>
  )
}

export default NewGame
