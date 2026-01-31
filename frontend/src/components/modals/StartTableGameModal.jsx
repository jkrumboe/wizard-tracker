import React, { useState, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import { XIcon, UsersIcon, PlayIcon, PlusIcon, CheckMarkIcon } from '@/components/ui/Icon';
import { GripVertical, Dices as DiceIcon } from 'lucide-react';
import { localFriendsService, userService } from '@/shared/api';
import { useUser } from '@/shared/hooks/useUser';
import SelectFriendsModal from '@/components/modals/SelectFriendsModal';
import '@/styles/components/modal.css';
import '@/styles/components/start-table-game-modal.css';
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
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  restrictToVerticalAxis,
  restrictToParentElement,
} from '@dnd-kit/modifiers';

const MAX_PLAYERS = 10;

// Sortable Player Item Component
const SortablePlayerItem = ({ player, index, onNameChange, onNameBlur, onRemove, canRemove, isLookingUp }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ 
    id: player.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.7 : 1,
    zIndex: isDragging ? 1000 : 1,
  };

  const dragListeners = {
    ...listeners,
  };

  // Player is verified if they have a userId (from friend selection or user lookup)
  const isVerified = !!player.userId;

  return (
    <div 
      ref={setNodeRef}
      style={style}
      className={`player-item ${isDragging ? 'dragging' : ''} ${isVerified ? 'verified' : ''}`}
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
        type="text"
        className="inputPlayerName" 
        value={player.name}
        onChange={(e) => onNameChange(player.id, e.target.value)}
        onBlur={(e) => onNameBlur?.(player.id, e.target.value)}
        onFocus={(e) => e.target.select()}
        placeholder={`Player ${index + 1}`}
      />

      {isLookingUp && (
        <span className="lookup-spinner" title="Looking up user...">
          ⏳
        </span>
      )}
      
      {canRemove && (
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
      )}
    </div>
  );
};

SortablePlayerItem.propTypes = {
  player: PropTypes.shape({
    id: PropTypes.string.isRequired,
    name: PropTypes.string.isRequired,
    userId: PropTypes.string,
  }).isRequired,
  index: PropTypes.number.isRequired,
  onNameChange: PropTypes.func.isRequired,
  onNameBlur: PropTypes.func,
  onRemove: PropTypes.func.isRequired,
  canRemove: PropTypes.bool.isRequired,
  isLookingUp: PropTypes.bool,
};

const StartTableGameModal = ({ isOpen, onClose, onStart, templateName, templateSettings }) => {
  const { user } = useUser();
  const [players, setPlayers] = useState([]);
  const [friends, setFriends] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showSelectFriendsModal, setShowSelectFriendsModal] = useState(false);
  const [lookingUpPlayers, setLookingUpPlayers] = useState(new Set()); // Track which players are being looked up
  const lookupTimeouts = useRef({}); // Debounce timeouts for user lookup

  // @dnd-kit sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 150,
        tolerance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const initializePlayers = () => {
    // Initialize with just the logged-in user and one other player
    const initialPlayers = [
      {
        id: `player-${Date.now()}-0`,
        name: user?.username || user?.name || 'Player 1',
        userId: user?.id || null // Use logged-in user's ID
      },
      {
        id: `player-${Date.now()}-1`,
        name: '',
        userId: null
      }
    ];
    setPlayers(initialPlayers);
  };

  const addPlayer = () => {
    if (players.length >= MAX_PLAYERS) return;
    
    setPlayers(prev => [
      ...prev,
      {
        id: `player-${Date.now()}-${prev.length}`,
        name: '',
        userId: null
      }
    ]);
  };

  const removePlayer = (playerId) => {
    setPlayers(prev => prev.filter(p => p.id !== playerId));
  };

  const handleRandomizePlayers = () => {
    setPlayers(prev => {
      const shuffled = [...prev];
      // Fisher-Yates shuffle
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      return shuffled;
    });
  };

  useEffect(() => {
    if (isOpen) {
      loadFriends();
      initializePlayers();
    } else {
      // Clear players when modal closes to prevent persistence across different game types
      setPlayers([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, user]);

  const loadFriends = async () => {
    // Only load friends if user is logged in
    if (!user?.id) {
      setFriends([]);
      return;
    }
    
    setLoading(true);
    try {
      // If user is logged in and online, fetch from server
      if (navigator.onLine) {
        try {
          const cloudFriends = await userService.getFriends(user.id);
          setFriends(cloudFriends);
        } catch (err) {
          console.warn('Could not fetch friends from cloud:', err);
          setFriends([]);
        }
      } else {
        setFriends([]);
      }
    } catch (err) {
      console.error('Error loading friends:', err);
      setFriends([]);
    } finally {
      setLoading(false);
    }
  };

  const handlePlayerNameChange = (playerId, name) => {
    // Clear userId when name is manually changed (will be re-looked up on blur)
    setPlayers(prev => prev.map(p => 
      p.id === playerId ? { ...p, name, userId: null } : p
    ));
  };

  // Look up user by username when input loses focus
  const handlePlayerNameBlur = async (playerId, name) => {
    const trimmedName = name?.trim();
    if (!trimmedName) return;

    // Clear any pending lookup for this player
    if (lookupTimeouts.current[playerId]) {
      clearTimeout(lookupTimeouts.current[playerId]);
    }

    // Check if name matches the logged-in user
    if (user && trimmedName.toLowerCase() === user.username?.toLowerCase()) {
      setPlayers(prev => prev.map(p => 
        p.id === playerId ? { ...p, name: user.username, userId: user.id } : p
      ));
      return;
    }

    // Check if name matches any friend
    const matchingFriend = friends.find(f => 
      f.username.toLowerCase() === trimmedName.toLowerCase()
    );
    if (matchingFriend) {
      setPlayers(prev => prev.map(p => 
        p.id === playerId ? { ...p, name: matchingFriend.username, userId: matchingFriend.id } : p
      ));
      return;
    }

    // Look up user in backend
    setLookingUpPlayers(prev => new Set([...prev, playerId]));
    try {
      const result = await userService.lookupUserByUsername(trimmedName);
      if (result.found && result.user) {
        setPlayers(prev => prev.map(p => 
          p.id === playerId ? { ...p, name: result.user.username, userId: result.user.id } : p
        ));
      }
    } catch (error) {
      console.warn('Error looking up user:', error);
    } finally {
      setLookingUpPlayers(prev => {
        const newSet = new Set(prev);
        newSet.delete(playerId);
        return newSet;
      });
    }
  };

  const handleSelectFriends = (selectedFriends) => {
    // Add selected friends as new players with their userId
    const newPlayers = selectedFriends.map((friend, idx) => ({
      id: `player-${Date.now()}-friend-${idx}`,
      name: friend.username,
      userId: friend.id // Store the friend's user ID
    }));
    
    setPlayers(prev => {
      const combined = [...prev, ...newPlayers];
      // Limit to MAX_PLAYERS
      return combined.slice(0, MAX_PLAYERS);
    });
    
    setShowSelectFriendsModal(false);
  };

  // @dnd-kit drag end handler
  const handleDragEnd = (event) => {
    const { active, over } = event;

    if (active.id !== over?.id) {
      setPlayers((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over.id);
        
        if (oldIndex !== -1 && newIndex !== -1) {
          const newItems = [...items];
          const [removed] = newItems.splice(oldIndex, 1);
          newItems.splice(newIndex, 0, removed);
          return newItems;
        }
        
        return items;
      });
    }
  };

  // Get available friends excluding already selected ones
  const getAvailableFriends = () => {
    const selectedUserIds = new Set(
      players
        .map(p => p.userId)
        .filter(id => id !== null)
    );
    
    return friends.filter(f => !selectedUserIds.has(f.id));
  };

  const handleStart = () => {
    // Validate at least 2 players
    if (players.length < 2) {
      alert('At least 2 players are needed to start a game');
      return;
    }

    // Validate all players have names
    const allPlayersNamed = players.every(p => p.name && p.name.trim().length > 0);
    if (!allPlayersNamed) {
      alert('Please provide names for all players');
      return;
    }

    // Return full player data including userId for registered users
    const playerData = players.map(p => ({
      name: p.name.trim(),
      userId: p.userId || null
    }));
    onStart(playerData, templateSettings);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-container start-table-game-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Start {templateName}</h2>
          <button className="close-btn" onClick={onClose}>
            <XIcon size={20} />
          </button>
        </div>

        <div className="modal-content">
          {/* Player Assignment */}
          <div className="players-section">
            <h3>Players ({players.length}/{MAX_PLAYERS})</h3>
            
            {loading ? (
              <div className="loading-message">Loading friends...</div>
            ) : (
              <>
                <DndContext 
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEnd}
                  modifiers={[restrictToVerticalAxis, restrictToParentElement]}
                >
                  <SortableContext 
                    items={players.map(p => p.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    <div className="players-list">
                      {players.map((player, index) => (
                        <SortablePlayerItem
                          key={player.id}
                          player={player}
                          index={index}
                          onNameChange={handlePlayerNameChange}
                          onNameBlur={handlePlayerNameBlur}
                          onRemove={removePlayer}
                          canRemove={true}
                          isLookingUp={lookingUpPlayers.has(player.id)}
                        />
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>

                {/* Player Actions */}
                <div className="player-actions">
                  <button 
                    className="randomizer-btn"
                    onClick={handleRandomizePlayers}
                    disabled={players.length < 2}
                    title="Randomize player order"
                  >
                    <DiceIcon size={20} />
                  </button>
                  <button 
                    className="add-player-btn"
                    onClick={addPlayer}
                    disabled={players.length >= MAX_PLAYERS}
                    title="Add Player"
                  >
                    <PlusIcon size={20} />
                  </button>
                  <button 
                    className="add-friends-btn"
                    onClick={() => setShowSelectFriendsModal(true)}
                    disabled={players.length >= MAX_PLAYERS || getAvailableFriends().length === 0}
                    title="Add Friends"
                  >
                    <UsersIcon size={20} />
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Game Settings Info */}
          {templateSettings && (
            <div className="game-settings-info">
              {/* <h4>Game Settings</h4> */}
              <div className="settings-details">
                {templateSettings.targetNumber && (
                  <div className="setting-item">
                    <span>Target: </span>
                    <p>{templateSettings.targetNumber}</p>
                  </div>
                )}
                {templateSettings.lowIsBetter !== undefined && (
                  <div className="setting-item">
                    <span>Goal: </span>
                    <p>{templateSettings.lowIsBetter ? 'Low Score' : 'High Score'}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          
        </div>
        {/* Action Buttons */}
          <div className="modal-actions">
            <button type="button" onClick={onClose} className="cancel-button">
              Cancel
            </button>
            <button 
              type="button" 
              onClick={handleStart} 
              className="start-button"
              disabled={players.length < 2 || !players.every(p => p.name && p.name.trim().length > 0)}
            >
              <PlayIcon size={18} />
              Start
            </button>
          </div>
      </div>

      {/* Select Friends Modal */}
      <SelectFriendsModal
        isOpen={showSelectFriendsModal}
        onClose={() => setShowSelectFriendsModal(false)}
        onConfirm={handleSelectFriends}
        alreadySelectedPlayers={players.filter(p => p.userId).map(p => ({ userId: p.userId, name: p.name }))}
      />
    </div>
  );
};

StartTableGameModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onStart: PropTypes.func.isRequired,
  templateName: PropTypes.string.isRequired,
  templateSettings: PropTypes.shape({
    targetNumber: PropTypes.number,
    lowIsBetter: PropTypes.bool,
  }),
};

export default StartTableGameModal;
