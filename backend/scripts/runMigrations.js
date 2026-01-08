/**
 * Migration Runner
 * 
 * Automatically runs pending migrations on application startup.
 * Migrations are tracked in the 'migrations' collection to prevent re-running.
 * 
 * Usage:
 *   const { runMigrations } = require('./scripts/runMigrations');
 *   await runMigrations();
 * 
 * Environment Variables:
 *   SKIP_MIGRATIONS=true     Skip all migrations on startup
 *   FORCE_MIGRATIONS=true    Re-run all migrations even if already applied
 */

const Migration = require('../models/Migration');
const PlayerIdentity = require('../models/PlayerIdentity');
const TableGame = require('../models/TableGame');
const WizardGame = require('../models/WizardGame');
const User = require('../models/User');

const CURRENT_VERSION = '1.0.0';

// ====================
// MIGRATION DEFINITIONS
// ====================

const migrations = [
  {
    name: '001_add_identities_to_games',
    version: '1.0.0',
    description: 'Add identityId to all players in TableGame and WizardGame collections',
    run: migrateGameIdentities
  },
  {
    name: '002_link_identities_to_users',
    version: '1.0.0',
    description: 'Create guest User records for orphaned PlayerIdentity records',
    run: linkIdentitiesToUsers
  },
  {
    name: '003_normalize_player_ids',
    version: '1.0.0',
    description: 'Update player IDs in games to use consistent User._id values',
    run: normalizePlayerIds
  }
];

// ====================
// MIGRATION FUNCTIONS
// ====================

/**
 * Migration 001: Add identities to games
 * Resolves or creates PlayerIdentity for each player and links to User
 */
async function migrateGameIdentities() {
  const stats = {
    gamesProcessed: 0,
    gamesUpdated: 0,
    playersResolved: 0,
    identitiesCreated: 0,
    guestUsersCreated: 0
  };

  // Process TableGames
  const tableGames = await TableGame.find({ identitiesMigrated: { $ne: true } });
  console.log(`  Found ${tableGames.length} TableGames to process`);

  for (const game of tableGames) {
    const result = await processGameForIdentities(game, 'tableGame');
    stats.gamesProcessed++;
    if (result.updated) {
      stats.gamesUpdated++;
      stats.playersResolved += result.playersResolved;
      stats.identitiesCreated += result.identitiesCreated;
      stats.guestUsersCreated += result.guestUsersCreated;
    }
  }

  // Process WizardGames
  const wizardGames = await WizardGame.find({ identitiesMigrated: { $ne: true } });
  console.log(`  Found ${wizardGames.length} WizardGames to process`);

  for (const game of wizardGames) {
    const result = await processGameForIdentities(game, 'wizardGame');
    stats.gamesProcessed++;
    if (result.updated) {
      stats.gamesUpdated++;
      stats.playersResolved += result.playersResolved;
      stats.identitiesCreated += result.identitiesCreated;
      stats.guestUsersCreated += result.guestUsersCreated;
    }
  }

  return stats;
}

/**
 * Process a single game for identity migration
 */
async function processGameForIdentities(game, gameType) {
  const result = { updated: false, playersResolved: 0, identitiesCreated: 0, guestUsersCreated: 0 };
  
  const gameData = game.gameData?.gameData || game.gameData;
  if (!gameData?.players?.length) return result;

  let modified = false;

  for (const player of gameData.players) {
    if (!player.name || player.identityId) continue;

    const { identity, created, userCreated } = await resolveOrCreateIdentity(player.name);
    
    if (identity) {
      if (!player.originalId && player.id) {
        player.originalId = player.id;
      }
      player.identityId = identity._id;
      result.playersResolved++;
      if (created) result.identitiesCreated++;
      if (userCreated) result.guestUsersCreated++;
      modified = true;
    }
  }

  if (modified) {
    game.identitiesMigrated = true;
    game.markModified('gameData');
    await game.save();
    result.updated = true;
  }

  return result;
}

/**
 * Resolve or create identity for a player name
 */
async function resolveOrCreateIdentity(playerName) {
  const normalizedName = playerName.toLowerCase().trim();
  let created = false;
  let userCreated = false;

  // Try to find existing identity
  let identity = await PlayerIdentity.findOne({
    isDeleted: false,
    $or: [
      { normalizedName },
      { 'aliases.normalizedName': normalizedName }
    ]
  });

  if (identity) {
    return { identity, created: false, userCreated: false };
  }

  // Check if a user with this name exists
  let user = await User.findOne({
    username: { $regex: new RegExp(`^${escapeRegex(normalizedName)}$`, 'i') }
  });

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
    userCreated = true;
  }

  // Create identity linked to user
  identity = await PlayerIdentity.create({
    displayName: playerName.trim(),
    normalizedName,
    type: user.role === 'guest' ? 'guest' : 'registered',
    userId: user._id
  });
  created = true;

  return { identity, created, userCreated };
}

/**
 * Migration 002: Link identities to users
 * Creates guest User records for orphaned identities
 */
async function linkIdentitiesToUsers() {
  const stats = {
    identitiesProcessed: 0,
    guestUsersCreated: 0,
    identitiesLinked: 0
  };

  // Find identities without userId
  const orphanedIdentities = await PlayerIdentity.find({
    userId: null,
    isDeleted: false
  });

  console.log(`  Found ${orphanedIdentities.length} orphaned identities`);

  for (const identity of orphanedIdentities) {
    stats.identitiesProcessed++;

    // Check if a user with this name already exists
    let user = await User.findOne({
      username: { $regex: new RegExp(`^${escapeRegex(identity.normalizedName)}$`, 'i') }
    });

    if (!user) {
      // Create guest user
      user = await User.create({
        username: identity.displayName,
        role: 'guest',
        passwordHash: null,
        guestMetadata: {
          originalGuestId: `guest_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          identityId: identity._id
        }
      });
      stats.guestUsersCreated++;
    }

    // Link identity to user
    identity.userId = user._id;
    identity.type = user.role === 'guest' ? 'guest' : 'registered';
    await identity.save();
    stats.identitiesLinked++;
  }

  return stats;
}

/**
 * Migration 003: Normalize player IDs
 * Updates player IDs in games to use consistent User._id values
 */
async function normalizePlayerIds() {
  const stats = {
    gamesProcessed: 0,
    gamesUpdated: 0,
    playersNormalized: 0,
    roundDataUpdated: 0,
    finalScoresUpdated: 0
  };

  // Build identity -> userId cache
  const identityCache = new Map();
  const identities = await PlayerIdentity.find({ isDeleted: false });
  for (const identity of identities) {
    identityCache.set(identity._id.toString(), identity.userId || identity._id);
  }

  console.log(`  Loaded ${identityCache.size} identity mappings`);

  // Process TableGames
  const tableGames = await TableGame.find({ idsNormalized: { $ne: true } });
  console.log(`  Found ${tableGames.length} TableGames to normalize`);

  for (const game of tableGames) {
    const result = await normalizeGameIds(game, identityCache);
    stats.gamesProcessed++;
    if (result.updated) {
      game.idsNormalized = true;
      await game.save();
      stats.gamesUpdated++;
      stats.playersNormalized += result.playersNormalized;
      stats.roundDataUpdated += result.roundDataUpdated;
      stats.finalScoresUpdated += result.finalScoresUpdated;
    }
  }

  // Process WizardGames
  const wizardGames = await WizardGame.find({ idsNormalized: { $ne: true } });
  console.log(`  Found ${wizardGames.length} WizardGames to normalize`);

  for (const game of wizardGames) {
    const result = await normalizeGameIds(game, identityCache);
    stats.gamesProcessed++;
    if (result.updated) {
      game.idsNormalized = true;
      await game.save();
      stats.gamesUpdated++;
      stats.playersNormalized += result.playersNormalized;
      stats.roundDataUpdated += result.roundDataUpdated;
      stats.finalScoresUpdated += result.finalScoresUpdated;
    }
  }

  return stats;
}

/**
 * Normalize player IDs in a single game
 */
async function normalizeGameIds(game, identityCache) {
  const result = { updated: false, playersNormalized: 0, roundDataUpdated: 0, finalScoresUpdated: 0 };
  const gameData = game.gameData?.gameData || game.gameData;
  
  if (!gameData?.players?.length) return result;

  // Build ID mapping for this game
  const idMapping = new Map();
  for (const player of gameData.players) {
    if (!player.identityId) continue;
    
    const normalizedId = identityCache.get(player.identityId.toString());
    if (normalizedId) {
      const normalizedIdStr = normalizedId.toString();
      if (player.id && player.id !== normalizedIdStr) {
        idMapping.set(player.id, normalizedIdStr);
      }
      if (player.originalId && player.originalId !== normalizedIdStr) {
        idMapping.set(player.originalId, normalizedIdStr);
      }
    }
  }

  if (idMapping.size === 0) return result;

  // Update players array
  for (const player of gameData.players) {
    if (!player.identityId) continue;
    
    const normalizedId = identityCache.get(player.identityId.toString());
    if (normalizedId) {
      const normalizedIdStr = normalizedId.toString();
      if (player.id !== normalizedIdStr) {
        if (!player.originalId) player.originalId = player.id;
        player.id = normalizedIdStr;
        result.playersNormalized++;
        result.updated = true;
      }
    }
  }

  // Update round_data
  if (Array.isArray(gameData.round_data)) {
    for (const round of gameData.round_data) {
      if (!round.players?.length) continue;
      for (const player of round.players) {
        if (player.id && idMapping.has(player.id)) {
          if (!player.originalId) player.originalId = player.id;
          player.id = idMapping.get(player.id);
          result.roundDataUpdated++;
          result.updated = true;
        }
      }
    }
  }

  // Update final_scores
  if (gameData.final_scores && typeof gameData.final_scores === 'object') {
    const newScores = {};
    for (const [oldId, score] of Object.entries(gameData.final_scores)) {
      if (idMapping.has(oldId)) {
        newScores[idMapping.get(oldId)] = score;
        result.finalScoresUpdated++;
        result.updated = true;
      } else {
        newScores[oldId] = score;
      }
    }
    gameData.final_scores = newScores;
  }

  // Update winner_id
  if (gameData.winner_id && idMapping.has(gameData.winner_id)) {
    gameData.winner_id = idMapping.get(gameData.winner_id);
    result.updated = true;
  }

  if (result.updated) {
    game.markModified('gameData');
  }

  return result;
}

// ====================
// MIGRATION RUNNER
// ====================

/**
 * Run all pending migrations
 */
async function runMigrations() {
  if (process.env.SKIP_MIGRATIONS === 'true') {
    console.log('⏭️  Skipping migrations (SKIP_MIGRATIONS=true)');
    return { skipped: true };
  }

  const force = process.env.FORCE_MIGRATIONS === 'true';
  console.log('\n🔄 Running database migrations...');
  
  const results = [];

  for (const migration of migrations) {
    // Check if already applied
    const existing = await Migration.findOne({ name: migration.name });
    
    if (existing && existing.status === 'completed' && !force) {
      console.log(`  ⏭️  ${migration.name} - already applied`);
      results.push({ name: migration.name, status: 'skipped', reason: 'already applied' });
      continue;
    }

    if (existing && existing.status === 'running') {
      console.log(`  ⚠️  ${migration.name} - already running (possible crash recovery)`);
      // Could implement recovery logic here
      continue;
    }

    console.log(`  ▶️  Running ${migration.name}...`);
    console.log(`     ${migration.description}`);

    // Create or update migration record
    const migrationRecord = existing || new Migration({
      name: migration.name,
      version: migration.version
    });
    migrationRecord.status = 'running';
    migrationRecord.appliedAt = new Date();
    await migrationRecord.save();

    const startTime = Date.now();

    try {
      const stats = await migration.run();
      const duration = Date.now() - startTime;

      migrationRecord.status = 'completed';
      migrationRecord.duration = duration;
      migrationRecord.stats = stats;
      migrationRecord.error = null;
      await migrationRecord.save();

      console.log(`  ✅ ${migration.name} completed in ${duration}ms`);
      console.log(`     Stats:`, JSON.stringify(stats, null, 2).split('\n').map(l => '     ' + l).join('\n'));
      
      results.push({ name: migration.name, status: 'completed', duration, stats });
    } catch (error) {
      const duration = Date.now() - startTime;

      migrationRecord.status = 'failed';
      migrationRecord.duration = duration;
      migrationRecord.error = error.message;
      await migrationRecord.save();

      console.error(`  ❌ ${migration.name} failed after ${duration}ms`);
      console.error(`     Error: ${error.message}`);
      
      results.push({ name: migration.name, status: 'failed', duration, error: error.message });
      
      // Don't continue with remaining migrations if one fails
      break;
    }
  }

  const completed = results.filter(r => r.status === 'completed').length;
  const failed = results.filter(r => r.status === 'failed').length;
  const skipped = results.filter(r => r.status === 'skipped').length;

  console.log(`\n📊 Migration Summary: ${completed} completed, ${skipped} skipped, ${failed} failed\n`);

  return { results, completed, failed, skipped };
}

/**
 * Get migration status
 */
async function getMigrationStatus() {
  const applied = await Migration.find({}).sort({ appliedAt: 1 });
  const pending = migrations.filter(m => !applied.find(a => a.name === m.name && a.status === 'completed'));
  
  return {
    applied: applied.map(m => ({
      name: m.name,
      version: m.version,
      status: m.status,
      appliedAt: m.appliedAt,
      duration: m.duration
    })),
    pending: pending.map(m => ({
      name: m.name,
      version: m.version,
      description: m.description
    }))
  };
}

// ====================
// UTILITIES
// ====================

function escapeRegex(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

module.exports = {
  runMigrations,
  getMigrationStatus,
  migrations
};
