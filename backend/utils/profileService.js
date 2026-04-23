/**
 * ProfileService
 * Handles fetching and processing game data for user profiles.
 * Extracts the game processing logic from the profile route handler.
 */
const WizardGame = require('../models/WizardGame');
const TableGame = require('../models/TableGame');
const { getUserIdentityIds } = require('./identityHelpers');
const {
  getWinnerIds,
  isPlayerWinner,
  calculateTableGameScores,
  calculateWinnersByScore,
  resolveTableGameData,
  resolveTableGameLowIsBetter,
} = require('./gameHelpers');
const { MAX_PROFILE_GAMES } = require('./constants');

/**
 * Fetch and process all games for a user profile.
 *
 * @param {string} userId - The user's ObjectId
 * @returns {Object} { games, totalWins, identities, mergedGuestIdentities, primaryIdentityId }
 */
async function getProfileGames(userId) {
  const {
    identities,
    mergedGuestIdentities,
    allIdentityIds,
    gameEloMap,
  } = await getUserIdentityIds(userId);

  const identityIdStrings = allIdentityIds.map(id => id.toString());

  // Fetch games in parallel
  const [wizardGames, tableGames] = await Promise.all([
    WizardGame.find({
      'gameData.players.identityId': { $in: allIdentityIds }
    })
      .select('gameData createdAt localId userId')
      .sort({ createdAt: -1 })
      .lean(),
    TableGame.find({
      'gameData.players.identityId': { $in: allIdentityIds }
    })
      .select('gameData gameTypeName name lowIsBetter createdAt gameFinished userId')
      .sort({ createdAt: -1 })
      .lean(),
  ]);

  const allGames = [];
  const seenGameIds = new Set();
  let totalWins = 0;

  // Process wizard games
  wizardGames.forEach(game => {
    const gameData = game.gameData;
    if (!gameData || !gameData.players) return;
    if (gameData.isPaused || gameData.gameFinished === false) return;

    const gameId = gameData.gameId || game.localId || String(game._id);
    if (seenGameIds.has(gameId)) return;

    const userPlayer = gameData.players.find(p =>
      p.identityId && identityIdStrings.includes(p.identityId.toString())
    );
    if (!userPlayer) return;

    seenGameIds.add(gameId);

    const winnerIds = getWinnerIds(gameData);
    const isWinner = isPlayerWinner(userPlayer, winnerIds);
    if (isWinner) totalWins++;

    const eloInfo = gameEloMap.get(game._id.toString());

    allGames.push({
      id: game._id,
      gameType: 'wizard',
      created_at: game.createdAt,
      winner_ids: winnerIds,
      winner_id: winnerIds[0],
      eloChange: eloInfo?.change,
      eloRating: eloInfo?.rating,
      eloPlacement: eloInfo?.placement,
      gameData: {
        players: gameData.players,
        total_rounds: gameData.total_rounds,
        final_scores: gameData.final_scores,
        round_data: gameData.round_data,
        winner_ids: winnerIds,
      },
    });
  });

  // Process table games
  tableGames.forEach(game => {
    const gameData = resolveTableGameData(game);
    if (!gameData || !game.gameFinished || !gameData.players) return;

    const userPlayer = gameData.players.find(p =>
      p.identityId && identityIdStrings.includes(p.identityId.toString())
    );
    if (!userPlayer) return;

    const userPlayerIndex = gameData.players.indexOf(userPlayer);
    const finalScores = calculateTableGameScores(gameData.players);
    const lowIsBetter = resolveTableGameLowIsBetter(game);
    const calculatedWinnerIds = calculateWinnersByScore(finalScores, lowIsBetter);
    const storedWinnerIds = getWinnerIds(gameData);

    const winnerName = gameData.winner_name || game.gameData?.winner_name;
    const winnerNamesLower = winnerName ? [winnerName.toLowerCase()] : [];

    const userPlayerId = `player_${userPlayerIndex}`;
    const isWinnerByCalculation = calculatedWinnerIds.includes(userPlayerId);
    const isWinnerByStoredId = isPlayerWinner(userPlayer, storedWinnerIds);
    const isWinnerByName = userPlayer.name && winnerNamesLower.includes(userPlayer.name.toLowerCase());
    const isWinner = isWinnerByCalculation || isWinnerByStoredId || isWinnerByName;

    const winnerIds = calculatedWinnerIds.length > 0 ? calculatedWinnerIds : storedWinnerIds;
    if (isWinner) totalWins++;

    const eloInfo = gameEloMap.get(game._id.toString());
    const resolvedLowIsBetter = resolveTableGameLowIsBetter(game);

    allGames.push({
      id: game._id,
      gameType: 'table',
      gameTypeName: game.gameTypeName || game.name,
      name: game.name,
      created_at: game.createdAt,
      winner_ids: winnerIds,
      winner_id: winnerIds[0],
      lowIsBetter: resolvedLowIsBetter,
      eloChange: eloInfo?.change,
      eloRating: eloInfo?.rating,
      eloPlacement: eloInfo?.placement,
      gameData: {
        players: gameData.players,
        winner_ids: winnerIds,
        lowIsBetter: resolvedLowIsBetter,
      },
    });
  });

  // Sort and limit
  allGames.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  const limitedGames = allGames.slice(0, MAX_PROFILE_GAMES);

  return {
    games: limitedGames,
    totalWins,
    identities,
    mergedGuestIdentities,
    primaryIdentityId: identities.length > 0 ? identities[0]._id : null,
  };
}

module.exports = { getProfileGames };
