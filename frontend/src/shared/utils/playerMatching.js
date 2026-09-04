/**
 * Player matching utilities.
 *
 * Figuring out "which player in this game is me" used to be duplicated across
 * every stats screen, and each copy compared fields that are frequently
 * undefined on both sides, e.g.:
 *
 *   String(player.userId) === String(user._id)   // "undefined" === "undefined"
 *   player.identityId === currentPlayer.identityId
 *
 * Table game players carry no `userId`, and the user object handed to the stats
 * screens has no `_id`/`identityId`, so those comparisons were true for the
 * FIRST player of every game - which attributed that player's wins and scores
 * to whoever was looking at the page.
 *
 * Everything here only compares values that are actually present, and resolves
 * in a fixed priority order (identity id -> user/player id -> name) so a weak
 * match on an early player can never beat a strong match on a later one.
 */

/**
 * Normalize an id-ish value to a comparable string, or null when it carries no
 * information. Guards against the "undefined"/"null" strings that String() on a
 * missing field produces.
 */
const toIdKey = (value) => {
  if (value === null || value === undefined) return null;
  if (typeof value === 'object') {
    // Mongo ObjectId / populated document
    const raw = value._id ?? value.id ?? value.toString?.();
    return typeof raw === 'object' ? null : toIdKey(raw);
  }
  const str = String(value).trim();
  if (!str || str === 'undefined' || str === 'null' || str === '[object Object]') return null;
  return str;
};

const toNameKey = (value) =>
  typeof value === 'string' && value.trim() ? value.trim().toLowerCase() : null;

/** Identities come back either as plain display names or as identity objects. */
const identityDisplayName = (identity) =>
  typeof identity === 'string' ? identity : identity?.displayName || identity?.name;

const identityIdOf = (identity) =>
  typeof identity === 'string' ? null : identity?._id ?? identity?.id ?? identity?.identityId;

const asArray = (value) =>
  Array.isArray(value) ? value : value === undefined || value === null ? [] : [value];

const collectIdKeys = (values) => {
  const set = new Set();
  values.forEach((value) => {
    const key = toIdKey(value);
    if (key) set.add(key);
  });
  return set;
};

/**
 * Build a matcher for the given user/profile object.
 *
 * Identity sources read from `user`:
 *   - identityIds: []          (authoritative, from the profile API)
 *   - primaryIdentityId / identityId
 *   - identities: []           (display names or identity objects)
 *   - id / _id / $id / userId  (account ids)
 *   - username / name
 *
 * @param {Object|null} user
 * @returns {{ hasIdentifiers: boolean, matches: Function, findIndex: Function, findPlayer: Function }}
 */
export const createPlayerMatcher = (user) => {
  const identityList = asArray(user?.identities);

  const identityIds = collectIdKeys([
    ...asArray(user?.identityIds),
    user?.primaryIdentityId,
    user?.identityId,
    ...identityList.map(identityIdOf),
  ]);

  const userIds = collectIdKeys([user?.id, user?._id, user?.$id, user?.userId]);

  const names = new Set();
  [user?.username, user?.name, ...identityList.map(identityDisplayName)].forEach((value) => {
    const key = toNameKey(value);
    if (key) names.add(key);
  });

  const matchesIdentity = (player) => {
    const key = toIdKey(player?.identityId);
    return !!key && identityIds.has(key);
  };

  const matchesId = (player) =>
    [player?.userId, player?.id, player?.originalId].some((value) => {
      const key = toIdKey(value);
      return !!key && userIds.has(key);
    });

  const matchesName = (player) =>
    [player?.name, player?.username].some((value) => {
      const key = toNameKey(value);
      return !!key && names.has(key);
    });

  // Strongest signal first: a name collision on player 0 must never outrank an
  // identity match on player 3.
  const strategies = [matchesIdentity, matchesId, matchesName];

  const hasIdentifiers = identityIds.size > 0 || userIds.size > 0 || names.size > 0;

  const findIndex = (players) => {
    if (!hasIdentifiers || !Array.isArray(players) || players.length === 0) return -1;
    for (const strategy of strategies) {
      const index = players.findIndex(strategy);
      if (index !== -1) return index;
    }
    return -1;
  };

  return {
    hasIdentifiers,
    matches: (player) => hasIdentifiers && strategies.some((strategy) => strategy(player)),
    findIndex,
    findPlayer: (players) => {
      const index = findIndex(players);
      return index === -1 ? null : players[index];
    },
  };
};

/**
 * Players live in a different place depending on where the game came from.
 * Local table game summaries also carry a `players` array of plain display
 * names, which is not a player list for our purposes - only object entries
 * count.
 */
const asPlayerList = (players) =>
  Array.isArray(players) && players.every((p) => p && typeof p === 'object') && players.length > 0
    ? players
    : null;

export const getGamePlayers = (game) =>
  asPlayerList(game?.gameData?.players) ||
  asPlayerList(game?.gameData?.gameData?.players) ||
  asPlayerList(game?.players) ||
  asPlayerList(game?.gameState?.players);

export const isTableGame = (game) =>
  game?.gameType === 'table' || game?.gameType === 'scoreboard';

export const isLowIsBetter = (game) =>
  Boolean(
    game?.lowIsBetter ||
      game?.gameData?.lowIsBetter ||
      game?.gameData?.gameData?.lowIsBetter ||
      false
  );

/** Collect winner ids from every shape the payloads use, normalized to strings. */
export const getWinnerIds = (game) => {
  const raw =
    game?.winner_ids ||
    game?.gameData?.winner_ids ||
    game?.gameData?.gameData?.winner_ids ||
    game?.gameData?.totals?.winner_ids ||
    game?.gameState?.winner_ids ||
    game?.winner_id ||
    game?.gameData?.winner_id ||
    game?.gameData?.totals?.winner_id ||
    game?.gameState?.winner_id;

  return [...collectIdKeys(asArray(raw))];
};

const getWinnerIdentityIds = (game) =>
  collectIdKeys(
    asArray(
      game?.winner_identityIds ||
        game?.gameData?.winner_identityIds ||
        game?.gameData?.gameData?.winner_identityIds ||
        game?.winner_identityId ||
        game?.gameData?.winner_identityId ||
        game?.gameData?.gameData?.winner_identityId
    )
  );

const getWinnerNames = (game) => {
  const names = new Set();
  asArray(
    game?.winner_names ||
      game?.gameData?.winner_names ||
      game?.winner_name ||
      game?.gameData?.winner_name ||
      game?.gameData?.gameData?.winner_name
  ).forEach((value) => {
    const key = toNameKey(value);
    if (key) names.add(key);
  });
  return names;
};

const getFinalScores = (game) =>
  game?.final_scores ||
  game?.gameData?.final_scores ||
  game?.gameData?.totals?.final_scores ||
  game?.gameState?.final_scores ||
  null;

/**
 * Total score for a single player, in the game's own scale.
 * Returns null when the game carries no score for that player.
 */
export const getPlayerScore = (game, players, index) => {
  const player = players?.[index];
  if (!player) return null;

  if (Array.isArray(player.points)) {
    return player.points.reduce((sum, point) => {
      const parsed = parseFloat(point);
      return sum + (Number.isNaN(parsed) ? 0 : parsed);
    }, 0);
  }

  if (typeof player.totalScore === 'number') return player.totalScore;
  if (typeof player.score === 'number') return player.score;

  const finalScores = getFinalScores(game);
  if (finalScores && typeof finalScores === 'object') {
    // final_scores is keyed by player id in newer payloads and by name in older
    // ones; positional keys only as a last resort.
    const candidates = [player.id, player.originalId, player.name, `player_${index}`];
    for (const candidate of candidates) {
      const key = toIdKey(candidate);
      if (key && finalScores[key] !== undefined) {
        const parsed = parseFloat(finalScores[key]);
        if (!Number.isNaN(parsed)) return parsed;
      }
    }
  }

  return null;
};

const winnerByScore = (game, players, index) => {
  if (players.length === 0) return null;
  const scores = players.map((_, i) => getPlayerScore(game, players, i));
  if (scores.some((score) => score === null)) return null;

  const target = isLowIsBetter(game) ? Math.min(...scores) : Math.max(...scores);
  return scores[index] === target;
};

/**
 * Did the player at `index` win this game?
 *
 * Winner ids arrive in two different id spaces: the players' own ids
 * ("abc-123", or "player_0" as stored by the client) and positional ids the API
 * calculates from the players array. Mixing them is what let one player's win
 * land on another, so the space is decided once, up front, and only ids from
 * the matching space are compared.
 *
 * @returns {boolean|null} null when the game carries no usable result data.
 */
export const didPlayerWin = (game, players, index) => {
  if (!Array.isArray(players) || index < 0 || index >= players.length) return null;
  const player = players[index];

  // 1. Identity-based winners are unambiguous.
  const winnerIdentityIds = getWinnerIdentityIds(game);
  if (winnerIdentityIds.size > 0) {
    const playerIdentityId = toIdKey(player?.identityId);
    if (playerIdentityId) return winnerIdentityIds.has(playerIdentityId);
  }

  // 2. Winner ids - resolved within a single id space.
  const winnerIds = new Set(getWinnerIds(game));
  if (winnerIds.size > 0) {
    const ownIdKeys = collectIdKeys([player?.id, player?.originalId]);
    const playerIdSpace = collectIdKeys(players.flatMap((p) => [p?.id, p?.originalId]));
    const usesPlayerIds = [...winnerIds].some((id) => playerIdSpace.has(id));

    if (usesPlayerIds) {
      if (ownIdKeys.size > 0) return [...ownIdKeys].some((id) => winnerIds.has(id));
    } else if ([...winnerIds].some((id) => /^player_\d+$/.test(id))) {
      // Positional ids calculated by the API against this same players array.
      return winnerIds.has(`player_${index}`);
    }
  }

  // 3. Legacy payloads only recorded the winner's display name.
  const winnerNames = getWinnerNames(game);
  if (winnerNames.size > 0) {
    const playerName = toNameKey(player?.name);
    if (playerName) return winnerNames.has(playerName);
  }

  // 4. Last resort: derive it from the scores.
  return winnerByScore(game, players, index);
};

/**
 * Resolve the current user's participation in a game.
 *
 * Prefers the result the API already calculated (it matches on identity ids,
 * including merged guest identities, which the client cannot always do) and
 * falls back to local resolution for games that never left the device.
 *
 * @param {Object} game
 * @param {ReturnType<createPlayerMatcher>} matcher
 * @returns {{ playerIndex: number, player: Object|null, won: boolean|null }}
 */
export const resolveUserGameResult = (game, matcher) => {
  const players = getGamePlayers(game);
  if (!players) return { playerIndex: -1, player: null, won: null };

  const apiIndex =
    typeof game?.userPlayerIndex === 'number' &&
    game.userPlayerIndex >= 0 &&
    game.userPlayerIndex < players.length
      ? game.userPlayerIndex
      : -1;

  const playerIndex = apiIndex !== -1 ? apiIndex : matcher.findIndex(players);
  if (playerIndex === -1) return { playerIndex: -1, player: null, won: null };

  const won =
    apiIndex !== -1 && typeof game?.userWon === 'boolean'
      ? game.userWon
      : didPlayerWin(game, players, playerIndex);

  return { playerIndex, player: players[playerIndex], won };
};

export default createPlayerMatcher;
