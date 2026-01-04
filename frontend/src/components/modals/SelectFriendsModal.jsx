import React, { useState, useEffect } from 'react';
import { XIcon, UsersIcon, CheckMarkIcon } from '@/components/ui/Icon';
import { sanitizeImageUrl } from '@/shared/utils/urlSanitizer';
import { localFriendsService, userService } from '@/shared/api';
import { useUser } from '@/shared/hooks/useUser';
import '@/styles/components/modal.css';
import '@/styles/components/select-friends-modal.css';

const SelectFriendsModal = ({ isOpen, onClose, onConfirm, alreadySelectedPlayers = [] }) => {
  const { user } = useUser();
  const [friends, setFriends] = useState([]);
  const [selectedFriends, setSelectedFriends] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadFriends();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const loadFriends = async () => {
    setLoading(true);
    try {
      let friendsList = [];
      
      // If user is logged in and online, fetch from server (cloud is source of truth)
      if (user?.id && navigator.onLine) {
        try {
          friendsList = await userService.getFriends(user.id);
          // Update local storage to match cloud
          await localFriendsService.clearAllFriends();
          for (const friend of friendsList) {
            await localFriendsService.addFriend(friend);
          }
        } catch (cloudErr) {
          console.warn('Could not fetch friends from cloud, using local:', cloudErr);
          friendsList = await localFriendsService.getAllFriends();
        }
      } else {
        // Offline fallback: use local storage
        friendsList = await localFriendsService.getAllFriends();
      }
      
      // Filter out friends who are already added as players
      const availableFriends = friendsList.filter(friend => 
        !alreadySelectedPlayers.some(player => 
          player.userId === friend.id || player.name === friend.username
        )
      );
      
      setFriends(availableFriends);
    } catch (err) {
      console.error('Error loading friends:', err);
    } finally {
      setLoading(false);
    }
  };

  const toggleFriendSelection = (friend) => {
    setSelectedFriends(prev => {
      const isSelected = prev.some(f => f.id === friend.id);
      if (isSelected) {
        return prev.filter(f => f.id !== friend.id);
      } else {
        return [...prev, friend];
      }
    });
  };

  const handleConfirm = () => {
    onConfirm(selectedFriends);
    setSelectedFriends([]);
    onClose();
  };

  const handleClose = () => {
    setSelectedFriends([]);
    onClose();
  };

  const handleSelectAll = () => {
    setSelectedFriends([...friends]);
  };

  const handleDeselectAll = () => {
    setSelectedFriends([]);
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal-container select-friends-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>
            <UsersIcon size={20} />
            Select Friends
          </h2>
          <button className="close-btn" onClick={handleClose}>
            <XIcon size={20} />
          </button>
        </div>

        <div className="modal-content">
          {loading ? (
            <div className="loading-message">Loading friends...</div>
          ) : friends.length === 0 ? (
            <div className="empty-message">
              No friends available. Add friends first from the home page.
            </div>
          ) : (
            <>
              {/* Select All / Deselect All buttons */}
              <div className="selection-controls">
                <button 
                  type="button" 
                  className="selection-control-btn"
                  onClick={handleSelectAll}
                  disabled={selectedFriends.length === friends.length}
                >
                  Select All
                </button>
                <button 
                  type="button" 
                  className="selection-control-btn"
                  onClick={handleDeselectAll}
                  disabled={selectedFriends.length === 0}
                >
                  Deselect All
                </button>
              </div>

              <div className="friends-selection-list">
              {friends.map(friend => {
                const isSelected = selectedFriends.some(f => f.id === friend.id);
                return (
                  <div 
                    key={friend.id} 
                    className={`friend-selection-item ${isSelected ? 'selected' : ''}`}
                    onClick={() => toggleFriendSelection(friend)}
                  >
                    <div className="friend-selection-info">
                      {friend.profilePicture ? (
                        <img 
                          src={sanitizeImageUrl(friend.profilePicture, '')} 
                          alt={friend.username}
                          className="friend-selection-avatar"
                        />
                      ) : (
                        <div className="friend-selection-avatar-placeholder">
                          {friend.username[0].toUpperCase()}
                        </div>
                      )}
                      <div className="friend-selection-details">
                        <div className="friend-selection-name">{friend.username}</div>
                      </div>
                    </div>
                    {isSelected && (
                      <div className="selection-checkmark">
                        <CheckMarkIcon size={20} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            </>
          )}
        </div>

        <div className="modal-actions">
          <button type="button" onClick={handleClose} className="cancel-button">
            Cancel
          </button>
          <button 
            type="button" 
            onClick={handleConfirm} 
            className="confirm-button"
            disabled={selectedFriends.length === 0}
          >
            Add {selectedFriends.length > 0 ? `(${selectedFriends.length})` : ''}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SelectFriendsModal;
