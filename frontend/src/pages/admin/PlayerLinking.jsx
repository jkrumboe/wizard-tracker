import React, { useState, useEffect, useRef } from 'react';
import userService from '@/shared/api/userService';
import { UserIcon, Link2Icon, Trash2Icon, SearchIcon, XIcon, CheckCircleIcon, AlertCircleIcon, UsersIcon, GamepadIcon, RefreshCwIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import '@/styles/pages/admin.css';

const PlayerLinking = () => {
  const { t } = useTranslation();
  // Data state
  const [guestIdentities, setGuestIdentities] = useState([]);
  const [linkedIdentities, setLinkedIdentities] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Link form state
  const [selectedIdentity, setSelectedIdentity] = useState(null);
  const [selectedUser, setSelectedUser] = useState(null);
  const [isLinking, setIsLinking] = useState(false);
  const [isUnlinking, setIsUnlinking] = useState(false);

  // Filter/search state
  const [identitySearch, setIdentitySearch] = useState('');
  const [userSearch, setUserSearch] = useState('');
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [linkedFilter, setLinkedFilter] = useState('');
  const [tab, setTab] = useState('unlinked'); // 'unlinked' or 'linked'
  
  // Refs
  const userDropdownRef = useRef(null);

  useEffect(() => {
    loadData();
  }, []);
  
  // Close user dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (userDropdownRef.current && !userDropdownRef.current.contains(event.target)) {
        setShowUserDropdown(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setError('');
      
      const [guestData, usersData] = await Promise.all([
        userService.getGuestIdentities(),
        userService.getAllUsers()
      ]);
      
      // Handle both response formats
      let userArray = [];
      if (Array.isArray(usersData)) {
        userArray = usersData;
      } else if (usersData && usersData.users) {
        userArray = usersData.users;
      } else if (usersData) {
        userArray = Object.values(usersData).find(val => Array.isArray(val)) || [];
      }
      
      // Separate linked and unlinked identities
      const unlinked = (guestData.identities || []).filter(i => !i.linkedToUser);
      const linked = (guestData.identities || []).filter(i => i.linkedToUser);
      
      setGuestIdentities(unlinked);
      setLinkedIdentities(linked);
      setUsers(userArray.filter(u => u.role !== 'guest')); // Only show real users
    } catch (err) {
      console.error('Error loading data:', err);
      setError(`Failed to load data: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectIdentity = (identity) => {
    setSelectedIdentity(identity);
    setSelectedUser(null);
    setUserSearch('');
  };

  const handleSelectUser = (user) => {
    setSelectedUser(user);
    setUserSearch(user.username);
    setShowUserDropdown(false);
  };

  const clearSelection = () => {
    setSelectedIdentity(null);
    setSelectedUser(null);
    setUserSearch('');
    setSuccess('');
    setError('');
  };

  const handleLink = async () => {
    if (!selectedIdentity || !selectedUser) {
      setError(t('adminPlayerLinking.selectBothRequired'));
      return;
    }

    const confirmMsg = t('adminPlayerLinking.linkConfirm', { identity: selectedIdentity.displayName, username: selectedUser.username });
    if (!confirm(confirmMsg)) {
      return;
    }

    try {
      setIsLinking(true);
      setError('');
      setSuccess('');

      await userService.linkGuestIdentity(
        selectedIdentity._id,
        selectedUser._id || selectedUser.id
      );

      setSuccess(
        t('adminPlayerLinking.linkSuccess', { identity: selectedIdentity.displayName, username: selectedUser.username })
      );

      clearSelection();
      await loadData();
    } catch (err) {
      console.error('Error linking identity:', err);
      setError(t('adminPlayerLinking.linkFailed', { error: err.message }));
    } finally {
      setIsLinking(false);
    }
  };

  const handleUnlink = async (identity) => {
    const confirmMsg = t('adminPlayerLinking.unlinkConfirm', { identity: identity.displayName, username: identity.linkedToUser?.username || '' });
    if (!confirm(confirmMsg)) {
      return;
    }

    try {
      setIsUnlinking(true);
      setError('');
      setSuccess('');

      // Pass both guestIdentityId and userId to the API
      await userService.unlinkGuestIdentity(identity._id, identity.linkedToUser?._id);

      setSuccess(
        t('adminPlayerLinking.unlinkSuccess', { identity: identity.displayName })
      );

      await loadData();
    } catch (err) {
      console.error('Error unlinking identity:', err);
      setError(t('adminPlayerLinking.unlinkFailed', { error: err.message }));
    } finally {
      setIsUnlinking(false);
    }
  };

  // Filter identities based on search
  const filteredGuestIdentities = guestIdentities.filter(identity =>
    identity.displayName.toLowerCase().includes(identitySearch.toLowerCase())
  );

  const filteredLinkedIdentities = linkedIdentities.filter(identity =>
    identity.displayName.toLowerCase().includes(linkedFilter.toLowerCase()) ||
    (identity.linkedToUser?.username || '').toLowerCase().includes(linkedFilter.toLowerCase())
  );

  // Filter users based on search
  const filteredUsers = users.filter(user =>
    user.username.toLowerCase().includes(userSearch.toLowerCase())
  );

  if (loading) {
    return <div className="admin-container">{t('adminPlayerLinking.loading')}</div>;
  }

  return (
    <div className="admin-container">
      <div className="admin-header">
        <h1>{t('adminPlayerLinking.title')}</h1>
        <p>{t('adminPlayerLinking.description')}</p>
        <button onClick={loadData} className="btn-icon" title={t('adminPlayerLinking.refreshData')}>
          <RefreshCwIcon size={16} />
        </button>
      </div>

      {/* How It Works Info Card */}
      <div className="admin-section info-card">
        <div className="info-card-header">
          <h3>{t('adminPlayerLinking.howItWorks')}</h3>
        </div>
        <div className="info-card-content">
          <div className="info-columns">
            <div className="info-column">
              <h4>{t('adminPlayerLinking.whenToUse')}</h4>
              <ul>
                <li>{t('adminPlayerLinking.useCase1')}</li>
                <li>{t('adminPlayerLinking.useCase2')}</li>
                <li>{t('adminPlayerLinking.useCase3')}</li>
              </ul>
            </div>
            <div className="info-column">
              <h4>{t('adminPlayerLinking.whatHappens')}</h4>
              <ul>
                <li><strong>{t('adminPlayerLinking.result1')}</strong> {t('adminPlayerLinking.result1Desc')}</li>
                <li><strong>{t('adminPlayerLinking.result2')}</strong> {t('adminPlayerLinking.result2Desc')}</li>
                <li><strong>{t('adminPlayerLinking.result3')}</strong> {t('adminPlayerLinking.result3Desc')}</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="alert alert-error">
          <AlertCircleIcon size={18} />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="alert alert-success">
          <CheckCircleIcon size={18} />
          <span>{success}</span>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="admin-tabs">
        <button
          className={`tab-btn ${tab === 'unlinked' ? 'active' : ''}`}
          onClick={() => setTab('unlinked')}
        >
          <UsersIcon size={16} />
          {t('adminPlayerLinking.unlinkedTab', { count: guestIdentities.length })}
        </button>
        <button
          className={`tab-btn ${tab === 'linked' ? 'active' : ''}`}
          onClick={() => setTab('linked')}
        >
          <Link2Icon size={16} />
          {t('adminPlayerLinking.linkedTab', { count: linkedIdentities.length })}
        </button>
      </div>

      {/* Unlinked Identities Tab */}
      {tab === 'unlinked' && (
        <div className="admin-section">
          <div className="section-header">
            <h2>{t('adminPlayerLinking.unlinkedTitle')}</h2>
            <p>
              {t('adminPlayerLinking.unlinkedDesc')}
            </p>
          </div>

          {/* Search */}
          <div className="search-box">
            <SearchIcon size={16} />
            <input
              type="text"
              placeholder={t('adminPlayerLinking.searchGuest')}
              value={identitySearch}
              onChange={(e) => setIdentitySearch(e.target.value)}
              className="search-input"
            />
            {identitySearch && (
              <button onClick={() => setIdentitySearch('')} className="btn-clear">
                <XIcon size={16} />
              </button>
            )}
          </div>

          {/* Two-column layout: identities list and linking form */}
          <div className="linking-layout">
            {/* Identity List */}
            <div className="identity-list-panel">
              <h3>{t('adminPlayerLinking.guestIdentities', { count: filteredGuestIdentities.length })}</h3>
              {filteredGuestIdentities.length === 0 ? (
                <div className="no-data">
                  <p>{identitySearch ? t('adminPlayerLinking.noMatchingIdentities') : t('adminPlayerLinking.noUnlinkedIdentities')}</p>
                </div>
              ) : (
                <div className="identity-list">
                  {filteredGuestIdentities.map((identity) => (
                    <button
                      key={identity._id}
                      className={`identity-item ${selectedIdentity?._id === identity._id ? 'selected' : ''}`}
                      onClick={() => handleSelectIdentity(identity)}
                    >
                      <div className="identity-info">
                        <span className="identity-name">{identity.displayName}</span>
                        <span className="identity-meta">
                          <GamepadIcon size={12} />
                          {t('adminPlayerLinking.gamesCount', { count: identity.gameCount || 0 })}
                        </span>
                      </div>
                      {identity.lastSeen && (
                        <span className="identity-date">
                          {t('adminPlayerLinking.lastSeen', { date: new Date(identity.lastSeen).toLocaleDateString() })}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Linking Form */}
            <div className="linking-form-panel">
              <h3>{t('adminPlayerLinking.linkToUser')}</h3>
              
              {selectedIdentity ? (
                <div className="linking-form">
                  <div className="selected-identity">
                    <strong>{t('adminPlayerLinking.selectedIdentity')}</strong>
                    <span className="identity-badge">
                      <UserIcon size={14} />
                      {selectedIdentity.displayName}
                    </span>
                    <button onClick={clearSelection} className="btn-clear" title={t('adminPlayerLinking.clearSelection')}>
                      <XIcon size={14} />
                    </button>
                  </div>

                  {/* User Selection */}
                  <div className="form-group">
                    <label htmlFor="user-search">{t('adminPlayerLinking.selectUserToLink')}</label>
                    <div className="search-container" ref={userDropdownRef}>
                      <div className="search-input-group">
                        <input
                          id="user-search"
                          type="text"
                          value={userSearch}
                          onChange={(e) => {
                            setUserSearch(e.target.value);
                            setShowUserDropdown(true);
                            if (!e.target.value) {
                              setSelectedUser(null);
                            }
                          }}
                          onFocus={() => setShowUserDropdown(true)}
                          placeholder={t('adminPlayerLinking.searchUser')}
                          className="form-input"
                          autoComplete="off"
                        />
                        {userSearch && (
                          <button
                            type="button"
                            onClick={() => {
                              setUserSearch('');
                              setSelectedUser(null);
                            }}
                            className="btn-clear"
                          >
                            <XIcon size={16} />
                          </button>
                        )}
                      </div>
                      
                      {showUserDropdown && (
                        <div className="search-dropdown">
                          {filteredUsers.length > 0 ? (
                            <div className="search-dropdown-list">
                              {filteredUsers.map((user) => (
                                <button
                                  key={user._id || user.id}
                                  type="button"
                                  className={`search-dropdown-item ${selectedUser?._id === user._id ? 'selected' : ''}`}
                                  onClick={() => handleSelectUser(user)}
                                >
                                  <UserIcon size={14} />
                                  <span>{user.username}</span>
                                  {user.email && <span className="user-email">{user.email}</span>}
                                </button>
                              ))}
                            </div>
                          ) : (
                            <div className="search-dropdown-empty">
                              {t('adminPlayerLinking.noUsersFound')}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {selectedUser && (
                    <div className="link-preview">
                      <div className="link-arrow">
                        <span className="identity-badge">
                          {selectedIdentity.displayName}
                        </span>
                        <Link2Icon size={20} />
                        <span className="user-badge">
                          <UserIcon size={14} />
                          {selectedUser.username}
                        </span>
                      </div>
                    </div>
                  )}

                  <button
                    onClick={handleLink}
                    disabled={!selectedUser || isLinking}
                    className="btn-primary btn-full"
                  >
                    <Link2Icon size={16} />
                    {isLinking ? t('adminPlayerLinking.linking') : t('adminPlayerLinking.linkIdentity')}
                  </button>
                </div>
              ) : (
                <div className="no-selection">
                  <UsersIcon size={32} />
                  <p>{t('adminPlayerLinking.selectIdentityHint')}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Linked Identities Tab */}
      {tab === 'linked' && (
        <div className="admin-section">
          <div className="section-header">
            <h2>{t('adminPlayerLinking.linkedTitle')}</h2>
            <p>
              {t('adminPlayerLinking.linkedDesc')}
            </p>
          </div>

          {/* Search */}
          <div className="search-box">
            <SearchIcon size={16} />
            <input
              type="text"
              placeholder={t('adminPlayerLinking.searchLinked')}
              value={linkedFilter}
              onChange={(e) => setLinkedFilter(e.target.value)}
              className="search-input"
            />
            {linkedFilter && (
              <button onClick={() => setLinkedFilter('')} className="btn-clear">
                <XIcon size={16} />
              </button>
            )}
          </div>

          {filteredLinkedIdentities.length === 0 ? (
            <div className="no-data">
              <p>{linkedFilter ? t('adminPlayerLinking.noMatchingLinked') : t('adminPlayerLinking.noLinkedYet')}</p>
            </div>
          ) : (
            <div className="aliases-list">
              {filteredLinkedIdentities.map((identity) => (
                <div key={identity._id} className="alias-card">
                  <div className="alias-content">
                    <div className="alias-header">
                      <div className="alias-link">
                        <span className="alias-name">{identity.displayName}</span>
                        <Link2Icon size={16} />
                        <span className="user-name">
                          <UserIcon size={14} />
                          {identity.linkedToUser?.username || t('adminPlayerLinking.unknownUser')}
                        </span>
                      </div>
                    </div>

                    <div className="alias-meta">
                      <span>
                        <GamepadIcon size={12} />
                        {t('adminPlayerLinking.gamesCount', { count: identity.gameCount || 0 })}
                      </span>
                      {identity.linkedAt && (
                        <>
                          <span>•</span>
                          <span>{t('adminPlayerLinking.linkedDate', { date: new Date(identity.linkedAt).toLocaleDateString() })}</span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="alias-actions">
                    <button
                      className="btn-delete"
                      onClick={() => handleUnlink(identity)}
                      disabled={isUnlinking}
                      title={t('adminPlayerLinking.unlinkIdentity')}
                    >
                      <Trash2Icon size={16} />
                      {t('adminPlayerLinking.unlink')}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default PlayerLinking;
