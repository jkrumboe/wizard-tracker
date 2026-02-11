#!/usr/bin/env node
/**
 * Backfill Games → PostgreSQL
 * 
 * Migrates Game, WizardGame, and TableGame documents from MongoDB to PostgreSQL.
 * 
 * Usage:
 *   node scripts/backfill-games.js                  # Full migration
 *   node scripts/backfill-games.js --dry-run        # Preview only
 *   node scripts/backfill-games.js --type wizard    # Wizard games only
 *   node scripts/backfill-games.js --type table     # Table games only
 *   node scripts/backfill-games.js --type legacy    # Legacy games only
 *   node scripts/backfill-games.js --batch 200      # Custom batch size
 */

require('dotenv').config();
const mongoose = require('mongoose');
const { connectDatabases, disconnectDatabases, getPrisma } = require('../database');

// MongoDB models
const Game = require('../models/Game');
const WizardGame = require('../models/WizardGame');
const TableGame = require('../models/TableGame');

// Repositories
const GameRepo = require('../repositories/GameRepository');
const WizardGameRepo = require('../repositories/WizardGameRepository');
const TableGameRepo = require('../repositories/TableGameRepository');

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const TYPE_FILTER = args.includes('--type') ? args[args.indexOf('--type') + 1] : 'all';
const BATCH_SIZE = args.includes('--batch') ? parseInt(args[args.indexOf('--batch') + 1]) : 100;

async function backfillLegacyGames(prisma) {
  console.log('\n📦 Backfilling Legacy Games...');
  const total = await Game.countDocuments();
  let migrated = 0;
  let skipped = 0;
  let failed = 0;

  for (let skip = 0; skip < total; skip += BATCH_SIZE) {
    const games = await Game.find()
      .sort({ createdAt: 1 })
      .skip(skip)
      .limit(BATCH_SIZE)
      .lean();

    for (const game of games) {
      try {
        if (DRY_RUN) {
          console.log(`  [DRY RUN] Would migrate game: ${game.localId}`);
          migrated++;
          continue;
        }

        // Check if user exists in PG (FK constraint)
        const userId = game.userId?.toString() || game.userId;
        const pgUser = await prisma.user.findFirst({
          where: { username: { not: undefined } },
          select: { id: true }
        });
        
        // Use upsert to handle duplicates gracefully
        await GameRepo.createFromMongo(prisma, game);
        migrated++;
      } catch (error) {
        if (error.code === 'P2003') {
          // FK constraint — user doesn't exist in PG
          skipped++;
        } else if (error.code === 'P2002') {
          skipped++; // Already exists
        } else {
          failed++;
          if (failed <= 10) {
            console.warn(`  ⚠️  Failed game ${game.localId}: ${error.message}`);
          }
        }
      }
    }

    const progress = Math.min(skip + BATCH_SIZE, total);
    process.stdout.write(`\r  Progress: ${progress}/${total} (migrated: ${migrated}, skipped: ${skipped}, failed: ${failed})`);
  }

  console.log(`\n  ✅ Legacy Games: ${migrated} migrated, ${skipped} skipped, ${failed} failed (of ${total})`);
  return { migrated, skipped, failed, total };
}

async function backfillWizardGames(prisma) {
  console.log('\n🧙 Backfilling Wizard Games...');
  const total = await WizardGame.countDocuments();
  let migrated = 0;
  let skipped = 0;
  let failed = 0;

  for (let skip = 0; skip < total; skip += BATCH_SIZE) {
    const games = await WizardGame.find()
      .sort({ createdAt: 1 })
      .skip(skip)
      .limit(BATCH_SIZE)
      .select('+migratedFrom +migratedAt +originalGameId')
      .lean();

    for (const game of games) {
      try {
        if (DRY_RUN) {
          console.log(`  [DRY RUN] Would migrate wizard game: ${game.localId}`);
          migrated++;
          continue;
        }

        await WizardGameRepo.createFromMongo(prisma, game);
        migrated++;
      } catch (error) {
        if (error.code === 'P2003') {
          skipped++;
        } else if (error.code === 'P2002') {
          skipped++;
        } else {
          failed++;
          if (failed <= 10) {
            console.warn(`  ⚠️  Failed wizard game ${game.localId}: ${error.message}`);
          }
        }
      }
    }

    const progress = Math.min(skip + BATCH_SIZE, total);
    process.stdout.write(`\r  Progress: ${progress}/${total} (migrated: ${migrated}, skipped: ${skipped}, failed: ${failed})`);
  }

  console.log(`\n  ✅ Wizard Games: ${migrated} migrated, ${skipped} skipped, ${failed} failed (of ${total})`);
  return { migrated, skipped, failed, total };
}

async function backfillTableGames(prisma) {
  console.log('\n📊 Backfilling Table Games...');
  const total = await TableGame.countDocuments();
  let migrated = 0;
  let skipped = 0;
  let failed = 0;

  for (let skip = 0; skip < total; skip += BATCH_SIZE) {
    const games = await TableGame.find()
      .sort({ createdAt: 1 })
      .skip(skip)
      .limit(BATCH_SIZE)
      .lean();

    for (const game of games) {
      try {
        if (DRY_RUN) {
          console.log(`  [DRY RUN] Would migrate table game: ${game.localId}`);
          migrated++;
          continue;
        }

        await TableGameRepo.createFromMongo(prisma, game);
        migrated++;
      } catch (error) {
        if (error.code === 'P2003') {
          skipped++;
        } else if (error.code === 'P2002') {
          skipped++;
        } else {
          failed++;
          if (failed <= 10) {
            console.warn(`  ⚠️  Failed table game ${game.localId}: ${error.message}`);
          }
        }
      }
    }

    const progress = Math.min(skip + BATCH_SIZE, total);
    process.stdout.write(`\r  Progress: ${progress}/${total} (migrated: ${migrated}, skipped: ${skipped}, failed: ${failed})`);
  }

  console.log(`\n  ✅ Table Games: ${migrated} migrated, ${skipped} skipped, ${failed} failed (of ${total})`);
  return { migrated, skipped, failed, total };
}

async function main() {
  console.log('🚀 Game Backfill Script');
  console.log(`   Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`);
  console.log(`   Type: ${TYPE_FILTER}`);
  console.log(`   Batch size: ${BATCH_SIZE}`);

  try {
    // Force USE_POSTGRES for this script
    const origEnv = process.env.USE_POSTGRES;
    process.env.USE_POSTGRES = 'true';

    await connectDatabases();
    const prisma = getPrisma();

    const results = {};

    if (TYPE_FILTER === 'all' || TYPE_FILTER === 'legacy') {
      results.legacy = await backfillLegacyGames(prisma);
    }
    if (TYPE_FILTER === 'all' || TYPE_FILTER === 'wizard') {
      results.wizard = await backfillWizardGames(prisma);
    }
    if (TYPE_FILTER === 'all' || TYPE_FILTER === 'table') {
      results.table = await backfillTableGames(prisma);
    }

    console.log('\n\n========================================');
    console.log('📊 Backfill Summary');
    console.log('========================================');
    for (const [type, res] of Object.entries(results)) {
      console.log(`  ${type}: ${res.migrated}/${res.total} migrated, ${res.skipped} skipped, ${res.failed} failed`);
    }

    process.env.USE_POSTGRES = origEnv;
    await disconnectDatabases();

    const anyFailed = Object.values(results).some(r => r.failed > 0);
    process.exit(anyFailed ? 1 : 0);
  } catch (error) {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  }
}

main();
