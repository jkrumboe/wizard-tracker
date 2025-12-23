import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useUser } from '@/shared/hooks/useUser'
import { sanitizeImageUrl } from '@/shared/utils/urlSanitizer'
import { getUserPublicProfile } from '@/shared/api/userService'
import { filterGames, getDefaultFilters } from '@/shared/utils/gameFilters'
import { LocalGameStorage, LocalTableGameStorage } from '@/shared/api'
import PerformanceStatsEnhanced from '@/pages/profile/PerformanceStatsEnhanced'
import StatsOverview from '@/components/stats/StatsOverview'
import { ArrowLeftIcon, TrophyIcon, BarChartIcon } from "@/components/ui/Icon"
import avatarService from '@/shared/api/avatarService'
import defaultAvatar from "@/assets/default-avatar.png"
import '@/styles/pages/account.css'

const UserProfile = () => {
  const navigate = useNavigate()
  const { username } = useParams()
  const { user: currentUser } = useUser()
  
  const [profileUser, setProfileUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [activeTab, setActiveTab] = useState('overview')
  const [statsGameType, setStatsGameType] = useState('wizard')
  const [avatarUrl, setAvatarUrl] = useState(defaultAvatar)
  const [filters] = useState(getDefaultFilters())

  // Check if viewing own profile
  const isOwnProfile = currentUser && (currentUser.username?.toLowerCase() === username?.toLowerCase())
  
  // Load games from localStorage if viewing own profile
  const localGamesData = useMemo(() => {
    if (!isOwnProfile) return null;
    const savedGames = LocalGameStorage.getAllSavedGames();
    const savedTableGames = LocalTableGameStorage.getSavedTableGamesList();
    return {
      wizardGames: Object.values(savedGames),
      tableGames: savedTableGames,
      allGames: [...Object.values(savedGames), ...savedTableGames]
    };
  }, [isOwnProfile, currentUser]);

  useEffect(() => {
    const fetchUserProfile = async () => {
      if (!username) {
        setError('No username provided')
        setLoading(false)
        return
      }

      console.log('🔍 [UserProfile] Fetching profile for username:', username);
      console.log('🔍 [UserProfile] Current user:', currentUser);
      console.log('🔍 [UserProfile] Is own profile?', isOwnProfile);

      try {
        setLoading(true)
        
        // Always fetch from API to get complete profile with alias consolidation
        // Even for own profile, we need backend data to include games under old usernames
        console.log('🌐 [UserProfile] Fetching from API for username:', username);
        const data = await getUserPublicProfile(username)
        console.log('✅ [UserProfile] Profile data received:', {
          username: data.username,
          gamesCount: data.games?.length || 0,
          hasGames: !!data.games,
          totalWins: data.totalWins,
          totalGames: data.totalGames
        });
        setProfileUser(data)
        
        // Load avatar if available
        if (data.profilePicture) {
          setAvatarUrl(data.profilePicture)
        }
      } catch (err) {
        console.error('❌ [UserProfile] Error fetching user profile:', err)
        setError(err.message || 'Failed to load user profile')
      } finally {
        setLoading(false)
      }
    }

    fetchUserProfile()
  }, [username, isOwnProfile, localGamesData, currentUser])

  // Handler for game type card clicks
  const handleGameTypeClick = useCallback((gameTypeName) => {
    setStatsGameType(gameTypeName.toLowerCase() === 'wizard' ? 'wizard' : gameTypeName);
    setActiveTab('stats');
  }, []);

  // Get games for stats tab (always use API data from profileUser)
  const allGamesForStats = useMemo(() => {
    // Always use profileUser games (from API) to include alias consolidation
    const gamesSource = profileUser?.games || [];
    
    if (!gamesSource || gamesSource.length === 0) return [];
    
    // Filter by game type
    const wizardGames = gamesSource.filter(g => g.gameType !== 'table');
    const tableGames = gamesSource.filter(g => g.gameType === 'table');
    
    if (statsGameType === 'wizard') {
      return wizardGames;
    } else {
      // Filter by specific table game type
      return tableGames.filter(game => 
        (game.gameTypeName || game.name) === statsGameType
      );
    }
  }, [profileUser?.games, statsGameType]);

  const filteredGamesForStats = useMemo(() => {
    return filterGames(allGamesForStats, filters)
  }, [allGamesForStats, filters])

  // Get available game types for stats selector
  const availableGameTypes = useMemo(() => {
    if (!profileUser?.games) return []
    
    const types = []
    
    const wizardGames = profileUser.games.filter(g => g.gameType !== 'table')
    if (wizardGames.length > 0) {
      types.push({ value: 'wizard', label: 'Wizard' })
    }
    
    // Add table game types
    const tableGameTypes = new Set()
    profileUser.games
      .filter(g => g.gameType === 'table')
      .forEach(game => {
        const gameType = game.gameTypeName || game.name
        if (gameType) {
          tableGameTypes.add(gameType)
        }
      })
    
    tableGameTypes.forEach(type => {
      types.push({ value: type, label: type })
    })
    
    return types
  }, [profileUser?.games])

  // Auto-select first available game type if invalid selection
  useEffect(() => {
    if (availableGameTypes.length > 0 && !availableGameTypes.find(t => t.value === statsGameType)) {
      setStatsGameType(availableGameTypes[0].value)
    }
  }, [availableGameTypes, statsGameType])

  // Create current player object for stats
  const currentPlayer = useMemo(() => {
    if (profileUser) {
      return {
        id: profileUser.id || profileUser._id,
        name: profileUser.username,
        username: profileUser.username
      }
    }
    return null
  }, [profileUser])

  if (loading) {
    return (
      <div className="settings-container">
        <div className="loading-container">
          <div className="spinner"></div>
          <p>Loading profile...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="settings-container">
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
      <div className="settings-container">
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
    <div className="settings-container">
      
      <div className="settings-section" style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start', marginBottom: 'var(--spacing-sm)', borderBottom: 'none', gap: '8px' }}>
        <button
                onClick={() => navigate(-1)}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '0px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  height: '60px',
                  color: 'var(--text-primary)',
                  borderRadius: 'var(--radius-md)',
                  transition: 'background-color 0.2s',
                  boxShadow: 'none',
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--card-bg)'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                title="Go back"
              >
                <ArrowLeftIcon size={24} />
              </button>
        <div className="settings-option">
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <img
                src={sanitizeImageUrl(avatarUrl, defaultAvatar)}
                alt={`${profileUser.username}'s avatar`}
                style={{
                  width: '64px',
                  height: '64px',
                  borderRadius: '25%',
                }}
                onError={(e) => {
                  e.target.src = defaultAvatar
                }}
              />
              <div>
                <p style={{ margin: 0, fontWeight: 'bold' }}>{profileUser.username}</p>
                <p style={{ fontSize: '14px', color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>
                  Member since {new Date(profileUser.createdAt).toLocaleDateString('en-US', { 
                    year: 'numeric', 
                    month: 'short', 
                    day: 'numeric' 
                  })}
                </p>
              </div>
            </div>
          </div>
        </div>
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
          <div className="tab-content">
            <StatsOverview 
              games={profileUser?.games} 
              user={profileUser} 
              onGameTypeClick={handleGameTypeClick}
            />
          </div>
        )}

        {activeTab === 'stats' && (
          <div className="tab-content">
            {!profileUser?.games || profileUser.games.length === 0 ? (
              <div className="settings-section">
                <p style={{ textAlign: 'center', padding: '40px 20px' }}>
                  No games available for statistics. Play some games to see your performance!
                </p>
              </div>
            ) : (
              <>
                {/* Game Type Selector */}
                {availableGameTypes.length > 1 && (
                  <div className="settings-section" style={{ padding: '0', backgroundColor: 'transparent', border: 'none', marginBottom: 'var(--spacing-sm)' }}>
                    <select 
                      className="game-type-selector"
                      value={statsGameType}
                      onChange={(e) => setStatsGameType(e.target.value)}
                    >
                      {availableGameTypes.map(type => (
                        <option key={type.value} value={type.value}>
                          {type.label}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                
                {allGamesForStats.length > 0 ? (
                  <PerformanceStatsEnhanced 
                    games={allGamesForStats} 
                    currentPlayer={currentPlayer} 
                    isWizardGame={statsGameType === 'wizard'}
                  />
                ) : (
                  <div className="settings-section">
                    <p style={{ textAlign: 'center', padding: '40px 20px' }}>
                      No games available for {statsGameType}. Play some games to see your performance!
                    </p>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default UserProfile
