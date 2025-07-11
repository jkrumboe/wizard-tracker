"use client"

import { useState, useEffect } from "react"
import { useParams, Link } from "react-router-dom"
import { getGameById } from "../services/gameService"
import { getPlayerById } from "../services/playerService"
import { ArrowLeftIcon, BarChartIcon, GamepadIcon, ChartLineIcon } from "../components/Icon"
import PerformanceMetric from "../components/PerformanceMetric"
import StatsChart from "../components/StatsChart"
import defaultAvatar from "../assets/default-avatar.png" 
import "../styles/performanceMetrics.css"
import "../styles/scorecard.css"
import "../styles/statsChart.css"
import "../styles/chartToggle.css"
import PageTransition from "../components/PageTransition"
import "../styles/pageTransition.css"

const GameDetails = () => {
  // Helper function to compare IDs regardless of type (string vs number)
  const compareIds = (id1, id2) => String(id1) === String(id2);
  
  const { id } = useParams()
  const [game, setGame] = useState(null)
  const [playerDetails, setPlayerDetails] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [selectedPlayerId, setSelectedPlayerId] = useState(null)
  const [activeTab, setActiveTab] = useState('stats')
  const [showChart, setShowChart] = useState(false)
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
    setSelectedPlayerId((prev) => {
      const newValue = compareIds(prev, playerId) ? null : playerId;
      return newValue;
    });
  };

  if (error || !game) {
    return <div className="error">{error || "Game not found"}</div>
  }

  // Sort players by score (highest first)
  const sortedPlayers = Object.entries(game.final_scores || {})
    .map(([playerId, score]) => {
      // Handle player IDs consistently - keep as string if it has scientific notation (e)
      const normalizedId = playerId.includes("e") ? playerId : Number.parseInt(playerId);
      
      return {
        id: normalizedId,
        score,
        ...playerDetails[playerId],
      };
    })
    .sort((a, b) => b.score - a.score)

  // Add detailed statistics for each player
  function calculatePlayerStats(game) {
    if (!game.round_data || !Array.isArray(game.round_data)) {
      return [];
    }

    // Build stats for each player based on round_data
    const stats = Object.entries(game.final_scores || {}).map(([playerId]) => {
      // Collect all rounds for this player
      const playerRounds = (game.round_data || []).map((round) => {
        if (!round || !round.players) return null;
        return round.players.find((p) => compareIds(p.id, playerId));
      }).filter(Boolean);

      const totalRounds = playerRounds.length;
      const totalPoints = playerRounds.reduce((sum, round) => sum + (round.score ?? 0), 0);
      const highestScore = Math.max(...playerRounds.map((round) => round.score ?? 0));
      const lowestScore = Math.min(...playerRounds.map((round) => round.score ?? 0));
      const totalBids = playerRounds.reduce((sum, round) => sum + (round.call ?? 0), 0);
      const totalTricks = playerRounds.reduce((sum, round) => sum + (round.made ?? 0), 0);
      const correctBids = playerRounds.filter((round) => round.call === round.made).length;
      const overbids = playerRounds.filter((round) => round.made > round.call).length;
      const underbids = playerRounds.filter((round) => round.made < round.call).length;
      const avgPoints = totalRounds ? (totalPoints / totalRounds) : 0;
      const avgBid = totalRounds ? (totalBids / totalRounds) : 0;
      const avgTricks = totalRounds ? (totalTricks / totalRounds) : 0;
      const avgDiff = totalRounds
      ? (
        playerRounds.reduce(
          (sum, round) => sum + Math.abs((round.made ?? 0) - (round.call ?? 0)),
          0
        ) / totalRounds
        )
      : 0;
      const bidAccuracy = totalRounds ? ((correctBids / totalRounds) * 100) : 0;

      // Ensure we're using the same ID format as in sortedPlayers
      const normalizedId = typeof playerId === "string" ? 
        (playerId.includes("e") ? playerId : Number(playerId)) : 
        playerId;
      
      return {
        id: normalizedId,
        totalBids,
        totalTricks,
        correctBids,
        bidAccuracy: bidAccuracy.toFixed(2),
        overbids,
        underbids,
        avgDiff: avgDiff.toFixed(2),
        totalPoints,
        avgPoints: avgPoints.toFixed(2),
        avgBid: avgBid.toFixed(2),
        avgTricks: avgTricks.toFixed(2),
        highestScore,
        lowestScore,
      };
    });

    return stats;
  }
  const playerStats = calculatePlayerStats(game);

  const formattedDate = new Date(game.created_at).toLocaleDateString("en-DE", {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });

  // Prepare data for StatsChart component
  const prepareChartData = () => {
    if (!game || !game.round_data) {
      return { playersData: [], roundData: [] };
    }
    
    // Prepare player data with consistent ID format
    const playersData = playerStats.map(playerStat => {
      // Ensure we're using the string version of ID for consistent lookup
      const stringId = String(playerStat.id);
      
      return {
        id: playerStat.id, // Keep the original ID format for StatsChart
        name: playerDetails[stringId]?.name || 'Unknown',
        correctBids: playerStat.correctBids || 0,
        overBids: playerStat.overbids || 0,
        underBids: playerStat.underbids || 0,
        roundsPlayed: game.round_data.length || 0
      };
    });
    
    // Prepare round data with accumulated scores
    const roundData = game.round_data.map((round, roundIndex) => {
      // Calculate accumulated scores for each player up to this round
      const players = round.players.map(player => {
        // Find all rounds for this player up to the current round
        const playerRounds = game.round_data
          .slice(0, roundIndex + 1)
          .map(r => r.players.find(p => compareIds(p.id, player.id)))
          .filter(Boolean);
          
        // Calculate total score up to this round
        const totalScore = playerRounds.reduce((sum, r) => sum + (r.score || 0), 0);
        
        return {
          ...player,
          totalScore
        };
      });
      
      return { ...round, players };
    });
    
    // Log data for debugging (will be removed in production)
    console.log("Chart data prepared:", { playersData, roundData });
    
    return { playersData, roundData };
  };

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
            <h1 id="header-game-detail-badge">Game Details </h1>
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
          <h1 id="header-game-detail-badge">{game.is_local && <span className="mode-badge local" id="game-detail-badge">Local</span>}</h1>
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
                          const playerRound = round.players.find(p => compareIds(p.id, player.id));
                          
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
              <div className="results-header">
                <h2>Final Results</h2>
                <button 
                  className={`chart-toggle-btn ${showChart ? 'active' : ''}`} 
                  onClick={() => setShowChart(!showChart)}
                  aria-label={showChart ? "Show table view" : "Show chart view"}
                >
                  {showChart ? "Table View" : "Chart View"}
                  {showChart ? <GamepadIcon size={18} /> : <ChartLineIcon size={18} />}
                </button>
              </div>

              {showChart ? (
                <div className="chart-view-container">
                  {game.round_data && game.round_data.length > 0 ? (
                    (() => {
                      const chartData = prepareChartData();
                      if (!chartData.playersData || chartData.playersData.length === 0) {
                        return <div className="no-chart-data">Error: Missing player data for chart visualization</div>;
                      }
                      if (!chartData.roundData || chartData.roundData.length === 0) {
                        return <div className="no-chart-data">Error: Missing round data for chart visualization</div>;
                      }
                      return <StatsChart playersData={chartData.playersData} roundData={chartData.roundData} />;
                    })()
                  ) : (
                    <div className="no-chart-data">No round data available for chart visualization</div>
                  )}
                </div>
              ) : (
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
                    {compareIds(selectedPlayerId, player.id) && (() => {
                      // Find player stats once and store in variable for efficient access
                      // Convert IDs to strings for comparison to handle type mismatches
                      const playerStat = playerStats.find((stats) => compareIds(stats.id, player.id));
                      
                      // If player stats are not found, show an error message
                      if (!playerStat) {
                        console.error(`Could not find stats for player ID: ${player.id}`);
                        return (
                          <div className="advanced-stats">
                            <div className="stats-section">
                              <div className="stats-section-title">Error</div>
                              <p>Could not load player statistics. Please try again.</p>
                            </div>
                          </div>
                        );
                      }
                      
                      return (
                        <div className="advanced-stats">                      
                          <div className="stats-section">
                            <div className="stats-section-title">Game Performance</div>
                            <div className="stats-cards" id="game-performance">
                              <p>Total Points: <span>{Math.round(playerStat?.totalPoints)}</span></p>
                              <p>Highest Round: <span>{Math.round(playerStat?.highestScore)}</span></p>
                              <p>Correct Bids: <span>{Math.round(playerStat?.correctBids)}</span></p>
                              <p>Tricks Won: <span>{Math.round(playerStat?.totalTricks)}</span></p>
                            </div>
                          </div>

                          <div className="stats-section">
                            <div className="stats-section-title">Bidding Precision</div>
                            <div className="stats-cards">
                              <PerformanceMetric 
                                label="Average Score" 
                                value={Math.round(parseFloat(playerStat?.avgPoints || 0))} 
                                targetMin={20} 
                                targetMax={30}
                                isBadWhenAboveMax={false}
                              />
                              <PerformanceMetric 
                                label="Bid Accuracy" 
                                value={Math.round(parseFloat(playerStat?.bidAccuracy || 0))} 
                                targetMin={50} 
                                targetMax={80}
                                isPercentage={true}
                                isBadWhenAboveMax={false} 
                              />
                            </div>
                          </div>

                          <div className="stats-section">
                            <div className="stats-section-title">Bidding Tendency</div>
                            <div className="stats-cards">
                              <div className="bidding-style-card">
                                <div className="bidding-style-value">
                                  {(() => {
                                    const overbids = playerStat?.overbids || 0;
                                    const underbids = playerStat?.underbids || 0;
                                    const correctBids = playerStat?.correctBids || 0;
                                    const totalBids = overbids + underbids + correctBids;
                                    
                                    if (totalBids === 0) return <span className="no-data">No Data</span>;
                                    
                                    // Calculate percentages
                                    const correctBidPercent = totalBids > 0 ? (correctBids / totalBids) * 100 : 0;
                                    const overBidPercent = totalBids > 0 ? (overbids / totalBids) * 100 : 0;
                                    const underBidPercent = totalBids > 0 ? (underbids / totalBids) * 100 : 0;
                                    
                                    // Determine bidding quality based on correct bid percentage
                                    let biddingQuality = '';
                                    let biddingClass = '';
                                    
                                    if (correctBidPercent > 75) {
                                      biddingQuality = 'Bidding Excellent';
                                      biddingClass = 'excellent-bidding';
                                    } else if (correctBidPercent >= 60) {
                                      biddingQuality = 'Bidding Good';
                                      biddingClass = 'good-bidding';
                                    } else if (correctBidPercent >= 45) {
                                      biddingQuality = 'Bidding Okay';
                                      biddingClass = 'okay-bidding';
                                    } else if (correctBidPercent >= 30) {
                                      biddingQuality = 'Bidding Poorly';
                                      biddingClass = 'poor-bidding';
                                    } else {
                                      biddingQuality = 'Bidding Badly';
                                      biddingClass = 'bad-bidding';
                                    }
                                    
                                    // Add bidding tendency descriptor
                                    let biddingTendency = '';
                                    if (overBidPercent > 25 && overBidPercent > underBidPercent) {
                                      biddingTendency = ' (Tends to Overbid)';
                                    } else if (underBidPercent > 25 && underBidPercent > overBidPercent) {
                                      biddingTendency = ' (Tends to Underbid)';
                                    } else if (overBidPercent === underBidPercent && overBidPercent > 15) {
                                      biddingTendency = ' (Mixed Errors)';
                                    }
                                    
                                    return (
                                      <div>
                                        <span className={biddingClass}>
                                          {biddingQuality}
                                        </span>
                                        {biddingTendency && (
                                          <span className="bidding-tendency">{biddingTendency}</span>
                                        )}
                                      </div>
                                    );
                                  })()}
                                </div>
                                
                                {/* Visual mini-progress bar for correct bids percentage */}
                                {(() => {
                                  const overbids = playerStat?.overbids || 0;
                                  const underbids = playerStat?.underbids || 0;
                                  const correctBids = playerStat?.correctBids || 0;
                                  const totalBids = overbids + underbids + correctBids;
                                  
                                  const correctBidPercent = totalBids > 0 ? Math.round((correctBids / totalBids) * 100) : 0;
                                  const overBidPercent = totalBids > 0 ? Math.round((overbids / totalBids) * 100) : 0;
                                  const underBidPercent = totalBids > 0 ? Math.round((underbids / totalBids) * 100) : 0;
                                  
                                  return (
                                    <div className="bid-distribution-bar">
                                      <div className="bid-segment correct-segment" style={{ width: `${correctBidPercent}%` }}></div>
                                      <div className="bid-segment over-segment" style={{ width: `${overBidPercent}%` }}></div>
                                      <div className="bid-segment under-segment" style={{ width: `${underBidPercent}%` }}></div>
                                    </div>
                                  );
                                })()}
                                
                                  <div className="bidding-stats">
                                    <span className="bid-stat correct">{Math.round(playerStat?.correctBids)} correct</span> •
                                    <span className="bid-stat over">{Math.round(playerStat?.overbids)} over</span> •
                                    <span className="bid-stat under">{Math.round(playerStat?.underbids)} under</span>
                                  </div>
                              </div>
                              <PerformanceMetric 
                                label="Average Deviation" 
                                value={Math.round(parseFloat(playerStat?.avgDiff || 0) * 100) / 100} 
                                targetMin={0}
                                targetMax={0.25}
                                isBadWhenAboveMax={true} 
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                ))}
              </div>
              )}
            </div>
          )}
        </div>
      </div>
    </PageTransition>
  );
}

export default GameDetails
