import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts'
import GameHistoryItem from '../components/GameHistoryItem'
import StatCard from '../components/StatCard'

import { getPlayerById, getPlayerStats, updatePlayerProfile, updatePlayerTags, getTagsByPlayerId, getTags } from '../services/playerService'
import { getPlayerGameHistory } from '../services/gameService'
import defaultAvatar from "../assets/default-avatar.png";
import imageCompression from 'browser-image-compression';
import DOMPurify from 'dompurify';

const Profile = () => {
  const { id } = useParams()
  const [player, setPlayer] = useState(null)
  const [gameHistory, setGameHistory] = useState([])
  const [tags, setTags] = useState(null)
  const [defaultTags, setDefaultTags] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [playerStats, setPlayerStats] = useState(null)
  const [activeTab, setActiveTab] = useState('performance')
  const [editing, setEditing] = useState(false);
  const [editedName, setEditedName] = useState('');
  const [editedAvatar, setEditedAvatar] = useState('');
  // const [editedTags, setEditedTags] = useState([]);

  // Logs
  // console.log("Player ID:", id)
  // console.log("Player:", player)
  // console.log("Game History:", gameHistory)
  // console.log("Player Stats:", playerStats)


  useEffect(() => {
    const fetchData = async () => {
      try {
        const playerData = await getPlayerById(id)
        const tagdata = await getTags()
        setDefaultTags(tagdata)
        // console.log("Tags:", tagdata)
        
        setPlayer({
          ...playerData,
          avatar: playerData.avatar || defaultAvatar,
        });

        const history = await getPlayerGameHistory(id)
        setGameHistory(history)
        
        setLoading(false)
      } catch (err) {
        console.error('Error fetching profile data:', err)
        setError('Failed to load player profile')
        setLoading(false)
      }
    }

    fetchData()
  }, [id])

  useEffect(() => {
    const fetchPlayerStats = async () => {
      try {
        const stats = await getPlayerStats(player.id)
        setPlayerStats(stats)
      } catch (error) {
        console.error("Failed to fetch player stats", error)
      }
    }

    if (player) {
      fetchPlayerStats()
    }
  }, [player])

  useEffect(() => {
    const fetchTags = async () => {
      try {
        const fetchedtags = await getTagsByPlayerId(id);
        setTags(fetchedtags);
        setLoading(false);
      } catch (error) {
        console.error("Failed to fetch tags", error);
        setLoading(false);
      }
    };
  
    if (id) {
      fetchTags();
    }
  }, [id]);
  

  const canEdit = async () => {
    try {
      const token = localStorage.getItem("token");
      if (token) {
        const decoded = JSON.parse(atob(token.split(".")[1]));
        const editAccess = decoded.role >= 2 || decoded.player_id === player.id;
        return editAccess;
      } else {
        console.error("No token found in localStorage.");
        return false;
      }
    } catch (err) {
      console.error("Error decoding token:", err);
      return false;
    }
  };

  const handleEditProfile = async () => {
    try {
      const sanitizedEditedName = DOMPurify.sanitize(editedName);
      const sanitizedEditedAvatar = DOMPurify.sanitize(editedAvatar);

      const updatedPlayer = {
        ...player,
        name: sanitizedEditedName || player.name,
        avatar: sanitizedEditedAvatar || player.avatar,
      };
      await updatePlayerProfile(updatedPlayer);
      await updatePlayerTags(player.id, tags);
      setPlayer(updatedPlayer);
      setEditedName('');
      setEditedAvatar('');
      setEditing(false);
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
  
  const recentGames = gameHistory.slice(0, 3)
  let winRate = 0;
  let lossRate = 0;
  let totalGames = 1;

  if (playerStats) {
    winRate = playerStats.total_games > 0
      ? Math.round((playerStats.wins / playerStats.total_games) * 100)
      : 0;
    lossRate = Math.round(100 - winRate);
    totalGames = playerStats.total_games || 1;
  }

  const data = [
    { name: 'Wins', value: winRate },
    { name: 'Losses', value: lossRate }
  ]
  const COLORS = [
    '#1DBF73',
     '#FF5C5C'
    ]

    // console.log("Tags:", tags)
    // console.log("Edit Tags:", editedTags)

  // Add functionality to toggle tags for adding or removing
  const toggleTag = (tag) => {
    if (tags.some((t) => t.name === tag.name)) {
      // If the tag is already active, mark it for removal
      setTags(tags.filter((t) => t.name !== tag.name));
    } else {
      // If the tag is not active, mark it for adding
      setTags([...tags, tag]);
    }
  };

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
          />

          <div className="edit-tags-list">
            {defaultTags
            .filter(tag => !tag.name.startsWith("Top "))
            .map(tag => (
            <span 
              key={tag.id} 
              className={`tag ${tags.some(t => t.name === tag.name) ? 'active-tag' : ''}`} 
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
      <div className="profile-header">
        {canEdit() && (
          <button
            onClick={() => setEditing(true)}
            className='edit-button'>
            Edit
          </button>
        )}

        <img src={player?.avatar || defaultAvatar} alt={player?.name || "Default Avatar"} className="avatar" />
        <div className="player-info">
          <h1>{player?.name || "Unknown Player"}</h1>
          <div className="tags-container">
            {tags && tags.length > 0 && 
              tags.map(tag => (
                <span key={tag.id} className="tag">{tag.name}</span>
              ))
            }
          </div>  
          <div className="stats-summary">
            <StatCard 
              title="ELO" 
              value={player.elo}
            />
            <StatCard 
              title="Games" 
              value={totalGames}
            />
            <StatCard 
              title="Win Rate" 
              value={`${winRate}%`}
            />
            <StatCard 
              title="Total Points"
              value={playerStats ? playerStats.total_points : 0}
            />
          </div>
        </div>
      </div>

      <div className="profile-content">
        <div className="card-tabs">
          <button 
            className={`tab-button ${activeTab === 'performance' ? 'active' : ''}`} 
            onClick={() => setActiveTab('performance')}
          >
            Performance
          </button>
          <button 
            className={`tab-button ${activeTab === 'recentGames' ? 'active' : ''}`} 
            onClick={() => setActiveTab('recentGames')}
          >
            Recent Games
          </button>
        </div>

          {activeTab === 'performance' && (
            <div className="stats-graph">
              <h2>Performance</h2>
              <ResponsiveContainer width="100%" height={200}>
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
                  <span>Wins ({winRate}%)</span>
                </div>
                <div className="legend-item">
                  <span className="legend-color" style={{ backgroundColor: COLORS[1] }}></span>
                  <span>Losses ({lossRate}%)</span>
                </div>
              </div>
              
              <Link to={`/stats/${player.id}`} className="view-all-stats">
                View Complete Stats History
              </Link>
            </div>
          )}

          {activeTab === 'recentGames' && (
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
  )}
}

export default Profile