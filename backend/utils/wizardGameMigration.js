/**
 * Wizard Game Migration Utility
 * Detects and migrates wizard games from old formats to version 3.0
 * 
 * Format Version History:
 * - v1.0 (format1.json): Nested gameState structure with duplicate data
 * - v2.0 (format2.json): Flatter structure with player_ids, but redundant round info
 * - v3.0 (test.json): Clean flat structure - current version
 */

const CURRENT_VERSION = '3.0';

/**
 * Detects which format version a game uses
 * @param {Object} gameData - The game data to analyze
 * @returns {string} Version identifier ('1.0', '2.0', '3.0', or 'unknown')
 */
function detectGameFormat(gameData) {
  // Already has version field
  if (gameData.version) {
    return gameData.version;
  }

  // Format 3.0 characteristics (test.json):
  // - Has players array with isDealer/isCaller
  // - round_data with minimal player objects (id, made, score, optional call)
  // - NO round/cards numbers in round_data
  // - NO totalScore in round player data
  if (gameData.round_data && Array.isArray(gameData.round_data)) {
    const firstRound = gameData.round_data[0];
    if (firstRound && firstRound.players && !firstRound.round && !firstRound.cards) {
      const firstPlayer = firstRound.players[0];
      if (firstPlayer && firstPlayer.score !== undefined && firstPlayer.totalScore === undefined) {
        // Check if players array has isDealer/isCaller (v3.0 feature)
        if (gameData.players && gameData.players[0] && 
            (gameData.players[0].isDealer !== undefined || gameData.players[0].isCaller !== undefined)) {
          return '3.0';
        }
      }
    }
  }

  // Format 2.0 characteristics (format2.json):
  // - Has player_ids array at top level
  // - Has players with isVerified
  // - round_data includes round/cards numbers
  // - round players have totalScore
  if (gameData.player_ids && Array.isArray(gameData.player_ids) && 
      gameData.round_data && Array.isArray(gameData.round_data)) {
    const firstRound = gameData.round_data[0];
    if (firstRound && firstRound.round && firstRound.cards && firstRound.players) {
      const firstPlayer = firstRound.players[0];
      if (firstPlayer && firstPlayer.totalScore !== undefined) {
        return '2.0';
      }
    }
  }

  // Format 1.0 characteristics (format1.json):
  // - Has nested gameState object containing the actual game data
  // - gameState contains id, players, round_data, etc.
  // - Top level may have duplicate fields
  if (gameData.gameState && typeof gameData.gameState === 'object') {
    return '1.0';
  }

  return 'unknown';
}

/**
 * Migrates format 1.0 (nested gameState) to version 3.0
 * @param {Object} gameData - Format 1.0 game data
 * @returns {Object} Migrated game data in v3.0 format
 */
function migrateFromV1(gameData) {
  const state = gameData.gameState;
  
  // Extract players - try multiple locations for v1.0 format
  const rawPlayers = state.players || gameData.players || [];
  
  // Transform to v3.0 format (remove isVerified, keep essential info)
  const players = rawPlayers.map((player, idx) => ({
    id: player.id,
    name: player.name,
    isDealer: idx === 0, // First player is typically dealer in round 1
    isCaller: false
  }));

  // Transform round_data to v3.0 format (remove round/cards numbers, totalScore, name)
  const roundData = (state.round_data || state.roundData || []).map(round => ({
    players: (round.players || []).map(player => {
      const transformed = {
        id: player.id,
        made: player.made !== undefined ? player.made : 0,
        score: player.score !== undefined ? player.score : 0
      };
      
      // Only include call if defined
      if (player.call !== undefined) {
        transformed.call = player.call;
      }
      
      return transformed;
    })
  }));

  // Calculate duration if needed
  let durationSeconds = state.duration_seconds || state.durationSeconds || 0;
  if (!durationSeconds && state.created_at && state.finished_at) {
    durationSeconds = Math.floor((new Date(state.finished_at) - new Date(state.created_at)) / 1000);
  }

  // Normalize winner_id/winner_ids
  let winnerId = state.winner_ids || state.winner_id || state.winnerId || gameData.winner_ids || gameData.winner_id;
  if (winnerId && !Array.isArray(winnerId)) {
    winnerId = [winnerId];
  }

  // Build v3.0 structure
  const migrated = {
    version: CURRENT_VERSION,
    created_at: state.created_at || state.createdAt || new Date().toISOString(),
    duration_seconds: durationSeconds,
    total_rounds: state.total_rounds || state.totalRounds || state.maxRounds || roundData.length,
    players: players,
    round_data: roundData
  };

  // Add optional fields
  if (state.gameFinished !== undefined || gameData.gameFinished !== undefined) {
    migrated.gameFinished = state.gameFinished ?? gameData.gameFinished ?? true;
  }

  if (winnerId && winnerId.length > 0) {
    migrated.winner_id = winnerId;
  }

  const finalScores = state.final_scores || state.finalScores || gameData.final_scores;
  if (finalScores && Object.keys(finalScores).length > 0) {
    migrated.final_scores = finalScores;
  }

  return migrated;
}

/**
 * Migrates format 2.0 (flat with player_ids) to version 3.0
 * @param {Object} gameData - Format 2.0 game data
 * @returns {Object} Migrated game data in v3.0 format
 */
function migrateFromV2(gameData) {
  // Extract players - try multiple locations (some games have hybrid v1/v2 structure)
  let rawPlayers = gameData.players;
  
  // Fallback: check if players are in nested gameState (hybrid format)
  if (!rawPlayers || rawPlayers.length === 0) {
    rawPlayers = gameData.gameState?.players;
  }
  
  // Fallback: construct from player_ids + round_data if needed
  if (!rawPlayers || rawPlayers.length === 0) {
    if (gameData.player_ids && gameData.round_data && gameData.round_data[0]?.players) {
      const firstRoundPlayers = gameData.round_data[0].players;
      rawPlayers = gameData.player_ids.map(id => {
        const roundPlayer = firstRoundPlayers.find(p => p.id === id);
        return {
          id: id,
          name: roundPlayer?.name || 'Unknown',
          isVerified: false
        };
      });
    }
  }
  
  // Transform players to v3.0 format (remove isVerified, add isDealer/isCaller)
  const players = (rawPlayers || []).map((player, idx) => ({
    id: player.id,
    name: player.name,
    isDealer: idx === 0, // Typically first player is dealer
    isCaller: false
  }));

  // Extract round_data - check multiple locations
  const sourceRoundData = gameData.round_data || gameData.gameState?.round_data || [];
  
  // Transform round_data to v3.0 format (remove round/cards/totalScore/name)
  const roundData = sourceRoundData.map(round => ({
    players: (round.players || []).map(player => {
      const transformed = {
        id: player.id,
        made: player.made !== undefined ? player.made : 0,
        score: player.score !== undefined ? player.score : 0
      };
      
      // Only include call if defined
      if (player.call !== undefined) {
        transformed.call = player.call;
      }
      
      return transformed;
    })
  }));

  // Normalize winner_id/winner_ids - check multiple locations
  let winnerId = gameData.winner_ids || gameData.winner_id || gameData.gameState?.winner_ids || gameData.gameState?.winner_id;
  if (winnerId && !Array.isArray(winnerId)) {
    winnerId = [winnerId];
  }

  // Extract other fields - check multiple locations
  const createdAt = gameData.created_at || gameData.gameState?.created_at || new Date().toISOString();
  const durationSeconds = gameData.duration_seconds || gameData.gameState?.duration_seconds || 0;
  const totalRounds = gameData.total_rounds || gameData.gameState?.total_rounds || roundData.length;
  const finalScores = gameData.final_scores || gameData.gameState?.final_scores;

  // Build v3.0 structure
  const migrated = {
    version: CURRENT_VERSION,
    created_at: createdAt,
    duration_seconds: durationSeconds,
    total_rounds: totalRounds,
    players: players,
    round_data: roundData
  };

  // Add optional fields
  if (gameData.gameFinished !== undefined || gameData.gameState?.gameFinished !== undefined) {
    migrated.gameFinished = gameData.gameFinished ?? gameData.gameState?.gameFinished ?? true;
  }

  if (winnerId && winnerId.length > 0) {
    migrated.winner_id = winnerId;
  }

  if (finalScores && Object.keys(finalScores).length > 0) {
    migrated.final_scores = finalScores;
  }

  return migrated;
}

/**
 * Main migration function - detects format and migrates to v3.0
 * @param {Object} gameData - Game data in any format
 * @returns {{migrated: Object, originalVersion: string, needsMigration: boolean}}
 */
function migrateWizardGame(gameData) {
  const version = detectGameFormat(gameData);
  
  // Already v3.0 - ensure version field is set
  if (version === '3.0') {
    return {
      migrated: { ...gameData, version: CURRENT_VERSION },
      originalVersion: '3.0',
      needsMigration: !gameData.version // Only needs migration if version field missing
    };
  }
  
  // Migrate from v1.0
  if (version === '1.0') {
    return {
      migrated: migrateFromV1(gameData),
      originalVersion: '1.0',
      needsMigration: true
    };
  }
  
  // Migrate from v2.0
  if (version === '2.0') {
    return {
      migrated: migrateFromV2(gameData),
      originalVersion: '2.0',
      needsMigration: true
    };
  }
  
  // Unknown format - return as-is with warning
  console.warn('[Migration] Unknown game format detected:', gameData);
  return {
    migrated: gameData,
    originalVersion: 'unknown',
    needsMigration: false,
    error: 'Unknown game format - could not migrate'
  };
}

/**
 * Validates that migrated data conforms to v3.0 structure
 * @param {Object} gameData - Migrated game data
 * @returns {{isValid: boolean, errors: Array<string>}}
 */
function validateMigratedGame(gameData) {
  const errors = [];

  // Check version
  if (!gameData.version || gameData.version !== CURRENT_VERSION) {
    errors.push(`Missing or invalid version (expected ${CURRENT_VERSION})`);
  }

  // Check required fields
  if (!gameData.created_at) errors.push('Missing created_at');
  if (gameData.duration_seconds === undefined) errors.push('Missing duration_seconds');
  if (!gameData.total_rounds) errors.push('Missing total_rounds');
  if (!Array.isArray(gameData.players) || gameData.players.length < 2) {
    errors.push('Invalid players array (need at least 2)');
  }
  if (!Array.isArray(gameData.round_data) || gameData.round_data.length === 0) {
    errors.push('Invalid round_data array (need at least 1 round)');
  }

  // Validate players structure
  gameData.players?.forEach((player, idx) => {
    if (!player.id) errors.push(`Player ${idx}: missing id`);
    if (!player.name) errors.push(`Player ${idx}: missing name`);
  });

  // Validate round_data structure
  gameData.round_data?.forEach((round, roundIdx) => {
    if (!round.players || !Array.isArray(round.players)) {
      errors.push(`Round ${roundIdx}: missing players array`);
    } else {
      // Check for v3.0 compliance (no round/cards numbers)
      if (round.round !== undefined) {
        errors.push(`Round ${roundIdx}: should not have 'round' field (v2.0 format)`);
      }
      if (round.cards !== undefined) {
        errors.push(`Round ${roundIdx}: should not have 'cards' field (v2.0 format)`);
      }

      round.players.forEach((player, pIdx) => {
        if (!player.id) errors.push(`Round ${roundIdx}, Player ${pIdx}: missing id`);
        if (player.made === undefined) errors.push(`Round ${roundIdx}, Player ${pIdx}: missing made`);
        if (player.score === undefined) errors.push(`Round ${roundIdx}, Player ${pIdx}: missing score`);
        
        // Check for v2.0 fields that shouldn't be present
        if (player.totalScore !== undefined) {
          errors.push(`Round ${roundIdx}, Player ${pIdx}: should not have 'totalScore' (v2.0 format)`);
        }
        if (player.name !== undefined) {
          errors.push(`Round ${roundIdx}, Player ${pIdx}: should not have 'name' (redundant in v3.0)`);
        }
      });
    }
  });

  return {
    isValid: errors.length === 0,
    errors
  };
}

module.exports = {
  CURRENT_VERSION,
  detectGameFormat,
  migrateWizardGame,
  migrateFromV1,
  migrateFromV2,
  validateMigratedGame
};
