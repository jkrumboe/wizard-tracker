"use client"

import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { useGameStateContext } from "../hooks/useGameState"
import NumberPicker from "../components/NumberPicker"

const NewGame = () => {  const navigate = useNavigate()
  // const { players, loading } = usePlayers()
  const { gameState, addPlayer, removePlayer, updatePlayerName, startGame, setMaxRounds, setMode } = useGameStateContext()

  const [index, setIndex] = useState(1)

  const handleAddPlayer = () => {
    setIndex(index + 1)
    console.log("Index inside handleAddPlayer", index)
    gameState.players.push({ id: index, name: `Player ${index}` })
    console.log(gameState.players)
    // addPlayer(index) 
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

  // console.log("Players:", players)
  console.log("index", index)

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
              max={20}
              title="Select Number of Rounds"
            />
        </div>
    </div>

      <button className="start-game-btn" disabled={gameState.players.length < 2} onClick={handleStartGame}>
        Start Game
      </button>
      {gameState.players.length < 2 && (
        <div className="error-message">At least 2 players are required to start a game</div>
      )}
    </div>
  )
}

export default NewGame
