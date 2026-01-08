/**
 * Migration Script: TableGame Identity Resolution
 * 
 * This script migrates TableGame documents to use the PlayerIdentity system.
 * For each player in a game:
 * 1. Resolves or creates a PlayerIdentity based on their name
 * 2. Adds identityId to the player object
 * 3. Preserves originalId for reversibility
 * 4. Updates winner_identityId/winner_identityIds for faster lookups
 * 
 * Run with: node scripts/migrate-table-games-identities.js
 * 
 * Options:
 *   --dry-run     Preview changes without modifying database
 *   --verbose     Show detailed progress
 *   --batch=N     Process N games at a time (default: 100)
 *   --force       Re-process games that were already migrated
 */

require('dotenv').config();
const mongoose = require('mongoose');
const PlayerIdentity = require('../models/PlayerIdentity');
const TableGame = require('../models/TableGame');
const User = require('../models/User');

// Parse command line arguments
const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const VERBOSE = args.includes('--verbose');
const FORCE = args.includes('--force');
const BATCH_SIZE = parseInt(args.find(a => a.startsWith('--batch='))?.split('=')[1] || '100');

// Statistics
const stats = {
  gamesProcessed: 0,
  gamesUpdated: 0,
  gamesSkipped: 0,
  playersResolved: 0,
  identitiesCreated: 0,
  identitiesReused: 0,
  guestUsersCreated: 0,
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
 * Resolve or create identity for a player name
 * Also creates a guest User if needed
 */
async function resolveIdentity(playerName) {
  const normalizedName = playerName.toLowerCase().trim();
  
  // Try to find existing identity
  let identity = await PlayerIdentity.findOne({
    isDeleted: false,
    $or: [
      { normalizedName: normalizedName },
      { 'aliases.normalizedName': normalizedName }
    ]
  });
  
  if (identity) {
    stats.identitiesReused++;
    return identity;
  }
  
  // Check if a user with this name already exists (registered or guest)
  let user = await User.findOne({
    username: { $regex: new RegExp(`^${normalizedName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }
  });
  
  if (!DRY_RUN) {
    // Create guest user if doesn't exist
    if (!user) {
      user = await User.create({
        username: playerName.trim(),
        role: 'guest',
        passwordHash: null,
        guestMetadata: {
          originalGuestId: `guest_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        }
      });
      stats.guestUsersCreated++;
      log(`Created guest user "${playerName}"`, true);
    }
    
    // Create identity linked to user
    identity = await PlayerIdentity.create({
      displayName: playerName.trim(),
      normalizedName: normalizedName,
      type: user.role === 'guest' ? 'guest' : 'registered',
      userId: user._id
    });
    stats.identitiesCreated++;
    log(`Created identity for "${playerName}" linked to user ${user._id}`, true);
  } else {
    if (!user) {
      stats.guestUsersCreated++;
      log(`[DRY-RUN] Would create guest user "${playerName}"`, true);
    }
    stats.identitiesCreated++;
    log(`[DRY-RUN] Would create identity for "${playerName}"`, true);
  }
  
  return identity;
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
  
  // Check if already migrated
  if (game.identitiesMigrated && !FORCE) {
    log(`Skipping game ${game._id} - already migrated`, true);
    stats.gamesSkipped++;
    return false;
  }
  
  let modified = false;
  const playerIdentityMap = {};
  
  // Process each player
  for (let i = 0; i < gameData.players.length; i++) {
    const player = gameData.players[i];
    
    if (!player.name) {
      log(`Skipping player at index ${i} in game ${game._id} - no name`, true);
      continue;
    }
    
    // Skip if already has identityId and not forcing
    if (player.identityId && !FORCE) {
      playerIdentityMap[player.id || `player_${i}`] = player.identityId;
      continue;
    }
    
    // Resolve identity
    const identity = await resolveIdentity(player.name);
    
    if (identity) {
      // Save original ID for reversibility
      if (player.id && !player.originalId) {
        player.originalId = player.id;
      }
      
      player.identityId = identity._id;
      playerIdentityMap[player.id || player.originalId || `player_${i}`] = identity._id;
      stats.playersResolved++;
      modified = true;
      
      log(`Resolved player "${player.name}" -> identity ${identity._id}`, true);
    }
  }
  
  // Update winner identity references
  if (gameData.winner_id || gameData.winner_ids) {
    const winnerIds = gameData.winner_ids || [gameData.winner_id];
    const winnerIdentityIds = [];
    
    for (const winnerId of winnerIds) {
      // Try to find by original ID first
      if (playerIdentityMap[winnerId]) {
        winnerIdentityIds.push(playerIdentityMap[winnerId]);
      } else {
        // Try to find by player name
        const winnerPlayer = gameData.players.find(p => 
          p.id === winnerId || p.originalId === winnerId
        );
        if (winnerPlayer && winnerPlayer.identityId) {
          winnerIdentityIds.push(winnerPlayer.identityId);
        }
      }
    }
    
    if (winnerIdentityIds.length > 0) {
      gameData.winner_identityIds = winnerIdentityIds;
      if (winnerIdentityIds.length === 1) {
        gameData.winner_identityId = winnerIdentityIds[0];
      }
      modified = true;
    }
  }
  
  // Handle winner_name if no winner_id
  if (!gameData.winner_id && gameData.winner_name) {
    const winnerPlayer = gameData.players.find(p => 
      p.name?.toLowerCase() === gameData.winner_name?.toLowerCase()
    );
    if (winnerPlayer && winnerPlayer.identityId) {
      gameData.winner_identityId = winnerPlayer.identityId;
      gameData.winner_identityIds = [winnerPlayer.identityId];
      modified = true;
    }
  }
  
  if (modified) {
    if (!DRY_RUN) {
      // Update the nested gameData if it exists
      if (game.gameData.gameData) {
        game.gameData.gameData = gameData;
      } else {
        game.gameData = gameData;
      }
      
      game.identitiesMigrated = true;
      game.migratedAt = new Date();
      game.markModified('gameData');
      
      await game.save();
      stats.gamesUpdated++;
      log(`Updated game ${game._id}`, true);
    } else {
      stats.gamesUpdated++;
      log(`[DRY-RUN] Would update game ${game._id}`, true);
    }
  }
  
  stats.gamesProcessed++;
  return modified;
}

/**
 * Main migration function
 */
async function migrate() {
  log('=== TableGame Identity Migration ===');
  if (DRY_RUN) {
    log('DRY RUN MODE - No changes will be made');
  }
  
  // Count total games
  const filter = FORCE ? {} : { identitiesMigrated: { $ne: true } };
  const totalGames = await TableGame.countDocuments(filter);
  log(`Found ${totalGames} games to process`);
  
  if (totalGames === 0) {
    log('No games to migrate!');
    return;
  }
  
  let processed = 0;
  
  while (processed < totalGames) {
    const games = await TableGame.find(filter)
      .skip(processed)
      .limit(BATCH_SIZE);
    
    for (const game of games) {
      try {
        await processGame(game);
      } catch (error) {
        logError(`Failed to process game ${game._id}`, error);
      }
    }
    
    processed += games.length;
    log(`Progress: ${processed}/${totalGames} games processed`);
    
    // Break if we got fewer games than expected (filtered games in later batches)
    if (games.length < BATCH_SIZE) {
      break;
    }
  }
  
  log('=== Migration Complete ===');
  log(`Games processed: ${stats.gamesProcessed}`);
  log(`Games updated: ${stats.gamesUpdated}`);
  log(`Games skipped: ${stats.gamesSkipped}`);
  log(`Players resolved: ${stats.playersResolved}`);
  log(`Guest users created: ${stats.guestUsersCreated}`);
  log(`Identities created: ${stats.identitiesCreated}`);
  log(`Identities reused: ${stats.identitiesReused}`);
  log(`Errors: ${stats.errors.length}`);
  
  if (stats.errors.length > 0) {
    log('Errors:');
    stats.errors.forEach((e, i) => {
      console.error(`  ${i + 1}. ${e.message}: ${e.error}`);
    });
  }
}

/**
 * Rollback migration (restore original state)
 */
async function rollback() {
  log('=== Rolling back TableGame Identity Migration ===');
  
  const games = await TableGame.find({ identitiesMigrated: true });
  log(`Found ${games.length} migrated games to rollback`);
  
  let rolledBack = 0;
  
  for (const game of games) {
    try {
      const gameData = game.gameData?.gameData || game.gameData;
      
      if (!gameData || !gameData.players) continue;
      
      // Remove identityId from players but keep originalId for reference
      for (const player of gameData.players) {
        delete player.identityId;
        delete player.previousIdentityId;
      }
      
      // Remove winner identity fields
      delete gameData.winner_identityId;
      delete gameData.winner_identityIds;
      delete gameData.previous_winner_identityId;
      delete gameData.previous_winner_identityIds;
      
      if (!DRY_RUN) {
        game.identitiesMigrated = false;
        game.migratedAt = null;
        game.markModified('gameData');
        await game.save();
      }
      
      rolledBack++;
      log(`Rolled back game ${game._id}`, true);
    } catch (error) {
      logError(`Failed to rollback game ${game._id}`, error);
    }
  }
  
  log(`Rolled back ${rolledBack} games`);
}

// Main execution
async function main() {
  try {
    await connectDB();
    
    if (args.includes('--rollback')) {
      await rollback();
    } else {
      await migrate();
    }
    
    process.exit(0);
  } catch (error) {
    logError('Migration failed', error);
    process.exit(1);
  }
}

main();
