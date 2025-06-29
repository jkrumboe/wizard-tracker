import { createContext, useContext, useState, useCallback } from "react"
import { createGame } from "../services/gameService"

const LOCAL_GAMES_STORAGE_KEY = "wizardTracker_localGames"
const GameStateContext = createContext()

export function GameStateProvider({ children }) {  const [gameState, setGameState] = useState({
    players: [],
    currentRound: 1,
    maxRounds: 20,
    roundData: [],
    gameStarted: false,
    gameFinished: false,
    mode: "Local", // Default to Local mode
    isLocal: true,  // Flag to indicate local game
  })

  // Add a player to the game
  const addPlayer = useCallback((index) => {
    const player = {id: index, name: "Player " + index}
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

  // Update player's name
  const updatePlayerName = useCallback((playerId, newName) => {
    setGameState((prevState) => {
      const updatedPlayers = prevState.players.map(player => 
        player.id === playerId ? { ...player, name: newName } : player
      );
      
      return {
        ...prevState,
        players: updatedPlayers,
      };
    });
  }, [])
  // Start a new game
  const startGame = useCallback(() => {
  if (gameState.players.length < 2) return;

  const referenceDate = new Date();
  const initialRoundData = [];
  for (let i = 1; i <= gameState.maxRounds; i++) {
    initialRoundData.push({
      round: i,
      cards: i <= 10 ? i : 20 - i,
      players: gameState.players.map((player) => ({
        id: player.id,
        name: player.name,
        call: null,
        made: null,
        score: null,
        totalScore: 0, // Initialize all rounds to start with 0
      })),
    });
  }

  setGameState((prevState) => ({
    ...prevState,
    roundData: initialRoundData,
    gameStarted: true,
    gameFinished: false, // Reset gameFinished
    referenceDate,
    isLocal: true, // Ensure this is set for local games
    mode: "Local", // Set the game mode to Local
  }));
}, [gameState.players, gameState.maxRounds]);

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
          }          // Calculate total score
          const prevRound = roundIndex > 0 ? newRoundData[roundIndex - 1] : null
          const prevScore = prevRound && prevRound.players[playerIndex].totalScore !== null 
            ? prevRound.players[playerIndex].totalScore 
            : 0
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
        // Get the current round index and data
        const currentRoundIndex = prevState.currentRound - 1;
        const currentRoundData = prevState.roundData[currentRoundIndex];
        const nextRoundIndex = currentRoundIndex + 1;
        const newRoundData = [...prevState.roundData];
        const nextRoundData = {...newRoundData[nextRoundIndex]};
        
        // Update the totalScore for each player in the next round
        if (nextRoundData && nextRoundData.players) {
          const nextRoundPlayers = [...nextRoundData.players];
          
          nextRoundPlayers.forEach((player) => {
            // Find the corresponding player in the current round
            const currentRoundPlayer = currentRoundData.players.find(p => p.id === player.id);
            
            // If we have a valid totalScore from the current round, copy it to the next round
            if (currentRoundPlayer && currentRoundPlayer.totalScore !== null) {
              player.totalScore = currentRoundPlayer.totalScore;
            } else if (currentRoundIndex === 0) {
              // If this is the first round and somehow the totalScore is not set
              player.totalScore = 0;
            }
          });
          
          nextRoundData.players = nextRoundPlayers;
          newRoundData[nextRoundIndex] = nextRoundData;
        }

        return {
          ...prevState,
          roundData: newRoundData,
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
  }, [])  // Load local games from localStorage
  const loadLocalGames = useCallback(() => {
    try {
      const storedGames = localStorage.getItem(LOCAL_GAMES_STORAGE_KEY);
      return storedGames ? JSON.parse(storedGames) : [];
    } catch (error) {
      console.error("Error loading local games:", error);
      return [];
    }
  }, []);

  // Save local games to localStorage
  const saveLocalGames = useCallback((games) => {
    try {
      localStorage.setItem(LOCAL_GAMES_STORAGE_KEY, JSON.stringify(games));
    } catch (error) {
      console.error("Error saving local games:", error);
    }
  }, []);

  // Finish the game and save results
  const finishGame = useCallback(async () => {
    try {
      // Prepare game data for saving
      const lastRound = gameState.roundData[gameState.maxRounds - 1];
      const finalScores = {};
      let winnerId = null;
      let maxScore = Number.NEGATIVE_INFINITY;
      const duration = Math.floor((new Date() - new Date(gameState.referenceDate)) / 1000); // Duration in seconds

      lastRound.players.forEach((player) => {
        finalScores[player.id] = player.totalScore;
        if (player.totalScore > maxScore) {
          maxScore = player.totalScore;
          winnerId = player.id;
        }
      });

      const gameData = {
        id: Date.now().toString(), // Generate a local ID
        created_at: new Date().toISOString(),
        player_ids: gameState.players.map((p) => p.id),
        players: gameState.players, // Store the full player data for local games
        winner_id: winnerId,
        final_scores: finalScores,
        round_data: gameState.roundData,
        duration_seconds: duration,
        game_mode: gameState.mode || "Local",
        total_rounds: gameState.maxRounds,
        is_local: true
      };

      // Check if it's a local game or should be saved to the database
      if (gameState.mode === "Local" || gameState.isLocal) {
        // Save game to local storage
        const localGames = loadLocalGames();
        localGames.push(gameData);
        saveLocalGames(localGames);
      } else {
        // Save game data to database using API
        await createGame(gameData);
      }

      setGameState((prevState) => ({
        ...prevState,
        gameFinished: true,
      }));

      return true;
    } catch (error) {
      console.error("Error saving game:", error);
      return false;
    }
  }, [gameState, loadLocalGames, saveLocalGames]);
  // Reset game state
  const resetGame = useCallback(() => {
    setGameState({
      players: [],
      currentRound: 1,
      maxRounds: 20,
      roundData: [],
      gameStarted: false,
      gameFinished: false,
      mode: "Local",
      isLocal: true,
    })
  }, [])

  const setMaxRounds = (rounds) => {
    setGameState((prev) => ({ ...prev, maxRounds: rounds }))
  }
  const setMode = (mode) => {
    setGameState((prevState) => ({
      ...prevState,
      mode,
      isLocal: mode === "Local", // Update the isLocal flag based on the mode
    }));
  };

  // Function to get local games
  const getLocalGames = useCallback(() => {
    return loadLocalGames();
  }, [loadLocalGames]);

  // Function to remove a local game from storage
  const removeLocalGame = useCallback((gameId) => {
    const games = loadLocalGames();
    const updatedGames = games.filter(game => game.id !== gameId);
    saveLocalGames(updatedGames);
    return updatedGames;
  }, [loadLocalGames, saveLocalGames]);

  return (
    <GameStateContext.Provider
      value={{
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
        setMaxRounds,
        setMode,
        updatePlayerName,
        getLocalGames,
        removeLocalGame,
      }}
    >
      {children}
    </GameStateContext.Provider>
  )
}

export function useGameStateContext() {
  const context = useContext(GameStateContext)
  if (!context) {
    throw new Error("useGameStateContext must be used within a GameStateProvider")
  }
  return context
}