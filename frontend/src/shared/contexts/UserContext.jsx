import { createContext, useState, useEffect, useCallback } from 'react'
import { getPlayerById } from '../api/playerService'
import authService from '../api/authService'
import defaultAvatar from '../../assets/default-avatar.png'
import supabase from '../utils/supabase'

export const UserContext = createContext()

export function UserProvider({ children }) {
  const [user, setUser] = useState(null)
  const [player, setPlayer] = useState(null)
  const [loading, setLoading] = useState(true)
  // Initialize user from HTTP-only cookies by checking with server
  useEffect(() => {
    const checkAuthenticationStatus = async () => {
      try {
        // First check if there's a token in localStorage (backward compatibility)
        const token = localStorage.getItem("token")
        if (token) {
          try {
            const decoded = JSON.parse(atob(token.split(".")[1]))
            setUser(decoded)
            setLoading(false)
            return
          } catch (err) {
            console.error("Error decoding localStorage token:", err)
            localStorage.removeItem("token")
          }
        }

        // Check authentication status with server (using HTTP-only cookies)
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

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUser(session.user)
      } else {
        setUser(null)
        setPlayer(null)
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  // Fetch player data when user is set
  useEffect(() => {
    if (!user?.player_id) {
      setPlayer(null)
      return
    }

    const fetchPlayerData = async () => {
      try {
        const playerData = await getPlayerById(user.player_id)
        if (playerData) {
          setPlayer({
            ...playerData,
            avatar: playerData.avatar || defaultAvatar,
          })
        }
      } catch (err) {
        console.error("Error fetching player data:", err)
      }
    }

    fetchPlayerData()
  }, [user])

  // Function to refresh player data
  const refreshPlayerData = useCallback(async () => {
    if (!user?.player_id) return
    
    try {
      const playerData = await getPlayerById(user.player_id)
      if (playerData) {
        setPlayer({
          ...playerData,
          avatar: playerData.avatar || defaultAvatar,
        })
      }
    } catch (err) {
      console.error("Error refreshing player data:", err)
    }
  }, [user?.player_id])

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
