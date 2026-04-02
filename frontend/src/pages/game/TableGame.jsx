import React, { useState, useEffect, useRef } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import PropTypes from 'prop-types';
import { ArrowLeftIcon, ArrowRightIcon, ArrowLeftCircleIcon, BarChartIcon, GamepadIcon, SettingsIcon } from "../../components/ui/Icon";
import { LocalTableGameStorage, LocalScoreboardGameStorage } from "../../shared/api";
import { getTableGameById } from "../../shared/api/tableGameService";
import DeleteConfirmationModal from "../../components/modals/DeleteConfirmationModal";
import TableGameSettingsModal from "../../components/modals/TableGameSettingsModal";
import { useUser } from "../../shared/hooks/useUser";
import StatsChart from "../../components/game/StatsChart";
import { AdvancedStats } from "../../components/game";
import { generateSecureId } from "../../shared/utils/secureRandom";
import { useTranslation } from "react-i18next";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import "../../styles/components/TableGame.css";
import "../../styles/pages/gameInProgress.css";
import "../../styles/components/statsChart.css";
import "../../styles/components/scorecard.css";

const MIN_PLAYERS = 2;

const TableGame = ({ forceScoreEntryMode = null }) => {
  const { user } = useUser(); // Get the logged-in user
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();
  const isDedicatedScoreboardPage = forceScoreEntryMode === 'twoSideGesture' || location.pathname.startsWith('/scoreboard/');
  const activeStorage = isDedicatedScoreboardPage ? LocalScoreboardGameStorage : LocalTableGameStorage;
  const currentGameIdSessionKey = isDedicatedScoreboardPage ? 'currentScoreboardGameId' : 'currentTableGameId';
  const currentGameStateSessionKey = isDedicatedScoreboardPage ? 'currentScoreboardGameState' : 'currentTableGameState';
  
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
  const [showFinishGameConfirm, setShowFinishGameConfirm] = useState(false);
  
  // Game settings
  const [targetNumber, setTargetNumber] = useState(null);
  const [lowIsBetter, setLowIsBetter] = useState(false);
  const [scoreEntryMode, setScoreEntryMode] = useState(null);
  const [setTargets, setSetTargets] = useState({});
  const [pointHistoryBySet, setPointHistoryBySet] = useState({});
  const [teamMembers, setTeamMembers] = useState([[], []]);
  const [gestureFeedback, setGestureFeedback] = useState({});
  const [scoreValueFeedback, setScoreValueFeedback] = useState({});
  const [gameFinished, setGameFinished] = useState(false);
  const [isCloudGame, setIsCloudGame] = useState(false);
  const [_isLoadingGame, setIsLoadingGame] = useState(false);
  const [loadError, setLoadError] = useState(null);
  
  // Initialize players with the logged-in user as the first player if available
  const getDefaultPlayers = () => {
    if (isDedicatedScoreboardPage) {
      return [
        { id: 'team-1', name: t('startTableGame.teamOne'), points: [] },
        { id: 'team-2', name: t('startTableGame.teamTwo'), points: [] },
      ];
    }

    const firstPlayerName = user?.username || user?.name || "Player 1";
    const firstPlayerId = user?.id || user?.$id || generateSecureId('player');
    return [
      { id: firstPlayerId, name: firstPlayerName, points: [] },
      { id: generateSecureId('player'), name: "Player 2", points: [] },
      { id: generateSecureId('player'), name: "Player 3", points: [] }
    ];
  };
  
  const [players, setPlayers] = useState(getDefaultPlayers());
  const [showTemplateSelector, setShowTemplateSelector] = useState(!id);
  const [currentGameName, setCurrentGameName] = useState(
    isDedicatedScoreboardPage ? 'Volleyball' : ""
  );
  const [currentGameId, setCurrentGameId] = useState(() => {
    // Prefer route ID on direct loads/refresh, fallback to session state for HMR restores
    if (id) return id;
    return sessionStorage.getItem(currentGameIdSessionKey) || null;
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
  const scoreEntryModeRef = useRef(scoreEntryMode);
  const setTargetsRef = useRef(setTargets);
  const pointHistoryBySetRef = useRef(pointHistoryBySet);
  const teamMembersRef = useRef(teamMembers);
  const gameFinishedRef = useRef(gameFinished);
  const touchStateRef = useRef({});
  const scoreValueTimeoutRef = useRef({});
  const lastTouchTimestampRef = useRef({});
  const scoreActionHistoryByRoundRef = useRef({});
  const loadedRouteGameIdRef = useRef(null);

  // Persist game ID to sessionStorage whenever it changes
  useEffect(() => {
    if (currentGameId) {
      sessionStorage.setItem(currentGameIdSessionKey, currentGameId);
    } else {
      sessionStorage.removeItem(currentGameIdSessionKey);
    }
  }, [currentGameId, currentGameIdSessionKey]);

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
        scoreEntryMode,
        setTargets,
        pointHistoryBySet,
        teamMembers,
        gameFinished
      };
      sessionStorage.setItem(currentGameStateSessionKey, JSON.stringify(gameState));
    }
  }, [players, rows, currentRound, currentGameName, currentGameId, showTemplateSelector, targetNumber, lowIsBetter, scoreEntryMode, setTargets, pointHistoryBySet, teamMembers, gameFinished, currentGameStateSessionKey]);

  // Restore game state from sessionStorage on mount (after HMR)
  useEffect(() => {
    const savedState = sessionStorage.getItem(currentGameStateSessionKey);
    
    // Only restore if:
    // 1. We have saved state
    // 2. We're on the template selector
    // 3. There's NO gameId in URL (meaning this is HMR restore, not a fresh navigation)
    if (savedState) {
      try {
        const gameState = JSON.parse(savedState);
        const isTemplateRestore = showTemplateSelector && !id;
        const isRouteRestore = Boolean(id) && gameState.currentGameId === id;

        if (!isTemplateRestore && !isRouteRestore) {
          return;
        }

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
          setScoreEntryMode(gameState.scoreEntryMode || null);
          setSetTargets(gameState.setTargets || {});
          setPointHistoryBySet(gameState.pointHistoryBySet || {});
          setTeamMembers(gameState.teamMembers || [[], []]);
          setGameFinished(gameState.gameFinished || false);
          setShowTemplateSelector(false);
          setActiveTab('game'); // Always start at game view
          console.debug('🔄 Restored game state from session after HMR');
        }
      } catch (error) {
        console.error('Failed to restore game state:', error);
      }
    }
  }, [id, showTemplateSelector, currentGameStateSessionKey]); // Dependencies for restoration logic

  // Check for gameId in URL parameters and load that game
  useEffect(() => {
    const loadGame = async () => {
      if (id) {
        // Always hydrate once per route ID, even if session state currently matches,
        // so refreshes reliably restore persisted scores.
        const isFirstHydrationForRoute = loadedRouteGameIdRef.current !== id;

        if (isFirstHydrationForRoute || showTemplateSelector || currentGameId !== id) {
          setIsLoadingGame(true);
          setLoadError(null);
          
          try {
            // Try to load the game - this will check local first, then cloud
            let savedGame = null;

            if (isDedicatedScoreboardPage) {
              const localScoreboardGame = activeStorage.getTableGameById(id);
              if (localScoreboardGame) {
                savedGame = { ...localScoreboardGame, is_local: true };
              }
            }

            if (!savedGame && !id.startsWith('scoreboard_game')) {
              savedGame = await getTableGameById(id);
            }
          
          if (savedGame) {
            const gameData = savedGame.gameData || savedGame;
            const isFinished = savedGame.gameFinished || gameData.gameFinished || false;
            const isCloud = savedGame.is_cloud || false;

            if (
              (gameData.scoreEntryMode === 'twoSideGesture' || gameData.gameType === 'scoreboard') &&
              location.pathname.startsWith('/table/')
            ) {
              navigate(`/scoreboard/${id}`, { replace: true });
              return;
            }
            
            // Redirect to details page for finished or cloud games
            if (isFinished || isCloud) {
              const isScoreboardGame = gameData.scoreEntryMode === 'twoSideGesture' || gameData.gameType === 'scoreboard';
              navigate(isScoreboardGame ? `/scoreboard-game/${id}` : `/table-game/${id}`, { replace: true });
              return;
            }
            
            // Ensure players have proper structure with points arrays and IDs
            const loadedPlayers = (gameData.players || []).map(player => ({
              id: player.id || generateSecureId('player'),
              name: player.name || 'Unknown',
              points: Array.isArray(player.points) ? player.points : []
            }));
            
            // Set all the state to display the game
            setPlayers(loadedPlayers);
            const loadedTeamMembers = Array.isArray(gameData.teamMembers)
              ? gameData.teamMembers
              : [
                  loadedPlayers.length > 0 ? [{ id: loadedPlayers[0].id, name: loadedPlayers[0].name }] : [],
                  loadedPlayers.length > 1 ? [{ id: loadedPlayers[1].id, name: loadedPlayers[1].name }] : [],
                ];
            setTeamMembers(loadedTeamMembers);
            setRows(gameData.rows || 10);
            setShowTemplateSelector(false);
            setIsCloudGame(false);
            setActiveTab('game');
            setCurrentGameName(savedGame.name || gameData.gameName || t('tableGame.defaultGameName'));
            setCurrentGameId(savedGame.id || savedGame.cloudId || id);
            
            // Reset round to 1 for new games, or restore for existing games with data
            // Find the last round that has any data entered
            const lastRoundWithData = loadedPlayers.reduce((maxRound, player) => {
              const playerLastRound = player.points.findIndex((p, idx) => {
                // Check if this is the last non-empty point
                const hasValue = p !== "" && p !== undefined && p !== null;
                const nextIsEmpty = player.points.slice(idx + 1).every(
                  np => np === "" || np === undefined || np === null
                );
                return hasValue && nextIsEmpty;
              });
              return Math.max(maxRound, playerLastRound + 1);
            }, 0);
            
            // Set currentRound to the appropriate round (last with data, or 1 if no data)
            const restoredRound = lastRoundWithData > 0 ? lastRoundWithData : 1;
            setCurrentRound(restoredRound);
            
            // Use saved game settings directly - don't sync with templates
            // This prevents altered local variants from overriding games created with system templates
            setTargetNumber(gameData.targetNumber || null);
            setLowIsBetter(gameData.lowIsBetter || false);
            setScoreEntryMode(forceScoreEntryMode || gameData.scoreEntryMode || (gameData.gameType === 'scoreboard' ? 'twoSideGesture' : null));
            setSetTargets(gameData.setTargets || {});
            setPointHistoryBySet(gameData.pointHistoryBySet || {});
            console.debug(`📋 Using saved game settings: target=${gameData.targetNumber}, lowIsBetter=${gameData.lowIsBetter}`);
            
            setGameFinished(false);
            loadedRouteGameIdRef.current = id;
            console.debug(`Loaded local game: "${savedGame.name || gameData.gameName}" (ID: ${id}), players: ${loadedPlayers.length}, rows: ${gameData.rows || 10}, round: ${restoredRound}`);
          } else {
            console.error(`Game with ID ${id} not found in storage or cloud`);
            setLoadError(t('tableGame.gameNotFound'));
            setCurrentGameId(null);
          }
          } catch (error) {
            console.error('Error loading game:', error);
            setLoadError(error.message || 'Failed to load game');
          } finally {
            setIsLoadingGame(false);
          }
        }
      } else {
        // No ID in URL - redirect to unified start page
        navigate('/start', { replace: true });
      }
    };
    
    loadGame();
  }, [id, showTemplateSelector, currentGameId, navigate, t, location.pathname, forceScoreEntryMode, isDedicatedScoreboardPage, activeStorage]);

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
    scoreEntryModeRef.current = scoreEntryMode;
    setTargetsRef.current = setTargets;
    pointHistoryBySetRef.current = pointHistoryBySet;
    teamMembersRef.current = teamMembers;
    gameFinishedRef.current = gameFinished;
  }, [players, rows, currentRound, currentGameName, currentGameId, showTemplateSelector, targetNumber, lowIsBetter, scoreEntryMode, setTargets, pointHistoryBySet, teamMembers, gameFinished]);

  // Note: We intentionally removed the template sync useEffect that was here.
  // It was causing issues where altered local variants would override settings
  // of games created with system templates. Game settings are now locked to
  // whatever was saved when the game was created.

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
            scoreEntryMode: scoreEntryMode,
            setTargets: setTargets,
            pointHistoryBySet: pointHistoryBySet,
            teamMembers: teamMembers,
            gameFinished: gameFinished,
            gameName: currentGameName
          };
          
          const name = currentGameName || `${t('tableGame.defaultGameName')} - ${new Date().toLocaleDateString()}`;
          
          // If no game ID, create a new save
          if (!currentGameId) {
            const newGameId = activeStorage.saveTableGame(gameData, name);
            setCurrentGameId(newGameId);
            console.debug(`💾 Created initial save: "${name}" (ID: ${newGameId})`);
          } else if (activeStorage.tableGameExists(currentGameId)) {
            activeStorage.updateTableGame(currentGameId, {
              gameData: gameData,
              lastPlayed: new Date().toISOString(),
              name: name,
              targetNumber: targetNumber,
              lowIsBetter: lowIsBetter,
              scoreEntryMode: scoreEntryMode,
              setTargets: setTargets,
              pointHistoryBySet: pointHistoryBySet,
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
  }, [players, rows, currentGameName, currentGameId, showTemplateSelector, targetNumber, lowIsBetter, scoreEntryMode, setTargets, pointHistoryBySet, teamMembers, gameFinished, t, activeStorage]);

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
      const currentScoreEntryMode = scoreEntryModeRef.current;
      const currentSetTargets = setTargetsRef.current;
      const currentPointHistoryBySet = pointHistoryBySetRef.current;
      const currentTeamMembers = teamMembersRef.current;
      const currentGameFinished = gameFinishedRef.current;
      
      console.debug('💾 Silent save on unmount:', {
        currentId,
        isShowingTemplateSelector,
        playersCount: currentPlayers.length
      });
      
      // Save if we have a game in progress (not on template selector)
      if (!isShowingTemplateSelector) {
        try {
          const existingGame = currentId && activeStorage.tableGameExists(currentId)
            ? activeStorage.getTableGameById(currentId)
            : null;
          const persistedFinished = currentGameFinished
            || existingGame?.gameFinished === true
            || existingGame?.gameData?.gameFinished === true;

          const gameData = {
            players: currentPlayers,
            rows: currentRows,
            timestamp: new Date().toISOString(),
            targetNumber: currentTargetNumber,
            lowIsBetter: currentLowIsBetter,
            scoreEntryMode: currentScoreEntryMode,
            setTargets: currentSetTargets,
            pointHistoryBySet: currentPointHistoryBySet,
            teamMembers: currentTeamMembers,
            gameFinished: persistedFinished,
            gameName: currentName
          };

          const name = currentName || `${t('tableGame.defaultGameName')} - ${new Date().toLocaleDateString()}`;
          
          // If no game ID, create a new save
          if (!currentId) {
            const newGameId = activeStorage.saveTableGame(gameData, name);
            console.debug(`✅ Created save on navigation: "${name}" (ID: ${newGameId})`);
          } else if (activeStorage.tableGameExists(currentId)) {
            // Update the existing game
            activeStorage.updateTableGame(currentId, {
              gameData: gameData,
              lastPlayed: new Date().toISOString(),
              name: name,
              targetNumber: currentTargetNumber,
              lowIsBetter: currentLowIsBetter,
              scoreEntryMode: currentScoreEntryMode,
              setTargets: currentSetTargets,
              pointHistoryBySet: currentPointHistoryBySet,
              gameFinished: persistedFinished
            });
            console.debug(`✅ Silent save on navigation: "${name}" (ID: ${currentId}, finished: ${persistedFinished})`);
          }
        } catch (error) {
          console.error('❌ Failed to save on navigation:', error);
        }
      }
    };
  }, [t, activeStorage]);

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
      const currentScoreEntryMode = scoreEntryModeRef.current;
      const currentSetTargets = setTargetsRef.current;
      const currentPointHistoryBySet = pointHistoryBySetRef.current;
      const currentTeamMembers = teamMembersRef.current;
      const currentGameFinished = gameFinishedRef.current;
      
      console.debug('💾 Silent save on browser close:', {
        isShowingTemplateSelector,
        currentId
      });
      
      // Save if we have a game in progress (not on template selector)
      if (!isShowingTemplateSelector) {
        try {
          const existingGame = currentId && activeStorage.tableGameExists(currentId)
            ? activeStorage.getTableGameById(currentId)
            : null;
          const persistedFinished = currentGameFinished
            || existingGame?.gameFinished === true
            || existingGame?.gameData?.gameFinished === true;

          const gameData = {
            players: currentPlayers,
            rows: currentRows,
            timestamp: new Date().toISOString(),
            targetNumber: currentTargetNumber,
            lowIsBetter: currentLowIsBetter,
            scoreEntryMode: currentScoreEntryMode,
            setTargets: currentSetTargets,
            pointHistoryBySet: currentPointHistoryBySet,
            teamMembers: currentTeamMembers,
            gameFinished: persistedFinished,
            gameName: currentName
          };

          const name = currentName || `${t('tableGame.defaultGameName')} - ${new Date().toLocaleDateString()}`;
          
          // If no game ID, create a new save
          if (!currentId) {
            const newGameId = activeStorage.saveTableGame(gameData, name);
            console.debug(`✅ Created save on browser close: "${name}" (ID: ${newGameId})`);
          } else if (activeStorage.tableGameExists(currentId)) {
            // Update the existing game
            activeStorage.updateTableGame(currentId, {
              gameData: gameData,
              lastPlayed: new Date().toISOString(),
              name: name,
              targetNumber: currentTargetNumber,
              lowIsBetter: currentLowIsBetter,
              scoreEntryMode: currentScoreEntryMode,
              setTargets: currentSetTargets,
              pointHistoryBySet: currentPointHistoryBySet,
              gameFinished: persistedFinished
            });
            console.debug(`✅ Silent save on browser close: "${name}" (ID: ${currentId}, finished: ${persistedFinished})`);
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
  }, [t, activeStorage]);

  useEffect(() => {
    const scoreFeedbackTimeouts = scoreValueTimeoutRef.current;
    return () => {
      Object.values(scoreFeedbackTimeouts).forEach((timeoutId) => {
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
      });
    };
  }, []);

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
  const _insertPlayer = (idx) => {
    const newPlayers = [...players];
    // Suggest a default name, but user can change it
    const defaultName = `Player ${players.length + 1}`;
    newPlayers.splice(idx, 0, { id: generateSecureId('player'), name: defaultName, points: [] });
    setPlayers(newPlayers);
  };

  // Remove a player at a specific index
  const _removePlayer = (idx) => {
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

  const _addRow = () => {
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

  const isTwoSideScoreboard = (
    forceScoreEntryMode === 'twoSideGesture'
    || scoreEntryMode === 'twoSideGesture'
    || isDedicatedScoreboardPage
  ) && players.length === 2;
  const isBasketballGame = (currentGameName || '').trim().toLowerCase() === 'basketball';
  const isVolleyballGame = (currentGameName || '').trim().toLowerCase() === 'volleyball';

  const clearScoreValueFeedbackTimeout = (playerIdx) => {
    if (scoreValueTimeoutRef.current[playerIdx]) {
      clearTimeout(scoreValueTimeoutRef.current[playerIdx]);
      delete scoreValueTimeoutRef.current[playerIdx];
    }
  };

  const triggerScoreValueAnimation = (playerIdx, delta) => {
    if (delta === 0) return;

    const animationType = delta > 0 ? 'increment' : 'decrement';
    setScoreValueFeedback((prev) => ({ ...prev, [playerIdx]: animationType }));

    clearScoreValueFeedbackTimeout(playerIdx);
    scoreValueTimeoutRef.current[playerIdx] = setTimeout(() => {
      setScoreValueFeedback((prev) => ({ ...prev, [playerIdx]: null }));
    }, 240);
  };

  const updatePointHistoryForScoreChange = (roundNumber, playerIdx, delta) => {
    if (!isTwoSideScoreboard || delta === 0) {
      return;
    }

    const shouldUseBasketballPointEvents = isBasketballGame;

    setPointHistoryBySet((prev) => {
      const roundKey = String(roundNumber);
      const history = Array.isArray(prev[roundKey]) ? [...prev[roundKey]] : [];

      if (delta > 0) {
        if (shouldUseBasketballPointEvents) {
          history.push({ scorer: playerIdx, points: delta });
        } else {
          for (let i = 0; i < delta; i += 1) {
            history.push(playerIdx);
          }
        }
      } else {
        let removals = Math.abs(delta);

        if (shouldUseBasketballPointEvents) {
          for (let i = history.length - 1; i >= 0 && removals > 0; i -= 1) {
            const currentEntry = history[i];
            const scorer = typeof currentEntry === 'number' ? currentEntry : currentEntry?.scorer;
            const entryPointsRaw = typeof currentEntry === 'number' ? 1 : Number.parseInt(currentEntry?.points, 10);
            const entryPoints = Number.isFinite(entryPointsRaw) && entryPointsRaw > 0 ? entryPointsRaw : 1;

            if (scorer === playerIdx) {
              if (entryPoints <= removals) {
                history.splice(i, 1);
                removals -= entryPoints;
              } else {
                history[i] = { scorer: playerIdx, points: entryPoints - removals };
                removals = 0;
              }
            }
          }
        } else {
          for (let i = history.length - 1; i >= 0 && removals > 0; i -= 1) {
            if (history[i] === playerIdx) {
              history.splice(i, 1);
              removals -= 1;
            }
          }
        }
      }

      return {
        ...prev,
        [roundKey]: history,
      };
    });
  };

  const updatePlayerLiveScore = (playerIdx, delta) => {
    let trackUndo = true;
    if (typeof delta === 'object' && delta !== null) {
      trackUndo = delta.trackUndo !== false;
      delta = delta.delta;
    }

    if (gameFinished || playerIdx < 0 || playerIdx >= players.length) {
      return;
    }

    const updated = [...players];
    const roundIndex = currentRound - 1;
    const currentValue = Number.parseInt(updated[playerIdx].points[roundIndex], 10) || 0;
    const nextValue = Math.max(0, currentValue + delta);
    updated[playerIdx].points[roundIndex] = nextValue;
    setPlayers(updated);

    const actualDelta = nextValue - currentValue;
    updatePointHistoryForScoreChange(currentRound, playerIdx, actualDelta);
    triggerScoreValueAnimation(playerIdx, actualDelta);

    if (trackUndo && actualDelta > 0) {
      const roundKey = String(currentRound);
      const existingRoundHistory = Array.isArray(scoreActionHistoryByRoundRef.current[roundKey])
        ? scoreActionHistoryByRoundRef.current[roundKey]
        : [];
      scoreActionHistoryByRoundRef.current = {
        ...scoreActionHistoryByRoundRef.current,
        [roundKey]: [...existingRoundHistory, { playerIdx, delta: actualDelta }],
      };
    }
  };

  const revertLastScoreAction = (playerIdx) => {
    if (gameFinished || playerIdx < 0 || playerIdx >= players.length) {
      return;
    }

    const roundKey = String(currentRound);
    const roundHistory = Array.isArray(scoreActionHistoryByRoundRef.current[roundKey])
      ? [...scoreActionHistoryByRoundRef.current[roundKey]]
      : [];

    for (let i = roundHistory.length - 1; i >= 0; i -= 1) {
      const action = roundHistory[i];
      if (action.playerIdx === playerIdx) {
        roundHistory.splice(i, 1);
        scoreActionHistoryByRoundRef.current = {
          ...scoreActionHistoryByRoundRef.current,
          [roundKey]: roundHistory,
        };
        updatePlayerLiveScore(playerIdx, { delta: -Math.abs(action.delta), trackUndo: false });
        return;
      }
    }
  };

  const setPlayerLiveScore = (playerIdx, newScore) => {
    if (gameFinished || playerIdx < 0 || playerIdx >= players.length) {
      return;
    }

    const parsedValue = Number.parseInt(newScore, 10);
    const updated = [...players];
    const roundIndex = currentRound - 1;
    const currentValue = Number.parseInt(updated[playerIdx].points[roundIndex], 10) || 0;
    const nextValue = Number.isNaN(parsedValue) ? 0 : Math.max(0, parsedValue);
    updated[playerIdx].points[roundIndex] = nextValue;
    setPlayers(updated);

    const actualDelta = nextValue - currentValue;
    updatePointHistoryForScoreChange(currentRound, playerIdx, actualDelta);
    triggerScoreValueAnimation(playerIdx, actualDelta);
  };

  const getLiveScore = (playerIdx) => {
    const roundIndex = currentRound - 1;
    return Number.parseInt(players[playerIdx]?.points?.[roundIndex], 10) || 0;
  };

  const getDefaultSetTarget = () => {
    if (isTwoSideScoreboard && currentRound === 5) {
      return 15;
    }
    return targetNumber || 25;
  };

  const getSetTarget = () => {
    const explicitSetTarget = setTargets[currentRound];
    if (explicitSetTarget && Number.isFinite(explicitSetTarget)) {
      return explicitSetTarget;
    }
    return getDefaultSetTarget();
  };

  const isCurrentSetWon = () => {
    if (!isTwoSideScoreboard || players.length < 2) {
      return false;
    }

    const teamOneScore = getLiveScore(0);
    const teamTwoScore = getLiveScore(1);
    const scoreTarget = getSetTarget();
    const scoreDiff = Math.abs(teamOneScore - teamTwoScore);

    return (teamOneScore >= scoreTarget || teamTwoScore >= scoreTarget) && scoreDiff >= 2;
  };

  const handleScoreTouchStart = (playerIdx, event) => {
    setGestureFeedback((prev) => ({ ...prev, [playerIdx]: null }));

    const touch = event.touches?.[0];
    if (!touch) return;
    touchStateRef.current[playerIdx] = {
      startY: touch.clientY,
      moved: false,
      preview: null,
    };
  };

  const handleScoreTouchMove = (playerIdx, event) => {
    const state = touchStateRef.current[playerIdx];
    const touch = event.touches?.[0];
    if (!state || !touch) return;

    const deltaY = touch.clientY - state.startY;
    const threshold = 30;
    let preview = null;

    if (deltaY <= -threshold) {
      preview = 'swipe-up';
    } else if (deltaY >= threshold) {
      preview = 'swipe-down';
    }

    if (state.preview !== preview) {
      state.preview = preview;
      setGestureFeedback((prev) => ({ ...prev, [playerIdx]: preview }));
    }

    if (Math.abs(deltaY) > 12) {
      state.moved = true;
    }
  };

  const handleScoreTouchEnd = (playerIdx, event) => {
    const state = touchStateRef.current[playerIdx];
    const touch = event.changedTouches?.[0];
    if (!state || !touch) return;

    const deltaY = touch.clientY - state.startY;
    const threshold = 30;

    if (deltaY <= -threshold) {
      updatePlayerLiveScore(playerIdx, 1);
    } else if (deltaY >= threshold) {
      updatePlayerLiveScore(playerIdx, -1);
    } else if (!state.moved) {
      updatePlayerLiveScore(playerIdx, 1);
    }

    setGestureFeedback((prev) => ({ ...prev, [playerIdx]: null }));
    lastTouchTimestampRef.current[playerIdx] = Date.now();
    event.currentTarget?.blur?.();
    delete touchStateRef.current[playerIdx];
  };

  const handleScoreTouchCancel = (playerIdx, event) => {
    setGestureFeedback((prev) => ({ ...prev, [playerIdx]: null }));
    event.currentTarget?.blur?.();
    delete touchStateRef.current[playerIdx];
  };

  const handleScoreCardClick = (playerIdx) => {
    const lastTouchAt = lastTouchTimestampRef.current[playerIdx] || 0;
    if (Date.now() - lastTouchAt < 500) {
      return;
    }

    updatePlayerLiveScore(playerIdx, 1);
  };

  const toggleCurrentSetTarget = () => {
    if (!isTwoSideScoreboard) return;

    const defaultTarget = getDefaultSetTarget();
    const currentTarget = getSetTarget();
    const nextTarget = currentTarget === 15 ? 25 : 15;

    setSetTargets((prev) => {
      const next = { ...prev };

      if (nextTarget === defaultTarget) {
        delete next[currentRound];
      } else {
        next[currentRound] = nextTarget;
      }

      return next;
    });
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

  const getTeamMembersLabel = (teamIndex) => {
    if (!isTwoSideScoreboard) return '';
    const members = Array.isArray(teamMembers?.[teamIndex]) ? teamMembers[teamIndex] : [];
    return members
      .map((member) => member?.name)
      .filter(Boolean)
      .join(' - ');
  };

  const getCurrentSetPointHistory = () => {
    const roundKey = String(currentRound);
    return Array.isArray(pointHistoryBySet[roundKey]) ? pointHistoryBySet[roundKey] : [];
  };

  const getPointEventMeta = (entry) => {
    if (typeof entry === 'number') {
      return {
        scorer: entry,
        points: 1,
      };
    }

    if (entry && typeof entry === 'object') {
      const parsedPoints = Number.parseInt(entry.points, 10);
      return {
        scorer: entry.scorer,
        points: Number.isFinite(parsedPoints) && parsedPoints > 0 ? parsedPoints : 1,
      };
    }

    return {
      scorer: null,
      points: 1,
    };
  };

  const buildScoreProgressionSeries = (history) => {
    const points = [{ pointNumber: 0, teamOne: 0, teamTwo: 0 }];
    let teamOne = 0;
    let teamTwo = 0;

    history.forEach((entry, index) => {
      const { scorer, points: scoredPoints } = getPointEventMeta(entry);

      if (scorer === 0) {
        teamOne += scoredPoints;
      } else if (scorer === 1) {
        teamTwo += scoredPoints;
      }

      points.push({
        pointNumber: index + 1,
        teamOne,
        teamTwo,
      });
    });

    return points;
  };

  const currentSetPointHistory = isTwoSideScoreboard ? getCurrentSetPointHistory() : [];
  const scoreProgressionSeries = isTwoSideScoreboard ? buildScoreProgressionSeries(currentSetPointHistory) : [];
  const progressionMaxScore = scoreProgressionSeries.reduce((max, point) => Math.max(max, point.teamOne, point.teamTwo), 0);
  const progressionTickStep = progressionMaxScore <= 6 ? 1 : (progressionMaxScore <= 12 ? 2 : 5);
  const progressionAxisTop = Math.max(3, Math.ceil(Math.max(1, progressionMaxScore) / progressionTickStep) * progressionTickStep);
  const progressionYAxisTicks = Array.from(
    { length: Math.floor(progressionAxisTop / progressionTickStep) + 1 },
    (_, idx) => idx * progressionTickStep,
  );

  // Check if any player has reached or exceeded the target
  const hasReachedTarget = () => {
    // No target set or game already finished
    if (gameFinished) return false;

    if (isTwoSideScoreboard) {
      return isCurrentSetWon();
    }

    if (!targetNumber) return false;
    
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

  const handleFinishGame = () => {
    // Show confirmation dialog instead of immediately finishing
    setShowFinishGameConfirm(true);
  };

  const confirmFinishGame = async () => {
    setShowFinishGameConfirm(false);
    // Keep unmount autosave in sync during immediate post-finish redirect.
    gameFinishedRef.current = true;
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
    
    // Calculate winner based on scores
    const playersWithScores = trimmedPlayers.map(player => {
      const total = player.points?.reduce((sum, val) => sum + (Number.parseInt(val, 10) || 0), 0) || 0;
      return { ...player, total };
    });
    
    // Find all winners (handle ties)
    const bestScore = playersWithScores.reduce((best, current) => {
      if (lowIsBetter) {
        return best === null || current.total < best ? current.total : best;
      } else {
        return best === null || current.total > best ? current.total : best;
      }
    }, null);
    
    const winners = playersWithScores.filter(p => p.total === bestScore);
    const winner = winners[0]; // Keep single winner for backward compatibility
    const winnerIds = winners.map(w => w.id);
    
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
        scoreEntryMode: scoreEntryMode,
        setTargets: setTargets,
        pointHistoryBySet: pointHistoryBySet,
        teamMembers: teamMembers,
        gameFinished: true, // Explicitly set to true
        gameName: currentGameName,
        winner_ids: winnerIds || [], // Array to handle ties
        winner_id: winner?.id || null, // Keep for backward compatibility
        winner_name: winner?.name || null
      };

      const name = currentGameName || `${t('tableGame.defaultGameName')} - ${new Date().toLocaleDateString()}`;
      let savedGameId = currentGameId;
      
      if (currentGameId && activeStorage.tableGameExists(currentGameId)) {
        activeStorage.updateTableGame(currentGameId, {
          gameData: gameData,
          lastPlayed: new Date().toISOString(),
          name: name,
          targetNumber: targetNumber,
          lowIsBetter: lowIsBetter,
          scoreEntryMode: scoreEntryMode,
          setTargets: setTargets,
          pointHistoryBySet: pointHistoryBySet,
          gameFinished: true,
          totalRounds: actualUsedRows,
          playerCount: trimmedPlayers.length,
          winner_ids: winnerIds || [], // Array to handle ties
          winner_id: winner?.id || null, // Keep for backward compatibility
          winner_name: winner?.name || null
        });
        console.debug(`Game finished and saved: "${name}" (ID: ${currentGameId}, actual rounds: ${actualUsedRows})`);
      } else {
        const newGameId = activeStorage.saveTableGame(gameData, name);
        setCurrentGameId(newGameId);
        savedGameId = newGameId;
        console.debug(`Game finished and saved as new: "${name}" (ID: ${newGameId})`);
      }

      // Auto-upload to cloud if user is authenticated
      const token = localStorage.getItem('auth_token');
      if (token && savedGameId) {
        try {
          // Check if already uploaded
          if (!activeStorage.isGameUploaded(savedGameId)) {
            console.debug('Auto-uploading finished table game to cloud...');
            const { createTableGame } = await import('@/shared/api/tableGameService');
            const result = await createTableGame(gameData, savedGameId);
            
            // Backend returns game._id for table games (full document)
            if (result?.game?._id) {
              activeStorage.markGameAsUploaded(savedGameId, result.game._id);
              console.debug(`✅ Table game auto-uploaded to cloud (ID: ${result.game._id})`);
            }
          }
        } catch (uploadError) {
          // Silent fail for auto-upload - game is still saved locally
          console.warn('Auto-upload failed (game saved locally):', uploadError.message);
        }
      }
      
      // Ensure cleanup autosave writes to the just-finished game instead of creating a stale duplicate.
      currentGameIdRef.current = savedGameId;
      playersRef.current = trimmedPlayers;
      rowsRef.current = actualUsedRows;

      // Navigate to the details page after finishing
      navigate(isTwoSideScoreboard ? `/scoreboard-game/${savedGameId}` : `/table-game/${savedGameId}`, { replace: true });
    } catch (error) {
      console.error("Error saving finished game:", error);
      alert(t('tableGame.saveFailed'));
    }
  };

  const _handleEditGame = () => {
    setGameFinished(false);
    // Save with the updated finished status
    try {
      const gameData = {
        players: players,
        rows: rows,
        timestamp: new Date().toISOString(),
        targetNumber: targetNumber,
        lowIsBetter: lowIsBetter,
        scoreEntryMode: scoreEntryMode,
        setTargets: setTargets,
        pointHistoryBySet: pointHistoryBySet,
        teamMembers: teamMembers,
        gameFinished: false, // Explicitly set to false
        gameName: currentGameName
      };

      const name = currentGameName || `${t('tableGame.defaultGameName')} - ${new Date().toLocaleDateString()}`;
      
      if (currentGameId && activeStorage.tableGameExists(currentGameId)) {
        activeStorage.updateTableGame(currentGameId, {
          gameData: gameData,
          lastPlayed: new Date().toISOString(),
          name: name,
          targetNumber: targetNumber,
          lowIsBetter: lowIsBetter,
          scoreEntryMode: scoreEntryMode,
          setTargets: setTargets,
          pointHistoryBySet: pointHistoryBySet,
          gameFinished: false
        });
        console.debug(`Game reopened for editing: "${name}" (ID: ${currentGameId})`);
      } else {
        const newGameId = activeStorage.saveTableGame(gameData, name);
        setCurrentGameId(newGameId);
        console.debug(`Game saved for editing: "${name}" (ID: ${newGameId})`);
      }
    } catch (error) {
      console.error("Error saving game for editing:", error);
      alert(t('tableGame.saveFailed'));
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


  const handleBackToTemplates = () => {
    navigate('/start');
  };

  const _saveGame = () => {
    try {
      const gameData = {
        players: players,
        rows: rows,
        timestamp: new Date().toISOString(),
        targetNumber: targetNumber,
        lowIsBetter: lowIsBetter,
        scoreEntryMode: scoreEntryMode,
        setTargets: setTargets,
        pointHistoryBySet: pointHistoryBySet,
        teamMembers: teamMembers,
        gameFinished: gameFinished,
        gameName: currentGameName
      };

      const name = currentGameName || `${t('tableGame.defaultGameName')} - ${new Date().toLocaleDateString()}`;
      
      // If we have a game ID, update the existing game
      if (currentGameId && activeStorage.tableGameExists(currentGameId)) {
        activeStorage.updateTableGame(currentGameId, {
          gameData: gameData,
          lastPlayed: new Date().toISOString(),
          name: name,
          targetNumber: targetNumber,
          lowIsBetter: lowIsBetter,
          scoreEntryMode: scoreEntryMode,
          setTargets: setTargets,
          pointHistoryBySet: pointHistoryBySet,
          gameFinished: gameFinished
        });
        console.debug(`Updated existing game: "${name}" (ID: ${currentGameId}, finished: ${gameFinished})`);
      } else {
        // Create new save and store the ID
        const newGameId = activeStorage.saveTableGame(gameData, name);
        setCurrentGameId(newGameId);
        console.debug(`Saved new game: "${name}" (ID: ${newGameId})`);
        alert(t('tableGame.gameSavedSuccess', { name }));
      }
    } catch (error) {
      console.error("Error saving table game:", error);
      alert(t('tableGame.saveFailed'));
    }
  };

  // Show error state if game couldn't be loaded
  if (id && loadError && !currentGameId) {
    return (
      <div className="table-game-container">
        <div className="game-error-state">
          <div className="error">{loadError}</div>
          <button className="back-btn" onClick={() => navigate('/table-game')}>
            {t('tableGame.backToGames')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={isDedicatedScoreboardPage ? 'scoreboard-game-container' : 'table-game-container'}>
        <div className={`game-in-progress players-${players.length} ${players.length > 3 ? 'many-players' : ''}`}>
          {/* Round Info Header */}
          <div className="round-info">
            <button 
              className="back-btn"
              onClick={handleBackToTemplates}
              title={t('tableGame.backToGameSelection')}
            >
              <ArrowLeftCircleIcon size={28} />
            </button>
            <span className="game-info-header">
              {currentGameName || t('tableGame.defaultGameName')}
              <div className="total-calls">
                {isTwoSideScoreboard
                  ? (isCloudGame ? t('tableGame.setsLabel', { n: currentRound }) : t('tableGame.setLabel', { n: currentRound }))
                  : (isCloudGame ? t('tableGame.roundsLabel', { n: currentRound }) : t('tableGame.roundLabel', { n: currentRound }))}
              </div>
            </span>
            <button 
              className="settings-btn"
              onClick={() => setShowGameSettingsModal(true)}
              title={t('tableGame.gameSettings')}
            >
              <SettingsIcon size={24} />
            </button>
          </div>

          {/* Finish Game Button */}
          {hasReachedTarget() && !gameFinished && !isBasketballGame && (
            <button className="finish-btn" onClick={handleFinishGame}>
              {t('tableGame.finishGame')}
            </button>
          )}

          {/* Game Tab - Player Scores */}
          {activeTab === 'game' && (
            <div className={`tab-panel ${isTwoSideScoreboard ? 'scoreboard-game-panel' : ''}`}>
              {isTwoSideScoreboard ? (
                <>
                  <div className="two-side-scoreboard">
                    {players.map((player, idx) => {
                      const scoreCard = (
                        <button
                          type="button"
                          className={`score-side-card ${idx === 0 ? 'team-one' : 'team-two'} ${gestureFeedback[idx] === 'swipe-up' ? 'swiping-up' : ''} ${gestureFeedback[idx] === 'swipe-down' ? 'swiping-down' : ''}`}
                          onClick={() => handleScoreCardClick(idx)}
                          onTouchStart={(e) => handleScoreTouchStart(idx, e)}
                          onTouchMove={(e) => handleScoreTouchMove(idx, e)}
                          onTouchEnd={(e) => handleScoreTouchEnd(idx, e)}
                          onTouchCancel={(e) => handleScoreTouchCancel(idx, e)}
                          disabled={gameFinished}
                          title={t('tableGame.gestureHint')}
                        >
                          <span className="score-side-name">{player.name}</span>
                          <span className="score-side-members">
                            {(teamMembers[idx] || []).map((member) => member.name).join(' - ')}
                          </span>
                          <span className={`score-side-value ${scoreValueFeedback[idx] || ''}`}>{getLiveScore(idx)}</span>
                          <span className="score-side-total">
                            {t('tableGame.totalWithScore', { score: getTotal(player) })}
                          </span>
                          {(gestureFeedback[idx] === 'swipe-up' || gestureFeedback[idx] === 'swipe-down') && (
                            <span className={`score-gesture-feedback ${gestureFeedback[idx]}`}>
                              {gestureFeedback[idx] === 'swipe-up' ? '↑' : '↓'}
                            </span>
                          )}
                        </button>
                      );

                      if (!isBasketballGame) {
                        return <React.Fragment key={player.id || idx}>{scoreCard}</React.Fragment>;
                      }

                      return (
                        <div key={player.id || idx} className="score-side-row">
                          {scoreCard}
                          <div className="basketball-score-controls">
                            <button
                              type="button"
                              className="basketball-score-btn"
                              onClick={() => updatePlayerLiveScore(idx, 3)}
                              disabled={gameFinished}
                              title="Add 3 points"
                            >
                              +3
                            </button>
                            <button
                              type="button"
                              className="basketball-score-btn"
                              onClick={() => updatePlayerLiveScore(idx, 2)}
                              disabled={gameFinished}
                              title="Add 2 points"
                            >
                              +2
                            </button>
                            <button
                              type="button"
                              className="basketball-score-btn basketball-revert-btn"
                              onClick={() => revertLastScoreAction(idx)}
                              disabled={gameFinished}
                              title="Revert last score"
                              aria-label="Revert last score"
                            >
                              <ArrowLeftIcon size={18} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              ) : (
                <>
                  <div className="player-scores">
                    <table className="score-table">
                      <thead>
                        <tr>
                          <th className="player-header">{t('tableGame.playerHeader')}</th>
                          <th className="input-header">{t('tableGame.pointsHeader')}</th>
                          <th className="score-header">{t('tableGame.totalHeader')}</th>
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
                                    placeholder={`${t('common.player')} ${idx + 1}`}
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
                    <p>{t('tableGame.roundExplanation1')}</p>
                    <p>{t('tableGame.roundExplanation2')}</p>
                  </div>)}
                </>
              )}
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
                    {t('tableGame.standingsSubTab')}
                  </button>
                  <button 
                    className={`stats-subtab-btn ${statsSubTab === 'chart' ? 'active' : ''}`}
                    onClick={() => setStatsSubTab('chart')}
                  >
                    {t('tableGame.chartsSubTab')}
                  </button>
                  <button 
                    className={`stats-subtab-btn ${statsSubTab === 'table' ? 'active' : ''}`}
                    onClick={() => setStatsSubTab('table')}
                  >
                    {isTwoSideScoreboard ? t('tableGame.setsSubTab') : t('tableGame.tableSubTab')}
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
                                <div className={`player-info ${isTwoSideScoreboard ? 'team-standings-info' : ''}`}>
                                  <span>{playerStats.name}</span>
                                  {isTwoSideScoreboard && (
                                    <span className="team-members-list">
                                      {getTeamMembersLabel(playerStats.id)}
                                    </span>
                                  )}
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
                  isTwoSideScoreboard ? (
                    <div className="score-progression-analytics">
                      <div className="score-progression-chart-wrap">
                        <div
                          className="score-progression-chart"
                          role="img"
                          aria-label={t('tableGame.pointProgressionChartAria', { set: currentRound })}
                        >
                          <ResponsiveContainer width="100%" height={220}>
                            <LineChart
                              data={scoreProgressionSeries}
                              margin={{ top: 8, right: 5, left: -10, bottom: 0 }}
                            >
                              <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                              <XAxis
                                dataKey="pointNumber"
                                axisLine={false}
                                tickLine={false}
                                tick={false}
                                height={0}
                              />
                              <YAxis
                                className="score-progression-y-axis"
                                allowDecimals={false}
                                domain={[0, progressionAxisTop]}
                                ticks={progressionYAxisTicks}
                                axisLine={false}
                                tickLine={false}
                                tick={{ fontSize: 11 }}
                                width={28}
                              />
                              <Tooltip
                                contentStyle={{
                                  background: 'var(--card-bg)',
                                  border: '1px solid var(--border)',
                                  borderRadius: '8px',
                                  color: 'var(--text)',
                                }}
                                labelFormatter={(value) => `${t('common.points')} ${value}`}
                              />
                              <Line
                                type="stepAfter"
                                dataKey="teamOne"
                                stroke="#60a5fa"
                                strokeWidth={3}
                                dot={false}
                                isAnimationActive={false}
                              />
                              <Line
                                type="stepAfter"
                                dataKey="teamTwo"
                                stroke="#f87171"
                                strokeWidth={3}
                                dot={false}
                                isAnimationActive={false}
                              />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>

                        <div className="score-progression-legend">
                          <div className="legend-item team-one">
                            <span className="legend-dot" />
                            <span>{players[0]?.name || t('startTableGame.teamOne')}</span>
                          </div>
                          <div className="legend-item team-two">
                            <span className="legend-dot" />
                            <span>{players[1]?.name || t('startTableGame.teamTwo')}</span>
                          </div>
                        </div>
                      </div>

                      <div className="score-progression-timeline-wrap">
                        <h4>{t('tableGame.rallyTimelineTitle')}</h4>
                        <div className="score-progression-timeline" aria-label={t('tableGame.rallyTimelineAria', { set: currentRound })}>
                          {currentSetPointHistory.map((entry, idx) => {
                            const { scorer, points: scoredPoints } = getPointEventMeta(entry);
                            if (scorer !== 0 && scorer !== 1) {
                              return null;
                            }

                            const teamName = scorer === 0
                              ? (players[0]?.name || t('startTableGame.teamOne'))
                              : (players[1]?.name || t('startTableGame.teamTwo'));

                            return (
                              <span
                                key={`rally-${idx}`}
                                className={`rally-dot ${scorer === 0 ? 'team-one' : 'team-two'} ${isBasketballGame ? 'basketball' : ''}`}
                                title={`${idx + 1}. ${teamName}${isBasketballGame ? ` (+${scoredPoints})` : ''}`}
                              >
                                {isBasketballGame ? `+${scoredPoints}` : ''}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  ) : (
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
                  )
                )}

                {(statsSubTab === 'table' || isLandscape) && (
                  <div className="rounds-section">
                    <div className={`wizard-scorecard ${detailedStats.length > 3 ? 'many-players' : ''}`} data-player-count={detailedStats.length}>
                      <table className="scorecard-table">
                        <thead>
                          <tr>
                            <th className="round-header sticky-cell">{isTwoSideScoreboard ? t('tableGame.setHeader') : t('tableGame.roundHeader')}</th>
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
                            <td className="total-label sticky-cell">{t('common.total')}</td>
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
          {!isCloudGame && (
          <div className="game-bottom-section">
            {/* Toggle Button for Game / Stats - hidden for cloud games (read-only view) */}
            
              <div className="toggle-section">
                <button
                  className="game-control-btn"
                  onClick={() => setActiveTab(activeTab === 'game' ? 'stats' : 'game')}
                  title={activeTab === 'game' ? t('tableGame.switchToStats') : t('tableGame.switchToGame')}
                >
                  {activeTab === 'game' ? <BarChartIcon size={27} /> : <GamepadIcon size={27} />}
                </button>
              </div>
            

            <div className="game-controls">
              {isTwoSideScoreboard && isVolleyballGame && (
                <button
                  type="button"
                  className="game-control-btn"
                  onClick={toggleCurrentSetTarget}
                  title={t('tableGame.toggleSetTargetHint', { n: currentRound, target: getSetTarget() === 15 ? 25 : 15 })}
                >
                  {getSetTarget() === 15 ? t('tableGame.setTargetTo25') : t('tableGame.setTargetTo15')}
                </button>
              )}
              {isTwoSideScoreboard && isBasketballGame && !gameFinished && (
                <button
                  type="button"
                  className="game-control-btn"
                  onClick={handleFinishGame}
                  title={t('tableGame.finishGame')}
                >
                  {t('tableGame.finishGame')}
                </button>
              )}
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
              disabled={isTwoSideScoreboard ? !isCurrentSetWon() : !isCurrentRoundComplete()}
            >
              <ArrowRightIcon />
            </button>
          </div>
          )}

          {/* Delete Player Confirmation Modal */}
          <DeleteConfirmationModal
            isOpen={showDeletePlayerConfirm}
            onClose={cancelDeletePlayer}
            onConfirm={confirmDeletePlayer}
            title={t('tableGame.deletePlayerTitle')}
            message={
              playerToDelete !== null
                ? t('tableGame.deletePlayerMessage', { name: players[playerToDelete]?.name })
                : t('tableGame.deletePlayerDefault')
            }
            confirmText={t('tableGame.deletePlayerConfirm')}
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
            scoreEntryMode={scoreEntryMode}
            teamMembers={teamMembers}
            currentRoundScores={players.map((_, idx) => getLiveScore(idx))}
            onUpdateRoundScore={setPlayerLiveScore}
            onAdjustRoundScore={updatePlayerLiveScore}
            onUpdateTeamMembers={setTeamMembers}
            onUpdateSettings={(settings) => {
              if (settings.players) setPlayers(settings.players);
              if (settings.rows) setRows(settings.rows);
              if (settings.targetNumber !== undefined) setTargetNumber(settings.targetNumber);
              if (settings.lowIsBetter !== undefined) setLowIsBetter(settings.lowIsBetter);
              setShowGameSettingsModal(false);
            }}
            gameFinished={gameFinished}
          />

          {/* Finish Game Confirmation Modal */}
          <DeleteConfirmationModal
            isOpen={showFinishGameConfirm}
            onClose={() => setShowFinishGameConfirm(false)}
            onConfirm={confirmFinishGame}
            title={t('tableGame.finishGame')}
            message={t('tableGame.finishGameConfirm')}
            confirmText={t('tableGame.finishGame')}
          />
        </div>
    </div>
  );
};

export { TableGame };
export default TableGame;

TableGame.propTypes = {
  forceScoreEntryMode: PropTypes.string,
};
