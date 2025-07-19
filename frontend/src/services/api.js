// Enhanced API service for new database schema with user-player separation
// Update the API base URL to ensure it points to the correct backend
const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5055/api"

// Import the online check utility
import { addOnlineChecksToAPI } from '@/utils/onlineCheck';

// Helper function for making API requests
export async function fetchAPI(endpoint, options = {}) {
  try {
    const url = `${API_BASE_URL}${endpoint}`
    const response = await fetch(url, {
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
      credentials: 'include', // Include cookies for authentication
      ...options,
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
      throw new Error(errorData.error || `API error: ${response.status}`)
    }

    return await response.json()
  } catch (error) {
    console.error("API request failed:", error)
    throw error
  }
}

// Authentication-related API calls
export const authAPI = {
  login: (credentials) => fetchAPI("/login", { method: "POST", body: JSON.stringify(credentials) }),
  register: (userData) => fetchAPI("/register", { method: "POST", body: JSON.stringify(userData) }),
  logout: () => fetchAPI("/logout", { method: "POST" }),
  refresh: () => fetchAPI("/refresh", { method: "POST" }),
  me: () => fetchAPI("/me"),
  profile: () => fetchAPI("/profile"),
}

// Admin authentication API calls
export const adminAPI = {
  login: (credentials) => fetchAPI("/admin/login", { method: "POST", body: JSON.stringify(credentials) }),
  logout: () => fetchAPI("/admin/logout", { method: "POST" }),
  setupAdmin: () => fetchAPI("/setup-admin", { method: "POST" }),
  getPlayers: () => fetchAPI("/admin/players"),
  addPlayer: (data) => fetchAPI("/admin/players", { method: "POST", body: JSON.stringify(data) }),
  getGames: () => fetchAPI("/admin/games"),
}

// Game API
const baseGameAPI = {
  getAll: () => fetchAPI("/games"),
  getById: (id) => fetchAPI(`/games/${id}`),
  getRecent: (limit = 5) => fetchAPI(`/games/recent?limit=${limit}`),
  getMultiplayer: (limit = 10, offset = 0) => fetchAPI(`/games/multiplayer?limit=${limit}&offset=${offset}`),
  create: (data) => fetchAPI("/games", { method: "POST", body: JSON.stringify(data) }),
  update: (id, data) => fetchAPI(`/games/${id}`, { method: "PUT", body: JSON.stringify(data) }),
}

// Player API
const basePlayerAPI = {
  getAll: () => fetchAPI("/players"),
  getById: (id) => fetchAPI(`/players/${id}`),
  getStats: (id) => fetchAPI(`/players/${id}/stats`),
  getGames: (id, limit = 20) => fetchAPI(`/players/${id}/games?limit=${limit}`),
  // getEloHistory: (id) => fetchAPI(`/players/${id}/elo-history`),
  getTags: (id) => fetchAPI(`/players/${id}/tags`),
  getByTag: (tag) => fetchAPI(`/players/search/${tag}`),
  create: (data) => fetchAPI("/players", { method: "POST", body: JSON.stringify(data) }),
  update: (id, data) => fetchAPI(`/players/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  updateTags: (id, tags) => fetchAPI(`/players/${id}/tags`, { method: "PUT", body: JSON.stringify(tags) }),
  delete: (id) => fetchAPI(`/players/${id}`, { method: "DELETE" }),
}

// Room API for multiplayer
const baseRoomAPI = {
  getActive: () => fetchAPI("/rooms/active"),
  getById: (id) => fetchAPI(`/rooms/${id}`),
  create: (data) => fetchAPI("/rooms", { method: "POST", body: JSON.stringify(data) }),
  join: (roomId) => fetchAPI(`/rooms/${roomId}/join`, { method: "POST" }),
  leave: (roomId) => fetchAPI(`/rooms/${roomId}/leave`, { method: "POST" }),
  verifyPassword: (roomId, password) => fetchAPI(`/rooms/${roomId}/verify-password`, { 
    method: "POST", 
    body: JSON.stringify({ password }) 
  }),
}

// Wrap APIs with online checks
// These functions should work in offline mode
const offlineGameAPIs = ['getLocalGames', 'getLocalGameById', 'saveLocalGame', 'removeLocalGame'];
const offlinePlayerAPIs = ['getLocalPlayers', 'getLocalPlayerById'];
const offlineRoomAPIs = [];

// Apply online checks to APIs
export const gameAPI = addOnlineChecksToAPI(baseGameAPI, offlineGameAPIs);
export const playerAPI = addOnlineChecksToAPI(basePlayerAPI, offlinePlayerAPIs);
export const roomAPI = addOnlineChecksToAPI(baseRoomAPI, offlineRoomAPIs);

// Tags API
const baseTagsAPI = {
  getAll: () => fetchAPI("/tags"),
  getById: (id) => fetchAPI(`/tags/${id}`),
  create: (data) => fetchAPI("/tags", { method: "POST", body: JSON.stringify(data) }),
  update: (id, data) => fetchAPI(`/tags/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  delete: (id) => fetchAPI(`/tags/${id}`, { method: "DELETE" }),
};

export const tagsAPI = addOnlineChecksToAPI(baseTagsAPI, []);

// Leaderboard API calls (all require online mode)
const baseLeaderboardAPI = {
  get: (category = 'overall') => fetchAPI(`/leaderboard/${category}`),
  getEloRanking: () => fetchAPI("/leaderboard/elo"),
  getWinRateRanking: () => fetchAPI("/leaderboard/winrate"),
  getByCategory: (category) => fetchAPI(`/leaderboard/${category}`),
};

export const leaderboardAPI = addOnlineChecksToAPI(baseLeaderboardAPI, []);

// Statistics API calls
export const statsAPI = {
  getOverall: () => fetchAPI("/stats"),
}

// Backward compatibility exports
export const gameStatApi = gameAPI;
export { playerAPI as default };

