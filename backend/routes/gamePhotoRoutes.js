const express = require('express');
const mongoose = require('mongoose');
const GamePhoto = require('../models/GamePhoto');
const auth = require('../middleware/auth');
const { optionalAuth } = require('../middleware/auth');
const catchAsync = require('../utils/catchAsync');
const { getTableGameAccess } = require('../utils/tableGameAccess');

/**
 * Photos of finished games (the final board, a nice hand of cards...).
 * One router per game collection, mounted under that collection's API path:
 *
 *   GET    <base>/photos/:photoId/image  the image itself (public, like the game)
 *   GET    <base>/:id/photos             list photos, plus what the caller may do
 *   POST   <base>/:id/photos             add a photo ({ image: dataUrl, width, height })
 *   DELETE <base>/:id/photos/:photoId    owner/admin: any photo; uploader: own photo
 *
 * - Anyone who can open the game (it is public by id) sees its photos.
 * - Players of the game who have an account, the owner and admins can add photos.
 * - The owner and admins can delete any photo; uploaders can delete their own.
 *
 * Wizard and table games share the same `players` shape (id, name, identityId)
 * and `userId` owner field, so participation is checked the same way for both.
 */

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

/**
 * @param {Object} options
 * @param {import('mongoose').Model} options.Model - the game collection (TableGame, WizardGame)
 * @param {'table'|'wizard'} options.gameType - stored on each photo
 * @param {string} options.basePath - where the router is mounted, e.g. '/api/table-games'
 * @param {string} options.notFoundMessage
 */
function createGamePhotoRouter({ Model, gameType, basePath, notFoundMessage }) {
  const router = express.Router();

  const serializePhoto = (photo, access, user) => ({
    id: photo._id.toString(),
    url: `${basePath}/photos/${photo._id}/image`,
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
    const game = await Model.findOne({ _id: { $eq: gameId } }).select('userId gameData');
    if (!game) return { error: [404, notFoundMessage] };
    return { game };
  };

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

  router.get('/:id/photos', optionalAuth, catchAsync(async (req, res) => {
    const { game, error } = await findGame(req.params.id);
    if (error) return res.status(error[0]).json({ error: error[1] });

    const access = await getTableGameAccess(game, req.user);
    const photos = await GamePhoto.find({ gameId: game._id })
      .select('-data')
      .sort({ createdAt: 1 })
      .lean();

    res.json({
      photos: photos.map((photo) => serializePhoto(photo, access, req.user)),
      canAdd: canAddPhotos(access, req.user) && photos.length < MAX_PHOTOS_PER_GAME,
      maxPhotos: MAX_PHOTOS_PER_GAME,
    });
  }));

  router.post('/:id/photos', auth, catchAsync(async (req, res) => {
    const { game, error } = await findGame(req.params.id);
    if (error) return res.status(error[0]).json({ error: error[1] });

    const access = await getTableGameAccess(game, req.user);
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

    const existingCount = await GamePhoto.countDocuments({ gameId: game._id });
    if (existingCount >= MAX_PHOTOS_PER_GAME) {
      return res.status(409).json({ error: `A game can have at most ${MAX_PHOTOS_PER_GAME} photos`, code: 'PHOTO_LIMIT' });
    }

    const photo = await GamePhoto.create({
      gameId: game._id,
      gameType,
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

  router.delete('/:id/photos/:photoId', auth, catchAsync(async (req, res) => {
    const { game, error } = await findGame(req.params.id);
    if (error) return res.status(error[0]).json({ error: error[1] });

    const { photoId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(photoId)) {
      return res.status(400).json({ error: 'Invalid photo ID format' });
    }

    const photo = await GamePhoto.findOne({ _id: { $eq: photoId }, gameId: game._id }).select('uploadedBy');
    if (!photo) {
      return res.status(404).json({ error: 'Photo not found' });
    }

    const access = await getTableGameAccess(game, req.user);
    if (!canDeletePhoto(access, req.user, photo)) {
      return res.status(403).json({ error: 'You can only delete your own photos' });
    }

    await GamePhoto.deleteOne({ _id: photo._id });
    res.json({ message: 'Photo deleted' });
  }));

  return router;
}

module.exports = { createGamePhotoRouter, MAX_PHOTOS_PER_GAME };
