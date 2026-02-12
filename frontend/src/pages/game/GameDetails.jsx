"use client"

import { useState, useEffect } from "react"
import { useParams, useNavigate, Link } from "react-router-dom"
import { useTranslation } from 'react-i18next'

// Services
import { getGameById } from "@/shared/api/gameService"
import { getPlayerById } from "@/shared/api/playerService"
// Utilities
import { shareGame as shareGameUtil } from '@/shared/utils/gameSharing';
import { ensureGameSynced } from '@/shared/utils/ensureGameSynced';
// Components
import StatsChart from "@/components/game/StatsChart"
import { AdvancedStats } from "@/components/game"
// Styles
import "@/styles/utils/performanceMetrics.css"
import "@/styles/components/scorecard.css"
import "@/styles/components/statsChart.css"
import "@/styles/components/chartToggle.css"
import "@/styles/components/TableGame.css"
import "@/styles/pages/account.css"
import "@/styles/pages/gameDetails.css"
// Icon imports
import { ArrowLeftIcon, ShareIcon } from "@/components/ui/Icon"

// Skeleton Loading Component
const GameDetailsSkeleton = () => (
  <div className="game-details-container">
    <div className="game-details-header">
      <button className="back-link" disabled>
        <ArrowLeftIcon className="back-icon" />
      </button>
      
      <div className="game-title-section">
        <div className="skeleton skeleton-text" style={{ width: '90px', height: '24px' }}></div>
        <div className="skeleton skeleton-text" style={{ width: '120px', height: '20px', marginTop: '4px' }}></div>
      </div>
      
      <div className="badge-controls-container">
        <div className="skeleton skeleton-text" style={{ width: '70px', height: '16px', borderRadius: 'var(--radius-sm)' }}></div>
      </div>
    </div>

    {/* Skeleton Tabs */}
    <div className="account-tabs">
      <div className="skeleton skeleton-text" style={{ width: '33%', height: '34px', borderRadius: 'var(--radius-md)' }}></div>
      <div className="skeleton skeleton-text" style={{ width: '33%', height: '34px', borderRadius: 'var(--radius-md)' }}></div>
      <div className="skeleton skeleton-text" style={{ width: '33%', height: '34px', borderRadius: 'var(--radius-md)' }}></div>
    </div>

    <div className="game-summary">
      <div className="results-section">
        <div className="skeleton skeleton-text" style={{ width: '120px', height: '24px', marginBottom: '12px' }}></div>
        <div className="results-table">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={`skeleton-row-${index}`} className="results-row skeleton-row">
              <div className="top-result-row">
                <div className="rank-col">
                  <div className="skeleton skeleton-rank"></div>
                </div>
                <div className="player-col">
                  <div className="skeleton skeleton-name" style={{ width: `${60 + Math.random() * 30}%` }}></div>
                </div>
                <div className="score-col">
                  <div className="skeleton skeleton-stat"></div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  </div>
)

const GameDetails = () => {
  // Helper function to compare IDs regardless of type (string vs number)
  const compareIds = (id1, id2) => String(id1) === String(id2);
  
  const { id } = useParams()
  const navigate = useNavigate()
  const { t } = useTranslation()
  const [game, setGame] = useState(null)
  const [playerDetails, setPlayerDetails] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [selectedPlayerId, setSelectedPlayerId] = useState(null)
  const [activeTab, setActiveTab] = useState('stats')
  const [message, setMessage] = useState({ text: '', type: '' })
  const [isLandscape] = useState(() => {
    if (typeof window !== 'undefined' && globalThis.screen && globalThis.screen.orientation) {
      return globalThis.screen.orientation.type.startsWith('landscape');
    }
    // Fallback: compare width and height
    return typeof window !== 'undefined'
      ? globalThis.innerWidth > globalThis.innerHeight
      : true;
  });

  // DEBUG: Keep skeleton visible for styling - REMOVE THIS LATER
  // if (true) {
  //   return <GameDetailsSkeleton />
  // }

  const [windowWidth, setWindowWidth] = useState(() => {
    // Safely handle window access for SSR
    return typeof window !== 'undefined' ? globalThis.innerWidth : 1200
  })
  
  // Handle window resize events
  useEffect(() => {
    const handleResize = () => {
      setWindowWidth(globalThis.innerWidth)
    }
    
    // Add event listener
    globalThis.addEventListener('resize', handleResize)
    
    // Clean up on unmount
    return () => {
      globalThis.removeEventListener('resize', handleResize)
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

        // For local games or cloud games, player data is already included in the game object
        if (gameData.is_local || gameData.is_cloud) {
          // Try multiple sources for player data in local/cloud games
          let playersSource = gameData.players || 
                             gameData.gameState?.players || 
                             [];
          
          // If we don't have players from the main sources, try to extract from round data
          if (playersSource.length === 0 && gameData.round_data && gameData.round_data.length > 0) {
            const firstRound = gameData.round_data[0];
            if (firstRound.players) {
              playersSource = firstRound.players.map(p => ({ id: p.id, name: p.name }));
            }
          }
          
          // If still no players, try gameState.roundData
          if (playersSource.length === 0 && gameData.gameState?.roundData && gameData.gameState.roundData.length > 0) {
            const firstRound = gameData.gameState.roundData[0];
            if (firstRound.players) {
              playersSource = firstRound.players.map(p => ({ id: p.id, name: p.name }));
            }
          }
          
          playersSource.forEach((player) => {
            if (player && player.id) {
              playerMap[player.id] = player
            }
          })
        } 
        // For server games (legacy), fetch player details from the API
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
        setError(t('gameDetails.loadGameFailed', { error: err.message }))
        setLoading(false)
      }
    }

    fetchGameData()
  }, [id, t])

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

  // Show loading state while fetching game data
  if (loading) {
    return <GameDetailsSkeleton />
  }

  if (error || !game) {
    return <div className="error">{error || t('gameDetails.gameNotFound')}</div>
  }

  // Sort players by score (highest first) and calculate ranks with tie handling
  // Use final_scores from gameState if available, otherwise use the root level
  const finalScores = game.gameState?.final_scores || game.final_scores || {};
  
  const sortedPlayers = Object.entries(finalScores)
    .map(([playerId, score], playerIndex) => {
      const normalizedId = String(playerId);
      
      // For v3.0 format, get player from game.players array
      let playerData = null;
      if (game.players && Array.isArray(game.players)) {
        playerData = game.players.find(p => String(p.id) === normalizedId);
      }
      
      // For legacy format, get from gameState.players
      if (!playerData && game.gameState?.players && Array.isArray(game.gameState.players)) {
        playerData = game.gameState.players.find(p => String(p.id) === normalizedId);
      }
      
      // Fallback: try to get from round_data
      if (!playerData && game.round_data?.[0]?.players) {
        playerData = game.round_data[0].players.find(p => String(p.id) === normalizedId);
      }
      
      // If still not found, check playerDetails map
      if (!playerData) {
        playerData = playerDetails[normalizedId] || playerDetails[playerId];
      }
      
      return {
        id: normalizedId,
        score,
        name: playerData?.name || `${t('common.player')} ${playerIndex + 1}`,
        identityId: playerData?.identityId, // Include identity for proper user linking
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
        // Check both direct ID match and originalId match
        return round.players.find((p) => {
          // Direct match
          if (compareIds(p.id, playerId)) return true;
          // Check if p.id is an originalId that maps to this playerId
          const playerInGame = game.players?.find(gp => gp.originalId === p.id);
          return playerInGame && compareIds(playerInGame.id, playerId);
        });
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

      // Keep playerId as-is (string format from final_scores keys)
      return {
        id: playerId,
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
      
      // Get player data from v3.0 format (game.players) or legacy format
      let playerData = null;
      if (game.players && Array.isArray(game.players)) {
        playerData = game.players.find(p => String(p.id) === stringId);
      }
      if (!playerData && game.gameState?.players && Array.isArray(game.gameState.players)) {
        playerData = game.gameState.players.find(p => String(p.id) === stringId);
      }
      if (!playerData) {
        playerData = playerDetails[stringId] || playerDetails[playerStat.id];
      }
      
      // Ensure we have a valid player name
      const playerName = playerData?.name || `${t('common.player')} ${Object.keys(game.final_scores || game.gameState?.final_scores || {}).indexOf(stringId) + 1}`;
      
      return {
        id: stringId, // Use string ID consistently for StatsChart
        name: playerName,
        correctBids: playerStat.correctBids || 0,
        overBids: playerStat.overbids || 0,
        underBids: playerStat.underbids || 0,
        roundsPlayed: game.round_data.length || 0
      };
    }).filter(p => p.name && p.id); // Filter out any invalid entries
    
    // Prepare round data with accumulated scores
    const roundData = game.round_data.map((round, roundIndex) => {
      // Calculate accumulated scores for each player up to this round
      const players = round.players.map(player => {
        // Map originalId to actual player id if needed
        let actualPlayerId = player.id;
        const playerInGameData = game.players?.find(p => p.originalId === player.id || String(p.id) === String(player.id));
        if (playerInGameData) {
          actualPlayerId = playerInGameData.id;
        }
        
        // Use string ID consistently
        const stringPlayerId = String(actualPlayerId);
        
        // Find all rounds for this player up to the current round
        const playerRounds = game.round_data
          .slice(0, roundIndex + 1)
          .map(r => {
            // Find player by id or originalId
            const foundPlayer = r.players.find(p => {
              const playerWithOriginalId = game.players?.find(gp => gp.originalId === p.id || String(gp.id) === String(p.id));
              const mappedId = playerWithOriginalId ? String(playerWithOriginalId.id) : String(p.id);
              return mappedId === stringPlayerId;
            });
            return foundPlayer;
          })
          .filter(Boolean);
          
        // Calculate total score up to this round
        const totalScore = playerRounds.reduce((sum, r) => sum + (r.score || 0), 0);
        
        return {
          id: stringPlayerId,  // Use string ID consistently
          name: playerInGameData?.name || player.name,
          totalScore,
          score: player.score  // Include round score for other chart types
        };
      });
      
      return { ...round, players };
    });
    
    // Log data for debugging (will be removed in production)
    // console.debug("Chart data prepared:", { playersData, roundData });
    
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
      setMessage({ text: result.method === 'native' ? t('gameDetails.gameSharedSuccess') : t('gameDetails.shareLinkCopied'), type: 'success' });
    } else {
      setMessage({ text: t('gameDetails.shareFailed'), type: 'error' });
    }
  };

  // const duration = game.duration_seconds
  //   ? `${Math.floor(game.duration_seconds / 3600)}h ${Math.floor((game.duration_seconds % 3600) / 60)}m ${game.duration_seconds % 60}s`
  //   : "N/A";

  return (
    
      <div className="game-details-container">
        {/* {message.text && (
          <div className={`settings-message ${message.type}`}>
            {message.text}
          </div>
        )} */}
        
        <div className="game-details-header">
          <button 
            onClick={() => navigate(-1)} 
            className="back-link"
            aria-label={t('common.goBack')}
          >
            <ArrowLeftIcon className="back-icon" />
          </button>
          
          <div className="game-title-section">
            <div className="game-name">{t('gameDetails.gameName')}</div>
            <div className="game-date">{formattedDate}</div>
          </div>
          
          {/* Container for mode badge and share button */}
          <div className="badge-controls-container">
            {/* {game.is_local && <span className="mode-badge local" id="game-detail-badge">Local</span>} */}
            <button className="settings-button share-button" onClick={handleShareGame}>
              <ShareIcon size={16} />
              {t('gameDetails.share')}
            </button>
          </div>
        </div>

        {/* Tabs - only show on mobile/portrait */}
        {!isLandscape && windowWidth <= 768 && (
          <div className="account-tabs">
            <button 
              className={`account-tab ${activeTab === 'stats' ? 'active' : ''}`}
              onClick={() => setActiveTab('stats')}
            >
              {t('gameDetails.standingsTab')}
            </button>
            <button 
              className={`account-tab ${activeTab === 'chart' ? 'active' : ''}`}
              onClick={() => setActiveTab('chart')}
            >
              {t('gameDetails.chartTab')}
            </button>
            <button 
              className={`account-tab ${activeTab === 'rounds' ? 'active' : ''}`}
              onClick={() => setActiveTab('rounds')}
            >
              {t('gameDetails.roundsTab')}
            </button>
          </div>
        )}

        <div className="game-summary">
          {(isLandscape || windowWidth > 768 || activeTab === 'stats') && (
            <div className="results-section">
              <div className="results-header">
                <h2>{t('gameDetails.finalResults')}</h2>
              </div>

              <div className="results-table">
                  {sortedPlayers.map((player) => (
                    <div key={player.id} className="results-row">
                      <div className="top-result-row">
                        <div className={`rank-col ${player.rank === 1 ? 'gold' : player.rank === 2 ? 'silver' : player.rank === 3 ? 'bronze' : ''}`}>
                          {player.rank}
                        </div>
                        <div className="player-col">
                          <div className="player-info">
                            {player.name ? (
                              <Link to={`/user/${player.name}`} className="player-link">
                                {player.name}
                              </Link>
                            ) : (
                              <span>{player.name}</span>
                            )}
                          </div>
                        </div>
                        <div className="score-col">{player.score}</div>
                        <button className="adv-stats-btn" onClick={() => togglePlayerStats(player.id)}>
                          {t('gameDetails.advStats')}
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
                              <p>{t('gameDetails.statsError')}</p>
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
            </div>
          )}

          {/* Chart Tab */}
          {(isLandscape || activeTab === 'chart') && (
            <div className="chart-section">
              <div className="chart-view-container">
                {game.round_data && game.round_data.length > 0 ? (
                  (() => {
                    const chartData = prepareChartData();
                    if (!chartData.playersData || chartData.playersData.length === 0) {
                      return <div className="no-chart-data">{t('gameDetails.noChartDataPlayers')}</div>;
                    }
                    if (!chartData.roundData || chartData.roundData.length === 0) {
                      return <div className="no-chart-data">{t('gameDetails.noChartDataRounds')}</div>;
                    }
                    return <StatsChart playersData={chartData.playersData} roundData={chartData.roundData} />;
                  })()
                ) : (
                  <div className="no-chart-data">{t('gameDetails.noRoundData')}</div>
                )}
              </div>
            </div>
          )}

          {(isLandscape || activeTab === 'rounds') && (
            <div className="rounds-section">
              <div className={`wizard-scorecard ${sortedPlayers.length > 3 ? 'many-players' : ''}`} data-player-count={sortedPlayers.length}>
                <table className="scorecard-table">
                  <thead>
                    <tr>
                      <th className="round-header sticky-cell"/>
                      {sortedPlayers.map(player => {
                        return (
                          <th key={player.id} className="player-header">
                            <div className="player-header-name">
                              {player.name ? (
                                <Link to={`/user/${player.name}`} className="player-link">
                                  {player.name}
                                </Link>
                              ) : (
                                player.name
                              )}
                            </div>
                          </th>
                        );
                      })}
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
                      <td className="total-label sticky-cell">{t('common.total')}</td>
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
  );
}

export default GameDetails
