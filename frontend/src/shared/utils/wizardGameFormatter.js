/**
 * Wizard Game Formatter
 * Converts game data from internal format to the format expected by the backend
 */

/**
 * Formats wizard game data for backend storage
 * Converts from the internal game state format to the flat structure
 * expected by the backend schema
 * 
 * @param {Object} gameData - Game data in internal format
 * @returns {Object} - Formatted game data for backend
 */
export function formatWizardGameForBackend(gameData) {
  // Handle both direct gameData and wrapped gameState
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
  
  // Build the formatted game data
  const formatted = {
    created_at: createdAt,
    duration_seconds: durationSeconds,
    total_rounds: totalRounds,
    players: players,
    round_data: roundData
  };
  
  // Add optional fields if they exist
  if (winnerId && winnerId.length > 0) {
    formatted.winner_id = winnerId;
  }
  
  if (Object.keys(finalScores).length > 0) {
    formatted.final_scores = finalScores;
  }
  
  return formatted;
}

/**
 * Validates that a game has the minimum required data for backend submission
 * @param {Object} gameData - Game data to validate
 * @returns {{isValid: boolean, errors: Array<string>}} Validation result
 */
export function validateGameForUpload(gameData) {
  const errors = [];
  const data = gameData.gameState || gameData;
  
  // Check for players
  const players = data.players || [];
  if (players.length < 2) {
    errors.push('At least 2 players required');
  }
  
  // Check for round data
  const roundData = data.roundData || data.round_data || data.rounds || [];
  if (roundData.length === 0) {
    errors.push('At least one round of data required');
  }
  
  // Validate players have required fields
  players.forEach((player, idx) => {
    if (!player.id) errors.push(`Player ${idx}: missing id`);
    if (!player.name) errors.push(`Player ${idx}: missing name`);
  });
  
  // Validate round data structure
  roundData.forEach((round, roundIdx) => {
    if (!round.players || !Array.isArray(round.players)) {
      errors.push(`Round ${roundIdx}: missing players array`);
    } else {
      round.players.forEach((playerRound, pIdx) => {
        if (!playerRound.id) errors.push(`Round ${roundIdx}, Player ${pIdx}: missing id`);
        if (playerRound.made === undefined) errors.push(`Round ${roundIdx}, Player ${pIdx}: missing made value`);
        if (playerRound.score === undefined) errors.push(`Round ${roundIdx}, Player ${pIdx}: missing score value`);
      });
    }
  });
  
  return {
    isValid: errors.length === 0,
    errors
  };
}
