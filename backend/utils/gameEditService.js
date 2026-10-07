/**
 * Game Edit Service
 *
 * Lets an admin correct a stored game after the fact: fix a misspelled player
 * name (relinking that player to the right PlayerIdentity), and correct calls,
 * tricks and scores. Everything derived from the game is then brought back in
 * line - final scores, winners, ELO, identity stats and the leaderboard cache.
 *
 * Players are always relinked by identity, never by name alone: the leaderboard,
 * profiles and ELO all key on `gameData.players[].identityId`, so renaming
 * "Mates" to "Mattes" moves the game onto Mattes' identity. A guest identity that
 * is left without any game afterwards is retired so the typo disappears.
 *
 * The pure helpers (apply*Edits, compute*) do no I/O and are unit tested in
 * tests/gameEditService.test.js.
 */
const mongoose = require('mongoose');
const { calculateTableGameScores, calculateWinnersByScore, resolveTableGameLowIsBetter } = require('./gameHelpers');

const WIZARD_FORMULA = { baseCorrect: 20, bonusPerTrick: 10, penaltyPerDiff: -10 };
const MAX_NAME_LENGTH = 50;

class GameEditError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.name = 'GameEditError';
    this.status = status;
  }
}

const idString = (value) => (value === null || value === undefined ? null : String(value));

const toObjectId = (value) => {
  if (!value) return null;
  if (value instanceof mongoose.Types.ObjectId) return value;
  return new mongoose.Types.ObjectId(String(value));
};

/**
 * Parse an optional integer input (call/made). Empty values stay null.
 */
function parseOptionalInt(value, label) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  if (!Number.isInteger(number) || number < 0 || number > 60) {
    throw new GameEditError(`${label} must be a whole number between 0 and 60`);
  }
  return number;
}

function parseOptionalNumber(value, label) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  if (!Number.isFinite(number)) {
    throw new GameEditError(`${label} must be a number`);
  }
  return number;
}

function wizardRoundScore(call, made) {
  if (call === null || made === null) return null;
  if (call === made) return WIZARD_FORMULA.baseCorrect + made * WIZARD_FORMULA.bonusPerTrick;
  return WIZARD_FORMULA.penaltyPerDiff * Math.abs(call - made);
}

/**
 * Validate a requested player name.
 */
function cleanName(name, label) {
  if (typeof name !== 'string' || !name.trim()) {
    throw new GameEditError(`${label}: name is required`);
  }
  const trimmed = name.trim();
  if (trimmed.length > MAX_NAME_LENGTH) {
    throw new GameEditError(`${label}: name cannot exceed ${MAX_NAME_LENGTH} characters`);
  }
  return trimmed;
}

/**
 * Sum the round scores of a wizard game per player.
 * @returns {Object} playerId -> total
 */
function computeWizardFinalScores(gameData) {
  const totals = {};
  (gameData.players || []).forEach(player => { totals[player.id] = 0; });
  (gameData.round_data || []).forEach(round => {
    (round?.players || []).forEach(roundPlayer => {
      if (!(roundPlayer.id in totals)) return;
      const score = Number(roundPlayer.score);
      if (Number.isFinite(score)) totals[roundPlayer.id] += score;
    });
  });
  return totals;
}

/**
 * Apply round edits to a wizard game's gameData (returns a new object).
 *
 * @param {Object} gameData - current v3.0 gameData
 * @param {Array} rounds - [{ players: [{ id, call, made, score }] }], same length as round_data
 */
function applyWizardRoundEdits(gameData, rounds) {
  if (!Array.isArray(rounds)) return gameData;

  const existingRounds = gameData.round_data || [];
  if (rounds.length !== existingRounds.length) {
    throw new GameEditError('Rounds cannot be added or removed, only corrected');
  }

  const playerIds = new Set((gameData.players || []).map(player => String(player.id)));

  const roundData = existingRounds.map((round, roundIndex) => {
    const edit = rounds[roundIndex];
    if (!edit || !Array.isArray(edit.players)) return round;

    const editsById = new Map(edit.players.map(player => [String(player.id), player]));
    for (const id of editsById.keys()) {
      if (!playerIds.has(id)) {
        throw new GameEditError(`Round ${roundIndex + 1}: unknown player id ${id}`);
      }
    }

    return {
      ...round,
      players: (round.players || []).map(roundPlayer => {
        const change = editsById.get(String(roundPlayer.id));
        if (!change) return roundPlayer;

        const label = `Round ${roundIndex + 1}`;
        const call = parseOptionalInt(change.call, `${label} call`);
        const made = parseOptionalInt(change.made, `${label} tricks made`);
        const explicitScore = parseOptionalNumber(change.score, `${label} score`);
        const score = explicitScore ?? wizardRoundScore(call, made);

        const updated = { ...roundPlayer, made, score };
        if (call === null) {
          delete updated.call;
        } else {
          updated.call = call;
        }
        return updated;
      })
    };
  });

  return { ...gameData, round_data: roundData };
}

/**
 * Recompute final_scores and winners of a wizard game from its rounds.
 * Winners are only (re)written for finished games so an in-progress game
 * does not suddenly get a winner.
 */
function recomputeWizardResults(gameData) {
  const finalScores = computeWizardFinalScores(gameData);
  const next = { ...gameData, final_scores: finalScores };

  if (next.totals && typeof next.totals === 'object' && next.totals.final_scores) {
    next.totals = { ...next.totals, final_scores: finalScores };
  }

  const finished = next.gameFinished === true
    || Boolean(next.winner_id && [].concat(next.winner_id).length > 0)
    || Boolean(next.winner_ids && [].concat(next.winner_ids).length > 0);

  if (finished && Object.keys(finalScores).length > 0) {
    const winners = calculateWinnersByScore(finalScores, false);
    next.winner_id = winners;
    if ('winner_ids' in next) next.winner_ids = winners;
    if (next.totals && typeof next.totals === 'object') {
      if ('winner_id' in next.totals) next.totals = { ...next.totals, winner_id: winners };
      if ('winner_ids' in next.totals) next.totals = { ...next.totals, winner_ids: winners };
    }
  }

  return next;
}

/**
 * Apply point edits to a table game's inner gameData (returns a new object).
 *
 * @param {Object} gameData - inner table gameData (players with points arrays)
 * @param {Array} playerEdits - [{ index, points? }]
 */
function applyTablePointEdits(gameData, playerEdits) {
  if (!Array.isArray(playerEdits)) return gameData;

  const players = (gameData.players || []).map((player, index) => {
    const edit = playerEdits.find(candidate => Number(candidate.index) === index);
    if (!edit || !Array.isArray(edit.points)) return player;

    // Empty cells are stored as "" like the table game screen does
    const points = edit.points.map((value, rowIndex) => {
      const parsed = parseOptionalNumber(value, `${player.name || `Player ${index + 1}`} row ${rowIndex + 1}`);
      return parsed === null ? '' : parsed;
    });
    return { ...player, points };
  });

  return { ...gameData, players };
}

/**
 * Recompute the winner fields of a table game from its point columns.
 */
function recomputeTableResults(gameData, lowIsBetter) {
  if (!gameData.gameFinished) return gameData;

  const players = gameData.players || [];
  const finalScores = calculateTableGameScores(players);
  const winnerKeys = calculateWinnersByScore(finalScores, lowIsBetter);
  const winners = winnerKeys
    .map(key => players[Number(key.replace('player_', ''))])
    .filter(Boolean);

  const winnerIds = winners.map((player, i) => player.id || player.originalId || winnerKeys[i]);
  const winnerIdentityIds = winners.map(player => player.identityId).filter(Boolean);

  const next = {
    ...gameData,
    winner_ids: winnerIds,
    winner_id: winnerIds[0] || null,
    winner_name: winners[0]?.name || null
  };
  if (winnerIdentityIds.length > 0) {
    next.winner_identityIds = winnerIdentityIds;
    next.winner_identityId = winnerIdentityIds.length === 1 ? winnerIdentityIds[0] : null;
  }
  return next;
}

/**
 * Follow the mergedInto chain to the canonical identity.
 */
async function resolveCanonicalIdentity(identity) {
  const PlayerIdentity = mongoose.model('PlayerIdentity');
  const visited = new Set();
  let current = identity;
  while (current?.mergedInto && !visited.has(String(current._id))) {
    visited.add(String(current._id));
    const target = await PlayerIdentity.findById(current.mergedInto);
    if (!target) break;
    current = target;
  }
  return current;
}

/**
 * Decide which identity a (possibly renamed) player belongs to.
 *
 * - An explicitly chosen identityId wins.
 * - An unchanged name keeps the current link.
 * - A changed name links to the existing identity with that name or alias,
 *   or creates a new guest identity.
 *
 * @returns {Promise<{ identity, name, created }>}
 */
async function resolvePlayerIdentity({ requestedName, requestedIdentityId, currentName, currentIdentityId, adminId }) {
  const PlayerIdentity = mongoose.model('PlayerIdentity');

  if (requestedIdentityId) {
    if (!mongoose.Types.ObjectId.isValid(requestedIdentityId)) {
      throw new GameEditError('Invalid identity id');
    }
    const chosen = await PlayerIdentity.findOne({ _id: { $eq: requestedIdentityId }, isDeleted: false });
    if (!chosen) throw new GameEditError('Selected player no longer exists', 404);
    const canonical = await resolveCanonicalIdentity(chosen);
    return { identity: canonical, name: requestedName || canonical.displayName, created: false };
  }

  if (currentIdentityId && requestedName === currentName) {
    const current = await PlayerIdentity.findById(currentIdentityId);
    if (current) return { identity: current, name: requestedName, created: false };
  }

  const existing = await PlayerIdentity.findByName(requestedName);
  if (existing) return { identity: existing, name: requestedName, created: false };

  const created = await PlayerIdentity.findOrCreateByName(requestedName, { createdBy: adminId, type: 'guest' });
  return { identity: created, name: requestedName, created: true };
}

/**
 * Resolve the edited player list of either game type.
 *
 * @param {Array} players - current players of the game
 * @param {Array} edits - [{ key, name, identityId }] where key matches getKey(player, index)
 * @param {Function} getKey - (player, index) => string
 * @returns {Promise<{ players, changes }>}
 */
async function resolvePlayerEdits(players, edits, getKey, adminId) {
  if (!Array.isArray(edits)) return { players, changes: [] };

  const editsByKey = new Map(edits.map(edit => [String(edit.key), edit]));
  const changes = [];

  const resolved = [];
  for (let index = 0; index < players.length; index++) {
    const player = players[index];
    const edit = editsByKey.get(getKey(player, index));
    if (!edit) {
      resolved.push(player);
      continue;
    }

    const label = `Player ${index + 1}`;
    const requestedName = edit.name === undefined ? player.name : cleanName(edit.name, label);
    const { identity, name, created } = await resolvePlayerIdentity({
      requestedName,
      requestedIdentityId: edit.identityId || null,
      currentName: player.name,
      currentIdentityId: player.identityId,
      adminId
    });

    const previousIdentityId = idString(player.identityId);
    const nextIdentityId = String(identity._id);
    const next = { ...player, name, identityId: toObjectId(identity._id) };
    // Stale back-references to the old identity would contradict the new link
    delete next.originalIdentityId;
    delete next.previousIdentityId;
    if ('userId' in next) next.userId = identity.userId ? String(identity.userId) : null;

    if (name !== player.name || nextIdentityId !== previousIdentityId) {
      changes.push({
        index,
        fromName: player.name,
        toName: name,
        fromIdentityId: previousIdentityId,
        toIdentityId: nextIdentityId,
        toIdentityName: identity.displayName,
        createdIdentity: created
      });
    }
    resolved.push(next);
  }

  const seen = new Map();
  resolved.forEach(player => {
    const key = idString(player.identityId);
    if (!key) return;
    if (seen.has(key)) {
      throw new GameEditError(`"${seen.get(key)}" and "${player.name}" are the same player - a player cannot appear twice in one game`);
    }
    seen.set(key, player.name);
  });

  return { players: resolved, changes };
}

/**
 * Count the games (both collections) an identity still appears in.
 */
async function countIdentityGames(identityId) {
  const WizardGame = mongoose.model('WizardGame');
  const TableGame = mongoose.model('TableGame');
  const id = toObjectId(identityId);
  const [wizard, table] = await Promise.all([
    WizardGame.countDocuments({ 'gameData.players.identityId': id }),
    TableGame.countDocuments({
      $or: [
        { 'gameData.players.identityId': id },
        { 'gameData.gameData.players.identityId': id }
      ]
    })
  ]);
  return wizard + table;
}

/**
 * Retire identities that an edit left without any game - typically the
 * misspelled guest ("Mates"). Registered users and identities that others are
 * merged into are never touched.
 *
 * @returns {Promise<Array<{ id, displayName }>>} the retired identities
 */
async function retireOrphanedIdentities(identityIds) {
  const PlayerIdentity = mongoose.model('PlayerIdentity');
  const User = mongoose.model('User');
  const retired = [];

  for (const id of identityIds) {
    const identity = await PlayerIdentity.findById(id);
    if (!identity || identity.isDeleted) continue;
    if (identity.type === 'user') continue;
    if (identity.linkedIdentities?.length) continue;

    if (identity.userId) {
      const owner = await User.findById(identity.userId).select('role').lean();
      if (owner && owner.role !== 'guest') continue;
    }

    const mergedChildren = await PlayerIdentity.countDocuments({ mergedInto: identity._id, isDeleted: false });
    if (mergedChildren > 0) continue;

    if (await countIdentityGames(identity._id) > 0) continue;

    identity.isDeleted = true;
    identity.deletedAt = new Date();
    identity.eloByGameType = new Map();
    identity.stats = { totalGames: 0, totalWins: 0, lastGameAt: null };
    await identity.save();
    retired.push({ id: String(identity._id), displayName: identity.displayName });
  }

  return retired;
}

/**
 * Load a game for the editor together with what its players are linked to.
 */
async function getGameForEdit(type, id) {
  const Model = mongoose.model(type === 'wizard' ? 'WizardGame' : 'TableGame');
  const PlayerIdentity = mongoose.model('PlayerIdentity');

  const game = await Model.findOne({ _id: { $eq: id } }).lean();
  if (!game) throw new GameEditError('Game not found', 404);

  const gameData = type === 'wizard' ? game.gameData : (game.gameData?.gameData || game.gameData);
  const identityIds = (gameData?.players || []).map(player => player.identityId).filter(Boolean);

  const identities = await PlayerIdentity.find({ _id: { $in: identityIds } })
    .select('displayName type userId isDeleted mergedInto')
    .populate('userId', 'username role')
    .lean();

  const identityInfo = {};
  identities.forEach(identity => {
    identityInfo[String(identity._id)] = {
      id: String(identity._id),
      displayName: identity.displayName,
      type: identity.type,
      username: identity.userId?.role === 'guest' ? null : identity.userId?.username || null,
      isDeleted: identity.isDeleted,
      mergedInto: idString(identity.mergedInto)
    };
  });

  return {
    type,
    game,
    gameData,
    lowIsBetter: type === 'table' ? resolveTableGameLowIsBetter(game) : false,
    identities: identityInfo
  };
}

/**
 * Apply an admin edit to a game and bring everything derived from it up to date.
 *
 * @param {Object} params
 * @param {'wizard'|'table'} params.type
 * @param {string} params.id - game _id
 * @param {Object} params.edits - { players?: [{ key, name, identityId }], rounds?, points?, name? }
 * @param {Object} params.admin - req.user
 * @param {boolean} [params.recalculateElo=true]
 * @param {boolean} [params.cleanupOrphans=true]
 */
async function editGame({ type, id, edits = {}, admin, recalculateElo = true, cleanupOrphans = true }) {
  const isWizard = type === 'wizard';
  const Model = mongoose.model(isWizard ? 'WizardGame' : 'TableGame');

  const game = await Model.findOne({ _id: { $eq: id } }).lean();
  if (!game) throw new GameEditError('Game not found', 404);

  const nested = !isWizard && Boolean(game.gameData?.gameData);
  let gameData = isWizard ? { ...game.gameData } : { ...(nested ? game.gameData.gameData : game.gameData) };
  if (!Array.isArray(gameData.players)) {
    throw new GameEditError('Game has no players to edit', 422);
  }

  const originalIdentityIds = new Set(gameData.players.map(player => idString(player.identityId)).filter(Boolean));

  const playerKey = isWizard
    ? (player) => String(player.id)
    : (player, index) => String(index);
  const { players, changes } = await resolvePlayerEdits(gameData.players, edits.players, playerKey, admin?._id);
  gameData.players = players;

  const topLevel = {};
  if (isWizard) {
    gameData = applyWizardRoundEdits(gameData, edits.rounds);
    gameData = recomputeWizardResults(gameData);
  } else {
    gameData = applyTablePointEdits(gameData, edits.points);
    gameData = recomputeTableResults(gameData, resolveTableGameLowIsBetter(game));
    topLevel.playerCount = players.length;
  }

  if (!isWizard && typeof edits.name === 'string' && edits.name.trim()) {
    topLevel.name = edits.name.trim().slice(0, 100);
  }

  gameData.lastAdminEdit = {
    at: new Date().toISOString(),
    by: admin?._id ? String(admin._id) : null,
    username: admin?.username || null
  };

  const storedGameData = nested ? { ...game.gameData, gameData } : gameData;
  if (nested) {
    // Some older uploads keep a copy of the winner on the wrapper as well
    ['winner_id', 'winner_ids', 'winner_name', 'winner_identityId', 'winner_identityIds'].forEach(field => {
      if (field in storedGameData && field in gameData) storedGameData[field] = gameData[field];
    });
  }

  // updateOne, not save(): the post-save hook would add this game's ELO a second time
  await Model.updateOne({ _id: game._id }, { $set: { gameData: storedGameData, ...topLevel } });

  const finished = isWizard
    ? Boolean(gameData.gameFinished || gameData.winner_id?.length)
    : Boolean(game.gameFinished || gameData.gameFinished);

  const { retiredIdentities, eloRecalculated } = await refreshAfterEdit({
    originalIdentityIds,
    finalIdentityIds: new Set(players.map(player => idString(player.identityId)).filter(Boolean)),
    finished,
    recalculateElo,
    cleanupOrphans
  });

  const updated = await getGameForEdit(type, id);

  return { ...updated, changes, retiredIdentities, eloRecalculated };
}

/**
 * Bring everything derived from an edited game back in line: retire identities
 * the edit orphaned, refresh cached identity stats, rebuild ELO (ratings depend
 * on game order, so a single game cannot be patched in isolation) and drop the
 * leaderboard caches.
 */
async function refreshAfterEdit({ originalIdentityIds, finalIdentityIds, finished, recalculateElo, cleanupOrphans }) {
  const PlayerIdentity = mongoose.model('PlayerIdentity');

  const removedIdentityIds = [...originalIdentityIds].filter(identityId => !finalIdentityIds.has(identityId));
  const retiredIdentities = cleanupOrphans ? await retireOrphanedIdentities(removedIdentityIds) : [];
  const retiredIds = new Set(retiredIdentities.map(identity => identity.id));

  const affectedIdentityIds = new Set([...originalIdentityIds, ...finalIdentityIds]);
  for (const identityId of affectedIdentityIds) {
    if (retiredIds.has(identityId)) continue;
    try {
      const identity = await PlayerIdentity.findById(identityId);
      if (identity && !identity.isDeleted) await identity.recalculateStats();
    } catch (error) {
      console.warn(`[gameEditService] Failed to recalculate stats for identity ${identityId}:`, error.message);
    }
  }

  let eloRecalculated = null;
  if (recalculateElo && (finished || retiredIdentities.length > 0)) {
    const eloService = require('./eloService');
    const result = await eloService.recalculateAllElo({ dryRun: false });
    eloRecalculated = {
      gamesProcessed: result.gamesProcessed,
      playerUpdates: result.playerUpdates,
      errors: result.errors?.length || 0
    };
  }

  const cache = require('./redis');
  if (cache.isConnected) {
    await cache.delPattern('leaderboard:*');
    await cache.delPattern('recent-games:*');
  }

  return { retiredIdentities, eloRecalculated };
}

module.exports = {
  GameEditError,
  WIZARD_FORMULA,
  wizardRoundScore,
  computeWizardFinalScores,
  applyWizardRoundEdits,
  recomputeWizardResults,
  applyTablePointEdits,
  recomputeTableResults,
  resolvePlayerEdits,
  retireOrphanedIdentities,
  getGameForEdit,
  editGame
};
