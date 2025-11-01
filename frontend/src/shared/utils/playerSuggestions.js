/**
 * Player Suggestions Utility
 * Extracts unique player names from local storage for autocomplete suggestions
 */

import { LocalGameStorage } from '@/shared/api/localGameStorage';
import { LocalTableGameStorage } from '@/shared/api/localTableGameStorage';

/**
 * Get all unique player names from saved games in local storage
 * @returns {string[]} Array of unique player names sorted alphabetically
 */
export function getPlayerSuggestions() {
  const playerNames = new Set();

  try {
    // Get regular saved games
    const savedGames = LocalGameStorage.getSavedGamesList();
    
    savedGames.forEach(game => {
      if (game.players && Array.isArray(game.players)) {
        game.players.forEach(playerName => {
          if (playerName && typeof playerName === 'string' && playerName.trim()) {
            playerNames.add(playerName.trim());
          }
        });
      }
    });

    // Get table games
    try {
      const tableGames = LocalTableGameStorage.getSavedTableGamesList();
      
      tableGames.forEach(game => {
        if (game.players && Array.isArray(game.players)) {
          game.players.forEach(playerName => {
            if (playerName && typeof playerName === 'string' && playerName.trim()) {
              playerNames.add(playerName.trim());
            }
          });
        }
      });
    } catch (error) {
      console.debug('No table games found or error reading table games:', error);
    }

  } catch (error) {
    console.error('Error getting player suggestions:', error);
  }

  // Convert Set to Array and sort alphabetically (case-insensitive)
  return Array.from(playerNames).sort((a, b) => 
    a.toLowerCase().localeCompare(b.toLowerCase())
  );
}

/**
 * Filter player suggestions based on input text
 * @param {string} input - The current input text
 * @param {string[]} allSuggestions - All available suggestions
 * @param {number} maxResults - Maximum number of results to return
 * @returns {string[]} Filtered suggestions
 */
export function filterPlayerSuggestions(input, allSuggestions, maxResults = 5) {
  if (!input || !input.trim()) {
    return [];
  }

  const searchTerm = input.toLowerCase().trim();
  
  // Filter and sort suggestions
  const filtered = allSuggestions.filter(name => 
    name.toLowerCase().includes(searchTerm)
  );

  // Prioritize suggestions that start with the search term
  const startsWithTerm = filtered.filter(name => 
    name.toLowerCase().startsWith(searchTerm)
  );
  const containsTerm = filtered.filter(name => 
    !name.toLowerCase().startsWith(searchTerm)
  );

  return [...startsWithTerm, ...containsTerm].slice(0, maxResults);
}
