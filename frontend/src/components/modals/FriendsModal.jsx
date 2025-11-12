import React, { useState, useEffect, useCallback, useRef } from 'react';
import { XIcon, UsersIcon, PlusIcon, TrashIcon, SearchIcon, CheckMarkIcon, ClockIcon } from '@/components/ui/Icon';
import { localFriendsService } from '@/shared/api';
import { userService } from '@/shared/api';
import { useUser } from '@/shared/hooks/useUser';
import '@/styles/components/modal.css';
import '@/styles/components/friends-modal.css';

const FriendsModal = ({ isOpen, onClose }) => {
  const { user } = useUser();
  const [activeTab, setActiveTab] = useState('friends'); // 'friends', 'add', 'received', 'sent'
  const [friends, setFriends] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [receivedRequests, setReceivedRequests] = useState([]);
  const [sentRequests, setSentRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState('');
  // const [successMessage, setSuccessMessage] = useState('');
  const [addingFriendId, setAddingFriendId] = useState(null);
  const [addedFriendIds, setAddedFriendIds] = useState(new Set());
  const [usersCache, setUsersCache] = useState(null);
  const [friendToRemove, setFriendToRemove] = useState(null);
  const [processingRequestId, setProcessingRequestId] = useState(null);
  const [hasNewRequest, setHasNewRequest] = useState(false);
  const [previousRequestCount, setPreviousRequestCount] = useState(0);
  
  // Use ref instead of state to track previous sent request IDs to avoid infinite loops
  const previousSentRequestIdsRef = useRef(new Set());

  // Define loadFriends first since it's used by syncCloudFriendsToLocal
  const loadFriends = useCallback(async () => {
    try {
      const localFriends = await localFriendsService.getAllFriends();
      setFriends(localFriends);
    } catch (err) {
      console.error('Error loading friends:', err);
      setError('Failed to load friends');
    }
  }, []);

  // Define syncCloudFriendsToLocal next since it uses loadFriends
  const syncCloudFriendsToLocal = useCallback(async () => {
    if (!user?.id) return;
    
    try {
      // Get friends from cloud
      const cloudFriends = await userService.getFriends(user.id);
      
      if (cloudFriends.length > 0) {
        // Get current local friends
        const localFriends = await localFriendsService.getAllFriends();
        const localFriendIds = new Set(localFriends.map(f => f.id));
        
        // Add any cloud friends that aren't in local storage
        for (const cloudFriend of cloudFriends) {
          if (!localFriendIds.has(cloudFriend.id)) {
            console.log('Syncing new friend from cloud to local:', cloudFriend.username);
            await localFriendsService.addFriend(cloudFriend);
          }
        }
        
        // Reload friends list to show updates
        await loadFriends();
      }
    } catch (err) {
      console.warn('Could not sync friends from cloud:', err);
    }
  }, [user?.id, loadFriends]);

  const loadFriendRequests = useCallback(async () => {
    if (!user?.id) return;
    
    try {
      const [received, sent] = await Promise.all([
        userService.getReceivedFriendRequests(user.id),
        userService.getSentFriendRequests(user.id)
      ]);
      setReceivedRequests(received);
      setSentRequests(sent);
    } catch (err) {
      console.error('Error loading friend requests:', err);
    }
  }, [user?.id]);

  useEffect(() => {
    if (isOpen) {
      loadFriends();
      if (user?.id) {
        loadFriendRequests();
      }
    }
  }, [isOpen, user?.id, loadFriendRequests, loadFriends]);

  // Poll for new friend requests every 3 seconds when modal is open
  useEffect(() => {
    if (!isOpen || !user?.id) return;

    const pollInterval = setInterval(() => {
      loadFriendRequests();
      syncCloudFriendsToLocal(); // Also sync friends from cloud
    }, 3000); // Poll every 3 seconds

    return () => clearInterval(pollInterval);
  }, [isOpen, user?.id, loadFriendRequests, syncCloudFriendsToLocal]);

  // Detect new friend requests and show notification
  useEffect(() => {
    if (receivedRequests.length > previousRequestCount && previousRequestCount > 0) {
      setHasNewRequest(true);
      // Auto-clear the notification after 5 seconds
      const timer = setTimeout(() => setHasNewRequest(false), 5000);
      return () => clearTimeout(timer);
    }
    setPreviousRequestCount(receivedRequests.length);
  }, [receivedRequests.length, previousRequestCount]);

  // Detect when sent requests are accepted (they disappear from sent list)
  // This means someone accepted our friend request, so reload friends list
  useEffect(() => {
    const currentSentRequestIds = new Set(sentRequests.map(req => req.id));
    
    // Only check for missing requests after initial load
    if (previousSentRequestIdsRef.current.size > 0) {
      // Check if any previous sent requests are now missing (they were accepted or rejected)
      const missingRequests = [...previousSentRequestIdsRef.current].filter(id => !currentSentRequestIds.has(id));
      
      if (missingRequests.length > 0) {
        // A sent request disappeared, meaning it was likely accepted
        // Immediately sync friends from cloud
        console.log('Sent request(s) were processed, syncing friends from cloud...');
        syncCloudFriendsToLocal();
      }
    }
    
    // Update the tracking set (using ref doesn't trigger re-renders)
    previousSentRequestIdsRef.current = currentSentRequestIds;
  }, [sentRequests, syncCloudFriendsToLocal]);

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
      
      // Only load if we don't have cached users
      if (!usersCache) {
        loadAllUsers();
      } else {
        // Use cached users but filter only current user and existing friends
        // Keep users with pending sent requests (they'll show a waiting icon)
        const friendIds = friends.map(f => f.id);
        const filteredUsers = usersCache.filter(u => 
          u.id !== user?.id && !friendIds.includes(u.id)
        );
        setAllUsers(filteredUsers);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, activeTab, user, usersCache, friends, sentRequests]);

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
        setUsersCache([]);
        return;
      }
      
      // Cache all users
      setUsersCache(users);
      
      // Filter out current user and already added friends
      // Keep users with pending sent requests (they'll show a waiting icon)
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

  const handleSendFriendRequest = async (receiverUser) => {
    setError('');
    // setSuccessMessage('');
    setAddingFriendId(receiverUser.id);
    
    try {
      if (!user?.id) {
        throw new Error('You must be logged in to send friend requests');
      }

      await userService.sendFriendRequest(user.id, receiverUser.id);
      
      // Show checkmark briefly
      setAddedFriendIds(prev => new Set([...prev, receiverUser.id]));
      setAddingFriendId(null);
      
      // Reload friend requests to update the UI
      await loadFriendRequests();
      
      // setSuccessMessage(`Friend request sent to ${receiverUser.username}!`);
      
      // Clear success message and checkmark after 2 seconds
      setTimeout(() => {
        // setSuccessMessage('');
        setAddedFriendIds(prev => {
          const newSet = new Set(prev);
          newSet.delete(receiverUser.id);
          return newSet;
        });
      }, 2000);
    } catch (err) {
      setAddingFriendId(null);
      setError(err.message || 'Failed to send friend request');
    }
  };

  const handleAcceptRequest = async (request) => {
    setError('');
    // setSuccessMessage('');
    setProcessingRequestId(request.id);
    
    try {
      if (!user?.id) {
        throw new Error('You must be logged in');
      }

      await userService.acceptFriendRequest(user.id, request.id);
      
      // Add friend to local storage
      await localFriendsService.addFriend(request.sender);
      
      // Reload friends and requests
      await loadFriends();
      await loadFriendRequests();
      
      // setSuccessMessage(`You are now friends with ${request.sender.username}!`);
      // setTimeout(() => setSuccessMessage(''), 2000);
    } catch (err) {
      setError(err.message || 'Failed to accept friend request');
    } finally {
      setProcessingRequestId(null);
    }
  };

  const handleRejectRequest = async (request) => {
    setError('');
    // setSuccessMessage('');
    setProcessingRequestId(request.id);
    
    try {
      if (!user?.id) {
        throw new Error('You must be logged in');
      }

      await userService.rejectFriendRequest(user.id, request.id);
      
      // Reload requests
      await loadFriendRequests();
      
      // setSuccessMessage('Friend request rejected');
      // setTimeout(() => setSuccessMessage(''), 2000);
    } catch (err) {
      setError(err.message || 'Failed to reject friend request');
    } finally {
      setProcessingRequestId(null);
    }
  };

  const handleCancelRequest = async (requestOrUser) => {
    setError('');
    // setSuccessMessage('');
    
    // Handle both request object and user object
    const requestId = requestOrUser.id || requestOrUser;
    
    setProcessingRequestId(requestId);
    
    try {
      if (!user?.id) {
        throw new Error('You must be logged in');
      }

      await userService.cancelFriendRequest(user.id, requestId);
      
      // Reload requests to update the UI
      await loadFriendRequests();
      
      // setSuccessMessage(`Friend request to ${username || 'user'} cancelled`);
      // setTimeout(() => setSuccessMessage(''), 2000);
    } catch (err) {
      setError(err.message || 'Failed to cancel friend request');
    } finally {
      setProcessingRequestId(null);
    }
  };

  const getPendingRequestForUser = (userId) => {
    return sentRequests.find(req => req.receiver.id === userId);
  };

  const handleRemoveFriend = async (friendId) => {
    setFriendToRemove(friendId);
  };

  const confirmRemoveFriend = async () => {
    if (!friendToRemove) return;

    setError('');
    // setSuccessMessage('');
    try {
      // Remove from local storage
      await localFriendsService.removeFriend(friendToRemove);
      
      // Try to sync with backend if online
      if (user?.id) {
        try {
          await userService.removeFriend(user.id, friendToRemove);
        } catch (backendError) {
          // Ignore backend errors, friend is removed locally
          console.warn('Could not sync friend removal to backend:', backendError);
        }
      }

      // setSuccessMessage('Friend removed');
      await loadFriends();
      
      // Clear success message after 2 seconds
      // setTimeout(() => setSuccessMessage(''), 2000);
    } catch (err) {
      setError(err.message || 'Failed to remove friend');
    } finally {
      setFriendToRemove(null);
    }
  };

  const cancelRemoveFriend = () => {
    setFriendToRemove(null);
  };

  const filteredFriends = friends.filter(friend =>
    friend.username.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredUsers = allUsers.filter(user =>
    user.username.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredReceivedRequests = receivedRequests.filter(request =>
    request.sender.username.toLowerCase().includes(searchQuery.toLowerCase())
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
              // setSuccessMessage('');
            }}
          >
            My Friends
            {friends.length > 0 && <span className="tab-badge">{friends.length}</span>}
          </button>
          <button
            className={`tab-btn ${activeTab === 'received' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('received');
              setSearchQuery('');
              setError('');
              // setSuccessMessage('');
            }}
          >
            {/* <ClockIcon size={16} /> */}
            Requests
            {receivedRequests.length > 0 && (
              <span className="tab-badge highlight">{receivedRequests.length}</span>
            )}
          </button>
          <button
            className={`tab-btn ${activeTab === 'add' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('add');
              setSearchQuery('');
              setError('');
              // setSuccessMessage('');
            }}
          >
            {/* <PlusIcon size={16} /> */}
            Add Friend
          </button>
        </div>

        <div className="modal-content">
          {error && <div className="error-message">{error}</div>}
          {/* {successMessage && <div className="success-message">{successMessage}</div>} */}
          
          {hasNewRequest && activeTab !== 'received' && (
            <div className="new-request-notification" onClick={() => setActiveTab('received')}>
              <ClockIcon size={18} />
              <span>You have new friend request{receivedRequests.length > 1 ? 's' : ''}! Click to view.</span>
            </div>
          )}

          {/* Search bar */}
          <div className="search-bar">
            <SearchIcon size={18} />
            <input
              type="text"
              placeholder={
                activeTab === 'friends' ? 'Search friends...' : 
                activeTab === 'received' ? 'Search requests...' :
                'Search users...'
              }
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
                        {/* <div className="friend-date">
                          Added {new Date(friend.addedAt).toLocaleDateString()}
                        </div> */}
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
          ) : activeTab === 'received' ? (
            <div className="requests-list">
              {filteredReceivedRequests.length === 0 ? (
                <div className="empty-message">
                  {receivedRequests.length === 0 
                    ? 'No pending friend requests'
                    : 'No requests match your search'
                  }
                </div>
              ) : (
                filteredReceivedRequests.map(request => (
                  <div key={request.id} className="request-item">
                    <div className="request-info">
                      {request.sender.profilePicture ? (
                        <img 
                          src={request.sender.profilePicture} 
                          alt={request.sender.username}
                          className="request-avatar"
                        />
                      ) : (
                        <div className="request-avatar-placeholder">
                          {request.sender.username[0].toUpperCase()}
                        </div>
                      )}
                      <div className="request-details">
                        <div className="request-name">{request.sender.username}</div>
                        {/* <div className="request-date">
                          Sent {new Date(request.createdAt).toLocaleDateString()}
                        </div> */}
                      </div>
                    </div>
                    <div className="request-actions">
                      <button
                        className="accept-btn"
                        onClick={() => handleAcceptRequest(request)}
                        disabled={processingRequestId === request.id}
                        title="Accept request"
                      >
                        {processingRequestId === request.id ? (
                          <div className="spinner-small"></div>
                        ) : (
                          <CheckMarkIcon size={18} />
                        )}
                      </button>
                      <button
                        className="reject-btn"
                        onClick={() => handleRejectRequest(request)}
                        disabled={processingRequestId === request.id}
                        title="Reject request"
                      >
                        <XIcon size={18} />
                      </button>
                    </div>
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
                filteredUsers.map(userItem => {
                  const pendingRequest = getPendingRequestForUser(userItem.id);
                  const hasPendingRequest = !!pendingRequest;
                  
                  return (
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
                          {/* <div className="user-date">
                            {hasPendingRequest 
                              ? `Request sent ${new Date(pendingRequest.createdAt).toLocaleDateString()}`
                              : `Joined ${new Date(userItem.createdAt).toLocaleDateString()}`
                            }
                          </div> */}
                        </div>
                      </div>
                      <button
                        className={`add-friend-btn ${
                          hasPendingRequest ? 'pending' : ''
                        } ${addingFriendId === userItem.id ? 'loading' : ''} ${
                          addedFriendIds.has(userItem.id) ? 'added' : ''
                        }`}
                        onClick={() => hasPendingRequest 
                          ? handleCancelRequest(pendingRequest.id)
                          : handleSendFriendRequest(userItem)
                        }
                        title={hasPendingRequest ? "Cancel friend request" : "Send friend request"}
                        disabled={addingFriendId === userItem.id || addedFriendIds.has(userItem.id) || processingRequestId === pendingRequest?.id}
                      >
                        {processingRequestId === pendingRequest?.id ? (
                          <div className="spinner-small"></div>
                        ) : addingFriendId === userItem.id ? (
                          <div className="spinner-small"></div>
                        ) : addedFriendIds.has(userItem.id) ? (
                          <CheckMarkIcon size={18} />
                        ) : hasPendingRequest ? (
                          <ClockIcon size={18} />
                        ) : (
                          <PlusIcon size={18} />
                        )}
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>

        {/* Confirmation Dialog Overlay */}
        {friendToRemove && (
          <div className="confirmation-overlay" onClick={cancelRemoveFriend}>
            <div className="confirmation-dialog" onClick={(e) => e.stopPropagation()}>
              <h3>Remove Friend?</h3>
              <p>Are you sure you want to remove this friend?</p>
              <div className="confirmation-actions">
                <button className="cancel-btn" onClick={cancelRemoveFriend}>
                  Cancel
                </button>
                <button className="confirm-btn danger" onClick={confirmRemoveFriend}>
                  Remove
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default FriendsModal;
