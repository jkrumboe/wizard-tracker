/**
 * Script: Normalize Player IDs in Games
 * 
 * This script updates player IDs in games to use consistent identifiers.
 * For each player:
 * - If they have a linked User (via PlayerIdentity.userId), use the User._id
 * - Otherwise, use the PlayerIdentity._id
 * 
 * This ensures the same person always has the same ID across all games,
 * making round_data and final_scores lookups work correctly.
 * 
 * Run with: node scripts/normalize-player-ids.js
 * 
 * Options:
 *   --dry-run     Preview changes without modifying database
 *   --verbose     Show detailed progress
 */

require('dotenv').config();
const mongoose = require('mongoose');
const PlayerIdentity = require('../models/PlayerIdentity');
const TableGame = require('../models/TableGame');
const WizardGame = require('../models/WizardGame');

// Parse command line arguments
const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const VERBOSE = args.includes('--verbose');

// Statistics
const stats = {
  gamesProcessed: 0,
  gamesUpdated: 0,
  gamesSkipped: 0,
  playersNormalized: 0,
  roundDataUpdated: 0,
  finalScoresUpdated: 0,
  errors: []
};

// Cache for identity -> normalized ID mapping
const identityToIdCache = new Map();

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
 * Get the normalized ID for an identity
 * Returns userId if linked to a user, otherwise returns identityId
 */
async function getNormalizedId(identityId) {
  if (!identityId) return null;
  
  const idStr = identityId.toString();
  
  // Check cache first
  if (identityToIdCache.has(idStr)) {
    return identityToIdCache.get(idStr);
  }
  
  // Look up the identity
  const identity = await PlayerIdentity.findById(identityId);
  
  if (!identity) {
    log(`Warning: Identity ${identityId} not found`, true);
    return identityId; // Fall back to identity ID
  }
  
  // Use userId if available, otherwise use identityId
  const normalizedId = identity.userId || identity._id;
  
  // Cache the result
  identityToIdCache.set(idStr, normalizedId);
  
  return normalizedId;
}

/**
 * Build a mapping of old IDs to new normalized IDs for a game
 */
async function buildIdMapping(players) {
  const idMapping = new Map();
  
  for (const player of players) {
    if (!player.identityId) continue;
    
    const normalizedId = await getNormalizedId(player.identityId);
    if (normalizedId) {
      const normalizedIdStr = normalizedId.toString();
      
      // Map old ID to new ID
      if (player.id && player.id !== normalizedIdStr) {
        idMapping.set(player.id, normalizedIdStr);
      }
      
      // Also map originalId if it exists
      if (player.originalId && player.originalId !== normalizedIdStr) {
        idMapping.set(player.originalId, normalizedIdStr);
      }
    }
  }
  
  return idMapping;
}

/**
 * Update player IDs in the players array
 */
async function updatePlayersArray(players, idMapping) {
  let updated = 0;
  
  for (const player of players) {
    if (!player.identityId) continue;
    
    const normalizedId = await getNormalizedId(player.identityId);
    if (normalizedId) {
      const normalizedIdStr = normalizedId.toString();
      
      if (player.id !== normalizedIdStr) {
        // Save original ID for reference
        if (!player.originalId) {
          player.originalId = player.id;
        }
        player.id = normalizedIdStr;
        updated++;
      }
    }
  }
  
  return updated;
}

/**
 * Update player IDs in round_data
 */
function updateRoundData(roundData, idMapping) {
  let updated = 0;
  
  if (!Array.isArray(roundData)) return 0;
  
  for (const round of roundData) {
    if (!round.players || !Array.isArray(round.players)) continue;
    
    for (const player of round.players) {
      if (player.id && idMapping.has(player.id)) {
        const newId = idMapping.get(player.id);
        if (!player.originalId) {
          player.originalId = player.id;
        }
        player.id = newId;
        updated++;
      }
    }
  }
  
  return updated;
}

/**
 * Update player IDs in final_scores
 */
function updateFinalScores(finalScores, idMapping) {
  if (!finalScores || typeof finalScores !== 'object') return { updated: 0, newScores: finalScores };
  
  let updated = 0;
  const newScores = {};
  
  for (const [oldId, score] of Object.entries(finalScores)) {
    if (idMapping.has(oldId)) {
      const newId = idMapping.get(oldId);
      newScores[newId] = score;
      updated++;
    } else {
      newScores[oldId] = score;
    }
  }
  
  return { updated, newScores };
}

/**
 * Update winner_id
 */
function updateWinnerId(gameData, idMapping) {
  let updated = false;
  
  if (gameData.winner_id && idMapping.has(gameData.winner_id)) {
    if (!gameData.original_winner_id) {
      gameData.original_winner_id = gameData.winner_id;
    }
    gameData.winner_id = idMapping.get(gameData.winner_id);
    updated = true;
  }
  
  if (Array.isArray(gameData.winner_ids)) {
    const newWinnerIds = gameData.winner_ids.map(id => 
      idMapping.has(id) ? idMapping.get(id) : id
    );
    if (JSON.stringify(newWinnerIds) !== JSON.stringify(gameData.winner_ids)) {
      if (!gameData.original_winner_ids) {
        gameData.original_winner_ids = [...gameData.winner_ids];
      }
      gameData.winner_ids = newWinnerIds;
      updated = true;
    }
  }
  
  return updated;
}

/**
 * Process a single game (TableGame or WizardGame)
 */
async function processGame(game, gameType) {
  try {
    const gameData = game.gameData?.gameData || game.gameData;
    
    if (!gameData || !gameData.players || !Array.isArray(gameData.players)) {
      log(`Skipping ${gameType} ${game._id} - no players array`, true);
      stats.gamesSkipped++;
      return false;
    }
    
    // Check if any player has identityId
    const hasIdentities = gameData.players.some(p => p.identityId);
    if (!hasIdentities) {
      log(`Skipping ${gameType} ${game._id} - no identities migrated yet`, true);
      stats.gamesSkipped++;
      return false;
    }
    
    // Build ID mapping
    const idMapping = await buildIdMapping(gameData.players);
    
    if (idMapping.size === 0) {
      log(`Skipping ${gameType} ${game._id} - no IDs to update`, true);
      stats.gamesSkipped++;
      return false;
    }
    
    log(`Processing ${gameType} ${game._id} - ${idMapping.size} IDs to update`, true);
    
    // Update players array
    const playersUpdated = await updatePlayersArray(gameData.players, idMapping);
    stats.playersNormalized += playersUpdated;
    
    // Update round_data
    const roundsUpdated = updateRoundData(gameData.round_data, idMapping);
    stats.roundDataUpdated += roundsUpdated;
    
    // Update final_scores
    const { updated: scoresUpdated, newScores } = updateFinalScores(gameData.final_scores, idMapping);
    if (scoresUpdated > 0) {
      gameData.final_scores = newScores;
      stats.finalScoresUpdated += scoresUpdated;
    }
    
    // Update winner_id
    updateWinnerId(gameData, idMapping);
    
    if (playersUpdated > 0 || roundsUpdated > 0 || scoresUpdated > 0) {
      if (!DRY_RUN) {
        // Mark the nested field as modified
        if (game.gameData.gameData) {
          game.gameData.gameData = gameData;
        }
        game.markModified('gameData');
        game.idsNormalized = true;
        game.idsNormalizedAt = new Date();
        await game.save();
        log(`Updated ${gameType} ${game._id}: ${playersUpdated} players, ${roundsUpdated} round entries, ${scoresUpdated} scores`, true);
      } else {
        log(`[DRY-RUN] Would update ${gameType} ${game._id}: ${playersUpdated} players, ${roundsUpdated} round entries, ${scoresUpdated} scores`, true);
      }
      stats.gamesUpdated++;
      return true;
    }
    
    return false;
  } catch (error) {
    logError(`Failed to process ${gameType} ${game._id}`, error);
    return false;
  }
}

async function run() {
  await connectDB();
  
  log('=== Normalizing Player IDs in Games ===');
  if (DRY_RUN) {
    log('DRY RUN MODE - No changes will be made');
  }
  
  // Pre-load all identities into cache
  log('Loading identities into cache...');
  const identities = await PlayerIdentity.find({ isDeleted: false }).select('_id userId');
  for (const identity of identities) {
    const normalizedId = identity.userId || identity._id;
    identityToIdCache.set(identity._id.toString(), normalizedId);
  }
  log(`Cached ${identities.length} identities`);
  
  // Process TableGames
  log('\n--- Processing TableGames ---');
  const tableGames = await TableGame.find({
    'gameData.players.identityId': { $exists: true }
  });
  log(`Found ${tableGames.length} TableGames with identities`);
  
  for (const game of tableGames) {
    stats.gamesProcessed++;
    await processGame(game, 'TableGame');
  }
  
  // Process WizardGames
  log('\n--- Processing WizardGames ---');
  const wizardGames = await WizardGame.find({
    'gameData.players.identityId': { $exists: true }
  });
  log(`Found ${wizardGames.length} WizardGames with identities`);
  
  for (const game of wizardGames) {
    stats.gamesProcessed++;
    await processGame(game, 'WizardGame');
  }
  
  log('\n=== Complete ===');
  log(`Games processed: ${stats.gamesProcessed}`);
  log(`Games updated: ${stats.gamesUpdated}`);
  log(`Games skipped: ${stats.gamesSkipped}`);
  log(`Players normalized: ${stats.playersNormalized}`);
  log(`Round data entries updated: ${stats.roundDataUpdated}`);
  log(`Final scores updated: ${stats.finalScoresUpdated}`);
  log(`Errors: ${stats.errors.length}`);
  
  if (stats.errors.length > 0) {
    log('\nErrors:');
    stats.errors.forEach((e, i) => {
      console.error(`  ${i + 1}. ${e.message}: ${e.error}`);
    });
  }
  
  await mongoose.disconnect();
  log('Disconnected from MongoDB');
}

run().catch(error => {
  console.error('Script failed:', error.message);
  process.exit(1);
});
