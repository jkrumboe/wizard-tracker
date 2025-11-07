import React, { useState, useEffect, useRef } from "react";
import { ArrowLeftIcon, ArrowRightIcon, XIcon, ArrowLeftCircleIcon, SaveIcon } from "../../components/ui/Icon";
import { LocalTableGameTemplate, LocalTableGameStorage } from "../../shared/api";
import GameTemplateSelector from "../../components/game/GameTemplateSelector";
import { SyncStatusIndicator } from "../../components/game";
import { useUser } from "../../shared/hooks/useUser";
import "../../styles/components/TableGame.css";

const MIN_PLAYERS = 2;

const TableGame = () => {
  const { user } = useUser(); // Get the logged-in user
  
  const [rows, setRows] = useState(() => {
    const isSmallLandscape = window.matchMedia('(orientation: landscape) and (max-width: 950px)').matches;
    const initialRows = isSmallLandscape ? 4 : 10;
    console.log('Initial rows state:', { isSmallLandscape, initialRows, windowWidth: window.innerWidth, orientation: window.screen.orientation?.type });
    return initialRows;
  });
  
  const [activeTab, setActiveTab] = useState('table'); // 'table' or 'scoreboard'
  
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
        currentGameId
      };
      sessionStorage.setItem('currentTableGameState', JSON.stringify(gameState));
    }
  }, [players, rows, currentGameName, currentGameId, showTemplateSelector]);

  // Restore game state from sessionStorage on mount (after HMR)
  useEffect(() => {
    const savedState = sessionStorage.getItem('currentTableGameState');
    if (savedState && showTemplateSelector) {
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
          setShowTemplateSelector(false);
          console.debug('🔄 Restored game state from session after HMR');
        }
      } catch (error) {
        console.error('Failed to restore game state:', error);
      }
    }
  }, []); // Only run once on mount

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
  }, [players, rows, currentGameName, currentGameId, showTemplateSelector]);

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
            timestamp: new Date().toISOString()
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
              name: name
            });
            console.debug(`💾 Periodic auto-save: "${name}" (ID: ${currentGameId})`);
          }
        } catch (error) {
          console.error('❌ Periodic auto-save failed:', error);
        }
      }
    }, 5000); // Save every 5 seconds
    
    return () => clearInterval(autoSaveInterval);
  }, [players, rows, currentGameName, currentGameId, showTemplateSelector]);

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
            timestamp: new Date().toISOString()
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
              name: name
            });
            console.debug(`✅ Silent save on navigation: "${name}" (ID: ${currentId})`);
          }
        } catch (error) {
          console.error('❌ Failed to save on navigation:', error);
        }
      }
    };
  }, []); // Empty dependency array - only set up once

  // Auto-save on browser close/refresh
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      const currentPlayers = playersRef.current;
      const currentRows = rowsRef.current;
      const currentName = currentGameNameRef.current;
      const currentId = currentGameIdRef.current;
      const isShowingTemplateSelector = showTemplateSelectorRef.current;
      
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
            timestamp: new Date().toISOString()
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
              name: name
            });
            console.debug(`✅ Silent save on browser close: "${name}" (ID: ${currentId})`);
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
      const parsed = parseInt(value, 10);
      updated[playerIdx].points[rowIdx] = isNaN(parsed) ? "" : parsed;
      
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
    const newPlayers = [...players];
    newPlayers.splice(idx, 1);
    setPlayers(newPlayers);
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
    return player.points.reduce((sum, val) => sum + (parseInt(val, 10) || 0), 0);
  };

  const loadGame = (gameData) => {
    try {
      if (gameData && gameData.players) {
        setPlayers(gameData.players);
        setRows(gameData.rows || 10);
        setShowTemplateSelector(false);
        
        // Set the game name and ID from the loaded game
        const loadedGameName = gameData.gameName || "Loaded Game";
        const loadedGameId = gameData.gameId || null;
        setCurrentGameName(loadedGameName);
        setCurrentGameId(loadedGameId);
        
        console.debug(`Loaded game: "${loadedGameName}" (ID: ${loadedGameId})`);
      }
    } catch (error) {
      console.error("Error loading table game:", error);
    }
  };

  const handleSelectTemplate = (templateName) => {
    setCurrentGameName(templateName);
    setCurrentGameId(null); // New game, no ID yet
    setShowTemplateSelector(false);
    // Reset the game state with the logged-in user as the first player
    const firstPlayerName = user?.username || user?.name || "Player 1";
    setPlayers([
      { name: firstPlayerName, points: [] },
      { name: "Player 2", points: [] },
      { name: "Player 3", points: [] }
    ]);
    // Set rows based on current orientation
    const isSmallLandscape = window.matchMedia('(orientation: landscape) and (max-width: 950px)').matches;
    const newRows = isSmallLandscape ? 8 : 10;
    console.log('Setting rows on template select:', { isSmallLandscape, newRows });
    setRows(newRows);
  };

  const handleCreateNewGame = (newGameName) => {
    if (newGameName && newGameName.trim()) {
      const trimmedName = newGameName.trim();
      // Save as a template
      LocalTableGameTemplate.saveTemplate(trimmedName);
      // Start the game with this name
      handleSelectTemplate(trimmedName);
    }
  };

  const handleBackToTemplates = () => {
    setShowTemplateSelector(true);
    setCurrentGameName("");
    setCurrentGameId(null);
    // Clear session storage
    sessionStorage.removeItem('currentTableGameId');
    sessionStorage.removeItem('currentTableGameState');
  };

  const saveGame = () => {
    try {
      const gameData = {
        players: players,
        rows: rows,
        timestamp: new Date().toISOString()
      };

      const name = currentGameName || `Table Game - ${new Date().toLocaleDateString()}`;
      
      // If we have a game ID, update the existing game
      if (currentGameId && LocalTableGameStorage.tableGameExists(currentGameId)) {
        LocalTableGameStorage.updateTableGame(currentGameId, {
          gameData: gameData,
          lastPlayed: new Date().toISOString(),
          name: name
        });
        console.debug(`Updated existing game: "${name}" (ID: ${currentGameId})`);
        alert(`Game "${name}" updated successfully!`);
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
                        inputMode="numeric"
                        pattern="-?[0-9]*"
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
                  >
                    Add Row
                  </button>
                </td>
              </tr>
            </tbody>
            <tfoot>
              <tr>
                {players.map((player, idx) => (
                  <td key={idx} className="table-game-total">
                    {getTotal(player)}
                  </td>
                ))}
              </tr>
              {/* Controls Row */}
              <tr className="table-game-controls-row">
                {players.map((_, idx) => (
                  <td key={`controls-${idx}`} className="table-game-controls-cell">
                    <div className="table-game-controls">
                      <button
                        className={`table-game-control-btn table-game-move-btn ${idx === 0 ? 'disabled' : ''}`}
                        title="Move Left"
                        onClick={() => movePlayerLeft(idx)}
                        disabled={idx === 0}
                      >
                        <ArrowLeftIcon size={16} />
                      </button>
                      {players.length > MIN_PLAYERS && (
                        <button
                          className="table-game-control-btn table-game-remove-btn"
                          title="Remove Player"
                          onClick={() => removePlayer(idx)}
                        >
                          <XIcon size={16} />
                        </button>
                      )}
                      <button
                        className={`table-game-control-btn table-game-move-btn ${idx === players.length - 1 ? 'disabled' : ''}`}
                        title="Move Right"
                        onClick={() => movePlayerRight(idx)}
                        disabled={idx === players.length - 1}
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
              .sort((a, b) => b.total - a.total) // Sort by total descending (biggest to smallest)
              .map((player, index, array) => {
                // Calculate rank with proper tie handling
                let rank = 1;
                
                // Count how many players have a higher score
                for (let i = 0; i < index; i++) {
                  if (array[i].total > player.total) {
                    rank++;
                  }
                }
                
                return (
                  <div key={player.originalIndex} className="scoreboard-item" data-rank={rank}>
                    <div className="scoreboard-rank">#{rank}</div>
                    <div className="scoreboard-player-name">{player.name || `Player ${player.originalIndex + 1}`}</div>
                    <div className="scoreboard-score">{player.total}</div>
                  </div>
                );
              })}
          </div>
        </div>
      )}
          
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
        </>
      )}
    </div>
  );
};

export default TableGame;
