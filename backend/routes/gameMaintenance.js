const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const auth = require('../middleware/auth');
const catchAsync = require('../utils/catchAsync');
const {
  findDuplicateGames,
  removeDuplicateGroups,
  summarizeGameDoc
} = require('../utils/gameDedupService');
const { GameEditError, getGameForEdit, editGame } = require('../utils/gameEditService');

/**
 * Admin-only maintenance endpoints for the games collections:
 * duplicate cleanup and correcting a single game.
 * Mounted at /api/admin/games
 */

const requireAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};

const parseBool = (value, fallback) => {
  if (value === undefined || value === null || value === '') return fallback;
  if (typeof value === 'boolean') return value;
  return value === 'true' || value === '1';
};

/**
 * Read the shared scan options from a query string or JSON body.
 */
function readScanOptions(source = {}) {
  const gameType = source.gameType === 'wizard' || source.gameType === 'table' ? source.gameType : null;
  return {
    includeDate: parseBool(source.includeDate, true),
    sameUserOnly: parseBool(source.sameUserOnly, false),
    collection: gameType
  };
}

/**
 * Turn a duplicate group into the compact shape the admin UI renders.
 */
function serializeGroup(group, type) {
  return {
    fingerprint: group.fingerprint,
    keep: summarizeGameDoc(group.keep, type),
    remove: group.remove.map(doc => summarizeGameDoc(doc, type))
  };
}

function serializeScan(duplicates) {
  const wizard = {
    scanned: duplicates.wizard.scanned,
    skipped: duplicates.wizard.skipped,
    groups: duplicates.wizard.groups.map(group => serializeGroup(group, 'wizard'))
  };
  const table = {
    scanned: duplicates.table.scanned,
    skipped: duplicates.table.skipped,
    groups: duplicates.table.groups.map(group => serializeGroup(group, 'table'))
  };
  const countRemovable = (collection) =>
    collection.groups.reduce((sum, group) => sum + group.remove.length, 0);

  return {
    wizard,
    table,
    totalGroups: wizard.groups.length + table.groups.length,
    totalDuplicates: countRemovable(wizard) + countRemovable(table),
    scannedAt: new Date().toISOString()
  };
}

/**
 * GET /api/admin/games/duplicates
 * Scan both game collections for duplicates. Read-only.
 *
 * Query: includeDate (default true), sameUserOnly (default false), gameType (wizard|table)
 */
router.get('/duplicates', auth, requireAdmin, catchAsync(async (req, res) => {
  const options = readScanOptions(req.query);
  const duplicates = await findDuplicateGames(options);

  res.json({
    ...serializeScan(duplicates),
    options: {
      includeDate: options.includeDate,
      sameUserOnly: options.sameUserOnly,
      gameType: options.collection
    }
  });
}));

/**
 * POST /api/admin/games/duplicates/remove
 * Delete duplicate games, keeping one copy of each.
 *
 * Body: { ids?: string[], includeDate?, sameUserOnly?, gameType?, recalculateElo? }
 *
 * The scan is always re-run server side and only documents it flags itself are
 * deleted. `ids` narrows that set to what the admin actually reviewed, so a stale
 * or tampered client can never remove something the server did not flag.
 */
router.post('/duplicates/remove', auth, requireAdmin, catchAsync(async (req, res) => {
  const options = readScanOptions(req.body);
  const recalculateElo = parseBool(req.body?.recalculateElo, true);

  const requestedIds = Array.isArray(req.body?.ids)
    ? new Set(req.body.ids.map(String))
    : null;

  const duplicates = await findDuplicateGames(options);

  // Keep only the groups (and copies) the admin asked for
  const narrow = (groups) => groups
    .map(group => ({
      ...group,
      remove: requestedIds
        ? group.remove.filter(doc => requestedIds.has(String(doc._id)))
        : group.remove
    }))
    .filter(group => group.remove.length > 0);

  const wizardGroups = narrow(duplicates.wizard.groups);
  const tableGroups = narrow(duplicates.table.groups);

  const flaggedIds = new Set([
    ...duplicates.wizard.groups.flatMap(group => group.remove.map(doc => String(doc._id))),
    ...duplicates.table.groups.flatMap(group => group.remove.map(doc => String(doc._id)))
  ]);
  const notFlagged = requestedIds
    ? [...requestedIds].filter(id => !flaggedIds.has(id))
    : [];

  const removed = {
    wizard: await removeDuplicateGroups(wizardGroups, 'WizardGame'),
    table: await removeDuplicateGroups(tableGroups, 'TableGame')
  };
  const removedTotal = removed.wizard.removed + removed.table.removed;

  // Ratings counted the removed games, so they have to be rebuilt
  let elo = null;
  if (recalculateElo && removedTotal > 0) {
    const eloService = require('../utils/eloService');
    const result = await eloService.recalculateAllElo({ dryRun: false });
    elo = {
      gamesProcessed: result.gamesProcessed,
      playerUpdates: result.playerUpdates,
      errors: result.errors?.length || 0
    };
  }

  console.log(`[POST /api/admin/games/duplicates/remove] admin=${req.user.username} removed=${removedTotal}`);

  res.json({
    removed: {
      wizard: removed.wizard.removed,
      table: removed.table.removed,
      total: removedTotal
    },
    groupsProcessed: removed.wizard.groupsProcessed + removed.table.groupsProcessed,
    notFlagged,
    eloRecalculated: elo,
    options: {
      includeDate: options.includeDate,
      sameUserOnly: options.sameUserOnly,
      gameType: options.collection
    }
  });
}));

const EDITABLE_TYPES = new Set(['wizard', 'table']);

/**
 * Validate the :type/:id params shared by the edit endpoints.
 * @returns {boolean} false when a response has already been sent
 */
function checkEditParams(req, res) {
  if (!EDITABLE_TYPES.has(req.params.type)) {
    res.status(400).json({ error: 'Game type must be wizard or table' });
    return false;
  }
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    res.status(400).json({ error: 'Invalid game ID format' });
    return false;
  }
  return true;
}

function sendEditError(res, error) {
  if (error instanceof GameEditError) {
    res.status(error.status).json({ error: error.message });
    return true;
  }
  return false;
}

/**
 * GET /api/admin/games/:type/:id
 * Load a game for the admin editor, with the identity every player is linked to.
 */
router.get('/:type/:id', auth, requireAdmin, catchAsync(async (req, res) => {
  if (!checkEditParams(req, res)) return;
  try {
    res.json(await getGameForEdit(req.params.type, req.params.id));
  } catch (error) {
    if (!sendEditError(res, error)) throw error;
  }
}));

/**
 * PUT /api/admin/games/:type/:id
 * Correct a stored game.
 *
 * Body: {
 *   players?: [{ key, name, identityId? }]  key = player id (wizard) or index (table)
 *   rounds?:  [{ players: [{ id, call, made, score }] }]  (wizard)
 *   points?:  [{ index, points: [] }]  (table)
 *   name?:    string  (table)
 *   recalculateElo?: boolean (default true)
 *   cleanupOrphans?: boolean (default true) - retire guest identities left without games
 * }
 */
router.put('/:type/:id', auth, requireAdmin, catchAsync(async (req, res) => {
  if (!checkEditParams(req, res)) return;
  const body = req.body || {};

  try {
    const result = await editGame({
      type: req.params.type,
      id: req.params.id,
      edits: {
        players: body.players,
        rounds: body.rounds,
        points: body.points,
        name: body.name
      },
      admin: req.user,
      recalculateElo: parseBool(body.recalculateElo, true),
      cleanupOrphans: parseBool(body.cleanupOrphans, true)
    });

    console.log(
      `[PUT /api/admin/games/${req.params.type}/${req.params.id}] admin=${req.user.username} ` +
      `playerChanges=${result.changes.length} retired=${result.retiredIdentities.length}`
    );

    res.json(result);
  } catch (error) {
    if (!sendEditError(res, error)) throw error;
  }
}));

module.exports = router;
