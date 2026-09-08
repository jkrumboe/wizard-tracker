/**
 * @fileoverview Pending upload queue for finished games.
 *
 * Games are always saved on the device first and stay fully playable with no
 * network at all. When the upload to the cloud cannot complete - offline,
 * expired session, server error - the finished game simply stays on the device
 * with `isUploaded: false`, and this module retries it automatically once the
 * app is online again.
 *
 * There is no separate queue file to keep in sync: local storage already records
 * which games have reached the cloud, so that flag *is* the queue. That means a
 * game can never be lost by the queue drifting out of step with storage.
 */

import { LocalGameStorage } from '../api/localGameStorage.js';
import { LocalTableGameStorage } from '../api/localTableGameStorage.js';
import { LocalScoreboardGameStorage } from '../api/localScoreboardGameStorage.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('pendingUploads');

/** Per-game attempt counters, kept outside the game records so retries never mutate game data. */
const ATTEMPTS_KEY = 'keepwiz_upload_attempts';

/**
 * After this many consecutive failures a game is left alone by automatic
 * retries. It is still uploaded by an explicit flush (the user pressing
 * "Retry"), so a game rejected by a since-fixed validation bug is never
 * stranded permanently.
 */
const MAX_AUTO_ATTEMPTS = 6;

/** Fired on `window` whenever the pending set changes. */
export const PENDING_UPLOADS_EVENT = 'keepwiz-pending-uploads';

const KIND_WIZARD = 'wizard';
const KIND_TABLE = 'table';
const KIND_SCOREBOARD = 'scoreboard';

function readAttempts() {
  try {
    return JSON.parse(localStorage.getItem(ATTEMPTS_KEY) || '{}');
  } catch {
    return {};
  }
}

function writeAttempts(attempts) {
  try {
    localStorage.setItem(ATTEMPTS_KEY, JSON.stringify(attempts));
  } catch (error) {
    logger.warn('Could not persist upload attempt counts', { error });
  }
}

function recordAttempt(gameId) {
  const attempts = readAttempts();
  attempts[gameId] = (attempts[gameId] || 0) + 1;
  writeAttempts(attempts);
  return attempts[gameId];
}

function clearAttempts(gameId) {
  const attempts = readAttempts();
  if (attempts[gameId] !== undefined) {
    delete attempts[gameId];
    writeAttempts(attempts);
  }
}

/**
 * Drop attempt counters for games that no longer exist, so the key cannot grow
 * without bound as games are deleted.
 */
function pruneAttempts(knownIds) {
  const attempts = readAttempts();
  let changed = false;
  for (const id of Object.keys(attempts)) {
    if (!knownIds.has(id)) {
      delete attempts[id];
      changed = true;
    }
  }
  if (changed) writeAttempts(attempts);
}

function isAuthenticated() {
  return Boolean(localStorage.getItem('auth_token'));
}

/**
 * Every finished game on this device that has not reached the cloud yet.
 * @returns {Array<{id: string, kind: string, name: string, savedAt: string, attempts: number}>}
 */
export function listPendingUploads() {
  const attempts = readAttempts();
  const pending = [];
  const knownIds = new Set();

  const collect = (records, kind, isFinished) => {
    for (const record of Object.values(records || {})) {
      if (!record || !record.id) continue;
      knownIds.add(record.id);
      if (record.isUploaded) continue;
      if (!isFinished(record)) continue;
      pending.push({
        id: record.id,
        kind,
        name: record.name || record.gameTypeName || 'Game',
        savedAt: record.savedAt || record.lastPlayed || null,
        attempts: attempts[record.id] || 0,
      });
    }
  };

  try {
    collect(
      LocalGameStorage.getAllSavedGames(),
      KIND_WIZARD,
      // A wizard game is finished when the record says so; paused/in-progress
      // autosaves must never be uploaded.
      (record) => record.gameFinished === true
    );
  } catch (error) {
    logger.warn('Could not read local wizard games', { error });
  }

  try {
    collect(LocalTableGameStorage.getAllSavedTableGames(), KIND_TABLE, (record) => record.gameFinished === true);
  } catch (error) {
    logger.warn('Could not read local table games', { error });
  }

  try {
    collect(
      LocalScoreboardGameStorage.getAllSavedTableGames(),
      KIND_SCOREBOARD,
      (record) => record.gameFinished === true
    );
  } catch (error) {
    logger.warn('Could not read local scoreboard games', { error });
  }

  pruneAttempts(knownIds);

  // Oldest first, so a backlog drains in the order the games were played.
  pending.sort((a, b) => String(a.savedAt || '').localeCompare(String(b.savedAt || '')));
  return pending;
}

export function getPendingUploadCount() {
  return listPendingUploads().length;
}

function emitChange(detail) {
  try {
    globalThis.dispatchEvent(new CustomEvent(PENDING_UPLOADS_EVENT, { detail }));
  } catch (error) {
    logger.debug('Could not dispatch pending upload event', { error });
  }
}

/**
 * Upload one pending game. Resolves true when the game reached the cloud
 * (including when the server already had it), false when it should be retried.
 */
async function uploadOne(entry) {
  if (entry.kind === KIND_WIZARD) {
    const games = LocalGameStorage.getAllSavedGames();
    const record = games[entry.id];
    if (!record) return true; // deleted meanwhile - nothing to upload

    const { createGame } = await import('../api/gameService.js');
    // The stored record is already in v3.0 shape, which the formatter passes
    // through untouched.
    const result = await createGame(record, entry.id);
    const cloudId = result?.game?.id;
    if (cloudId) {
      LocalGameStorage.markGameAsUploaded(entry.id, cloudId);
    }
    return true;
  }

  const storage = entry.kind === KIND_TABLE ? LocalTableGameStorage : LocalScoreboardGameStorage;
  const record = storage.getTableGameById(entry.id);
  if (!record) return true;

  const { createTableGame } = await import('../api/tableGameService.js');
  const result = await createTableGame(record.gameData, entry.id);
  // Table games come back as a full document keyed by _id; wizard games by id.
  const cloudId = result?.game?._id || result?.game?.id;
  if (cloudId) {
    storage.markGameAsUploaded(entry.id, cloudId);
  }
  return true;
}

/** True when an error means "stop the whole run", not "this one game failed". */
function isSessionError(error) {
  const message = error?.message || '';
  return message.includes('session has expired') || message.includes('must be logged in');
}

let flushInFlight = null;

/**
 * Try to upload everything that is waiting.
 *
 * @param {Object} [options]
 * @param {boolean} [options.force] Also retry games that exhausted their
 *   automatic attempts (use for an explicit, user-initiated retry).
 * @returns {Promise<{uploaded: number, failed: number, remaining: number, skipped: number, reason?: string}>}
 */
export async function flushPendingUploads(options = {}) {
  const { force = false } = options;

  // Single-flight: a second call while a run is in progress joins that run
  // instead of uploading the same games twice.
  if (flushInFlight) return flushInFlight;

  const run = async () => {
    const idle = { uploaded: 0, failed: 0, skipped: 0, remaining: getPendingUploadCount() };

    if (!navigator.onLine) return { ...idle, reason: 'offline' };
    if (!isAuthenticated()) return { ...idle, reason: 'signed-out' };

    const pending = listPendingUploads();
    if (pending.length === 0) return { ...idle, remaining: 0, reason: 'empty' };

    logger.info('Uploading games saved while offline', { count: pending.length });
    emitChange({ status: 'uploading', pending: pending.length });

    let uploaded = 0;
    let failed = 0;
    let skipped = 0;

    for (const entry of pending) {
      if (!force && entry.attempts >= MAX_AUTO_ATTEMPTS) {
        skipped += 1;
        continue;
      }

      try {
        await uploadOne(entry);
        clearAttempts(entry.id);
        uploaded += 1;
        logger.debug('Uploaded queued game', { id: entry.id, kind: entry.kind });
      } catch (error) {
        failed += 1;
        const attempts = recordAttempt(entry.id);
        logger.warn('Queued upload failed; game stays on device', {
          id: entry.id,
          kind: entry.kind,
          attempts,
          error: error?.message,
        });

        // A dead session or a dropped connection will fail for every remaining
        // game too, so stop rather than burning attempt counts on all of them.
        if (isSessionError(error) || !navigator.onLine) break;
      }
    }

    const remaining = getPendingUploadCount();
    const result = { uploaded, failed, skipped, remaining };
    logger.info('Finished upload run', result);
    emitChange({ status: 'idle', pending: remaining, uploaded });

    if (uploaded > 0) {
      // Let the rest of the app refresh anything derived from cloud games.
      globalThis.dispatchEvent(new CustomEvent('gameUploaded'));
    }

    return result;
  };

  flushInFlight = run().finally(() => {
    flushInFlight = null;
  });

  return flushInFlight;
}
