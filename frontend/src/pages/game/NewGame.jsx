"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useNavigate } from "react-router-dom"
import { useGameStateContext } from "@/shared/hooks/useGameState"
import { useUser } from "@/shared/hooks/useUser"
import { LocalGameStorage } from "@/shared/api"
import DeleteConfirmationModal from '@/components/modals/DeleteConfirmationModal';
import { SelectFriendsModal } from '@/components/modals';
import { GripVertical } from 'lucide-react';
import { XIcon, DiceIcon, UsersIcon } from '@/components/ui/Icon';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import {
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  restrictToVerticalAxis,
  restrictToParentElement,
} from '@dnd-kit/modifiers';

// Sortable Player Item Component
const SortablePlayerItem = ({ player, index, onNameChange, onRemove }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ 
    id: player.id,
    data: {
      type: 'player',
      player,
      index,
    }
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.7 : 1,
    zIndex: isDragging ? 1000 : 1,
  };

  // Create drag listeners that exclude input and button areas
  const dragListeners = {
    ...listeners,
  };

  return (
    <div 
      ref={setNodeRef}
      style={style}
      className={`player-item ${isDragging ? 'dragging' : ''} ${player.isVerified ? 'verified' : ''}`}
      {...attributes}
    >
      <div
        className="drag-handle"
        style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'grab' }}
        {...dragListeners}
      >
        <GripVertical size={16} />
        <span className="player-number">
          {index + 1}
        </span>
      </div>
      
      <input 
        className="inputPlayerName" 
        value={player.name} 
        inputMode="text" 
        onChange={(e) => onNameChange(player.id, e)}
        placeholder={`Player ${index + 1}`}
      />
      
      {/* {player.isVerified && (
        <span className="verified-badge" title="Registered user">
          ✓
        </span>
      )} */}
      
      <button 
        className="remove-btn" 
        onClick={(e) => {
          e.stopPropagation();
          onRemove(player.id);
        }}
        title="Remove Player"
      >
        <XIcon size={16} />
      </button>
    </div>
  );
};

const NewGame = () => {
  
  const navigate = useNavigate()
  const { user } = useUser()
  // const { players, loading } = usePlayers()
  const { 
    gameState, 
    addPlayer, 
    removePlayer, 
    updatePlayerNameWithLookup, 
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
  const [hasAutoAddedUser, setHasAutoAddedUser] = useState(false)
  const [showSelectFriendsModal, setShowSelectFriendsModal] = useState(false)
  const [totalCards, setTotalCards] = useState(60)
  
  // @dnd-kit sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // Require 8px movement before starting drag
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 150, // Slightly longer delay to differentiate from scrolling
        tolerance: 5, // Allow 8px of movement during the delay
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Custom modifier to restrict dragging to player list container
  const restrictToPlayerList = ({ transform, draggingNodeRect, containerNodeRect }) => {
    if (!draggingNodeRect || !containerNodeRect) {
      return transform;
    }

    const playerListElement = document.querySelector('.player-list');
    if (!playerListElement) {
      return transform;
    }

    const playerListRect = playerListElement.getBoundingClientRect();
    
    // Calculate boundaries relative to the container
    const topBoundary = playerListRect.top - containerNodeRect.top;
    const bottomBoundary = playerListRect.bottom - containerNodeRect.top - draggingNodeRect.height;

    return {
      ...transform,
      y: Math.max(topBoundary, Math.min(bottomBoundary, transform.y)),
    };
  };
  
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
    setHasAutoAddedUser(false); // Reset the flag when resetting the game
  }, [resetGame]);
  
  // Add logged-in user to player list after reset
  useEffect(() => {
    // Only add user once, if we have a logged-in user and haven't auto-added them yet
    if (user && user.username && !hasAutoAddedUser && gameState.players.length === 0 && !gameState.gameStarted) {
      // Add the logged-in user as the first player with their MongoDB user ID and mark as verified
      addPlayer(user.username, user.id, true);
      setHasAutoAddedUser(true); // Mark that we've added the user
    }
  }, [user, hasAutoAddedUser, gameState.players.length, gameState.gameStarted, addPlayer]);
  
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
    // Use the lookup version which will try to find a registered user
    updatePlayerNameWithLookup(playerId, newName)
  }

  const handleRemovePlayer = (playerId) => {
    removePlayer(playerId)
  }

  // @dnd-kit drag end handler
  const handleDragEnd = (event) => {
    const { active, over } = event;

    if (active.id !== over?.id) {
      const oldIndex = gameState.players.findIndex(player => player.id === active.id);
      const newIndex = gameState.players.findIndex(player => player.id === over?.id);
      
      // Only reorder if both indices are valid (within bounds)
      if (oldIndex !== -1 && newIndex !== -1) {
        reorderPlayers(oldIndex, newIndex);
      }
    }
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

  // Handle adding friends to the player list
  const handleAddFriends = (selectedFriends) => {
    selectedFriends.forEach(friend => {
      addPlayer(friend.username, friend.id, true);
    });
    
    // Scroll to bottom after adding friends
    setTimeout(() => {
      if (selectedPlayersRef.current) {
        selectedPlayersRef.current.scrollTo({
          top: selectedPlayersRef.current.scrollHeight,
          behavior: 'smooth'
        })
      }
    }, 100);
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

  const handleRandomizePlayers = () => {
    if (gameState.players.length < 2) return;
    
    // Create a shuffled copy using Fisher-Yates algorithm
    const shuffled = [...gameState.players];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    
    // Convert shuffled array into a series of swap operations
    // that can be applied to the current order
    const current = [...gameState.players];
    
    // Apply swaps to transform current to shuffled
    for (let i = 0; i < shuffled.length; i++) {
      if (current[i].id !== shuffled[i].id) {
        // Find where the correct player currently is
        const correctIdx = current.findIndex(p => p.id === shuffled[i].id);
        if (correctIdx > i) {
          // Swap in the current array (to track state)
          [current[i], current[correctIdx]] = [current[correctIdx], current[i]];
          // Apply the swap to actual state
          reorderPlayers(correctIdx, i);
        }
      }
    }
  }

  // Calculate the recommended rounds based on total cards and player count
  const recommendedRounds = gameState.players.length > 2 && gameState.players.length <= 6 
    ? Math.floor(totalCards / gameState.players.length)
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
        <>
          <div className={`tab-panel players-${gameState.players.length}`} id="new-game-panel">
            <div className="setup-section">
              {/*Adding Players*/}
              <div className="selected-players-wrapper">
                <div className="selected-players" ref={selectedPlayersRef}>
                  <DndContext 
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleDragEnd}
                    modifiers={[restrictToVerticalAxis, restrictToParentElement, restrictToPlayerList]}
                  >
                    <SortableContext 
                      items={gameState.players.map(p => p.id)}
                      strategy={verticalListSortingStrategy}
                    >
                      <div className="player-list">
                        {gameState.players.map((player, index) => (
                          <SortablePlayerItem
                            key={player.id}
                            player={player}
                            index={index}
                            onNameChange={handlePlayerNameChange}
                            onRemove={handleRemovePlayer}
                          />
                        ))}
                      </div>
                    </SortableContext>
                  </DndContext>
                </div>
              </div>

              <div className="player-actions">
                <button 
                  className="randomizer-btn" 
                  onClick={handleRandomizePlayers}
                  title="Randomize player order"
                  aria-label="Randomize player order"
                  disabled={gameState.players.length < 3}
                >
                  <DiceIcon size={25} />
                </button>
                <button className="addPlayer" onClick={handleAddPlayer}>
                  +
                </button>
                <button 
                  className="add-friends-btn" 
                  onClick={() => setShowSelectFriendsModal(true)}
                  title="Add friends to game"
                >
                  <UsersIcon size={20} />
                </button>
              </div>
              
              <div className="settings-group">
                <div className="setting-item">
                  <div className="setting-content">
                    <div className="game-settings-input">
                      
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
                      <div id="cards">
                          <label htmlFor="cards-input">Cards:</label>
                          <input
                            id="cards-input"
                            type="tel"
                            value={totalCards}
                            onChange={(e) => setTotalCards(parseInt(e.target.value) || 60)}
                            min={1}
                            max={100}
                            inputMode="numeric"
                            pattern="[0-9]*"
                          />
                      </div>
                    </div>
                    <div className="rounds-hint">
                          Recommended: {recommendedRounds} rounds
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="new-game-actions">
              <button 
                className="start-game-btn" 
                disabled={gameState.players.length < 3 || gameState.players.length > 8} 
                onClick={handleStartGame}
              >
                Start Game
              </button>
              
              {gameState.players.length < 3 && (
                <div className="error-message">At least 3 players are needed to start a game</div>
              )}
              
              {gameState.players.length > 8 && (
                <div className="error-message">Maximum of 8 players are supported</div>
              )}
            </div>
          </div>          
        </>
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

      <SelectFriendsModal
        isOpen={showSelectFriendsModal}
        onClose={() => setShowSelectFriendsModal(false)}
        onConfirm={handleAddFriends}
        alreadySelectedPlayers={gameState.players}
      />
    </div>
  )
}

export default NewGame
