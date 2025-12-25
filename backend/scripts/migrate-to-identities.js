/**
 * Migration Script: Aliases to PlayerIdentity
 * 
 * This script migrates from the old PlayerAlias system to the new
 * PlayerIdentity architecture. It:
 * 
 * 1. Creates PlayerIdentity records from existing PlayerAlias records
 * 2. Creates identities for registered users
 * 3. Scans all games for unique player names and creates guest identities
 * 4. Links games to identities via identityId
 * 
 * Run with: node scripts/migrate-to-identities.js
 * 
 * Options:
 *   --dry-run     Preview changes without modifying database
 *   --verbose     Show detailed progress
 *   --batch=N     Process N games at a time (default: 100)
 */

require('dotenv').config();
const mongoose = require('mongoose');
const PlayerIdentity = require('../models/PlayerIdentity');
const PlayerAlias = require('../models/PlayerAlias');
const User = require('../models/User');
const WizardGame = require('../models/WizardGame');

// Parse command line arguments
const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const VERBOSE = args.includes('--verbose');
const BATCH_SIZE = parseInt(args.find(a => a.startsWith('--batch='))?.split('=')[1] || '100');

// Statistics
const stats = {
  aliasesMigrated: 0,
  usersProcessed: 0,
  identitiesCreated: 0,
  identitiesLinked: 0,
  gamesProcessed: 0,
  gamesUpdated: 0,
  playersLinked: 0,
  errors: []
};

function log(message, verbose = false) {
  if (!verbose || VERBOSE) {
    console.log(`[${new Date().toISOString()}] ${message}`);
  }
}

function logError(message, error) {
  console.error(`[${new Date().toISOString()}] ERROR: ${message}`, error.message);
  stats.errors.push({ message, error: error.message });
}

async function connectDB() {
  const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/wizard-tracker';
  
  log(`Connecting to MongoDB: ${mongoUri.replace(/\/\/[^:]+:[^@]+@/, '//***:***@')}`);
  
  await mongoose.connect(mongoUri);
  log('Connected to MongoDB');
}

/**
 * Phase 1: Migrate existing PlayerAlias records
 */
async function migrateAliases() {
  log('=== Phase 1: Migrating PlayerAlias records ===');
  
  const aliases = await PlayerAlias.find({}).populate('userId', 'username');
  log(`Found ${aliases.length} aliases to migrate`);
  
  for (const alias of aliases) {
    try {
      // Check if identity already exists
      let identity = await PlayerIdentity.findByName(alias.aliasName);
      
      if (identity) {
        log(`Identity already exists for "${alias.aliasName}"`, true);
        
        // Link to user if not already linked
        if (alias.userId && !identity.userId) {
          if (!DRY_RUN) {
            identity.userId = alias.userId._id;
            identity.type = 'user';
            await identity.save();
          }
          stats.identitiesLinked++;
          log(`Linked existing identity "${alias.aliasName}" to user ${alias.userId.username}`, true);
        }
      } else {
        // Create new identity from alias
        if (!DRY_RUN) {
          identity = await PlayerIdentity.create({
            displayName: alias.aliasName,
            normalizedName: alias.aliasName.toLowerCase().trim(),
            userId: alias.userId?._id || null,
            type: alias.userId ? 'user' : 'imported',
            createdBy: alias.createdBy || null,
            createdAt: alias.createdAt || new Date()
          });
        }
        stats.identitiesCreated++;
        log(`Created identity for alias "${alias.aliasName}"`, true);
      }
      
      stats.aliasesMigrated++;
    } catch (error) {
      logError(`Failed to migrate alias "${alias.aliasName}"`, error);
    }
  }
  
  log(`Phase 1 complete: ${stats.aliasesMigrated} aliases processed, ${stats.identitiesCreated} identities created`);
}

/**
 * Phase 2: Create identities for all registered users
 */
async function createUserIdentities() {
  log('=== Phase 2: Creating identities for registered users ===');
  
  const users = await User.find({});
  log(`Found ${users.length} users to process`);
  
  for (const user of users) {
    try {
      // Check if user already has an identity
      const existingIdentity = await PlayerIdentity.findOne({
        userId: user._id,
        isDeleted: false
      });
      
      if (existingIdentity) {
        log(`User "${user.username}" already has identity: ${existingIdentity.displayName}`, true);
        stats.usersProcessed++;
        continue;
      }
      
      // Check if there's a guest identity with the user's name
      let identity = await PlayerIdentity.findByName(user.username);
      
      if (identity && !identity.userId) {
        // Claim the guest identity
        if (!DRY_RUN) {
          identity.userId = user._id;
          identity.type = 'user';
          await identity.save();
        }
        stats.identitiesLinked++;
        log(`Claimed guest identity "${user.username}" for user`, true);
      } else if (!identity) {
        // Create new identity
        if (!DRY_RUN) {
          identity = await PlayerIdentity.create({
            displayName: user.username,
            normalizedName: user.username.toLowerCase().trim(),
            userId: user._id,
            type: 'user',
            createdBy: user._id
          });
        }
        stats.identitiesCreated++;
        log(`Created identity "${user.username}" for user`, true);
      }
      
      stats.usersProcessed++;
    } catch (error) {
      logError(`Failed to process user "${user.username}"`, error);
    }
  }
  
  log(`Phase 2 complete: ${stats.usersProcessed} users processed`);
}

/**
 * Phase 3: Scan games and create/link identities for all players
 */
async function processGames() {
  log('=== Phase 3: Processing games and linking players ===');
  
  const totalGames = await WizardGame.countDocuments({});
  log(`Found ${totalGames} games to process`);
  
  let processed = 0;
  
  while (processed < totalGames) {
    const games = await WizardGame.find({})
      .skip(processed)
      .limit(BATCH_SIZE)
      .lean();
    
    for (const game of games) {
      try {
        await processGame(game);
        stats.gamesProcessed++;
      } catch (error) {
        logError(`Failed to process game ${game._id}`, error);
      }
    }
    
    processed += games.length;
    log(`Processed ${processed}/${totalGames} games`);
  }
  
  log(`Phase 3 complete: ${stats.gamesProcessed} games processed, ${stats.gamesUpdated} updated`);
}

async function processGame(game) {
  if (!game.gameData || !game.gameData.players) {
    return;
  }
  
  let needsUpdate = false;
  const players = game.gameData.players;
  
  for (let i = 0; i < players.length; i++) {
    const player = players[i];
    
    // Skip if already has identityId
    if (player.identityId) {
      continue;
    }
    
    if (!player.name) {
      log(`Game ${game._id}: Player ${i} has no name, skipping`, true);
      continue;
    }
    
    // Find or create identity for this player
    let identity = await PlayerIdentity.findByName(player.name);
    
    if (!identity) {
      if (!DRY_RUN) {
        identity = await PlayerIdentity.create({
          displayName: player.name,
          normalizedName: player.name.toLowerCase().trim(),
          type: 'guest'
        });
      }
      stats.identitiesCreated++;
      log(`Created guest identity for player "${player.name}"`, true);
    }
    
    if (!DRY_RUN && identity) {
      players[i].identityId = identity._id;
      needsUpdate = true;
      stats.playersLinked++;
    }
  }
  
  // Update game document
  if (needsUpdate && !DRY_RUN) {
    await WizardGame.updateOne(
      { _id: game._id },
      { $set: { 'gameData.players': players } }
    );
    stats.gamesUpdated++;
  }
}

/**
 * Phase 4: Update identity statistics
 */
async function updateStatistics() {
  log('=== Phase 4: Updating identity statistics ===');
  
  if (DRY_RUN) {
    log('Skipping statistics update in dry-run mode');
    return;
  }
  
  const identities = await PlayerIdentity.find({ isDeleted: false });
  log(`Updating statistics for ${identities.length} identities`);
  
  let updated = 0;
  for (const identity of identities) {
    try {
      await identity.recalculateStats();
      updated++;
      
      if (updated % 100 === 0) {
        log(`Updated ${updated}/${identities.length} identities`);
      }
    } catch (error) {
      logError(`Failed to update stats for identity ${identity._id}`, error);
    }
  }
  
  log(`Phase 4 complete: ${updated} identities updated`);
}

/**
 * Print final summary
 */
function printSummary() {
  console.log('\n' + '='.repeat(60));
  console.log('MIGRATION SUMMARY');
  console.log('='.repeat(60));
  
  if (DRY_RUN) {
    console.log('>>> DRY RUN - No changes were made <<<\n');
  }
  
  console.log(`Aliases migrated:     ${stats.aliasesMigrated}`);
  console.log(`Users processed:      ${stats.usersProcessed}`);
  console.log(`Identities created:   ${stats.identitiesCreated}`);
  console.log(`Identities linked:    ${stats.identitiesLinked}`);
  console.log(`Games processed:      ${stats.gamesProcessed}`);
  console.log(`Games updated:        ${stats.gamesUpdated}`);
  console.log(`Players linked:       ${stats.playersLinked}`);
  console.log(`Errors:               ${stats.errors.length}`);
  
  if (stats.errors.length > 0) {
    console.log('\nErrors:');
    stats.errors.forEach((e, i) => {
      console.log(`  ${i + 1}. ${e.message}: ${e.error}`);
    });
  }
  
  console.log('='.repeat(60) + '\n');
}

/**
 * Main migration function
 */
async function main() {
  console.log('\n' + '='.repeat(60));
  console.log('PLAYER IDENTITY MIGRATION');
  console.log('='.repeat(60));
  
  if (DRY_RUN) {
    console.log('>>> Running in DRY RUN mode - no changes will be made <<<');
  }
  
  console.log(`Batch size: ${BATCH_SIZE}`);
  console.log(`Verbose: ${VERBOSE}`);
  console.log('='.repeat(60) + '\n');
  
  try {
    await connectDB();
    
    await migrateAliases();
    await createUserIdentities();
    await processGames();
    await updateStatistics();
    
    printSummary();
    
    log('Migration completed successfully!');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    log('Database connection closed');
  }
}

// Run migration
main();
