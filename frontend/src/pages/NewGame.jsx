"use client"

import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { useGameStateContext } from "../hooks/useGameState"

const NewGame = () => {
  
  const navigate = useNavigate()
  // const { players, loading } = usePlayers()
  const { gameState, addPlayer, removePlayer, updatePlayerName, startGame, setMaxRounds } = useGameStateContext()

  const [index, setIndex] = useState(1)
  
  // Calculate the recommended number of rounds based on player count
  useEffect(() => {
    const playerCount = gameState.players.length;
    if (playerCount >= 3) {
      // Standard rule: 60 cards divided by number of players
      const recommendedRounds = Math.floor(60 / playerCount);
      // Only update if it's different to avoid unnecessary renders
      if (gameState.maxRounds !== recommendedRounds) {
        setMaxRounds(recommendedRounds);
      }
    }
  }, [gameState.players.length, gameState.maxRounds, setMaxRounds]);

  const handleAddPlayer = () => {
    setIndex(index + 1)
    addPlayer(index) 
  }

  const handlePlayerNameChange = (playerId, e) => {
    const newName = e.target.value
    updatePlayerName(playerId, newName)
  }

  const handleRemovePlayer = (playerId) => {
    setIndex(index - 1)
    removePlayer(playerId)
  }

  const handleStartGame = () => {
    startGame()
    navigate("/game/current")
  }
  
  const handleMaxRoundsChange = (value) => {
    // Ensure the value is between 1 and recommendedRounds
    const validValue = Math.max(1, Math.min(value, recommendedRounds));
    setMaxRounds(validValue);
  }

  // Calculate the recommended rounds once (memoized)
  const recommendedRounds = gameState.players.length >= 3 
    ? Math.floor(60 / gameState.players.length)
    : 20; // Default max

  // if (loading) {
  //   return <div className="loading">Loading players...</div>
  // }

  return (
    <div className="new-game-container">
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
        
        <div className="setting-item">
            <label htmlFor="rounds-input">Number of Rounds:</label>
            <input
              id="rounds-input"
              type="tel"
              value={gameState.maxRounds}
              onChange={(e) => handleMaxRoundsChange(parseInt(e.target.value) || 1)}
              min={1}
              max={recommendedRounds}
              title={`Enter Number of Rounds (Recommended: ${recommendedRounds})`}
              inputMode="numeric"
              pattern="[0-9]*"
            />
        </div>
    </div>

      <button className="start-game-btn" disabled={gameState.players.length < 2} onClick={handleStartGame}>
        Start Game
      </button>
      {gameState.players.length < 3 && (
        <div className="error-message">At least 3 players are required to start a game</div>
      )}
    </div>
  )
}

export default NewGame
