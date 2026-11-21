const TableGame = require('../models/TableGame');
const { createGamePhotoRouter, MAX_PHOTOS_PER_GAME } = require('./gamePhotoRoutes');

/** Photos of table games, mounted under /api/table-games (see gamePhotoRoutes.js). */
module.exports = createGamePhotoRouter({
  Model: TableGame,
  gameType: 'table',
  basePath: '/api/table-games',
  notFoundMessage: 'Table game not found',
});
module.exports.MAX_PHOTOS_PER_GAME = MAX_PHOTOS_PER_GAME;
