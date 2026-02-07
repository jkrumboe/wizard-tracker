import { API_ENDPOINTS } from './config.js';

/**
 * ELO Rating Service
 * Handles fetching ELO ratings and rankings from the API
 * Supports game-type-specific ELO ratings
 */
class EloService {
  /**
   * Get ELO rankings leaderboard for a specific game type
   * @param {Object} options - Query options
   * @param {string} options.gameType - Game type (default: 'wizard')
   * @param {number} options.page - Page number (default: 1)
   * @param {number} options.limit - Results per page (default: 50)
   * @param {number} options.minGames - Minimum games to appear (default: 5)
   * @returns {Promise<Object>} Rankings data
   */
  async getRankings({ gameType = 'wizard', page = 1, limit = 50, minGames } = {}) {
    try {
      const params = new URLSearchParams({
        gameType,
        page: String(page),
        limit: String(limit),
      });
      
      if (minGames !== undefined) {
        params.append('minGames', String(minGames));
      }
      
      const response = await fetch(`${API_ENDPOINTS.elo.rankings}?${params}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch ELO rankings: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error fetching ELO rankings:', error);
      throw error;
    }
  }

  /**
   * Get current user's ELO rating and history for a specific game type
   * @param {string} token - Auth token
   * @param {string} gameType - Game type (default: 'wizard')
   * @returns {Promise<Object>} User's ELO data
   */
  async getMyElo(token, gameType = 'wizard') {
    try {
      const params = new URLSearchParams({ gameType });
      const response = await fetch(`${API_ENDPOINTS.elo.me}?${params}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch user ELO: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error fetching user ELO:', error);
      throw error;
    }
  }

  /**
   * Get current user's ELO ratings for ALL game types
   * @param {string} token - Auth token
   * @returns {Promise<Object>} User's ELO data for all game types
   */
  async getMyAllElo(token) {
    try {
      const response = await fetch(`${API_ENDPOINTS.elo.me}/all`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch all user ELO: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error fetching all user ELO:', error);
      throw error;
    }
  }

  /**
   * Get ELO history for a specific identity and game type
   * @param {string} identityId - Identity ID
   * @param {Object} options - Query options
   * @param {string} options.gameType - Game type (default: 'wizard')
   * @param {number} options.limit - Max history entries (default: 20)
   * @returns {Promise<Object>} ELO history data
   */
  async getEloHistory(identityId, { gameType = 'wizard', limit = 20 } = {}) {
    try {
      const params = new URLSearchParams({
        gameType,
        limit: String(limit),
      });
      
      const response = await fetch(`${API_ENDPOINTS.elo.history(identityId)}?${params}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch ELO history: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error fetching ELO history:', error);
      throw error;
    }
  }

  /**
   * Get ELO system configuration
   * @returns {Promise<Object>} ELO config
   */
  async getConfig() {
    try {
      const response = await fetch(API_ENDPOINTS.elo.config);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch ELO config: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error fetching ELO config:', error);
      throw error;
    }
  }

  /**
   * Recalculate all ELO ratings (admin only)
   * @param {string} token - Auth token
   * @param {Object} options - Options
   * @param {boolean} options.dryRun - If true, only preview changes without applying (default: true)
   * @param {string} options.gameType - Specific game type to recalculate, or null for all
   * @returns {Promise<Object>} Recalculation results
   */
  async recalculateAll(token, { dryRun = true, gameType = null } = {}) {
    try {
      const body = { dryRun };
      if (gameType) {
        body.gameType = gameType;
      }

      const response = await fetch(API_ENDPOINTS.elo.recalculate, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to recalculate ELO: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error recalculating ELO:', error);
      throw error;
    }
  }
}

export const eloService = new EloService();
export default eloService;
