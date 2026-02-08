// API Configuration
// Central configuration for all API endpoints

// Get the API base URL from environment or use relative path by default
// This lets Nginx or the current origin proxy /api requests in production
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

// Log API configuration on startup (only in development)
if (import.meta.env.DEV) {
  console.debug('🔧 API Configuration:', {
    VITE_API_BASE_URL: import.meta.env.VITE_API_BASE_URL,
    API_BASE_URL: API_BASE_URL || '(relative path - proxied by nginx)',
    DEV: import.meta.env.DEV,
    SKIP_BACKEND: import.meta.env.DEV && !import.meta.env.VITE_API_BASE_URL
  });
}

// API endpoints
export const API_ENDPOINTS = {
  base: API_BASE_URL,
  auth: {
    register: `${API_BASE_URL}/api/users/register`,
    login: `${API_BASE_URL}/api/users/login`,
    me: `${API_BASE_URL}/api/users/me`,
  },
  games: {
    list: `${API_BASE_URL}/api/games`,
    create: `${API_BASE_URL}/api/games`,
    getById: (id) => `${API_BASE_URL}/api/games/${id}`,
    batchCheck: `${API_BASE_URL}/api/games/batch-check`,
    stats: `${API_BASE_URL}/api/games/stats`,
    leaderboard: `${API_BASE_URL}/api/games/leaderboard`,
    friendLeaderboard: `${API_BASE_URL}/api/games/friend-leaderboard`,
    recent: `${API_BASE_URL}/api/games/recent`,
  },
  wizardGames: {
    list: `${API_BASE_URL}/api/wizard-games`,
    create: `${API_BASE_URL}/api/wizard-games`,
    getById: (id) => `${API_BASE_URL}/api/wizard-games/${id}`,
    getPublicById: (id) => `${API_BASE_URL}/api/wizard-games/public/${id}`,
    batchCheck: `${API_BASE_URL}/api/wizard-games/batch-check`,
    stats: `${API_BASE_URL}/api/wizard-games/stats`,
    migrate: `${API_BASE_URL}/api/wizard-games/migrate`,
  },
  tableGames: {
    list: `${API_BASE_URL}/api/table-games`,
    create: `${API_BASE_URL}/api/table-games`,
    getById: (id) => `${API_BASE_URL}/api/table-games/${id}`,
    getPublicById: (id) => `${API_BASE_URL}/api/table-games/public/${id}`,
  },
  gameTemplates: {
    list: `${API_BASE_URL}/api/game-templates`,
    create: `${API_BASE_URL}/api/game-templates`,
    getById: (id) => `${API_BASE_URL}/api/game-templates/${id}`,
    suggest: (id) => `${API_BASE_URL}/api/game-templates/${id}/suggest`,
    adminSuggestions: `${API_BASE_URL}/api/game-templates/admin/suggestions`,
    approveSuggestion: (id) => `${API_BASE_URL}/api/game-templates/admin/suggestions/${id}/approve`,
    rejectSuggestion: (id) => `${API_BASE_URL}/api/game-templates/admin/suggestions/${id}`,
  },
  elo: {
    rankings: `${API_BASE_URL}/api/identities/elo/rankings`,
    history: (id) => `${API_BASE_URL}/api/identities/elo/history/${id}`,
    me: `${API_BASE_URL}/api/identities/elo/me`,
    config: `${API_BASE_URL}/api/identities/elo/config`,
    recalculate: `${API_BASE_URL}/api/identities/elo/recalculate`,
  },
  users: {
    updateName: (id) => `${API_BASE_URL}/api/users/${id}/name`,
    lookup: (username) => `${API_BASE_URL}/api/users/lookup/${encodeURIComponent(username)}`,
    all: `${API_BASE_URL}/api/users/all`,
    friends: (userId) => `${API_BASE_URL}/api/users/${userId}/friends`,
    addFriend: (userId, friendId) => `${API_BASE_URL}/api/users/${userId}/friends/${friendId}`,
    removeFriend: (userId, friendId) => `${API_BASE_URL}/api/users/${userId}/friends/${friendId}`,
  }
};

// Check if backend should be skipped in development
// VITE_USE_BACKEND=true overrides the skip when using Vite's dev proxy with empty VITE_API_BASE_URL
export const SKIP_BACKEND = import.meta.env.DEV && !import.meta.env.VITE_API_BASE_URL && !import.meta.env.VITE_USE_BACKEND;
