"use client"

import { useState, useEffect } from "react"
import { useParams, Link } from "react-router-dom"
import { getGameById } from "../services/gameService"
import { getPlayerById } from "../services/playerService"
import { ArrowLeftIcon, BarChartIcon, GamepadIcon } from "../components/Icon"
import PerformanceMetric from "../components/PerformanceMetric"
import defaultAvatar from "../assets/default-avatar.png" 
import "../styles/performanceMetrics.css"
import "../styles/scorecard.css"
import PageTransition from "../components/PageTransition"
import "../styles/pageTransition.css"

const GameDetails = () => {
  const { id } = useParams()
  const [game, setGame] = useState(null)
  const [playerDetails, setPlayerDetails] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [selectedPlayerId, setSelectedPlayerId] = useState(null)
  const [activeTab, setActiveTab] = useState('stats')
  const [windowWidth, setWindowWidth] = useState(() => {
    // Safely handle window access for SSR
    return typeof window !== 'undefined' ? window.innerWidth : 1200
  })
  
  // Handle window resize events
  useEffect(() => {
    const handleResize = () => {
      setWindowWidth(window.innerWidth)
    }
    
    // Add event listener
    window.addEventListener('resize', handleResize)
    
    // Clean up on unmount
    return () => {
      window.removeEventListener('resize', handleResize)
    }
  }, [])
  
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

  const togglePlayerStats = (playerId) => {
    setSelectedPlayerId((prev) => (prev === playerId ? null : playerId));
  };

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

  // const duration = game.duration_seconds
  //   ? `${Math.floor(game.duration_seconds / 3600)}h ${Math.floor((game.duration_seconds % 3600) / 60)}m ${game.duration_seconds % 60}s`
  //   : "N/A";

  return (
    <PageTransition 
      isLoading={loading} 
      loadingTitle="Loading Game Details" 
      loadingSubtitle="Gathering round data and player statistics"
    >
      <div className="game-details-container">
        <div className="game-details-header">
          <div className="game-header-top">
            <Link to="/" className="back-link">
              <ArrowLeftIcon className="back-icon" />
            </Link>
            <div className="toggle-section">
                <button
                  className="game-control-btn"
                  id="game-toggle-details"
                  onClick={() => setActiveTab(activeTab === 'rounds' ? 'stats' : 'rounds')}
                  aria-label={`Switch to ${activeTab === 'rounds' ? 'statistics' : 'rounds'} view`}
                  aria-pressed={activeTab === 'stats'}
                >
                  {activeTab === 'rounds' ? <BarChartIcon size={22} /> : <GamepadIcon size={22} />}
                </button>
            </div>
          </div>
          <h1 id="header-game-detail-badge">Game Details {game.is_local && <span className="mode-badge local" id="game-detail-badge">Local</span>}</h1>
          <div className="game-date">Finished: {formattedDate}</div>
          {/* <div className="game-date">Duration: {duration}</div> */}
          <div className="game-winner">
            Winner: {playerDetails[game.winner_id]?.name || 'Unknown'}
          </div>
        </div>

        <div className="game-summary">
          {activeTab === 'rounds' && (
            <div className="rounds-section">
              <div className={`wizard-scorecard ${sortedPlayers.length > 3 ? 'many-players' : ''}`} data-player-count={sortedPlayers.length}>
                <table className="scorecard-table">
                  <thead>
                    <tr>
                      <th className="round-header sticky-cell">Round</th>
                      {sortedPlayers.map(player => (
                        <th key={player.id} className="player-header">
                          <div className="player-header-name">{player.name}</div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {game.round_data && game.round_data.map((round, index) => (
                      <tr key={index} className="round-row">
                        <td className="round-number sticky-cell">{index + 1}</td>
                        {sortedPlayers.map(player => {
                          const playerRound = round.players.find(p => p.id === player.id);
                          
                          // Determine bid status for color-coding
                          let bidStatusClass = '';
                          if (playerRound) {
                            if (playerRound.call === playerRound.made) {
                              bidStatusClass = 'correct-bid';
                            } else if (playerRound.made > playerRound.call) {
                              bidStatusClass = 'over-bid';
                            } else {
                              bidStatusClass = 'under-bid';
                            }
                          }
                          
                          return (
                            <td key={player.id} className="player-round-cell">
                              {playerRound && (
                                <div className="player-round-data">
                                <div className="round-score">{playerRound.score}</div>
                                <div className="round-bid">{playerRound.call}</div>
                                <div className={`round-made ${bidStatusClass}`}>{playerRound.made}</div>
                              </div>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                    <tr className="total-row">
                      <td className="total-label sticky-cell">Total</td>
                      {sortedPlayers.map(player => (
                        <td key={player.id} className="total-score">
                          {player.score}
                        </td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {(windowWidth > 768 || activeTab === 'stats') && (
            <div className="results-section">
              <h2>Final Results</h2>
              <div className="results-table">
                {sortedPlayers.map((player, index) => (
                  <div key={player.id} className="results-row">
                    <div className="rank-col">{index + 1}</div>
                    <div className="player-col">
                      {game.is_local ? (
                        <div className="player-info">
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
                    {selectedPlayerId === player.id && (() => {
                      // Find player stats once and store in variable for efficient access
                      const playerStat = playerStats.find((stat) => stat.id === player.id);
                      
                      return (
                        <div className="advanced-stats">                      
                          <div className="stats-section">
                            <div className="stats-section-title">Game Performance</div>
                            <div className="stats-cards" id="game-performance">
                              <p>Total Points: <span>{playerStat?.totalPoints}</span></p>
                              <p>Highest Round: <span>{playerStat?.highestScore}</span></p>
                              <p>Correct Bids: <span>{playerStat?.correctBids}</span></p>
                              <p>Tricks Won: <span>{playerStat?.totalTricks}</span></p>
                            </div>
                          </div>

                          <div className="stats-section">
                            <div className="stats-section-title">Bidding Precision</div>
                            <div className="stats-cards">
                              <PerformanceMetric 
                                label="Average Score" 
                                value={playerStat?.avgPoints} 
                                target={30} 
                                isAboveTarget={false}
                              />
                              <PerformanceMetric 
                                label="Bid Accuracy" 
                                value={playerStat?.bidAccuracy + "%"} 
                                target={80} 
                                isAboveTarget={false}
                              />
                            </div>
                          </div>

                          <div className="stats-section">
                            <div className="stats-section-title">Bidding Style</div>
                            <div className="stats-cards">
                              <PerformanceMetric 
                                label="Overbid Ratio" 
                                value={playerStat?.overbids} 
                                target={5} 
                                isAboveTarget={true}
                              />
                              <PerformanceMetric 
                                label="Underbid Ratio" 
                                value={playerStat?.underbids} 
                                target={5} 
                                isAboveTarget={true}
                              />
                              <PerformanceMetric 
                                label="Average Deviation" 
                                value={playerStat?.avgDiff} 
                                target={0.8} 
                                isAboveTarget={true}
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </PageTransition>
  );
}

export default GameDetails
