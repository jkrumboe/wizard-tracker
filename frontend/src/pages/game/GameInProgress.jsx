"use client"

import React from "react";
import { useState, useEffect, useRef } from "react"
import { useNavigate } from "react-router-dom"
import { useGameStateContext } from "@/shared/hooks/useGameState"
import SaveGameDialog from "@/components/modals/SaveGameDialog"
import LoadGameDialog from "@/components/modals/LoadGameDialog"
import GameMenuModal from "@/components/modals/GameMenuModal"
import PauseConfirmationModal from "@/components/modals/PauseConfirmationModal"
import PerformanceMetric from "@/components/common/PerformanceMetric"
import { SyncStatusIndicator } from "@/components/game"
import "@/styles/utils/performanceMetrics.css"
import "@/styles/pages/stats.css"
import "@/styles/pages/gameInProgress.css"
import "@/styles/components/statsChart.css"
import StatsChart from "@/components/game/StatsChart";
import { AdvancedStats } from "@/components/game";
import { PauseIcon, ArrowLeftIcon, ArrowRightIcon, BarChartIcon, GamepadIcon, ArrowLeftCircleIcon } from "@/components/ui/Icon"

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
    getSavedGames,
    recoverGameState
  } = useGameStateContext()
  
  const [activeTab, setActiveTab] = useState('game')
  const [showSaveDialog, setShowSaveDialog] = useState(false)
  const [showLoadDialog, setShowLoadDialog] = useState(false)
  const [showGameMenuModal, setShowGameMenuModal] = useState(false)
  const [showPauseModal, setShowPauseModal] = useState(false)
  const [selectedPlayerId, setSelectedPlayerId] = useState(null)
  const [statsSubTab, setStatsSubTab] = useState('chart') // 'chart' or 'details'
  const [isRecovering, setIsRecovering] = useState(false) // Track recovery state
  const [isLandscape, setIsLandscape] = useState(window.matchMedia('(orientation: landscape)').matches)
  
  // Refs to store current values for event handlers
  const gameStateRef = useRef(gameState)
  const pauseGameRef = useRef(pauseGame)
  
  // Update refs when values change
  useEffect(() => {
    gameStateRef.current = gameState
    pauseGameRef.current = pauseGame
  }, [gameState, pauseGame])
  
  // Listen for orientation changes
  useEffect(() => {
    const mediaQuery = window.matchMedia('(orientation: landscape)')
    const handleOrientationChange = (e) => {
      setIsLandscape(e.matches)
    }
    
    mediaQuery.addEventListener('change', handleOrientationChange)
    return () => mediaQuery.removeEventListener('change', handleOrientationChange)
  }, [])
  
  // Function to toggle player stats visibility
  const togglePlayerStats = (playerId) => {
    setSelectedPlayerId(prev => prev === playerId ? null : playerId)
  }

  const handleFinishGame = async () => {
    const success = await finishGame()
    if (success) {
      // Clear game state backup since game is finished
      sessionStorage.removeItem('gameStateBackup');
      sessionStorage.removeItem('gameInProgressVisited');
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
        // Clear game state backup since game is paused
        sessionStorage.removeItem('gameStateBackup');
        sessionStorage.removeItem('gameInProgressVisited');
        
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
        // Clear game state backup since game is left
        sessionStorage.removeItem('gameStateBackup');
        sessionStorage.removeItem('gameInProgressVisited');
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

  // Log page reload and navigation events
  useEffect(() => {
    // Use sessionStorage to track if this is truly the first visit
    const hasVisitedBefore = sessionStorage.getItem('gameInProgressVisited');
    const isFirstVisit = !hasVisitedBefore;
    
    if (isFirstVisit) {
      sessionStorage.setItem('gameInProgressVisited', 'true');
    } else {
      console.debug('Returning to GameInProgress - auto-pause enabled');
    }
    
    // Store current game state in sessionStorage for recovery
    if (gameState && gameState.gameStarted && gameState.players?.length > 0) {
      sessionStorage.setItem('gameStateBackup', JSON.stringify(gameState));
    }
    
    // Cleanup function runs when component unmounts (navigation away)
    return () => {      
      // Check if this is a Vite hot reload (development mode)
      const isViteReload = import.meta.hot !== undefined;
      
      // Only auto-pause if this is NOT the first visit, NOT a Vite reload, and game is started
      const currentGameState = gameStateRef.current;
      const currentPauseGame = pauseGameRef.current;
      
      if (!isFirstVisit && !isViteReload && currentGameState && currentGameState.gameStarted) {
        const gameName = `Auto-Paused - Round ${currentGameState.currentRound}/${currentGameState.maxRounds}`;
        try {
          currentPauseGame(gameName);
          // Clear backup since game is being auto-paused
          sessionStorage.removeItem('gameStateBackup');
          sessionStorage.removeItem('gameInProgressVisited');
        } catch (error) {
          console.error('Failed to auto-pause game on navigation:', error);
        }
      } else {
        console.debug('Skipping auto-pause on unmount');
        console.debug('Unmount reasons: isFirstVisit:', isFirstVisit, 'isViteReload:', isViteReload, 'gameStarted:', currentGameState?.gameStarted);
      }
    };
  }, [gameState]); // Include gameState dependency for backup functionality

  // Separate useEffect to handle game state recovery
  useEffect(() => {
    // Check if we need to recover game state (empty state but we have a backup)
    if ((!gameState || !gameState.gameStarted || gameState.players?.length === 0) && 
        window.location.pathname === '/game/current' && !isRecovering) {
      
      const backupGameState = sessionStorage.getItem('gameStateBackup');
      if (backupGameState) {
        try {
          const parsedBackup = JSON.parse(backupGameState);
          
          // Only restore if the backup has valid game data
          if (parsedBackup.gameStarted && parsedBackup.players?.length > 0) {
            setIsRecovering(true);
            
            // Use setTimeout to allow UI to update before recovery
            setTimeout(() => {
              const success = recoverGameState(parsedBackup);
              if (success) {
                // Clear the backup after successful recovery to prevent re-triggering
                sessionStorage.removeItem('gameStateBackup');
              } else {
                console.error('Failed to recover game state');
                // Don't clear backup if recovery failed, allow manual recovery
              }
              setIsRecovering(false);
            }, 100);
          }
        } catch (error) {
          console.error('Failed to parse backup game state:', error);
          sessionStorage.removeItem('gameStateBackup');
        }
      }
    }
  }, [gameState, recoverGameState, isRecovering]);


  // Add defensive check for game state
  if (!gameState) {
    return <div>Loading game state...</div>;
  }


  if (!gameState.gameStarted) {
    // If we have an empty game state but we're on the game page, show a loading message
    // This can happen during authentication issues or page refresh
    if (gameState.players?.length === 0 && gameState.roundData?.length === 0) {
      // Check if we have a backup available
      const backupGameState = sessionStorage.getItem('gameStateBackup');
      if (backupGameState) {
        try {
          const parsedBackup = JSON.parse(backupGameState);
          if (parsedBackup.gameStarted && parsedBackup.players?.length > 0) {
            return (
              <div style={{ padding: '20px', textAlign: 'center' }}>
                <h3>Game Session Lost</h3>
                <p>Your game state was lost due to a connection issue.</p>
                <p>We detected a backup from: Round {parsedBackup.currentRound} of {parsedBackup.maxRounds}</p>
                <p>Players: {parsedBackup.players.map(p => p.name).join(', ')}</p>
                <div style={{ marginTop: '20px' }}>
                  <button 
                    onClick={() => {
                      setIsRecovering(true);
                      setTimeout(() => {
                        const success = recoverGameState(parsedBackup);
                        if (success) {
                          sessionStorage.removeItem('gameStateBackup');
                        } else {
                          console.error('Manual recovery failed');
                          alert('Failed to recover game state. Please try refreshing the page.');
                        }
                        setIsRecovering(false);
                      }, 100);
                    }}
                    disabled={isRecovering}
                    style={{ 
                      marginRight: '10px', 
                      padding: '10px 20px', 
                      backgroundColor: isRecovering ? '#ccc' : '#007bff', 
                      color: 'var(--text-color)', 
                      border: 'none', 
                      borderRadius: '4px',
                      cursor: isRecovering ? 'not-allowed' : 'pointer'
                    }}
                  >
                    {isRecovering ? 'Restoring...' : 'Restore Game'}
                  </button>
                  <button 
                    onClick={() => navigate('/')}
                    style={{ marginRight: '10px', padding: '10px 20px' }}
                  >
                    Return Home
                  </button>
                  <button 
                    onClick={() => window.location.reload()}
                    style={{ padding: '10px 20px' }}
                  >
                    Try Refresh
                  </button>
                </div>
                <p style={{ fontSize: '0.9em', color: '#666', marginTop: '15px' }}>
                  Tip: If this keeps happening, try logging out and back in.
                </p>
              </div>
            );
          }
        } catch (error) {
          console.error('Failed to parse backup for display:', error);
        }
      }
      
      return (
        <div style={{ padding: '20px', textAlign: 'center' }}>
          <h3>Loading game...</h3>
          <p>Please wait while we restore your game state.</p>
          <div style={{ marginTop: '20px' }}>
            <button 
              onClick={() => navigate('/')}
              style={{ padding: '10px 20px' }}
            >
              Return Home
            </button>
          </div>
        </div>
      );
    }
    return null
  }

  const currentRoundIndex = gameState.currentRound - 1
  const currentRound = gameState.roundData[currentRoundIndex]
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

  // Handle back button click
  const handleBack = () => {
    navigate(-1); // Go back to previous page
  };

  return (
    <div className={`game-in-progress players-${gameState.players.length} ${gameState.players.length > 3 ? 'many-players' : ''}`}>
      <div className="round-info">
        <button 
          className="back-btn"
          onClick={handleBack}
          title="Go back"
        >
          <ArrowLeftCircleIcon size={28} />
        </button>
        <span className="round-number">
          Round {parseInt(gameState.currentRound, 10)} of {gameState.maxRounds? parseInt(gameState.maxRounds, 10): parseInt(gameState.maxRounds, 10)}
        </span>
        <span className="total-calls">
          Calls: {totalCalls} |  {(currentRound?.round - totalCalls) < 0 ? 'free' : lastPlayerCantCall()}
        </span>
        {/* <SyncStatusIndicator 
          gameId={gameState.id || gameState.localId}
          showDetails={false}
        /> */}
      </div>

      {/* Auto-upload notification */}
      {gameState.autoUploadStatus && (
        <div className={`auto-upload-notification ${gameState.autoUploadStatus}`}>
          <span>{gameState.autoUploadMessage}</span>
        </div>
      )}

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
            </div>
            
            {/* Show both views in landscape, otherwise show based on selected tab */}
            {(statsSubTab === 'chart' || isLandscape) && (
              <div className="stats-chart-container">
                <StatsChart 
                  playersData={detailedStats} 
                  roundData={gameState.roundData.slice(0, currentRoundIndex + 1)} 
                />
              </div>
            )}
            
            {(statsSubTab === 'details' || isLandscape) && (
              <div className="results-table">
                {detailedStats.map((playerStats, index) => (
                  <div key={playerStats.id} className="results-row">
                    <div className="top-result-row">
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
                    </div>
                    
                    <AdvancedStats 
                      playerStats={playerStats} 
                      isVisible={selectedPlayerId === playerStats.id} 
                    />
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
          <ArrowRightIcon />
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

