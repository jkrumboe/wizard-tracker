#!/usr/bin/env node
/**
 * Backfill Game Events & Snapshots → PostgreSQL
 * 
 * Migrates GameEvent and GameSnapshot documents from MongoDB to PostgreSQL.
 * Should be run AFTER backfill-games.js since events reference game IDs.
 * 
 * Usage:
 *   node scripts/backfill-game-events.js              # Full migration
 *   node scripts/backfill-game-events.js --dry-run    # Preview only
 *   node scripts/backfill-game-events.js --batch 500  # Custom batch size
 */

require('dotenv').config();
const { connectDatabases, disconnectDatabases, getPrisma } = require('../database');

// MongoDB models
const GameEvent = require('../models/GameEvent');
const GameSnapshot = require('../models/GameSnapshot');

// Repositories
const GameEventRepo = require('../repositories/GameEventRepository');
const GameSnapshotRepo = require('../repositories/GameSnapshotRepository');

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const BATCH_SIZE = args.includes('--batch') ? parseInt(args[args.indexOf('--batch') + 1]) : 200;

async function backfillGameEvents(prisma) {
  console.log('\n⚡ Backfilling Game Events...');
  const total = await GameEvent.countDocuments();
  let migrated = 0;
  let skipped = 0;
  let failed = 0;

  for (let skip = 0; skip < total; skip += BATCH_SIZE) {
    const events = await GameEvent.find()
      .sort({ createdAt: 1 })
      .skip(skip)
      .limit(BATCH_SIZE)
      .lean();

    for (const event of events) {
      try {
        if (DRY_RUN) {
          migrated++;
          continue;
        }

        await GameEventRepo.createFromMongo(prisma, event);
        migrated++;
      } catch (error) {
        if (error.code === 'P2002') {
          skipped++; // Already exists (duplicate eventId+gameId)
        } else {
          failed++;
          if (failed <= 10) {
            console.warn(`  ⚠️  Failed event ${event.id}: ${error.message}`);
          }
        }
      }
    }

    const progress = Math.min(skip + BATCH_SIZE, total);
    process.stdout.write(`\r  Progress: ${progress}/${total} (migrated: ${migrated}, skipped: ${skipped}, failed: ${failed})`);
  }

  console.log(`\n  ✅ Game Events: ${migrated} migrated, ${skipped} skipped, ${failed} failed (of ${total})`);
  return { migrated, skipped, failed, total };
}

async function backfillGameSnapshots(prisma) {
  console.log('\n📸 Backfilling Game Snapshots...');
  const total = await GameSnapshot.countDocuments();
  let migrated = 0;
  let skipped = 0;
  let failed = 0;

  for (let skip = 0; skip < total; skip += BATCH_SIZE) {
    const snapshots = await GameSnapshot.find()
      .sort({ createdAt: 1 })
      .skip(skip)
      .limit(BATCH_SIZE)
      .lean();

    for (const snapshot of snapshots) {
      try {
        if (DRY_RUN) {
          migrated++;
          continue;
        }

        await GameSnapshotRepo.createFromMongo(prisma, snapshot);
        migrated++;
      } catch (error) {
        if (error.code === 'P2002') {
          skipped++;
        } else {
          failed++;
          if (failed <= 10) {
            console.warn(`  ⚠️  Failed snapshot (game=${snapshot.gameId} v${snapshot.serverVersion}): ${error.message}`);
          }
        }
      }
    }

    const progress = Math.min(skip + BATCH_SIZE, total);
    process.stdout.write(`\r  Progress: ${progress}/${total} (migrated: ${migrated}, skipped: ${skipped}, failed: ${failed})`);
  }

  console.log(`\n  ✅ Game Snapshots: ${migrated} migrated, ${skipped} skipped, ${failed} failed (of ${total})`);
  return { migrated, skipped, failed, total };
}

async function main() {
  console.log('🚀 Game Events & Snapshots Backfill Script');
  console.log(`   Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`);
  console.log(`   Batch size: ${BATCH_SIZE}`);

  try {
    const origEnv = process.env.USE_POSTGRES;
    process.env.USE_POSTGRES = 'true';

    await connectDatabases();
    const prisma = getPrisma();

    const eventsResult = await backfillGameEvents(prisma);
    const snapshotsResult = await backfillGameSnapshots(prisma);

    console.log('\n\n========================================');
    console.log('📊 Backfill Summary');
    console.log('========================================');
    console.log(`  Events:    ${eventsResult.migrated}/${eventsResult.total} migrated, ${eventsResult.skipped} skipped, ${eventsResult.failed} failed`);
    console.log(`  Snapshots: ${snapshotsResult.migrated}/${snapshotsResult.total} migrated, ${snapshotsResult.skipped} skipped, ${snapshotsResult.failed} failed`);

    process.env.USE_POSTGRES = origEnv;
    await disconnectDatabases();

    const anyFailed = eventsResult.failed > 0 || snapshotsResult.failed > 0;
    process.exit(anyFailed ? 1 : 0);
  } catch (error) {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  }
}

main();
