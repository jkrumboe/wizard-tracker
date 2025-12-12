/**
 * Local Storage Migration Utility
 * Migrates games from legacy format (with gameState wrapper) to v3.0 format
 */

const LOCAL_GAMES_STORAGE_KEY = "wizardTracker_localGames";
const MIGRATION_STATUS_KEY = "wizardTracker_migrationStatus";

/**
 * Check if a game needs migration
 * @param {Object} game - Game object to check
 * @returns {boolean} - True if game needs migration
 */
function needsMigration(game) {
  // If it already has version 3.0 and no gameState wrapper, it's already migrated
  if (game.version === '3.0' && !game.gameState) {
    return false;
  }
  
  // If it has a gameState wrapper, it needs migration
  if (game.gameState) {
    return true;
  }
  
  // If it's missing version field but has game data, it needs migration
  if (!game.version && (game.players || game.roundData || game.round_data)) {
    return true;
  }
  
  return false;
}

/**
 * Migrate a single game from legacy format to v3.0
 * @param {Object} game - Game in legacy format
 * @returns {Object} - Game in v3.0 format
 */
function migrateGameToV3(game) {
  // If already v3.0, return as-is
  if (game.version === '3.0' && !game.gameState) {
    return game;
  }
  
  // Extract game state data (could be wrapped or flat)
  const gameData = game.gameState || game;
  
  // Convert round data to v3.0 format
  const roundData = (gameData.roundData || gameData.round_data || gameData.rounds || []).map(round => ({
    players: (round.players || []).map(player => {
      const formatted = {
        id: player.id,
        made: player.made !== undefined ? player.made : null,
        score: player.score !== undefined ? player.score : null
      };
      
      if (player.call !== undefined) {
        formatted.call = player.call;
      }
      
      return formatted;
    })
  }));
  
  // Convert players to v3.0 format
  const players = (gameData.players || []).map(player => ({
    id: player.id,
    name: player.name,
    ...(player.isVerified !== undefined && { isVerified: player.isVerified }),
    ...(player.isDealer !== undefined && { isDealer: player.isDealer }),
    ...(player.isCaller !== undefined && { isCaller: player.isCaller })
  }));
  
  // Build v3.0 format game
  const migratedGame = {
    // Identifiers
    id: game.id,
    
    // v3.0 schema fields
    version: '3.0',
    created_at: gameData.created_at || gameData.referenceDate || game.savedAt || new Date().toISOString(),
    duration_seconds: gameData.duration_seconds || 0,
    total_rounds: gameData.total_rounds || gameData.maxRounds || game.totalRounds || 0,
    players: players,
    round_data: roundData,
    
    // Game state
    gameFinished: game.gameFinished !== undefined ? game.gameFinished : (game.isPaused === false),
    
    // Metadata fields
    name: game.name,
    savedAt: game.savedAt || new Date().toISOString(),
    lastPlayed: game.lastPlayed || game.savedAt || new Date().toISOString(),
    userId: game.userId,
    isUploaded: game.isUploaded || false,
    cloudGameId: game.cloudGameId || null,
    cloudLookupKey: game.cloudLookupKey || null,
    uploadedAt: game.uploadedAt || null,
    
    // Internal state for UI
    _internalState: {
      currentRound: gameData.currentRound || 1,
      maxRounds: gameData.maxRounds || game.totalRounds || 0,
      gameStarted: gameData.gameStarted !== undefined ? gameData.gameStarted : true,
      mode: gameData.mode || game.mode || "Local",
      isLocal: gameData.isLocal !== undefined ? gameData.isLocal : true,
      isPaused: game.isPaused !== undefined ? game.isPaused : !game.gameFinished,
      referenceDate: gameData.referenceDate || gameData.created_at
    }
  };
  
  // Add optional finished game fields
  if (migratedGame.gameFinished) {
    if (gameData.winner_id || game.winner_id) {
      migratedGame.winner_id = gameData.winner_id || game.winner_id || [];
    }
    if (gameData.final_scores || game.final_scores) {
      migratedGame.final_scores = gameData.final_scores || game.final_scores || {};
    }
  }
  
  return migratedGame;
}

/**
 * Migrate all local storage games to v3.0 format
 * @returns {Object} - Migration result with stats
 */
export function migrateLocalStorageGames() {
  try {
    const stored = localStorage.getItem(LOCAL_GAMES_STORAGE_KEY);
    
    if (!stored) {
      return {
        success: true,
        message: 'No games to migrate',
        stats: {
          total: 0,
          migrated: 0,
          alreadyV3: 0,
          failed: 0
        }
      };
    }
    
    const parsedData = JSON.parse(stored);
    let games;
    
    // Handle array format (very old format)
    if (Array.isArray(parsedData)) {
      games = {};
      parsedData.forEach(game => {
        if (game.id) {
          games[game.id] = game;
        }
      });
    } else {
      games = parsedData;
    }
    
    const stats = {
      total: Object.keys(games).length,
      migrated: 0,
      alreadyV3: 0,
      failed: 0
    };
    
    const migratedGames = {};
    
    // Migrate each game
    for (const [gameId, game] of Object.entries(games)) {
      try {
        if (needsMigration(game)) {
          migratedGames[gameId] = migrateGameToV3(game);
          stats.migrated++;
          console.log(`✅ Migrated game ${gameId} to v3.0`);
        } else {
          migratedGames[gameId] = game;
          stats.alreadyV3++;
          console.log(`ℹ️ Game ${gameId} already in v3.0 format`);
        }
      } catch (error) {
        console.error(`❌ Failed to migrate game ${gameId}:`, error);
        migratedGames[gameId] = game; // Keep original if migration fails
        stats.failed++;
      }
    }
    
    // Save migrated games back to localStorage
    localStorage.setItem(LOCAL_GAMES_STORAGE_KEY, JSON.stringify(migratedGames));
    
    // Mark migration as complete
    const migrationStatus = {
      lastMigration: new Date().toISOString(),
      version: '3.0',
      stats: stats
    };
    localStorage.setItem(MIGRATION_STATUS_KEY, JSON.stringify(migrationStatus));
    
    return {
      success: true,
      message: `Migration complete: ${stats.migrated} games migrated, ${stats.alreadyV3} already in v3.0, ${stats.failed} failed`,
      stats: stats
    };
  } catch (error) {
    console.error('Migration error:', error);
    return {
      success: false,
      message: `Migration failed: ${error.message}`,
      error: error
    };
  }
}

/**
 * Check if migration has been run
 * @returns {Object|null} - Migration status or null if never run
 */
export function getMigrationStatus() {
  try {
    const stored = localStorage.getItem(MIGRATION_STATUS_KEY);
    return stored ? JSON.parse(stored) : null;
  } catch (error) {
    console.error('Error reading migration status:', error);
    return null;
  }
}

/**
 * Check if any games need migration
 * @returns {boolean} - True if any games need migration
 */
export function hasGamesNeedingMigration() {
  try {
    const stored = localStorage.getItem(LOCAL_GAMES_STORAGE_KEY);
    if (!stored) return false;
    
    const parsedData = JSON.parse(stored);
    let games;
    
    if (Array.isArray(parsedData)) {
      games = parsedData;
    } else {
      games = Object.values(parsedData);
    }
    
    return games.some(game => needsMigration(game));
  } catch (error) {
    console.error('Error checking migration status:', error);
    return false;
  }
}

/**
 * Auto-migrate on app startup if needed
 * @returns {Promise<Object>} - Migration result
 */
export async function autoMigrateIfNeeded() {
  const migrationStatus = getMigrationStatus();
  
  // If migration was already done, check if any new games need migration
  if (migrationStatus && migrationStatus.version === '3.0') {
    if (hasGamesNeedingMigration()) {
      console.log('🔄 New games detected that need migration, running migration...');
      return migrateLocalStorageGames();
    }
    console.log('✅ All games already in v3.0 format');
    return {
      success: true,
      message: 'No migration needed',
      alreadyMigrated: true
    };
  }
  
  // First time migration
  console.log('🔄 Running first-time v3.0 migration...');
  return migrateLocalStorageGames();
}
