import React, { useState, useEffect, useCallback, useRef } from 'react';
import { XIcon, UsersIcon, PlusIcon, TrashIcon, SearchIcon, CheckMarkIcon, ClockIcon } from '@/components/ui/Icon';
import { sanitizeImageUrl } from '@/shared/utils/urlSanitizer';
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

  // Load friends from server (cloud) when online, fallback to local storage
  const loadFriends = useCallback(async () => {
    try {
      // If user is logged in and online, always fetch from server
      if (user?.id && navigator.onLine) {
        const cloudFriends = await userService.getFriends(user.id);
        setFriends(cloudFriends);
        
        // Update local storage to match cloud (full sync)
        await localFriendsService.clearAllFriends();
        for (const friend of cloudFriends) {
          await localFriendsService.addFriend(friend);
        }
      } else {
        // Offline fallback: use local storage
        const localFriends = await localFriendsService.getAllFriends();
        setFriends(localFriends);
      }
    } catch (err) {
      console.error('Error loading friends:', err);
      // Fallback to local storage on error
      try {
        const localFriends = await localFriendsService.getAllFriends();
        setFriends(localFriends);
      } catch (localErr) {
        setError('Failed to load friends');
      }
    }
  }, [user?.id]);

  // Sync is now handled directly in loadFriends - this function is kept for compatibility
  const syncCloudFriendsToLocal = useCallback(async () => {
    // loadFriends now handles full sync from cloud
    await loadFriends();
  }, [loadFriends]);

  // Batch load all friends data (friends list + requests) in one API call
  const loadFriendsBatchData = useCallback(async () => {
    if (!user?.id) return;
    
    try {
      const batchData = await userService.getFriendsBatchCheck(user.id);
      
      // Update received and sent requests
      setReceivedRequests(batchData.receivedRequests);
      setSentRequests(batchData.sentRequests);
      
      // Set friends directly from cloud data (cloud is source of truth)
      setFriends(batchData.friends);
      
      // Update local storage to match cloud (full sync)
      await localFriendsService.clearAllFriends();
      for (const friend of batchData.friends) {
        await localFriendsService.addFriend(friend);
      }
    } catch (err) {
      console.error('Error loading friends batch data:', err);
      // Fallback to local storage on error
      try {
        const localFriends = await localFriendsService.getAllFriends();
        setFriends(localFriends);
      } catch (localErr) {
        console.error('Error loading local friends:', localErr);
      }
    }
  }, [user?.id]);

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
        loadFriendsBatchData(); // Use batch endpoint for initial load
      }
    }
  }, [isOpen, user?.id, loadFriendsBatchData, loadFriends]);

  // Poll for new friend requests every 15 seconds when modal is open
  // Reduced from 3s to prevent rate limiting issues
  // Uses batch endpoint to reduce from 3 API calls to 1
  useEffect(() => {
    if (!isOpen || !user?.id) return;

    const pollInterval = setInterval(() => {
      loadFriendsBatchData(); // Use batch endpoint instead of 3 separate calls
    }, 15000); // Poll every 15 seconds to avoid rate limiting

    return () => clearInterval(pollInterval);
  }, [isOpen, user?.id, loadFriendsBatchData]);

  // Detect new friend requests
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
        setError('You must be logged in to add friends.');
        setLoading(false);
        return;
      }
      
      const token = localStorage.getItem('auth_token');
      if (!token) {
        setError('You must be logged in to add friends.');
        setLoading(false);
        return;
      }
      
      // Only load if we don't have cached users
      if (!usersCache) {
        loadAllUsers();
      } else {
        // Use cached users but filter out current user, existing friends, and users with received requests
        // Keep users with pending sent requests (they'll show a waiting icon)
        const friendIds = friends.map(f => f.id);
        const receivedRequestSenderIds = receivedRequests.map(r => r.sender.id);
        const filteredUsers = usersCache.filter(u => 
          u.id !== user?.id && 
          !friendIds.includes(u.id) &&
          !receivedRequestSenderIds.includes(u.id)
        );
        setAllUsers(filteredUsers);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, activeTab, user, usersCache, friends, sentRequests, receivedRequests]);

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
      
      // Filter out current user, existing friends, and users who sent us requests
      // Keep users with pending sent requests (they'll show a waiting icon)
      const friendIds = friends.map(f => f.id);
      const receivedRequestSenderIds = receivedRequests.map(r => r.sender.id);
      const filteredUsers = users.filter(u => 
        u.id !== user?.id && 
        !friendIds.includes(u.id) &&
        !receivedRequestSenderIds.includes(u.id)
      );
      console.log('✅ Filtered users (excluding self, friends, and received requests):', filteredUsers);
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
            Friends
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
                          src={sanitizeImageUrl(friend.profilePicture, '')} 
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
                          src={sanitizeImageUrl(request.sender.profilePicture, '')} 
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
                  {searchQuery 
                    ? 'No users match your search'
                    : !navigator.onLine
                      ? 'You appear to be offline. Connect to the internet to find users.'
                      : !user
                        ? 'Please log in to add friends.'
                        : usersCache && usersCache.length <= 1
                          ? 'No other users registered yet. Invite your friends to join!'
                          : allUsers.length === 0 && friends.length > 0
                            ? "You're friends with everyone! No more users to add."
                            : 'No users available to add as friends.'
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
                            src={sanitizeImageUrl(userItem.profilePicture, '')} 
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
                        className={`add-friend-btn
                          ${hasPendingRequest ? 'pending' : ''}
                          ${addingFriendId === userItem.id ? 'loading' : ''}
                          ${addedFriendIds.has(userItem.id) ? 'added' : ''}
                        `}
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
