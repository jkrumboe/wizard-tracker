import { useState, useEffect, useMemo } from 'react'
import { useParams, Link } from 'react-router-dom'
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts'
import GameHistoryItem from '../components/GameHistoryItem'
import StatCard from '../components/StatCard'
import { useUser } from '../hooks/useUser'
import { StatIcon, EditIcon, CalendarIcon } from "../components/Icon"
import { getPlayerById, updatePlayer, updatePlayerTags, getTagsByPlayerId, getTags } from '../services/playerService'
import { getPlayerGameHistory } from '../services/gameService'
import defaultAvatar from "../assets/default-avatar.png";
import imageCompression from 'browser-image-compression';
import DOMPurify from 'dompurify';

const Profile = () => {
  const { id } = useParams()
  const { user, refreshPlayerData, updatePlayerData } = useUser()
  const [player, setPlayer] = useState(null)
  const [gameHistory, setGameHistory] = useState([])
  const [tags, setTags] = useState([])
  const [defaultTags, setDefaultTags] = useState([])
  const [loading, setLoading] = useState(true)
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
  console.log("Edit Access:", editAccess);
  return editAccess;
}
return false;
}, [user, player]);

useEffect(() => {
  const fetchData = async () => {
    try {
      const playerData = await getPlayerById(id);
      const tagdata = await getTags();
      setDefaultTags(tagdata);

      // Player data should include stats with new schema
      setPlayer({
        ...playerData,
        avatar: playerData.avatar || defaultAvatar,
      });

      // // Set player stats from the player data (new schema includes stats)
      // if (playerData.total_games !== undefined) {
      //   setPlayerStats({
      //     total_games: playerData.total_games,
      //     wins: playerData.wins,
      //     total_points: playerData.total_points || 0
      //   });
      // }

      const history = await getPlayerGameHistory(id);
      setGameHistory(history);

      setLoading(false);
    } catch (err) {
      console.error("Error fetching profile data:", err);
      setError("Failed to load player profile");
      setLoading(false);
    }
  };

  fetchData();
}, [id]);

useEffect(() => {
  const fetchTags = async () => {
    try {
      const fetchedtags = await getTagsByPlayerId(id);
      setTags(fetchedtags);
    } catch (error) {
      console.error("Failed to fetch tags", error);
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
    
    // Update context and refresh navbar avatar if this is the current user's profile
    if (user && user.player_id === player.id) {
      updatePlayerData(updatedPlayer); 
      await refreshPlayerData(); 
    }
  } catch (err) {
    console.error("Error updating profile:", err);
  }
};

if (loading) {
  return <div className="loading">Loading player profile...</div>
}

if (error || !player) {
  return <div className="error">{error || 'Player not found'}</div>
}
  const recentGames = gameHistory.slice(0, 3);

const data = [
  { name: 'Wins', value: player.total_wins },
  { name: 'Losses', value: player.total_losses }
]

const COLORS = [
  '#1DBF73',
    '#FF5C5C'
  ]

// Add functionality to toggle tags for adding or removing
const toggleTag = (tag) => {
  if (!tags) {
    setTags([tag]);
    return;
  }
  
  if (tags.some((t) => t.name === tag.name)) {
    // If the tag is already active, mark it for removal
    setTags(tags.filter((t) => t.name !== tag.name));
  } else {
    // If the tag is not active, mark it for adding
    setTags([...tags, tag]);
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
          {defaultTags
          .filter(tag => !tag.name.startsWith("Top "))
          .map(tag => (
          <span 
            key={tag.id} 
            className={`tag ${tags && tags.some(t => t.name === tag.name) ? 'active-tag' : ''}`} 
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
            <h1>{player?.display_name || "Unknown Player"}</h1>
            {tags && tags.length > 0 &&
            <div className="tags-container">
              {tags && tags.length > 0 && 
                tags.map(tag => (
                  <span key={tag.id} className="tag">{tag.name}</span>
                ))
              }
            </div>
            }
          </div>
        <div className="stats-summary">
          <StatCard 
            title="ELO" 
            value={player.elo}
          />
          <StatCard 
            title="Games" 
            value={player.total_games}
          />
          <StatCard 
            title="Win Rate" 
            value={`${player.total_losses === 0 ? '0' : ((player.total_wins / player.total_losses) * 100).toFixed(2)}%`}
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
          
          <Link to={`/stats/${player.id}`} className="view-all-stats">
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
    </div>
  </div>
  )
}
}

export default Profile