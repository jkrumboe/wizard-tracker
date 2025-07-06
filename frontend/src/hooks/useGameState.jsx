import { createContext, useContext, useState, useCallback } from "react"
import { createGame } from "../services/gameService"
import { LocalGameStorage } from "../services/localGameStorage"

const LOCAL_GAMES_STORAGE_KEY = "wizardTracker_localGames"
const GameStateContext = createContext()

// List of real names to use for random player names
const PLAYER_NAMES = [
  "Alex", "Bailey", "Charlie", "Dana", "Eli", "Frankie", "Gray", "Harper",
  "Isa", "Jordan", "Kai", "Lee", "Morgan", "Nico", "Ollie", "Parker",
  "Quinn", "Reese", "Sage", "Taylor", "Viv", "Winter", "Yuri", "Zoe",
  "Avery", "Blake", "Casey", "Drew", "Ellis", "Finley", "Greer", "Hayden",
  "Indigo", "Jules", "Kelsey", "Lennox", "Marley", "Nova", "Oakley", "Phoenix",
  "River", "Skyler", "Tatum", "Utah", "Val", "Wren", "Xen", "Yael",
  "Robin", "Jamie", "Riley", "Emery", "Ash", "Shawn", "Jesse", "Kendall"
]

export function GameStateProvider({ children }) {
  const [gameState, setGameState] = useState({
    players: [],
    currentRound: 1,
    maxRounds: 20,
    roundData: [],
    gameStarted: false,
    gameFinished: false,
    mode: "Local", // Default to Local mode
    isLocal: true,  // Flag to indicate local game
    gameId: null,   // Current game ID for saving
    isPaused: false, // Track if game is paused
    gameName: null,  // Custom game name
  })

  // Add a player to the game
  const addPlayer = useCallback(() => {
    setGameState((prevState) => {
      // Generate a unique ID based on timestamp and random number
      const uniqueId = Date.now().toString() + Math.floor(Math.random() * 1000).toString();
      
      // Get currently used names in the game
      const usedNames = prevState.players.map(player => player.name);
      
      // Filter out names that are already in use
      const availableNames = PLAYER_NAMES.filter(name => !usedNames.includes(name));
      
      // If we're out of unique names (unlikely but possible), add a number to an existing name
      let randomName;
      if (availableNames.length === 0) {
        // Take a random name and add a number to it
        randomName = PLAYER_NAMES[Math.floor(Math.random() * PLAYER_NAMES.length)] + 
          (Math.floor(Math.random() * 100) + 1);
      } else {
        // Select a random name from the available names
        randomName = availableNames[Math.floor(Math.random() * availableNames.length)];
      }

      const player = { id: uniqueId, name: randomName };
      
      // Debug log
      console.log("Adding player:", player);
      console.log("Current players:", prevState.players);
      
      return {
        ...prevState,
        players: [...prevState.players, player],
      };
    });
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
  }, [])

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
        // Save game to local storage using LocalGameStorage service instead of direct localStorage access
        // This ensures compatibility with our new storage format
        const gameToSave = {
          ...gameState,
          gameFinished: true, // Mark the game as finished
          isPaused: false,    // Make sure it's not marked as paused
          winner_id: winnerId,
          final_scores: finalScores,
          player_ids: gameState.players.map((p) => p.id),
          created_at: new Date().toISOString(),
          duration_seconds: duration,
          total_rounds: gameState.maxRounds,
        };
        LocalGameStorage.saveGame(gameToSave, `Finished Game - ${new Date().toLocaleDateString()}`, false);
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
  }, [gameState]);
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

  const setMaxRounds = useCallback((rounds) => {
    setGameState((prev) => ({ ...prev, maxRounds: rounds }))
  }, []);
  
  const setMode = useCallback((mode) => {
    setGameState((prevState) => ({
      ...prevState,
      mode,
      isLocal: mode === "Local", // Update the isLocal flag based on the mode
    }));
  }, []);

  // Function to get local games - use LocalGameStorage instead
  const getLocalGames = useCallback(() => {
    return LocalGameStorage.getSavedGamesList();
  }, []);

  // Function to remove a local game from storage - use LocalGameStorage instead
  const removeLocalGame = useCallback((gameId) => {
    LocalGameStorage.deleteGame(gameId);
    return LocalGameStorage.getSavedGamesList();
  }, []);

  // Save the current game
  const saveGame = useCallback((customName = null, isPaused = true) => {
    try {
      const gameId = LocalGameStorage.saveGame(gameState, customName, isPaused);
      setGameState(prevState => ({
        ...prevState,
        gameId,
        gameName: customName || prevState.gameName
      }));
      return { success: true, gameId };
    } catch (error) {
      console.error("Error saving game:", error);
      return { success: false, error: error.message };
    }
  }, [gameState]);

  // Auto-save the current game (for continuous saving during gameplay)
  const autoSaveGame = useCallback(() => {
    if (gameState.gameId && gameState.gameStarted && !gameState.gameFinished) {
      try {
        LocalGameStorage.autoSaveGame(gameState, gameState.gameId);
      } catch (error) {
        console.error("Error auto-saving game:", error);
      }
    }
  }, [gameState]);

  // Pause the current game
  const pauseGame = useCallback((customName = null) => {
    try {
      let gameId = gameState.gameId;
      
      // If no gameId exists, create a new save
      if (!gameId) {
        gameId = LocalGameStorage.saveGame(gameState, customName, true); // Set isPaused to true
      } else {
        // Update existing save
        LocalGameStorage.autoSaveGame(gameState, gameId);
        if (customName) {
          LocalGameStorage.updateGameMetadata(gameId, { name: customName });
        }
      }

      setGameState(prevState => ({
        ...prevState,
        isPaused: true,
        gameId,
        gameName: customName || prevState.gameName
      }));

      return { success: true, gameId };
    } catch (error) {
      console.error("Error pausing game:", error);
      return { success: false, error: error.message };
    }
  }, [gameState]);

  // Resume a paused game
  const resumeGame = useCallback((gameId) => {
    try {
      const loadedGameState = LocalGameStorage.loadGame(gameId);
      if (loadedGameState) {
        setGameState({
          ...loadedGameState,
          isPaused: false,
          gameId
        });
        return { success: true };
      } else {
        return { success: false, error: "Game not found" };
      }
    } catch (error) {
      console.error("Error resuming game:", error);
      return { success: false, error: error.message };
    }
  }, []);

  // Load a saved game (different from resume - this replaces current state)
  const loadSavedGame = useCallback((gameId) => {
    try {
      const loadedGameState = LocalGameStorage.loadGame(gameId);
      if (loadedGameState) {
        setGameState({
          ...loadedGameState,
          gameId
        });
        return { success: true };
      } else {
        return { success: false, error: "Game not found" };
      }
    } catch (error) {
      console.error("Error loading saved game:", error);
      return { success: false, error: error.message };
    }
  }, []);

  // Get all saved games
  const getSavedGames = useCallback(() => {
    try {
      return LocalGameStorage.getSavedGamesList();
    } catch (error) {
      console.error("Error getting saved games:", error);
      return [];
    }
  }, []);

  // Delete a saved game
  const deleteSavedGame = useCallback((gameId) => {
    try {
      LocalGameStorage.deleteGame(gameId);
      return { success: true };
    } catch (error) {
      console.error("Error deleting saved game:", error);
      return { success: false, error: error.message };
    }
  }, []);

  // Leave the current game (with option to save)
  const leaveGame = useCallback((shouldSave = true, customName = null) => {
    try {
      if (shouldSave && gameState.gameStarted && !gameState.gameFinished) {
        const saveResult = saveGame(customName);
        if (!saveResult.success) {
          return saveResult;
        }
      }

      // Reset to initial state
      setGameState({
        players: [],
        currentRound: 1,
        maxRounds: 20,
        roundData: [],
        gameStarted: false,
        gameFinished: false,
        mode: "Local",
        isLocal: true,
        gameId: null,
        isPaused: false,
        gameName: null,
      });

      return { success: true };
    } catch (error) {
      console.error("Error leaving game:", error);
      return { success: false, error: error.message };
    }
  }, [gameState, saveGame]);

  // Check if current game has unsaved changes
  const hasUnsavedChanges = useCallback(() => {
    return gameState.gameStarted && !gameState.gameFinished && !gameState.gameId;
  }, [gameState]);

  // Set custom game name
  const setGameName = useCallback((name) => {
    setGameState(prevState => ({
      ...prevState,
      gameName: name
    }));
  }, []);

  // Auto-save effect - save game state periodically during active gameplay
  const enableAutoSave = useCallback(() => {
    if (gameState.gameStarted && !gameState.gameFinished && !gameState.isPaused) {
      autoSaveGame();
    }
  }, [gameState.gameStarted, gameState.gameFinished, gameState.isPaused, autoSaveGame]);

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
        saveGame,
        autoSaveGame,
        pauseGame,
        resumeGame,
        loadSavedGame,
        getSavedGames,
        deleteSavedGame,
        leaveGame,
        hasUnsavedChanges,
        setGameName,
        enableAutoSave,
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