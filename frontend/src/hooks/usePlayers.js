"use client"

import { useState, useEffect } from "react"
import { getPlayers } from "../services/playerService"

export function usePlayers() {
  const [players, setPlayers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    async function fetchPlayers() {
      try {
        setLoading(true)
        const data = await getPlayers()
        setPlayers(data)
        setError(null)
      } catch (err) {
        console.error("Error fetching players:", err)
        setError("Failed to load players")
      } finally {
        setLoading(false)
      }
    }

    fetchPlayers()
  }, [])

  return { players, loading, error }
}

