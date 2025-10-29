import { createContext, useState, useEffect, useCallback } from 'react'
import authService from '../api/authService'
import defaultAvatar from '../../assets/default-avatar.png'
import { useOnlineStatus } from '../hooks/useOnlineStatus'
import { LocalUserProfileService, LocalGameStorage, LocalTableGameStorage } from '../api'

export const UserContext = createContext(undefined)

export function UserProvider({ children }) {
  const [user, setUser] = useState(null)
  const [player, setPlayer] = useState(null)
  const [loading, setLoading] = useState(true)
  const { isOnline } = useOnlineStatus()
  
  // Initialize user authentication check only on initial load
  useEffect(() => {
    const checkAuthenticationStatus = async () => {
      try {
        // Always check authentication on initial load - don't depend on online status
        // The online status check might fail if the collection isn't set up yet
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
              email: userFromServer.email
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
  }, []) // Intentionally exclude isOnline to prevent auto-login on mode switch

  // Handle online status changes - clear user session when going offline  
  useEffect(() => {
    if (!isOnline && user) {
      console.debug('🔒 Switching to offline mode - clearing user session')
      authService.clearLocalSession() // Clear any stored session data
      LocalUserProfileService.clearCurrentUser() // Clear current user in local profile service
      setUser(null)
      setPlayer(null)
    }
    // Note: We don't auto-login when switching to online mode
    // Users must manually log in after switching to online mode
  }, [isOnline, user])

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
            email: userFromServer.email
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

  // Function to clear user data (for logout)
  const clearUserData = useCallback(() => {
    setUser(null)
    setPlayer(null)
    LocalUserProfileService.clearCurrentUser()
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
