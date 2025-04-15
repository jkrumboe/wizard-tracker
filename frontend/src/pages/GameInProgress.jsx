"use client"

import React from "react";
import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { useGameStateContext } from "../hooks/useGameState"
import NumberPicker from "../components/NumberPicker"
import defaultAvatar from "../assets/default-avatar.png";

const GameInProgress = () => {
  const navigate = useNavigate()
  const { gameState, updateCall, updateMade, nextRound, previousRound, finishGame } = useGameStateContext()
  const [selectedPlayerId, setSelectedPlayerId] = useState(null)

  useEffect(() => {
    if (!gameState.gameStarted) {
      navigate("/new-game")
    }
  }, [gameState.gameStarted, navigate])

  const handleFinishGame = async () => {
    const success = await finishGame()
    if (success) {
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

    return currentPlayers.map((player) => {
      const totalBids = currentRoundIndex + 1; // Total rounds so far
      const totalTricks = currentRoundIndex + 1; // Total rounds so far

      const bidAccuracy = ((player.call === player.made ? 1 : 0) / totalBids) * 100;
      const avgBid = player.call / totalBids;
      const avgTricks = player.made / totalTricks;

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
          <span className="cards-info">{currentRound?.cards} Cards</span>
        </div>
      </div>

      <div className="round-navigation">
        <button className="nav-btn" onClick={previousRound} disabled={isFirstRound}>
          Previous Round
        </button>
        <div className="round-display">Round {gameState.currentRound}</div>
        <button className="nav-btn" onClick={nextRound} disabled={isLastRound || !isRoundComplete}>
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
              <th>Total</th>
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
                  }}
                >
                  <td className="player-cell">
                    <img
                      src={
                        gameState.players.find((p) => p.id === player.id)?.avatar || defaultAvatar
                      }
                      alt={player.name}
                      className="player-avatar"
                    />
                    {player.name}
                  </td>
                  <td>
                    <NumberPicker
                      value={player.call !== null ? player.call : 0}
                      onChange={(value) => updateCall(player.id, value)}
                      min={0}
                      max={currentRound.cards}
                      title={`${player.name}'s Call`}
                    />
                  </td>
                  <td>
                    <NumberPicker
                      value={player.made !== null ? player.made : 0}
                      onChange={(value) => updateMade(player.id, value)}
                      min={0}
                      max={currentRound.cards}
                      title={`${player.name}'s Tricks Made`}
                    />
                  </td>
                  <td className={player.score > 0 ? "positive-score" : player.score < 0 ? "negative-score" : ""}>
                    {player.score !== null ? player.score : "-"}
                  </td>
                  <td>{player.totalScore !== null ? player.totalScore : "-"}</td>
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

