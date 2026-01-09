import React, { useState, useEffect, useRef } from 'react';
import userService from '@/shared/api/userService';
import { UserIcon, Link2Icon, Trash2Icon, SearchIcon, XIcon, CheckCircleIcon, AlertCircleIcon, UsersIcon, GamepadIcon, RefreshCwIcon } from 'lucide-react';
import '@/styles/pages/admin.css';

const PlayerLinking = () => {
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
      setError('Please select both an identity and a user');
      return;
    }

    const confirmMsg = `Link "${selectedIdentity.displayName}" to user "${selectedUser.username}"?\n\nThis will update all games where this player appeared to show as ${selectedUser.username}.`;
    if (!confirm(confirmMsg)) {
      return;
    }

    try {
      setIsLinking(true);
      setError('');
      setSuccess('');

      const result = await userService.linkGuestIdentity(
        selectedIdentity._id,
        selectedUser._id || selectedUser.id
      );

      setSuccess(
        `Successfully linked "${selectedIdentity.displayName}" to ${selectedUser.username}! ` +
        `${result.gamesUpdated || 0} game(s) updated.`
      );

      clearSelection();
      await loadData();
    } catch (err) {
      console.error('Error linking identity:', err);
      setError(err.message || 'Failed to link identity');
    } finally {
      setIsLinking(false);
    }
  };

  const handleUnlink = async (identity) => {
    const confirmMsg = `Unlink "${identity.displayName}" from ${identity.linkedToUser?.username || 'user'}?\n\nThis will restore the original guest identity in games.`;
    if (!confirm(confirmMsg)) {
      return;
    }

    try {
      setIsUnlinking(true);
      setError('');
      setSuccess('');

      // Pass both guestIdentityId and userId to the API
      const result = await userService.unlinkGuestIdentity(identity._id, identity.linkedToUser?._id);

      setSuccess(
        `Successfully unlinked "${identity.displayName}". ` +
        `${result.gamesUpdated || 0} game(s) restored.`
      );

      await loadData();
    } catch (err) {
      console.error('Error unlinking identity:', err);
      setError(err.message || 'Failed to unlink identity');
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
    return <div className="admin-container">Loading...</div>;
  }

  return (
    <div className="admin-container">
      <div className="admin-header">
        <h1>Player Identity Linking</h1>
        <p>Link guest player identities to registered user accounts</p>
        <button onClick={loadData} className="btn-icon" title="Refresh data">
          <RefreshCwIcon size={16} />
        </button>
      </div>

      {/* How It Works Info Card */}
      <div className="admin-section info-card">
        <div className="info-card-header">
          <h3>🔗 How Player Identity Linking Works</h3>
        </div>
        <div className="info-card-content">
          <div className="info-columns">
            <div className="info-column">
              <h4>When to Use</h4>
              <ul>
                <li>A user played games as a guest before registering</li>
                <li>Multiple guest entries exist for the same person</li>
                <li>Games aren't showing in a user's H2H statistics</li>
              </ul>
            </div>
            <div className="info-column">
              <h4>What Happens</h4>
              <ul>
                <li><strong>Games updated:</strong> All games with the guest identity now show the linked user</li>
                <li><strong>Statistics unified:</strong> H2H stats combine all linked identities</li>
                <li><strong>Reversible:</strong> Original guest ID is saved for potential unlink</li>
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
          Unlinked Identities ({guestIdentities.length})
        </button>
        <button
          className={`tab-btn ${tab === 'linked' ? 'active' : ''}`}
          onClick={() => setTab('linked')}
        >
          <Link2Icon size={16} />
          Linked Identities ({linkedIdentities.length})
        </button>
      </div>

      {/* Unlinked Identities Tab */}
      {tab === 'unlinked' && (
        <div className="admin-section">
          <div className="section-header">
            <h2>Unlinked Guest Identities</h2>
            <p>
              Select a guest identity to link it to a registered user account.
            </p>
          </div>

          {/* Search */}
          <div className="search-box">
            <SearchIcon size={16} />
            <input
              type="text"
              placeholder="Search guest identities..."
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
              <h3>Guest Identities ({filteredGuestIdentities.length})</h3>
              {filteredGuestIdentities.length === 0 ? (
                <div className="no-data">
                  <p>{identitySearch ? 'No matching identities found' : 'No unlinked guest identities'}</p>
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
                          {identity.gameCount || 0} game(s)
                        </span>
                      </div>
                      {identity.lastSeen && (
                        <span className="identity-date">
                          Last seen: {new Date(identity.lastSeen).toLocaleDateString()}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Linking Form */}
            <div className="linking-form-panel">
              <h3>Link to User</h3>
              
              {selectedIdentity ? (
                <div className="linking-form">
                  <div className="selected-identity">
                    <strong>Selected Identity:</strong>
                    <span className="identity-badge">
                      <UserIcon size={14} />
                      {selectedIdentity.displayName}
                    </span>
                    <button onClick={clearSelection} className="btn-clear" title="Clear selection">
                      <XIcon size={14} />
                    </button>
                  </div>

                  {/* User Selection */}
                  <div className="form-group">
                    <label htmlFor="user-search">Select User to Link</label>
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
                          placeholder="Search for a user..."
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
                              No users found
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
                    {isLinking ? 'Linking...' : 'Link Identity'}
                  </button>
                </div>
              ) : (
                <div className="no-selection">
                  <UsersIcon size={32} />
                  <p>Select a guest identity from the list to link it to a user account</p>
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
            <h2>Linked Identities</h2>
            <p>
              Guest identities that have been linked to user accounts. You can unlink them if needed.
            </p>
          </div>

          {/* Search */}
          <div className="search-box">
            <SearchIcon size={16} />
            <input
              type="text"
              placeholder="Search by identity or username..."
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
              <p>{linkedFilter ? 'No matching linked identities found' : 'No linked identities yet'}</p>
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
                          {identity.linkedToUser?.username || 'Unknown User'}
                        </span>
                      </div>
                    </div>

                    <div className="alias-meta">
                      <span>
                        <GamepadIcon size={12} />
                        {identity.gameCount || 0} game(s)
                      </span>
                      {identity.linkedAt && (
                        <>
                          <span>•</span>
                          <span>Linked: {new Date(identity.linkedAt).toLocaleDateString()}</span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="alias-actions">
                    <button
                      className="btn-delete"
                      onClick={() => handleUnlink(identity)}
                      disabled={isUnlinking}
                      title="Unlink identity"
                    >
                      <Trash2Icon size={16} />
                      Unlink
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
