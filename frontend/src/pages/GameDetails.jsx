"use client"

import { useState, useEffect } from "react"
import { useParams, Link } from "react-router-dom"
import { getGameById } from "../services/gameService"
import { getPlayerById } from "../services/playerService"
import defaultAvatar from "../assets/default-avatar.png" 

const GameDetails = () => {
  const { id } = useParams()
  const [game, setGame] = useState(null)
  const [playerDetails, setPlayerDetails] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [selectedPlayerId, setSelectedPlayerId] = useState(null)
  const [activeTab, setActiveTab] = useState('finalResults')

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

  // Add detailed statistics for each player
  // Add a null check for round.players in calculatePlayerStats
  const calculatePlayerStats = (game) => {
    if (!game.rounds || !Array.isArray(game.rounds)) {
      return [];
    }

    const stats = Object.entries(game.scores).map(([playerId]) => {
      const playerRounds = game.rounds.map((round) => {
        if (!round || !round.players) return null; // Ensure round and round.players are defined
        return round.players.find((p) => p.id === Number(playerId));
      });

      const totalBids = playerRounds.reduce((sum, round) => sum + (round?.call || 0), 0);
      const totalTricks = playerRounds.reduce((sum, round) => sum + (round?.made || 0), 0);
      const correctBids = playerRounds.filter((round) => round?.call === round?.made).length;
      const overbids = playerRounds.filter((round) => round?.made > round?.call).length;
      const underbids = playerRounds.filter((round) => round?.made < round?.call).length;
      const totalPoints = playerRounds.reduce((sum, round) => sum + (round?.score || 0), 0);
      const avgPoints = totalPoints / game.rounds.length;
      const avgBid = totalBids / game.rounds.length;
      const avgTricks = totalTricks / game.rounds.length;
      const avgDiff =
        playerRounds.reduce((sum, round) => sum + Math.abs((round?.made || 0) - (round?.call || 0)), 0) /
        game.rounds.length;

      return {
        id: Number(playerId),
        totalBids,
        totalTricks,
        correctBids,
        bidAccuracy: ((correctBids / game.rounds.length) * 100).toFixed(2),
        overbids,
        underbids,
        avgDiff: avgDiff.toFixed(2),
        totalPoints,
        avgPoints: avgPoints.toFixed(2),
        avgBid: avgBid.toFixed(2),
        avgTricks: avgTricks.toFixed(2),
        highestScore: Math.max(...playerRounds.map((round) => round?.score || 0)),
        lowestScore: Math.min(...playerRounds.map((round) => round?.score || 0)),
      };
    });

    return stats;
  }

  const playerStats = calculatePlayerStats(game)
  console.log("Game Stats:", playerStats)
  console.log("Player Details:", playerDetails)
  console.log("Game Data:", game)
  console.log("Game Data Rounds:", game.rounds)

  const formattedDate = new Date(game.date).toLocaleDateString("en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

  const duration = game.duration
    ? `${Math.floor(game.duration / 1000 / 60 / 60)}h ${Math.floor((game.duration / 1000 / 60) % 60)}m ${(Math.floor(game.duration / 1000) % 60)}s`
    : "N/A";

  const togglePlayerStats = (playerId) => {
    setSelectedPlayerId((prev) => (prev === playerId ? null : playerId));
  };

  return (
    <div className="game-details-container">
      <div className="game-details-header">
        <Link to="/" className="back-link">
          ← Back to Home
        </Link>
        <h1>Game Details</h1>
        <div className="game-date">{formattedDate} | {duration}</div>
      </div>

      <div className="game-summary">
        <div className="winner-section">
          <h2>Winner</h2>
          {playerDetails[game.winner] && (
            <div className="winner-card">
              <img
                src={playerDetails[game.winner].avatar || defaultAvatar}
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

        <div className="card-tabs">
          <button
            className={`tab-button ${activeTab === 'finalResults' ? 'active' : ''}`}
            onClick={() => setActiveTab('finalResults')}
          >
            Final Results
          </button>
          <button
            className={`tab-button ${activeTab === 'rounds' ? 'active' : ''}`}
            onClick={() => setActiveTab('rounds')}
          >
            Rounds
          </button>
        </div>

        {activeTab === 'finalResults' && (
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
                      <img src={player.avatar || defaultAvatar} alt={player.name} className="player-avatar" />
                      <span>{player.name}</span>
                    </Link>
                  </div>
                  <div className="score-col">{player.score}</div>
                  <button className="adv-stats-btn" onClick={() => togglePlayerStats(player.id)}>
                    Adv. Stats
                  </button>
                  {selectedPlayerId === player.id && (
                    <div className="advanced-stats">
                      <h3>Advanced Stats</h3>
                      <p>Total Bids: {playerStats.find((stat) => stat.id === player.id)?.totalBids}</p>
                      <p>Total Tricks: {playerStats.find((stat) => stat.id === player.id)?.totalTricks}</p>
                      <p>Correct Bids: {playerStats.find((stat) => stat.id === player.id)?.correctBids}</p>
                      <p>Bid Accuracy: {playerStats.find((stat) => stat.id === player.id)?.bidAccuracy}%</p>
                      <p>Overbids: {playerStats.find((stat) => stat.id === player.id)?.overbids}</p>
                      <p>Underbids: {playerStats.find((stat) => stat.id === player.id)?.underbids}</p>
                      <p>Average Difference: {playerStats.find((stat) => stat.id === player.id)?.avgDiff}</p>
                      <p>Total Points: {playerStats.find((stat) => stat.id === player.id)?.totalPoints}</p>
                      <p>Average Points: {playerStats.find((stat) => stat.id === player.id)?.avgPoints}</p>
                      <p>Highest Score: {playerStats.find((stat) => stat.id === player.id)?.highestScore}</p>
                      <p>Lowest Score: {playerStats.find((stat) => stat.id === player.id)?.lowestScore}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'rounds' && (
          <div className="rounds-section">
            <h2>Rounds</h2>
            {game.rounds.map((round, index) => (
              <div key={index} className="round-card">
                <h3>Round {index + 1}</h3>
                  <div className="round-players">
                    
                    {round.players.map((player) => (
                      <div key={player.id} className="round-player">
                        <span className="name">{playerDetails[player.id]?.name || "Unknown"}</span>
                        <span className="bid">Bid: {player.call}</span>
                        <span className="made">Made: {player.made}</span>
                        <span className="score">Score: {player.score}</span>
                      </div>
                    ))}
                  </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default GameDetails

