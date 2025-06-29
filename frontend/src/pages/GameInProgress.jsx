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
  
  const [selectedPlayerId, setSelectedPlayerId] = useState(null)
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

  // Add a section to display stats for the current game
  const calculateCurrentGameStats = () => {
    const currentPlayers = currentRound?.players || [];
    const allRoundsData = gameState.roundData.slice(0, currentRoundIndex + 1);

    return currentPlayers.map((player) => {
      let correctBids = 0;
      let totalBids = 0;
      let totalTricks = 0;
      
      allRoundsData.forEach(round => {
        const roundPlayer = round.players.find(p => p.id === player.id);
        if (roundPlayer && roundPlayer.call !== null && roundPlayer.made !== null) {
          totalBids += roundPlayer.call;
          totalTricks += roundPlayer.made;
          if (roundPlayer.call === roundPlayer.made) correctBids++;
        }
      });
      
      const roundsPlayed = allRoundsData.length;
      const bidAccuracy = roundsPlayed > 0 ? (correctBids / roundsPlayed) * 100 : 0;
      const avgBid = roundsPlayed > 0 ? totalBids / roundsPlayed : 0;
      const avgTricks = roundsPlayed > 0 ? totalTricks / roundsPlayed : 0;

      return {
        id: player.id,
        name: player.name,
        bidAccuracy: bidAccuracy.toFixed(2),
        avgBid: avgBid.toFixed(2),
        avgTricks: avgTricks.toFixed(2),
      };
    });
  };
  const currentGameStats = calculateCurrentGameStats();

  const totalCalls = currentRound.players.reduce((sum, player) => sum + (player.call || 0), 0);
  // console.log("Total Calls:", totalCalls);

  // Add functionality to toggle player stats on row click
  const togglePlayerStats = (playerId) => {
    setSelectedPlayerId((prev) => (prev === playerId ? null : playerId));
  };

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
        </div>
      </div>

      <div className="round-navigation">
        <button className="nav-btn" onClick={previousRound} disabled={isFirstRound}>
          Previous Round
        </button><button className="nav-btn" onClick={nextRound} disabled={isLastRound || !isRoundComplete}>
          Next Round
        </button>
      </div>

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
          {/* Modify the player row to include stats and handle click events */}
          <tbody>
            {currentRound?.players.map((player) => (
              <React.Fragment key={player.id}>
                <tr
                  className="player-row"
                  onClick={(e) => {
                    // Don't toggle stats if they clicked on an input
                    if (e.target.tagName !== 'INPUT') {
                      togglePlayerStats(player.id);
                    }
                  }}>
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
                      <td>                      <div className="score">
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
                {selectedPlayerId === player.id && (
                  <tr className="player-stats-row">
                    <td colSpan="5">
                      <div className="player-stats-game">
                        <p>Bid Accuracy: {currentGameStats.find((stat) => stat.id === player.id)?.bidAccuracy}%</p>
                        <p>Avg. Bid: {currentGameStats.find((stat) => stat.id === player.id)?.avgBid}</p>
                        <p>Avg. Tricks: {currentGameStats.find((stat) => stat.id === player.id)?.avgTricks}</p>
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>

      {isLastRound && isRoundComplete && (
        <button className="finish-btn" onClick={handleFinishGame}>
          Finish Game
        </button>
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

