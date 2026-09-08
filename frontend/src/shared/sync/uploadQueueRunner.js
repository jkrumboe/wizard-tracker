/**
 * @fileoverview Schedules retries for the pending upload queue.
 *
 * Owns *when* queued games are retried; `pendingUploads` owns *how*. Retries
 * are triggered by the events that actually mean "connectivity may have come
 * back" - regaining the network, returning to the tab, signing in, the service
 * worker replaying its own queue - plus a backing-off timer as a safety net for
 * the cases where none of those fire (a flaky connection that never reports an
 * `offline` event, for instance).
 */

import { flushPendingUploads, getPendingUploadCount } from './pendingUploads.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('uploadQueueRunner');

const FIRST_RETRY_MS = 15_000;
const MAX_RETRY_MS = 5 * 60_000;

let started = false;
let retryTimer = null;
let retryDelay = FIRST_RETRY_MS;

function clearRetry() {
  if (retryTimer) {
    clearTimeout(retryTimer);
    retryTimer = null;
  }
}

/**
 * Run the queue and, if anything is still waiting, schedule the next attempt
 * with an increasing delay so a persistent failure does not hammer the server.
 */
async function runAndReschedule(reason) {
  clearRetry();

  if (!navigator.onLine) {
    // Nothing to do until the network is back; the `online` listener restarts us.
    return;
  }

  let result;
  try {
    result = await flushPendingUploads();
  } catch (error) {
    logger.warn('Upload run threw', { reason, error });
    result = { remaining: getPendingUploadCount() };
  }

  if (!result || result.remaining === 0) {
    retryDelay = FIRST_RETRY_MS;
    return;
  }

  // Signed out is not a connectivity problem - retrying on a timer would never
  // help. The login listener picks these games up instead.
  if (result.reason === 'signed-out') {
    retryDelay = FIRST_RETRY_MS;
    return;
  }

  retryTimer = setTimeout(() => runAndReschedule('timer'), retryDelay);
  retryDelay = Math.min(retryDelay * 2, MAX_RETRY_MS);
  logger.debug('Scheduled next upload attempt', { inMs: retryDelay, remaining: result.remaining });
}

/**
 * Ask the queue to run soon. Safe to call from anywhere, including right after
 * an immediate upload fails.
 */
export function requestUploadFlush(reason = 'manual') {
  retryDelay = FIRST_RETRY_MS;
  runAndReschedule(reason);
}

/** Start listening. Idempotent. */
export function startUploadQueue() {
  if (started) return;
  started = true;

  globalThis.addEventListener('online', () => {
    logger.info('Back online - draining upload queue');
    retryDelay = FIRST_RETRY_MS;
    runAndReschedule('online');
  });

  globalThis.addEventListener('offline', () => {
    // Stop the timer; there is no point retrying until we are back.
    clearRetry();
  });

  // Returning to the app is the most reliable signal on mobile, where the tab
  // is frozen in the background and `online` may never be delivered.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && navigator.onLine) {
      runAndReschedule('visible');
    }
  });

  // Signing in makes previously unuploadable games uploadable.
  globalThis.addEventListener('keepwiz-auth-changed', () => {
    retryDelay = FIRST_RETRY_MS;
    runAndReschedule('auth-changed');
  });

  // The service worker replayed its own background-sync queue, which means the
  // network is working again.
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('message', (event) => {
      const type = event.data?.type;
      if (type === 'SYNC_ALL' || type === 'SYNC_QUEUE_DRAINED') {
        runAndReschedule('service-worker');
      }
    });
  }

  // First pass on boot, once the app has settled.
  setTimeout(() => runAndReschedule('startup'), 2_000);

  logger.info('Upload queue runner started');
}
