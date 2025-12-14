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
  
  // DISABLED: User profile page is temporarily disabled
  return (
    <div className="settings-container">
      <div className="settings-section">
        <div style={{ textAlign: 'center', padding: '40px 20px' }}>
          <h2>User Profiles Coming Soon</h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '24px' }}>
            Public user profiles are currently under development.
          </p>
          <button
            onClick={() => navigate(-1)}
            style={{
              background: 'var(--primary)',
              color: 'white',
              border: 'none',
              padding: '12px 24px',
              borderRadius: 'var(--radius-md)',
              cursor: 'pointer',
              fontSize: '16px',
              fontWeight: '500',
            }}
          >
            Go Back
          </button>
        </div>
      </div>
    </div>
  )
  
  /* DISABLED CODE - Keep for future restoration
  const { userId } = useParams()
  const { user: currentUser } = useUser()
  
  )
  
  /* DISABLED CODE - Keep for future restoration
  const { userId } = useParams()
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
      if (!userId) {
        setError('No user ID provided')
        setLoading(false)
        return
      }

      try {
        setLoading(true)
        
        // If viewing own profile, use current user data with localStorage games
        if (isOwnProfile && localGamesData) {
          setProfileUser({
            ...currentUser,
            games: localGamesData.allGames
          });
          if (currentUser.profilePicture) {
            setAvatarUrl(currentUser.profilePicture);
          }
          setLoading(false);
          return;
        }
        
        // Otherwise fetch from API for other users
        const data = await getUserPublicProfile(userId)
        setProfileUser(data)
        
        // Load avatar if available
        if (data.profilePicture) {
          setAvatarUrl(data.profilePicture)
        }
      } catch (err) {
        console.error('Error fetching user profile:', err)
        setError(err.message || 'Failed to load user profile')
      } finally {
        setLoading(false)
      }
    }

    fetchUserProfile()
  }, [userId, isOwnProfile, localGamesData, currentUser])

  // Handler for game type card clicks
  const handleGameTypeClick = useCallback((gameTypeName) => {
    setStatsGameType(gameTypeName.toLowerCase() === 'wizard' ? 'wizard' : gameTypeName);
    setActiveTab('stats');
  }, []);

  // Get games for stats tab (use localStorage if own profile, otherwise API)
  const allGamesForStats = useMemo(() => {
    // Determine the source of games
    const gamesSource = (isOwnProfile && localGamesData) 
      ? localGamesData.allGames 
      : (profileUser?.games || []);
    
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
  }, [profileUser?.games, statsGameType, isOwnProfile, localGamesData]);

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
            {/* {isOwnProfile && (
              <button
                onClick={() => navigate('/account')}
                style={{
                  background: 'none',
                  cursor: 'pointer',
                  padding: '8px 12px',
                  color: 'var(--primary)',
                  border: '1px solid var(--primary)',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '14px',
                  fontWeight: '500',
                }}
              >
                View Full Profile
              </button>
            )} */}
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
  END OF DISABLED CODE */
}

export default UserProfile
