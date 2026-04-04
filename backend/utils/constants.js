/**
 * Application-wide constants
 * Centralizes magic numbers and configuration values used across the backend.
 */

module.exports = {
  // Authentication
  AUTH_SALT_ROUNDS: 12,
  JWT_EXPIRY: '7d',
  USER_CACHE_TTL: 900, // 15 minutes in seconds
  ONLINE_STATUS_TTL: 300, // 5 minutes in seconds

  // ELO
  DEFAULT_ELO_RATING: 1000,

  // Pagination & Limits
  MAX_GAMES_PER_PAGE: 100,
  DEFAULT_GAMES_PER_PAGE: 50,
  MAX_BATCH_CHECK_SIZE: 100,
  MAX_PROFILE_GAMES: 200,
  MAX_LOGIN_HISTORY: 50,
  MAX_IDENTITY_SEARCH_RESULTS: 50,

  // Duplicate Detection
  DUPLICATE_CHECK_WINDOW_MS: 24 * 60 * 60 * 1000, // 24 hours
  DUPLICATE_CHECK_GAME_LIMIT: 50,

  // Cache TTLs (seconds)
  LEADERBOARD_CACHE_TTL: 300, // 5 minutes
  RECENT_GAMES_CACHE_TTL: 120, // 2 minutes

  // Rate Limiting
  RATE_LIMIT_WINDOW_MS: 15 * 60 * 1000, // 15 minutes
  GENERAL_RATE_LIMIT: 500,
  AUTH_RATE_LIMIT: 200,
  API_RATE_LIMIT: 1000,
  ADMIN_RATE_LIMIT: 50,
  FRIENDS_RATE_LIMIT: 2000,
  ELO_PUBLIC_RATE_LIMIT: 300,
};
