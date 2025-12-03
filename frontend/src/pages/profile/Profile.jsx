import { useState, useEffect, useMemo } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts'
import GameHistoryItem from '@/components/game/GameHistoryItem'
import StatCard from '@/components/ui/StatCard'
import GameFilterModal from '@/components/modals/GameFilterModal'
import { useUser } from '@/shared/hooks/useUser'
import { sanitizeImageUrl } from '@/shared/utils/urlSanitizer'
import { StatIcon, EditIcon, CalendarIcon, FilterIcon } from "@/components/ui/Icon"
import { filterGames, getDefaultFilters, hasActiveFilters } from '@/shared/utils/gameFilters'

// Temporarily remove playerService imports since they're not implemented yet
// import { getPlayerById, updatePlayer, updatePlayerTags, getTagsByPlayerId, getTags } from '@/shared/api/playerService'
import { getRecentLocalGames } from '@/shared/api/gameService'
import avatarService from '@/shared/api/avatarService'
import defaultAvatar from "@/assets/default-avatar.png";

const Profile = () => {
  const { id: paramId } = useParams()
  const navigate = useNavigate()
  const { user } = useUser()
  // For now, only allow viewing your own profile (paramId support can be added later)
  const isOwnProfile = !paramId || paramId === user?.id
  
  const [allGames, setAllGames] = useState([])
  const [tags, setTags] = useState([])
  const [error, setError] = useState(null)
  const [activeTab, setActiveTab] = useState('performance')
  const [avatarUrl, setAvatarUrl] = useState(defaultAvatar);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [filters, setFilters] = useState(getDefaultFilters());

  // Apply filters to games
  const filteredGames = useMemo(() => {
    return filterGames(allGames, filters);
  }, [allGames, filters]);

  const handleApplyFilters = (newFilters) => {
    setFilters(newFilters);
  };

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
        // Clear games when user logs out
        setAllGames([]);
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
          user.$id // user ID
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

return (
  <div className="profile-container">
    <div className="profile-content">

      {/* Header section with buttons positioned at top corners */}
      <div className="profile-header">
        <div className="toggle-section" >
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

        <img src={sanitizeImageUrl(currentPlayer?.avatar || defaultAvatar, defaultAvatar)} alt={currentPlayer?.name || "Default Avatar"} className="profile-avatar" />

        {canEdit && (
          <button
            onClick={() => navigate('/profile/edit')}
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
        {/* <div className="stats-summary">
          <StatCard 
            title="Games" 
            value={calculatedStats.totalGames}
          />
          <StatCard 
            title="Win Rate" 
            value={`${calculatedStats.winRate}%`}
          />
        </div> */}
      </div>

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
                  color: 'var(--primary)',
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
          <div className="recent-games">
            <div className="section-header">
              <h2>Recent Games</h2>
              <button 
                className="filter-button"
                onClick={() => setShowFilterModal(true)}
                aria-label="Filter games"
                style={{
                  background: 'var(--primary)',
                  color: 'var(--text-white)',
                  border: 'none',
                  borderRadius: 'var(--radius-md)',
                  padding: 'var(--spacing-xs) var(--spacing-sm)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--spacing-xs)',
                  position: 'relative'
                }}
              >
                <FilterIcon size={20} />
                {hasActiveFilters(filters) && (
                  <span style={{
                    position: 'absolute',
                    top: '-4px',
                    right: '-4px',
                    width: '12px',
                    height: '12px',
                    background: 'var(--danger-color, red)',
                    borderRadius: '50%',
                    border: '2px solid var(--card-bg)'
                  }} />
                )}
              </button>
            </div>
            <div className="games-list">
              {filteredGames.length > 0 ? (
                filteredGames.map(game => (
                  <GameHistoryItem key={game.id} game={game} />
                ))
              ) : allGames.length > 0 ? (
                <div className="empty-message">No games match your filters</div>
              ) : (
                <div className="empty-message">No games found</div>
              )}
            </div>
          </div>
        )}

        {/* Filter Modal */}
        <GameFilterModal
          isOpen={showFilterModal}
          onClose={() => setShowFilterModal(false)}
          onApplyFilters={handleApplyFilters}
          initialFilters={filters}
        />
      </div>
    </div>
  )
}

export default Profile