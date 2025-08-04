"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useNavigate } from "react-router-dom"
import { useGameStateContext } from "@/shared/hooks/useGameState"
import { LocalGameStorage } from "@/shared/api"
import DeleteConfirmationModal from '@/components/modals/DeleteConfirmationModal';
import { GripVertical } from 'lucide-react';

const NewGame = () => {
  
  const navigate = useNavigate()
  // const { players, loading } = usePlayers()
  const { 
    gameState, 
    addPlayer, 
    removePlayer, 
    updatePlayerName, 
    reorderPlayers,
    startGame, 
    setMaxRounds, 
    getSavedGames, 
    resumeGame, 
    deleteSavedGame,
    resetGame 
  } = useGameStateContext()

  // No longer need index since we generate unique IDs in addPlayer
  // Always default to the new-game tab, never auto-switch
  const [activeTab, setActiveTab] = useState('new-game')
  const [pausedGames, setPausedGames] = useState([])
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)
  const [gameToDelete, setGameToDelete] = useState(null)
  const [message, setMessage] = useState({ text: '', type: '' })
  const [draggedIndex, setDraggedIndex] = useState(null)
  const [dragOverIndex, setDragOverIndex] = useState(null)
  const [touchStartY, setTouchStartY] = useState(null)
  const [isDraggingTouch, setIsDraggingTouch] = useState(false)
  const [longPressTimer, setLongPressTimer] = useState(null)
  
  // Ref for auto-scrolling to bottom of player list
  const selectedPlayersRef = useRef(null)
  
  // Function to load paused games
  const loadPausedGames = useCallback(async () => {
    try {
      // Debug local storage
      // LocalGameStorage.debugStorage();
      
      // Get all saved games
      const games = await getSavedGames();
      
      // Filter to only include games that are not finished and are marked as paused
      const paused = games.filter(game => 
        !game.gameFinished && game.isPaused === true
      );
      
      setPausedGames(paused);
    
      // We want the new-game tab to always be the default
    } catch (error) {
      console.error("Error loading paused games:", error);
    }
  }, [getSavedGames]);
    
  // Load paused games only when the component mounts (first render)
  useEffect(() => {
    loadPausedGames();
  }, [loadPausedGames]);
  
  // Reset game state when entering the new game page to ensure a clean state
  useEffect(() => {
    resetGame();
  }, [resetGame]);
  
  // Also refresh when activeTab changes to 'paused-games'
  useEffect(() => {
    if (activeTab === 'paused-games') {
      loadPausedGames();
    }
  }, [activeTab, loadPausedGames]);

  const handleAddPlayer = () => {
    // Call addPlayer without any arguments as it now generates unique IDs internally
    addPlayer()
    
    // Scroll to bottom after adding player (use setTimeout to ensure DOM update)
    setTimeout(() => {
      if (selectedPlayersRef.current) {
        selectedPlayersRef.current.scrollTo({
          top: selectedPlayersRef.current.scrollHeight,
          behavior: 'smooth'
        })
      }
    }, 100)
  }

  const handlePlayerNameChange = (playerId, e) => {
    const newName = e.target.value
    updatePlayerName(playerId, newName)
  }

  const handleRemovePlayer = (playerId) => {
    removePlayer(playerId)
  }

  // Drag and drop handlers
  const handleDragStart = (e, index) => {
    setDraggedIndex(index)
    e.dataTransfer.effectAllowed = 'move'
    // Add a visual indicator that we're dragging
    e.target.style.opacity = '0.5'
  }

  const handleDragEnd = (e) => {
    e.target.style.opacity = '1'
    setDraggedIndex(null)
    setDragOverIndex(null)
  }

  const handleDragOver = (e, index) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    
    if (draggedIndex !== null && draggedIndex !== index) {
      setDragOverIndex(index)
    }
  }

  const handleDragLeave = () => {
    setDragOverIndex(null)
  }

  const handleDrop = (e) => {
    e.preventDefault()
    
    if (draggedIndex !== null && dragOverIndex !== null && draggedIndex !== dragOverIndex) {
      reorderPlayers(draggedIndex, dragOverIndex)
    }
    
    setDraggedIndex(null)
    setDragOverIndex(null)
  }

  // Touch event handlers for mobile
  const handleTouchStart = (e, index) => {
    setTouchStartY(e.touches[0].clientY)
    
    // Start a timer for long press detection
    const timer = setTimeout(() => {
      setDraggedIndex(index)
      setIsDraggingTouch(true)
      // Add haptic feedback if available
      if (navigator.vibrate) {
        navigator.vibrate(50)
      }
    }, 150) // 150ms delay for long press detection
    
    setLongPressTimer(timer)
  }

  const handleTouchMove = (e) => {
    if (!isDraggingTouch || draggedIndex === null) return
    
    e.preventDefault()
    const touchY = e.touches[0].clientY
    const playerItems = document.querySelectorAll('.player-item')
    
    // Find which item we're over
    let newDragOverIndex = null
    let closestDistance = Infinity
    
    playerItems.forEach((item, index) => {
      const rect = item.getBoundingClientRect()
      const itemCenterY = rect.top + rect.height / 2
      const distance = Math.abs(touchY - itemCenterY)
      
      if (distance < closestDistance) {
        closestDistance = distance
        newDragOverIndex = index
      }
    })
    
    if (newDragOverIndex !== null && newDragOverIndex !== draggedIndex) {
      setDragOverIndex(newDragOverIndex)
    }
  }

  const handleTouchEnd = () => {
    // Clear the long press timer
    if (longPressTimer) {
      clearTimeout(longPressTimer)
      setLongPressTimer(null)
    }
    
    if (!isDraggingTouch) return
    
    if (draggedIndex !== null && dragOverIndex !== null && draggedIndex !== dragOverIndex) {
      reorderPlayers(draggedIndex, dragOverIndex)
    }
    
    setDraggedIndex(null)
    setDragOverIndex(null)
    setIsDraggingTouch(false)
    setTouchStartY(null)
  }

  // Helper function to get CSS classes for visual reordering
  const getPlayerItemClass = (index) => {
    let classes = 'player-item'
    
    if (draggedIndex === index) {
      classes += ' dragging'
    } else if (draggedIndex !== null && dragOverIndex !== null) {
      // Visual reordering logic
      if (draggedIndex < dragOverIndex) {
        // Dragging down: items between draggedIndex and dragOverIndex move up
        if (index > draggedIndex && index <= dragOverIndex) {
          classes += ' will-move-up'
        }
      } else if (draggedIndex > dragOverIndex) {
        // Dragging up: items between dragOverIndex and draggedIndex move down  
        if (index >= dragOverIndex && index < draggedIndex) {
          classes += ' will-move-down'
        }
      }
    }
    
    return classes
  }

  const handleStartGame = () => {
    startGame()
    navigate("/game/current")
  }

  // Handle loading a saved game
  const handleLoadGame = async (gameId) => {
    try {
      const result = await resumeGame(gameId);
      if (result && result.success) {
        navigate("/game/current");
        return { success: true };
      } else {
        return { 
          success: false, 
          error: result && result.error ? result.error : "Failed to load game"
        };
      }
    } catch (error) {
      console.error("Error loading game:", error);
      return { 
        success: false, 
        error: error.message 
      };
    }
  }

  // Handle showing delete confirmation dialog
  const handleDeleteGame = (gameId) => {
    setGameToDelete(gameId);
    setShowConfirmDialog(true);
  };

  // Handle confirming the delete action
  const handleConfirmDelete = async () => {
    if (gameToDelete) {
      try {
        const result = await deleteSavedGame(gameToDelete);
        if (result && result.success) {
          setPausedGames(prevGames => prevGames.filter(game => game.id !== gameToDelete));
          setMessage({ text: 'Game deleted successfully.', type: 'success' });
        } else {
          setMessage({ 
            text: result && result.error ? result.error : "Failed to delete game", 
            type: 'error' 
          });
        }
      } catch (error) {
        console.error("Error deleting game:", error);
        setMessage({ text: error.message, type: 'error' });
      }
    }
    setShowConfirmDialog(false);
    setGameToDelete(null);
  };

  const clearMessage = () => {
    setTimeout(() => {
      setMessage({ text: '', type: '' });
    }, 3000);
  };

  useEffect(() => {
    if (message.text) {
      clearMessage();
    }
  }, [message]);
  
  const handleMaxRoundsChange = (value) => {    
    // Ensure the value is between 0 and 20 (the maximum possible)
    const validValue = Math.max(0, Math.min(value, 20));
    setMaxRounds(validValue);
  }

  // Calculate the recommended rounds once (memoized)
  const recommendedRounds = gameState.players.length > 2 && gameState.players.length <= 6 
    ? Math.floor(60 / gameState.players.length)
    : 20; // Default max

  const normalizeDate = (date) => {
    if (!date) return "Unbekanntes Datum";
    const d = new Date(date);
    return d.toLocaleString("en-DE", {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
  };

  return (
    <div className="new-game-container">
      {/* {message.text && (
        <div className={`settings-message ${message.type}`}>
          {message.text}
        </div>
      )} */}

      <div className="tab-controls">
        <button 
          className={`tab-button ${activeTab === 'new-game' ? 'active' : ''}`}
          onClick={() => setActiveTab('new-game')}
        >
          New Game
        </button>
        <button 
          className={`tab-button ${activeTab === 'paused-games' ? 'active' : ''}`}
          onClick={() => setActiveTab('paused-games')}
        >
          Paused Games
        </button>
      </div>

      {activeTab === 'new-game' && (
        <div className={`tab-panel players-${gameState.players.length}`}>
          <div className="setup-section">
            {/*Adding Players*/}
            <div className="selected-players-wrapper">
              <div className="selected-players" ref={selectedPlayersRef}>
                <div className="player-list">
                  {gameState.players.map((player, index) => (
                    <div 
                      key={player.id} 
                      className={getPlayerItemClass(index)}
                      draggable
                      onDragStart={(e) => handleDragStart(e, index)}
                      onDragEnd={handleDragEnd}
                      onDragOver={(e) => handleDragOver(e, index)}
                      onDragLeave={handleDragLeave}
                      onDrop={(e) => handleDrop(e)}
                      onTouchStart={(e) => handleTouchStart(e, index)}
                      onTouchMove={handleTouchMove}
                      onTouchEnd={handleTouchEnd}
                      style={{ touchAction: 'none' }}
                    >
                      <GripVertical size={16} className="drag-handle" />
                      <span className="player-number">{index + 1}</span>
                      <input 
                        className="inputPlayerName" 
                        value={player.name} 
                        inputMode="text" 
                        onChange={(e) => handlePlayerNameChange(player.id, e)}
                        onTouchStart={(e) => e.stopPropagation()}
                      />
                      <button className="remove-btn" onClick={() => handleRemovePlayer(player.id)}>
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <button className="addPlayer" onClick={handleAddPlayer}>
              +
            </button>
            
            <div className="settings-group">
              <div className="setting-item">
                <div className="setting-content">
                  <div id="rounds">
                    <label htmlFor="rounds-input">Number of Rounds:</label>
                    <input
                      id="rounds-input"
                      type="tel"
                      value={gameState.maxRounds}
                      onChange={(e) => handleMaxRoundsChange(parseInt(e.target.value) || 0)}
                      min={1}
                      max={recommendedRounds ? recommendedRounds : 20}
                      inputMode="numeric"
                      pattern="[0-9]*"
                    />
                  </div>
                  <div className="rounds-hint">
                        Recommended: {recommendedRounds} rounds
                  </div>
                </div>
              </div>
            </div>
          </div>

          <button 
            className="start-game-btn" 
            disabled={gameState.players.length < 2 || gameState.players.length > 6} 
            onClick={handleStartGame}
          >
            Start Game
          </button>
          
          {gameState.players.length < 3 && (
            <div className="error-message">At least 3 players are needed to start a game</div>
          )}
          
          {gameState.players.length > 6 && (
            <div className="error-message">Maximum of 6 players are supported</div>
          )}
        </div>
      )}

      {activeTab === 'paused-games' && (
        <div className="tab-panel">
          <div className="paused-games-section">            
            {pausedGames.length === 0 ? (
              <div className="empty-paused-games">
                <p>No paused games found</p>
                <p>When you pause a game, it will appear here</p>
              </div>
            ) : (
              <div className="paused-games-list">
                {pausedGames.map(game => (
                  <div key={game.id} className="game-card">
                    <div className="settings-card-content">
                      <div className="settings-card-header">
                        <div className="game-info">
                          <div>Round {(game.roundsCompleted || 0) + 1}/{game.totalRounds || game.gameState?.maxRounds || 0}</div>
                        </div>
                        <div className="game-players">
                          Players:{" "}
                          {game.gameState?.players 
                            ? game.gameState.players.map(player => player.name || "Unknown Player").join(", ")
                            : game.players && game.players.join(", ") || "No players"}
                        </div>
                        <div className="actions-game-history">
                          <div className="bottom-actions-game-history">
                            <span className={`mode-badge ${(game.game_mode || game.mode || (game.gameState && game.gameState.mode) || 'local').toLowerCase()}`}>
                              {game.game_mode || game.mode || (game.gameState && game.gameState.mode) || 'Local'}
                            </span>
                            <div className="game-date">
                              {normalizeDate(game.lastPlayed)}
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      <div className="settings-card-actions">
                        <button 
                          className="resume-btn" 
                          onClick={() => handleLoadGame(game.id)}
                        >
                          Resume
                        </button>
                        <button 
                          className="delete-btn" 
                          onClick={() => handleDeleteGame(game.id)}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <DeleteConfirmationModal
        isOpen={showConfirmDialog}
        onClose={() => setShowConfirmDialog(false)}
        onConfirm={handleConfirmDelete}
        deleteAll={false}
      />
    </div>
  )
}

export default NewGame
