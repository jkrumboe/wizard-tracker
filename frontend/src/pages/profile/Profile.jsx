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
import avatarService from '@/shared/api/avatarService'
import defaultAvatar from "@/assets/default-avatar.png";

const Profile = () => {
  const { id: paramId } = useParams()
  const navigate = useNavigate()
  const { user } = useUser()
  // Support viewing other profiles by userId
  const isOwnProfile = !paramId || paramId === user?.id
  
  const [allGames, setAllGames] = useState([])
  const [profileData, setProfileData] = useState(null)
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

  // Create player object from user data or profileData
  const currentPlayer = useMemo(() => {
    // If viewing own profile and user is available
    if (isOwnProfile && user) {
      return {
        id: user.id,
        name: user.name || user.username || 'User',
        username: user.username,
        avatar: avatarUrl,
        tags: [],
        created_at: user.createdAt,
        updated_at: user.createdAt
      }
    }
    // If viewing another user's profile and profileData is loaded
    if (!isOwnProfile && profileData) {
      return {
        id: profileData.id || profileData._id,
        name: profileData.username,
        username: profileData.username,
        avatar: profileData.profilePicture || defaultAvatar,
        tags: [],
        created_at: profileData.createdAt,
        updated_at: profileData.createdAt
      }
    }
    return null
  }, [user, profileData, isOwnProfile, avatarUrl])

const canEdit = useMemo(() => {
  // Only allow editing your own profile
  return isOwnProfile && user && currentPlayer;
}, [user, currentPlayer, isOwnProfile]);

useEffect(() => {
  const fetchData = async () => {
    try {
      // Determine which user to fetch data for
      const targetUserId = paramId || user?.id;
      
      if (!targetUserId) {
        setError("No user specified");
        setAllGames([]);
        return;
      }

      // For now, just set empty default data since playerService is not implemented
      // setDefaultTags([]);
      
      // Fetch profile data from API using userId
      try {
        console.log('🔄 [Profile] Fetching profile data for userId:', targetUserId);
        const userService = (await import('@/shared/api/userService')).default;
        const profileData = await userService.getUserPublicProfile(targetUserId);
        
        console.log('✅ [Profile] Fetched profile data from API:', {
          username: profileData.username,
          identities: profileData.identities,
          totalGames: profileData.totalGames,
          totalWins: profileData.totalWins,
          gamesCount: profileData.games?.length || 0
        });
        
        // Store profile data including identities
        setProfileData(profileData);
        
        // Use games from API which includes identity consolidation
        const userGames = profileData.games || [];
        
        // Filter to only finished games (for stats display)
        const finishedGames = userGames.filter(game => {
          if (game.gameType === 'wizard') {
            // Wizard games: check if gameFinished is not explicitly false
            return game.gameData?.gameFinished !== false;
          } else {
            // Table games: must be explicitly finished
            return game.gameData?.gameFinished === true || game.gameFinished === true;
          }
        });
        
        console.log(`📊 [Account] Filtered to ${finishedGames.length} finished games out of ${userGames.length} total`);
        
        setAllGames(finishedGames);
      } catch (err) {
        console.error('Failed to fetch profile data from API:', err);
        setAllGames([]);
      }
      
    } catch (error) {
      console.error("Error fetching profile data:", error);
      setError("Failed to load profile data");
    }
  };

  if (user) fetchData();
}, [user, paramId]); // Add paramId to dependencies

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
  if (!user || !allGames || allGames.length === 0) {
    return {
      totalGames: 0,
      wins: 0,
      losses: 0,
      winRate: 0
    };
  }

  let wins = 0;
  let losses = 0;
  
  // Get current username and all identities
  const searchNames = profileData?.identities || [user.username];
  const searchNamesLower = searchNames.map(name => name?.toLowerCase()).filter(Boolean);
  const currentUserId = user.id || user.$id;

  allGames.forEach(game => {
    // Find if current user is a player in this game
    const players = game.gameData?.players || game.gameState?.players || [];
    const userPlayer = players.find(p => {
      const playerNameLower = p.name?.toLowerCase();
      const playerUsernameLower = p.username?.toLowerCase();
      const playerUserId = p.userId;
      
      return searchNamesLower.includes(playerNameLower) ||
             searchNamesLower.includes(playerUsernameLower) ||
             playerUserId === currentUserId ||
             String(playerUserId) === String(currentUserId);
    });
    
    if (!userPlayer) return; // Skip if user not in this game
    
    // Determine if player won
    const winnerIdRaw = game.winner_ids || game.gameData?.winner_ids || game.gameData?.totals?.winner_ids ||
                       game.winner_id || game.gameData?.winner_id || game.gameData?.totals?.winner_id;
    const winnerIds = Array.isArray(winnerIdRaw) ? winnerIdRaw : (winnerIdRaw ? [winnerIdRaw] : []);
    
    // Find user's player index for position-based winner_ids matching (e.g., "player_4")
    const userPlayerIndex = players.findIndex(p => p === userPlayer);
    const userPositionId = `player_${userPlayerIndex}`;
    
    // Check if this is a table game with points (needs score-based winner calculation)
    const isTableGame = game.gameType === 'table' || (userPlayer.points && Array.isArray(userPlayer.points));
    let isWin = false;
    
    if (isTableGame && userPlayer.points) {
      // For table games: calculate winner from scores (most reliable method)
      const gameLowIsBetter = game.lowIsBetter || game.gameData?.lowIsBetter || false;
      
      // Calculate all player scores
      const playerScores = players.map((p, idx) => {
        const total = p.points?.reduce((sum, point) => sum + (parseFloat(point) || 0), 0) || 0;
        return { index: idx, total };
      });
      
      if (playerScores.length > 0) {
        const scores = playerScores.map(p => p.total);
        const winningScore = gameLowIsBetter 
          ? Math.min(...scores)
          : Math.max(...scores);
        
        // Check if current player has the winning score
        isWin = playerScores[userPlayerIndex]?.total === winningScore;
      }
    } else {
      // For Wizard games or games without points array: use winner_ids
      isWin = winnerIds.includes(userPlayer.id) || 
              winnerIds.includes(userPositionId) ||
              winnerIds.some(wId => String(wId) === String(userPlayer.id));
    }
    
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
}, [allGames, user, profileData]);

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
            onClick={() => navigate('/account/edit')}
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