import { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useUser } from '@/shared/hooks/useUser'
import { sanitizeImageUrl } from '@/shared/utils/urlSanitizer'
import { getUserPublicProfile } from '@/shared/api/userService'
import { filterGames, getDefaultFilters } from '@/shared/utils/gameFilters'
import PerformanceStatsEnhanced from '@/pages/profile/PerformanceStatsEnhanced'
import { ArrowLeftIcon, TrophyIcon, BarChartIcon } from "@/components/ui/Icon"
import avatarService from '@/shared/api/avatarService'
import defaultAvatar from "@/assets/default-avatar.png"
import '@/styles/pages/account.css'

const UserProfile = () => {
  const { userId } = useParams()
  const navigate = useNavigate()
  const { user: currentUser } = useUser()
  
  const [profileUser, setProfileUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [activeTab, setActiveTab] = useState('overview')
  const [statsGameType, setStatsGameType] = useState('wizard')
  const [avatarUrl, setAvatarUrl] = useState(defaultAvatar)
  const [filters] = useState(getDefaultFilters())

  // Check if viewing own profile
  const isOwnProfile = currentUser && (currentUser.id === userId || currentUser._id === userId)

  useEffect(() => {
    const fetchUserProfile = async () => {
      if (!userId) {
        setError('No user ID provided')
        setLoading(false)
        return
      }

      try {
        setLoading(true)
        const data = await getUserPublicProfile(userId)
        setProfileUser(data)
        
        // Load avatar if available
        if (data.profilePicture) {
          try {
            const avatar = await avatarService.getAvatar(userId)
            if (avatar) {
              setAvatarUrl(avatar)
            }
          } catch (err) {
            console.warn('Failed to load avatar:', err)
          }
        }
      } catch (err) {
        console.error('Error fetching user profile:', err)
        setError(err.message || 'Failed to load user profile')
      } finally {
        setLoading(false)
      }
    }

    fetchUserProfile()
  }, [userId])

  // Calculate stats from games
  const { gameTypes, recentResults } = useMemo(() => {
    if (!profileUser?.games) {
      return { gameTypes: {}, recentResults: [] }
    }

    const allGamesList = profileUser.games
    const gameTypes = {}

    allGamesList.forEach(game => {
      const gameType = game.gameType === 'table' 
        ? (game.gameTypeName || game.name || 'Table') 
        : 'Wizard'
      
      if (!gameTypes[gameType]) {
        gameTypes[gameType] = {
          matches: 0,
          wins: 0,
          losses: 0,
          winRate: 0,
          recentResults: []
        }
      }

      let userWon = false

      if (game.gameType === 'table') {
        // Check winner_ids for table games
        const winnerIds = game.gameData?.winner_ids || game.winner_ids ||
                         (game.gameData?.winner_id ? [game.gameData.winner_id] : null) ||
                         (game.winner_id ? [game.winner_id] : null)
        
        if (winnerIds && winnerIds.length > 0) {
          userWon = winnerIds.includes(profileUser.id) || winnerIds.includes(profileUser._id)
        }
      } else {
        // Check winner_ids for wizard games
        const winnerIds = game.winner_ids || game.gameState?.winner_ids ||
                         (game.winner_id ? [game.winner_id] : null) ||
                         (game.gameState?.winner_id ? [game.gameState.winner_id] : null)
        
        if (winnerIds && winnerIds.length > 0) {
          userWon = winnerIds.includes(profileUser.id) || winnerIds.includes(profileUser._id)
        }
      }

      gameTypes[gameType].matches++
      if (userWon) {
        gameTypes[gameType].wins++
      } else {
        gameTypes[gameType].losses++
      }
      
      gameTypes[gameType].recentResults.push(userWon ? 'W' : 'L')
    })

    // Calculate win rates
    Object.keys(gameTypes).forEach(type => {
      const stats = gameTypes[type]
      stats.winRate = stats.matches > 0 
        ? Math.round((stats.wins / stats.matches) * 100) 
        : 0
      stats.recentResults = stats.recentResults.slice(-10)
    })

    // Get overall recent results (last 10 games)
    const sortedGames = [...allGamesList].sort((a, b) => {
      const dateA = new Date(a.created_at || a.savedAt || a.lastPlayed || 0)
      const dateB = new Date(b.created_at || b.savedAt || b.lastPlayed || 0)
      return dateB - dateA
    })
    
    const allResults = sortedGames.slice(0, 10).map(game => {
      let userWon = false
      
      if (game.gameType === 'table') {
        const winnerIds = game.gameData?.winner_ids || game.winner_ids ||
                         (game.gameData?.winner_id ? [game.gameData.winner_id] : null) ||
                         (game.winner_id ? [game.winner_id] : null)
        if (winnerIds && winnerIds.length > 0) {
          userWon = winnerIds.includes(profileUser.id) || winnerIds.includes(profileUser._id)
        }
      } else {
        const winnerIds = game.winner_ids || game.gameState?.winner_ids ||
                         (game.winner_id ? [game.winner_id] : null) ||
                         (game.gameState?.winner_id ? [game.gameState.winner_id] : null)
        if (winnerIds && winnerIds.length > 0) {
          userWon = winnerIds.includes(profileUser.id) || winnerIds.includes(profileUser._id)
        }
      }
      
      return userWon ? 'W' : 'L'
    })

    return { gameTypes, recentResults: allResults }
  }, [profileUser])

  // Get games for stats tab
  const allGamesForStats = useMemo(() => {
    if (!profileUser?.games) return []
    
    if (statsGameType === 'wizard') {
      return profileUser.games.filter(g => g.gameType !== 'table')
    } else if (statsGameType === 'all') {
      return profileUser.games
    } else {
      return profileUser.games.filter(g => 
        g.gameType === 'table' && 
        (g.gameTypeName === statsGameType || g.name === statsGameType)
      )
    }
  }, [profileUser?.games, statsGameType])

  const filteredGamesForStats = useMemo(() => {
    return filterGames(allGamesForStats, filters)
  }, [allGamesForStats, filters])

  if (loading) {
    return (
      <div className="account-container">
        <div className="loading-container">
          <div className="spinner"></div>
          <p>Loading profile...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="account-container">
        <div className="error-container">
          <h2>Error Loading Profile</h2>
          <p>{error}</p>
          <button onClick={() => navigate(-1)} className="back-button">
            Go Back
          </button>
        </div>
      </div>
    )
  }

  if (!profileUser) {
    return (
      <div className="account-container">
        <div className="error-container">
          <h2>User Not Found</h2>
          <button onClick={() => navigate(-1)} className="back-button">
            Go Back
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="account-container">
      <div className="account-header">
        <button 
          onClick={() => navigate(-1)} 
          className="back-link"
          aria-label="Go back"
        >
          <ArrowLeftIcon className="back-icon" />
        </button>
        <div className="profile-info">
          <img 
            src={sanitizeImageUrl(avatarUrl)} 
            alt={`${profileUser.username}'s avatar`} 
            className="profile-avatar"
            onError={(e) => {
              e.target.src = defaultAvatar
            }}
          />
          <div className="profile-details">
            <h1 className="profile-name">{profileUser.username}</h1>
            <p className="profile-member-since">
              Member since {new Date(profileUser.createdAt).toLocaleDateString()}
            </p>
          </div>
        </div>
        {isOwnProfile && (
          <button
            onClick={() => navigate('/account')}
            className="edit-profile-btn"
          >
            View Full Profile
          </button>
        )}
      </div>

      <div className="account-tabs">
        <button 
          className={`account-tab ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          <TrophyIcon size={20} />
          Overview
        </button>
        <button 
          className={`account-tab ${activeTab === 'stats' ? 'active' : ''}`}
          onClick={() => setActiveTab('stats')}
        >
          <BarChartIcon size={20} />
          Stats
        </button>
      </div>

      <div className="account-content">
        {activeTab === 'overview' && (
          <div className="overview-section">
            <div className="stats-grid">
              <div className="stat-card">
                <h3>Total Games</h3>
                <p className="stat-value">{profileUser.totalGames || 0}</p>
              </div>
              <div className="stat-card">
                <h3>Total Wins</h3>
                <p className="stat-value">{profileUser.totalWins || 0}</p>
              </div>
              <div className="stat-card">
                <h3>Win Rate</h3>
                <p className="stat-value">
                  {profileUser.totalGames > 0 
                    ? Math.round((profileUser.totalWins / profileUser.totalGames) * 100)
                    : 0}%
                </p>
              </div>
            </div>

            {recentResults.length > 0 && (
              <div className="recent-results-section">
                <h3>Recent Results (Last 10 Games)</h3>
                <div className="results-row">
                  {recentResults.map((result, index) => (
                    <span
                      key={index}
                      className={`result-badge ${result === 'W' ? 'win' : 'loss'}`}
                    >
                      {result}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {Object.keys(gameTypes).length > 0 && (
              <div className="game-types-section">
                <h3>Performance by Game Type</h3>
                {Object.entries(gameTypes).map(([gameType, stats]) => (
                  <div key={gameType} className="game-type-stats">
                    <h4>{gameType}</h4>
                    <div className="game-type-grid">
                      <div className="stat-item">
                        <span className="stat-label">Matches:</span>
                        <span className="stat-value">{stats.matches}</span>
                      </div>
                      <div className="stat-item">
                        <span className="stat-label">Wins:</span>
                        <span className="stat-value">{stats.wins}</span>
                      </div>
                      <div className="stat-item">
                        <span className="stat-label">Win Rate:</span>
                        <span className="stat-value">{stats.winRate}%</span>
                      </div>
                    </div>
                    {stats.recentResults.length > 0 && (
                      <div className="recent-results">
                        <span className="stat-label">Recent:</span>
                        {stats.recentResults.map((result, index) => (
                          <span
                            key={index}
                            className={`result-badge ${result === 'W' ? 'win' : 'loss'}`}
                          >
                            {result}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'stats' && (
          <div className="stats-section">
            <div className="stats-controls">
              <select
                value={statsGameType}
                onChange={(e) => setStatsGameType(e.target.value)}
                className="game-type-select"
              >
                <option value="all">All Games</option>
                <option value="wizard">Wizard</option>
                {Object.keys(gameTypes)
                  .filter(type => type !== 'Wizard')
                  .map(type => (
                    <option key={type} value={type}>{type}</option>
                  ))}
              </select>
            </div>

            {filteredGamesForStats.length > 0 && profileUser ? (
              <PerformanceStatsEnhanced
                games={filteredGamesForStats}
                currentPlayer={{
                  id: profileUser.id || profileUser._id,
                  name: profileUser.username,
                  username: profileUser.username
                }}
              />
            ) : (
              <div className="no-data">
                <p>No games found for this game type.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default UserProfile
