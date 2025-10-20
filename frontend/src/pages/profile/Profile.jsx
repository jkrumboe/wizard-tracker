import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useParams, Link, useLocation, useNavigate } from 'react-router-dom'
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts'
import GameHistoryItem from '@/components/game/GameHistoryItem'
import StatCard from '@/components/ui/StatCard'
import { useUser } from '@/shared/hooks/useUser'
import { StatIcon, EditIcon, CalendarIcon } from "@/components/ui/Icon"
// Temporarily remove playerService imports since they're not implemented yet
// import { getPlayerById, updatePlayer, updatePlayerTags, getTagsByPlayerId, getTags } from '@/shared/api/playerService'
import { getRecentLocalGames } from '@/shared/api/gameService'
import userService from '@/shared/api/userService'
import avatarService from '@/shared/api/avatarService'
import defaultAvatar from "@/assets/default-avatar.png";
import DOMPurify from 'dompurify';
import authService from '@/shared/api/authService'

const Profile = () => {
  const { id: paramId } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const { user, setUser } = useUser()
  // For now, only allow viewing your own profile (paramId support can be added later)
  const isOwnProfile = !paramId || paramId === user?.id
  
  const [allGames, setAllGames] = useState([])
  const [tags, setTags] = useState([])
  // const [defaultTags, setDefaultTags] = useState([])
  const [error, setError] = useState(null)
  const [activeTab, setActiveTab] = useState('performance')
  const [editing, setEditing] = useState(false);
  const [editedName, setEditedName] = useState('');
  const [editedAvatar, setEditedAvatar] = useState('');
  const [saving, setSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [avatarUrl, setAvatarUrl] = useState(defaultAvatar);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [selectedAvatarFile, setSelectedAvatarFile] = useState(null);
  const [previewAvatarUrl, setPreviewAvatarUrl] = useState('');

  // Create player object from user data if this is own profile
  const currentPlayer = useMemo(() => {
    if (isOwnProfile && user) {
      return {
        id: user.id,
        name: user.name || user.username || 'User',
        username: user.username,
        avatar: avatarUrl,
        // Add other default properties
        tags: [],
        created_at: user.createdAt,
        updated_at: user.createdAt // For now, same as created
      }
    }
    return null
  }, [user, isOwnProfile, avatarUrl])

const canEdit = useMemo(() => {
  // Only allow editing your own profile
  return isOwnProfile && user && currentPlayer;
}, [user, currentPlayer, isOwnProfile]);

useEffect(() => {
  const fetchData = async () => {
    try {
      if (!isOwnProfile || !currentPlayer) {
        if (!isOwnProfile) {
          setError("Viewing other users' profiles is not yet supported");
        }
        return;
      }

      // For now, just set empty default data since playerService is not implemented
      // setDefaultTags([]);
      
      // Fetch all local games (both finished and paused)
      try {
        const localGames = await getRecentLocalGames(100); // Get up to 100 games
        
        // Get all possible identifiers for the current user
        const userIdentifiers = [
          currentPlayer.id,
          currentPlayer.name,
          currentPlayer.username,
          user.id,
          user.name,
          user.username,
          user.$id // Appwrite user ID
        ].filter(Boolean); // Remove any null/undefined values
        
        // Filter games to only include games where the current user ACTUALLY PLAYED
        const userGames = localGames.filter(game => {
          // Check if user is in the players list by name/username (most reliable for local games)
          if (game.gameState?.players && Array.isArray(game.gameState.players)) {
            const isInPlayers = game.gameState.players.some(player => {
              // Check if player name or username matches current user
              const playerName = player.name?.toLowerCase().trim();
              const playerUsername = player.username?.toLowerCase().trim();
              const currentName = currentPlayer.name?.toLowerCase().trim();
              const currentUsername = currentPlayer.username?.toLowerCase().trim();
              
              return playerName === currentName || playerUsername === currentUsername;
            });
            
            if (isInPlayers) {
              return true;
            }
          }
          
          // Fallback: Check if user is in the players list by ID
          if (game.gameState?.players) {
            const isInPlayersById = game.gameState.players.some(player => {
              const playerIdentifiers = [
                player.id,
                player.userId
              ].filter(Boolean);
              
              return playerIdentifiers.some(playerId => 
                userIdentifiers.includes(playerId)
              );
            });
            
            if (isInPlayersById) {
              return true;
            }
          }
          
          // Check player_ids array as last resort
          if (game.player_ids && Array.isArray(game.player_ids)) {
            if (game.player_ids.some(playerId => userIdentifiers.includes(playerId))) {
              return true;
            }
          }
          
          return false;
        });
        
        setAllGames(userGames || []);
      } catch (err) {
        console.error('Local games not available:', err);
        setAllGames([]);
      }
      
    } catch (error) {
      console.error("Error fetching profile data:", error);
      setError("Failed to load profile data");
    }
  };

  if (currentPlayer) fetchData();
}, [currentPlayer, isOwnProfile, user]);

// Load avatar URL when user is available
useEffect(() => {
  const loadAvatarUrl = async () => {
    if (user) {
      try {
        const url = await avatarService.getAvatarUrl();
        setAvatarUrl(url);
      } catch (error) {
        console.error('Error loading avatar:', error);
        setAvatarUrl(defaultAvatar);
      }
    }
  };

  loadAvatarUrl();
}, [user]);

// Cleanup preview URLs on unmount
useEffect(() => {
  return () => {
    if (previewAvatarUrl) {
      URL.revokeObjectURL(previewAvatarUrl);
    }
  };
}, [previewAvatarUrl]);

useEffect(() => {
  const fetchTags = async () => {
    try {
      if (!isOwnProfile || !currentPlayer) return;
      
      // For now, just set empty tags since playerService is not implemented
      setTags([]);
    } catch (err) {
      console.error("Error fetching tags:", err);
      setTags([]);
    }
  };

  if (currentPlayer) {
    fetchTags();
  };
}, [currentPlayer, isOwnProfile]);

const handleStartEditing = useCallback(() => {
  setEditedName(user?.name || '');
  setEditedAvatar(avatarUrl || '');
  setSelectedAvatarFile(null);
  setPreviewAvatarUrl('');
  setError(null);
  setSuccessMessage('');
  setEditing(true);
}, [user, avatarUrl]);

// Handle navigation state to start editing mode
// Use a ref to track if we've already opened edit mode from navigation
const hasOpenedFromNavigation = useRef(false);

useEffect(() => {
  if (location.state?.openEdit && user && !editing && avatarUrl && !hasOpenedFromNavigation.current) {
    hasOpenedFromNavigation.current = true;
    handleStartEditing();
  }
  
  // Reset the ref when navigation state is cleared
  if (!location.state?.openEdit) {
    hasOpenedFromNavigation.current = false;
  }
}, [location.state, user, avatarUrl, editing, handleStartEditing]);

const handleEditProfile = async () => {
  if (saving) return; // Prevent multiple simultaneous saves
  
  try {
    setSaving(true);
    setError(null);
    setSuccessMessage('');
    
    // Remove any spaces and sanitize the name
    const sanitizedEditedName = DOMPurify.sanitize(editedName.replace(/\s/g, ''));
    
    // Validate username doesn't contain spaces
    if (sanitizedEditedName && /\s/.test(sanitizedEditedName)) {
      setError('Username cannot contain spaces');
      setSaving(false);
      return;
    }
    
    // Handle avatar upload if a file was selected
    if (selectedAvatarFile) {
      try {
        setUploadingAvatar(true);
        await avatarService.replaceAvatar(selectedAvatarFile);
        
        // Get the new avatar URL and update the profile
        const newAvatarUrl = await avatarService.getAvatarUrl();
        setAvatarUrl(newAvatarUrl);
        
        // Dispatch custom event to update navbar avatar
        window.dispatchEvent(new CustomEvent('avatarUpdated'));
        
        setSuccessMessage('Avatar updated successfully!');
      } catch (avatarError) {
        console.error("Avatar upload failed:", avatarError);
        setError(`Failed to upload avatar: ${avatarError.message}`);
        return; // Don't continue if avatar upload fails
      } finally {
        setUploadingAvatar(false);
      }
    }
    
    // Update username using the Users API through backend
    if (sanitizedEditedName && sanitizedEditedName !== user.name) {
      let newUserData = null;
      
      try {
        // First try to update using the Users API (requires backend implementation)
        const result = await userService.updateUserName(user.$id, sanitizedEditedName);
        
        // Extract updated user data from the result
        if (result && result.user) {
          newUserData = {
            ...user,
            name: result.user.username,
            username: result.user.username,
            // Keep other properties from the result if available
            ...(result.user.id && { id: result.user.id, $id: result.user.id })
          };
        }
        
        setSuccessMessage(prev => prev ? `${prev} Username updated too!` : 'Username updated successfully!');
      } catch (error) {
        // Only log warning if it's not the expected "backend not available" error
        if (!error.message.includes('Backend server not available')) {
          console.warn('❌ Users API update failed, falling back to account service:', error);
        } else {
          console.error('⚠️ Backend not available, using local-only update');
        }
        // Fallback to account service if backend is not available (local-only update)
        try {
          await authService.updateProfile({ name: sanitizedEditedName });
          setSuccessMessage(prev => prev ? `${prev} Username updated locally (offline)!` : 'Username updated locally (offline)!');
        } catch (fallbackError) {
          console.error('❌ Both Users API and account service failed:', fallbackError);
          throw fallbackError;
        }
      }
      
      // Update the user context immediately to reflect changes in UI
      const updatedUserData = newUserData || {
        ...user,
        name: sanitizedEditedName,
        username: sanitizedEditedName
      };
      
      // Force a complete state update by creating a new object
      setUser(() => updatedUserData);
      
      // Force a re-render by updating the edited name
      setEditedName(sanitizedEditedName);
    }

    // Clear success message after 3 seconds
    setTimeout(() => setSuccessMessage(''), 3000);
    
    setEditing(false);
    setEditedName('');
    setEditedAvatar('');
    setSelectedAvatarFile(null);
    setPreviewAvatarUrl('');
    
    // Reset the ref to allow reopening from navigation in the future
    hasOpenedFromNavigation.current = false;
    // Clear the navigation state when closing edit mode after save
    navigate(location.pathname, { replace: true, state: {} });
  } catch (err) {
    console.error("Error updating profile:", err);
    setError("Failed to update profile");
  } finally {
    setSaving(false);
  }
};

// Calculate actual stats from user's games
const calculatedStats = useMemo(() => {
  if (!currentPlayer || !allGames || allGames.length === 0) {
    return {
      totalGames: 0,
      wins: 0,
      losses: 0,
      winRate: 0
    };
  }

  let wins = 0;
  let losses = 0;

  allGames.forEach(game => {
    // Determine if player won
    const winnerId = game.winner_id || game.gameState?.winner_id;
    const winnerName = game.gameState?.players?.find(p => p.id === winnerId)?.name;
    const isWin = winnerName === currentPlayer.name || winnerId === currentPlayer.id;
    
    if (isWin) {
      wins++;
    } else {
      losses++;
    }
  });

  const totalGames = allGames.length;
  const winRate = totalGames > 0 ? (wins / totalGames) * 100 : 0;

  return {
    totalGames,
    wins,
    losses,
    winRate: winRate.toFixed(1)
  };
}, [allGames, currentPlayer]);

// Create pie chart data - use calculated stats
const totalWins = calculatedStats.wins;
const totalLosses = calculatedStats.losses;
const hasGames = totalWins > 0 || totalLosses > 0;

const data = hasGames ? [
  { name: 'Wins', value: totalWins },
  { name: 'Losses', value: totalLosses }
] : [
  { name: 'No Games Yet', value: 1 }
];

const COLORS = [
  '#1DBF73',
  '#FF5C5C',
  '#6B7280' // Gray color for "No Games Yet"
]

// Only show error if we have an explicit error message or if currentPlayer is null
// Don't fail if tags or other minor data is missing
if (error || (!currentPlayer && isOwnProfile)) {
  return (
      <div className="error">{error || 'Profile not available'}</div>
  )
}

// Don't render anything if currentPlayer is not available yet
if (!currentPlayer) {
  return <div>Loading...</div>;
}

// Add functionality to toggle tags for adding or removing
// const toggleTag = (tag) => {
//   // Ensure tags is always an array
//   const currentTags = Array.isArray(tags) ? tags : [];
  
//   if (currentTags.some((t) => t.name === tag.name)) {
//     // If the tag is already active, mark it for removal
//     setTags(currentTags.filter((t) => t.name !== tag.name));
//   } else {
//     // If the tag is not active, mark it for adding
//     setTags([...currentTags, tag]);
//   }
// };

if (editing) {
  return (
    <div className="profile-edit-container">
    
      <div className="profile-edit-header">
        <button onClick={() => {
          // Clean up preview URL if it exists
          if (previewAvatarUrl) {
            URL.revokeObjectURL(previewAvatarUrl);
          }
          setSelectedAvatarFile(null);
          setPreviewAvatarUrl('');
          setEditing(false);
          // Reset the ref to allow reopening from navigation in the future
          hasOpenedFromNavigation.current = false;
          // Clear the navigation state to prevent reopening edit mode
          navigate(location.pathname, { replace: true, state: {} });
        }} className='close-button-edit'>x</button>
        
        {/* Avatar preview */}
        <div className="avatar-preview-container">
          <img 
            src={previewAvatarUrl || editedAvatar || avatarUrl} 
            alt="Avatar Preview" 
            className="avatar-preview" 
          />
        </div>

        <div className="avatar-actions">
          <label className="avatar-upload-label">
            <span>Upload</span>
            <input
            type="file"
            className="edit-avatar"
            label="Upload Avatar"
            accept="image/*"
            onChange={async (e) => {
              const file = e.target.files[0];
              if (file) {
                try {
                  setError(null);
                  
                  // Validate file type
                  if (!file.type.startsWith('image/')) {
                    setError('File must be an image');
                    return;
                  }
                  
                  // Validate file size (max 5MB)
                  if (file.size > 5 * 1024 * 1024) {
                    setError('File size must be less than 5MB');
                    return;
                  }
                  
                  // Store the selected file for upload later
                  setSelectedAvatarFile(file);
                  
                  // Create preview URL
                  const previewUrl = URL.createObjectURL(file);
                  setPreviewAvatarUrl(previewUrl);
                  
                } catch (err) {
                  console.error("File selection failed:", err);
                  setError(err.message || 'Failed to select file');
                }
              }
            }}
            disabled={uploadingAvatar}
            hidden
            />
          </label>

          <input
              type="text"
              className='edit-name'
              value={editedName}
              onChange={(e) => {
                // Remove any spaces from the input
                const nameWithoutSpaces = e.target.value.replace(/\s/g, '');
                setEditedName(nameWithoutSpaces);
              }}
              placeholder={user?.name || "Enter username"}
              maxLength={128}
            />
          <small style={{ 
            color: 'var(--text-secondary)', 
            fontSize: '0.85rem',
            marginTop: '0.25rem',
            display: 'block'
          }}>
            No spaces allowed in username
          </small>

          {uploadingAvatar && (
            <div className="uploading-indicator">
              Uploading avatar...
            </div>
          )}

          {(previewAvatarUrl || (editedAvatar && editedAvatar !== defaultAvatar)) && (
            <button
              onClick={() => {
                // Clear the preview and selected file
                setSelectedAvatarFile(null);
                setPreviewAvatarUrl('');
                if (previewAvatarUrl) {
                  URL.revokeObjectURL(previewAvatarUrl);
                }
                setEditedAvatar('');
              }}
              className='cancle-button'
              disabled={uploadingAvatar}
            >
              Remove Avatar
            </button>
          )}
        </div>

        
        
        {/* Success message */}
        {successMessage && (
          <div className="settings-message success">
            {successMessage}
          </div>
        )}
        
        {/* Error message */}
        {error && (
          <div className="settings-message error">
            {error}
          </div>
        )} 
        
        {/* <div className="edit-tags-list">
          {Array.isArray(defaultTags) && defaultTags
          .filter(tag => tag && tag.name && !tag.name.startsWith("Top "))
          .map(tag => (
          <span 
            key={tag.id || tag.name} 
            className={`tag ${Array.isArray(tags) && tags.some(t => t && t.name === tag.name) ? 'active-tag' : ''}`} 
            onClick={() => toggleTag(tag)}>
            {tag.name}
          </span>
          ))}
        </div>   */}
            
        <div className="edit-buttons">
          <button 
            onClick={handleEditProfile} 
            className='save-button'
            disabled={saving || uploadingAvatar || (!editedName && !selectedAvatarFile)}
            style={{
              opacity: saving || uploadingAvatar || (!editedName && !selectedAvatarFile) ? 0.6 : 1,
              cursor: saving || uploadingAvatar || (!editedName && !selectedAvatarFile) ? 'not-allowed' : 'pointer'
            }}
          >
            {uploadingAvatar ? 'Uploading Avatar...' : saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
  }else{
  return (
    <div className="profile-container">
      <div className="profile-content">

        {/* Header section with buttons positioned at top corners */}
        <div className="profile-header">
          <div className="toggle-section" style={{ display: window.innerWidth > 768 ? 'none' : 'flex' }}>
            <button
              className="game-control-btn"
              onClick={() => {
                // Cycle through tabs: performance -> recentGames -> allGames -> performance
                if (activeTab === 'performance') setActiveTab('recentGames');
                else setActiveTab('performance');
              }}
              id='toggle-button-profile'
            >
              {activeTab === 'recentGames' ? <StatIcon size={30} /> : <CalendarIcon size={30} />}
            </button>
          </div>

        <img src={currentPlayer?.avatar || defaultAvatar} alt={currentPlayer?.name || "Default Avatar"} className="profile-avatar" />

          {canEdit && (
            <button
              onClick={handleStartEditing}
              className='edit-button'>
              <EditIcon size={30} />
            </button>
          )}
        </div>

      
        <div className="player-info">
            <div className="player-name-tags">
              <h1>{currentPlayer?.display_name || currentPlayer?.name || "Unknown Player"}</h1>
              {/* Only show tags container if we have tags */}
              {Array.isArray(tags) && tags.length > 0 &&
              <div className="tags-container">
                {tags.map(tag => (
                  <span key={tag.id || tag.name} className="tag">{tag.name}</span>
                ))}
              </div>
              }
            </div>
          <div className="stats-summary">
            <StatCard 
              title="Games" 
              value={calculatedStats.totalGames}
            />
            <StatCard 
              title="Win Rate" 
              value={`${calculatedStats.winRate}%`}
            />
          </div>
        </div>

        {/* Desktop Tab Navigation */}
        {window.innerWidth > 768 && (
          <div className="profile-tabs" style={{ display: 'flex', gap: '1rem', borderBottom: '1px solid var(--border-color)', marginBottom: '1rem' }}>
            <button
              onClick={() => setActiveTab('performance')}
              style={{
                padding: '0.75rem 1.5rem',
                background: 'none',
                border: 'none',
                borderBottom: activeTab === 'performance' ? '3px solid var(--primary-color)' : '3px solid transparent',
                color: activeTab === 'performance' ? 'var(--primary-color)' : 'var(--text-color)',
                cursor: 'pointer',
                fontSize: '1rem',
                fontWeight: activeTab === 'performance' ? '600' : '400',
                transition: 'all 0.2s'
              }}
            >
              Overview
            </button>
            <button
              onClick={() => setActiveTab('recentGames')}
              style={{
                padding: '0.75rem 1.5rem',
                background: 'none',
                border: 'none',
                borderBottom: activeTab === 'recentGames' ? '3px solid var(--primary-color)' : '3px solid transparent',
                color: activeTab === 'recentGames' ? 'var(--primary-color)' : 'var(--text-color)',
                cursor: 'pointer',
                fontSize: '1rem',
                fontWeight: activeTab === 'recentGames' ? '600' : '400',
                transition: 'all 0.2s'
              }}
            >
              Recent Games
            </button>
          </div>
        )}

        {activeTab === 'performance' && (
          <div className="stats-graph">
            <h2>Performance</h2>
            <ResponsiveContainer width="100%" height={100}>
              <PieChart>
                <Pie
                  data={data}
                  innerRadius={30}
                  outerRadius={50}
                  dataKey="value"
                >
                  {data.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="chart-legend">
              {hasGames ? (
                <>
                  <div className="legend-item">
                    <span className="legend-color" style={{ backgroundColor: COLORS[0] }}></span>
                    <span>Wins ({totalWins})</span>
                  </div>
                  <div className="legend-item">
                    <span className="legend-color" style={{ backgroundColor: COLORS[1] }}></span>
                    <span>Losses ({totalLosses})</span>
                  </div>
                </>
              ) : (
                <div className="legend-item">
                  {/* <span className="legend-color" style={{ backgroundColor: COLORS[2] }}></span> */}
                  <span>No Games Yet - Start playing to see your stats!</span>
                </div>
              )}
            </div>
            
            {/* Link to Stats History Page */}
            {hasGames && (
              <Link
                to="/profile/stats"
                className="view-all-stats"
                style={{
                  color: 'var(--primary-color)',
                  fontSize: '0.875rem',
                  display: 'inline-block',
                  marginTop: '0.5rem'
                }}
              >
                View Complete Stats History
              </Link>
            )}
          </div>
        )}

        {activeTab === 'recentGames' && (
          <div className="recent-games" style={{ padding: 'var(--spacing-md) 0' }}>
            <h2>Recent Games</h2>
            <div className="games-list">
              {allGames.length > 0 ? (
                allGames.map(game => (
                  <GameHistoryItem key={game.id} game={game} />
                ))
              ) : (
                <div className="empty-message">No games found</div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
}

export default Profile