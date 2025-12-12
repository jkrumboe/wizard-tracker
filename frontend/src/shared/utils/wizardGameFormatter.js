/**
 * Wizard Game Formatter
 * Converts game data from internal format to the format expected by the backend (v3.0)
 */

const CURRENT_VERSION = '3.0';

/**
 * Formats wizard game data for backend storage
 * Converts from the internal game state format to the flat structure
 * expected by the backend schema (v3.0)
 * 
 * @param {Object} gameData - Game data in internal format or v3.0 format
 * @returns {Object} - Formatted game data for backend (v3.0)
 */
export function formatWizardGameForBackend(gameData) {
  // If it's already in v3.0 format (from local storage), just return it with minimal processing
  if (gameData.version === '3.0' && gameData.round_data && gameData.players) {
    // Already in v3.0 format, just ensure all required fields are present
    const formatted = {
      version: CURRENT_VERSION,
      created_at: gameData.created_at || new Date().toISOString(),
      duration_seconds: gameData.duration_seconds || 0,
      total_rounds: gameData.total_rounds || 0,
      players: gameData.players,
      round_data: gameData.round_data
    };
    
    // Add optional fields if they exist
    if (gameData.gameFinished !== undefined) {
      formatted.gameFinished = gameData.gameFinished;
    }
    
    if (gameData.winner_id && gameData.winner_id.length > 0) {
      formatted.winner_id = gameData.winner_id;
    }
    
    if (gameData.final_scores && Object.keys(gameData.final_scores).length > 0) {
      formatted.final_scores = gameData.final_scores;
    }
    
    return formatted;
  }
  
  // Handle both direct gameData and wrapped gameState (legacy format)
  const data = gameData.gameState || gameData;
  
  // Extract round data and convert to flat structure
  const roundData = (data.roundData || data.round_data || data.rounds || []).map(round => ({
    players: (round.players || []).map(player => {
      const formatted = {
        id: player.id,
        made: player.made !== undefined ? player.made : 0,
        score: player.score !== undefined ? player.score : 0
      };
      
      // Only include call if it's defined
      if (player.call !== undefined) {
        formatted.call = player.call;
      }
      
      return formatted;
    })
  }));
  
  // Extract players and ensure they have required fields
  const players = (data.players || []).map(player => ({
    id: player.id,
    name: player.name,
    ...(player.isVerified !== undefined && { isVerified: player.isVerified }),
    ...(player.isDealer !== undefined && { isDealer: player.isDealer }),
    ...(player.isCaller !== undefined && { isCaller: player.isCaller })
  }));
  
  // Calculate duration if not provided
  let durationSeconds = data.duration_seconds || data.durationSeconds || 0;
  if (!durationSeconds && data.created_at && data.finished_at) {
    const start = new Date(data.created_at);
    const end = new Date(data.finished_at);
    durationSeconds = Math.floor((end - start) / 1000);
  }
  
  // Normalize winner_id to array format
  let winnerId = data.winner_id || data.winnerId;
  if (winnerId && !Array.isArray(winnerId)) {
    winnerId = [winnerId];
  }
  
  // Extract final scores
  const finalScores = data.final_scores || data.finalScores || data.totals?.final_scores || {};
  
  // Get total rounds
  const totalRounds = data.total_rounds || data.totalRounds || data.maxRounds || 
                      data.totals?.total_rounds || roundData.length || 0;
  
  // Get created_at timestamp
  const createdAt = data.created_at || data.createdAt || 
                    data.referenceDate || new Date().toISOString();
  
  // Build the formatted game data (v3.0)
  const formatted = {
    version: CURRENT_VERSION,
    created_at: createdAt,
    duration_seconds: durationSeconds,
    total_rounds: totalRounds,
    players: players,
    round_data: roundData
  };
  
  // Add optional fields if they exist
  if (data.gameFinished !== undefined) {
    formatted.gameFinished = data.gameFinished;
  }
  
  if (winnerId && winnerId.length > 0) {
    formatted.winner_id = winnerId;
  }
  
  if (Object.keys(finalScores).length > 0) {
    formatted.final_scores = finalScores;
  }
  
  return formatted;
}

/**
 * Comprehensive validation for game data before upload
 * @param {Object} gameData - Game data to validate
 * @returns {{isValid: boolean, errors: Array<string>, warnings: Array<string>}} Validation result
 */
export function validateGameForUpload(gameData) {
  const errors = [];
  const warnings = [];
  const data = gameData.gameState || gameData;
  
  // Check version
  const version = data.version || (gameData.version ? gameData.version : null);
  if (!version) {
    warnings.push('No version specified - will be set to 3.0');
  } else if (version !== CURRENT_VERSION) {
    errors.push(`Invalid version: ${version} (expected ${CURRENT_VERSION})`);
  }
  
  // Check for players
  const players = data.players || [];
  if (players.length < 2) {
    errors.push('At least 2 players required');
  } else if (players.length > 10) {
    errors.push('Maximum 10 players allowed');
  }
  
  // Check for round data
  const roundData = data.roundData || data.round_data || data.rounds || [];
  if (roundData.length === 0) {
    errors.push('At least one round of data required');
  } else if (roundData.length > 60) {
    errors.push('Maximum 60 rounds allowed');
  }
  
  // Validate players have required fields
  const playerIds = new Set();
  players.forEach((player, idx) => {
    if (!player.id) {
      errors.push(`Player ${idx + 1}: missing id`);
    } else {
      if (playerIds.has(player.id)) {
        errors.push(`Player ${idx + 1}: duplicate player ID ${player.id}`);
      }
      playerIds.add(player.id);
    }
    
    if (!player.name || player.name.trim().length === 0) {
      errors.push(`Player ${idx + 1} (${player.id}): missing or empty name`);
    } else if (player.name.length > 100) {
      errors.push(`Player ${idx + 1} (${player.id}): name too long (max 100 characters)`);
    }

    // Check for v2.0 format fields that shouldn't be in v3.0
    if (player.isVerified !== undefined) {
      warnings.push(`Player ${idx + 1}: has 'isVerified' field (v2.0 format) - will be removed`);
    }
  });
  
  // Validate round data structure
  roundData.forEach((round, roundIdx) => {
    // Check for v2.0 format indicators
    if (round.round !== undefined) {
      warnings.push(`Round ${roundIdx + 1}: has 'round' field (v2.0 format) - will be removed`);
    }
    if (round.cards !== undefined) {
      warnings.push(`Round ${roundIdx + 1}: has 'cards' field (v2.0 format) - will be removed`);
    }

    if (!round.players || !Array.isArray(round.players)) {
      errors.push(`Round ${roundIdx + 1}: missing or invalid players array`);
    } else {
      // Validate player count matches
      if (round.players.length !== players.length) {
        errors.push(`Round ${roundIdx + 1}: player count mismatch (${round.players.length} vs ${players.length})`);
      }

      const roundPlayerIds = new Set();
      round.players.forEach((playerRound, pIdx) => {
        if (!playerRound.id) {
          errors.push(`Round ${roundIdx + 1}, Player ${pIdx + 1}: missing id`);
        } else {
          if (roundPlayerIds.has(playerRound.id)) {
            errors.push(`Round ${roundIdx + 1}: duplicate player ID ${playerRound.id}`);
          }
          roundPlayerIds.add(playerRound.id);

          // Verify player ID exists in players array
          if (!playerIds.has(playerRound.id)) {
            errors.push(`Round ${roundIdx + 1}, Player ${pIdx + 1}: player ID ${playerRound.id} not found in players list`);
          }
        }
        
        if (playerRound.made === undefined || playerRound.made === null) {
          errors.push(`Round ${roundIdx + 1}, Player ${pIdx + 1} (${playerRound.id}): missing 'made' value`);
        } else if (typeof playerRound.made !== 'number') {
          errors.push(`Round ${roundIdx + 1}, Player ${pIdx + 1} (${playerRound.id}): 'made' must be a number`);
        } else if (playerRound.made < 0) {
          errors.push(`Round ${roundIdx + 1}, Player ${pIdx + 1} (${playerRound.id}): 'made' cannot be negative`);
        }
        
        if (playerRound.score === undefined || playerRound.score === null) {
          errors.push(`Round ${roundIdx + 1}, Player ${pIdx + 1} (${playerRound.id}): missing 'score' value`);
        } else if (typeof playerRound.score !== 'number') {
          errors.push(`Round ${roundIdx + 1}, Player ${pIdx + 1} (${playerRound.id}): 'score' must be a number`);
        }

        // Check for v2.0 format fields
        if (playerRound.totalScore !== undefined) {
          warnings.push(`Round ${roundIdx + 1}, Player ${pIdx + 1}: has 'totalScore' (v2.0 format) - will be removed`);
        }
        if (playerRound.name !== undefined) {
          warnings.push(`Round ${roundIdx + 1}, Player ${pIdx + 1}: has 'name' field (redundant in v3.0) - will be removed`);
        }
      });
    }
  });

  // Validate created_at
  const createdAt = data.created_at || data.createdAt;
  if (!createdAt) {
    warnings.push('No created_at timestamp - will be set to current time');
  } else {
    const date = new Date(createdAt);
    if (isNaN(date.getTime())) {
      errors.push(`Invalid created_at timestamp: ${createdAt}`);
    }
  }

  // Validate duration_seconds
  const duration = data.duration_seconds || data.durationSeconds;
  if (duration === undefined) {
    warnings.push('No duration_seconds - will be set to 0');
  } else if (typeof duration !== 'number' || duration < 0) {
    errors.push('duration_seconds must be a non-negative number');
  }

  // Validate total_rounds
  const totalRounds = data.total_rounds || data.totalRounds || data.maxRounds;
  if (!totalRounds) {
    warnings.push('No total_rounds - will be inferred from round data length');
  } else if (typeof totalRounds !== 'number' || totalRounds < 1 || totalRounds > 60) {
    errors.push('total_rounds must be between 1 and 60');
  }

  // Validate optional winner_id
  const winnerId = data.winner_id || data.winnerId;
  if (winnerId) {
    const winnerIds = Array.isArray(winnerId) ? winnerId : [winnerId];
    winnerIds.forEach(id => {
      if (!playerIds.has(id)) {
        errors.push(`winner_id '${id}' not found in players list`);
      }
    });
  }

  // Validate optional final_scores
  const finalScores = data.final_scores || data.finalScores;
  if (finalScores) {
    Object.keys(finalScores).forEach(playerId => {
      if (!playerIds.has(playerId)) {
        errors.push(`final_scores contains unknown player ID: ${playerId}`);
      }
      if (typeof finalScores[playerId] !== 'number') {
        errors.push(`final_scores for player ${playerId} must be a number`);
      }
    });
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}
