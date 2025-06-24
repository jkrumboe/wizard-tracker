"use client"

import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { useGameStateContext } from "../hooks/useGameState"
import NumberPicker from "../components/NumberPicker"

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
      setMaxRounds(recommendedRounds);
    }
  }, [gameState.players.length, setMaxRounds]);

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
    setMaxRounds(value)
  }

  // Calculate the recommended and maximum rounds
  const calculateMaxPossibleRounds = () => {
    const playerCount = gameState.players.length;
    if (playerCount < 3) return 20; // Default max
    return Math.floor(60 / playerCount);
  };

  const recommendedRounds = calculateMaxPossibleRounds();

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
            <span>Number of Rounds:</span>
            <NumberPicker
              value={gameState.maxRounds}
              onChange={handleMaxRoundsChange}
              min={1}
              max={recommendedRounds}
              title={`Select Number of Rounds (Recommended: ${recommendedRounds})`}
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
