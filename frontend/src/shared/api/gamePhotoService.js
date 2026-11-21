/**
 * Cloud photos of table and Wizard games (see backend routes/gamePhotoRoutes.js).
 *
 * Everyone who can open a game sees its photos. Players of the game who have an
 * account can add photos; the game's owner (and admins) can delete any photo,
 * players can delete their own. The server decides and reports it per request.
 */

import { API_BASE_URL, API_ENDPOINTS } from './config.js';

const authHeaders = () => {
  const token = localStorage.getItem('auth_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const toError = async (response, fallback) => {
  const body = await response.json().catch(() => ({}));
  const err = new Error(body.error || fallback);
  err.status = response.status;
  err.code = body.code;
  return err;
};

// Each game collection serves its own photos
const endpointsFor = (gameType) => (
  gameType === 'wizard' ? API_ENDPOINTS.wizardGames : API_ENDPOINTS.tableGames
);

const withAbsoluteUrl = (photo) => ({
  ...photo,
  src: photo.url?.startsWith('http') ? photo.url : `${API_BASE_URL}${photo.url}`,
});

/**
 * @param {string} cloudGameId
 * @param {'table'|'wizard'} [gameType]
 * @returns {Promise<{photos: Array, canAdd: boolean, maxPhotos: number}>}
 */
export async function listCloudGamePhotos(cloudGameId, gameType = 'table') {
  const response = await fetch(endpointsFor(gameType).photos(cloudGameId), {
    headers: authHeaders(),
  });
  if (!response.ok) throw await toError(response, 'Failed to load photos');
  const body = await response.json();
  return {
    photos: (body.photos || []).map(withAbsoluteUrl),
    canAdd: Boolean(body.canAdd),
    maxPhotos: body.maxPhotos,
  };
}

/**
 * @param {string} cloudGameId
 * @param {string} dataUrl - compressed image as a data URL
 * @param {{width?: number, height?: number}} [meta]
 * @param {'table'|'wizard'} [gameType]
 */
export async function uploadCloudGamePhoto(cloudGameId, dataUrl, meta = {}, gameType = 'table') {
  const response = await fetch(endpointsFor(gameType).photos(cloudGameId), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ image: dataUrl, width: meta.width, height: meta.height }),
  });
  if (!response.ok) throw await toError(response, 'Failed to upload photo');
  const body = await response.json();
  return withAbsoluteUrl(body.photo);
}

/**
 * @param {string} cloudGameId
 * @param {string} photoId
 * @param {'table'|'wizard'} [gameType]
 */
export async function deleteCloudGamePhoto(cloudGameId, photoId, gameType = 'table') {
  const response = await fetch(endpointsFor(gameType).photo(cloudGameId, photoId), {
    method: 'DELETE',
    headers: authHeaders(),
  });
  if (!response.ok) throw await toError(response, 'Failed to delete photo');
}

/** Read a Blob as a data URL (for uploading photos stored on the device). */
export function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Failed to read photo'));
    reader.readAsDataURL(blob);
  });
}
