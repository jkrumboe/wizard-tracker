/**
 * Migrate Games for Specific User
 * Run: node scripts/migrate-user-games.js <userId>
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Game = require('../models/Game');
const WizardGame = require('../models/WizardGame');
const { migrateWizardGame, validateMigratedGame } = require('../utils/wizardGameMigration');
const { validateWizardGameData } = require('../schemas/wizardGameSchema');

const userId = process.argv[2];
const DRY_RUN = process.env.DRY_RUN === 'true';

if (!userId) {
  console.error('❌ Usage: node scripts/migrate-user-games.js <userId>');
  console.error('   Example: node scripts/migrate-user-games.js 68b6434852044fa6096ee4cf');
  process.exit(1);
}

async function migrateUserGames() {
  try {
    console.log(`🚀 Migrating games for user: ${userId}`);
    console.log(`   Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE MIGRATION'}\n`);

    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB\n');

    // Find user's games
    const userGames = await Game.find({ userId: userId });
    console.log(`📊 Found ${userGames.length} games for this user\n`);

    if (userGames.length === 0) {
      console.log('ℹ️  No games found for this user');
      await mongoose.connection.close();
      return;
    }

    const stats = {
      total: userGames.length,
      successful: 0,
      skipped: 0,
      failed: 0,
      errors: []
    };

    for (const game of userGames) {
      try {
        // Check if already migrated
        const existing = await WizardGame.findOne({ localId: game.localId });
        if (existing) {
          stats.skipped++;
          console.log(`⏭️  Skipped: ${game.localId} (already migrated)`);
          continue;
        }

        // Migrate
        const { migrated, originalVersion, error } = migrateWizardGame(game.gameData);

        if (error) {
          stats.failed++;
          stats.errors.push({ localId: game.localId, error });
          console.log(`❌ Failed: ${game.localId} - ${error}`);
          continue;
        }

        // Validate
        const migrationValidation = validateMigratedGame(migrated);
        const schemaValidation = validateWizardGameData(migrated);

        if (!migrationValidation.isValid || !schemaValidation.isValid) {
          stats.failed++;
          stats.errors.push({
            localId: game.localId,
            error: 'Validation failed',
            details: [...migrationValidation.errors, ...schemaValidation.errors]
          });
          console.log(`❌ Failed: ${game.localId} - Validation failed`);
          continue;
        }

        // Save
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
        console.log(`✅ Migrated: ${game.localId} (v${originalVersion} → v3.0)`);

      } catch (err) {
        stats.failed++;
        stats.errors.push({ localId: game.localId, error: err.message });
        console.log(`❌ Failed: ${game.localId} - ${err.message}`);
      }
    }

    // Summary
    console.log('\n═══════════════════════════════════════');
    console.log('📊 MIGRATION SUMMARY');
    console.log('═══════════════════════════════════════');
    console.log(`Total:      ${stats.total}`);
    console.log(`✅ Success: ${stats.successful}`);
    console.log(`⏭️  Skipped: ${stats.skipped}`);
    console.log(`❌ Failed:  ${stats.failed}`);

    if (stats.errors.length > 0) {
      console.log('\nErrors:');
      stats.errors.forEach((err, idx) => {
        console.log(`  ${idx + 1}. ${err.localId}: ${err.error}`);
      });
    }

    if (DRY_RUN) {
      console.log('\nℹ️  DRY RUN - No changes saved');
    }

    console.log('═══════════════════════════════════════\n');

    await mongoose.connection.close();
    process.exit(stats.failed > 0 ? 1 : 0);

  } catch (error) {
    console.error('💥 Fatal error:', error);
    await mongoose.connection.close();
    process.exit(1);
  }
}

migrateUserGames();
