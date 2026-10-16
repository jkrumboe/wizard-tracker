import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { XIcon, UsersIcon, PlusIcon, SearchIcon, CheckMarkIcon, ClockIcon } from '@/components/ui/Icon';
import DeleteIconButton from '@/components/ui/DeleteIconButton';
import DeleteConfirmationModal from '@/components/modals/DeleteConfirmationModal';
import { sanitizeImageUrl } from '@/shared/utils/urlSanitizer';
import defaultAvatar from '@/assets/default-avatar.png';
import { localFriendsService } from '@/shared/api';
import { userService } from '@/shared/api';
import { useUser } from '@/shared/hooks/useUser';
import '@/styles/components/modal.css';
import '@/styles/components/friends-modal.css';

// Last server response, kept for the session so reopening the modal is instant
let cachedFriendsData = null;
let cachedUsers = null;

const byUsername = (a, b) => a.username.localeCompare(b.username);

const FriendsModal = ({ isOpen, onClose }) => {
  const { t } = useTranslation();
  const { user } = useUser();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('friends'); // 'friends', 'add', 'received'
  const [friends, setFriends] = useState([]);
  const [receivedRequests, setReceivedRequests] = useState([]);
  const [sentRequests, setSentRequests] = useState([]);
  // True once friends + requests reflect the server, so tabs never shuffle people around
  const [hasServerData, setHasServerData] = useState(false);
  const [usersCache, setUsersCache] = useState(cachedUsers);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState('');
  const [addingFriendId, setAddingFriendId] = useState(null);
  const [addedFriendIds, setAddedFriendIds] = useState(new Set());
  const [friendToRemove, setFriendToRemove] = useState(null);
  const [processingRequestId, setProcessingRequestId] = useState(null);
  const [hasNewRequest, setHasNewRequest] = useState(false);

  // Each load gets a number; only the newest one may update state, so a slow
  // poll can't overwrite the result of an action the user just took
  const loadSeqRef = useRef(0);
  const knownRequestIdsRef = useRef(null);

  const applyFriendsData = useCallback((data) => {
    setFriends([...data.friends].sort(byUsername));
    setReceivedRequests(data.receivedRequests);
    setSentRequests(data.sentRequests);
    setHasServerData(true);
  }, []);

  const loadFriendsData = useCallback(async () => {
    if (!user?.id) return;
    const seq = ++loadSeqRef.current;

    if (!navigator.onLine) {
      const localFriends = await localFriendsService.getAllFriends();
      if (seq === loadSeqRef.current && !cachedFriendsData) setFriends(localFriends);
      return;
    }

    try {
      const data = await userService.getFriendsBatchCheck(user.id);
      if (seq !== loadSeqRef.current) return;
      cachedFriendsData = { userId: user.id, ...data };
      applyFriendsData(data);
      localFriendsService.replaceAllFriends(data.friends).catch(() => {});
    } catch (err) {
      // Keep whatever is on screen; the next poll will retry
      console.error('Error loading friends data:', err);
    }
  }, [user?.id, applyFriendsData]);

  // Never show one account's friends to another after switching users
  useEffect(() => {
    setFriends([]);
    setReceivedRequests([]);
    setSentRequests([]);
    setHasServerData(false);
    knownRequestIdsRef.current = null;
  }, [user?.id]);

  // On open: show cached data immediately, then refresh from the server
  useEffect(() => {
    if (!isOpen || !user?.id) return;

    if (cachedFriendsData?.userId === user.id) {
      applyFriendsData(cachedFriendsData);
    } else {
      localFriendsService.getAllFriends().then(localFriends => {
        if (!cachedFriendsData) setFriends(localFriends);
      });
    }
    loadFriendsData();

    const pollInterval = setInterval(loadFriendsData, 15000);
    return () => clearInterval(pollInterval);
  }, [isOpen, user?.id, applyFriendsData, loadFriendsData]);

  // Flag requests that arrive while the modal is open
  useEffect(() => {
    if (!hasServerData) return;
    const ids = receivedRequests.map(r => r.id);
    const known = knownRequestIdsRef.current;
    knownRequestIdsRef.current = new Set(ids);
    if (known && ids.some(id => !known.has(id))) {
      setHasNewRequest(true);
      const timer = setTimeout(() => setHasNewRequest(false), 5000);
      return () => clearTimeout(timer);
    }
  }, [receivedRequests, hasServerData]);

  useEffect(() => {
    if (!isOpen || activeTab !== 'add' || !user || usersCache) return;

    let cancelled = false;
    const loadAllUsers = async () => {
      setLoadingUsers(true);
      setError('');
      try {
        const users = await userService.getAllUsers();
        if (cancelled) return;
        if (users.length > 0) cachedUsers = users;
        setUsersCache(users);
      } catch (err) {
        console.error('Error loading users:', err);
        if (!cancelled) setError(t('friends.loadUsersFailed'));
      } finally {
        if (!cancelled) setLoadingUsers(false);
      }
    };
    loadAllUsers();
    return () => { cancelled = true; };
  }, [isOpen, activeTab, user, usersCache, t]);

  // Everyone who isn't you, a friend, or already asking to be your friend.
  // People you've sent a request to stay listed with a pending icon.
  const allUsers = useMemo(() => {
    if (!usersCache) return [];
    const excluded = new Set([
      user?.id,
      ...friends.map(f => f.id),
      ...receivedRequests.map(r => r.sender.id)
    ]);
    return usersCache.filter(u => !excluded.has(u.id));
  }, [usersCache, friends, receivedRequests, user?.id]);

  const handleSendFriendRequest = async (receiverUser) => {
    setError('');
    setAddingFriendId(receiverUser.id);

    try {
      await userService.sendFriendRequest(user.id, receiverUser.id);
      setAddedFriendIds(prev => new Set([...prev, receiverUser.id]));
      await loadFriendsData();

      setTimeout(() => {
        setAddedFriendIds(prev => {
          const next = new Set(prev);
          next.delete(receiverUser.id);
          return next;
        });
      }, 2000);
    } catch (err) {
      setError(err.message || 'Failed to send friend request');
    } finally {
      setAddingFriendId(null);
    }
  };

  const handleAcceptRequest = async (request) => {
    setError('');
    setProcessingRequestId(request.id);

    try {
      await userService.acceptFriendRequest(user.id, request.id);
      // Move them across in one update so they never appear in two tabs
      loadSeqRef.current++;
      setReceivedRequests(prev => prev.filter(r => r.id !== request.id));
      setFriends(prev => [...prev.filter(f => f.id !== request.sender.id), request.sender].sort(byUsername));
      await loadFriendsData();
    } catch (err) {
      setError(err.message || 'Failed to accept friend request');
    } finally {
      setProcessingRequestId(null);
    }
  };

  const handleRejectRequest = async (request) => {
    setError('');
    setProcessingRequestId(request.id);

    try {
      await userService.rejectFriendRequest(user.id, request.id);
      loadSeqRef.current++;
      setReceivedRequests(prev => prev.filter(r => r.id !== request.id));
      await loadFriendsData();
    } catch (err) {
      setError(err.message || 'Failed to reject friend request');
    } finally {
      setProcessingRequestId(null);
    }
  };

  const handleCancelRequest = async (requestId) => {
    setError('');
    setProcessingRequestId(requestId);

    try {
      await userService.cancelFriendRequest(user.id, requestId);
      loadSeqRef.current++;
      setSentRequests(prev => prev.filter(r => r.id !== requestId));
      await loadFriendsData();
    } catch (err) {
      setError(err.message || 'Failed to cancel friend request');
    } finally {
      setProcessingRequestId(null);
    }
  };

  const getPendingRequestForUser = (userId) => {
    return sentRequests.find(req => req.receiver.id === userId);
  };

  const handleRemoveFriend = (friend) => {
    setFriendToRemove(friend);
  };

  const confirmRemoveFriend = async () => {
    if (!friendToRemove) return;
    const removed = friendToRemove;
    setFriendToRemove(null);
    setError('');

    // Remove right away; the server call follows
    loadSeqRef.current++;
    setFriends(prev => prev.filter(f => f.id !== removed.id));

    try {
      await localFriendsService.removeFriend(removed.id);
      await userService.removeFriend(user.id, removed.id);
    } catch (err) {
      console.warn('Could not sync friend removal to backend:', err);
    }
    await loadFriendsData();
  };

  const cancelRemoveFriend = () => {
    setFriendToRemove(null);
  };

  const openProfile = (profile) => {
    if (!profile?.id) return;
    onClose();
    navigate(`/user/${profile.id}`);
  };

  // Avatar + name, clickable to open that user's public profile
  const renderPersonLink = (person, prefix) => (
    <button
      type="button"
      className={`${prefix}-info person-link`}
      onClick={() => openProfile(person)}
      title={t('friends.viewProfile', { name: person.username })}
    >
      <img
        src={sanitizeImageUrl(person.profilePicture, defaultAvatar) || defaultAvatar}
        alt=""
        className={`${prefix}-avatar`}
      />
      <span className={`${prefix}-name`}>{person.username}</span>
    </button>
  );

  const isOnline = navigator.onLine;

  const filteredFriends = friends.filter(friend =>
    friend.username.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredUsers = allUsers.filter(u =>
    u.username.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredReceivedRequests = receivedRequests.filter(request =>
    request.sender.username.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (!isOpen) return null;

  // Show login required message if user is not logged in
  if (!user) {
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-container friends-modal" onClick={(e) => e.stopPropagation()}>
          <div className="modal-header">
            <h2>{t('friends.title')}</h2>
            <button className="close-btn" onClick={onClose} aria-label={t('common.close')}>
              <XIcon size={20} />
            </button>
          </div>
          <div className="modal-body" style={{ textAlign: 'center', padding: '40px 20px' }}>
            <UsersIcon size={48} style={{ opacity: 0.5, marginBottom: '16px' }} />
            <p>{t('friends.loginRequired')}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-container friends-modal" onClick={(e) => e.stopPropagation()}>
          <div className="modal-header">
            <h2>
              {t('friends.title')}
            </h2>
            <button className="close-btn" onClick={onClose} aria-label={t('common.close')}>
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
              }}
            >
              {t('friends.yourFriends')}
              {friends.length > 0 && <span className="tab-badge">{friends.length}</span>}
            </button>
            <button
              className={`tab-btn ${activeTab === 'received' ? 'active' : ''}`}
              onClick={() => {
                setActiveTab('received');
                setSearchQuery('');
                setError('');
              }}
            >
              {t('friends.friendRequests')}
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
              }}
            >
              {t('friends.addFriendTab')}
            </button>
          </div>

          <div className="modal-content">
            {error && <div className="error-message">{error}</div>}
          
            {hasNewRequest && activeTab !== 'received' && (
              <div className="new-request-notification" onClick={() => setActiveTab('received')}>
                <ClockIcon size={18} />
                <span>{t('friends.newRequestNotice', { count: receivedRequests.length })}</span>
              </div>
            )}

            <div className="friends-panel">
              {/* Search bar */}
              <div className="search-bar">
                <SearchIcon size={18} />
                <input
                  type="text"
                  placeholder={t('friends.searchPlaceholder')}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              {activeTab === 'friends' ? (
                <div className="friends-list">
                  {friends.length === 0 && !hasServerData && isOnline ? (
                    <div className="loading-message">{t('common.loading')}</div>
                  ) : filteredFriends.length === 0 ? (
                    <div className="empty-message">
                      {friends.length === 0
                        ? t('friends.noFriendsYet')
                        : t('friends.noFriendsMatch')
                      }
                    </div>
                  ) : (
                    filteredFriends.map(friend => (
                      <div key={friend.id} className="friend-item">
                        {renderPersonLink(friend, 'friend')}
                        <DeleteIconButton
                          label={t('friends.remove')}
                          onClick={() => handleRemoveFriend(friend)}
                        />
                      </div>
                    ))
                  )}
                </div>
              ) : activeTab === 'received' ? (
                <div className="requests-list">
                  {!hasServerData && isOnline ? (
                    <div className="loading-message">{t('common.loading')}</div>
                  ) : filteredReceivedRequests.length === 0 ? (
                    <div className="empty-message">
                      {receivedRequests.length === 0
                        ? t('friends.noRequests')
                        : t('friends.noRequestsMatch')
                      }
                    </div>
                  ) : (
                    filteredReceivedRequests.map(request => (
                      <div key={request.id} className="request-item">
                        {renderPersonLink(request.sender, 'request')}
                        <div className="request-actions">
                          <button
                            className="accept-btn"
                            onClick={() => handleAcceptRequest(request)}
                            disabled={processingRequestId === request.id}
                            title={t('friends.accept')}
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
                            title={t('friends.decline')}
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
                  {!isOnline && !usersCache ? (
                    <div className="empty-message">{t('friends.offlineAddFriends')}</div>
                  ) : error && !usersCache ? (
                    <div className="empty-message">{error}</div>
                  ) : loadingUsers || !usersCache || (!hasServerData && isOnline) ? (
                    <div className="loading-message">{t('common.loading')}</div>
                  ) : filteredUsers.length === 0 ? (
                    <div className="empty-message">
                      {searchQuery
                        ? t('friends.noUsersMatch')
                        : usersCache.length <= 1
                          ? t('friends.noOtherUsers')
                          : t('friends.friendsWithEveryone')
                      }
                    </div>
                  ) : (
                    filteredUsers.map(userItem => {
                      const pendingRequest = getPendingRequestForUser(userItem.id);
                      const hasPendingRequest = !!pendingRequest;
                    
                      return (
                        <div key={userItem.id} className="user-item">
                          {renderPersonLink(userItem, 'user')}
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
                            title={hasPendingRequest ? t('friends.pending') : t('friends.sendRequest')}
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
          </div>
        </div>
      </div>

      {/* Rendered beside the friends modal so it stacks above it */}
      <DeleteConfirmationModal
        isOpen={Boolean(friendToRemove)}
        onClose={cancelRemoveFriend}
        onConfirm={confirmRemoveFriend}
        title={t('friends.removeTitle')}
        message={friendToRemove ? t('friends.removeConfirm', { name: friendToRemove.username }) : ''}
        confirmText={t('friends.remove')}
      />
    </>
  );
};

export default FriendsModal;
