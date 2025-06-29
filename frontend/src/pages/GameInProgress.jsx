"use client"

import React from "react";
import { useState, useEffect, useRef } from "react"
import { useNavigate } from "react-router-dom"
import { useGameStateContext } from "../hooks/useGameState"
import SaveGameDialog from "../components/SaveGameDialog"
import LoadGameDialog from "../components/LoadGameDialog"
import { SaveIcon, PauseIcon, MenuIcon } from "../components/Icon"

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
  const [showGameMenu, setShowGameMenu] = useState(false)
  const menuRef = useRef(null)

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setShowGameMenu(false)
      }
    }

    if (showGameMenu) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showGameMenu])

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

  const handlePauseGame = async (gameName) => {
    try {
      const success = await pauseGame(gameName)
      if (success) {
        setShowSaveDialog(false)
        resetGame()
        navigate("/", { state: { message: "Game paused successfully!" } })
      }
      return success
    } catch (error) {
      console.error('Failed to pause game:', error)
      return false
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

  const toggleGameMenu = () => {
    setShowGameMenu(!showGameMenu)
  }

  if (!gameState.gameStarted) {
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
      let totalPoints = 0;
      let bestRound = 0;
      let worstRound = 0;
      let consecutiveCorrect = 0;
      let maxConsecutiveCorrect = 0;
      
      allRoundsData.forEach((round, roundIndex) => {
        const roundPlayer = round.players.find(p => p.id === player.id);
        if (roundPlayer && roundPlayer.call !== null && roundPlayer.made !== null) {
          totalBids += roundPlayer.call;
          totalTricks += roundPlayer.made;
          totalPoints += roundPlayer.totalScore || 0;
          
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
      const avgPointsPerRound = roundsPlayed > 0 ? totalPoints / roundsPlayed : 0;

      return {
        id: player.id,
        name: player.name,
        roundsPlayed,
        correctBids,
        perfectRounds,
        bidAccuracy: bidAccuracy.toFixed(1),
        avgBid: avgBid.toFixed(1),
        avgTricks: avgTricks.toFixed(1),
        avgPointsPerRound: avgPointsPerRound.toFixed(1),
        totalPoints,
        overBids,
        underBids,
        bestRound,
        worstRound,
        maxConsecutiveCorrect,
        biddingTendency: avgBid > avgTricks ? 'Over-bidder' : avgBid < avgTricks ? 'Under-bidder' : 'Accurate bidder'
      };
    });
  };

  const detailedStats = calculateDetailedGameStats();

  const totalCalls = currentRound.players.reduce((sum, player) => sum + (player.call || 0), 0);

  console.log("Current Round:", currentRound);

  return (
    <div className="game-in-progress">
      <div className="game-header">
        <div className="game-title-section">
          <h1>{gameState.gameName || "Wizard Game"}</h1>
          <div className="game-controls" ref={menuRef}>
            <button 
              className="game-control-btn"
              onClick={() => setShowSaveDialog(true)}
              title="Save Game"
            >
              <SaveIcon />
            </button>
            <button 
              className="game-control-btn"
              onClick={() => setShowSaveDialog(true)}
              title="Pause Game"
            >
              <PauseIcon />
            </button>
            <button 
              className={`game-control-btn menu-btn ${showGameMenu ? 'active' : ''}`}
              onClick={toggleGameMenu}
              title="Game Menu"
            >
              <MenuIcon />
            </button>
            
            {showGameMenu && (
              <div className="game-menu-dropdown">
                <button onClick={() => setShowLoadDialog(true)}>
                  Load Game
                </button>
                <button onClick={() => setShowSaveDialog(true)}>
                  Save & Continue
                </button>
                <button onClick={() => setShowSaveDialog(true)}>
                  Pause Game
                </button>
                <button onClick={() => setShowSaveDialog(true)} className="leave-btn">
                  Leave Game
                </button>
              </div>
            )}
          </div>

          <div className="round-info">
            <span>
              Round {gameState.currentRound} of {gameState.maxRounds}
            </span>
            <span className="total-calls">
              Total Calls: {totalCalls} / {currentRound?.cards}
            </span>
          </div>

           <div className="round-navigation">
            <button className="nav-btn" onClick={previousRound} disabled={isFirstRound}>
              Previous Round
            </button>
            <button className="nav-btn" onClick={nextRound} disabled={isLastRound || !isRoundComplete}>
              Next Round
            </button>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="card-tabs">
        <button 
          className={`tab-button ${activeTab === 'game' ? 'active' : ''}`}
          onClick={() => setActiveTab('game')}
        >
          Game Board
        </button>
        <button 
          className={`tab-button ${activeTab === 'stats' ? 'active' : ''}`}
          onClick={() => setActiveTab('stats')}
        >
          Player Stats
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === 'game' && (
        <div className="tab-panel">

          <div className="player-scores">
            <table className="score-table">
              <thead>
                <tr>
                  <th>Player</th>
                  <th>Call</th>
                  <th>Made</th>
                  <th>Score</th>
                </tr>
              </thead>
              <tbody>
                {currentRound?.players.map((player) => (
                  <tr key={player.id} className="player-row">
                    <td className="player-cell">
                      {player.name}
                    </td>
                    <td>
                      <input
                        type="number"
                        className="rounds-input"
                        value={player.call !== null ? player.call : 0}
                        onChange={(e) => updateCall(player.id, parseInt(e.target.value) || 0)}
                        min={0}
                        max={currentRound.cards}
                        title={`${player.name}'s Call`}
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        className="rounds-input"
                        value={player.made !== null ? player.made : 0}
                        onChange={(e) => updateMade(player.id, parseInt(e.target.value) || 0)}
                        min={0}
                        max={currentRound.cards}
                        title={`${player.name}'s Tricks Made`}
                        disabled={player.call === null}
                      />
                    </td>
                    <td>
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
                            {player.score > 0 ? `+${player.score}` : player.score}
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {isLastRound && isRoundComplete && (
            <button className="finish-btn" onClick={handleFinishGame}>
              Finish Game
            </button>
          )}
        </div>
      )}

      {activeTab === 'stats' && (
        <div className="tab-panel">
          <div className="game-stats-container">
            <h2>Player Statistics</h2>
            <p className="stats-description">
              Detailed performance analysis for this game through Round {gameState.currentRound}
            </p>
            
            <div className="stats-grid">
              {detailedStats.map((playerStats) => (
                <div key={playerStats.id} className="player-stat-card">
                  <h3 className="player-stat-name">{playerStats.name}</h3>
                  
                  <div className="stat-section">
                    <h4>Bidding Performance</h4>
                    <div className="stat-row">
                      <span className="stat-label">Bid Accuracy:</span>
                      <span className="stat-value highlight">{playerStats.bidAccuracy}%</span>
                      <span className="stat-explanation">
                        ({playerStats.correctBids}/{playerStats.roundsPlayed} perfect bids)
                      </span>
                    </div>
                    <div className="stat-row">
                      <span className="stat-label">Bidding Style:</span>
                      <span className="stat-value">{playerStats.biddingTendency}</span>
                    </div>
                    <div className="stat-row">
                      <span className="stat-label">Avg. Bid:</span>
                      <span className="stat-value">{playerStats.avgBid}</span>
                      <span className="stat-explanation">tricks per round</span>
                    </div>
                    <div className="stat-row">
                      <span className="stat-label">Avg. Made:</span>
                      <span className="stat-value">{playerStats.avgTricks}</span>
                      <span className="stat-explanation">tricks per round</span>
                    </div>
                  </div>

                  <div className="stat-section">
                    <h4>Scoring Performance</h4>
                    <div className="stat-row">
                      <span className="stat-label">Total Points:</span>
                      <span className="stat-value highlight">{playerStats.totalPoints}</span>
                    </div>
                    <div className="stat-row">
                      <span className="stat-label">Avg. Points/Round:</span>
                      <span className="stat-value">{playerStats.avgPointsPerRound}</span>
                    </div>
                    <div className="stat-row">
                      <span className="stat-label">Best Round:</span>
                      <span className="stat-value positive">{playerStats.bestRound}</span>
                      <span className="stat-explanation">points</span>
                    </div>
                    <div className="stat-row">
                      <span className="stat-label">Worst Round:</span>
                      <span className="stat-value negative">{playerStats.worstRound}</span>
                      <span className="stat-explanation">points</span>
                    </div>
                  </div>

                  <div className="stat-section">
                    <h4>Consistency</h4>
                    <div className="stat-row">
                      <span className="stat-label">Perfect Rounds:</span>
                      <span className="stat-value">{playerStats.perfectRounds}</span>
                      <span className="stat-explanation">bid = tricks made</span>
                    </div>
                    <div className="stat-row">
                      <span className="stat-label">Best Streak:</span>
                      <span className="stat-value">{playerStats.maxConsecutiveCorrect}</span>
                      <span className="stat-explanation">consecutive perfect bids</span>
                    </div>
                    <div className="stat-row">
                      <span className="stat-label">Over-bids:</span>
                      <span className="stat-value">{playerStats.overBids}</span>
                      <span className="stat-explanation">made more than bid</span>
                    </div>
                    <div className="stat-row">
                      <span className="stat-label">Under-bids:</span>
                      <span className="stat-value">{playerStats.underBids}</span>
                      <span className="stat-explanation">made less than bid</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

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
      />

      {/* Load Game Dialog */}
      <LoadGameDialog
        isOpen={showLoadDialog}
        onClose={() => setShowLoadDialog(false)}
        onLoadGame={handleLoadGame}
        getSavedGames={getSavedGames}
      />
    </div>
  )
}

export default GameInProgress

