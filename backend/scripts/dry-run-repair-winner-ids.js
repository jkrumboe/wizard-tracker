#!/usr/bin/env node
/**
 * Dry run for migration 011_repair_wizard_winner_ids
 *
 * Reports which wizard games migration 011 would change, without changing
 * anything. Migration 003 rewrote player ids but skipped winner_id when it was
 * an array, so those games name winners that are not among their players.
 *
 * Uses the same query and repair logic as the migration, so the report matches
 * what the migration will do on the next backend start.
 *
 * READ-ONLY: this script never writes to the database.
 *
 * Usage:
 *   node scripts/dry-run-repair-winner-ids.js             # summary + first 20 games
 *   node scripts/dry-run-repair-winner-ids.js --verbose   # every affected game
 *   node scripts/dry-run-repair-winner-ids.js --json=out.json  # also save full report
 *
 *   # In production (docker compose)
 *   docker compose exec backend node scripts/dry-run-repair-winner-ids.js
 *
 * Also reports whether migration 011 has already been applied.
 */

require('dotenv').config();
const fs = require('fs');
const mongoose = require('mongoose');
const WizardGame = require('../models/WizardGame');
const Migration = require('../models/Migration');
const {
  getWinnerIds,
  repairWizardWinnerIds,
  WIZARD_GAMES_WITH_WINNERS_QUERY
} = require('../utils/gameHelpers');

const MIGRATION_NAME = '011_repair_wizard_winner_ids';
const PREVIEW_LIMIT = 20;

const args = process.argv.slice(2);
const verbose = args.includes('--verbose') || args.includes('-v');
const jsonArg = args.find(arg => arg.startsWith('--json='));
const jsonPath = jsonArg ? jsonArg.slice('--json='.length) : null;

/** Names for a list of player ids, flagging ids that match no player. */
function describeWinners(ids, players) {
  if (ids.length === 0) return '(none)';
  const byId = new Map(players.map(p => [String(p.id), p.name]));
  return ids
    .map(id => (byId.has(String(id)) ? byId.get(String(id)) : `<unknown ${id}>`))
    .join(', ');
}

async function main() {
  const mongoUri = process.env.MONGO_URI;
  if (!mongoUri) {
    console.error('❌ MONGO_URI environment variable is not set');
    process.exit(1);
  }

  console.log('🔍 Dry run: migration 011 (repair wizard winner ids) - no changes will be made\n');

  await mongoose.connect(mongoUri);
  console.log('✅ Connected to database');

  const applied = await Migration.findOne({ name: MIGRATION_NAME }).lean();
  if (applied) {
    console.log(`ℹ️  ${MIGRATION_NAME} is already recorded as applied; the report below shows what is still stale.`);
  }

  const affected = [];
  let scanned = 0;
  let finished = 0;

  const cursor = WizardGame.find(WIZARD_GAMES_WITH_WINNERS_QUERY)
    .select('_id localId userId createdAt gameData')
    .lean()
    .cursor();

  for await (const game of cursor) {
    scanned++;
    const gameData = game.gameData || {};
    if (gameData.gameFinished === true) finished++;

    const repaired = repairWizardWinnerIds(gameData);
    if (!repaired) continue;

    const players = gameData.players || [];
    const before = getWinnerIds(gameData).map(String);
    const hasAllScores = players.every(p => typeof gameData.final_scores?.[p.id] === 'number');

    affected.push({
      id: String(game._id),
      localId: game.localId,
      userId: game.userId ? String(game.userId) : null,
      playedAt: gameData.created_at || game.createdAt,
      players: players.map(p => p.name),
      before,
      after: repaired,
      beforeNames: describeWinners(before, players),
      afterNames: describeWinners(repaired, players),
      decidedBy: hasAllScores ? 'final_scores' : 'originalId mapping / drop unknown',
      losesWinner: repaired.length === 0
    });
  }

  console.log(`\nScanned ${scanned} wizard games with stored winners (${finished} marked finished)`);
  console.log(`Would repair: ${affected.length}`);

  if (affected.length > 0) {
    const byScores = affected.filter(a => a.decidedBy === 'final_scores').length;
    const losing = affected.filter(a => a.losesWinner).length;
    const users = new Set(affected.map(a => a.userId).filter(Boolean)).size;
    console.log(`  decided by final scores:        ${byScores}`);
    console.log(`  decided by id mapping only:     ${affected.length - byScores}`);
    console.log(`  would end up with no winner:    ${losing}${losing ? '  ⚠️  check these' : ''}`);
    console.log(`  uploaders affected:             ${users}`);
    console.log('  ELO would be recalculated for all games afterwards.');

    const shown = verbose ? affected : affected.slice(0, PREVIEW_LIMIT);
    console.log(`\n${verbose ? 'All' : `First ${shown.length}`} affected games:`);
    for (const a of shown) {
      const date = a.playedAt ? new Date(a.playedAt).toISOString().slice(0, 10) : '????-??-??';
      console.log(`\n  ${a.id}  ${date}  [${a.players.join(', ')}]`);
      console.log(`    before: ${a.beforeNames}`);
      console.log(`    after:  ${a.afterNames}   (${a.decidedBy})`);
    }
    if (!verbose && affected.length > shown.length) {
      console.log(`\n  ...and ${affected.length - shown.length} more (use --verbose to list all)`);
    }
  }

  if (jsonPath) {
    fs.writeFileSync(jsonPath, JSON.stringify({ scanned, affected }, null, 2));
    console.log(`\n💾 Full report written to ${jsonPath}`);
  }

  console.log('\nNo changes made. Migration 011 applies these on the next backend start.');
}

main()
  .catch(error => {
    console.error('❌ Dry run failed:', error);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
