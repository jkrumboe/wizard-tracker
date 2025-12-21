/**
 * Game User Linkage Utility
 * Retroactively links games to newly registered users by matching username
 * 
 * When a user creates an account, this utility:
 * 1. Finds all games where the username appears as a player
 * 2. Updates the game's userId field to link it to the new account
 * 3. Handles all game types: Game, WizardGame, TableGame
 * 4. Fails gracefully without breaking registration
 */

const mongoose = require('mongoose');
const Game = require('../models/Game');
const WizardGame = require('../models/WizardGame');
const TableGame = require('../models/TableGame');

/**
 * Helper function to link a single game to a user
 * @param {Object} game - The game document
 * @param {String} username - The username to match
 * @param {ObjectId} userObjectId - The user's ObjectId
 * @param {String} gameType - Type of game (for logging)
 * @returns {Boolean} True if linked, false if skipped
 */
async function linkSingleGame(game, username, userObjectId, gameType) {
  // Skip if already linked to this user
  if (game.userId && game.userId.toString() === userObjectId.toString()) {
    console.log(`⏭️  ${gameType} ${game.localId} already linked to user`);
    return false;
  }

  // Check if this game has at least one matching player
  const hasMatchingPlayer = game.gameData?.players?.some(
    player => player.name && player.name.toLowerCase() === username.toLowerCase()
  );

  if (!hasMatchingPlayer) {
    console.log(`⚠️  ${gameType} ${game.localId} doesn't have matching player, skipping`);
    return false;
  }

  // Update userId
  game.userId = userObjectId;
  await game.save();

  console.log(`✅ Linked ${gameType} ${game.localId} to user ${username}`);
  return true;
}

/**
 * Link all games containing a username to a newly registered user
 * @param {String} username - The username to search for
 * @param {String|ObjectId} userId - The user's ID to link games to
 * @returns {Object} Results of the linkage operation
 */
async function linkGamesToNewUser(username, userId) {
  const results = {
    success: false,
    gamesLinked: 0,
    wizardGamesLinked: 0,
    tableGamesLinked: 0,
    errors: [],
    details: {
      games: [],
      wizardGames: [],
      tableGames: []
    }
  };

  try {
    console.log(`🔗 Starting game linkage for new user: ${username} (ID: ${userId})`);

    // Convert userId to ObjectId if it's a string
    let userObjectId;
    if (mongoose.Types.ObjectId.isValid(userId)) {
      userObjectId = typeof userId === 'string' 
        ? new mongoose.Types.ObjectId(userId) 
        : userId;
    } else {
      throw new Error('Invalid userId provided');
    }

    // Case-insensitive username matching
    const usernameRegex = new RegExp(`^${username}$`, 'i');

    // ========== Link Regular Games (Game collection) ==========
    try {
      // Find games where the username appears in players array
      const games = await Game.find({
        'gameData.players': { 
          $elemMatch: { 
            name: usernameRegex 
          }
        }
      });

      console.log(`📦 Found ${games.length} regular games with player "${username}"`);

      for (const game of games) {
        try {
          const wasLinked = await linkSingleGame(game, username, userObjectId, 'Game');
          if (wasLinked) {
            results.gamesLinked++;
            results.details.games.push({
              localId: game.localId,
              _id: game._id.toString(),
              createdAt: game.createdAt
            });
          }
        } catch (gameError) {
          console.error(`❌ Error linking game ${game.localId}:`, gameError.message);
          results.errors.push({
            type: 'Game',
            localId: game.localId,
            error: gameError.message
          });
        }
      }
    } catch (error) {
      console.error('❌ Error processing Game collection:', error.message);
      results.errors.push({
        type: 'Game Collection',
        error: error.message
      });
    }

    // ========== Link Wizard Games (WizardGame collection) ==========
    try {
      // Find wizard games where the username appears in players array
      const wizardGames = await WizardGame.find({
        'gameData.players': { 
          $elemMatch: { 
            name: usernameRegex 
          }
        }
      });

      console.log(`🧙 Found ${wizardGames.length} wizard games with player "${username}"`);

      for (const game of wizardGames) {
        try {
          const wasLinked = await linkSingleGame(game, username, userObjectId, 'WizardGame');
          if (wasLinked) {
            results.wizardGamesLinked++;
            results.details.wizardGames.push({
              localId: game.localId,
              _id: game._id.toString(),
              createdAt: game.createdAt
            });
          }
        } catch (gameError) {
          console.error(`❌ Error linking wizard game ${game.localId}:`, gameError.message);
          results.errors.push({
            type: 'WizardGame',
            localId: game.localId,
            error: gameError.message
          });
        }
      }
    } catch (error) {
      console.error('❌ Error processing WizardGame collection:', error.message);
      results.errors.push({
        type: 'WizardGame Collection',
        error: error.message
      });
    }

    // ========== Link Table Games (TableGame collection) ==========
    try {
      // Find table games where the username appears in gameData.players
      const tableGames = await TableGame.find({
        'gameData.players': { 
          $elemMatch: { 
            name: usernameRegex 
          }
        }
      });

      console.log(`🎲 Found ${tableGames.length} table games with player "${username}"`);

      for (const game of tableGames) {
        try {
          const wasLinked = await linkSingleGame(game, username, userObjectId, 'TableGame');
          if (wasLinked) {
            results.tableGamesLinked++;
            results.details.tableGames.push({
              localId: game.localId,
              _id: game._id.toString(),
              name: game.name,
              createdAt: game.createdAt
            });
          }
        } catch (gameError) {
          console.error(`❌ Error linking table game ${game.localId}:`, gameError.message);
          results.errors.push({
            type: 'TableGame',
            localId: game.localId,
            error: gameError.message
          });
        }
      }
    } catch (error) {
      console.error('❌ Error processing TableGame collection:', error.message);
      results.errors.push({
        type: 'TableGame Collection',
        error: error.message
      });
    }

    // ========== Summary ==========
    const totalLinked = results.gamesLinked + results.wizardGamesLinked + results.tableGamesLinked;
    results.success = totalLinked > 0 || results.errors.length === 0;

    console.log(`\n📊 Game Linkage Summary for ${username}:`);
    console.log(`   ✅ Regular Games: ${results.gamesLinked}`);
    console.log(`   ✅ Wizard Games: ${results.wizardGamesLinked}`);
    console.log(`   ✅ Table Games: ${results.tableGamesLinked}`);
    console.log(`   📈 Total Linked: ${totalLinked}`);
    if (results.errors.length > 0) {
      console.log(`   ⚠️  Errors: ${results.errors.length}`);
    }

    return results;

  } catch (error) {
    console.error('❌ Fatal error in game linkage:', error);
    results.errors.push({
      type: 'Fatal',
      error: error.message,
      stack: error.stack
    });
    return results;
  }
}

/**
 * Find games by username without linking (for testing/preview)
 * @param {String} username - The username to search for
 * @returns {Object} List of games found
 */
async function findGamesByUsername(username) {
  try {
    const usernameRegex = new RegExp(`^${username}$`, 'i');

    const [games, wizardGames, tableGames] = await Promise.all([
      Game.find({
        'gameData.players': { 
          $elemMatch: { 
            name: usernameRegex 
          }
        }
      }).select('localId userId createdAt gameData.players'),
      
      WizardGame.find({
        'gameData.players': { 
          $elemMatch: { 
            name: usernameRegex 
          }
        }
      }).select('localId userId createdAt gameData.players'),
      
      TableGame.find({
        'gameData.players': { 
          $elemMatch: { 
            name: usernameRegex 
          }
        }
      }).select('localId userId name createdAt gameData.players')
    ]);

    return {
      games: games.map(g => ({
        localId: g.localId,
        userId: g.userId,
        createdAt: g.createdAt,
        players: g.gameData?.players?.map(p => p.name) || []
      })),
      wizardGames: wizardGames.map(g => ({
        localId: g.localId,
        userId: g.userId,
        createdAt: g.createdAt,
        players: g.gameData?.players?.map(p => p.name) || []
      })),
      tableGames: tableGames.map(g => ({
        localId: g.localId,
        userId: g.userId,
        name: g.name,
        createdAt: g.createdAt,
        players: g.gameData?.players?.map(p => p.name) || []
      })),
      totalFound: games.length + wizardGames.length + tableGames.length
    };
  } catch (error) {
    console.error('Error finding games by username:', error);
    throw error;
  }
}

module.exports = {
  linkGamesToNewUser,
  findGamesByUsername
};
