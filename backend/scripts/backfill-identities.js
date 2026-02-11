/**
 * Backfill Player Identities Script
 * 
 * Migrates all PlayerIdentity documents from MongoDB to PostgreSQL
 * Run with: node scripts/backfill-identities.js [--dry-run] [--batch-size=100]
 */

require('dotenv').config();
const mongoose = require('mongoose');
const { connectDatabases, getPrisma } = require('../database');
const PlayerIdentity = require('../models/PlayerIdentity');
const { createFromMongo } = require('../utils/identityDualWrite');

const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const batchSizeArg = args.find(arg => arg.startsWith('--batch-size='));
const BATCH_SIZE = batchSizeArg ? parseInt(batchSizeArg.split('=')[1]) : 100;

const stats = {
  total: 0,
  created: 0,
  skipped: 0,
  failed: 0,
  errors: []
};

async function migrateIdentity(mongoIdentity, prisma) {
  const idStr = mongoIdentity._id.toString();
  const name = mongoIdentity.displayName;

  try {
    // Check if already exists
    const existing = await prisma.playerIdentity.findFirst({
      where: {
        OR: [
          { id: idStr },
          { normalizedName: mongoIdentity.normalizedName }
        ]
      }
    });

    if (existing) {
      console.log(`  ⏭️  Already exists: ${name} (${idStr})`);
      stats.skipped++;
      return;
    }

    if (isDryRun) {
      console.log(`  [DRY RUN] Would create: ${name} (${idStr})`);
      stats.created++;
      return;
    }

    await createFromMongo(prisma, mongoIdentity);
    console.log(`  ✅ Created: ${name} (${idStr})`);
    stats.created++;
  } catch (error) {
    // Handle foreign key constraint failures (userId not in PG yet)
    if (error.message.includes('Foreign key constraint')) {
      console.log(`  ⏭️  FK constraint (user not migrated yet): ${name} (${idStr})`);
      stats.skipped++;
    } else {
      console.error(`  ❌ Failed: ${name} (${idStr}):`, error.message);
      stats.failed++;
      stats.errors.push({ id: idStr, name, error: error.message });
    }
  }
}

async function backfillIdentities() {
  console.log('🎭 PlayerIdentity Backfill: MongoDB → PostgreSQL\n');
  if (isDryRun) console.log('🧪 DRY RUN MODE\n');
  console.log(`⚙️  Batch Size: ${BATCH_SIZE}\n`);

  try {
    console.log('🔌 Connecting to databases...');
    await connectDatabases();
    const prisma = getPrisma();
    console.log('✅ Connected\n');

    const totalIdentities = await PlayerIdentity.countDocuments();
    stats.total = totalIdentities;
    console.log(`📊 Found ${totalIdentities} identities in MongoDB\n`);

    if (totalIdentities === 0) {
      console.log('ℹ️  No identities to migrate');
      return;
    }

    // Process non-deleted first (they're more important), then deleted
    for (const isDeleted of [false, true]) {
      const label = isDeleted ? 'deleted (archived)' : 'active';
      const count = await PlayerIdentity.countDocuments({ isDeleted });
      console.log(`\n📦 Processing ${count} ${label} identities...`);

      let skip = 0;
      let batchNumber = 1;

      while (skip < count) {
        const identities = await PlayerIdentity.find({ isDeleted })
          .sort({ createdAt: 1 })
          .skip(skip)
          .limit(BATCH_SIZE)
          .lean();

        if (identities.length === 0) break;

        console.log(`\n  Batch ${batchNumber} (${identities.length} identities):`);
        for (const identity of identities) {
          await migrateIdentity(identity, prisma);
        }

        skip += identities.length;
        batchNumber++;
      }
    }

    // Print summary
    console.log('\n' + '='.repeat(50));
    console.log('📊 Migration Summary');
    console.log('='.repeat(50));
    console.log(`Total:     ${stats.total}`);
    console.log(`✅ Created: ${stats.created}`);
    console.log(`⏭️  Skipped: ${stats.skipped}`);
    console.log(`❌ Failed:  ${stats.failed}`);
    console.log('='.repeat(50));

    if (stats.errors.length > 0) {
      console.log('\n❌ Errors:');
      stats.errors.forEach((err, i) => {
        console.log(`  ${i + 1}. ${err.name} (${err.id}): ${err.error}`);
      });
    }

    console.log(isDryRun ? '\n🧪 DRY RUN COMPLETE' : '\n✅ Migration complete!');
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    throw error;
  } finally {
    await mongoose.connection.close();
    await getPrisma().$disconnect();
  }
}

if (require.main === module) {
  backfillIdentities()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = { backfillIdentities };
