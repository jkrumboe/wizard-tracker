#!/usr/bin/env node
/**
 * Backfill Templates → PostgreSQL
 * 
 * Migrates SystemGameTemplate, UserGameTemplate, and TemplateSuggestion
 * documents from MongoDB to PostgreSQL.
 * 
 * Usage:
 *   node scripts/backfill-templates.js              # Full migration
 *   node scripts/backfill-templates.js --dry-run    # Preview only
 *   node scripts/backfill-templates.js --batch 200  # Custom batch size
 */

require('dotenv').config();
const { connectDatabases, disconnectDatabases, getPrisma } = require('../database');

const SystemGameTemplate = require('../models/SystemGameTemplate');
const UserGameTemplate = require('../models/UserGameTemplate');
const TemplateSuggestion = require('../models/TemplateSuggestion');

const SystemTemplateRepo = require('../repositories/SystemGameTemplateRepository');
const UserTemplateRepo = require('../repositories/UserGameTemplateRepository');
const SuggestionRepo = require('../repositories/TemplateSuggestionRepository');

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const BATCH_SIZE = args.includes('--batch') ? parseInt(args[args.indexOf('--batch') + 1]) : 100;

async function backfillSystemTemplates(prisma) {
  console.log('\n📋 Backfilling System Game Templates...');
  const total = await SystemGameTemplate.countDocuments();
  let migrated = 0;
  let skipped = 0;
  let failed = 0;

  const templates = await SystemGameTemplate.find().sort({ createdAt: 1 }).lean();

  for (const tmpl of templates) {
    try {
      if (DRY_RUN) {
        console.log(`  [DRY RUN] Would migrate system template: ${tmpl.name}`);
        migrated++;
        continue;
      }

      await SystemTemplateRepo.createFromMongo(prisma, tmpl);
      migrated++;
    } catch (error) {
      if (error.code === 'P2002') {
        skipped++;
      } else {
        failed++;
        if (failed <= 10) {
          console.warn(`  ⚠️  Failed system template ${tmpl.name}: ${error.message}`);
        }
      }
    }
  }

  console.log(`  ✅ System Templates: ${migrated} migrated, ${skipped} skipped, ${failed} failed (of ${total})`);
  return { migrated, skipped, failed, total };
}

async function backfillUserTemplates(prisma) {
  console.log('\n📝 Backfilling User Game Templates...');
  const total = await UserGameTemplate.countDocuments();
  let migrated = 0;
  let skipped = 0;
  let failed = 0;

  for (let skip = 0; skip < total; skip += BATCH_SIZE) {
    const templates = await UserGameTemplate.find()
      .sort({ createdAt: 1 })
      .skip(skip)
      .limit(BATCH_SIZE)
      .lean();

    for (const tmpl of templates) {
      try {
        if (DRY_RUN) {
          console.log(`  [DRY RUN] Would migrate user template: ${tmpl.name} (user: ${tmpl.userId})`);
          migrated++;
          continue;
        }

        await UserTemplateRepo.createFromMongo(prisma, tmpl);
        migrated++;
      } catch (error) {
        if (error.code === 'P2002') {
          skipped++;
        } else if (error.code === 'P2003') {
          skipped++; // FK constraint — user not yet migrated
        } else {
          failed++;
          if (failed <= 10) {
            console.warn(`  ⚠️  Failed user template ${tmpl.name}: ${error.message}`);
          }
        }
      }
    }

    const progress = Math.min(skip + BATCH_SIZE, total);
    process.stdout.write(`\r  Progress: ${progress}/${total} (migrated: ${migrated}, skipped: ${skipped}, failed: ${failed})`);
  }

  console.log(`\n  ✅ User Templates: ${migrated} migrated, ${skipped} skipped, ${failed} failed (of ${total})`);
  return { migrated, skipped, failed, total };
}

async function backfillSuggestions(prisma) {
  console.log('\n💡 Backfilling Template Suggestions...');
  const total = await TemplateSuggestion.countDocuments();
  let migrated = 0;
  let skipped = 0;
  let failed = 0;

  const suggestions = await TemplateSuggestion.find().sort({ createdAt: 1 }).lean();

  for (const suggestion of suggestions) {
    try {
      if (DRY_RUN) {
        console.log(`  [DRY RUN] Would migrate suggestion: ${suggestion.name}`);
        migrated++;
        continue;
      }

      await SuggestionRepo.createFromMongo(prisma, suggestion);
      migrated++;
    } catch (error) {
      if (error.code === 'P2002') {
        skipped++;
      } else if (error.code === 'P2003') {
        skipped++; // FK constraint
      } else {
        failed++;
        if (failed <= 10) {
          console.warn(`  ⚠️  Failed suggestion ${suggestion.name}: ${error.message}`);
        }
      }
    }
  }

  console.log(`  ✅ Suggestions: ${migrated} migrated, ${skipped} skipped, ${failed} failed (of ${total})`);
  return { migrated, skipped, failed, total };
}

async function main() {
  console.log('🚀 Template Backfill Script');
  console.log(`   Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`);
  console.log(`   Batch size: ${BATCH_SIZE}`);

  try {
    const origEnv = process.env.USE_POSTGRES;
    process.env.USE_POSTGRES = 'true';

    await connectDatabases();
    const prisma = getPrisma();

    // Order matters: system templates first (FKs reference them)
    const systemResult = await backfillSystemTemplates(prisma);
    const userResult = await backfillUserTemplates(prisma);
    const suggestionResult = await backfillSuggestions(prisma);

    console.log('\n\n========================================');
    console.log('📊 Backfill Summary');
    console.log('========================================');
    console.log(`  System Templates:     ${systemResult.migrated}/${systemResult.total} migrated, ${systemResult.skipped} skipped, ${systemResult.failed} failed`);
    console.log(`  User Templates:       ${userResult.migrated}/${userResult.total} migrated, ${userResult.skipped} skipped, ${userResult.failed} failed`);
    console.log(`  Template Suggestions: ${suggestionResult.migrated}/${suggestionResult.total} migrated, ${suggestionResult.skipped} skipped, ${suggestionResult.failed} failed`);

    process.env.USE_POSTGRES = origEnv;
    await disconnectDatabases();

    const anyFailed = systemResult.failed > 0 || userResult.failed > 0 || suggestionResult.failed > 0;
    process.exit(anyFailed ? 1 : 0);
  } catch (error) {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  }
}

main();
