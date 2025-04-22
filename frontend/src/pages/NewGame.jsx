"use client"

import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { usePlayers } from "../hooks/usePlayers"
import { useGameStateContext } from "../hooks/useGameState"
import { searchPlayersByTag } from "../services/playerService"
import SearchBar from "../components/SearchBar"
import NumberPicker from "../components/NumberPicker"
import defaultAvatar from "../assets/default-avatar.png";

const NewGame = () => {
  const navigate = useNavigate()
  const { players, loading, tags } = usePlayers()
  const { gameState, addPlayer, removePlayer, startGame, setMaxRounds, setMode } = useGameStateContext()

  const [searchQuery, setSearchQuery] = useState("")
  const [filteredPlayers, setFilteredPlayers] = useState([])
  const [showSearch, setShowSearch] = useState(false)

  useEffect(() => {
    if (players.length > 0) {
      const filtered = players.filter(
        (player) =>
          !gameState.players.some((p) => p.id === player.id) &&
          (player.name.toLowerCase().includes(searchQuery.toLowerCase()))
      )
      setFilteredPlayers(filtered)
    }
  }, [players, tags, searchQuery, gameState.players])

  const handleTagClick = async (tag) => {
    setSearchQuery(tag)
    setShowSearch(true)
    try {
      const data = await searchPlayersByTag(tag)
      setFilteredPlayers(data)
    } catch (error) {
      console.error("Error fetching players by tag:", error)
    }
  }

  const handleSearch = (query) => {
    setSearchQuery(query)
    setShowSearch(query.length > 0)
  }

  const handleAddPlayer = (player) => {
    addPlayer(player)
    setSearchQuery("")
    setShowSearch(false)
  }

  const handleRemovePlayer = (playerId) => {
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
  // console.log("Tags:", tags)
  // console.log("Filtered Players:", filteredPlayers)

  if (loading) {
    return <div className="loading">Loading players...</div>
  }

  return (
    <div className="new-game-container">
      <h1>New Game</h1>

      <div className="setup-section">
        <h2>Select Players</h2>
        <div className="tags-list">
          {tags
            .filter(tag => !tag.name.startsWith("Top "))
            .filter(tag => !tag.name.includes("Ranked"))
            .filter(tag => !tag.name.includes("Casual"))
            .map(tag => (
              <span key={tag.id} className="tag" onClick={() => handleTagClick(tag.name)}>
                {tag.name}
              </span>
          ))}
        </div>

        <div className="player-search">
          <SearchBar
            onSearch={handleSearch}
            placeholder="Search players..."
            value={searchQuery}
          />
          {showSearch && filteredPlayers.length > 0 && (
            <div className="search-results">
              {filteredPlayers.map((player) => (
                <div key={player.id} className="player-result" onClick={() => handleAddPlayer(player)}>
                  <img src={player.avatar || defaultAvatar} alt={player.name} className="player-avatar" />
                  <span>{player.name}</span>
                </div>
              ))}
            </div>
          )}
          {showSearch && filteredPlayers.length === 0 && (
            <div className="search-results">
              <div className="no-results">No players found</div>
            </div>
          )}
        </div>

        <div className="selected-players">
          <h3>Selected Players ({gameState.players.length})</h3>
          {gameState.players.length === 0 ? (
            <div className="no-players">No players selected yet</div>
          ) : (
            <div className="player-list">
              {gameState.players.map((player) => (
                <div key={player.id} className="player-item">
                  <img src={player.avatar || defaultAvatar} alt={player.name} className="player-avatar" />
                  <span>{player.name}</span>
                  <button className="remove-btn" onClick={() => handleRemovePlayer(player.id)}>
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="settings-section">
        <h2>Game Settings</h2>
        <div className="setting-item">

        <select value={gameState.mode} onChange={(e) => setMode(e.target.value)}>
          <option value="Casual">Casual</option>
          <option value="Ranked">Ranked</option>
        </select>

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
