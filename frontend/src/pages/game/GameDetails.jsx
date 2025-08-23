"use client"

import { useState, useEffect } from "react"
import { useParams, Link } from "react-router-dom"

// Services
import { getGameById } from "@/shared/api/gameService"
import { getPlayerById } from "@/shared/api/playerService"
import { LocalGameStorage } from '@/shared/api';
// Utilities
import { ShareValidator } from '@/shared/utils/shareValidator';
import { shareGame as shareGameUtil } from '@/shared/utils/gameSharing';
import { ensureGameSynced } from '@/shared/utils/ensureGameSynced';
// Components
import PageTransition from "@/components/common/PageTransition"
import PerformanceMetric from "@/components/common/PerformanceMetric"
import StatsChart from "@/components/game/StatsChart"
import { AdvancedStats } from "@/components/game"
// Assets
import defaultAvatar from "@/assets/default-avatar.png"
// Styles
import "@/styles/utils/performanceMetrics.css"
import "@/styles/components/scorecard.css"
import "@/styles/components/statsChart.css"
import "@/styles/components/chartToggle.css"
import "@/styles/pages/settings.css"
import "@/styles/pages/gameDetails.css"
import "@/styles/utils/pageTransition.css"
// Icon imports
import { ArrowLeftIcon, BarChartIcon, GamepadIcon, ChartLineIcon, ShareIcon, DownloadIcon, TableIcon } from "@/components/ui/Icon"

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
  const [message, setMessage] = useState({ text: '', type: '' })
  const [isLandscape, setIsLandscape] = useState(() => {
    if (typeof window !== 'undefined' && window.screen && window.screen.orientation) {
      return window.screen.orientation.type.startsWith('landscape');
    }
    // Fallback: compare width and height
    return typeof window !== 'undefined'
      ? window.innerWidth > window.innerHeight
      : true;
  });

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

  const clearMessage = () => {
    setTimeout(() => {
      setMessage({ text: '', type: '' });
    }, 3000);
  };

  useEffect(() => {
    if (message.text) {
      clearMessage();
    }
  }, [message]);

  if (error || !game) {
    return <div className="error">{error || "Game not found"}</div>
  }

  // Sort players by score (highest first) and calculate ranks with tie handling
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
    .map((player, index, array) => {
      // Calculate rank with proper tie handling
      let rank = 1;
      
      // Count how many players have a higher score
      for (let i = 0; i < index; i++) {
        if (array[i].score > player.score) {
          rank++;
        }
      }
      
      return { ...player, rank };
    });

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
    console.debug("Chart data prepared:", { playersData, roundData });
    
    return { playersData, roundData };
  };


  // Use the shared shareGame utility for sharing
  const handleShareGame = async () => {
    if (!game) return;
    // Ensure the game is synced before sharing
    const synced = await ensureGameSynced(game.id || game.gameId, game, setMessage);
    if (!synced) return;
    const result = await shareGameUtil(game);
    if (result.success) {
      setMessage({ text: result.method === 'native' ? 'Game shared successfully!' : 'Share link copied to clipboard!', type: 'success' });
    } else {
      setMessage({ text: 'Failed to share game. Please try again.', type: 'error' });
    }
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
        {/* {message.text && (
          <div className={`settings-message ${message.type}`}>
            {message.text}
          </div>
        )} */}
        
        <div className="game-details-header">
          <div className="game-header-top">
            <Link to="/" className="back-link">
              <ArrowLeftIcon className="back-icon" />
            </Link>
            <h1 id="header-game-detail-badge">Game Details </h1>
            <div className="toggle-section">
              {!isLandscape  && (
                <button
                  className="game-control-btn"
                  id="game-toggle-details"
                  onClick={() => setActiveTab(activeTab === 'rounds' ? 'stats' : 'rounds')}
                  aria-label={`Switch to ${activeTab === 'rounds' ? 'statistics' : 'rounds'} view`}
                  aria-pressed={activeTab === 'stats'}
                >
                  {activeTab === 'rounds' ? <BarChartIcon size={22} /> : <TableIcon size={22} />}
                </button>
              )}
            </div>
          </div>
          <div className="game-date" style={{ margin: "0 auto" }}>Finished: {formattedDate}</div>
          
          {/* Container for mode badge and share button */}
          <div className="badge-controls-container">
            {game.is_local && <span className="mode-badge local" id="game-detail-badge">Local</span>}
            <button className="settings-button share-button" onClick={handleShareGame}>
              <ShareIcon size={20} />
              Share
            </button>
          </div>
          
          {/* <div className="game-date">Duration: {duration}</div> */}
        </div>

        <div className="game-summary">
          {(isLandscape || windowWidth > 768 || activeTab === 'stats') && (
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
                  {sortedPlayers.map((player) => (
                    <div key={player.id} className="results-row">
                      <div className="top-result-row">
                        <div className={`rank-col ${player.rank === 1 ? 'gold' : player.rank === 2 ? 'silver' : player.rank === 3 ? 'bronze' : ''}`}>
                          {player.rank}
                        </div>
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
                      </div>
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
                        <AdvancedStats 
                          playerStats={playerStat} 
                          isVisible={true} 
                        />
                      );
                    })()}
                  </div>
                ))}
              </div>
              )}
            </div>
          )}

          {(isLandscape || activeTab === 'rounds') && (
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
        </div>
      </div>
    </PageTransition>
  );
}

export default GameDetails
