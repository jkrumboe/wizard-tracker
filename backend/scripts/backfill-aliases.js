#!/usr/bin/env node
/**
 * Backfill Player Aliases → PostgreSQL
 * 
 * Migrates PlayerAlias documents from MongoDB to PostgreSQL.
 * Should be run AFTER backfill-users.js since aliases reference user IDs.
 * 
 * Usage:
 *   node scripts/backfill-aliases.js              # Full migration
 *   node scripts/backfill-aliases.js --dry-run    # Preview only
 */

require('dotenv').config();
const { connectDatabases, disconnectDatabases, getPrisma } = require('../database');
const PlayerAlias = require('../models/PlayerAlias');
const PlayerAliasRepo = require('../repositories/PlayerAliasRepository');

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');

async function main() {
  console.log('🏷️  Player Alias Backfill Script');
  console.log(`   Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`);

  try {
    const origEnv = process.env.USE_POSTGRES;
    process.env.USE_POSTGRES = 'true';

    await connectDatabases();
    const prisma = getPrisma();

    const total = await PlayerAlias.countDocuments();
    let migrated = 0;
    let skipped = 0;
    let failed = 0;

    console.log(`\n📊 Found ${total} aliases in MongoDB\n`);

    const aliases = await PlayerAlias.find().sort({ createdAt: 1 }).lean();

    for (const alias of aliases) {
      try {
        if (DRY_RUN) {
          console.log(`  [DRY RUN] Would migrate alias: ${alias.aliasName}`);
          migrated++;
          continue;
        }

        await PlayerAliasRepo.createFromMongo(prisma, alias);
        migrated++;
      } catch (error) {
        if (error.code === 'P2002') {
          skipped++;
        } else if (error.code === 'P2003') {
          skipped++; // FK — user not migrated
        } else {
          failed++;
          if (failed <= 10) {
            console.warn(`  ⚠️  Failed alias ${alias.aliasName}: ${error.message}`);
          }
        }
      }
    }

    console.log('\n========================================');
    console.log('📊 Backfill Summary');
    console.log('========================================');
    console.log(`  Aliases: ${migrated}/${total} migrated, ${skipped} skipped, ${failed} failed`);

    process.env.USE_POSTGRES = origEnv;
    await disconnectDatabases();
    process.exit(failed > 0 ? 1 : 0);
  } catch (error) {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  }
}

main();
