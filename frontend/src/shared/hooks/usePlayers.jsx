"use client"

import { useState, useEffect, useCallback } from "react"
import { getPlayers, getTags, createPlayer, updatePlayer, deletePlayer } from "@/shared/api/playerService"

export function usePlayers() {
  const [players, setPlayers] = useState([])
  const [tags, setTags] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchPlayers = useCallback(async () => {
    try {
      setLoading(true)
      const [playersData, tagsData] = await Promise.all([
        getPlayers(),
        getTags()
      ])
      setPlayers(playersData)
      setTags(tagsData)
      setError(null)
    } catch (err) {
      console.error("Error fetching players:", err)
      setError("Failed to load players")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchPlayers()
  }, [fetchPlayers])

  const addPlayer = useCallback(async (playerData) => {
    try {
      const newPlayer = await createPlayer(playerData)
      setPlayers(prev => [...prev, newPlayer])
      return newPlayer
    } catch (err) {
      console.error("Error creating player:", err)
      throw err
    }
  }, [])

  const updatePlayerData = useCallback(async (playerId, playerData) => {
    try {
      const updatedPlayer = await updatePlayer(playerId, playerData)
      setPlayers(prev => 
        prev.map(player => 
          player.id === playerId ? updatedPlayer : player
        )
      )
      return updatedPlayer
    } catch (err) {
      console.error("Error updating player:", err)
      throw err
    }
  }, [])

  const removePlayer = useCallback(async (playerId) => {
    try {
      await deletePlayer(playerId)
      setPlayers(prev => prev.filter(player => player.id !== playerId))
    } catch (err) {
      console.error("Error deleting player:", err)
      throw err
    }
  }, [])

  const refreshPlayers = useCallback(() => {
    return fetchPlayers()
  }, [fetchPlayers])

  return { 
    players, 
    tags, 
    loading, 
    error, 
    addPlayer, 
    updatePlayerData, 
    removePlayer, 
    refreshPlayers 
  }
}

