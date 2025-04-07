"use client"

import { useState, useCallback } from "react"
import { createGame } from "../services/gameService"

export function useGameState() {
  const [gameState, setGameState] = useState({
    players: [],
    currentRound: 1,
    maxRounds: 10,
    roundData: [],
    gameStarted: false,
    gameFinished: false,
  })

  // Add a player to the game
  const addPlayer = useCallback((player) => {
    setGameState((prevState) => ({
      ...prevState,
      players: [...prevState.players, player],
    }))
  }, [])

  // Remove a player from the game
  const removePlayer = useCallback((playerId) => {
    setGameState((prevState) => ({
      ...prevState,
      players: prevState.players.filter((p) => p.id !== playerId),
    }))
  }, [])

  // Start a new game
  const startGame = useCallback(() => {
    if (gameState.players.length < 2) return

    // Initialize round data
    const initialRoundData = []
    for (let i = 1; i <= gameState.maxRounds; i++) {
      initialRoundData.push({
        round: i,
        cards: i <= 10 ? i : 20 - i, // Wizard card distribution
        players: gameState.players.map((player) => ({
          id: player.id,
          name: player.name,
          call: null,
          made: null,
          score: null,
          totalScore: i === 1 ? 0 : null, // Initialize with 0 for first round
        })),
      })
    }

    setGameState((prevState) => ({
      ...prevState,
      roundData: initialRoundData,
      gameStarted: true,
    }))
  }, [gameState.players, gameState.maxRounds])

  // Update player's call for current round
  const updateCall = useCallback((playerId, call) => {
    setGameState((prevState) => {
      const roundIndex = prevState.currentRound - 1
      const newRoundData = [...prevState.roundData]
      const currentRound = { ...newRoundData[roundIndex] }
      const playerIndex = currentRound.players.findIndex((p) => p.id === playerId)

      if (playerIndex !== -1) {
        const updatedPlayers = [...currentRound.players]
        updatedPlayers[playerIndex] = {
          ...updatedPlayers[playerIndex],
          call: Math.max(0, Math.min(call, currentRound.cards)),
        }

        currentRound.players = updatedPlayers
        newRoundData[roundIndex] = currentRound
      }

      return {
        ...prevState,
        roundData: newRoundData,
      }
    })
  }, [])

  // Update player's tricks made for current round
  const updateMade = useCallback((playerId, made) => {
    setGameState((prevState) => {
      const roundIndex = prevState.currentRound - 1
      const newRoundData = [...prevState.roundData]
      const currentRound = { ...newRoundData[roundIndex] }
      const playerIndex = currentRound.players.findIndex((p) => p.id === playerId)

      if (playerIndex !== -1) {
        const updatedPlayers = [...currentRound.players]
        const player = { ...updatedPlayers[playerIndex] }

        player.made = Math.max(0, Math.min(made, currentRound.cards))

        // Calculate score
        if (player.call !== null && player.made !== null) {
          if (player.call === player.made) {
            // 20 points + 10 points per trick
            player.score = 20 + player.made * 10
          } else {
            // -10 points per difference
            player.score = -10 * Math.abs(player.call - player.made)
          }

          // Calculate total score
          const prevRound = roundIndex > 0 ? newRoundData[roundIndex - 1] : null
          const prevScore = prevRound ? prevRound.players[playerIndex].totalScore : 0
          player.totalScore = prevScore + player.score
        }

        updatedPlayers[playerIndex] = player
        currentRound.players = updatedPlayers
        newRoundData[roundIndex] = currentRound
      }

      return {
        ...prevState,
        roundData: newRoundData,
      }
    })
  }, [])

  // Navigate to next round
  const nextRound = useCallback(() => {
    setGameState((prevState) => {
      if (prevState.currentRound < prevState.maxRounds) {
        return {
          ...prevState,
          currentRound: prevState.currentRound + 1,
        }
      }
      return prevState
    })
  }, [])

  // Navigate to previous round
  const previousRound = useCallback(() => {
    setGameState((prevState) => {
      if (prevState.currentRound > 1) {
        return {
          ...prevState,
          currentRound: prevState.currentRound - 1,
        }
      }
      return prevState
    })
  }, [])

  // Finish the game and save results
  const finishGame = useCallback(async () => {
    try {
      // Prepare game data for saving
      const lastRound = gameState.roundData[gameState.maxRounds - 1]
      const finalScores = {}
      let winnerId = null
      let maxScore = Number.NEGATIVE_INFINITY

      lastRound.players.forEach((player) => {
        finalScores[player.id] = player.totalScore
        if (player.totalScore > maxScore) {
          maxScore = player.totalScore
          winnerId = player.id
        }
      })

      const gameData = {
        date: new Date().toISOString().split("T")[0],
        players: gameState.players.map((p) => p.id),
        winner: winnerId,
        scores: finalScores,
        rounds: gameState.roundData,
      }

      // Save game data
      await createGame(gameData)

      setGameState((prevState) => ({
        ...prevState,
        gameFinished: true,
      }))

      return true
    } catch (error) {
      console.error("Error saving game:", error)
      return false
    }
  }, [gameState])

  // Reset game state
  const resetGame = useCallback(() => {
    setGameState({
      players: [],
      currentRound: 1,
      maxRounds: 10,
      roundData: [],
      gameStarted: false,
      gameFinished: false,
    })
  }, [])

  return {
    gameState,
    addPlayer,
    removePlayer,
    startGame,
    updateCall,
    updateMade,
    nextRound,
    previousRound,
    finishGame,
    resetGame,
    setMaxRounds: (rounds) => setGameState((prev) => ({ ...prev, maxRounds: rounds })),
  }
}

