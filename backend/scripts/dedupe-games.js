#!/usr/bin/env node
/**
 * Remove Duplicate Games
 *
 * Finds game documents that describe the same played game (same players, same
 * round count, same final scores) and keeps exactly one of them, so the games
 * timeline stops showing a game twice. Wizard games must also share the play day;
 * table games, whose team names are often generic, the exact start time.
 *
 * Duplicates exist because the content-based check on upload was added later:
 * before that, the same game could land in the database twice - uploaded by two
 * players, or re-uploaded from a second device under a different localId.
 *
 * The script is READ-ONLY unless --apply is passed. Every removed document is
 * written to a backup file first, and the kept document records what was merged
 * into it (gameData.mergedDuplicates).
 *
 * Usage:
 *   # 1. See what would happen (safe, no changes)
 *   node scripts/dedupe-games.js
 *   node scripts/dedupe-games.js --verbose
 *
 *   # 2. Apply: delete duplicates, back them up, then recalculate ELO
 *   node scripts/dedupe-games.js --apply
 *
 *   # In production (docker compose)
 *   docker compose exec backend node scripts/dedupe-games.js
 *   docker compose exec backend node scripts/dedupe-games.js --apply
 *
 * Options:
 *   --apply             Actually delete duplicates (default: dry run)
 *   --verbose, -v       List every duplicate group
 *   --game-type=wizard  Only scan wizard games (or =table)
 *   --ignore-date       Match duplicates even when the stored dates differ
 *   --same-user-only    Only treat games uploaded by the same user as duplicates
 *   --purge-events      Also delete sync events belonging to removed games
 *   --skip-elo          Do not recalculate ELO after applying
 *   --backup=<path>     Backup file location (default: ./dedupe-backup-<ts>.json)
 *   --no-backup         Skip the backup file (not recommended)
 *
 * Environment:
 *   MONGO_URI - MongoDB connection string
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

// Models must be registered before the service resolves them
require('../models/WizardGame');
require('../models/TableGame');
require('../models/GameEvent');
require('../models/PlayerIdentity');

const {
  findDuplicateGames,
  removeDuplicateGroups,
  countOrphanEvents,
  unwrapGameData
} = require('../utils/gameDedupService');

const args = process.argv.slice(2);
const hasFlag = (...names) => names.some(name => args.includes(name));
const getValue = (name, fallback = null) => {
  const arg = args.find(item => item.startsWith(`${name}=`));
  return arg ? arg.slice(name.length + 1) : fallback;
};

const apply = hasFlag('--apply');
const verbose = hasFlag('--verbose', '-v');
const includeDate = !hasFlag('--ignore-date');
const sameUserOnly = hasFlag('--same-user-only');
const purgeEvents = hasFlag('--purge-events');
const skipElo = hasFlag('--skip-elo');
const noBackup = hasFlag('--no-backup');
const gameType = getValue('--game-type');
const backupPath = getValue(
  '--backup',
  path.resolve(process.cwd(), `dedupe-backup-${new Date().toISOString().replace(/[:.]/g, '-')}.json`)
);

if (gameType && !['wizard', 'table'].includes(gameType)) {
  console.error(`❌ Unknown --game-type=${gameType} (expected "wizard" or "table")`);
  process.exit(1);
}

/** One-line description of a game document for the report. */
function describe(doc) {
  const gameData = unwrapGameData(doc);
  const players = (gameData.players || [])
    .map(player => player?.name || player)
    .filter(Boolean)
    .join(', ');
  const played = gameData.created_at || doc.createdAt;
  const rounds = doc.totalRounds ?? gameData.total_rounds ?? gameData.rows ?? '?';
  return `${doc._id}  ${new Date(played).toISOString()}  rounds=${rounds}  [${players}]  localId=${doc.localId}  user=${doc.userId}`;
}

function reportCollection(label, result) {
  const duplicateCount = result.groups.reduce((sum, group) => sum + group.remove.length, 0);

  console.log(`\n${label}`);
  console.log(`  Scanned:            ${result.scanned}`);
  console.log(`  Not comparable:     ${result.skipped} (no players/scores - never touched)`);
  console.log(`  Duplicate groups:   ${result.groups.length}`);
  console.log(`  Documents to remove:${String(duplicateCount).padStart(4)}`);

  if (verbose) {
    result.groups.forEach((group, index) => {
      console.log(`\n  Group ${index + 1} (${group.remove.length + 1} copies)`);
      console.log(`    KEEP   ${describe(group.keep)}`);
      group.remove.forEach(doc => console.log(`    REMOVE ${describe(doc)}`));
    });
  }

  return duplicateCount;
}

function writeBackup(duplicates) {
  const payload = {
    createdAt: new Date().toISOString(),
    options: { includeDate, sameUserOnly, gameType: gameType || 'all', purgeEvents },
    ...duplicates
  };
  fs.writeFileSync(backupPath, JSON.stringify(payload, null, 2), 'utf8');
  console.log(`\n💾 Backup written to ${backupPath}`);
}

async function main() {
  console.log('╔════════════════════════════════════════════════╗');
  console.log('║   Duplicate Game Cleanup                       ║');
  console.log('╚════════════════════════════════════════════════╝\n');

  const mongoUri = process.env.MONGO_URI;
  if (!mongoUri) {
    console.error('❌ MONGO_URI environment variable is not set');
    process.exit(1);
  }

  console.log(`Mode:        ${apply ? '⚠️  APPLY (documents will be deleted)' : '🔍 dry run (no changes)'}`);
  console.log(`Date match:  ${includeDate ? 'wizard: same day, table: same start time' : 'ignored (--ignore-date)'}`);
  console.log(`Scope:       ${sameUserOnly ? 'same uploader only' : 'all uploaders'}${gameType ? `, ${gameType} games only` : ''}`);

  await mongoose.connect(mongoUri);
  console.log('✅ Connected to database');

  const duplicates = await findDuplicateGames({ includeDate, sameUserOnly, collection: gameType });

  const wizardCount = reportCollection('🧙 Wizard games', duplicates.wizard);
  const tableCount = reportCollection('🎲 Table games', duplicates.table);
  const total = wizardCount + tableCount;

  const allGroups = [...duplicates.wizard.groups, ...duplicates.table.groups];
  const orphanEvents = await countOrphanEvents(allGroups);
  if (orphanEvents > 0) {
    console.log(`\n📎 Sync events attached to removed games: ${orphanEvents}${purgeEvents ? ' (will be deleted)' : ' (left in place, use --purge-events to delete)'}`);
  }

  if (total === 0) {
    console.log('\n✅ No duplicate games found - the timeline is clean.');
    return;
  }

  if (!apply) {
    console.log(`\n🔍 Dry run complete: ${total} duplicate document(s) would be removed.`);
    console.log('   Re-run with --apply to remove them (add --verbose to inspect each group first).');
    return;
  }

  if (!noBackup) {
    writeBackup(duplicates);
  }

  console.log('\n🗑️  Removing duplicates...');
  const wizardStats = await removeDuplicateGroups(duplicates.wizard.groups, 'WizardGame', { purgeEvents });
  const tableStats = await removeDuplicateGroups(duplicates.table.groups, 'TableGame', { purgeEvents });

  console.log(`   Wizard games removed: ${wizardStats.removed} (${wizardStats.groupsProcessed} groups)`);
  console.log(`   Table games removed:  ${tableStats.removed} (${tableStats.groupsProcessed} groups)`);
  if (purgeEvents) {
    console.log(`   Sync events removed:  ${wizardStats.eventsRemoved + tableStats.eventsRemoved}`);
  }

  if (skipElo) {
    console.log('\n⏭️  Skipping ELO recalculation (--skip-elo). Ratings still count the removed games.');
    console.log('   Run "npm run elo:calculate" when you are ready.');
  } else {
    console.log('\n📊 Recalculating ELO so ratings no longer count the removed games...');
    const eloService = require('../utils/eloService');
    const eloResult = await eloService.recalculateAllElo({ dryRun: false });
    console.log(`   ELO recalculated: ${eloResult.gamesProcessed} games, ${eloResult.playerUpdates} player updates`);
  }

  console.log('\n✅ Done. Reload the games page to see the corrected timeline.');
}

main()
  .catch(error => {
    console.error('\n❌ Error:', error.message);
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
    console.log('👋 Disconnected from database');
  });
