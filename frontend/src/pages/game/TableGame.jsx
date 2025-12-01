import React, { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeftIcon, ArrowRightIcon, XIcon, ArrowLeftCircleIcon, SaveIcon } from "../../components/ui/Icon";
import { LocalTableGameTemplate, LocalTableGameStorage } from "../../shared/api";
import GameTemplateSelector from "../../components/game/GameTemplateSelector";
import DeleteConfirmationModal from "../../components/modals/DeleteConfirmationModal";
import { useUser } from "../../shared/hooks/useUser";
import "../../styles/components/TableGame.css";

const MIN_PLAYERS = 2;

const TableGame = () => {
  const { user } = useUser(); // Get the logged-in user
  const { id } = useParams();
  const navigate = useNavigate();
  
  const [rows, setRows] = useState(() => {
    const isSmallLandscape = window.matchMedia('(orientation: landscape) and (max-width: 950px)').matches;
    const initialRows = isSmallLandscape ? 4 : 10;
    console.log('Initial rows state:', { isSmallLandscape, initialRows, windowWidth: window.innerWidth, orientation: window.screen.orientation?.type });
    return initialRows;
  });
  
  const [activeTab, setActiveTab] = useState('table'); // 'table' or 'scoreboard'
  const [showDeletePlayerConfirm, setShowDeletePlayerConfirm] = useState(false);
  const [playerToDelete, setPlayerToDelete] = useState(null);
  
  // Game settings
  const [targetNumber, setTargetNumber] = useState(null);
  const [lowIsBetter, setLowIsBetter] = useState(false);
  const [gameFinished, setGameFinished] = useState(false);
  
  // Initialize players with the logged-in user as the first player if available
  const getDefaultPlayers = () => {
    const firstPlayerName = user?.username || user?.name || "Player 1";
    return [
      { name: firstPlayerName, points: [] },
      { name: "Player 2", points: [] },
      { name: "Player 3", points: [] }
    ];
  };
  
  const [players, setPlayers] = useState(getDefaultPlayers());
  const [showTemplateSelector, setShowTemplateSelector] = useState(true);
  const [currentGameName, setCurrentGameName] = useState("");
  const [currentGameId, setCurrentGameId] = useState(() => {
    // Initialize from sessionStorage to survive HMR reloads
    return sessionStorage.getItem('currentTableGameId') || null;
  });

  // Refs to store current values for auto-save on unmount
  const playersRef = useRef(players);
  const rowsRef = useRef(rows);
  const currentGameNameRef = useRef(currentGameName);
  const currentGameIdRef = useRef(currentGameId);
  const showTemplateSelectorRef = useRef(showTemplateSelector);
  const targetNumberRef = useRef(targetNumber);
  const lowIsBetterRef = useRef(lowIsBetter);
  const gameFinishedRef = useRef(gameFinished);

  // Persist game ID to sessionStorage whenever it changes
  useEffect(() => {
    if (currentGameId) {
      sessionStorage.setItem('currentTableGameId', currentGameId);
    } else {
      sessionStorage.removeItem('currentTableGameId');
    }
  }, [currentGameId]);

  // Persist game state to sessionStorage to survive HMR reloads
  useEffect(() => {
    if (!showTemplateSelector && currentGameId) {
      const gameState = {
        players,
        rows,
        currentGameName,
        currentGameId,
        targetNumber,
        lowIsBetter,
        gameFinished
      };
      sessionStorage.setItem('currentTableGameState', JSON.stringify(gameState));
    }
  }, [players, rows, currentGameName, currentGameId, showTemplateSelector, targetNumber, lowIsBetter, gameFinished]);

  // Restore game state from sessionStorage on mount (after HMR)
  useEffect(() => {
    const savedState = sessionStorage.getItem('currentTableGameState');
    
    // Only restore if:
    // 1. We have saved state
    // 2. We're on the template selector
    // 3. There's NO gameId in URL (meaning this is HMR restore, not a fresh navigation)
    if (savedState && showTemplateSelector && !id) {
      try {
        const gameState = JSON.parse(savedState);
        // Only restore if we have valid data
        if (gameState.currentGameId && gameState.players) {
          setPlayers(gameState.players);
          // Check if we should adjust rows based on current orientation
          const isSmallLandscape = window.matchMedia('(orientation: landscape) and (max-width: 950px)').matches;
          const hasData = gameState.players.some(player => 
            player.points.some(point => point !== "" && point !== undefined && point !== null)
          );
          // Only adjust rows if no data or use saved rows
          let restoredRows;
          if (hasData) {
            restoredRows = gameState.rows;
          } else {
            restoredRows = isSmallLandscape ? 4 : 10;
          }
          console.log('Restoring game state:', { isSmallLandscape, hasData, savedRows: gameState.rows, restoredRows });
          setRows(restoredRows);
          setCurrentGameName(gameState.currentGameName);
          setCurrentGameId(gameState.currentGameId);
          setTargetNumber(gameState.targetNumber || null);
          setLowIsBetter(gameState.lowIsBetter || false);
          setGameFinished(gameState.gameFinished || false);
          setShowTemplateSelector(false);
          setActiveTab('table'); // Always start at table view
          console.debug('🔄 Restored game state from session after HMR');
        }
      } catch (error) {
        console.error('Failed to restore game state:', error);
      }
    }
  }, []); // Only run once on mount

  // Check for gameId in URL parameters and load that game
  useEffect(() => {
    if (id) {
      // Only load if we're currently showing the template selector AND don't have this game loaded already
      if (showTemplateSelector || currentGameId !== id) {
        // Load the game from storage
        const savedGame = LocalTableGameStorage.getTableGameById(id);
        if (savedGame) {
          const gameData = savedGame.gameData;
          
          // Ensure players have proper structure with points arrays
          const loadedPlayers = (gameData.players || []).map(player => ({
            name: player.name || 'Unknown',
            points: Array.isArray(player.points) ? player.points : []
          }));
          
          // Set all the state to display the game
          setPlayers(loadedPlayers);
          setRows(gameData.rows || 10);
          setShowTemplateSelector(false);
          setActiveTab('table');
          setCurrentGameName(savedGame.name);
          setCurrentGameId(savedGame.id);
          
          // Try to sync with template settings first
          const templates = LocalTableGameTemplate.getAllTemplates();
          const matchingTemplate = Object.values(templates).find(t => t.name === savedGame.name);
          
          if (matchingTemplate) {
            setTargetNumber(matchingTemplate.targetNumber || null);
            setLowIsBetter(matchingTemplate.lowIsBetter || false);
            console.debug(`📋 Synced game settings from template: target=${matchingTemplate.targetNumber}, lowIsBetter=${matchingTemplate.lowIsBetter}`);
          } else {
            setTargetNumber(gameData.targetNumber || null);
            setLowIsBetter(gameData.lowIsBetter || false);
            console.debug(`📋 Using saved game settings: target=${gameData.targetNumber}, lowIsBetter=${gameData.lowIsBetter}`);
          }
          
          setGameFinished(savedGame.gameFinished || false);
          console.debug(`Loaded game: "${savedGame.name}" (ID: ${savedGame.id}), players: ${loadedPlayers.length}, rows: ${gameData.rows || 10}, finished: ${savedGame.gameFinished}`);
        } else {
          console.error(`Game with ID ${id} not found in storage`);
        }
      }
    } else {
      // No ID in URL - show template selector if we're currently viewing a game
      if (!showTemplateSelector) {
        setShowTemplateSelector(true);
        setCurrentGameName("");
        setCurrentGameId(null);
        setTargetNumber(null);
        setLowIsBetter(false);
        setGameFinished(false);
        sessionStorage.removeItem('currentTableGameId');
        sessionStorage.removeItem('currentTableGameState');
      }
    }
  }, [id, showTemplateSelector, currentGameId]);

  // Listen for orientation changes and adjust rows
  useEffect(() => {
    const mediaQuery = window.matchMedia('(orientation: landscape) and (max-width: 950px)');
    const handleOrientationChange = (e) => {
      // Only update rows if we're starting a new game (no data entered yet)
      const hasData = players.some(player => 
        player.points.some(point => point !== "" && point !== undefined && point !== null)
      );
      if (!hasData) {
        setRows(e.matches ? 4 : 10);
      }
    };
    
    mediaQuery.addEventListener('change', handleOrientationChange);
    return () => mediaQuery.removeEventListener('change', handleOrientationChange);
  }, [players]);

  // Update refs when values change
  useEffect(() => {
    playersRef.current = players;
    rowsRef.current = rows;
    currentGameNameRef.current = currentGameName;
    currentGameIdRef.current = currentGameId;
    showTemplateSelectorRef.current = showTemplateSelector;
    targetNumberRef.current = targetNumber;
    lowIsBetterRef.current = lowIsBetter;
    gameFinishedRef.current = gameFinished;
  }, [players, rows, currentGameName, currentGameId, showTemplateSelector, targetNumber, lowIsBetter, gameFinished]);

  // Sync game settings with template when game is active or template changes
  useEffect(() => {
    const syncSettingsFromTemplate = () => {
      if (!showTemplateSelector && currentGameName) {
        // Find the template for the current game
        const templates = LocalTableGameTemplate.getAllTemplates();
        const matchingTemplate = Object.values(templates).find(t => t.name === currentGameName);
        
        if (matchingTemplate) {
          // Update game settings if template settings have changed
          const templateTarget = matchingTemplate.targetNumber || null;
          const templateLowIsBetter = matchingTemplate.lowIsBetter || false;
          
          if (templateTarget !== targetNumber || templateLowIsBetter !== lowIsBetter) {
            setTargetNumber(templateTarget);
            setLowIsBetter(templateLowIsBetter);
            console.debug(`🔄 Updated game settings from template: target=${templateTarget}, lowIsBetter=${templateLowIsBetter}`);
          }
        }
      }
    };

    // Listen for template update events
    window.addEventListener('templateUpdated', syncSettingsFromTemplate);
    
    // Also check on window focus (in case template was edited in another tab)
    window.addEventListener('focus', syncSettingsFromTemplate);
    
    return () => {
      window.removeEventListener('templateUpdated', syncSettingsFromTemplate);
      window.removeEventListener('focus', syncSettingsFromTemplate);
    };
  }, [currentGameName, showTemplateSelector, targetNumber, lowIsBetter]);

  // Debug: Log when players data changes
  useEffect(() => {
    if (!showTemplateSelector) {
      const hasData = players.some(player => 
        player.points.some(point => point !== "" && point !== undefined && point !== null)
      );
      console.debug('📝 Table game state:', {
        gameName: currentGameName,
        gameId: currentGameId,
        playersCount: players.length,
        hasData: hasData,
        playerPoints: players.map(p => ({
          name: p.name,
          points: p.points.filter(pt => pt !== "" && pt !== undefined && pt !== null).length
        }))
      });
    }
  }, [players, currentGameName, currentGameId, showTemplateSelector]);

  // Periodic auto-save every 5 seconds when there's data
  useEffect(() => {
    if (showTemplateSelector) return; // Don't auto-save on template selector
    
    const autoSaveInterval = setInterval(() => {
      const hasData = players.some(player => 
        player.points.some(point => point !== "" && point !== undefined && point !== null)
      );
      
      if (hasData) {
        try {
          const gameData = {
            players: players,
            rows: rows,
            timestamp: new Date().toISOString(),
            targetNumber: targetNumber,
            lowIsBetter: lowIsBetter,
            gameFinished: gameFinished,
            gameName: currentGameName
          };
          
          const name = currentGameName || `Table Game - ${new Date().toLocaleDateString()}`;
          
          // If no game ID, create a new save
          if (!currentGameId) {
            const newGameId = LocalTableGameStorage.saveTableGame(gameData, name);
            setCurrentGameId(newGameId);
            console.debug(`💾 Created initial save: "${name}" (ID: ${newGameId})`);
          } else if (LocalTableGameStorage.tableGameExists(currentGameId)) {
            LocalTableGameStorage.updateTableGame(currentGameId, {
              gameData: gameData,
              lastPlayed: new Date().toISOString(),
              name: name,
              targetNumber: targetNumber,
              lowIsBetter: lowIsBetter,
              gameFinished: gameFinished
            });
            console.debug(`💾 Periodic auto-save: "${name}" (ID: ${currentGameId}, finished: ${gameFinished})`);
          }
        } catch (error) {
          console.error('❌ Periodic auto-save failed:', error);
        }
      }
    }, 5000); // Save every 5 seconds
    
    return () => clearInterval(autoSaveInterval);
  }, [players, rows, currentGameName, currentGameId, showTemplateSelector, targetNumber, lowIsBetter, gameFinished]);

  // Auto-save game when navigating away or closing tab
  useEffect(() => {
    // Mark that we've visited the table game page
    sessionStorage.setItem('tableGameVisited', 'true');

    // Cleanup function runs when component unmounts (navigation away)
    return () => {
      // Always save when leaving, regardless of conditions (like pressing Save button)
      const currentPlayers = playersRef.current;
      const currentRows = rowsRef.current;
      const currentName = currentGameNameRef.current;
      const currentId = currentGameIdRef.current;
      const isShowingTemplateSelector = showTemplateSelectorRef.current;
      const currentTargetNumber = targetNumberRef.current;
      const currentLowIsBetter = lowIsBetterRef.current;
      const currentGameFinished = gameFinishedRef.current;
      
      console.debug('💾 Silent save on unmount:', {
        currentId,
        isShowingTemplateSelector,
        playersCount: currentPlayers.length
      });
      
      // Save if we have a game in progress (not on template selector)
      if (!isShowingTemplateSelector) {
        try {
          const gameData = {
            players: currentPlayers,
            rows: currentRows,
            timestamp: new Date().toISOString(),
            targetNumber: currentTargetNumber,
            lowIsBetter: currentLowIsBetter,
            gameFinished: currentGameFinished,
            gameName: currentName
          };

          const name = currentName || `Table Game - ${new Date().toLocaleDateString()}`;
          
          // If no game ID, create a new save
          if (!currentId) {
            const newGameId = LocalTableGameStorage.saveTableGame(gameData, name);
            console.debug(`✅ Created save on navigation: "${name}" (ID: ${newGameId})`);
          } else if (LocalTableGameStorage.tableGameExists(currentId)) {
            // Update the existing game
            LocalTableGameStorage.updateTableGame(currentId, {
              gameData: gameData,
              lastPlayed: new Date().toISOString(),
              name: name,
              targetNumber: currentTargetNumber,
              lowIsBetter: currentLowIsBetter,
              gameFinished: currentGameFinished
            });
            console.debug(`✅ Silent save on navigation: "${name}" (ID: ${currentId}, finished: ${currentGameFinished})`);
          }
        } catch (error) {
          console.error('❌ Failed to save on navigation:', error);
        }
      }
    };
  }, []); // Empty dependency array - only set up once

  // Auto-save on browser close/refresh
  useEffect(() => {
    const handleBeforeUnload = () => {
      const currentPlayers = playersRef.current;
      const currentRows = rowsRef.current;
      const currentName = currentGameNameRef.current;
      const currentId = currentGameIdRef.current;
      const isShowingTemplateSelector = showTemplateSelectorRef.current;
      const currentTargetNumber = targetNumberRef.current;
      const currentLowIsBetter = lowIsBetterRef.current;
      const currentGameFinished = gameFinishedRef.current;
      
      console.debug('💾 Silent save on browser close:', {
        isShowingTemplateSelector,
        currentId
      });
      
      // Save if we have a game in progress (not on template selector)
      if (!isShowingTemplateSelector) {
        try {
          const gameData = {
            players: currentPlayers,
            rows: currentRows,
            timestamp: new Date().toISOString(),
            targetNumber: currentTargetNumber,
            lowIsBetter: currentLowIsBetter,
            gameFinished: currentGameFinished,
            gameName: currentName
          };

          const name = currentName || `Table Game - ${new Date().toLocaleDateString()}`;
          
          // If no game ID, create a new save
          if (!currentId) {
            const newGameId = LocalTableGameStorage.saveTableGame(gameData, name);
            console.debug(`✅ Created save on browser close: "${name}" (ID: ${newGameId})`);
          } else if (LocalTableGameStorage.tableGameExists(currentId)) {
            // Update the existing game
            LocalTableGameStorage.updateTableGame(currentId, {
              gameData: gameData,
              lastPlayed: new Date().toISOString(),
              name: name,
              targetNumber: currentTargetNumber,
              lowIsBetter: currentLowIsBetter,
              gameFinished: currentGameFinished
            });
            console.debug(`✅ Silent save on browser close: "${name}" (ID: ${currentId}, finished: ${currentGameFinished})`);
          }
        } catch (error) {
          console.error('❌ Failed to save on browser close:', error);
        }
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []); // Empty dependency array - set up once

  const handleNameChange = (idx, value) => {
    const updated = [...players];
    updated[idx].name = value;
    setPlayers(updated);
  };

  const handlePointChange = (playerIdx, rowIdx, value) => {
    const updated = [...players];
    if (value === "" || value === "-") {
      // Allow empty string or lone minus sign for typing negative numbers
      updated[playerIdx].points[rowIdx] = value === "" ? "" : value;
    } else {
      const parsed = Number.parseInt(value, 10);
      updated[playerIdx].points[rowIdx] = Number.isNaN(parsed) ? "" : parsed;
      
      // Fill all empty cells above this row with 0
      for (let i = 0; i < rowIdx; i++) {
        const point = updated[playerIdx].points[i];
        if (point === "" || point === undefined || point === null) {
          updated[playerIdx].points[i] = 0;
        }
      }
    }
    setPlayers(updated);
  };

  // Insert a player at a specific index
  const insertPlayer = (idx) => {
    const newPlayers = [...players];
    // Suggest a default name, but user can change it
    const defaultName = `Player ${players.length + 1}`;
    newPlayers.splice(idx, 0, { name: defaultName, points: [] });
    setPlayers(newPlayers);
  };

  // Remove a player at a specific index
  const removePlayer = (idx) => {
    if (players.length <= MIN_PLAYERS) return; // Prevent removing below minimum
    setPlayerToDelete(idx);
    setShowDeletePlayerConfirm(true);
  };

  // Confirm player deletion
  const confirmDeletePlayer = () => {
    if (playerToDelete !== null) {
      const newPlayers = [...players];
      newPlayers.splice(playerToDelete, 1);
      setPlayers(newPlayers);
    }
    setShowDeletePlayerConfirm(false);
    setPlayerToDelete(null);
  };

  // Cancel player deletion
  const cancelDeletePlayer = () => {
    setShowDeletePlayerConfirm(false);
    setPlayerToDelete(null);
  };

  // Move player to the left
  const movePlayerLeft = (idx) => {
    if (idx === 0) return; // Can't move first player left
    const newPlayers = [...players];
    [newPlayers[idx - 1], newPlayers[idx]] = [newPlayers[idx], newPlayers[idx - 1]];
    setPlayers(newPlayers);
  };

  // Move player to the right
  const movePlayerRight = (idx) => {
    if (idx === players.length - 1) return; // Can't move last player right
    const newPlayers = [...players];
    [newPlayers[idx], newPlayers[idx + 1]] = [newPlayers[idx + 1], newPlayers[idx]];
    setPlayers(newPlayers);
  };

  const addRow = () => {
    setRows(rows + 1);
  };

  const getTotal = (player) => {
    return player.points.reduce((sum, val) => sum + (Number.parseInt(val, 10) || 0), 0);
  };

  // Check if any player has reached or exceeded the target
  const hasReachedTarget = () => {
    if (!targetNumber || gameFinished) return false;
    
    return players.some(player => {
      const total = getTotal(player);
      if (lowIsBetter) {
        return total <= targetNumber;
      } else {
        return total >= targetNumber;
      }
    });
  };

  const handleFinishGame = async () => {
    setGameFinished(true);
    
    // Calculate the actual number of used rows (find the last row with any data)
    let actualUsedRows = 0;
    for (let rowIndex = 0; rowIndex < rows; rowIndex++) {
      const hasDataInRow = players.some(player => {
        const point = player.points[rowIndex];
        return point !== "" && point !== undefined && point !== null;
      });
      if (hasDataInRow) {
        actualUsedRows = rowIndex + 1; // +1 because index is 0-based
      }
    }
    
    // Trim each player's points array to only include used rows
    const trimmedPlayers = players.map(player => ({
      ...player,
      points: player.points.slice(0, actualUsedRows)
    }));
    
    // Update state with trimmed data
    setPlayers(trimmedPlayers);
    setRows(actualUsedRows);
    
    // Save with the updated finished status and trimmed data
    try {
      const gameData = {
        players: trimmedPlayers,
        rows: actualUsedRows,
        timestamp: new Date().toISOString(),
        targetNumber: targetNumber,
        lowIsBetter: lowIsBetter,
        gameFinished: true, // Explicitly set to true
        gameName: currentGameName
      };

      const name = currentGameName || `Table Game - ${new Date().toLocaleDateString()}`;
      let savedGameId = currentGameId;
      
      if (currentGameId && LocalTableGameStorage.tableGameExists(currentGameId)) {
        LocalTableGameStorage.updateTableGame(currentGameId, {
          gameData: gameData,
          lastPlayed: new Date().toISOString(),
          name: name,
          targetNumber: targetNumber,
          lowIsBetter: lowIsBetter,
          gameFinished: true,
          totalRounds: actualUsedRows,
          playerCount: trimmedPlayers.length
        });
        console.debug(`Game finished and saved: "${name}" (ID: ${currentGameId}, actual rounds: ${actualUsedRows})`);
      } else {
        const newGameId = LocalTableGameStorage.saveTableGame(gameData, name);
        setCurrentGameId(newGameId);
        savedGameId = newGameId;
        console.debug(`Game finished and saved as new: "${name}" (ID: ${newGameId})`);
      }

      // Auto-upload to cloud if user is authenticated
      const token = localStorage.getItem('auth_token');
      if (token && savedGameId) {
        try {
          // Check if already uploaded
          if (!LocalTableGameStorage.isGameUploaded(savedGameId)) {
            console.debug('Auto-uploading finished table game to cloud...');
            const { createTableGame } = await import('@/shared/api/tableGameService');
            const result = await createTableGame(gameData, savedGameId);
            
            // Backend returns game._id for table games (full document)
            if (result?.game?._id) {
              LocalTableGameStorage.markGameAsUploaded(savedGameId, result.game._id);
              console.debug(`✅ Table game auto-uploaded to cloud (ID: ${result.game._id})`);
            }
          }
        } catch (uploadError) {
          // Silent fail for auto-upload - game is still saved locally
          console.warn('Auto-upload failed (game saved locally):', uploadError.message);
        }
      }
    } catch (error) {
      console.error("Error saving finished game:", error);
      alert("Failed to save game. Please try again.");
    }
  };

  const handleEditGame = () => {
    setGameFinished(false);
    // Save with the updated finished status
    try {
      const gameData = {
        players: players,
        rows: rows,
        timestamp: new Date().toISOString(),
        targetNumber: targetNumber,
        lowIsBetter: lowIsBetter,
        gameFinished: false, // Explicitly set to false
        gameName: currentGameName
      };

      const name = currentGameName || `Table Game - ${new Date().toLocaleDateString()}`;
      
      if (currentGameId && LocalTableGameStorage.tableGameExists(currentGameId)) {
        LocalTableGameStorage.updateTableGame(currentGameId, {
          gameData: gameData,
          lastPlayed: new Date().toISOString(),
          name: name,
          targetNumber: targetNumber,
          lowIsBetter: lowIsBetter,
          gameFinished: false
        });
        console.debug(`Game reopened for editing: "${name}" (ID: ${currentGameId})`);
      } else {
        const newGameId = LocalTableGameStorage.saveTableGame(gameData, name);
        setCurrentGameId(newGameId);
        console.debug(`Game saved for editing: "${name}" (ID: ${newGameId})`);
      }
    } catch (error) {
      console.error("Error saving game for editing:", error);
      alert("Failed to save game. Please try again.");
    }
  };

  // Check if target is reached and auto-finish/unfinish based on scores
  useEffect(() => {
    if (targetNumber && !gameFinished) {
      // Game is in progress, check if we should auto-mark as ready to finish
      // (This is just for showing the finish button, actual finishing is manual)
    } else if (targetNumber && gameFinished) {
      // Game is finished, check if scores changed and target is no longer reached
      const targetStillReached = players.some(player => {
        const total = getTotal(player);
        if (lowIsBetter) {
          return total <= targetNumber;
        } else {
          return total >= targetNumber;
        }
      });
      
      if (!targetStillReached) {
        // Target no longer reached, automatically unfinish the game
        setGameFinished(false);
        console.debug('⚠️ Target no longer reached, game marked as in progress');
      }
    }
  }, [players, targetNumber, gameFinished, lowIsBetter]);

  const loadGame = (gameData) => {
    try {
      if (gameData?.gameId) {
        // Navigate to the game with its ID
        navigate(`/table/${gameData.gameId}`);
      }
    } catch (error) {
      console.error("Error loading table game:", error);
    }
  };

  const handleSelectTemplate = (templateName, settings = {}) => {
    // Create a new game
    const firstPlayerName = user?.username || user?.name || "Player 1";
    const initialPlayers = settings.playerNames && Array.isArray(settings.playerNames) && settings.playerNames.length > 0
      ? settings.playerNames.map(name => ({ name: name, points: [] }))
      : [
          { name: firstPlayerName, points: [] },
          { name: "Player 2", points: [] },
          { name: "Player 3", points: [] }
        ];
    
    const isSmallLandscape = window.matchMedia('(orientation: landscape) and (max-width: 950px)').matches;
    const newRows = isSmallLandscape ? 8 : 10;
    
    const gameData = {
      players: initialPlayers,
      rows: newRows,
      timestamp: new Date().toISOString(),
      targetNumber: settings.targetNumber || null,
      lowIsBetter: settings.lowIsBetter || false,
      gameFinished: false,
      gameName: templateName
    };
    
    // Save the new game and get the ID
    const newGameId = LocalTableGameStorage.saveTableGame(gameData, templateName);
    
    // Navigate to the new game
    navigate(`/table/${newGameId}`);
  };

  const handleCreateNewGame = (newGameName, settings = {}) => {
    if (newGameName?.trim()) {
      const trimmedName = newGameName.trim();
      // Save as a template with settings
      LocalTableGameTemplate.saveTemplate(trimmedName, settings);
      // Don't auto-start the game, just close the selector to show the new template
      // User can manually click "New Game" when they're ready
    }
  };

  const handleBackToTemplates = () => {
    // Navigate back to where the user came from
    navigate(-1);
  };

  const saveGame = () => {
    try {
      const gameData = {
        players: players,
        rows: rows,
        timestamp: new Date().toISOString(),
        targetNumber: targetNumber,
        lowIsBetter: lowIsBetter,
        gameFinished: gameFinished,
        gameName: currentGameName
      };

      const name = currentGameName || `Table Game - ${new Date().toLocaleDateString()}`;
      
      // If we have a game ID, update the existing game
      if (currentGameId && LocalTableGameStorage.tableGameExists(currentGameId)) {
        LocalTableGameStorage.updateTableGame(currentGameId, {
          gameData: gameData,
          lastPlayed: new Date().toISOString(),
          name: name,
          targetNumber: targetNumber,
          lowIsBetter: lowIsBetter,
          gameFinished: gameFinished
        });
        console.debug(`Updated existing game: "${name}" (ID: ${currentGameId}, finished: ${gameFinished})`);
      } else {
        // Create new save and store the ID
        const newGameId = LocalTableGameStorage.saveTableGame(gameData, name);
        setCurrentGameId(newGameId);
        console.debug(`Saved new game: "${name}" (ID: ${newGameId})`);
        alert(`Game "${name}" saved successfully!`);
      }
    } catch (error) {
      console.error("Error saving table game:", error);
      alert("Failed to save game. Please try again.");
    }
  };

  return (
    <div className="table-game-container">
      {showTemplateSelector ? (
        <GameTemplateSelector
          onSelectTemplate={handleSelectTemplate}
          onCreateNew={handleCreateNewGame}
          onLoadGame={loadGame}
        />
      ) : (
        <>
          <div className="table-game-header">
            <button
              className="back-to-templates-btn"
              onClick={handleBackToTemplates}
              title="Back to Game Selection"
            >
              <ArrowLeftCircleIcon size={20} />
              Back
            </button>
            
            <button
              className="table-game-add-player-above"
              title="Add Player"
              onClick={() => insertPlayer(players.length)}
              disabled={gameFinished}
            >
              Add Player
            </button>
            {/* <SyncStatusIndicator 
              gameId={currentGameName ? `table-${currentGameName}` : null}
              showDetails={false}
              className="ml-2"
            /> */}
            <button
              className="table-game-save-btn"
              onClick={saveGame}
              title="Save Game"
            >
              <SaveIcon size={16} />
              Save
            </button>
          </div>

          {/* Tab Switcher */}
        <div className="table-game-tab-switcher">
          <button
            className={`table-game-tab-btn ${activeTab === 'table' ? 'active' : ''}`}
            onClick={() => setActiveTab('table')}
          >
            Table View
          </button>
          <button
            className={`table-game-tab-btn ${activeTab === 'scoreboard' ? 'active' : ''}`}
            onClick={() => setActiveTab('scoreboard')}
          >
            Scoreboard
          </button>
        </div>

      {/* Conditional Content Display */}
      {activeTab === 'table' ? (
        <div className="table-game-scroll">
          <table className="table-game-table">
            <thead>
              {/* Player Names Row */}
              <tr>
                {players.map((player, idx) => (
                  <th key={idx}>
                    <div className="table-game-player-header">
                      <input
                        value={player.name}
                        onChange={(e) => handleNameChange(idx, e.target.value)}
                        className="table-game-player-input"
                        placeholder={`Player ${idx + 1}`}
                        type="text"
                        disabled={gameFinished}
                      />
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...Array(rows)].map((_, rowIdx) => (
                <tr key={rowIdx}>
                  {players.map((player, playerIdx) => (
                    <td key={playerIdx}>
                      <input
                        type="text"
                        value={player.points[rowIdx] === 0 ? "0" : (player.points[rowIdx] ?? "")}
                        onChange={(e) => handlePointChange(playerIdx, rowIdx, e.target.value)}
                        className="table-game-point-input"
                        // inputMode="numeric"
                        pattern="-?[0-9]*"
                        disabled={gameFinished}
                      />
                    </td>
                  ))}
                </tr>
              ))}
              <tr>
                <td colSpan={players.length}>
                  <button
                    className="table-game-add-row-inline"
                    title="Add Row"
                    onClick={addRow}
                    disabled={gameFinished}
                  >
                    Add Row
                  </button>
                </td>
              </tr>
            </tbody>
            <tfoot>
              <tr>
                {players.map((player, idx) => (
                  <td key={idx} className={`table-game-total ${gameFinished ? 'disabled' : ''}`}>
                    {getTotal(player)}
                  </td>
                ))}
              </tr>
              {/* Controls Row */}
              <tr className={`table-game-controls-row ${gameFinished ? 'disabled' : ''}`}>
                {players.map((_, idx) => (
                  <td key={`controls-${idx}`} className="table-game-controls-cell">
                    <div className="table-game-controls">
                      <button
                        className={`table-game-control-btn table-game-move-btn ${idx === 0 || gameFinished ? 'disabled' : ''}`}
                        title="Move Left"
                        onClick={() => movePlayerLeft(idx)}
                        disabled={idx === 0 || gameFinished}
                      >
                        <ArrowLeftIcon size={16} />
                      </button>
                      {players.length > MIN_PLAYERS && (
                        <button
                          className="table-game-control-btn table-game-remove-btn"
                          title="Remove Player"
                          onClick={() => removePlayer(idx)}
                          disabled={gameFinished}
                        >
                          <XIcon size={16} />
                        </button>
                      )}
                      <button
                        className={`table-game-control-btn table-game-move-btn ${idx === players.length - 1 || gameFinished ? 'disabled' : ''}`}
                        title="Move Right"
                        onClick={() => movePlayerRight(idx)}
                        disabled={idx === players.length - 1 || gameFinished}
                      >
                        <ArrowRightIcon size={16} />
                      </button>
                    </div>
                  </td>
                ))}
              </tr>
            </tfoot>
          </table>
        </div>
      ) : (
        <div className="table-game-scoreboard">
          <h2 className="scoreboard-title">Scoreboard</h2>
          <div className="scoreboard-list">
            {players
              .map((player, idx) => ({
                ...player,
                total: getTotal(player),
                originalIndex: idx
              }))
              .sort((a, b) => {
                // Sort based on scoring preference
                if (lowIsBetter) {
                  return a.total - b.total; // Ascending (low to high)
                } else {
                  return b.total - a.total; // Descending (high to low)
                }
              })
              .map((player, index, array) => {
                // Calculate rank with proper tie handling
                let rank = 1;
                
                // Count how many players have a better score
                for (let i = 0; i < index; i++) {
                  if (lowIsBetter) {
                    if (array[i].total < player.total) {
                      rank++;
                    }
                  } else {
                    if (array[i].total > player.total) {
                      rank++;
                    }
                  }
                }
                
                return (
                  <div key={player.originalIndex} className="scoreboard-item" data-rank={rank}>
                    <div className="scoreboard-rank">{rank}</div>
                    <div className="scoreboard-player-name">{player.name || `Player ${player.originalIndex + 1}`}</div>
                    <div className="scoreboard-score">{player.total}</div>
                  </div>
                );
              })}
          </div>
        </div>
      )}
          
        

          {targetNumber && hasReachedTarget() && !gameFinished && (
            <button
              className="finish-btn"
              onClick={handleFinishGame}
              title="Finish Game"
            >
              Finish Game
            </button>
          )}
          
          {gameFinished && (
            <button
              className="table-game-edit-btn"
              onClick={handleEditGame}
              title="Edit Game"
            >
              Edit Game
            </button>
          )}
        </>
      )}

      {/* Delete Player Confirmation Modal */}
      <DeleteConfirmationModal
        isOpen={showDeletePlayerConfirm}
        onClose={cancelDeletePlayer}
        onConfirm={confirmDeletePlayer}
        title="Delete Player"
        message={
          playerToDelete !== null
            ? `Are you sure you want to delete "${players[playerToDelete]?.name}"? All their scores will be permanently lost.`
            : 'Are you sure you want to delete this player?'
        }
        confirmText="Delete Player"
      />
    </div>
  );
};

export default TableGame;
