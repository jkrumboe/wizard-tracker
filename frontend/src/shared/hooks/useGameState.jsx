import { createContext, useContext, useState, useCallback, useEffect } from "react"
import { createGame } from "@/shared/api/gameService"
import { LocalGameStorage } from "@/shared/api"
import { stateRecovery } from "@/shared/utils/stateRecovery"
import { getSyncManager } from "@/shared/sync/syncManager"
import { getSecureRandomInt } from "@/shared/utils/secureRandom"

const LOCAL_GAMES_STORAGE_KEY = "wizardTracker_localGames"
const GameStateContext = createContext()

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
    startingDealerIndex: 0, // Starting dealer for rotation
    // Auto-upload status
    autoUploadStatus: null, // 'uploading', 'success', 'warning', null
    autoUploadMessage: null // Message to show user
  })

  // Register state recovery for game state
  useEffect(() => {
    stateRecovery.registerStateProvider(
      'gameState',
      () => gameState,
      (state) => {
        // Only restore if there's an active game
        if (state && state.gameStarted) {
          setGameState(state);
          console.debug('🔄 Recovered game state');
        }
      }
    );
    
    return () => {
      stateRecovery.unregisterStateProvider('gameState');
    };
  }, [gameState]);
  
  // Auto-persist game state on changes (with debouncing via stateRecovery)
  useEffect(() => {
    if (gameState.gameStarted && !gameState.gameFinished) {
      // Save with debouncing - will auto-save after 2 seconds of inactivity
      stateRecovery.saveState('gameState', gameState, { 
        persist: true,
        indexedDB: false // Use localStorage for game state (fast access)
      });
    }
  }, [gameState]);

  // Restore current game only when specifically accessing /game/current
  useEffect(() => {
    const restoreCurrentGame = async () => {
      try {
        // First try to recover from state recovery service (handles disconnections)
        const recoveredGame = await stateRecovery.recoverState('gameState');
        if (recoveredGame && recoveredGame.gameStarted && !recoveredGame.gameFinished) {
          setGameState(recoveredGame);
          console.debug('🔄 Recovered active game from cache');
          return;
        }
        
        // Only restore if we're on the game current route
        const currentPath = window.location.pathname;
        if (currentPath !== '/game/current') {
          return;
        }

        const games = LocalGameStorage.getAllSavedGames();
        const gameEntries = Object.entries(games);
        
        // Find the most recently saved active (paused) game
        // Exclude auto-saves and only restore explicitly saved games
        const activeGame = gameEntries
          .filter(([, game]) => 
            game.isPaused && 
            game.gameState && 
            game.gameState.gameStarted &&
            game.name && 
            !game.name.includes('Auto-save') && 
            !game.name.includes('Current Game (Auto-save)')
          )
          .sort(([,a], [,b]) => new Date(b.lastPlayed || b.dateCreated) - new Date(a.lastPlayed || a.dateCreated))[0];
        
        if (activeGame) {
          const [gameId, gameData] = activeGame;
          const restoredGameState = {
            ...gameData.gameState,
            gameId: gameId,
            isPaused: false, // Resume the game
          };
          
          setGameState(restoredGameState);
          console.debug('Restored current game:', gameId);
        }
      } catch (error) {
        console.error('Error restoring current game:', error);
      }
    };

    // Restore game state
    restoreCurrentGame();

    // Clean up old auto-saves when app starts
    const cleanupAutoSaves = () => {
      try {
        const games = LocalGameStorage.getAllSavedGames();
        const autoSaveIds = Object.entries(games)
          .filter(([, game]) => 
            game.name && 
            (game.name.includes('Auto-save') || game.name.includes('Current Game (Auto-save)'))
          )
          .map(([id]) => id);

        autoSaveIds.forEach(id => {
          try {
            LocalGameStorage.deleteGame(id);
          } catch (error) {
            console.warn('Could not delete auto-save:', id, error);
          }
        });

        if (autoSaveIds.length > 0) {
          console.debug('Cleaned up', autoSaveIds.length, 'auto-saved games');
        }
      } catch (error) {
        console.warn('Error during auto-save cleanup:', error);
      }
    };

    cleanupAutoSaves();
    restoreCurrentGame();
  }, []); // Run only once on mount

  // Auto-save during gameplay when state changes
  useEffect(() => {
    if (gameState.gameStarted && !gameState.gameFinished && !gameState.isPaused && gameState.gameId) {
      const timeoutId = setTimeout(() => {
        try {
          LocalGameStorage.autoSaveGame(gameState, gameState.gameId);
        } catch (error) {
          console.error('Error auto-saving game:', error);
        }
      }, 1000); // Debounce auto-saves by 1 second

      return () => clearTimeout(timeoutId);
    }
  }, [gameState]);

  // Add a player to the game
  const addPlayer = useCallback((customName = null, userId = null, isVerified = false) => {
    setGameState((prevState) => {
      // Use MongoDB user ID if provided, otherwise generate a unique ID based on timestamp and random number
      const uniqueId = userId || (Date.now().toString() + getSecureRandomInt(0, 999).toString());
      
      // Use the custom name if provided, otherwise leave empty
      const playerName = customName || '';

      const player = { 
        id: uniqueId, 
        name: playerName,
        isVerified: isVerified || false // Track if this player is a verified user
      };
      
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

  // Update player's name with async user lookup
  const updatePlayerNameWithLookup = useCallback(async (playerId, newName) => {
    // Import userService dynamically to avoid circular dependencies
    const { userService } = await import('@/shared/api/userService');
    
    // First, update the name immediately
    updatePlayerName(playerId, newName);
    
    // Then lookup the user asynchronously
    try {
      const result = await userService.lookupUserByUsername(newName);
      
      if (result.found && result.user) {
        // Update the player with verified user ID
        setGameState((prevState) => {
          const updatedPlayers = prevState.players.map(player => 
            player.id === playerId 
              ? { 
                  ...player, 
                  id: result.user.id, // Update to MongoDB user ID
                  name: result.user.username, // Use exact username from DB
                  isVerified: true 
                }
              : player
          );
          
          return {
            ...prevState,
            players: updatedPlayers,
          };
        });
        return { found: true, userId: result.user.id };
      } else {
        // User not found - mark as unverified
        setGameState((prevState) => {
          const updatedPlayers = prevState.players.map(player => 
            player.id === playerId ? { ...player, isVerified: false } : player
          );
          
          return {
            ...prevState,
            players: updatedPlayers,
          };
        });
        return { found: false };
      }
    } catch (error) {
      console.warn('Error looking up user:', error);
      return { found: false };
    }
  }, [updatePlayerName])

  // Reorder players (for drag and drop)
  const reorderPlayers = useCallback((startIndex, endIndex) => {
    setGameState((prevState) => {
      const players = [...prevState.players];
      const [removed] = players.splice(startIndex, 1);
      players.splice(endIndex, 0, removed);
      
      return {
        ...prevState,
        players,
      };
    });
  }, [])

  // Update game settings (dealer, caller, player order, max rounds)
  const updateGameSettings = useCallback((settings) => {
    setGameState((prevState) => {
      let updatedPlayers = prevState.players.map((player, index) => ({
        ...player,
        isDealer: index === settings.dealerIndex,
        isCaller: index === settings.callerIndex
      }));

      // Reorder players if needed
      if (settings.playerOrder) {
        updatedPlayers = settings.playerOrder.map(idx => updatedPlayers[idx]);
        
        // Also update the players in roundData to match the new order
        const updatedRoundData = prevState.roundData.map(round => ({
          ...round,
          players: settings.playerOrder.map(idx => round.players[idx])
        }));

        return {
          ...prevState,
          players: updatedPlayers,
          maxRounds: settings.maxRounds,
          roundData: updatedRoundData,
          startingDealerIndex: settings.dealerIndex
        };
      }

      return {
        ...prevState,
        players: updatedPlayers,
        maxRounds: settings.maxRounds,
        startingDealerIndex: settings.dealerIndex
      };
    });
  }, [])

    // Helper function to recalculate all scores after a round update
  const recalculateScores = useCallback((roundData, changedRoundIndex) => {
    const updatedRoundData = [...roundData];
    
    // Get the players from the first round to iterate through each player
    const players = updatedRoundData[0].players.map(p => p.id);
    
    // Update scores for each player starting from the changed round
    for (let roundIdx = changedRoundIndex; roundIdx < updatedRoundData.length; roundIdx++) {
      const currentRound = updatedRoundData[roundIdx];
      
      for (let playerId of players) {
        const playerIndex = currentRound.players.findIndex(p => p.id === playerId);
        if (playerIndex === -1) continue; // Skip if player not found
        
        const player = currentRound.players[playerIndex];
        
        // Recalculate score for this round if possible
        if (player.call !== null && player.made !== null) {
          if (player.call === player.made) {
            player.score = 20 + player.made * 10;
          } else {
            player.score = -10 * Math.abs(player.call - player.made);
          }
          
          // Calculate total score based on previous round or 0 if first round
          const prevRoundIdx = roundIdx - 1;
          const prevScore = prevRoundIdx >= 0 && updatedRoundData[prevRoundIdx].players[playerIndex].totalScore !== null 
            ? updatedRoundData[prevRoundIdx].players[playerIndex].totalScore 
            : 0;
            
          player.totalScore = prevScore + player.score;
        }
        
        // If this round has no score data but there are future rounds with scores,
        // we need to propagate the last known total score
        if ((player.score === null || player.totalScore === null) && roundIdx > 0) {
          const prevRound = updatedRoundData[roundIdx - 1];
          const prevPlayerIndex = prevRound.players.findIndex(p => p.id === playerId);
          
          if (prevPlayerIndex !== -1 && prevRound.players[prevPlayerIndex].totalScore !== null) {
            player.totalScore = prevRound.players[prevPlayerIndex].totalScore;
          }
        }
      }
    }
    
    return updatedRoundData;
  }, []);

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

  const newGameState = {
    ...gameState,
    roundData: initialRoundData,
    gameStarted: true,
    gameFinished: false, // Reset gameFinished
    referenceDate,
    isLocal: true, // Ensure this is set for local games
    mode: "Local", // Set the game mode to Local
  };

  // Create an initial auto-save for the new game
  const gameId = LocalGameStorage.saveGame(newGameState, 'Current Game (Auto-save)', true);
  
  setGameState({
    ...newGameState,
    gameId: gameId,
  });
}, [gameState]);

  // Update player's call for current round
  const updateCall = useCallback((playerId, call) => {
    setGameState((prevState) => {
      const roundIndex = prevState.currentRound - 1
      const newRoundData = [...prevState.roundData]
      const currentRound = { ...newRoundData[roundIndex] }
      const playerIndex = currentRound.players.findIndex((p) => p.id === playerId)

      if (playerIndex !== -1) {
        const updatedPlayers = [...currentRound.players]
        const player = { ...updatedPlayers[playerIndex] };
        // Allow calls up to round + 1 to support special rules like "Wolke"
        const validCall = Math.max(0, Math.min(call, currentRound.round + 1));
        
        player.call = validCall;
        
        // If player has made values already entered, recalculate score for this round
        if (player.made !== null) {
          if (player.call === player.made) {
            player.score = 20 + player.made * 10;
          } else {
            player.score = -10 * Math.abs(player.call - player.made);
          }
          
          // Update total score
          const prevRound = roundIndex > 0 ? newRoundData[roundIndex - 1] : null;
          const prevScore = prevRound && prevRound.players[playerIndex].totalScore !== null 
            ? prevRound.players[playerIndex].totalScore 
            : 0;
            
          player.totalScore = prevScore + player.score;
        }

        updatedPlayers[playerIndex] = player;
        currentRound.players = updatedPlayers;
        newRoundData[roundIndex] = currentRound;
        
        // Recalculate all following rounds to update scores
        const recalculatedRoundData = recalculateScores(newRoundData, roundIndex);

        return {
          ...prevState,
          roundData: recalculatedRoundData,
        }
      }

      return {
        ...prevState,
        roundData: newRoundData,
      }
    })
  }, [recalculateScores])

  // Update player's tricks made for current round
  const updateMade = useCallback((playerId, made) => {
    setGameState((prevState) => {
      const roundIndex = prevState.currentRound - 1;
      const newRoundData = [...prevState.roundData];
      const currentRound = { ...newRoundData[roundIndex] };
      const playerIndex = currentRound.players.findIndex((p) => p.id === playerId);

      if (playerIndex !== -1) {
        const updatedPlayers = [...currentRound.players];
        const player = { ...updatedPlayers[playerIndex] };

        // In Wizard, each player can make between 0 and the total number of cards in the round
        // The constraint is that the total of all players' made tricks should equal the round cards
        // but individual players aren't limited by what others have made
        const validMade = Math.max(0, Math.min(made, currentRound.round));

        player.made = validMade;

        // Always calculate score if made is set, even if call isn't set yet
        // This allows scores to be calculated when made values are entered early
        if (player.made !== null) {
          if (player.call !== null) {
            if (player.call === player.made) {
              // 20 points + 10 points per trick
              player.score = 20 + player.made * 10;
            } else {
              // -10 points per difference
              player.score = -10 * Math.abs(player.call - player.made);
            }
            
            // Calculate total score
            const prevRound = roundIndex > 0 ? newRoundData[roundIndex - 1] : null;
            const prevScore = prevRound && prevRound.players[playerIndex].totalScore !== null 
              ? prevRound.players[playerIndex].totalScore 
              : 0;
            player.totalScore = prevScore + player.score;
          } 
          // If call isn't set yet, we'll defer score calculation until call is set
        }

        updatedPlayers[playerIndex] = player;
        currentRound.players = updatedPlayers;
        newRoundData[roundIndex] = currentRound;
        
        // Recalculate all following rounds to update scores
        const recalculatedRoundData = recalculateScores(newRoundData, roundIndex);

        return {
          ...prevState,
          roundData: recalculatedRoundData,
        };
      }

      return {
        ...prevState,
        roundData: newRoundData,
      };
    });
  }, [recalculateScores])

  // Navigate to next round
  const nextRound = useCallback(() => {
    setGameState((prevState) => {
      if (prevState.currentRound < prevState.maxRounds) {
        // First recalculate all scores to ensure they're accurate
        const updatedRoundData = recalculateScores([...prevState.roundData], 0);
        
        // Get the current round index and data
        const currentRoundIndex = prevState.currentRound - 1;
        const currentRoundData = updatedRoundData[currentRoundIndex];
        const nextRoundIndex = currentRoundIndex + 1;
        
        // Check if the next round exists, if not create it
        let nextRoundData;
        if (updatedRoundData[nextRoundIndex]) {
          nextRoundData = {...updatedRoundData[nextRoundIndex]};
        } else {
          // Create a new round if it doesn't exist (happens when max rounds is extended)
          const roundNumber = nextRoundIndex + 1;
          nextRoundData = {
            round: roundNumber,
            players: prevState.players.map(player => ({
              id: player.id,
              name: player.name,
              call: null,
              made: null,
              score: 0,
              totalScore: 0,
              isDealer: player.isDealer || false,
              isCaller: player.isCaller || false
            }))
          };
          updatedRoundData.push(nextRoundData);
        }
        
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
          updatedRoundData[nextRoundIndex] = nextRoundData;
        }

        return {
          ...prevState,
          roundData: updatedRoundData,
          currentRound: prevState.currentRound + 1,
        }
      }
      return prevState
    })
  }, [recalculateScores])

  // Navigate to previous round
  const previousRound = useCallback(() => {
    setGameState((prevState) => {
      if (prevState.currentRound > 1) {
        // Ensure scores are up to date when navigating between rounds
        const roundData = recalculateScores(prevState.roundData, 0);
        
        return {
          ...prevState,
          roundData,
          currentRound: prevState.currentRound - 1,
        }
      }
      return prevState
    })
  }, [recalculateScores])

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
      const savedGameId = LocalGameStorage.saveGame(gameToSave, `Finished Game - ${new Date().toLocaleDateString()}`, false);

      // Always attempt cloud sync/upload when user is authenticated
      const token = localStorage.getItem('auth_token');
      if (token) {
        try {
          // Upload game to database
          const result = await createGame(gameData, savedGameId);
          
          // Mark game as uploaded in local storage
          if (result && result.game && result.game.id) {
            LocalGameStorage.markGameAsUploaded(savedGameId, result.game.id);
            console.debug('✅ Game marked as uploaded (cloud ID:', result.game.id, ')');
          }
          
          // Also trigger sync manager to ensure all pending events are synced
          try {
            const syncManager = getSyncManager();
            if (savedGameId) {
              await syncManager.syncGame(savedGameId, { force: true });
              console.debug('✅ Game synced via sync manager');
            }
          } catch (syncError) {
            console.warn('Sync manager not available or sync failed:', syncError);
          }
          
          setGameState((prevState) => ({
            ...prevState,
            autoUploadStatus: 'success',
            autoUploadMessage: '✅ Game uploaded to database!'
          }));
          setTimeout(() => {
            setGameState((prevState) => ({
              ...prevState,
              autoUploadStatus: null,
              autoUploadMessage: null
            }));
          }, 5000);
        } catch (uploadError) {
          console.warn('⚠️ Upload to database failed (game saved locally):', uploadError.message);
          const isAuthError = uploadError.message.includes('logged in') || uploadError.message.includes('session has expired');
          setGameState((prevState) => ({
            ...prevState,
            autoUploadStatus: 'warning',
            autoUploadMessage: isAuthError 
              ? '⚠️ Game saved locally - sign in to sync to cloud'
              : '⚠️ Database sync failed - game saved locally.'
          }));
          setTimeout(() => {
            setGameState((prevState) => ({
              ...prevState,
              autoUploadStatus: null,
              autoUploadMessage: null
            }));
          }, 8000);
        }
      } else {
        // User not authenticated - show message about signing in for cloud sync
        setGameState((prevState) => ({
          ...prevState,
          autoUploadStatus: 'info',
          autoUploadMessage: 'ℹ️ Game saved locally - sign in to sync to cloud'
        }));
        setTimeout(() => {
          setGameState((prevState) => ({
            ...prevState,
            autoUploadStatus: null,
            autoUploadMessage: null
          }));
        }, 6000);
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
      } else if (!shouldSave && gameState.gameId) {
        // If not saving and there's an auto-saved game, delete it
        try {
          LocalGameStorage.deleteGame(gameState.gameId);
        } catch (error) {
          console.warn('Could not delete auto-saved game:', error);
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
        updatePlayerNameWithLookup,
        reorderPlayers,
        updateGameSettings,
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