const express = require('express');
const mongoose = require('mongoose');
const TableGame = require('../models/TableGame');
const GamePhoto = require('../models/GamePhoto');
const auth = require('../middleware/auth');
const { optionalAuth } = require('../middleware/auth');
const catchAsync = require('../utils/catchAsync');
const { getTableGameAccess } = require('../utils/tableGameAccess');

/**
 * Photos of table games, mounted under /api/table-games.
 *
 * - Anyone who can open the game (it is public by id) sees its photos.
 * - Players of the game who have an account, the owner and admins can add photos.
 * - The owner and admins can delete any photo; uploaders can delete their own.
 */
const router = express.Router();

const MAX_PHOTOS_PER_GAME = 6;
const MAX_PHOTO_BYTES = 2 * 1024 * 1024;
const DATA_URL_PATTERN = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]+={0,2})$/;

// Leading bytes of each accepted format, so a data URL can't smuggle other content
const matchesSignature = (buffer, contentType) => {
  if (contentType === 'image/jpeg') {
    return buffer.length > 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  }
  if (contentType === 'image/png') {
    return buffer.length > 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  }
  if (contentType === 'image/webp') {
    return buffer.length > 12
      && buffer.subarray(0, 4).toString('ascii') === 'RIFF'
      && buffer.subarray(8, 12).toString('ascii') === 'WEBP';
  }
  return false;
};

const toPositiveInt = (value) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 && parsed < 100000 ? parsed : null;
};

const canAddPhotos = (access, user) => (
  Boolean(user) && user.role !== 'guest' && (access.isParticipant || access.isOwner || access.isAdmin)
);

const canDeletePhoto = (access, user, photo) => (
  Boolean(user) && (
    access.isOwner
    || access.isAdmin
    || photo.uploadedBy?.toString() === user._id.toString()
  )
);

const serializePhoto = (photo, access, user) => ({
  id: photo._id.toString(),
  url: `/api/table-games/photos/${photo._id}/image`,
  uploadedBy: photo.uploadedBy?.toString() || null,
  uploaderName: photo.uploaderName || null,
  width: photo.width,
  height: photo.height,
  size: photo.size,
  createdAt: photo.createdAt,
  canDelete: canDeletePhoto(access, user, photo),
});

const findGame = async (gameId) => {
  if (!mongoose.Types.ObjectId.isValid(gameId)) return { error: [400, 'Invalid game ID format'] };
  const tableGame = await TableGame.findOne({ _id: { $eq: gameId } }).select('userId gameData');
  if (!tableGame) return { error: [404, 'Table game not found'] };
  return { tableGame };
};

// GET /api/table-games/photos/:photoId/image - the image itself (public, like the game)
router.get('/photos/:photoId/image', catchAsync(async (req, res) => {
  const { photoId } = req.params;
  if (!mongoose.Types.ObjectId.isValid(photoId)) {
    return res.status(400).json({ error: 'Invalid photo ID format' });
  }

  const photo = await GamePhoto.findOne({ _id: { $eq: photoId } }).select('data contentType').lean();
  if (!photo) {
    return res.status(404).json({ error: 'Photo not found' });
  }

  // Photos are immutable (a change is a new photo id), so they can be cached for good
  res.set({
    'Content-Type': photo.contentType,
    'Cache-Control': 'public, max-age=31536000, immutable',
    'X-Content-Type-Options': 'nosniff',
    'Cross-Origin-Resource-Policy': 'cross-origin',
  });
  res.send(Buffer.from(photo.data.buffer || photo.data));
}));

// GET /api/table-games/:id/photos - list photos, plus what the caller may do
router.get('/:id/photos', optionalAuth, catchAsync(async (req, res) => {
  const { tableGame, error } = await findGame(req.params.id);
  if (error) return res.status(error[0]).json({ error: error[1] });

  const access = await getTableGameAccess(tableGame, req.user);
  const photos = await GamePhoto.find({ gameId: tableGame._id })
    .select('-data')
    .sort({ createdAt: 1 })
    .lean();

  res.json({
    photos: photos.map((photo) => serializePhoto(photo, access, req.user)),
    canAdd: canAddPhotos(access, req.user) && photos.length < MAX_PHOTOS_PER_GAME,
    maxPhotos: MAX_PHOTOS_PER_GAME,
  });
}));

// POST /api/table-games/:id/photos - add a photo ({ image: dataUrl, width, height })
router.post('/:id/photos', auth, catchAsync(async (req, res) => {
  const { tableGame, error } = await findGame(req.params.id);
  if (error) return res.status(error[0]).json({ error: error[1] });

  const access = await getTableGameAccess(tableGame, req.user);
  if (!canAddPhotos(access, req.user)) {
    return res.status(403).json({ error: 'Only players of this game can add photos' });
  }

  const match = typeof req.body?.image === 'string' ? DATA_URL_PATTERN.exec(req.body.image) : null;
  if (!match) {
    return res.status(400).json({ error: 'image must be a base64 JPEG, PNG or WebP data URL' });
  }

  const [, contentType, base64] = match;
  const data = Buffer.from(base64, 'base64');
  if (data.length === 0 || data.length > MAX_PHOTO_BYTES) {
    return res.status(413).json({ error: 'Photo is too large (max 2 MB)' });
  }
  if (!matchesSignature(data, contentType)) {
    return res.status(400).json({ error: 'Image data does not match its type' });
  }

  const existingCount = await GamePhoto.countDocuments({ gameId: tableGame._id });
  if (existingCount >= MAX_PHOTOS_PER_GAME) {
    return res.status(409).json({ error: `A game can have at most ${MAX_PHOTOS_PER_GAME} photos`, code: 'PHOTO_LIMIT' });
  }

  const photo = await GamePhoto.create({
    gameId: tableGame._id,
    uploadedBy: req.user._id,
    uploaderName: req.user.username || null,
    contentType,
    data,
    size: data.length,
    width: toPositiveInt(req.body.width),
    height: toPositiveInt(req.body.height),
  });

  res.status(201).json({ photo: serializePhoto(photo, access, req.user) });
}));

// DELETE /api/table-games/:id/photos/:photoId - owner/admin: any photo; uploader: own photo
router.delete('/:id/photos/:photoId', auth, catchAsync(async (req, res) => {
  const { tableGame, error } = await findGame(req.params.id);
  if (error) return res.status(error[0]).json({ error: error[1] });

  const { photoId } = req.params;
  if (!mongoose.Types.ObjectId.isValid(photoId)) {
    return res.status(400).json({ error: 'Invalid photo ID format' });
  }

  const photo = await GamePhoto.findOne({ _id: { $eq: photoId }, gameId: tableGame._id }).select('uploadedBy');
  if (!photo) {
    return res.status(404).json({ error: 'Photo not found' });
  }

  const access = await getTableGameAccess(tableGame, req.user);
  if (!canDeletePhoto(access, req.user, photo)) {
    return res.status(403).json({ error: 'You can only delete your own photos' });
  }

  await GamePhoto.deleteOne({ _id: photo._id });
  res.json({ message: 'Photo deleted' });
}));

module.exports = router;
module.exports.MAX_PHOTOS_PER_GAME = MAX_PHOTOS_PER_GAME;
