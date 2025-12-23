import { useMemo } from 'react';

/**
 * Unified game stats calculation hook
 * Works with both localStorage games and API games
 * 
 * @param {Array} games - Array of game objects (wizard + table games)
 * @param {Object} user - Current user object (should include `aliases` array from API)
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
    const usernameLower = user.username?.toLowerCase();
    
    // Get all searchable names (username + aliases) from user object
    const searchNames = user.aliases || [user.username];
    const searchNamesLower = searchNames.map(name => name?.toLowerCase()).filter(Boolean);

    allGamesList.forEach(game => {
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
        // Table games: check gameData.players
        // Match by player name (including aliases) OR userId
        if (game.gameData?.players) {
          userPlayer = game.gameData.players.find(p => {
            const playerNameLower = p.name?.toLowerCase();
            const playerUserId = p.userId;
            
            // Match by any of the user's names (including aliases) OR by userId
            return searchNamesLower.includes(playerNameLower) ||
                   userIdentifiers.includes(playerUserId) ||
                   String(playerUserId) === String(user._id) ||
                   String(playerUserId) === String(user.id);
          });
          
          if (userPlayer && game.gameFinished !== false) {
            // Check winner_ids first (new format), then fallback to winner_id (legacy)
            const winnerIds = game.gameData?.winner_ids || game.winner_ids || 
                             (game.gameData?.winner_id ? [game.gameData.winner_id] : null) ||
                             (game.winner_id ? [game.winner_id] : null);
            
            if (winnerIds && winnerIds.length > 0) {
              // Use the stored winner_ids
              userWon = winnerIds.includes(userPlayer.id) || 
                       winnerIds.includes(user.id) || 
                       winnerIds.includes(user._id) ||
                       winnerIds.includes(user.$id);
            } else {
              // Fallback: calculate winner by score
              const players = game.gameData.players;
              const lowIsBetter = game.gameData.lowIsBetter || game.lowIsBetter || false;
              
              const playersWithScores = players.map(player => {
                const total = player.points?.reduce((sum, val) => sum + (Number.parseInt(val, 10) || 0), 0) || 0;
                return { ...player, total };
              });
              
              const userWithScore = playersWithScores.find(p => p.name === userPlayer.name);
              const userScore = userWithScore?.total || 0;
              
              userWon = playersWithScores.every(p => {
                if (p.name === userPlayer.name) return true;
                return lowIsBetter ? userScore <= p.total : userScore >= p.total;
              });
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
            
            // Match by any of the user's names (including aliases) OR by userId
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
            
            // Check if user's player ID (like "player_0") is in winner_ids
            if (winnerIds && winnerIds.length > 0) {
              userWon = winnerIds.includes(userPlayer.id);
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
        // Table game
        if (game.gameData?.players && game.gameFinished !== false) {
          const userPlayer = game.gameData.players.find(p => {
            const playerNameLower = p.name?.toLowerCase();
            const playerUserId = p.userId || p.id;
            return searchNamesLower.includes(playerNameLower) || 
                   userIdentifiers.includes(playerUserId) || 
                   (p.username && searchNamesLower.includes(p.username.toLowerCase()));
          });
          
          if (userPlayer) {
            const winnerIds = game.gameData?.winner_ids || game.winner_ids ||
                             (game.gameData?.winner_id ? [game.gameData.winner_id] : null) ||
                             (game.winner_id ? [game.winner_id] : null);
            
            if (winnerIds && winnerIds.length > 0) {
              userWon = winnerIds.includes(userPlayer.id) || 
                       winnerIds.includes(user.id) || 
                       winnerIds.includes(user._id) ||
                       winnerIds.includes(user.$id);
            } else {
              // Fallback: calculate winner by score
              const players = game.gameData.players;
              const lowIsBetter = game.gameData.lowIsBetter || game.lowIsBetter || false;
              
              const playersWithScores = players.map(player => {
                const total = player.points?.reduce((sum, val) => sum + (Number.parseInt(val, 10) || 0), 0) || 0;
                return { ...player, total };
              });
              
              const userWithScore = playersWithScores.find(p => p.name === userPlayer.name);
              const userScore = userWithScore?.total || 0;
              
              userWon = playersWithScores.every(p => {
                if (p.name === userPlayer.name) return true;
                return lowIsBetter ? userScore <= p.total : userScore >= p.total;
              });
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
          
          const winnerIds = game.winner_ids || game.gameData?.winner_ids || game.gameState?.winner_ids ||
                           (game.winner_id ? [game.winner_id] : null) ||
                           (game.gameState?.winner_id ? [game.gameState.winner_id] : null);
          
          userWon = userPlayer && winnerIds && winnerIds.length > 0 ? 
            (winnerIds.includes(userPlayer.id) || 
             winnerIds.includes(userPlayer.userId) || 
             winnerIds.includes(user.id) ||
             winnerIds.includes(user._id) ||
             winnerIds.includes(user.$id)) :
            (winnerIds && winnerIds.some(winnerId => userIdentifiers.includes(winnerId)));
        }
      }
      
      return userWon ? 'W' : 'L';
    });

    return { gameTypes, recentResults: allResults };
  }, [games, user]);
};
