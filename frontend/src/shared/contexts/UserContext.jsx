import { createContext, useState, useEffect, useCallback } from 'react'
import authService from '../api/authService'
import defaultAvatar from '../../assets/default-avatar.png'
import { LocalUserProfileService, LocalGameStorage, LocalTableGameStorage } from '../api'
import { stateRecovery } from '../utils/stateRecovery'

export const UserContext = createContext(undefined)

export function UserProvider({ children }) {
  const [user, setUser] = useState(null)
  const [player, setPlayer] = useState(null)
  const [loading, setLoading] = useState(true)
  
  // Register state recovery for user session
  useEffect(() => {
    stateRecovery.registerStateProvider(
      'userSession',
      () => ({ user, player }),
      (state) => {
        if (state.user) {
          setUser(state.user);
          console.debug('🔄 Recovered user session:', state.user.name || state.user.username);
        }
        if (state.player) {
          setPlayer(state.player);
        }
      }
    );
    
    return () => {
      stateRecovery.unregisterStateProvider('userSession');
    };
  }, [user, player]);
  
  // Save user session on changes
  useEffect(() => {
    if (user) {
      stateRecovery.saveState('userSession', { user, player }, { persist: true });
    }
  }, [user, player]);
  
  // Initialize user authentication check only on initial load
  useEffect(() => {
    const checkAuthenticationStatus = async () => {
      try {
        // Initialize auth service first
        await authService.initialize();
        
        // Try to recover user session from cache first
        const recoveredState = await stateRecovery.recoverState('userSession');
        if (recoveredState && recoveredState.user) {
          setUser(recoveredState.user);
          if (recoveredState.player) {
            setPlayer(recoveredState.player);
          }
          setLoading(false);
          
          // Verify session in background if online
          if (navigator.onLine) {
            authService.checkAuthStatus().then(userFromServer => {
              if (userFromServer && userFromServer.id === recoveredState.user.id) {
                // Session is still valid
                console.debug('✅ Cached session verified');
              } else if (!userFromServer) {
                // Session expired, keep cached user but mark as offline
                console.debug('⚠️ Session expired, keeping cached user for offline mode');
              }
            }).catch(() => {
              // Network error, keep cached session
              console.debug('⚠️ Cannot verify session, keeping cached user');
            });
          }
          return;
        }
        
        // No cached session, check with server
        console.debug('🔓 Checking authentication status on app startup')
        const userFromServer = await authService.checkAuthStatus()
        if (userFromServer) {
          setUser(userFromServer)
          
          // Create or update local user profile for multi-user support
          LocalUserProfileService.createOrUpdateProfile(
            userFromServer.id,
            userFromServer.username || userFromServer.name,
            {
              name: userFromServer.name,
              username: userFromServer.username
            }
          );
          
          // Set as current user
          LocalUserProfileService.setCurrentUser(userFromServer.id);
          
          // Migrate any legacy games without userId to this user
          const migratedGames = LocalGameStorage.migrateLegacyGamesToUser(userFromServer.id);
          const migratedTableGames = LocalTableGameStorage.migrateLegacyGamesToUser(userFromServer.id);
          
          if (migratedGames > 0 || migratedTableGames > 0) {
            console.debug(`✅ Migrated ${migratedGames} games and ${migratedTableGames} table games to user ${userFromServer.id}`);
          }
        }
      } catch (error) {
        console.error("Error checking authentication status:", error)
      } finally {
        setLoading(false)
      }
    }

    // Only run this check once on initial mount
    checkAuthenticationStatus()
  }, [])

  // Function to clear user data (for logout)
  const clearUserData = useCallback(() => {
    setUser(null)
    setPlayer(null)
    LocalUserProfileService.clearCurrentUser()
  }, [])

  // Periodic session validation - check if token expired every 5 minutes
  useEffect(() => {
    if (!user) return;
    
    const validateSession = async () => {
      try {
        const isValid = await authService.checkAuthStatus();
        if (!isValid) {
          console.debug('🔒 Session expired - logging out');
          clearUserData();
          // Redirect to login if needed
          if (globalThis.location.pathname !== '/login' && globalThis.location.pathname !== '/') {
            globalThis.location.href = '/login';
          }
        }
      } catch (error) {
        console.debug('Session validation error:', error);
      }
    };
    
    // Check immediately
    validateSession();
    
    // Then check every 5 minutes
    const interval = setInterval(validateSession, 5 * 60 * 1000);
    
    return () => clearInterval(interval);
  }, [user, clearUserData])

  // Fetch player data when user is set
  useEffect(() => {
    if (!user?.id) {
      setPlayer(null)
      return
    }

    const fetchPlayerData = async () => {
      try {
        // For now, we'll create a basic player object from the user data
        // Later you can implement proper player data storage in your backend
        const basicPlayer = {
          id: user.id,
          name: user.name,
          username: user.username,
          avatar: defaultAvatar,
          // Add other default player properties as needed
        }
        setPlayer(basicPlayer)
      } catch (err) {
        console.error("Error fetching player data:", err)
      }
    }

    fetchPlayerData()
  }, [user])

  // Function to refresh player data
  const refreshPlayerData = useCallback(async () => {
    if (!user?.id) return
    
    try {
      // Refresh user data from auth service to get latest changes
      const updatedUser = await authService.checkAuthStatus()
      if (updatedUser) {
        setUser(updatedUser)
        
        // Update player data with fresh user info
        const basicPlayer = {
          id: updatedUser.id,
          name: updatedUser.name,
          username: updatedUser.username,
          avatar: defaultAvatar,
        }
        setPlayer(basicPlayer)
      }
    } catch (err) {
      console.error("Error refreshing player data:", err)
    }
  }, [user])

  // Function to update player data locally
  const updatePlayerData = useCallback((updatedPlayer) => {
    setPlayer(updatedPlayer)
  }, [])
  // Function to refresh authentication status from server
  const refreshAuthStatus = useCallback(async () => {
    try {
      const userFromServer = await authService.checkAuthStatus()
      if (userFromServer) {
        setUser(userFromServer)
        
        // Update local user profile
        LocalUserProfileService.createOrUpdateProfile(
          userFromServer.id,
          userFromServer.username || userFromServer.name,
          {
            name: userFromServer.name,
            username: userFromServer.username
          }
        );
        LocalUserProfileService.setCurrentUser(userFromServer.id);
        
        // Automatically download cloud games in the background
        // This allows users to access their games across devices
        setTimeout(async () => {
          try {
            const { downloadUserCloudGames } = await import('@/shared/api/gameService');
            const result = await downloadUserCloudGames();
            console.debug(`✅ Auto-synced cloud games: ${result.downloaded} downloaded, ${result.skipped} already local`);
          } catch (error) {
            // Silently fail - this is a background sync
            console.debug('Background cloud sync failed (non-critical):', error.message);
          }
        }, 2000); // Wait 2 seconds after login to not block UI
        
        return userFromServer
      } else {
        setUser(null)
        LocalUserProfileService.clearCurrentUser()
        return null
      }
    } catch (error) {
      console.error("Error refreshing auth status:", error)
      setUser(null)
      LocalUserProfileService.clearCurrentUser()
      return null
    }
  }, [])

  const value = {
    user,
    player,
    loading,
    refreshPlayerData,
    updatePlayerData,
    clearUserData,
    setUser,
    refreshAuthStatus
  }

  return (
    <UserContext.Provider value={value}>
      {children}
    </UserContext.Provider>
  )
}
