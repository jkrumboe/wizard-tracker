/**
 * Bulk Migration Script
 * Migrates all games from 'games' collection to 'wizard' collection
 * Run: node scripts/migrate-all-games.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Game = require('../models/Game');
const WizardGame = require('../models/WizardGame');
const { migrateWizardGame, validateMigratedGame } = require('../utils/wizardGameMigration');
const { validateWizardGameData } = require('../schemas/wizardGameSchema');

// Configuration
const BATCH_SIZE = 100; // Process games in batches
const DRY_RUN = process.env.DRY_RUN === 'true'; // Set to true to test without saving

async function migrateAllGames() {
  try {
    console.log('🚀 Starting bulk migration of wizard games...');
    console.log(`   Mode: ${DRY_RUN ? 'DRY RUN (no changes will be saved)' : 'LIVE MIGRATION'}`);
    console.log(`   Batch size: ${BATCH_SIZE}`);
    console.log('');

    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB\n');

    // Get total count
    const totalGames = await Game.countDocuments();
    console.log(`📊 Found ${totalGames} total games in 'games' collection`);

    // Check how many already migrated
    const alreadyMigrated = await WizardGame.countDocuments();
    console.log(`📊 Currently ${alreadyMigrated} games in 'wizard' collection\n`);

    // Statistics
    const stats = {
      total: 0,
      successful: 0,
      skipped: 0,
      failed: 0,
      byVersion: {
        '1.0': 0,
        '2.0': 0,
        '3.0': 0,
        'unknown': 0
      },
      errors: []
    };

    // Process in batches
    let skip = 0;
    let batchNumber = 1;

    while (skip < totalGames) {
      console.log(`\n📦 Processing batch ${batchNumber} (games ${skip + 1}-${Math.min(skip + BATCH_SIZE, totalGames)})...`);

      const batch = await Game.find()
        .skip(skip)
        .limit(BATCH_SIZE)
        .lean();

      for (const game of batch) {
        stats.total++;

        try {
          // Check if already migrated
          const existing = await WizardGame.findOne({ localId: game.localId });
          if (existing) {
            stats.skipped++;
            console.log(`  ⏭️  Skipped: ${game.localId} (already migrated)`);
            continue;
          }

          // Migrate the game
          const { migrated, originalVersion, needsMigration, error } = migrateWizardGame(game.gameData);

          if (error) {
            stats.failed++;
            stats.errors.push({
              gameId: game._id,
              localId: game.localId,
              error: error
            });
            console.log(`  ❌ Failed: ${game.localId} - ${error}`);
            continue;
          }

          // Track version
          stats.byVersion[originalVersion] = (stats.byVersion[originalVersion] || 0) + 1;

          // Validate migration
          const migrationValidation = validateMigratedGame(migrated);
          if (!migrationValidation.isValid) {
            stats.failed++;
            stats.errors.push({
              gameId: game._id,
              localId: game.localId,
              error: 'Migration validation failed',
              details: migrationValidation.errors
            });
            console.log(`  ❌ Failed: ${game.localId} - Migration validation failed`);
            continue;
          }

          // Schema validation
          const schemaValidation = validateWizardGameData(migrated);
          if (!schemaValidation.isValid) {
            stats.failed++;
            stats.errors.push({
              gameId: game._id,
              localId: game.localId,
              error: 'Schema validation failed',
              details: schemaValidation.errors
            });
            console.log(`  ❌ Failed: ${game.localId} - Schema validation failed`);
            continue;
          }

          // Create wizard game
          if (!DRY_RUN) {
            const wizardGame = new WizardGame({
              userId: game.userId,
              localId: game.localId,
              gameData: migrated,
              migratedFrom: originalVersion,
              migratedAt: new Date(),
              originalGameId: game._id,
              isShared: game.isShared || false,
              shareId: game.shareId || null,
              sharedAt: game.sharedAt || null
            });

            await wizardGame.save();
          }

          stats.successful++;
          console.log(`  ✅ Migrated: ${game.localId} (v${originalVersion} → v3.0)`);

        } catch (err) {
          stats.failed++;
          stats.errors.push({
            gameId: game._id,
            localId: game.localId,
            error: err.message
          });
          console.log(`  ❌ Failed: ${game.localId} - ${err.message}`);
        }
      }

      skip += BATCH_SIZE;
      batchNumber++;

      // Progress update
      const progress = Math.min((skip / totalGames) * 100, 100).toFixed(1);
      console.log(`\n📈 Progress: ${progress}% (${Math.min(skip, totalGames)}/${totalGames} games processed)`);
    }

    // Final report
    console.log('\n');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('📊 MIGRATION COMPLETE');
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`Total games processed:    ${stats.total}`);
    console.log(`✅ Successfully migrated: ${stats.successful}`);
    console.log(`⏭️  Skipped (existing):    ${stats.skipped}`);
    console.log(`❌ Failed:                ${stats.failed}`);
    console.log('');
    console.log('By version:');
    console.log(`  v1.0 (nested gameState):  ${stats.byVersion['1.0']}`);
    console.log(`  v2.0 (flat player_ids):   ${stats.byVersion['2.0']}`);
    console.log(`  v3.0 (already clean):     ${stats.byVersion['3.0']}`);
    console.log(`  Unknown format:           ${stats.byVersion['unknown']}`);
    console.log('');

    if (stats.errors.length > 0) {
      console.log('❌ Errors:');
      stats.errors.slice(0, 10).forEach((err, idx) => {
        console.log(`  ${idx + 1}. ${err.localId}: ${err.error}`);
        if (err.details) {
          console.log(`     Details: ${JSON.stringify(err.details).slice(0, 100)}...`);
        }
      });
      if (stats.errors.length > 10) {
        console.log(`  ... and ${stats.errors.length - 10} more errors`);
      }
      console.log('');
    }

    if (DRY_RUN) {
      console.log('ℹ️  DRY RUN MODE - No changes were saved to database');
      console.log('   Run without DRY_RUN=true to perform actual migration');
    } else {
      console.log('✅ Games have been migrated to wizard collection');
      console.log('⚠️  Original games remain in games collection for safety');
    }

    console.log('═══════════════════════════════════════════════════════════\n');

    await mongoose.connection.close();
    console.log('✅ Database connection closed');

    process.exit(stats.failed > 0 ? 1 : 0);

  } catch (error) {
    console.error('💥 Fatal error during migration:', error);
    await mongoose.connection.close();
    process.exit(1);
  }
}

// Run migration
migrateAllGames();
