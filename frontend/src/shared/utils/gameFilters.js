/**
 * Utility function to filter and sort games based on filter criteria
 * @param {Array} games - Array of game objects
 * @param {Object} filters - Filter criteria object
 * @returns {Array} Filtered and sorted array of games
 */
export const filterGames = (games, filters) => {
  if (!games || !Array.isArray(games)) {
    return [];
  }

  let filteredGames = [...games];

  // Filter by player names (must include ALL selected players)
  if (filters.playerNames && filters.playerNames.length > 0) {
    filteredGames = filteredGames.filter(game => {
      // Handle v3.0 format (players at root) and legacy format (players in gameState)
      const players = game.players || game.gameState?.players || [];
      const playerNamesInGame = players.map(p => 
        (p.name || p.username || '').toLowerCase().trim()
      );
      
      // Check if ALL selected players are in this game
      return filters.playerNames.every(filterPlayer => 
        playerNamesInGame.some(gameName => 
          gameName.includes(filterPlayer.toLowerCase().trim())
        )
      );
    });
  }

  // Filter by date range
  if (filters.dateFrom) {
    const fromDate = new Date(filters.dateFrom);
    fromDate.setHours(0, 0, 0, 0);
    filteredGames = filteredGames.filter(game => {
      const gameDate = new Date(game.created_at || game.savedAt || 0);
      return gameDate >= fromDate;
    });
  }

  if (filters.dateTo) {
    const toDate = new Date(filters.dateTo);
    toDate.setHours(23, 59, 59, 999);
    filteredGames = filteredGames.filter(game => {
      const gameDate = new Date(game.created_at || game.savedAt || 0);
      return gameDate <= toDate;
    });
  }

  // Sort games
  if (filters.sortBy) {
    filteredGames.sort((a, b) => {
      let valueA, valueB;

      switch (filters.sortBy) {
        case 'date':
          valueA = new Date(a.created_at || a.savedAt || 0).getTime();
          valueB = new Date(b.created_at || b.savedAt || 0).getTime();
          break;
        case 'rounds':
          valueA = a.total_rounds || a.totalRounds || a.gameState?.maxRounds || 0;
          valueB = b.total_rounds || b.totalRounds || b.gameState?.maxRounds || 0;
          break;
        case 'players':
          valueA = (a.players ? a.players.length : (a.gameState?.players?.length || 0));
          valueB = (b.players ? b.players.length : (b.gameState?.players?.length || 0));
          break;
        default:
          valueA = new Date(a.created_at || a.savedAt || 0).getTime();
          valueB = new Date(b.created_at || b.savedAt || 0).getTime();
      }

      // Apply sort order
      if (filters.sortOrder === 'asc') {
        return valueA - valueB;
      } else {
        return valueB - valueA;
      }
    });
  }

  return filteredGames;
};

/**
 * Get initial filter state
 * @returns {Object} Default filter object
 */
export const getDefaultFilters = () => ({
  playerNames: [],
  dateFrom: '',
  dateTo: '',
  sortBy: 'date',
  sortOrder: 'desc'
});

/**
 * Check if any filters are active (not default)
 * @param {Object} filters - Filter object to check
 * @returns {boolean} True if any filters are active
 */
export const hasActiveFilters = (filters) => {
  const defaults = getDefaultFilters();
  return Object.keys(filters).some(key => {
    // Ignore sort-related filters for "active" check
    if (key === 'sortBy' || key === 'sortOrder') return false;
    
    // Check array filters
    if (key === 'playerNames') {
      return Array.isArray(filters[key]) && filters[key].length > 0;
    }
    
    return filters[key] !== defaults[key] && filters[key] !== '';
  });
};
