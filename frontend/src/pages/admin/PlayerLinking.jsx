import React, { useState, useEffect, useRef, useCallback } from 'react';
import userService from '@/shared/api/userService';
import { UserIcon, Link2Icon, Trash2Icon, PlusIcon, SearchIcon, XIcon, InfoIcon, CheckCircleIcon, AlertCircleIcon } from 'lucide-react';
import '@/styles/pages/admin.css';

const PlayerLinking = () => {
  const [aliases, setAliases] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Form state
  const [selectedUser, setSelectedUser] = useState('');
  const [aliasName, setAliasName] = useState('');
  const [notes, setNotes] = useState('');
  const [linkGamesNow, setLinkGamesNow] = useState(true);
  const [isCreating, setIsCreating] = useState(false);

  // Search state
  const [playerSearch, setPlayerSearch] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchResultCount, setSearchResultCount] = useState(0);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  
  // Refs for debouncing and cleanup
  const searchTimeoutRef = useRef(null);
  const abortControllerRef = useRef(null);

  // Filter state
  const [filterUser, setFilterUser] = useState('all');
  const [searchFilter, setSearchFilter] = useState('');
  
  // User search state
  const [userSearch, setUserSearch] = useState('');
  const [showUserDropdown, setShowUserDropdown] = useState(false);
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
      const [aliasesData, usersData] = await Promise.all([
        userService.getPlayerAliases(),
        userService.getAllUsers()
      ]);
      
      // Handle both response formats - API returns array directly
      let userArray = [];
      if (Array.isArray(usersData)) {
        userArray = usersData;
      } else if (usersData && usersData.users) {
        userArray = usersData.users;
      } else if (usersData) {
        userArray = Object.values(usersData).find(val => Array.isArray(val)) || [];
      }
      
      setAliases(aliasesData.aliases || []);
      setUsers(userArray);
    } catch (err) {
      console.error('Error loading data:', err);
      setError(`Failed to load data: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Debounced search function
  const performSearch = useCallback(async (searchTerm) => {
    // Cancel any previous search
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    if (searchTerm.trim().length < 2) {
      setSearchResults([]);
      setSearchResultCount(0);
      setShowDropdown(false);
      return;
    }

    try {
      setIsSearching(true);
      setShowDropdown(true);
      
      // Create new abort controller for this search
      abortControllerRef.current = new AbortController();
      
      const results = await userService.searchPlayerNames(searchTerm);
      setSearchResults(results.playerNames || []);
      setSearchResultCount(results.totalFound || 0);
    } catch (err) {
      // Don't show error if request was aborted
      if (err.name !== 'AbortError') {
        console.error('Error searching player names:', err);
      }
    } finally {
      setIsSearching(false);
    }
  }, []);

  // Handle search input changes with debouncing
  const handleSearchChange = (e) => {
    const value = e.target.value;
    setPlayerSearch(value);

    // Clear existing timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    // Set new timeout for debounced search
    if (value.trim().length >= 2) {
      searchTimeoutRef.current = setTimeout(() => {
        performSearch(value);
      }, 300); // 300ms debounce
    } else {
      setSearchResults([]);
      setSearchResultCount(0);
      setShowDropdown(false);
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  const handleUseSearchResult = (playerName) => {
    setAliasName(playerName);
    setSearchResults([]);
    setPlayerSearch('');
    setShowDropdown(false);
    
    // Check if this name is already aliased
    const existingAlias = aliases.find(a => a.aliasName.toLowerCase() === playerName.toLowerCase());
    if (existingAlias) {
      setSuccess(`Note: "${playerName}" is already linked to ${existingAlias.user?.username || 'a user'}`);
    } else {
      setSuccess('');
    }
  };

  const clearSearch = () => {
    setPlayerSearch('');
    setSearchResults([]);
    setSearchResultCount(0);
    setShowDropdown(false);
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
  };
  
  const handleUserSelect = (user) => {
    setSelectedUser(user.id || user._id);
    setUserSearch(user.username);
    setShowUserDropdown(false);
  };
  
  const clearUserSelection = () => {
    setSelectedUser('');
    setUserSearch('');
    setShowUserDropdown(false);
  };
  
  // Filter users based on search
  const filteredUsers = users.filter(user => 
    user.username.toLowerCase().includes(userSearch.toLowerCase())
  );

  const handleCreateAlias = async (e) => {
    e.preventDefault();
    
    if (!selectedUser) {
      alert('Please select a user');
      return;
    }

    if (!aliasName.trim()) {
      alert('Please enter an alias name');
      return;
    }

    if (!confirm(`Link player name "${aliasName}" to user "${users.find(u => u._id === selectedUser)?.username}"?${linkGamesNow ? '\n\nThis will also immediately link all matching games.' : ''}`)) {
      return;
    }

    try {
      setIsCreating(true);
      setError('');
      setSuccess('');

      const result = await userService.createPlayerAlias({
        userId: selectedUser,
        aliasName: aliasName.trim(),
        notes: notes.trim(),
        linkGamesNow: linkGamesNow
      });

      setSuccess(
        `Player alias created successfully!${
          result.linkageResults
            ? ` Linked ${result.linkageResults.totalLinked} game(s).`
            : ''
        }`
      );

      // Reset form
      setSelectedUser('');
      setUserSearch('');
      setAliasName('');
      setNotes('');
      setLinkGamesNow(true);

      // Reload aliases
      await loadData();
    } catch (err) {
      console.error('Error creating alias:', err);
      setError(err.message || 'Failed to create player alias');
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteAlias = async (aliasId, aliasName, username) => {
    if (!confirm(`Delete alias "${aliasName}" for user "${username}"?\n\nNote: This will NOT unlink games that were already linked.`)) {
      return;
    }

    try {
      setError('');
      setSuccess('');
      await userService.deletePlayerAlias(aliasId);
      setSuccess(`Alias "${aliasName}" deleted successfully`);
      await loadData();
    } catch (err) {
      console.error('Error deleting alias:', err);
      setError(err.message || 'Failed to delete player alias');
    }
  };

  // Filter aliases
  const filteredAliases = aliases.filter(alias => {
    const matchesUser = filterUser === 'all' || alias.user?.id === filterUser;
    const matchesSearch = !searchFilter || 
      alias.aliasName.toLowerCase().includes(searchFilter.toLowerCase()) ||
      alias.user?.username.toLowerCase().includes(searchFilter.toLowerCase());
    return matchesUser && matchesSearch;
  });

  if (loading) {
    return <div className="admin-container">Loading...</div>;
  }

  return (
    <div className="admin-container">
      <div className="admin-header">
        <h1>Player Name Linking</h1>
        <p>Link old player names to registered user accounts</p>
      </div>

      {/* How It Works Info Card */}
      <div className="admin-section info-card">
        <div className="info-card-header">
          <h3>🔗 How Player Aliases Work</h3>
        </div>
        <div className="info-card-content">
          <div className="info-columns">
            <div className="info-column">
              <h4>When to Use</h4>
              <ul>
                <li>A user played games under a different name before registering</li>
                <li>Someone misspelled their name in some games</li>
                <li>A user changed their username and wants old games linked</li>
              </ul>
            </div>
            <div className="info-column">
              <h4>How Matching Works</h4>
              <ul>
                <li><strong>Case-insensitive:</strong> "Johnny" will match "johnny", "JOHNNY", etc.</li>
                <li><strong>Immediate linking:</strong> Option to link all matching games right away</li>
                <li><strong>Future games:</strong> New games with this name auto-link to the user</li>
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

      {/* Create New Alias Section */}
      <div className="admin-section">
        <div className="section-header">
          <h2>Create Player Alias</h2>
          <p>
            Link an old player name to a registered user account. All games with that player name
            will be linked to the user's account.
          </p>
        </div>

        <form onSubmit={handleCreateAlias} className="alias-form">
          {/* Player Name Search */}
          <div className="form-group">
            <label htmlFor="player-search">Search for Player Name in Games</label>
            <p className="form-hint">
              Start typing to search for player names in your game history (min 2 characters).
            </p>
            <div className="search-container">
              <div className="search-input-group">
                <input
                  id="player-search"
                  type="text"
                  value={playerSearch}
                  onChange={handleSearchChange}
                  placeholder="Type player name..."
                  className="form-input"
                  autoComplete="off"
                />
                {playerSearch && (
                  <button
                    type="button"
                    onClick={clearSearch}
                    className="btn-clear"
                    title="Clear search"
                  >
                    <XIcon size={16} />
                  </button>
                )}
                {isSearching && (
                  <div className="search-spinner">
                    <SearchIcon size={16} className="spinning" />
                  </div>
                )}
              </div>
              
              {/* Search Results Dropdown */}
              {showDropdown && (
                <div className="search-dropdown">
                  {isSearching ? (
                    <div className="search-loading">
                      <SearchIcon size={16} className="spinning" />
                      <span>Searching games...</span>
                    </div>
                  ) : searchResults.length > 0 ? (
                    <>
                      <div className="search-dropdown-header">
                        <span className="success-icon">✓</span>
                        Found {searchResults.length} player name(s)
                        {searchResultCount > searchResults.length && ` (showing first ${searchResults.length})`}
                      </div>
                      <div className="search-dropdown-list">
                        {searchResults.map((name, idx) => {
                          const isAlreadyLinked = aliases.find(a => a.aliasName.toLowerCase() === name.toLowerCase());
                          return (
                            <button
                              key={idx}
                              type="button"
                              className={`search-dropdown-item ${isAlreadyLinked ? 'already-linked' : ''}`}
                              onClick={() => handleUseSearchResult(name)}
                              title={isAlreadyLinked ? `Already linked to ${isAlreadyLinked.user?.username}` : 'Click to use this name'}
                            >
                              <span className="player-name">{name}</span>
                              {isAlreadyLinked && (
                                <span className="linked-tag">
                                  Linked to {isAlreadyLinked.user?.username}
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </>
                  ) : (
                    <div className="search-dropdown-empty">
                      <span className="error-icon">✗</span>
                      <div>
                        <div className="empty-title">No player names found matching "{playerSearch}"</div>
                        <div className="empty-hint">Double-check the spelling or try a different search term</div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Alias Name */}
          <div className="form-group">
            <label htmlFor="alias-name">Player Name (Alias) *</label>
            <input
              id="alias-name"
              type="text"
              value={aliasName}
              onChange={(e) => setAliasName(e.target.value)}
              placeholder="Enter the player name used in games"
              className="form-input"
              required
            />
          </div>

          {/* User Selection */}
          <div className="form-group">
            <label htmlFor="user-search">Link to User *</label>
            <p className="form-hint">
              Search and select the registered user to link this player name to.
            </p>
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
                      setSelectedUser('');
                    }
                  }}
                  onFocus={() => setShowUserDropdown(true)}
                  placeholder="Search for a user..."
                  className="form-input"
                  autoComplete="off"
                  required
                />
                {userSearch && (
                  <button
                    type="button"
                    onClick={clearUserSelection}
                    className="btn-clear"
                    title="Clear selection"
                  >
                    <XIcon size={16} />
                  </button>
                )}
                <div className="search-icon-static">
                  <UserIcon size={16} />
                </div>
              </div>
              
              {/* User Dropdown */}
              {showUserDropdown && (
                <div className="search-dropdown">
                  {loading ? (
                    <div className="search-loading">
                      <span>Loading users...</span>
                    </div>
                  ) : users.length === 0 ? (
                    <div className="search-dropdown-empty">
                      <span className="error-icon">✗</span>
                      <div>
                        <div className="empty-title">No users available</div>
                        <div className="empty-hint">Please ensure users are registered in the system</div>
                      </div>
                    </div>
                  ) : filteredUsers.length > 0 ? (
                    <>
                      <div className="search-dropdown-header">
                        <span className="success-icon">✓</span>
                        {userSearch 
                          ? `Found ${filteredUsers.length} user(s)` 
                          : `${filteredUsers.length} registered user(s)`
                        }
                      </div>
                      <div className="search-dropdown-list">
                        {filteredUsers.map((user) => (
                          <button
                            key={user.id || user._id}
                            type="button"
                            className="search-dropdown-item"
                            onClick={() => handleUserSelect(user)}
                          >
                            <span className="player-name">{user.username}</span>
                            {user.email && (
                              <span className="user-email">{user.email}</span>
                            )}
                          </button>
                        ))}
                      </div>
                    </>
                  ) : (
                    <div className="search-dropdown-empty">
                      <span className="error-icon">✗</span>
                      <div>
                        <div className="empty-title">No users found matching "{userSearch}"</div>
                        <div className="empty-hint">Try a different search term</div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Notes */}
          <div className="form-group">
            <label htmlFor="alias-notes">Notes (optional)</label>
            <textarea
              id="alias-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add any notes about this alias..."
              className="form-textarea"
              rows={3}
            />
          </div>

          {/* Link Games Now */}
          <div className="form-group checkbox-group">
            <label htmlFor="link-games-now">
              <input
                id="link-games-now"
                type="checkbox"
                checked={linkGamesNow}
                onChange={(e) => setLinkGamesNow(e.target.checked)}
              />
              <span>Link all matching games immediately</span>
            </label>
          </div>

          <button
            type="submit"
            disabled={isCreating}
            className="btn-primary"
          >
            <PlusIcon size={16} />
            {isCreating ? 'Creating...' : 'Create Alias'}
          </button>
        </form>
      </div>

      {/* Existing Aliases Section */}
      <div className="admin-section">
        <div className="section-header">
          <h2>Existing Player Aliases</h2>
          <p>
            Showing {filteredAliases.length} of {aliases.length} alias(es)
          </p>
        </div>

        {/* Filters */}
        <div className="admin-filters">
          <div className="filter-group">
            <label htmlFor="user-filter">Filter by User:</label>
            <select
              id="user-filter"
              value={filterUser}
              onChange={(e) => setFilterUser(e.target.value)}
              className="filter-select"
            >
              <option value="all">All Users</option>
              {users.map((user) => (
                <option key={user._id} value={user._id}>
                  {user.username}
                </option>
              ))}
            </select>
          </div>

          <div className="search-box">
            <label htmlFor="alias-search" className="sr-only">Search aliases</label>
            <input
              id="alias-search"
              type="text"
              placeholder="Search by alias or username..."
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              className="search-input"
            />
          </div>
        </div>

        {filteredAliases.length === 0 ? (
          <div className="no-data">
            <p>No player aliases found{(filterUser !== 'all' || searchFilter) && ' matching your filters'}</p>
          </div>
        ) : (
          <div className="aliases-list">
            {filteredAliases.map((alias) => (
              <div key={alias._id} className="alias-card">
                <div className="alias-content">
                  <div className="alias-header">
                    <div className="alias-link">
                      <span className="alias-name">{alias.aliasName}</span>
                      <Link2Icon size={16} />
                      <span className="user-name">
                        <UserIcon size={14} />
                        {alias.user?.username || 'Unknown User'}
                      </span>
                    </div>
                  </div>

                  {alias.notes && (
                    <div className="alias-notes">
                      <strong>Notes:</strong> {alias.notes}
                    </div>
                  )}

                  <div className="alias-meta">
                    <span>Created by: {alias.createdBy?.username || 'Unknown'}</span>
                    <span>•</span>
                    <span>{new Date(alias.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>

                <div className="alias-actions">
                  <button
                    className="btn-delete"
                    onClick={() => handleDeleteAlias(alias._id, alias.aliasName, alias.user?.username)}
                    title="Delete alias"
                  >
                    <Trash2Icon size={16} />
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default PlayerLinking;
