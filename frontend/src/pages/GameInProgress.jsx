"use client"

import React from "react";
import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { useGameStateContext } from "../hooks/useGameState"
import NumberPicker from "../components/NumberPicker"

const GameInProgress = () => {
  const navigate = useNavigate()
  const { gameState, updateCall, updateMade, nextRound, previousRound, finishGame, resetGame } = useGameStateContext()
  const [selectedPlayerId, setSelectedPlayerId] = useState(null)


  const handleFinishGame = async () => {
    const success = await finishGame()
    if (success) {
      resetGame(); 
      navigate("/")
    }
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

  return (
    <div className="game-in-progress">
      <div className="game-header">
        <h1>Wizard Game</h1>
        <div className="round-info">
          <span>
            Round {gameState.currentRound} of {gameState.maxRounds}
          </span>
          <span className="total-calls">
            Total Calls: {totalCalls} / {currentRound?.cards}
          </span>
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
                    if (!e.target.closest(".number-picker")) {
                      togglePlayerStats(player.id);
                    }
                  }}>
                    <td className="player-cell">
                      {player.name}
                      </td>
                      <td>
                      <NumberPicker
                        value={player.call !== null ? player.call : 0}
                        onChange={(value) => updateCall(player.id, value)}
                        min={0}
                        max={currentRound.cards + 1}
                        title={`${player.name}'s Call`}
                      />
                      </td>
                      <td>
                      <NumberPicker
                        value={player.made !== null ? player.made : 0}
                        onChange={(value) => updateMade(player.id, value)}
                        min={0}
                        max={currentRound.cards + 1}
                        title={`${player.name}'s Tricks Made`}
                        disabled={player.call === null }
                      />
                      </td>
                      <td>
                      <div className="score">
                        {player.totalScore !== null ? (
                        <span className="total-score">{player.totalScore}</span>
                        ) : (
                        "-"
                        )}
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
    </div>
  )
}

export default GameInProgress

