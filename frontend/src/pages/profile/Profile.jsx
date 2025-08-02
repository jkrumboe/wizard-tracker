import { useState, useEffect, useMemo } from 'react'
import { useParams, Link } from 'react-router-dom'
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts'
import GameHistoryItem from '@/components/game/GameHistoryItem'
import StatCard from '@/components/ui/StatCard'
import { useUser } from '@/shared/hooks/useUser'
import { StatIcon, EditIcon, CalendarIcon } from "@/components/ui/Icon"
import { getPlayerById, updatePlayer, updatePlayerTags, getTagsByPlayerId, getTags } from '@/shared/api/playerService'
import { getPlayerGameHistory } from '@/shared/api/gameService'
import defaultAvatar from "@/assets/default-avatar.png";
import imageCompression from 'browser-image-compression';
import DOMPurify from 'dompurify';
import "@/styles/utils/pageTransition.css"
import authService from '@/shared/api/authService'

const Profile = () => {
  const { id: paramId } = useParams()
  const { user, refreshPlayerData, updatePlayerData } = useUser()
  const id = paramId || user?.player_id
  const [player, setPlayer] = useState(null)
  const [gameHistory, setGameHistory] = useState([])
  const [tags, setTags] = useState([])
  const [defaultTags, setDefaultTags] = useState([])
  // const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  // const [playerStats, setPlayerStats] = useState(null)
  const [activeTab, setActiveTab] = useState('performance')
  const [editing, setEditing] = useState(false);
  const [editedName, setEditedName] = useState('');
  const [editedAvatar, setEditedAvatar] = useState('');
  // const [editedTags, setEditedTags] = useState([]);


const canEdit = useMemo(() => {
// Remove localStorage token check - use the user context instead
if (user && player) {
  const editAccess = user.role >= 2 || user.player_id === player.id;
  return editAccess;
}
return false;
}, [user, player]);

useEffect(() => {
  const fetchData = async () => {
    try {
      if (!id) return;
      // Fetch player data first - this is the most critical
      const playerData = await getPlayerById(id);
      if (!playerData) {
        throw new Error("Player not found");
      }
      
      // Try to fetch tags, but don't fail if they're not available
      try {
        const tagdata = await getTags();
        setDefaultTags(Array.isArray(tagdata) ? tagdata : []);
      } catch (tagError) {
        console.error("Error fetching tags:", tagError);
        setDefaultTags([]);  // Use empty array as fallback
      }

      // Player data should include stats with new schema
      setPlayer({
        ...playerData,
        avatar: playerData.avatar || defaultAvatar,
      });

      const history = await getPlayerGameHistory(id);
      setGameHistory(history);

      // setLoading(false);
    } catch (err) {
      console.error("Error fetching profile data:", err);
      setError("Failed to load player profile");
      // setLoading(false);
    }
  };

  if (id) fetchData();
}, [id]);

useEffect(() => {
  const fetchTags = async () => {
    try {
      const fetchedtags = await getTagsByPlayerId(id);
      // If fetched tags is null, undefined or not an array, initialize as empty array
      setTags(Array.isArray(fetchedtags) ? fetchedtags : []);
    } catch (error) {
      console.error("Failed to fetch tags", error);
      // On error, set tags to empty array instead of leaving it undefined
      setTags([]);
    }
  };

  if (id) {
    fetchTags();
  }
}, [id]);

const handleEditProfile = async () => {
  try {
    const sanitizedEditedName = DOMPurify.sanitize(editedName);
    const sanitizedEditedAvatar = DOMPurify.sanitize(editedAvatar);

    const updatedPlayer = {
      ...player,
      name: sanitizedEditedName || player.name,
      avatar: sanitizedEditedAvatar || player.avatar,
    };
    
    // Update player on server
    await updatePlayer(player.id, updatedPlayer);
    await updatePlayerTags(player.id, tags);
    
    // Update local state
    setPlayer(updatedPlayer);
    setEditedName('');
    setEditedAvatar('');
    setEditing(false);
    
    // Update context and user metadata if this is the current user's profile
    if (user && user.player_id === player.id) {
      await authService.updateProfile({ name: updatedPlayer.name, avatar: updatedPlayer.avatar });
      updatePlayerData(updatedPlayer);
      await refreshPlayerData();
    }
  } catch (err) {
    console.error("Error updating profile:", err);
  }
};

// Only show error if we have an explicit error message or if player is null
// Don't fail if tags or other minor data is missing
if (error || !player) {
  return (
      <div className="error">{error || 'Player not found'}</div>
  )
}
  const recentGames = gameHistory.slice(0, 3);

const data = [
  { name: 'Wins', value: player.total_wins || 0 },
  { name: 'Losses', value: player.total_losses || 0 }
]

const COLORS = [
  '#1DBF73',
    '#FF5C5C'
  ]

// Add functionality to toggle tags for adding or removing
const toggleTag = (tag) => {
  // Ensure tags is always an array
  const currentTags = Array.isArray(tags) ? tags : [];
  
  if (currentTags.some((t) => t.name === tag.name)) {
    // If the tag is already active, mark it for removal
    setTags(currentTags.filter((t) => t.name !== tag.name));
  } else {
    // If the tag is not active, mark it for adding
    setTags([...currentTags, tag]);
  }
};

console.debug("Player Data:", player);
console.debug("Data:", data);

if (editing) {
  return (
    <div className="profile-edit-container">
    
      <div className="profile-edit-header">
        <button onClick={() => setEditing(false)} className='close-button-edit'>x</button>
        
        {editedAvatar && (
        <img src={editedAvatar} alt="Preview" className="avatar-preview" />
        )}

        <div>
          <label className="avatar-upload-label">
            <span>📁 Upload Avatar</span>
            <input
            type="file"
            className="edit-avatar"
            onChange={async (e) => {
            const file = e.target.files[0];
            if (file) {
              const options = {
              maxSizeMB: 0.2, 
              maxWidthOrHeight: 500, 
              useWebWorker: true
              };

              try {
              const compressedFile = await imageCompression(file, options);
              const reader = new FileReader();
              reader.onload = () => setEditedAvatar(reader.result);
              reader.readAsDataURL(compressedFile);
              } catch (err) {
              console.error("Image compression failed:", err);
              }
            }
            }}
            hidden
            />
          </label>

          {editedAvatar && (
          <button
          onClick={() => setEditedAvatar('')}
          className='cancle-button'>
          Cancel
          </button>
          )}
        </div>

        <input
        type="text"
        className='edit-name'
        value={editedName}
        onChange={(e) => setEditedName(e.target.value)}
        placeholder="Edit username"
        />        <div className="edit-tags-list">
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
        </div>  
            
        <div className="edit-buttons">
          <button onClick={handleEditProfile} className='save-button'>Save Changes</button>
        </div>
      </div>
    </div>
  );
  }else{
  return (
    <div className="profile-container">
      <div className="profile-content">
        {canEdit && (
          <button
            onClick={() => setEditing(true)}
            className='edit-button'>
            <EditIcon size={30} />
          </button>
        )}

        <img src={player?.avatar || defaultAvatar} alt={player?.name || "Default Avatar"} className="profile-avatar" />
      
        <div className="player-info">
            <div className="player-name-tags">
              <h1>{player?.display_name || player?.name || "Unknown Player"}</h1>
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
              value={player.elo || 0}
            />
            <StatCard 
              title="Games" 
              value={player.total_games || 0}
            />
            <StatCard 
              title="Win Rate" 
              value={
                player.total_games ? 
                `${((player.total_wins || 0) / Math.max(1, player.total_games) * 100).toFixed(2)}%` 
                : '0%'
              }
            />
          </div>
        </div>

   
        {/* Toggle button for mobile/tablet */}
        <div className="toggle-section" style={{ display: window.innerWidth > 768 ? 'none' : 'flex' }}>
          <button
            className="game-control-btn"
            onClick={() => setActiveTab(activeTab === 'recentGames' ? 'performance' : 'recentGames')}
            id='toggle-button-profile'
          >
            {activeTab === 'recentGames' ? <StatIcon size={30} /> : <CalendarIcon size={30} />}
          </button>
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
              <div className="legend-item">
                <span className="legend-color" style={{ backgroundColor: COLORS[0] }}></span>
                <span>Wins ({player.total_wins})</span>
              </div>
              <div className="legend-item">
                <span className="legend-color" style={{ backgroundColor: COLORS[1] }}></span>
                <span>Losses ({player.total_losses})</span>
              </div>
            </div>
            
            <Link to={`/stats/${encodeURIComponent(player.display_name || player.name)}`} className="view-all-stats">
              View Complete Stats History
            </Link>
          </div>
        )}

        {(window.innerWidth > 768 || activeTab === 'recentGames') && (
          <div className="recent-games">
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

        {user && user.player_id === player.id && (
          <button onClick={authService.logout} className="logout-btn">Sign Out</button>
        )}
      </div>
    </div>
  )
}
}

export default Profile