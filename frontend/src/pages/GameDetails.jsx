"use client"

import { useState, useEffect } from "react"
import { useParams, Link } from "react-router-dom"
import { getGameById } from "../services/gameService"
import { getPlayerById } from "../services/playerService"

const GameDetails = () => {
  const { id } = useParams()
  const [game, setGame] = useState(null)
  const [playerDetails, setPlayerDetails] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const fetchGameData = async () => {
      try {
        setLoading(true)
        const gameData = await getGameById(Number.parseInt(id))
        setGame(gameData)

        // Fetch player details
        const playerIds = Object.keys(gameData.scores)
        const playerPromises = playerIds.map((playerId) => getPlayerById(Number.parseInt(playerId)))
        const players = await Promise.all(playerPromises)

        const playerMap = {}
        players.forEach((player) => {
          if (player) {
            playerMap[player.id] = player
          }
        })

        setPlayerDetails(playerMap)
        setLoading(false)
      } catch (err) {
        console.error("Error fetching game details:", err)
        setError("Failed to load game details")
        setLoading(false)
      }
    }

    fetchGameData()
  }, [id])

  if (loading) {
    return <div className="loading">Loading game details...</div>
  }

  if (error || !game) {
    return <div className="error">{error || "Game not found"}</div>
  }

  // Sort players by score (highest first)
  const sortedPlayers = Object.entries(game.scores)
    .map(([playerId, score]) => ({
      id: Number.parseInt(playerId),
      score,
      ...playerDetails[playerId],
    }))
    .sort((a, b) => b.score - a.score)

  return (
    <div className="game-details-container">
      <div className="game-details-header">
        <Link to="/" className="back-link">
          ← Back to Home
        </Link>
        <h1>Game Details</h1>
        <div className="game-date">{game.date}</div>
      </div>

      <div className="game-summary">
        <div className="winner-section">
          <h2>Winner</h2>
          {playerDetails[game.winner] && (
            <div className="winner-card">
              <img
                src={playerDetails[game.winner].avatar || "/placeholder.svg"}
                alt={playerDetails[game.winner].name}
                className="winner-avatar"
              />
              <div className="winner-info">
                <h3>{playerDetails[game.winner].name}</h3>
                <div className="winner-score">Score: {game.scores[game.winner]}</div>
              </div>
            </div>
          )}
        </div>

        <div className="results-section">
          <h2>Final Results</h2>
          <div className="results-table">
            <div className="results-header">
              <div className="rank-col">Rank</div>
              <div className="player-col">Player</div>
              <div className="score-col">Score</div>
            </div>
            {sortedPlayers.map((player, index) => (
              <div key={player.id} className="results-row">
                <div className="rank-col">{index + 1}</div>
                <div className="player-col">
                  <Link to={`/profile/${player.id}`} className="player-link">
                    <img src={player.avatar || "/placeholder.svg"} alt={player.name} className="player-avatar" />
                    <span>{player.name}</span>
                  </Link>
                </div>
                <div className="score-col">{player.score}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export default GameDetails

