import { useState, useEffect, useMemo } from 'react'
import { useParams, Link } from 'react-router-dom'
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts'
import GameHistoryItem from '@/components/game/GameHistoryItem'
import StatCard from '@/components/ui/StatCard'
import { useUser } from '@/shared/hooks/useUser'
import { StatIcon, EditIcon, CalendarIcon } from "@/components/ui/Icon"
// Temporarily remove playerService imports since they're not implemented yet
// import { getPlayerById, updatePlayer, updatePlayerTags, getTagsByPlayerId, getTags } from '@/shared/api/playerService'
import { getPlayerGameHistory } from '@/shared/api/gameService'
import userService from '@/shared/api/userService'
import avatarService from '@/shared/api/avatarService'
import defaultAvatar from "@/assets/default-avatar.png";
import DOMPurify from 'dompurify';
import "@/styles/utils/pageTransition.css"
import authService from '@/shared/api/authService'

const Profile = () => {
  const { id: paramId } = useParams()
  const { user, refreshPlayerData } = useUser()
  // For now, only allow viewing your own profile (paramId support can be added later)
  const isOwnProfile = !paramId || paramId === user?.$id
  
  const [gameHistory, setGameHistory] = useState([])
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
        id: user.$id,
        name: user.name || 'User',
        email: user.email,
        avatar: avatarUrl,
        // Add other default properties
        tags: [],
        created_at: user.$createdAt,
        updated_at: user.$updatedAt
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
      
      // Try to fetch game history using the user ID
      try {
        const history = await getPlayerGameHistory(currentPlayer.id);
        setGameHistory(history || []);
      } catch (err) {
        console.log('Game history not available:', err);
        setGameHistory([]);
      }
      
    } catch (error) {
      console.error("Error fetching profile data:", error);
      setError("Failed to load profile data");
    }
  };

  if (currentPlayer) fetchData();
}, [currentPlayer, isOwnProfile]);

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
  }
}, [currentPlayer, isOwnProfile]);

const handleStartEditing = () => {
  setEditedName(user?.name || '');
  setEditedAvatar(avatarUrl || '');
  setSelectedAvatarFile(null);
  setPreviewAvatarUrl('');
  setError(null);
  setSuccessMessage('');
  setEditing(true);
};

const handleEditProfile = async () => {
  if (saving) return; // Prevent multiple simultaneous saves
  
  try {
    setSaving(true);
    setError(null);
    setSuccessMessage('');
    
    const sanitizedEditedName = DOMPurify.sanitize(editedName);
    
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
      try {
        // First try to update using the Users API (requires backend implementation)
        await userService.updateUserName(user.$id, sanitizedEditedName);
        console.log('Username updated successfully via Users API');
        setSuccessMessage(prev => prev ? `${prev} Username updated too!` : 'Username updated successfully!');
      } catch (error) {
        // Only log warning if it's not the expected "backend not available" error
        if (!error.message.includes('Backend server not available')) {
          console.warn('Users API update failed, falling back to account service:', error);
        }
        // Fallback to account service if backend is not available
        try {
          await authService.updateProfile({ name: sanitizedEditedName });
          console.log('Username updated successfully via account service');
          setSuccessMessage(prev => prev ? `${prev} Username updated too!` : 'Username updated successfully!');
        } catch (fallbackError) {
          console.error('Both Users API and account service failed:', fallbackError);
          throw fallbackError;
        }
      }
      
      // Add a small delay to ensure the update is processed
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Refresh the user context to get updated data
      await refreshPlayerData();
    }

    // Clear success message after 3 seconds
    setTimeout(() => setSuccessMessage(''), 3000);
    
    setEditing(false);
    setEditedName('');
    setEditedAvatar('');
    setSelectedAvatarFile(null);
    setPreviewAvatarUrl('');
  } catch (err) {
    console.error("Error updating profile:", err);
    setError("Failed to update profile");
  } finally {
    setSaving(false);
  }
};

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

const recentGames = gameHistory.slice(0, 3);

// Create pie chart data - ensure we always have some data to display
const totalWins = currentPlayer?.total_wins || 0;
const totalLosses = currentPlayer?.total_losses || 0;
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
            <span>Upload Avatar</span>
            <input
            type="file"
            className="edit-avatar"
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

        <input
        type="text"
        className='edit-name'
        value={editedName}
        onChange={(e) => setEditedName(e.target.value)}
        placeholder={user?.name || "Enter username"}
        maxLength={128}
        />
        
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
              onClick={() => setActiveTab(activeTab === 'recentGames' ? 'performance' : 'recentGames')}
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
              title="ELO" 
              value={currentPlayer?.elo || 0}
            />
            <StatCard 
              title="Games" 
              value={currentPlayer?.total_games || 0}
            />
            <StatCard 
              title="Win Rate" 
              value={
                currentPlayer?.total_games ? 
                `${((currentPlayer?.total_wins || 0) / Math.max(1, currentPlayer?.total_games) * 100).toFixed(2)}%` 
                : '0%'
              }
            />
          </div>
        </div>

        {(window.innerWidth > 768 || activeTab === 'performance') && (
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
            
            {/* Disabled link */}
            <span
              className="view-all-stats"
              style={{
                pointerEvents: 'none',
                opacity: 0.5,
                cursor: 'not-allowed'
              }}
              aria-disabled="true"
              tabIndex={-1}
            >
              View Complete Stats History
            </span>
          </div>
        )}

        {(window.innerWidth > 768 || activeTab === 'recentGames') && (
          <div className="recent-games" style={{ padding: 'var(--spacing-md) 0' }}>
            <h2>Recent Games</h2>
            <div className="games-list">
              {recentGames.length > 0 ? (
                recentGames.map(game => (
                  <GameHistoryItem key={game.id} game={game} />
                ))
              ) : (
                <div className="empty-message">No game history found</div>
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