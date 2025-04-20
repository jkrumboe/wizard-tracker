"use client"

import { useState, useEffect } from "react"
import { getPlayers, getTags } from "../services/playerService"

export function usePlayers() {
  const [players, setPlayers] = useState([])
  const [tags, setTags] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    async function fetchPlayers() {
      try {
        setLoading(true)
        const data = await getPlayers()
        const tagdata = await getTags()
        setTags(tagdata)
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

  return { players, loading, error, tags }
}

