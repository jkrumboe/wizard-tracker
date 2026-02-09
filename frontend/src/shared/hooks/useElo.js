import { useState, useEffect, useCallback } from 'react';
import eloService from '@/shared/api/eloService';
import authService from '@/shared/api/authService';

/**
 * Hook to fetch and manage a user's ELO rating for a specific game type.
 * When identityId is provided, fetches that identity's ELO (public endpoint).
 * Otherwise fetches the logged-in user's ELO via the /me endpoint.
 * @param {string} gameType - Game type to fetch ELO for (default: 'wizard')
 * @param {string|null} identityId - Optional identity ID to fetch ELO for a specific user
 * @returns {Object} - { elo, loading, error, refetch }
 */
export const useUserElo = (gameType = 'wizard', identityId = null) => {
  const [elo, setElo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchElo = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      // If an identityId is provided, use the public ELO history endpoint
      if (identityId) {
        const data = await eloService.getEloHistory(identityId, { gameType, limit: 20 });
        setElo(data);
      } else {
        // Otherwise fetch the logged-in user's own ELO
        const token = await authService.getStoredToken();
        
        if (!token) {
          setElo(null);
          setLoading(false);
          return;
        }
        
        const data = await eloService.getMyElo(token, gameType);
        setElo(data);
      }
    } catch (err) {
      console.error('Failed to fetch user ELO:', err);
      setError(err.message);
      setElo(null);
    } finally {
      setLoading(false);
    }
  }, [gameType, identityId]);

  useEffect(() => {
    fetchElo();
  }, [fetchElo]);

  return { elo, loading, error, refetch: fetchElo };
};

/**
 * Hook to fetch user's ELO ratings for ALL game types
 * @returns {Object} - { eloByGameType, gameTypes, loading, error, refetch }
 */
export const useAllUserElo = () => {
  const [data, setData] = useState({ eloByGameType: {}, gameTypes: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchAllElo = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const token = await authService.getStoredToken();
      
      if (!token) {
        setData({ eloByGameType: {}, gameTypes: [] });
        setLoading(false);
        return;
      }
      
      const result = await eloService.getMyAllElo(token);
      setData({
        eloByGameType: result.eloByGameType || {},
        gameTypes: result.gameTypes || [],
        hasIdentity: result.hasIdentity
      });
    } catch (err) {
      console.error('Failed to fetch all user ELO:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAllElo();
  }, [fetchAllElo]);

  return { 
    eloByGameType: data.eloByGameType, 
    gameTypes: data.gameTypes,
    hasIdentity: data.hasIdentity,
    loading, 
    error, 
    refetch: fetchAllElo 
  };
};

/**
 * Hook to fetch ELO rankings/leaderboard for a specific game type
 * @param {Object} options - Query options including gameType
 * @returns {Object} - { rankings, pagination, loading, error, refetch }
 */
export const useEloRankings = (options = {}) => {
  const [data, setData] = useState({ rankings: [], pagination: null });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchRankings = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const result = await eloService.getRankings(options);
      setData(result);
    } catch (err) {
      console.error('Failed to fetch ELO rankings:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [options]);

  useEffect(() => {
    fetchRankings();
  }, [fetchRankings]);

  return { 
    rankings: data.rankings, 
    pagination: data.pagination, 
    config: data.config,
    gameType: data.gameType,
    loading, 
    error, 
    refetch: fetchRankings 
  };
};

export default useUserElo;
