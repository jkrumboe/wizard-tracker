import { useMemo } from 'react';

/**
 * Unified game stats calculation hook
 * Works with both localStorage games and API games
 * 
 * @param {Array} games - Array of game objects (wizard + table games)
 * @param {Object} user - Current user object (should include `identities` array from API)
 * @returns {Object} - { gameTypes: [], recentResults: [] }
 */
export const useGameStats = (games, user) => {
  return useMemo(() => {
    const allGamesList = games || [];
        
    if (!user || allGamesList.length === 0) {
      return { gameTypes: [], recentResults: [] };
    }

    const gameTypeStats = {};

    // Get user identifiers
    const userIdentifiers = [user.id, user._id, user.$id, user.username].filter(Boolean);
    
    // Get all searchable names (username + identity names) from user object
    // Identities can be either strings (from API) or objects with displayName/name properties
    // Always include username as a fallback
    const identityNames = user.identities 
      ? user.identities.map(identity => 
          typeof identity === 'string' ? identity : (identity.displayName || identity.name)
        ).filter(Boolean)
      : [];
    const searchNames = [...new Set([user.username, ...identityNames])].filter(Boolean);
    const searchNamesLower = searchNames.map(name => name?.toLowerCase()).filter(Boolean);

    // Sort games by date (oldest first) so when we unshift results, newest ends up at front
    const sortedGamesList = [...allGamesList].sort((a, b) => {
      const dateA = new Date(a.created_at || a.savedAt || a.lastPlayed || 0);
      const dateB = new Date(b.created_at || b.savedAt || b.lastPlayed || 0);
      return dateA - dateB; // Oldest first
    });

    sortedGamesList.forEach(game => {
      // Skip paused or unfinished games
      if (game.isPaused || game.gameFinished === false) return;

      // Determine game type
      let gameType;
      if (game.gameType === 'table') {
        // Table game
        gameType = game.gameTypeName || game.name || 'Table Game';
      } else {
        // Wizard game
        gameType = game.game_mode || game.gameData?.game_mode || game.gameState?.game_mode || 'Wizard';
        // Fix "Local" mode to be "Wizard"
        if (gameType === 'Local') {
          gameType = 'Wizard';
        }
      }
      
      // Initialize game type stats
      if (!gameTypeStats[gameType]) {
        gameTypeStats[gameType] = {
          name: gameType,
          matches: 0,
          wins: 0,
          recentResults: []
        };
      }

      // Check if user won this game
      let userWon = false;
      let userPlayer = null;

      // Different handling for table games vs wizard games
      if (game.gameType === 'table') {
        // Table games: use winner_ids from API (already calculated by backend)
        // Or fallback to calculating from points if it's a local game
        if (game.gameData?.players) {
          const players = game.gameData.players;
          
          // Find the user's player
          const userPlayerIndex = players.findIndex(p => {
            const playerNameLower = p.name?.toLowerCase();
            const playerUserId = p.userId;
            
            // Match by any of the user's names (including identity names) OR by userId
            return searchNamesLower.includes(playerNameLower) ||
                   userIdentifiers.includes(playerUserId) ||
                   String(playerUserId) === String(user._id) ||
                   String(playerUserId) === String(user.id);
          });
          
          if (userPlayerIndex !== -1) {
            userPlayer = players[userPlayerIndex];
            
            // For table games: ALWAYS calculate winner from scores (most reliable method)
            // This handles both old schema (winner_name only) and new schema (winner_ids)
            if (players[userPlayerIndex].points && players[userPlayerIndex].points.length > 0) {
              const lowIsBetter = game.gameData?.lowIsBetter || game.lowIsBetter || false;
              
              const playersWithScores = players.map((player, index) => {
                const total = player.points?.reduce((sum, val) => sum + (parseFloat(val) || 0), 0) || 0;
                return { name: player.name, index, total };
              });
              
              // Find the winning score(s)
              if (playersWithScores.length > 0) {
                const scores = playersWithScores.map(p => p.total);
                const winningScore = lowIsBetter 
                  ? Math.min(...scores)
                  : Math.max(...scores);
                
                // User won if their score equals the winning score
                const userScore = playersWithScores[userPlayerIndex]?.total || 0;
                userWon = userScore === winningScore;
              }
            } else {
              // Fallback: use winner_ids from API or winner_name for old schema
              const winnerIds = game.winner_ids || game.gameData?.winner_ids || [];
              const userPlayerId = `player_${userPlayerIndex}`;
              const winnerName = game.gameData?.winner_name || game.winner_name;
              
              if (winnerIds && winnerIds.length > 0) {
                userWon = winnerIds.includes(userPlayerId) || 
                         winnerIds.includes(userPlayer.id) ||
                         winnerIds.some(id => String(id) === String(userPlayer.id));
              } else if (winnerName && userPlayer.name) {
                // Old schema fallback: match by winner_name
                userWon = winnerName.toLowerCase() === userPlayer.name.toLowerCase();
              }
            }
          }
        }
      } else {
        // Wizard games: check all possible locations for players
        const players = game.players || game.gameData?.players || game.gameState?.players;
        if (players) {
          userPlayer = players.find(p => {
            const playerNameLower = p.name?.toLowerCase();
            const playerUsernameLower = p.username?.toLowerCase();
            
            // Match by any of the user's names (including identity names) OR by userId
            return searchNamesLower.includes(playerNameLower) ||
                   searchNamesLower.includes(playerUsernameLower) ||
                   userIdentifiers.includes(p.id) ||
                   userIdentifiers.includes(p.userId);
          });
          
          if (userPlayer) {
            // Check winner_ids - these contain player IDs like "player_0", not user database IDs
            const winnerIdRaw = game.winner_ids || game.gameData?.winner_ids || game.gameState?.winner_ids ||
                               game.winner_id || game.gameData?.winner_id || game.gameState?.winner_id;
            const winnerIds = Array.isArray(winnerIdRaw) ? winnerIdRaw : (winnerIdRaw ? [winnerIdRaw] : []);
            
            // Check if user's player ID or originalId (pre-migration ID) is in winner_ids
            if (winnerIds && winnerIds.length > 0) {
              userWon = winnerIds.includes(userPlayer.id) ||
                       winnerIds.some(id => String(id) === String(userPlayer.id)) ||
                       (userPlayer.originalId && winnerIds.includes(userPlayer.originalId)) ||
                       (userPlayer.originalId && winnerIds.some(id => String(id) === String(userPlayer.originalId)));
            }
          }
        }
      }

      gameTypeStats[gameType].matches++;
      if (userWon) {
        gameTypeStats[gameType].wins++;
      }
      
      // Add to recent results (limit to last 10)
      gameTypeStats[gameType].recentResults.unshift(userWon ? 'W' : 'L');
      if (gameTypeStats[gameType].recentResults.length > 10) {
        gameTypeStats[gameType].recentResults.pop();
      }
    });

    const gameTypes = Object.values(gameTypeStats).filter(gt => gt.matches > 0);
    
    // Get overall recent results (last 10 games)
    const sortedGames = [...allGamesList]
      .filter(g => !g.isPaused && g.gameFinished !== false)
      .sort((a, b) => {
        const dateA = new Date(a.created_at || a.savedAt || a.lastPlayed || 0);
        const dateB = new Date(b.created_at || b.savedAt || b.lastPlayed || 0);
        return dateB - dateA; // Most recent first
      });
    
    const allResults = sortedGames.slice(0, 10).map(game => {
      let userWon = false;
      
      if (game.gameType === 'table') {
        // Table game - calculate winner from scores (most reliable method)
        if (game.gameData?.players) {
          const players = game.gameData.players;
          
          // Find user's player index
          const userPlayerIndex = players.findIndex(p => {
            const playerNameLower = p.name?.toLowerCase();
            const playerUserId = p.userId || p.id;
            return searchNamesLower.includes(playerNameLower) || 
                   userIdentifiers.includes(playerUserId) || 
                   (p.username && searchNamesLower.includes(p.username.toLowerCase()));
          });
          
          if (userPlayerIndex !== -1) {
            const userPlayer = players[userPlayerIndex];
            
            // Calculate winner from scores (most reliable for all schema versions)
            if (userPlayer.points && userPlayer.points.length > 0) {
              const lowIsBetter = game.gameData?.lowIsBetter || game.lowIsBetter || false;
              
              // Calculate all player scores
              const playersWithScores = players.map((player, idx) => {
                const total = player.points?.reduce((sum, val) => sum + (parseFloat(val) || 0), 0) || 0;
                return { index: idx, total };
              });
              
              if (playersWithScores.length > 0) {
                const scores = playersWithScores.map(p => p.total);
                const winningScore = lowIsBetter 
                  ? Math.min(...scores)
                  : Math.max(...scores);
                
                userWon = playersWithScores[userPlayerIndex]?.total === winningScore;
              }
            } else {
              // Fallback: use winner_ids or winner_name
              const winnerIds = game.winner_ids || game.gameData?.winner_ids || [];
              const userPlayerId = `player_${userPlayerIndex}`;
              const winnerName = game.gameData?.winner_name || game.winner_name;
              
              if (winnerIds && winnerIds.length > 0) {
                userWon = winnerIds.includes(userPlayerId) || 
                         winnerIds.includes(userPlayer.id) ||
                         winnerIds.some(id => String(id) === String(userPlayer.id));
              } else if (winnerName && userPlayer.name) {
                userWon = winnerName.toLowerCase() === userPlayer.name.toLowerCase();
              }
            }
          }
        }
      } else {
        // Wizard game
        const players = game.players || game.gameData?.players || game.gameState?.players;
        if (players) {
          const userPlayer = players.find(p => {
            const playerNameLower = p.name?.toLowerCase();
            const playerUsernameLower = p.username?.toLowerCase();
            const playerUserId = p.userId || p.id;
            
            return searchNamesLower.includes(playerNameLower) ||
                   searchNamesLower.includes(playerUsernameLower) ||
                   userIdentifiers.includes(playerUserId);
          });
          
          const winnerIdRaw = game.winner_ids || game.gameData?.winner_ids || game.gameState?.winner_ids ||
                           game.winner_id || game.gameData?.winner_id || game.gameState?.winner_id;
          const winnerIds = Array.isArray(winnerIdRaw) ? winnerIdRaw : (winnerIdRaw ? [winnerIdRaw] : []);
          
          if (userPlayer && winnerIds && winnerIds.length > 0) {
            userWon = winnerIds.includes(userPlayer.id) ||
                     winnerIds.some(id => String(id) === String(userPlayer.id)) ||
                     (userPlayer.originalId && winnerIds.includes(userPlayer.originalId)) ||
                     (userPlayer.originalId && winnerIds.some(id => String(id) === String(userPlayer.originalId)));
          }
        }
      }
      
      return userWon ? 'W' : 'L';
    });

    return { gameTypes, recentResults: allResults };
  }, [games, user]);
};
