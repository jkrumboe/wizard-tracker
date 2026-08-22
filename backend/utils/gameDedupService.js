/**
 * Game Deduplication Service
 *
 * Finds and removes duplicate game documents that were created before the
 * content-based duplicate check existed on upload, or that slipped past it
 * (same game uploaded by two players, or re-uploaded from a second device).
 *
 * A duplicate is a second document describing the *same played game*:
 * the same players, the same number of rounds and the exact same final scores.
 * By default wizard games must also share the play day, and table games - whose
 * player names are often generic - the exact play timestamp.
 *
 * Used by scripts/dedupe-games.js. The fingerprint mirrors the upload-time check
 * in routes/wizardGames.js and routes/tableGames.js.
 */

/**
 * Unwrap the game payload, tolerating the double-nested wrapper older uploads produced.
 * @param {Object} doc - WizardGame or TableGame document
 * @returns {Object} the game data
 */
function unwrapGameData(doc) {
  const gameData = doc?.gameData || {};
  return gameData.gameData || gameData;
}

const normalizeName = (value) => String(value || '').trim().toLowerCase();

/**
 * Sorted, lowercased player names.
 * @returns {string} empty when the game has no usable players
 */
function getPlayerNames(gameData) {
  const players = gameData?.players;
  if (!Array.isArray(players)) return '';
  const names = players
    .map(player => (typeof player === 'string' ? player : player?.name))
    .filter(Boolean)
    .map(normalizeName);
  names.sort((a, b) => a.localeCompare(b));
  return names.join('|');
}

/**
 * Sorted final score values - the strong part of the fingerprint.
 * Wizard games carry final_scores, table games carry per-player point columns.
 * @returns {string} empty when the game has no scores
 */
function getScoreSignature(gameData) {
  const finalScores = gameData?.final_scores || gameData?.totals?.final_scores;
  if (finalScores && typeof finalScores === 'object') {
    const values = Object.values(finalScores)
      .map(Number)
      .filter(value => Number.isFinite(value));
    if (values.length > 0) {
      values.sort((a, b) => a - b);
      return values.join(',');
    }
  }

  const players = gameData?.players;
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
}

/**
 * When the game was played (not uploaded).
 * @param {Object} doc
 * @param {Object} gameData
 * @param {boolean} [exact=false] - full timestamp instead of the day
 * @returns {string} empty when no usable date is stored
 */
function getDateKey(doc, gameData, exact = false) {
  // gameData.timestamp is where table games record when they were played
  const raw = gameData?.created_at || gameData?.timestamp || doc?.createdAt;
  if (!raw) return '';
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return '';
  const iso = date.toISOString();
  return exact ? iso : iso.slice(0, 10);
}

/**
 * Content fingerprint of a wizard game, or null when the document does not carry
 * enough data to be matched safely.
 * @param {Object} doc - WizardGame document
 * @param {Object} [options]
 * @param {boolean} [options.includeDate=true] - require the same play day
 * @returns {string|null}
 */
function getWizardFingerprint(doc, { includeDate = true } = {}) {
  const gameData = unwrapGameData(doc);
  const playerNames = getPlayerNames(gameData);
  const scores = getScoreSignature(gameData);
  const rounds = Number(gameData?.total_rounds) || 0;

  if (!playerNames || !scores || rounds <= 0) return null;

  const day = includeDate ? getDateKey(doc, gameData) : '';
  return `wizard|${playerNames}|${rounds}|${scores}|${day}`;
}

/**
 * Content fingerprint of a table game, or null when the document does not carry
 * enough data to be matched safely.
 * @param {Object} doc - TableGame document
 * @param {Object} [options]
 * @param {boolean} [options.includeDate=true] - require the same play day
 * @returns {string|null}
 */
function getTableFingerprint(doc, { includeDate = true } = {}) {
  const gameData = unwrapGameData(doc);
  const playerNames = getPlayerNames(gameData);
  const scores = getScoreSignature(gameData);
  const rounds = Number(doc?.totalRounds ?? gameData?.rows) || 0;

  if (!playerNames || !scores) return null;

  const name = normalizeName(doc?.gameTypeName || doc?.name || gameData?.gameName);
  // Table games are matched on the exact start time, not just the day: names like
  // "Team 1"/"Team 2" with few rounds repeat across an evening, and two such games
  // must not be mistaken for one. A re-uploaded copy carries the same created_at.
  const time = includeDate ? getDateKey(doc, gameData, true) : '';
  return `table|${name}|${playerNames}|${rounds}|${scores}|${time}`;
}

const ownerId = (doc) => String(doc?.userId || '');

/**
 * Score a document for keeper selection. Higher wins.
 * Shared games are kept first (deleting one breaks its share link), then the
 * document with the most resolved player identities, then the oldest upload.
 */
function getKeeperRank(doc) {
  const gameData = unwrapGameData(doc);
  const identityCount = Array.isArray(gameData?.players)
    ? gameData.players.filter(player => player?.identityId).length
    : 0;
  return {
    shared: doc?.isShared || doc?.shareId ? 1 : 0,
    identityCount,
    uploadedAt: new Date(doc?.createdAt || 0).getTime() || Number.MAX_SAFE_INTEGER,
    id: String(doc?._id || '')
  };
}

/**
 * Pick which document of a duplicate group to keep.
 * @param {Array<Object>} docs - documents sharing a fingerprint
 * @returns {{keep: Object, remove: Array<Object>}}
 */
function pickKeeper(docs) {
  const sorted = [...docs].sort((a, b) => {
    const rankA = getKeeperRank(a);
    const rankB = getKeeperRank(b);
    if (rankA.shared !== rankB.shared) return rankB.shared - rankA.shared;
    if (rankA.identityCount !== rankB.identityCount) return rankB.identityCount - rankA.identityCount;
    if (rankA.uploadedAt !== rankB.uploadedAt) return rankA.uploadedAt - rankB.uploadedAt;
    return rankA.id.localeCompare(rankB.id);
  });

  return { keep: sorted[0], remove: sorted.slice(1) };
}

/**
 * Group documents into duplicate sets by content fingerprint.
 * @param {Array<Object>} docs - game documents of one collection
 * @param {Object} options
 * @param {Function} options.fingerprint - fingerprint function for these documents
 * @param {boolean} [options.includeDate=true] - require the same play day
 * @param {boolean} [options.sameUserOnly=false] - only group documents owned by the same user
 * @returns {{groups: Array<{fingerprint: string, keep: Object, remove: Array<Object>}>, skipped: number}}
 */
function groupDuplicates(docs, { fingerprint, includeDate = true, sameUserOnly = false }) {
  const byFingerprint = new Map();
  let skipped = 0;

  for (const doc of docs) {
    const key = fingerprint(doc, { includeDate });
    if (!key) {
      skipped++;
      continue;
    }
    const groupKey = sameUserOnly ? `${key}#${ownerId(doc)}` : key;
    const bucket = byFingerprint.get(groupKey) || [];
    bucket.push(doc);
    byFingerprint.set(groupKey, bucket);
  }

  const groups = [];
  for (const [key, bucket] of byFingerprint.entries()) {
    if (bucket.length < 2) continue;
    const { keep, remove } = pickKeeper(bucket);
    groups.push({ fingerprint: key, keep, remove });
  }

  // Stable, readable output: biggest groups first, then by fingerprint
  groups.sort((a, b) => b.remove.length - a.remove.length || a.fingerprint.localeCompare(b.fingerprint));

  return { groups, skipped };
}

/**
 * Find duplicate wizard and table games in the database.
 * Read-only - nothing is modified.
 * @param {Object} [options]
 * @param {boolean} [options.includeDate=true] - require duplicates to share a play day
 * @param {boolean} [options.sameUserOnly=false] - only treat same-owner documents as duplicates
 * @param {string|null} [options.collection=null] - 'wizard' or 'table' to limit the scan
 * @returns {Promise<{wizard: Object, table: Object}>}
 */
async function findDuplicateGames({ includeDate = true, sameUserOnly = false, collection = null } = {}) {
  const mongoose = require('mongoose');
  const WizardGame = mongoose.model('WizardGame');
  const TableGame = mongoose.model('TableGame');

  const result = {
    wizard: { scanned: 0, skipped: 0, groups: [] },
    table: { scanned: 0, skipped: 0, groups: [] }
  };

  if (collection !== 'table') {
    const wizardGames = await WizardGame.find({}).lean();
    const grouped = groupDuplicates(wizardGames, {
      fingerprint: getWizardFingerprint,
      includeDate,
      sameUserOnly
    });
    result.wizard = { scanned: wizardGames.length, skipped: grouped.skipped, groups: grouped.groups };
  }

  if (collection !== 'wizard') {
    const tableGames = await TableGame.find({}).lean();
    const grouped = groupDuplicates(tableGames, {
      fingerprint: getTableFingerprint,
      includeDate,
      sameUserOnly
    });
    result.table = { scanned: tableGames.length, skipped: grouped.skipped, groups: grouped.groups };
  }

  return result;
}

/**
 * Delete the duplicates of the given groups and record what was merged on the kept
 * document. Nothing else in the group is touched.
 * @param {Array<Object>} groups - groups from findDuplicateGames
 * @param {string} modelName - 'WizardGame' or 'TableGame'
 * @param {Object} [options]
 * @param {boolean} [options.purgeEvents=false] - also delete GameEvents of removed localIds
 * @returns {Promise<{removed: number, groupsProcessed: number, eventsRemoved: number}>}
 */
async function removeDuplicateGroups(groups, modelName, { purgeEvents = false } = {}) {
  const mongoose = require('mongoose');
  const Model = mongoose.model(modelName);
  const stats = { removed: 0, groupsProcessed: 0, eventsRemoved: 0 };

  for (const group of groups) {
    const removeIds = group.remove.map(doc => doc._id);
    if (removeIds.length === 0) continue;

    const mergedAt = new Date();
    const mergedDuplicates = group.remove.map(doc => ({
      cloudId: String(doc._id),
      localId: doc.localId,
      userId: String(doc.userId || ''),
      mergedAt
    }));

    // Record the merge on the keeper so support can trace where a game went
    const existingNotes = unwrapGameData(group.keep).mergedDuplicates || [];
    await Model.updateOne(
      { _id: group.keep._id },
      { $set: { 'gameData.mergedDuplicates': [...existingNotes, ...mergedDuplicates] } }
    );

    const deletion = await Model.deleteMany({ _id: { $in: removeIds } });
    stats.removed += deletion.deletedCount || 0;
    stats.groupsProcessed++;

    if (purgeEvents) {
      const localIds = group.remove.map(doc => doc.localId).filter(Boolean);
      if (localIds.length > 0) {
        const GameEvent = require('mongoose').model('GameEvent');
        const eventDeletion = await GameEvent.deleteMany({ gameId: { $in: localIds } });
        stats.eventsRemoved += eventDeletion.deletedCount || 0;
      }
    }
  }

  return stats;
}

/**
 * Count sync events belonging to the documents that would be removed.
 * @param {Array<Object>} groups
 * @returns {Promise<number>}
 */
async function countOrphanEvents(groups) {
  const localIds = groups.flatMap(group => group.remove.map(doc => doc.localId)).filter(Boolean);
  if (localIds.length === 0) return 0;
  const mongoose = require('mongoose');
  const GameEvent = mongoose.model('GameEvent');
  return GameEvent.countDocuments({ gameId: { $in: localIds } });
}

module.exports = {
  unwrapGameData,
  getWizardFingerprint,
  getTableFingerprint,
  groupDuplicates,
  pickKeeper,
  findDuplicateGames,
  removeDuplicateGroups,
  countOrphanEvents
};
