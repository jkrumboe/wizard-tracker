/**
 * Deduplication for game history lists.
 *
 * The games list is built from several sources that describe the same game with
 * different shapes and different ids:
 *   - cloud wizard games      -> { id: cloudId, cloudId, localId }
 *   - cloud table games       -> { id: cloudId, cloudId, localId }
 *   - local wizard games      -> { id: localId, cloudGameId }
 *   - local table/scoreboard  -> { id: localId, cloudGameId }
 *
 * A game is the same game when ANY of its identifiers overlap, and - when the id
 * link is missing (upload rejected as duplicate, game downloaded under a new local
 * id, game uploaded from another device) - when its content matches.
 */

const normalizeId = (value) => {
  if (typeof value === 'string') return value.trim();
  if (value === null || value === undefined) return '';
  return String(value).trim();
};

const isTableLike = (game) =>
  game?.gameType === 'table'
  || game?.gameType === 'scoreboard'
  || game?.storageType === 'scoreboard'
  || game?.id?.startsWith?.('scoreboard_game_')
  || game?.id?.startsWith?.('table_game_');

/**
 * All identifiers a game entry is known by.
 * @param {Object} game
 * @returns {string[]} unique, non-empty identifiers
 */
export function getGameIdentityKeys(game) {
  if (!game) return [];
  const keys = [game.id, game.cloudId, game.cloudGameId, game.localId, game.gameState?.cloudGameId]
    .map(normalizeId)
    .filter(Boolean);
  return [...new Set(keys)];
}

const getPlayerNames = (game) => {
  const players = game?.players
    || game?.gameData?.players
    || game?.gameData?.gameData?.players
    || game?.gameState?.players
    || [];
  if (!Array.isArray(players)) return '';
  const names = players
    .map(player => (typeof player === 'string' ? player : player?.name))
    .filter(Boolean)
    .map(name => String(name).trim().toLowerCase());
  names.sort((a, b) => a.localeCompare(b));
  return names.join('|');
};

const getTotalRounds = (game) =>
  Number(game?.total_rounds ?? game?.totalRounds ?? game?.gameData?.total_rounds ?? game?.gameState?.maxRounds ?? 0) || 0;

/**
 * Sorted list of the final score values - the strong part of the fingerprint.
 * Wizard games carry final_scores, table games only carry per-player point columns.
 */
const getScoreSignature = (game) => {
  const finalScores = game?.final_scores
    || game?.gameData?.final_scores
    || game?.gameData?.totals?.final_scores
    || game?.gameState?.final_scores;

  if (finalScores && typeof finalScores === 'object') {
    const values = Object.values(finalScores)
      .map(Number)
      .filter(value => Number.isFinite(value));
    if (values.length > 0) {
      values.sort((a, b) => a - b);
      return values.join(',');
    }
  }

  const players = game?.gameData?.gameData?.players || game?.gameData?.players || game?.players;
  if (Array.isArray(players)) {
    const totals = players
      .filter(player => player && Array.isArray(player.points))
      .map(player => player.points.reduce((sum, point) => sum + (Number.parseInt(point, 10) || 0), 0));
    if (totals.length > 0) {
      totals.sort((a, b) => a - b);
      return totals.join(',');
    }
  }

  return '';
};

const getTimeKey = (game) => {
  const raw = game?.created_at || game?.lastPlayed || game?.savedAt;
  if (!raw) return '';
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString();
};

/**
 * Content fingerprint of a game, or null when the entry does not carry enough data
 * to be matched safely by content.
 *
 * Timestamps are deliberately left out of the wizard key: the cloud list reports
 * the play time while local storage may report the save time, so the two do not
 * line up to the second.
 *
 * @param {Object} game
 * @returns {string|null}
 */
export function getGameContentKey(game) {
  if (!game) return null;

  const playerNames = getPlayerNames(game);
  if (!playerNames) return null;

  const rounds = getTotalRounds(game);
  const scores = getScoreSignature(game);

  if (isTableLike(game)) {
    // Table games are matched on the exact start time: names like "Team 1"/"Team 2"
    // with few rounds repeat across an evening, and two such games must not be
    // mistaken for one. A copy of the same game carries the same timestamp.
    const time = getTimeKey(game);
    if (!time) return null;
    const name = String(game.name || game.gameTypeName || '').trim().toLowerCase();
    const winner = String(game.winner_name || '').trim().toLowerCase();
    return `table|${name}|${playerNames}|${rounds}|${scores}|${winner}|${time}`;
  }

  // Player names + round count + every final score is a strong wizard fingerprint.
  // An unplayed or unscored game carries no such signal, so skip content matching.
  if (!scores || rounds <= 0) return null;
  return `wizard|${playerNames}|${rounds}|${scores}`;
}

/**
 * Table fingerprints are weaker than wizard ones (the list payloads carry no
 * per-round scores), so they may only collapse a local entry into a cloud entry -
 * never two entries from the same source, which would hide a genuine rematch.
 */
const canMergeByContent = (existing, candidate) => {
  if (!isTableLike(existing) && !isTableLike(candidate)) return true;
  return Boolean(existing.isCloud) !== Boolean(candidate.isCloud);
};

const pickWinnerName = (...names) =>
  names.find(name => name && name !== 'Not determined') || names.find(Boolean);

/**
 * Merge a duplicate entry into the one already kept. The kept entry wins for every
 * field it defines; the duplicate fills the gaps and contributes its identifiers
 * and sync flags.
 * @param {Object} base - entry kept in the list
 * @param {Object} extra - duplicate found later
 * @returns {Object} merged entry
 */
export function mergeGameEntries(base, extra) {
  const merged = { ...base };

  Object.keys(extra).forEach(key => {
    if (merged[key] === undefined || merged[key] === null || merged[key] === '') {
      merged[key] = extra[key];
    }
  });

  merged.id = base.id;
  merged.cloudId = normalizeId(base.cloudId || extra.cloudId || base.cloudGameId || extra.cloudGameId) || undefined;
  merged.cloudGameId = merged.cloudId;
  merged.localId = normalizeId(
    base.localId || extra.localId || (base.isLocal ? base.id : '') || (extra.isLocal ? extra.id : '')
  ) || undefined;

  merged.isCloud = Boolean(base.isCloud || extra.isCloud);
  merged.isLocal = Boolean(base.isLocal || extra.isLocal);
  merged.isUploaded = Boolean(base.isUploaded || extra.isUploaded || merged.cloudId);
  merged.gameFinished = Boolean(base.gameFinished || extra.gameFinished);

  const winnerName = pickWinnerName(base.winner_name, extra.winner_name);
  if (winnerName) merged.winner_name = winnerName;

  return merged;
}

/**
 * Collapse duplicate entries of the same game, keeping the first occurrence.
 * Callers control precedence by ordering the input (cloud entries first keeps the
 * cloud id for navigation, local entries first keeps the local one).
 * @param {Array<Object>} games
 * @returns {Array<Object>} deduplicated games
 */
export function dedupeGames(games) {
  if (!Array.isArray(games)) return [];

  const result = [];
  const indexByIdentity = new Map();
  const indicesByContent = new Map();

  const registerIdentities = (index) => {
    getGameIdentityKeys(result[index]).forEach(key => {
      if (!indexByIdentity.has(key)) indexByIdentity.set(key, index);
    });
  };

  const findByIdentity = (game) => {
    const key = getGameIdentityKeys(game).find(identity => indexByIdentity.has(identity));
    return key === undefined ? -1 : indexByIdentity.get(key);
  };

  const findByContent = (game, contentKey) => {
    if (!contentKey) return -1;
    const candidates = indicesByContent.get(contentKey) || [];
    const match = candidates.find(index => canMergeByContent(result[index], game));
    return match === undefined ? -1 : match;
  };

  for (const game of games) {
    if (!game) continue;

    const contentKey = getGameContentKey(game);
    let targetIndex = findByIdentity(game);
    if (targetIndex === -1) targetIndex = findByContent(game, contentKey);

    if (targetIndex === -1) {
      result.push({ ...game });
      targetIndex = result.length - 1;
    } else {
      result[targetIndex] = mergeGameEntries(result[targetIndex], game);
    }

    registerIdentities(targetIndex);

    if (contentKey) {
      const indices = indicesByContent.get(contentKey) || [];
      if (!indices.includes(targetIndex)) indices.push(targetIndex);
      indicesByContent.set(contentKey, indices);
    }
  }

  return result;
}

export default {
  getGameIdentityKeys,
  getGameContentKey,
  mergeGameEntries,
  dedupeGames
};
