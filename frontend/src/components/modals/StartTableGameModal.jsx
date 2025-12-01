import React, { useState, useEffect } from 'react';
import { XIcon, UsersIcon, PlayIcon, MinusIcon, PlusIcon } from '@/components/ui/Icon';
import { GripVertical } from 'lucide-react';
import { localFriendsService } from '@/shared/api';
import { useUser } from '@/shared/hooks/useUser';
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

const MIN_PLAYERS = 2;
const MAX_PLAYERS = 10;

// Sortable Player Item Component
const SortablePlayerItem = ({ player, index, onNameChange, friends, showFriendDropdown, setShowFriendDropdown, onSelectFriend }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ 
    id: `player-${index}`,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.7 : 1,
  };

  const availableFriends = friends;

  return (
    <div 
      ref={setNodeRef}
      style={style}
      className={`player-row-start ${isDragging ? 'dragging' : ''}`}
      {...attributes}
    >
      <div className="drag-handle" {...listeners} style={{ cursor: 'grab' }}>
        <GripVertical size={16} />
      </div>
      <label className="player-label">{index + 1}</label>
      <div className="player-controls">
        <input
          type="text"
          className="player-name-input"
          value={player.name}
          onChange={(e) => onNameChange(index, e.target.value)}
          placeholder={`Player ${index + 1}`}
        />
        {availableFriends.length > 0 && (
          <div className="friend-select-wrapper">
            <button
              type="button"
              className="friend-select-btn"
              onClick={() => setShowFriendDropdown(showFriendDropdown === index ? null : index)}
              title="Select friend"
            >
              <UsersIcon size={18} />
            </button>
            {showFriendDropdown === index && (
              <div className="friend-dropdown">
                {availableFriends.map(friend => (
                  <div
                    key={friend.id}
                    className="friend-dropdown-item"
                    onClick={() => onSelectFriend(index, friend)}
                  >
                    {friend.profilePicture ? (
                      <img 
                        src={friend.profilePicture} 
                        alt={friend.username}
                        className="friend-dropdown-avatar"
                      />
                    ) : (
                      <div className="friend-dropdown-avatar-placeholder">
                        {friend.username[0].toUpperCase()}
                      </div>
                    )}
                    <span>{friend.username}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

const StartTableGameModal = ({ isOpen, onClose, onStart, templateName, templateSettings }) => {
  const { user } = useUser();
  const [playerCount, setPlayerCount] = useState(3);
  const [players, setPlayers] = useState([]);
  const [friends, setFriends] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showFriendDropdown, setShowFriendDropdown] = useState(null); // Track which dropdown is open

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

  const initializePlayers = (count) => {
    setPlayers(prevPlayers => {
      const newPlayers = [];
      for (let i = 0; i < count; i++) {
        // First player should be the logged-in user
        if (i === 0) {
          const firstPlayerName = user?.username || user?.name || prevPlayers[0]?.name || 'Player 1';
          newPlayers.push({
            name: firstPlayerName,
            friendId: prevPlayers[0]?.friendId || null
          });
        } else {
          newPlayers.push({
            name: prevPlayers[i]?.name || `Player ${i + 1}`,
            friendId: prevPlayers[i]?.friendId || null
          });
        }
      }
      return newPlayers;
    });
  };

  useEffect(() => {
    if (isOpen) {
      loadFriends();
      initializePlayers(playerCount);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, user]);

  useEffect(() => {
    if (isOpen) {
      initializePlayers(playerCount);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playerCount, isOpen, user]);

  const loadFriends = async () => {
    setLoading(true);
    try {
      const friendsList = await localFriendsService.getAllFriends();
      setFriends(friendsList);
    } catch (err) {
      console.error('Error loading friends:', err);
    } finally {
      setLoading(false);
    }
  };

  const handlePlayerCountChange = (count) => {
    const newCount = Math.max(MIN_PLAYERS, Math.min(MAX_PLAYERS, count));
    setPlayerCount(newCount);
  };

  const handlePlayerNameChange = (index, name) => {
    const newPlayers = [...players];
    newPlayers[index] = { name, friendId: null };
    setPlayers(newPlayers);
  };

  const handleSelectFriend = (index, friend) => {
    const newPlayers = [...players];
    newPlayers[index] = {
      name: friend.username,
      friendId: friend.id
    };
    setPlayers(newPlayers);
    setShowFriendDropdown(null); // Close dropdown after selection
  };

  // @dnd-kit drag end handler
  const handleDragEnd = (event) => {
    const { active, over } = event;

    if (active.id !== over?.id) {
      const oldIndex = parseInt(active.id.split('-')[1]);
      const newIndex = parseInt(over?.id.split('-')[1]);
      
      if (oldIndex !== newIndex && oldIndex >= 0 && newIndex >= 0) {
        const newPlayers = [...players];
        const [removed] = newPlayers.splice(oldIndex, 1);
        newPlayers.splice(newIndex, 0, removed);
        setPlayers(newPlayers);
      }
    }
  };

  // Get available friends for a specific player slot
  const getAvailableFriends = () => {
    // Get all already selected friend IDs (including the current player slot)
    const selectedFriendIds = players
      .map(p => p.friendId)
      .filter(id => id !== null);
    
    // Filter out already selected friends
    let availableFriends = friends.filter(f => !selectedFriendIds.includes(f.id));
    
    // Check if the current user is already assigned to any player slot
    const currentUserName = user?.username || user?.name;
    const isCurrentUserAssigned = currentUserName && players.some(p => 
      p.name === currentUserName || p.friendId === user?.id
    );
    
    // If current user exists and is not assigned, add them to the list
    if (user && currentUserName && !isCurrentUserAssigned) {
      availableFriends = [
        {
          id: user.id,
          username: currentUserName,
          profilePicture: user.profilePicture
        },
        ...availableFriends
      ];
    }
    
    return availableFriends;
  };

  const handleStart = () => {
    // Validate all players have names
    const allPlayersNamed = players.every(p => p.name && p.name.trim().length > 0);
    if (!allPlayersNamed) {
      alert('Please provide names for all players');
      return;
    }

    // Return player names
    const playerNames = players.map(p => p.name.trim());
    onStart(playerNames, templateSettings);
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
          {/* Player Count Selector */}
          <div className="player-count-section">
            <label>
              <UsersIcon size={18} />
              Players
            </label>
            <div className="player-count-controls">
              <button
                className="count-btn"
                onClick={() => handlePlayerCountChange(playerCount - 1)}
                disabled={playerCount <= MIN_PLAYERS}
              >
                <MinusIcon size={12} />
              </button>
              <span className="player-count-display">{playerCount}</span>
              <button
                className="count-btn"
                onClick={() => handlePlayerCountChange(playerCount + 1)}
                disabled={playerCount >= MAX_PLAYERS}
              >
                <PlusIcon size={12} />
              </button>
            </div>
          </div>

          {/* Player Assignment */}
          <div className="players-section">
            <h3>Assign Players</h3>
            {loading ? (
              <div className="loading-message">Loading friends...</div>
            ) : (
              <DndContext 
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
                modifiers={[restrictToVerticalAxis, restrictToParentElement]}
              >
                <SortableContext 
                  items={players.map((_, index) => `player-${index}`)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="players-list">
                    {players.map((player, index) => (
                      <SortablePlayerItem
                        key={index}
                        player={player}
                        index={index}
                        onNameChange={handlePlayerNameChange}
                        friends={getAvailableFriends()}
                        showFriendDropdown={showFriendDropdown}
                        setShowFriendDropdown={setShowFriendDropdown}
                        onSelectFriend={handleSelectFriend}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
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
            <button type="button" onClick={handleStart} className="start-button">
              <PlayIcon size={18} />
              Start
            </button>
          </div>
      </div>
    </div>
  );
};

export default StartTableGameModal;
