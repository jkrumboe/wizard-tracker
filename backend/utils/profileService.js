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
  resolveTableGameData,
  resolveTableGameLowIsBetter,
  isTableGameFinished,
  getTableGameResult,
} = require('./gameHelpers');
const { MAX_PROFILE_GAMES } = require('./constants');

/**
 * Fetch and process all games for a user profile.
 *
 * @param {string} userId - The user's ObjectId
 * @returns {Object} { games, totalGames, totalWins, identities, mergedGuestIdentities, primaryIdentityId }
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
      // Authoritative answer to "which player is this profile, and did they
      // win?" - resolved here by identity id so clients never have to guess.
      userPlayerIndex: gameData.players.indexOf(userPlayer),
      userWon: isWinner,
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
    if (!gameData || !isTableGameFinished(game) || !gameData.players) return;

    const userPlayer = gameData.players.find(p =>
      p.identityId && identityIdStrings.includes(p.identityId.toString())
    );
    if (!userPlayer) return;

    const userPlayerIndex = gameData.players.indexOf(userPlayer);
    // Scores decide the winner; stored winner ids/names only when there are none
    const { winnerIds, isWinner: didWin } = getTableGameResult(game, gameData);
    const isWinner = didWin(userPlayer, userPlayerIndex);
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
      // See the wizard branch: the profile's own player and result, resolved
      // by identity id rather than by name or list position.
      userPlayerIndex,
      userWon: isWinner,
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
    // Counted before the MAX_PROFILE_GAMES cut, like totalWins, so the two
    // always describe the same set of games
    totalGames: allGames.length,
    totalWins,
    identities,
    mergedGuestIdentities,
    primaryIdentityId: identities.length > 0 ? identities[0]._id : null,
    // Every identity that belongs to this profile, including merged guests, so
    // the client can match players on identity instead of on display name.
    identityIds: identityIdStrings,
  };
}

module.exports = { getProfileGames };
