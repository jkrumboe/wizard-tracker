const WizardGame = require('../models/WizardGame');
const { createGamePhotoRouter, MAX_PHOTOS_PER_GAME } = require('./gamePhotoRoutes');

/** Photos of Wizard games, mounted under /api/wizard-games (see gamePhotoRoutes.js). */
module.exports = createGamePhotoRouter({
  Model: WizardGame,
  gameType: 'wizard',
  basePath: '/api/wizard-games',
  notFoundMessage: 'Game not found',
});
module.exports.MAX_PHOTOS_PER_GAME = MAX_PHOTOS_PER_GAME;
