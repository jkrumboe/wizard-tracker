import { createContext, useState, useEffect, useCallback } from 'react'
import { getPlayerById } from '../services/playerService'
import defaultAvatar from '../assets/default-avatar.png'

export const UserContext = createContext()

export function UserProvider({ children }) {
  const [user, setUser] = useState(null)
  const [player, setPlayer] = useState(null)
  const [loading, setLoading] = useState(true)

  // Initialize user from token
  useEffect(() => {
    const token = localStorage.getItem("token")
    if (token) {
      try {
        const decoded = JSON.parse(atob(token.split(".")[1]))
        setUser(decoded)
      } catch (err) {
        console.error("Error decoding token:", err)
        localStorage.removeItem("token")
      }
    }
    setLoading(false)
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
    setUser
  }

  return (
    <UserContext.Provider value={value}>
      {children}
    </UserContext.Provider>
  )
}
