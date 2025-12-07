import React, { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeftIcon, ArrowRightIcon, ArrowLeftCircleIcon, BarChartIcon, GamepadIcon, SettingsIcon } from "../../components/ui/Icon";
import { LocalTableGameTemplate, LocalTableGameStorage } from "../../shared/api";
import GameTemplateSelector from "../../components/game/GameTemplateSelector";
import DeleteConfirmationModal from "../../components/modals/DeleteConfirmationModal";
import TableGameSettingsModal from "../../components/modals/TableGameSettingsModal";
import { useUser } from "../../shared/hooks/useUser";
import StatsChart from "../../components/game/StatsChart";
import { AdvancedStats } from "../../components/game";
import "../../styles/components/TableGame.css";
import "../../styles/pages/gameInProgress.css";
import "../../styles/components/statsChart.css";
import "../../styles/components/scorecard.css";

const MIN_PLAYERS = 2;

const TableGame = () => {
  const { user } = useUser(); // Get the logged-in user
  const { id } = useParams();
  const navigate = useNavigate();
  
  const [rows, setRows] = useState(() => {
    const isSmallLandscape = globalThis.matchMedia('(orientation: landscape) and (max-width: 950px)').matches;
    const initialRows = isSmallLandscape ? 4 : 10;
    return initialRows;
  });
  
  const [currentRound, setCurrentRound] = useState(1); // Track current round (1-based)
  const [activeTab, setActiveTab] = useState('game'); // 'game' or 'stats'
  const [statsSubTab, setStatsSubTab] = useState('standings'); // 'standings', 'chart', or 'table'
  const [isLandscape, setIsLandscape] = useState(globalThis.matchMedia('(orientation: landscape)').matches);
  const [showDeletePlayerConfirm, setShowDeletePlayerConfirm] = useState(false);
  const [playerToDelete, setPlayerToDelete] = useState(null);
  const [showGameSettingsModal, setShowGameSettingsModal] = useState(false);
  
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
  const currentRoundRef = useRef(currentRound);
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
        currentRound,
        currentGameName,
        currentGameId,
        targetNumber,
        lowIsBetter,
        gameFinished
      };
      sessionStorage.setItem('currentTableGameState', JSON.stringify(gameState));
    }
  }, [players, rows, currentRound, currentGameName, currentGameId, showTemplateSelector, targetNumber, lowIsBetter, gameFinished]);

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
          const isSmallLandscape = globalThis.matchMedia('(orientation: landscape) and (max-width: 950px)').matches;
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
          setCurrentRound(gameState.currentRound || 1);
          setCurrentGameName(gameState.currentGameName);
          setCurrentGameId(gameState.currentGameId);
          setTargetNumber(gameState.targetNumber || null);
          setLowIsBetter(gameState.lowIsBetter || false);
          setGameFinished(gameState.gameFinished || false);
          setShowTemplateSelector(false);
          setActiveTab('game'); // Always start at game view
          console.debug('🔄 Restored game state from session after HMR');
        }
      } catch (error) {
        console.error('Failed to restore game state:', error);
      }
    }
  }, [id, showTemplateSelector]); // Dependencies for restoration logic

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
          setActiveTab('game');
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

  // Listen for orientation changes
  useEffect(() => {
    const mediaQuery = globalThis.matchMedia('(orientation: landscape)');
    const handleOrientationChange = (e) => {
      setIsLandscape(e.matches);
    };
    
    mediaQuery.addEventListener('change', handleOrientationChange);
    return () => mediaQuery.removeEventListener('change', handleOrientationChange);
  }, []);

  // Listen for orientation changes and adjust rows
  useEffect(() => {
    const mediaQuery = globalThis.matchMedia('(orientation: landscape) and (max-width: 950px)');
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
    currentRoundRef.current = currentRound;
    currentGameNameRef.current = currentGameName;
    currentGameIdRef.current = currentGameId;
    showTemplateSelectorRef.current = showTemplateSelector;
    targetNumberRef.current = targetNumber;
    lowIsBetterRef.current = lowIsBetter;
    gameFinishedRef.current = gameFinished;
  }, [players, rows, currentRound, currentGameName, currentGameId, showTemplateSelector, targetNumber, lowIsBetter, gameFinished]);

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
    globalThis.addEventListener('templateUpdated', syncSettingsFromTemplate);
    
    // Also check on window focus (in case template was edited in another tab)
    globalThis.addEventListener('focus', syncSettingsFromTemplate);
    
    return () => {
      globalThis.removeEventListener('templateUpdated', syncSettingsFromTemplate);
      globalThis.removeEventListener('focus', syncSettingsFromTemplate);
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

    globalThis.addEventListener('beforeunload', handleBeforeUnload);
    
    return () => {
      globalThis.removeEventListener('beforeunload', handleBeforeUnload);
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

  // Note: Player reordering functions removed as they're not used in the new UI

  const addRow = () => {
    setRows(rows + 1);
  };

  // Navigation functions
  const nextRound = () => {
    // If we're on the last round, add a new round
    if (currentRound >= rows) {
      setRows(rows + 1);
    }
    setCurrentRound(currentRound + 1);
  };

  const previousRound = () => {
    if (currentRound > 1) {
      setCurrentRound(currentRound - 1);
    }
  };

  const getTotal = (player) => {
    return player.points.reduce((sum, val) => sum + (Number.parseInt(val, 10) || 0), 0);
  };

  // Calculate comprehensive game statistics for all players
  const calculateDetailedGameStats = () => {
    return players.map((player, playerIndex) => {
      const validPoints = player.points.filter(p => p !== "" && p !== undefined && p !== null);
      const roundsPlayed = validPoints.length;
      const totalPoints = getTotal(player);
      const avgPoints = roundsPlayed > 0 ? totalPoints / roundsPlayed : 0;
      
      // Find best and worst rounds
      let bestRound = roundsPlayed > 0 ? validPoints[0] : 0;
      let worstRound = roundsPlayed > 0 ? validPoints[0] : 0;
      
      validPoints.forEach(point => {
        const pointValue = Number.parseInt(point, 10) || 0;
        if (pointValue > bestRound) bestRound = pointValue;
        if (pointValue < worstRound) worstRound = pointValue;
      });
      
      return {
        id: playerIndex,
        name: player.name,
        roundsPlayed,
        totalPoints,
        avgPoints: avgPoints.toFixed(1),
        bestRound,
        worstRound,
        validPoints: validPoints.map(p => Number.parseInt(p, 10) || 0)
      };
    });
  };

  const detailedStats = calculateDetailedGameStats();

  // Check if any player has reached or exceeded the target
  const hasReachedTarget = () => {
    // No target set or game already finished
    if (!targetNumber || gameFinished) return false;
    
    return players.some(player => {
      const total = getTotal(player);
      
      // Check if player has actually entered any points (not just zeros from empty inputs)
      const hasValidPoints = player.points.some(p => {
        return p !== "" && p !== undefined && p !== null;
      });
      
      // If no points have been entered yet, target can't be reached
      if (!hasValidPoints) return false;
      
        return total >= targetNumber;
    });
  };

  // Check if current round is complete (all players have entered points)
  const isCurrentRoundComplete = () => {
    const roundIndex = currentRound - 1;
    return players.every(player => {
      const point = player.points[roundIndex];
      return point !== "" && point !== undefined && point !== null;
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
    
    const isSmallLandscape = globalThis.matchMedia('(orientation: landscape) and (max-width: 950px)').matches;
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
        <div className={`game-in-progress players-${players.length} ${players.length > 3 ? 'many-players' : ''}`}>
          {/* Round Info Header */}
          <div className="round-info">
            <button 
              className="back-btn"
              onClick={handleBackToTemplates}
              title="Back to Game Selection"
            >
              <ArrowLeftCircleIcon size={28} />
            </button>
            <span className="game-info-header">
              {currentGameName || "Table Game"}
              <div className="total-calls">
                Round {currentRound}
              </div>
            </span>
            <button 
              className="settings-btn"
              onClick={() => setShowGameSettingsModal(true)}
              title="Game Settings"
            >
              <SettingsIcon size={24} />
            </button>
          </div>

          {/* Finish Game Button */}
          {targetNumber && hasReachedTarget() && !gameFinished && (
            <button className="finish-btn" onClick={handleFinishGame}>
              Finish Game
            </button>
          )}
          
          {gameFinished && (
            <button className="finish-btn" onClick={handleEditGame}>
              Edit Game
            </button>
          )}

          {/* Game Tab - Player Scores */}
          {activeTab === 'game' && (
            <div className="tab-panel">
              <div className="player-scores">
                <table className="score-table">
                  <thead>
                    <tr>
                      <th className="player-header">Player</th>
                      <th className="input-header">Points</th>
                      <th className="score-header">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {players.map((player, idx) => {
                      // Use currentRound state (0-based index for array)
                      const roundIndex = currentRound - 1;
                      
                      return (
                        <tr key={idx} className="player-row">
                          <td className="player-cell">
                            <div className="player-name-container">
                              <input
                                value={player.name}
                                onChange={(e) => handleNameChange(idx, e.target.value)}
                                className="player-name-input"
                                placeholder={`Player ${idx + 1}`}
                                type="text"
                                disabled={gameFinished}
                              />
                            </div>
                          </td>
                          <td>
                            <input
                              type="number"
                              className="rounds-input"
                              value={player.points[roundIndex] === 0 ? "0" : (player.points[roundIndex] ?? "")}
                              onChange={(e) => handlePointChange(idx, roundIndex, e.target.value)}
                              placeholder="0"
                              disabled={gameFinished}
                            />
                          </td>
                          <td className="score-cell">
                            <div className="score">
                              <span className="total-score">
                                {getTotal(player)}
                              </span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {currentRound === 1 && !gameFinished && (
              <div className="explanation">
                <p>Always enter the points for each player for the current round.</p>
                <p>Use the navigation buttons below to move between rounds.</p>
              </div>)}
            </div>
          )}

          {/* Stats Tab */}
          {activeTab === 'stats' && (
            <div className="tab-panel">
              <div className="game-stats-container">
                <div className="stats-subtabs">
                  <button 
                    className={`stats-subtab-btn ${statsSubTab === 'standings' ? 'active' : ''}`}
                    onClick={() => setStatsSubTab('standings')}
                  >
                    Standings
                  </button>
                  <button 
                    className={`stats-subtab-btn ${statsSubTab === 'chart' ? 'active' : ''}`}
                    onClick={() => setStatsSubTab('chart')}
                  >
                    Charts
                  </button>
                  <button 
                    className={`stats-subtab-btn ${statsSubTab === 'table' ? 'active' : ''}`}
                    onClick={() => setStatsSubTab('table')}
                  >
                    Table
                  </button>
                </div>
                
                {/* Standings View */}
                {(statsSubTab === 'standings' || isLandscape) && (
                  <div className="results-table">
                    {(() => {
                      // Sort players by total points
                      const sortedStats = [...detailedStats].sort((a, b) => {
                        if (lowIsBetter) {
                          return a.totalPoints - b.totalPoints; // Lower scores first
                        } else {
                          return b.totalPoints - a.totalPoints; // Higher scores first
                        }
                      });
                      
                      // Calculate positions with tie handling
                      let currentRank = 1;
                      return sortedStats.map((playerStats, index) => {
                        // Check if this player's score is different from previous player
                        if (index > 0 && sortedStats[index - 1].totalPoints !== playerStats.totalPoints) {
                          currentRank = index + 1;
                        }
                        
                        // Determine medal class based on rank
                        let medalClass = '';
                        if (currentRank === 1) medalClass = 'gold';
                        else if (currentRank === 2) medalClass = 'silver';
                        else if (currentRank === 3) medalClass = 'bronze';
                        
                        return (
                          <div key={playerStats.id} className="results-row">
                              <div className={`rank-col ${medalClass}`}>{currentRank}</div>
                              <div className="player-col">
                                <div className="player-info">
                                  <span>{playerStats.name}</span>
                                </div>
                              </div>
                              <div className="score-col">{playerStats.totalPoints || 0}</div>
                          </div>
                        );
                      });
                    })()}
                  </div>
                )}
                
                {/* Show both views in landscape, otherwise show based on selected tab */}
                {(statsSubTab === 'chart' || isLandscape) && (
                  <div className="stats-chart-container">
                    <StatsChart 
                      playersData={detailedStats} 
                      roundData={players[0]?.points.map((_, roundIndex) => ({
                        round: roundIndex + 1,
                        players: players.map((player, playerIndex) => ({
                          id: playerIndex,
                          name: player.name,
                          totalScore: player.points.slice(0, roundIndex + 1).reduce((sum, p) => sum + (Number.parseInt(p, 10) || 0), 0)
                        }))
                      })) || []} 
                    />
                  </div>
                )}

                {(statsSubTab === 'table' || isLandscape) && (
                  <div className="rounds-section">
                    <div className={`wizard-scorecard ${detailedStats.length > 3 ? 'many-players' : ''}`} data-player-count={detailedStats.length}>
                      <table className="scorecard-table">
                        <thead>
                          <tr>
                            <th className="round-header sticky-cell">Round</th>
                            {players.map((player, idx) => (
                              <th key={idx} className="player-header">
                                <div className="player-header-name">{player.name}</div>
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {[...Array(rows)].map((_, rowIdx) => {
                            const hasData = players.some(p => {
                              const point = p.points[rowIdx];
                              return point !== "" && point !== undefined && point !== null;
                            });
                            
                            if (!hasData && rowIdx > 0) {
                              // Check if any player has data in previous row
                              const hasPreviousData = players.some(p => {
                                const point = p.points[rowIdx - 1];
                                return point !== "" && point !== undefined && point !== null;
                              });
                              if (!hasPreviousData) return null;
                            }
                            
                            return (
                              <tr key={rowIdx} className="round-row">
                                <td className="round-number sticky-cell">{rowIdx + 1}</td>
                                {players.map((player, playerIdx) => (
                                  <td key={playerIdx} className="player-round-cell">
                                    <input
                                      type="number"
                                      value={player.points[rowIdx] === 0 ? "0" : (player.points[rowIdx] ?? "")}
                                      onChange={(e) => handlePointChange(playerIdx, rowIdx, e.target.value)}
                                      className="round-point-input"
                                      disabled={gameFinished}
                                    />
                                  </td>
                                ))}
                              </tr>
                            );
                          })}
                          <tr className="total-row">
                            <td className="total-label sticky-cell">Total</td>
                            {players.map((player, idx) => (
                              <td key={idx} className="total-score">
                                {getTotal(player)}
                              </td>
                            ))}
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Bottom Section with Controls */}
          <div className="game-bottom-section">
            {/* Toggle Button for Game / Stats */}
            <div className="toggle-section">
              <button
                className="game-control-btn"
                onClick={() => setActiveTab(activeTab === 'game' ? 'stats' : 'game')}
                title={`Switch to ${activeTab === 'game' ? 'Stats' : 'Game'}`}
              >
                {activeTab === 'game' ? <BarChartIcon size={27} /> : <GamepadIcon size={27} />}
              </button>
            </div>

            <div className="game-controls">
              {/* Pause button placeholder - can be added if needed */}
            </div>

            <button 
              className="nav-btn" 
              id="prevRoundBtn" 
              onClick={previousRound} 
              disabled={currentRound <= 1}
            >
              <ArrowLeftIcon /> 
            </button>

            <button 
              className="nav-btn" 
              id="nextRoundBtn" 
              onClick={nextRound} 
              disabled={!isCurrentRoundComplete()}
            >
              <ArrowRightIcon />
            </button>
          </div>

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

          {/* Game Settings Modal */}
          <TableGameSettingsModal
            isOpen={showGameSettingsModal}
            onClose={() => setShowGameSettingsModal(false)}
            players={players}
            rows={rows}
            currentRound={currentRound}
            targetNumber={targetNumber}
            lowIsBetter={lowIsBetter}
            onUpdateSettings={(settings) => {
              if (settings.players) setPlayers(settings.players);
              if (settings.rows) setRows(settings.rows);
              if (settings.targetNumber !== undefined) setTargetNumber(settings.targetNumber);
              if (settings.lowIsBetter !== undefined) setLowIsBetter(settings.lowIsBetter);
              setShowGameSettingsModal(false);
            }}
            gameFinished={gameFinished}
          />
        </div>
      )}
    </div>
  );
};

export default TableGame;
