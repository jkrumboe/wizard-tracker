// Update the API base URL to ensure it points to the correct backend
const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5055/api"

// Helper function for making API requests
async function fetchAPI(endpoint, options = {}) {
  try {
    const url = `${API_BASE_URL}${endpoint}`
    const response = await fetch(url, {
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
      ...options,
    })

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`)
    }

    return await response.json()
  } catch (error) {
    console.error("API request failed:", error)
    throw error
  }
}

// Player-related API calls
export const playerAPI = {
  getAll: () => fetchAPI("/players"),
  getTags: () => fetchAPI("/tags"),
  getById: (id) => fetchAPI(`/players/${id}`),
  getStats: (id) => fetchAPI(`/players/${id}/stats`),
  getTagsById: (id) => fetchAPI(`/players/${id}/tags`),
  getbyTag: (tag) => fetchAPI(`/players/search/${tag}`), 
  create: (data) => fetchAPI("/players", { method: "POST", body: JSON.stringify(data) }),
  update: (id, data) => fetchAPI(`/players/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  updateTags: (id, tags) => fetchAPI(`/players/${id}/tags`, { method: "PUT", body: JSON.stringify(tags) }),
}

// Game-related API calls
export const gameAPI = {
  getAll: () => fetchAPI("/games"),
  getById: (id) => fetchAPI(`/games/${id}`),
  getRecent: (limit = 5) => fetchAPI(`/games/recent?limit=${limit}`),
  getByPlayer: (playerId) => fetchAPI(`/players/${playerId}/games`),
  create: (data) => fetchAPI("/games", { method: "POST", body: JSON.stringify(data) }),
  update: (id, data) => fetchAPI(`/games/${id}`, { method: "PUT", body: JSON.stringify(data) }),
}

// Leaderboard API calls
export const leaderboardAPI = {
  getEloRanking: () => fetchAPI("/leaderboard/elo"),
  getWinRateRanking: () => fetchAPI("/leaderboard/winrate"),
  getByCategory: (category) => fetchAPI(`/leaderboard/${category}`),
}

