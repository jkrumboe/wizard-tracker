import { createContext, useState, useEffect, useCallback } from 'react'
import authService from '../api/authService'
import defaultAvatar from '../../assets/default-avatar.png'

export const UserContext = createContext()

export function UserProvider({ children }) {
  const [user, setUser] = useState(null)
  const [player, setPlayer] = useState(null)
  const [loading, setLoading] = useState(true)
  
  // Initialize user authentication check
  useEffect(() => {
    const checkAuthenticationStatus = async () => {
      try {
        // Check authentication status with Appwrite
        const userFromServer = await authService.checkAuthStatus()
        if (userFromServer) {
          setUser(userFromServer)
        }
      } catch (error) {
        console.error("Error checking authentication status:", error)
      } finally {
        setLoading(false)
      }
    }

    checkAuthenticationStatus()
  }, [])

  // Fetch player data when user is set
  useEffect(() => {
    if (!user?.$id) {
      setPlayer(null)
      return
    }

    const fetchPlayerData = async () => {
      try {
        // For now, we'll create a basic player object from the user data
        // Later you can implement proper player data storage in Appwrite databases
        const basicPlayer = {
          id: user.$id,
          name: user.name,
          email: user.email,
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
    if (!user?.$id) return
    
    try {
      // Refresh user data from Appwrite to get latest changes
      const updatedUser = await authService.checkAuthStatus()
      if (updatedUser) {
        setUser(updatedUser)
        
        // Update player data with fresh user info
        const basicPlayer = {
          id: updatedUser.$id,
          name: updatedUser.name,
          email: updatedUser.email,
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
        return userFromServer
      } else {
        setUser(null)
        return null
      }
    } catch (error) {
      console.error("Error refreshing auth status:", error)
      setUser(null)
      return null
    }
  }, [])

  // Function to clear user data (for logout)
  const clearUserData = useCallback(() => {
    setUser(null)
    setPlayer(null)
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
