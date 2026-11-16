/**
 * Game photo storage
 *
 * Photos attached to a finished game (e.g. the final board of a Catan game).
 * Images are far too large for localStorage, so they live as Blobs in the
 * IndexedDB `gamePhotos` table (see shared/db/database.js), on this device only.
 *
 * A game can be reached by its local id or its cloud id, so photos are stored
 * under one "game key" and looked up by every id the game is known by.
 */

import { db } from '../db/database.js';
import { generateSecureId } from '../utils/secureRandom.js';

export const MAX_PHOTOS_PER_GAME = 6;

/**
 * Every id a game object can be referenced by, most stable first.
 * @param {Object} game
 * @param {string} [routeId] - the id from the URL, as a fallback
 * @returns {string[]}
 */
export function getGamePhotoKeys(game, routeId) {
  const keys = [
    game?.localId,
    game?.id,
    game?.cloudId,
    game?.cloudGameId,
    routeId,
  ].filter((key) => typeof key === 'string' && key.length > 0);
  return [...new Set(keys)];
}

/**
 * @param {string[]} gameKeys
 * @returns {Promise<Array<{id: string, gameKey: string, blob: Blob, createdAt: number, width?: number, height?: number}>>}
 */
export async function getGamePhotos(gameKeys) {
  if (!Array.isArray(gameKeys) || gameKeys.length === 0) return [];
  const photos = await db.gamePhotos.where('gameKey').anyOf(gameKeys).toArray();
  return photos.sort((a, b) => a.createdAt - b.createdAt);
}

/**
 * @param {string} gameKey
 * @param {Blob} blob - already compressed image
 * @param {{width?: number, height?: number}} [meta]
 * @returns {Promise<Object>} the stored photo record
 */
export async function addGamePhoto(gameKey, blob, meta = {}) {
  if (!gameKey) throw new Error('A game key is required to store a photo');
  if (!(blob instanceof Blob)) throw new Error('Photo must be a Blob');

  const photo = {
    id: generateSecureId('photo'),
    gameKey,
    blob,
    createdAt: Date.now(),
    width: meta.width,
    height: meta.height,
  };
  await db.gamePhotos.put(photo);
  return photo;
}

/**
 * @param {string} photoId
 */
export async function deleteGamePhoto(photoId) {
  await db.gamePhotos.delete(photoId);
}

/**
 * Remove all photos of a game (used when the game itself is deleted).
 * @param {string[]} gameKeys
 */
export async function deleteGamePhotos(gameKeys) {
  if (!Array.isArray(gameKeys) || gameKeys.length === 0) return;
  await db.gamePhotos.where('gameKey').anyOf(gameKeys).delete();
}
