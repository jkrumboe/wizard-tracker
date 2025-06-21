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
        const gameData = await getGameById(id)
        
        if (!gameData) {
          throw new Error("Game not found")
        }
        
        setGame(gameData)

        // Handle player details differently based on game type
        let playerMap = {}

        // For local games, player data is already included in the game object
        if (gameData.is_local && gameData.players) {
          gameData.players.forEach((player) => {
            if (player) {
              playerMap[player.id] = player
            }
          })
        } 
        // For server games, fetch player details from the API
        else {
          const playerIds = gameData.player_ids || []
          const playerPromises = playerIds.map((playerId) => getPlayerById(playerId))
          const players = await Promise.all(playerPromises)
          
          players.forEach((player) => {
            if (player) {
              playerMap[player.id] = player
            }
          })
        }

        setPlayerDetails(playerMap)
        setLoading(false)
      } catch (err) {
        console.error("Error fetching game details:", err)
        setError("Failed to load game details: " + err.message)
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
  const sortedPlayers = Object.entries(game.final_scores || {})
    .map(([playerId, score]) => ({
      id: Number.parseInt(playerId),
      score,
      ...playerDetails[playerId],
    }))
    .sort((a, b) => b.score - a.score)

  // Add detailed statistics for each player
  function calculatePlayerStats(game) {
    if (!game.round_data || !Array.isArray(game.round_data)) {
      return [];
    }

    const stats = Object.entries(game.final_scores || {}).map(([playerId]) => {
      const playerRounds = game.round_data.map((round) => {
        if (!round || !round.players) return null;
        return round.players.find((p) => p.id === Number(playerId));
      });

      const totalBids = playerRounds.reduce((sum, round) => sum + (round?.call || 0), 0);
      const totalTricks = playerRounds.reduce((sum, round) => sum + (round?.made || 0), 0);
      const correctBids = playerRounds.filter((round) => round?.call === round?.made).length;
      const overbids = playerRounds.filter((round) => round?.made > round?.call).length;
      const underbids = playerRounds.filter((round) => round?.made < round?.call).length;
      const totalPoints = playerRounds.reduce((sum, round) => sum + (round?.score || 0), 0);
      const avgPoints = totalPoints / game.round_data.length;
      const avgBid = totalBids / game.round_data.length;
      const avgTricks = totalTricks / game.round_data.length;
      const avgDiff =
        playerRounds.reduce((sum, round) => sum + Math.abs((round?.made || 0) - (round?.call || 0)), 0) /
        game.round_data.length;

      return {
        id: Number(playerId),
        totalBids,
        totalTricks,
        correctBids,
        bidAccuracy: ((correctBids / game.round_data.length) * 100).toFixed(2),
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
  const playerStats = calculatePlayerStats(game);

  const formattedDate = new Date(game.created_at).toLocaleDateString("en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

  const duration = game.duration_seconds
    ? `${Math.floor(game.duration_seconds / 3600)}h ${Math.floor((game.duration_seconds % 3600) / 60)}m ${game.duration_seconds % 60}s`
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
        <h1>Game Details {game.is_local && <span className="mode-badge local">Local</span>}</h1>
        
        <div className="game-date">Finished: {formattedDate}</div>
        <div className="game-date">Duration: {duration}</div>
      </div>

      <div className="game-summary">
        <div className="winner-section">
          <h2>Winner</h2>
          {playerDetails[game.winner_id] && (
            <div className="winner-card">
              <img
                src={playerDetails[game.winner_id].avatar || defaultAvatar}
                alt={playerDetails[game.winner_id].name}
                className="winner-avatar"
              />
              <div className="winner-info">
                <h3>{playerDetails[game.winner_id].name}</h3>
                <div className="winner-score">Score: {game.final_scores[game.winner_id]}</div>
              </div>
            </div>
          )}
        </div>

        <div className="players-section">
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
                {activeTab === 'rounds' && (
                <div className="rounds-section">
                  <h2>Rounds</h2>
                  {game.round_data && game.round_data.map((round, index) => (
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
        { (window.innerWidth > 768 || activeTab === 'finalResults') && (
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
                    {game.is_local ? (
                      <div className="player-info">
                        <img src={player.avatar || defaultAvatar} alt={player.name} className="player-avatar" />
                        <span>{player.name}</span>
                      </div>
                    ) : (
                      <Link to={`/profile/${player.id}`} className="player-link">
                        <img src={player.avatar || defaultAvatar} alt={player.name} className="player-avatar" />
                        <span>{player.name}</span>
                      </Link>
                    )}
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
      </div>
    </div>
  );
}

export default GameDetails

