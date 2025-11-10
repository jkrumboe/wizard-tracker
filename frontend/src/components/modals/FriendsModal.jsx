import React, { useState, useEffect } from 'react';
import { XIcon, UsersIcon, PlusIcon, TrashIcon, SearchIcon, CheckMarkIcon } from '@/components/ui/Icon';
import { localFriendsService } from '@/shared/api';
import { userService } from '@/shared/api';
import { useUser } from '@/shared/hooks/useUser';
import '@/styles/components/modal.css';
import '@/styles/components/friends-modal.css';

const FriendsModal = ({ isOpen, onClose }) => {
  const { user } = useUser();
  const [activeTab, setActiveTab] = useState('friends'); // 'friends' or 'add'
  const [friends, setFriends] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [addingFriendId, setAddingFriendId] = useState(null); // Track which friend is being added
  const [addedFriendIds, setAddedFriendIds] = useState(new Set()); // Track recently added friends

  useEffect(() => {
    if (isOpen) {
      loadFriends();
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && activeTab === 'add') {
      // Check if user is logged in before trying to load users
      if (!user) {
        setError('You must be logged in to add friends from the cloud.');
        setLoading(false);
        return;
      }
      
      const token = localStorage.getItem('auth_token');
      if (!token) {
        setError('You must be logged in to add friends from the cloud.');
        setLoading(false);
        return;
      }
      
      loadAllUsers();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, activeTab, user]);

  const loadFriends = async () => {
    try {
      const localFriends = await localFriendsService.getAllFriends();
      setFriends(localFriends);
    } catch (err) {
      console.error('Error loading friends:', err);
      setError('Failed to load friends');
    }
  };

  const loadAllUsers = async () => {
    setLoading(true);
    setError('');
    try {
      console.log('🔍 Loading all users...', { user, hasToken: !!localStorage.getItem('auth_token') });
      const users = await userService.getAllUsers();
      console.log('📦 Received users:', users);
      
      if (!users || users.length === 0) {
        setError('No users found. This could mean:\n1. The backend server is not running\n2. No other users are registered\n3. You need to restart the dev server to pick up .env changes');
        setAllUsers([]);
        return;
      }
      
      // Filter out current user and already added friends
      const friendIds = friends.map(f => f.id);
      const filteredUsers = users.filter(u => 
        u.id !== user?.id && !friendIds.includes(u.id)
      );
      console.log('✅ Filtered users (excluding self and friends):', filteredUsers);
      setAllUsers(filteredUsers);
    } catch (err) {
      console.error('❌ Error loading users:', err);
      setError('Failed to load users. Make sure:\n1. The backend server is running (docker or npm start)\n2. You are logged in\n3. Dev server was restarted after .env changes');
    } finally {
      setLoading(false);
    }
  };

  const handleAddFriend = async (friendUser) => {
    setError('');
    setSuccessMessage('');
    setAddingFriendId(friendUser.id); // Show loading spinner
    
    try {
      // Add to local storage
      await localFriendsService.addFriend(friendUser);
      
      // Try to sync with backend if online
      if (user?.id) {
        try {
          await userService.addFriend(user.id, friendUser.id);
        } catch (backendError) {
          // Ignore backend errors, friend is saved locally
          console.warn('Could not sync friend to backend:', backendError);
        }
      }

      // Show checkmark briefly
      setAddedFriendIds(prev => new Set([...prev, friendUser.id]));
      setAddingFriendId(null);
      
      // Update friends list
      await loadFriends();
      
      // Remove the user from the allUsers list immediately
      setAllUsers(prevUsers => prevUsers.filter(u => u.id !== friendUser.id));
      
      setSuccessMessage(`${friendUser.username} added to friends!`);
      
      // Clear success message and checkmark after 2 seconds
      setTimeout(() => {
        setSuccessMessage('');
        setAddedFriendIds(prev => {
          const newSet = new Set(prev);
          newSet.delete(friendUser.id);
          return newSet;
        });
      }, 2000);
    } catch (err) {
      setAddingFriendId(null);
      setError(err.message || 'Failed to add friend');
    }
  };

  const handleRemoveFriend = async (friendId) => {
    if (!confirm('Are you sure you want to remove this friend?')) {
      return;
    }

    setError('');
    setSuccessMessage('');
    try {
      // Remove from local storage
      await localFriendsService.removeFriend(friendId);
      
      // Try to sync with backend if online
      if (user?.id) {
        try {
          await userService.removeFriend(user.id, friendId);
        } catch (backendError) {
          // Ignore backend errors, friend is removed locally
          console.warn('Could not sync friend removal to backend:', backendError);
        }
      }

      setSuccessMessage('Friend removed');
      await loadFriends();
      
      // Clear success message after 2 seconds
      setTimeout(() => setSuccessMessage(''), 2000);
    } catch (err) {
      setError(err.message || 'Failed to remove friend');
    }
  };

  const filteredFriends = friends.filter(friend =>
    friend.username.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredUsers = allUsers.filter(user =>
    user.username.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-container friends-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>
            <UsersIcon size={24} /> Friends
          </h2>
          <button className="close-btn" onClick={onClose}>
            <XIcon size={20} />
          </button>
        </div>

        <div className="modal-tabs">
          <button
            className={`tab-btn ${activeTab === 'friends' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('friends');
              setSearchQuery('');
              setError('');
              setSuccessMessage('');
            }}
          >
            My Friends ({friends.length})
          </button>
          <button
            className={`tab-btn ${activeTab === 'add' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('add');
              setSearchQuery('');
              setError('');
              setSuccessMessage('');
            }}
          >
            <PlusIcon size={16} /> Add Friend
          </button>
        </div>

        <div className="modal-content">
          {error && <div className="error-message">{error}</div>}
          {successMessage && <div className="success-message">{successMessage}</div>}

          {/* Search bar */}
          <div className="search-bar">
            <SearchIcon size={18} />
            <input
              type="text"
              placeholder={activeTab === 'friends' ? 'Search friends...' : 'Search users...'}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {activeTab === 'friends' ? (
            <div className="friends-list">
              {filteredFriends.length === 0 ? (
                <div className="empty-message">
                  {friends.length === 0 
                    ? 'No friends yet. Add some friends to get started!'
                    : 'No friends match your search'
                  }
                </div>
              ) : (
                filteredFriends.map(friend => (
                  <div key={friend.id} className="friend-item">
                    <div className="friend-info">
                      {friend.profilePicture ? (
                        <img 
                          src={friend.profilePicture} 
                          alt={friend.username}
                          className="friend-avatar"
                        />
                      ) : (
                        <div className="friend-avatar-placeholder">
                          {friend.username[0].toUpperCase()}
                        </div>
                      )}
                      <div className="friend-details">
                        <div className="friend-name">{friend.username}</div>
                        <div className="friend-date">
                          Added {new Date(friend.addedAt).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                    <button
                      className="remove-friend-btn"
                      onClick={() => handleRemoveFriend(friend.id)}
                      title="Remove friend"
                    >
                      <TrashIcon size={18} />
                    </button>
                  </div>
                ))
              )}
            </div>
          ) : (
            <div className="users-list">
              {loading ? (
                <div className="loading-message">Loading users...</div>
              ) : error && allUsers.length === 0 ? (
                <div className="empty-message">
                  {error}
                </div>
              ) : filteredUsers.length === 0 ? (
                <div className="empty-message">
                  {allUsers.length === 0
                    ? 'No users available. Make sure you are online and logged in.'
                    : 'No users match your search'
                  }
                </div>
              ) : (
                filteredUsers.map(userItem => (
                  <div key={userItem.id} className="user-item">
                    <div className="user-info">
                      {userItem.profilePicture ? (
                        <img 
                          src={userItem.profilePicture} 
                          alt={userItem.username}
                          className="user-avatar"
                        />
                      ) : (
                        <div className="user-avatar-placeholder">
                          {userItem.username[0].toUpperCase()}
                        </div>
                      )}
                      <div className="user-details">
                        <div className="user-name">{userItem.username}</div>
                        <div className="user-date">
                          Joined {new Date(userItem.createdAt).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                    <button
                      className={`add-friend-btn ${addingFriendId === userItem.id ? 'loading' : ''} ${addedFriendIds.has(userItem.id) ? 'added' : ''}`}
                      onClick={() => handleAddFriend(userItem)}
                      title="Add friend"
                      disabled={addingFriendId === userItem.id || addedFriendIds.has(userItem.id)}
                    >
                      {addingFriendId === userItem.id ? (
                        <div className="spinner-small"></div>
                      ) : addedFriendIds.has(userItem.id) ? (
                        <CheckMarkIcon size={18} />
                      ) : (
                        <PlusIcon size={18} />
                      )}
                    </button>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default FriendsModal;
