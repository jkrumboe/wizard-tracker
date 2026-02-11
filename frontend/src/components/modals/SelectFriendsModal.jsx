import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { XIcon, UsersIcon, CheckMarkIcon } from '@/components/ui/Icon';
import { sanitizeImageUrl } from '@/shared/utils/urlSanitizer';
import { localFriendsService, userService } from '@/shared/api';
import { useUser } from '@/shared/hooks/useUser';
import '@/styles/components/modal.css';
import '@/styles/components/select-friends-modal.css';

const SelectFriendsModal = ({ isOpen, onClose, onConfirm, alreadySelectedPlayers = [] }) => {
  const { t } = useTranslation();
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
    // Don't load friends if not logged in
    if (!user?.id) {
      setFriends([]);
      setLoading(false);
      return;
    }
    
    setLoading(true);
    try {
      let friendsList = [];
      
      // Fetch from server (cloud is source of truth)
      if (navigator.onLine) {
        try {
          friendsList = await userService.getFriends(user.id);
          // Update local storage to match cloud
          await localFriendsService.clearAllFriends();
          for (const friend of friendsList) {
            await localFriendsService.addFriend(friend);
          }
        } catch (cloudErr) {
          console.warn('Could not fetch friends from cloud:', cloudErr);
          friendsList = [];
        }
      } else {
        friendsList = [];
      }
      
      // Filter out friends who are already added as players (by userId only)
      const availableFriends = friendsList.filter(friend => 
        !alreadySelectedPlayers.some(player => player.userId === friend.id)
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

  // Show login required message if user is not logged in
  if (!user) {
    return (
      <div className="modal-overlay" onClick={handleClose}>
        <div className="modal-container select-friends-modal" onClick={(e) => e.stopPropagation()}>
          <div className="modal-header">
            <h2>
              <UsersIcon size={20} />
              {t('selectFriends.title')}
            </h2>
            <button className="close-btn" onClick={handleClose}>
              <XIcon size={20} />
            </button>
          </div>
          <div className="modal-content" style={{ textAlign: 'center', padding: '40px 20px' }}>
            <UsersIcon size={48} style={{ opacity: 0.5, marginBottom: '16px' }} />
            <p>{t('selectFriends.loginRequired')}</p>
          </div>
          <div className="modal-actions">
            <button type="button" onClick={handleClose} className="cancel-button">
              {t('common.close')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal-container select-friends-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>
            <UsersIcon size={20} />
            {t('selectFriends.title')}
          </h2>
          <button className="close-btn" onClick={handleClose}>
            <XIcon size={20} />
          </button>
        </div>

        <div className="modal-content">
          {loading ? (
            <div className="loading-message">{t('selectFriends.loadingFriends')}</div>
          ) : friends.length === 0 ? (
            <div className="empty-message">
              {t('selectFriends.noFriendsAvailable')}
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
                  {t('selectFriends.selectAll')}
                </button>
                <button 
                  type="button" 
                  className="selection-control-btn"
                  onClick={handleDeselectAll}
                  disabled={selectedFriends.length === 0}
                >
                  {t('selectFriends.deselectAll')}
                </button>
              </div>

              <div className="friends-selection-list">
              {friends.map(friend => {
                const isSelected = selectedFriends.some(f => f.id === friend.id);
                return (
                  <div 
                    key={friend.id} 
                    className={`friend-item ${isSelected ? 'selected' : ''}`}
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
            {t('common.cancel')}
          </button>
          <button 
            type="button" 
            onClick={handleConfirm} 
            className="confirm-button"
            disabled={selectedFriends.length === 0}
          >
            {t('selectFriends.addCount', { count: selectedFriends.length })}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SelectFriendsModal;
