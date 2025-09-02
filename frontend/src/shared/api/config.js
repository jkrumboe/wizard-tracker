// API Configuration
// Central configuration for all API endpoints

// Get the API base URL from environment or use relative path by default
// This lets Nginx or the current origin proxy /api requests in production
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

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
    stats: `${API_BASE_URL}/api/games/stats`,
  },
  users: {
    updateName: (id) => `${API_BASE_URL}/api/users/${id}/name`,
  }
};

// Check if backend should be skipped in development
export const SKIP_BACKEND = import.meta.env.DEV && !import.meta.env.VITE_API_BASE_URL;
