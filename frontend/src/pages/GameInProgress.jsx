"use client"

import React from "react";
import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { useGameStateContext } from "../hooks/useGameState"
import SaveGameDialog from "../components/SaveGameDialog"
import LoadGameDialog from "../components/LoadGameDialog"
import GameMenuModal from "../components/GameMenuModal"
import PauseConfirmationModal from "../components/PauseConfirmationModal"
import { SaveIcon, PauseIcon, MenuIcon, StatIcon, BarChartIcon, GamepadIcon } from "../components/Icon"
import PerformanceMetric from "../components/PerformanceMetric"
import "../styles/performanceMetrics.css"
import "../styles/stats.css"
import "../styles/gameInProgress.css"
import "../styles/statsChart.css"
import "../styles/scorecard.css"
import { ArrowLeftIcon, ArrowRight } from "lucide-react";
import StatsChart from "../components/StatsChart";

const GameInProgress = () => {
  const navigate = useNavigate()
  const { 
    gameState, 
    updateCall, 
    updateMade, 
    nextRound, 
    previousRound, 
    finishGame, 
    resetGame,
    saveGame,
    pauseGame,
    leaveGame,
    loadSavedGame,
    getSavedGames
  } = useGameStateContext()
  
  const [activeTab, setActiveTab] = useState('game')
  const [showSaveDialog, setShowSaveDialog] = useState(false)
  const [showLoadDialog, setShowLoadDialog] = useState(false)
  const [showGameMenuModal, setShowGameMenuModal] = useState(false)
  const [showPauseModal, setShowPauseModal] = useState(false)
  const [selectedPlayerId, setSelectedPlayerId] = useState(null)
  const [statsSubTab, setStatsSubTab] = useState('chart') // 'chart', 'details', or 'table'
  
  // Function to toggle player stats visibility
  const togglePlayerStats = (playerId) => {
    setSelectedPlayerId(prev => prev === playerId ? null : playerId)
  }

  // We don't need the click outside handler for a modal, removing this useEffect

  const handleFinishGame = async () => {
    const success = await finishGame()
    if (success) {
      resetGame(); 
      navigate("/")
    }
  }

  const handleSaveGame = async (gameName) => {
    try {
      const success = await saveGame(gameName)
      if (success) {
        setShowSaveDialog(false)
        // Show success message or toast
      }
      return success
    } catch (error) {
      console.error('Failed to save game:', error)
      return false
    }
  }

  // Function to show the pause confirmation modal
  const showPauseConfirmation = () => {
    setShowPauseModal(true);
    // Close any other open modals
    setShowGameMenuModal(false);
  }

  // Function to actually pause the game
  const handlePauseGame = async (gameName) => {
    try {
      // Explicitly set a default name if none is provided
      const gameNameToUse = gameName || `Paused Game - Round ${gameState.currentRound}/${gameState.maxRounds}`;
      const result = await pauseGame(gameNameToUse);
      
      if (result && result.success) {
        // Close all modals
        setShowSaveDialog(false);
        setShowPauseModal(false);
        
        // First reset the game state to prevent issues
        resetGame();
        // Then navigate home with a success message
        navigate("/", { state: { message: "Game paused successfully!" } });
      }
      return result;
    } catch (error) {
      console.error('Failed to pause game:', error);
      return { success: false, error: error.message };
    }
  }

  const handleLeaveGame = async () => {
    try {
      const success = await leaveGame()
      if (success) {
        setShowSaveDialog(false)
        resetGame()
        navigate("/", { state: { message: "Game left successfully!" } })
      }
      return success
    } catch (error) {
      console.error('Failed to leave game:', error)
      return false
    }
  }

  const handleLoadGame = async (gameId) => {
    try {
      const success = await loadSavedGame(gameId)
      if (success) {
        setShowLoadDialog(false)
        // Game state will be updated automatically
      }
      return success
    } catch (error) {
      console.error('Failed to load game:', error)
      return false
    }
  }

  // Auto-set made values to 0 if all tricks are allocated and player hasn't made any tricks
  useEffect(() => {
    if (!gameState.roundData || !gameState.roundData.length) return;
    
    const currentRound = gameState.roundData[gameState.currentRound - 1];
    if (!currentRound) return;
    
    // Use a small delay to avoid infinite loops
    const timer = setTimeout(() => {
      // Calculate total tricks already allocated by other players who have entered their made values
      const totalMadeByOthers = currentRound.players.reduce((sum, p) => {
        return p.made !== null ? sum + p.made : sum;
      }, 0);

      // If all tricks are allocated (total made equals round cards)
      if (totalMadeByOthers === currentRound.round) {
        // Set remaining players who haven't entered made values to 0
        currentRound.players.forEach(player => {
          if (player.made === null) {
            updateMade(player.id, 0);
          }
        });
      }
    }, 100); // Small delay to avoid render conflicts
    
    return () => clearTimeout(timer);
  }, [gameState.roundData, gameState.currentRound, updateMade]);

  if (!gameState.gameStarted) {
    return null
  }

  const currentRoundIndex = gameState.currentRound - 1
  const currentRound = gameState.roundData[currentRoundIndex]
  console.log("Current Round Data:", currentRound)
  const isLastRound = gameState.currentRound === gameState.maxRounds
  const isFirstRound = gameState.currentRound === 1

  // Check if all players have made their calls and tricks for the current round
  const isRoundComplete = currentRound?.players.every((player) => player.call !== null && player.made !== null)

  // Calculate comprehensive game statistics for all players
  const calculateDetailedGameStats = () => {
    const allRoundsData = gameState.roundData.slice(0, currentRoundIndex + 1);
    const currentPlayers = currentRound?.players || [];

    return currentPlayers.map((player) => {
      let correctBids = 0;
      let totalBids = 0;
      let totalTricks = 0;
      let perfectRounds = 0;
      let overBids = 0;
      let underBids = 0;

      let bestRound = 0;
      let worstRound = 0;
      let consecutiveCorrect = 0;
      let maxConsecutiveCorrect = 0;
      
      allRoundsData.forEach((round, roundIndex) => {
        const roundPlayer = round.players.find(p => p.id === player.id);
        if (roundPlayer && roundPlayer.call !== null && roundPlayer.made !== null) {
          totalBids += roundPlayer.call;
          totalTricks += roundPlayer.made;
          // Don't add totalScore here - we'll get it directly from the current player
          
          if (roundPlayer.call === roundPlayer.made) {
            correctBids++;
            consecutiveCorrect++;
            maxConsecutiveCorrect = Math.max(maxConsecutiveCorrect, consecutiveCorrect);
            perfectRounds++;
          } else {
            consecutiveCorrect = 0;
            if (roundPlayer.made > roundPlayer.call) {
              overBids++;
            } else {
              underBids++;
            }
          }
          
          const roundScore = roundPlayer.score || 0;
          if (roundIndex === 0 || roundScore > bestRound) bestRound = roundScore;
          if (roundIndex === 0 || roundScore < worstRound) worstRound = roundScore;
        }
      });
      
      const roundsPlayed = allRoundsData.length;
      const bidAccuracy = roundsPlayed > 0 ? (correctBids / roundsPlayed) * 100 : 0;
      const avgBid = roundsPlayed > 0 ? totalBids / roundsPlayed : 0;
      const avgTricks = roundsPlayed > 0 ? totalTricks / roundsPlayed : 0;
      
      // Get the current player's total score from the current round data
      const playerCurrentTotalScore = player.totalScore || 0;
      const avgPoints = roundsPlayed > 0 ? playerCurrentTotalScore / roundsPlayed : 0;
      console.log("Player:", player.name, "Total Points:", playerCurrentTotalScore, "Rounds Played:", roundsPlayed, "Avg Points:", avgPoints);
      const avgDiff = roundsPlayed > 0 ? 
        allRoundsData.reduce((sum, round) => {
          const roundPlayer = round.players.find(p => p.id === player.id);
          if (roundPlayer && roundPlayer.call !== null && roundPlayer.made !== null) {
            return sum + Math.abs(roundPlayer.made - roundPlayer.call);
          }
          return sum;
        }, 0) / roundsPlayed 
        : 0;

      return {
        id: player.id,
        name: player.name,
        roundsPlayed,
        correctBids,
        perfectRounds,
        bidAccuracy: bidAccuracy.toFixed(1),
        avgBid: avgBid.toFixed(1),
        avgTricks: avgTricks.toFixed(1),
        avgPoints: avgPoints.toFixed(1),
        totalPoints: playerCurrentTotalScore, // Use the player's current total score
        overBids,
        underBids,
        bestRound,
        worstRound,
        maxConsecutiveCorrect,
        avgDiff: avgDiff.toFixed(2)
      };
    });
  };

  const detailedStats = calculateDetailedGameStats();

  const totalCalls = currentRound.players.reduce((sum, player) => sum + (player.call || 0), 0);
  
  // Check if all made values are entered and total correctly
  const allMadeEntered = currentRound.players.every(player => player.made !== null);
  const totalMade = currentRound.players.reduce((sum, player) => sum + (player.made || 0), 0);
  const madeValuesCorrect = allMadeEntered && totalMade === currentRound.round;

  // Returns the forbidden call value for the last player, or null if not applicable
  const lastPlayerCantCall = () => {
    if (!currentRound) return 0;
    const players = currentRound.players;
    // Find players who have not made a call yet
    const uncalledPlayers = players.filter(p => p.call === null);
    // Only restrict the last player to call
    if (uncalledPlayers.length !== 1) return "not 0";
    // The forbidden call is the value that would make totalCalls == currentRound.round
    const forbiddenCall = currentRound.round - totalCalls;
    // Only restrict if forbiddenCall is within valid range
    if (forbiddenCall >= 0 && forbiddenCall <= currentRound.round) {
      return `not ${forbiddenCall}`;
    }
    return 0;
  };

  // Calculate dealer and caller for the current round
  const getDealerAndCaller = () => {
    if (!currentRound || !currentRound.players || currentRound.players.length === 0) {
      return { dealer: null, caller: null };
    }
    
    const players = currentRound.players;
    const playerCount = players.length;
    const roundIndex = gameState.currentRound - 1; // 0-based index
    
    // Dealer rotates each round (starts with first player in round 1)
    const dealerIndex = roundIndex % playerCount;
    // Caller is the next player after dealer (wraps around)
    const callerIndex = (dealerIndex + 1) % playerCount;
    
    return {
      dealer: players[dealerIndex],
      caller: players[callerIndex]
    };
  };

  const { dealer, caller } = getDealerAndCaller();

  // console.log("detailedStats", detailedStats);

  return (
    <div className={`game-in-progress players-${gameState.players.length} ${gameState.players.length > 3 ? 'many-players' : ''}`}>
      <div className="round-info">
        <span>
          Round {parseInt(gameState.currentRound, 10)} of {gameState.maxRounds? parseInt(gameState.maxRounds, 10): parseInt(gameState.maxRounds, 10)}
        </span>
        <span className="total-calls">
          Calls: {totalCalls} |  {(currentRound?.round - totalCalls) < 0 ? 'free' : lastPlayerCantCall()}
        </span>
      </div>

      {isLastRound && isRoundComplete && (
        <button className="finish-btn" onClick={handleFinishGame}>
          Finish Game
        </button>
      )}

      {activeTab === 'game' && (
        <div className="tab-panel">
          <div className="player-scores">
            <table className="score-table">
              <tbody>
              {currentRound?.players.map((player) => (
                <tr key={player.id} className={`player-row ${player.id === dealer?.id ? 'dealer' : ''} ${player.id === caller?.id ? 'caller' : ''}`}>
                  <td className="player-cell">
                    <div className="player-name-container">
                      <span className="player-name">{player.name}</span>
                      {player.id === dealer?.id && <span className="role-badge dealer-badge">Dealer</span>}
                      {player.id === caller?.id && <span className="role-badge caller-badge">Caller</span>}
                    </div>
                  </td>
                  <td>
                    <input
                      type="tel"
                      className="rounds-input"
                      value={player.call !== null ? player.call : ''}
                      placeholder="0"
                      onChange={(e) => updateCall(player.id, parseInt(e.target.value) || '')}
                      min={0}
                      max={currentRound.round}
                      title={`${player.name}'s Call`}
                      inputMode="numeric"
                      pattern="[0-9]*"
                    />
                  </td>
                  <td>
                    {(() => {
                      // In Wizard, each player can make 0 to the total cards in the round
                      // The total made by all players should equal the round, but individual 
                      // players aren't constrained by others' made values
                      const maxPossibleTricks = currentRound.round;
                      console.log("Max Possible Tricks:", maxPossibleTricks);
                      
                      return (
                        <div className="made-input-container">
                          <input
                            type="tel"
                            className={`rounds-input ${madeValuesCorrect ? 'made-correct' : ''}`}
                            value={player.made !== null ? player.made : ''}
                            placeholder="0"
                            onChange={(e) => {
                              const value = parseInt(e.target.value) || 0;
                              updateMade(player.id, value);
                            }}
                            min={0}
                            max={maxPossibleTricks}
                            title={`${player.name}'s Tricks Made (Max: ${maxPossibleTricks})`}
                            disabled={player.call === null}
                            inputMode="numeric"
                            pattern="[0-9]*"
                          />
                        </div>
                      );
                    })()}
                  </td>
                  <td className="score-cell">
                    <div className="score">
                      <span className="total-score">
                        {player.totalScore !== null ? player.totalScore : 0}
                      </span>
                      {player.score !== null && player.score !== 0 && (
                        <span
                        className={
                        player.score > 0
                          ? "round-score positive"
                          : "round-score negative"
                          }
                        >
                        ({player.score > 0 ? `+${player.score}` : player.score})
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'stats' && (
        <div className="tab-panel">
          <div className="game-stats-container">
            <h2>Player Statistics</h2>
            
            <div className="stats-subtabs">
              <button 
                className={`stats-subtab-btn ${statsSubTab === 'chart' ? 'active' : ''}`}
                onClick={() => setStatsSubTab('chart')}
              >
                Charts
              </button>
              <button 
                className={`stats-subtab-btn ${statsSubTab === 'details' ? 'active' : ''}`}
                onClick={() => setStatsSubTab('details')}
              >
                Player Details
              </button>
              <button 
                className={`stats-subtab-btn ${statsSubTab === 'table' ? 'active' : ''}`}
                onClick={() => setStatsSubTab('table')}
              >
                Score Table
              </button>
            </div>
            
            {statsSubTab === 'chart' ? (
              <StatsChart 
                playersData={detailedStats} 
                roundData={gameState.roundData.slice(0, currentRoundIndex + 1)} 
              />
            ) : statsSubTab === 'table' ? (
              <div className="rounds-section">
                <div className={`wizard-scorecard ${gameState.players.length > 3 ? 'many-players' : ''}`} data-player-count={gameState.players.length}>
                  <table className="scorecard-table">
                    <thead>
                      <tr>
                        <th className="round-header sticky-cell">Round</th>
                        {currentRound?.players.map(player => (
                          <th key={player.id} className="player-header">
                            <div className="player-header-name">{player.name}</div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {gameState.roundData.slice(0, currentRoundIndex + 1).map((round, index) => (
                        <tr key={index} className="round-row">
                          <td className="round-number sticky-cell">{index + 1}</td>
                          {currentRound?.players.map(player => {
                            const playerRound = round.players.find(p => p.id === player.id);
                            
                            // Determine bid status for color-coding
                            let bidStatusClass = '';
                            if (playerRound && playerRound.call !== null && playerRound.made !== null) {
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
                                    <div className="round-score">{playerRound.score !== null ? playerRound.score : '-'}</div>
                                    <div className="round-bid">{playerRound.call !== null ? playerRound.call : '-'}</div>
                                    <div className={`round-made ${bidStatusClass}`}>{playerRound.made !== null ? playerRound.made : '-'}</div>
                                  </div>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                      <tr className="total-row">
                        <td className="total-label sticky-cell">Total</td>
                        {currentRound?.players.map(player => (
                          <td key={player.id} className="total-score">
                            {player.totalScore || 0}
                          </td>
                        ))}
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="results-table">
              {detailedStats.map((playerStats, index) => (
                <div key={playerStats.id} className="results-row">
                  <div className="rank-col">{index + 1}</div>
                  <div className="player-col">
                    <div className="player-info">
                      <span>{playerStats.name}</span>
                    </div>
                  </div>
                  <div className="score-col">{playerStats.totalPoints || 0}</div>
                  <button className="adv-stats-btn" onClick={() => togglePlayerStats(playerStats.id)}>
                    {selectedPlayerId === playerStats.id ? 'Hide Stats' : 'Adv. Stats'}
                  </button>
                  
                  {selectedPlayerId === playerStats.id && (
                    <div className="advanced-stats">
                      <div className="stats-section">
                        <div className="stats-section-title">Game Performance</div>
                        <div className="stats-cards" id="game-performance">
                          {/* <p>Total Points: <span>{playerStats.totalPoints}</span></p> */}
                          <p>Highest Round: <span>{Math.round(playerStats.bestRound)}</span></p>
                          <p>Correct Bids: <span>{Math.round(playerStats.correctBids)}</span></p>
                          <p>Total Tricks Won: <span>{Math.round(playerStats.totalTricks || playerStats.avgTricks * playerStats.roundsPlayed, 2)}</span></p>
                        </div>
                      </div>
                      <div className="stats-section">
                        <div className="stats-section-title">Additional Stats</div>
                        <div className="stats-cards">
                          <div className="additional-stats">
                            <div className="stat-row">
                              <span className="stat-label">Best Bidding Streak:</span>
                              <span className="stat-value">{playerStats.maxConsecutiveCorrect}</span>
                            </div>
                            <div className="stat-row">
                              <span className="stat-label">Worst Round:</span>
                              <span className="stat-value negative">{playerStats.worstRound}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="stats-section">
                        <div className="stats-section-title">Bidding Precision</div>
                        <div className="stats-cards">
                          <PerformanceMetric 
                            label="Average Score" 
                            value={playerStats.avgPoints} 
                            targetMin={10} 
                            targetMax={20}
                            isBadWhenAboveMax={false}
                          />
                          <PerformanceMetric 
                            label="Bid Accuracy" 
                            value={parseFloat(playerStats.bidAccuracy || 0)} 
                            targetMin={40} 
                            targetMax={75}
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
                                const overbids = playerStats.overBids || 0;
                                const underbids = playerStats.underBids || 0;
                                const correctBids = playerStats.correctBids || 0;
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
                              const overbids = playerStats.overBids || 0;
                              const underbids = playerStats.underBids || 0;
                              const correctBids = playerStats.correctBids || 0;
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
                              <span className="bid-stat correct">{playerStats.correctBids} correct</span> •
                              <span className="bid-stat over">{playerStats.overBids} over</span> •
                              <span className="bid-stat under">{playerStats.underBids} under</span>
                            </div>
                          </div>
                          <PerformanceMetric 
                            label="Average Deviation" 
                            value={playerStats.avgDiff} 
                            targetMin={0}
                            targetMax={0.25}
                            isBadWhenAboveMax={true}
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
            )}
          </div>
        </div>
      )}

      {/* Top Section with Controls */}
      <div className="game-bottom-section">
        {/* Toggle Button for Game Board / Player Stats */}
        <div className="toggle-section">
          <button
            className="game-control-btn"
            onClick={() => setActiveTab(activeTab === 'game' ? 'stats' : 'game')}
          >
            {activeTab === 'game' ? <BarChartIcon size={27} /> : <GamepadIcon size={27} />}
          </button>
        </div>

        <div className="game-controls">
          <button 
            className="game-control-btn pause-btn"
            onClick={() => showPauseConfirmation()}
            title="Pause Game"
          >
            <PauseIcon size={27} />
          </button>
        </div>

        <button className="nav-btn" id="prevRoundBtn" onClick={previousRound} disabled={isFirstRound}>
            <ArrowLeftIcon />
        </button>

        <button className="nav-btn" id="nextRoundBtn" onClick={nextRound} disabled={isLastRound || !isRoundComplete}>
          <ArrowRight />
        </button>
      </div> 

      {/* Save Game Dialog */}
      <SaveGameDialog
        isOpen={showSaveDialog}
        onClose={() => setShowSaveDialog(false)}
        onSave={handleSaveGame}
        onPause={handlePauseGame}
        onLeave={handleLeaveGame}
        gameState={gameState}
        showPauseOption={true}
        showLeaveOption={true}
        initialOption='pause' // Default to pause option since that's what users will likely want
      />

      {/* Load Game Dialog */}
      <LoadGameDialog
        isOpen={showLoadDialog}
        onClose={() => setShowLoadDialog(false)}
        onLoadGame={handleLoadGame}
        getSavedGames={getSavedGames}
      />

      {/* Game Menu Modal */}
      <GameMenuModal
        isOpen={showGameMenuModal}
        onClose={() => setShowGameMenuModal(false)}
        onLoadGame={() => {
          setShowGameMenuModal(false);
          setShowLoadDialog(true);
        }}
        onSaveGame={() => {
          setShowGameMenuModal(false);
          setShowSaveDialog(true);
          // Just save, don't set initialOption
        }}
        onPauseGame={() => {
          setShowGameMenuModal(false);
          // Show pause confirmation dialog
          showPauseConfirmation();
        }}
        onLeaveGame={() => {
          setShowGameMenuModal(false);
          handleLeaveGame();
        }}
      />
      
      {/* Pause Confirmation Modal */}
      <PauseConfirmationModal
        isOpen={showPauseModal}
        onClose={() => setShowPauseModal(false)}
        onConfirm={handlePauseGame}
        currentRound={gameState.currentRound}
        maxRounds={gameState.maxRounds}
      />
    </div>
  )
}

export default GameInProgress

