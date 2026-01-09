/**
 * Fix Script: Null Winner ID Migration
 * 
 * This script fixes TableGame documents that have winner_id: 'null' (string)
 * which was a bug in older game saves. It recalculates the winner from scores
 * and sets proper winner_id, winner_identityId, and winner_identityIds.
 * 
 * Run with: node scripts/fix-null-winner-ids.js
 * 
 * Options:
 *   --dry-run     Preview changes without modifying database
 *   --verbose     Show detailed progress
 */

require('dotenv').config();
const mongoose = require('mongoose');

// Parse command line arguments
const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const VERBOSE = args.includes('--verbose');

// Statistics
const stats = {
  gamesProcessed: 0,
  gamesFixed: 0,
  gamesSkipped: 0,
  errors: []
};

function log(message, verbose = false) {
  if (!verbose || VERBOSE) {
    console.log(`[${new Date().toISOString()}] ${message}`);
  }
}

function logError(message, error) {
  console.error(`[${new Date().toISOString()}] ERROR: ${message}`, error?.message || error);
  stats.errors.push({ message, error: error?.message || String(error) });
}

async function connectDB() {
  const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/wizard-tracker';
  
  log(`Connecting to MongoDB: ${mongoUri.replace(/\/\/[^:]+:[^@]+@/, '//***:***@')}`);
  
  await mongoose.connect(mongoUri);
  log('Connected to MongoDB');
}

/**
 * Calculate winner from scores
 */
function calculateWinner(players, lowIsBetter) {
  const playerScores = players.map((player, index) => {
    const points = player.points || [];
    const total = points.reduce((sum, p) => {
      const parsed = parseFloat(p);
      return sum + (isNaN(parsed) ? 0 : parsed);
    }, 0);
    return { index, name: player.name, total, player };
  });
  
  if (playerScores.length === 0) return null;
  
  const scores = playerScores.map(p => p.total);
  const winningScore = lowIsBetter 
    ? Math.min(...scores) 
    : Math.max(...scores);
  
  // Find all players with the winning score (handles ties)
  const winners = playerScores.filter(p => p.total === winningScore);
  return winners;
}

/**
 * Process a single game
 */
async function processGame(game) {
  const gameData = game.gameData?.gameData || game.gameData;
  
  if (!gameData || !gameData.players || !Array.isArray(gameData.players)) {
    log(`Skipping game ${game._id} - no players array`, true);
    stats.gamesSkipped++;
    return false;
  }
  
  // Check if winner_id is 'null' string or missing but has winner_name
  const hasNullWinnerId = gameData.winner_id === 'null' || gameData.winner_id === null;
  const hasWinnerName = !!gameData.winner_name;
  const missingWinnerIdentityId = !gameData.winner_identityId && !gameData.winner_identityIds;
  
  if (!hasNullWinnerId && !missingWinnerIdentityId) {
    log(`Skipping game ${game._id} - already has valid winner info`, true);
    stats.gamesSkipped++;
    return false;
  }
  
  log(`Processing game ${game._id} - winner_id='${gameData.winner_id}', winner_name='${gameData.winner_name}'`, true);
  
  const lowIsBetter = game.lowIsBetter || game.gameData?.lowIsBetter || gameData.lowIsBetter || false;
  const winners = calculateWinner(gameData.players, lowIsBetter);
  
  if (!winners || winners.length === 0) {
    log(`Could not calculate winner for game ${game._id}`, true);
    stats.gamesSkipped++;
    return false;
  }
  
  // Use the first winner (or all for ties)
  const primaryWinner = winners[0];
  const winnerPlayerId = primaryWinner.player.id || `player_${primaryWinner.index}`;
  
  log(`Calculated winner for game ${game._id}: ${primaryWinner.name} (index ${primaryWinner.index}, score ${primaryWinner.total})`, true);
  
  // Get winner identity IDs
  const winnerIdentityIds = winners
    .filter(w => w.player.identityId)
    .map(w => w.player.identityId);
  
  if (!DRY_RUN) {
    // Update the gameData
    gameData.winner_id = winnerPlayerId;
    gameData.winner_name = primaryWinner.name;
    
    if (winnerIdentityIds.length > 0) {
      gameData.winner_identityIds = winnerIdentityIds;
      gameData.winner_identityId = winnerIdentityIds[0];
    }
    
    // Save the game
    if (game.gameData.gameData) {
      game.gameData.gameData = gameData;
    } else {
      game.gameData = gameData;
    }
    
    game.markModified('gameData');
    await game.save();
    
    log(`Fixed game ${game._id}: winner=${primaryWinner.name} (${winnerPlayerId})`, true);
    stats.gamesFixed++;
  } else {
    log(`[DRY-RUN] Would fix game ${game._id}: winner=${primaryWinner.name} (${winnerPlayerId})`, true);
    stats.gamesFixed++;
  }
  
  stats.gamesProcessed++;
  return true;
}

/**
 * Main migration function
 */
async function migrate() {
  const TableGame = require('../models/TableGame');
  
  log('=== Fix Null Winner IDs ===');
  if (DRY_RUN) {
    log('DRY RUN MODE - No changes will be made');
  }
  
  // Find games with winner_id = 'null' (string) or missing winner_identityId
  const games = await TableGame.find({
    gameFinished: true,
    $or: [
      { 'gameData.winner_id': 'null' },
      { 'gameData.gameData.winner_id': 'null' },
      { 
        $and: [
          { 'gameData.winner_name': { $exists: true, $ne: null } },
          { 'gameData.winner_identityId': { $exists: false } }
        ]
      },
      { 
        $and: [
          { 'gameData.gameData.winner_name': { $exists: true, $ne: null } },
          { 'gameData.gameData.winner_identityId': { $exists: false } }
        ]
      }
    ]
  });
  
  log(`Found ${games.length} games to process`);
  
  if (games.length === 0) {
    log('No games to fix!');
    return;
  }
  
  for (const game of games) {
    try {
      await processGame(game);
    } catch (error) {
      logError(`Failed to process game ${game._id}`, error);
    }
  }
  
  log('\n=== Migration Complete ===');
  log(`Games processed: ${stats.gamesProcessed}`);
  log(`Games fixed: ${stats.gamesFixed}`);
  log(`Games skipped: ${stats.gamesSkipped}`);
  
  if (stats.errors.length > 0) {
    log(`\nErrors encountered: ${stats.errors.length}`);
    stats.errors.forEach((err, i) => {
      log(`  ${i + 1}. ${err.message}: ${err.error}`);
    });
  }
}

async function main() {
  try {
    await connectDB();
    await migrate();
    process.exit(0);
  } catch (error) {
    logError('Migration failed', error);
    process.exit(1);
  }
}

main();
