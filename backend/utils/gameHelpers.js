/**
 * Game utility helpers shared across routes.
 * Eliminates duplicated winner normalization and score calculation logic.
 */

/**
 * Normalize winner ID(s) from various formats into a consistent array.
 * Handles: single string, array, nested in totals, null/undefined.
 *
 * @param {Object} gameData - Game data object (may have winner_id, winner_ids, totals)
 * @returns {string[]} Array of winner IDs
 */
function getWinnerIds(gameData) {
  if (!gameData) return [];

  const raw = gameData.winner_ids
    || gameData.winner_id
    || gameData.totals?.winner_ids
    || gameData.totals?.winner_id;

  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  return [raw];
}

/**
 * Check if a player is among the winners.
 * Handles comparison of both player.id and player.originalId against winner IDs.
 *
 * @param {Object} player - Player object with id and optional originalId
 * @param {string[]} winnerIds - Array of winner ID strings
 * @returns {boolean}
 */
function isPlayerWinner(player, winnerIds) {
  if (!player || !winnerIds || winnerIds.length === 0) return false;

  const playerId = player.id;
  const originalId = player.originalId;

  return winnerIds.includes(playerId)
    || winnerIds.some(id => String(id) === String(playerId))
    || (originalId && winnerIds.includes(originalId))
    || (originalId && winnerIds.some(id => String(id) === String(originalId)));
}

/**
 * Calculate final scores from a table game's player points arrays.
 * Table games store points as arrays per player, not as a final_scores object.
 *
 * @param {Object[]} players - Array of player objects with .points arrays
 * @returns {Object} Map of "player_<index>" -> total score
 */
function calculateTableGameScores(players) {
  const finalScores = {};
  if (!players || !Array.isArray(players)) return finalScores;

  players.forEach((player, index) => {
    const playerId = `player_${index}`;
    const points = player.points || [];
    const totalScore = points.reduce((sum, p) => {
      const parsed = parseFloat(p);
      return sum + (isNaN(parsed) ? 0 : parsed);
    }, 0);
    finalScores[playerId] = totalScore;
  });

  return finalScores;
}

/**
 * Determine winner player IDs based on scores and lowIsBetter flag.
 * Supports ties (multiple winners).
 *
 * @param {Object} finalScores - Map of playerId -> score
 * @param {boolean} lowIsBetter - Whether lower score wins
 * @returns {string[]} Array of winner player IDs
 */
function calculateWinnersByScore(finalScores, lowIsBetter = false) {
  const entries = Object.entries(finalScores);
  if (entries.length === 0) return [];

  const scores = entries.map(([, score]) => score);
  const targetScore = lowIsBetter
    ? Math.min(...scores)
    : Math.max(...scores);

  return entries
    .filter(([, score]) => score === targetScore)
    .map(([playerId]) => playerId);
}

/**
 * Resolve the lowIsBetter flag from the various places it can be stored
 * in a table game's nested data structure.
 *
 * @param {Object} game - Table game document
 * @returns {boolean}
 */
function resolveTableGameLowIsBetter(game) {
  return game.lowIsBetter
    || game.gameData?.lowIsBetter
    || game.gameData?.gameData?.lowIsBetter
    || false;
}

/**
 * Get the inner gameData from a table game (handles nested gameData.gameData structure).
 *
 * @param {Object} game - Table game document
 * @returns {Object|null} The resolved inner game data, or null
 */
function resolveTableGameData(game) {
  const outer = game.gameData;
  if (!outer) return null;
  return outer.gameData || outer;
}

module.exports = {
  getWinnerIds,
  isPlayerWinner,
  calculateTableGameScores,
  calculateWinnersByScore,
  resolveTableGameLowIsBetter,
  resolveTableGameData,
};
