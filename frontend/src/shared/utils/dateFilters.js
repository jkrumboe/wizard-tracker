/**
 * Date filtering utilities for game lists
 */

export const DATE_FILTER_OPTIONS = {
  ALL: 'all',
  TODAY: 'today',
  YESTERDAY: 'yesterday',
  LAST_7_DAYS: 'last_7_days',
  LAST_30_DAYS: 'last_30_days',
  LAST_90_DAYS: 'last_90_days',
  CUSTOM: 'custom'
};

export const DATE_FILTER_LABELS = {
  [DATE_FILTER_OPTIONS.ALL]: 'All Time',
  [DATE_FILTER_OPTIONS.TODAY]: 'Today',
  [DATE_FILTER_OPTIONS.YESTERDAY]: 'Yesterday',
  [DATE_FILTER_OPTIONS.LAST_7_DAYS]: 'Last 7 Days',
  [DATE_FILTER_OPTIONS.LAST_30_DAYS]: 'Last 30 Days',
  [DATE_FILTER_OPTIONS.LAST_90_DAYS]: 'Last 90 Days',
  [DATE_FILTER_OPTIONS.CUSTOM]: 'Custom Range'
};

/**
 * Filter games by date range
 * @param {Array} games - Array of games to filter
 * @param {string} filterType - Type of date filter to apply
 * @param {Object} customRange - Custom date range {startDate, endDate} for CUSTOM filter
 * @returns {Array} - Filtered games array
 */
export function filterGamesByDate(games, filterType = DATE_FILTER_OPTIONS.ALL, customRange = null) {
  if (filterType === DATE_FILTER_OPTIONS.ALL) {
    return games;
  }

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  
  let startDate, endDate;

  switch (filterType) {
    case DATE_FILTER_OPTIONS.TODAY:
      startDate = today;
      endDate = new Date(today.getTime() + 24 * 60 * 60 * 1000 - 1);
      break;
      
    case DATE_FILTER_OPTIONS.YESTERDAY:
      startDate = new Date(today.getTime() - 24 * 60 * 60 * 1000);
      endDate = new Date(today.getTime() - 1);
      break;
      
    case DATE_FILTER_OPTIONS.LAST_7_DAYS:
      startDate = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
      endDate = now;
      break;
      
    case DATE_FILTER_OPTIONS.LAST_30_DAYS:
      startDate = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
      endDate = now;
      break;
      
    case DATE_FILTER_OPTIONS.LAST_90_DAYS:
      startDate = new Date(today.getTime() - 90 * 24 * 60 * 60 * 1000);
      endDate = now;
      break;
      
    case DATE_FILTER_OPTIONS.CUSTOM:
      if (!customRange || !customRange.startDate || !customRange.endDate) {
        return games;
      }
      startDate = new Date(customRange.startDate);
      endDate = new Date(customRange.endDate);
      // Set end date to end of day
      endDate.setHours(23, 59, 59, 999);
      break;
      
    default:
      return games;
  }

  return games.filter(game => {
    // Get the relevant date from the game (prefer lastPlayed, then savedAt, then created_at)
    const gameDate = new Date(
      game.lastPlayed || 
      game.savedAt || 
      game.created_at || 
      game.dateCreated ||
      '1970-01-01'
    );
    
    return gameDate >= startDate && gameDate <= endDate;
  });
}

/**
 * Get available date filter options for a dropdown
 * @returns {Array} - Array of {value, label} objects
 */
export function getDateFilterOptions() {
  return Object.keys(DATE_FILTER_OPTIONS).map(key => ({
    value: DATE_FILTER_OPTIONS[key],
    label: DATE_FILTER_LABELS[DATE_FILTER_OPTIONS[key]]
  }));
}
