#!/usr/bin/env node
/**
 * Database Performance Benchmark
 * 
 * Compares read/write performance between MongoDB and PostgreSQL
 * for game-related operations.
 * 
 * Usage:
 *   node scripts/benchmark-db.js              # Full benchmark
 *   node scripts/benchmark-db.js --rounds 50  # Custom rounds
 */

require('dotenv').config();
const { connectDatabases, disconnectDatabases, getPrisma } = require('../database');
const mongoose = require('mongoose');
const Game = require('../models/Game');
const WizardGame = require('../models/WizardGame');
const TableGame = require('../models/TableGame');
const User = require('../models/User');
const bcrypt = require('bcryptjs');
const GameRepo = require('../repositories/GameRepository');
const WizardGameRepo = require('../repositories/WizardGameRepository');
const TableGameRepo = require('../repositories/TableGameRepository');

const args = process.argv.slice(2);
const ROUNDS = args.includes('--rounds') ? parseInt(args[args.indexOf('--rounds') + 1]) : 20;
const PREFIX = `_bench_${Date.now().toString(36)}_`;

function formatMs(ms) {
  return `${ms.toFixed(2)}ms`;
}

function stats(times) {
  const sorted = [...times].sort((a, b) => a - b);
  const avg = times.reduce((a, b) => a + b, 0) / times.length;
  const median = sorted[Math.floor(sorted.length / 2)];
  const p95 = sorted[Math.floor(sorted.length * 0.95)];
  const min = sorted[0];
  const max = sorted[sorted.length - 1];
  return { avg, median, p95, min, max };
}

function printStats(label, mongoTimes, pgTimes) {
  const m = stats(mongoTimes);
  const p = stats(pgTimes);
  const speedup = m.avg / p.avg;

  console.log(`\n  ${label}`);
  console.log(`  ${''.padEnd(55, '─')}`);
  console.log(`  ${''.padEnd(12)} ${'MongoDB'.padStart(10)} ${'PostgreSQL'.padStart(12)} ${'Ratio'.padStart(8)}`);
  console.log(`  ${'Avg'.padEnd(12)} ${formatMs(m.avg).padStart(10)} ${formatMs(p.avg).padStart(12)} ${speedup.toFixed(2).padStart(7)}x`);
  console.log(`  ${'Median'.padEnd(12)} ${formatMs(m.median).padStart(10)} ${formatMs(p.median).padStart(12)}`);
  console.log(`  ${'P95'.padEnd(12)} ${formatMs(m.p95).padStart(10)} ${formatMs(p.p95).padStart(12)}`);
  console.log(`  ${'Min'.padEnd(12)} ${formatMs(m.min).padStart(10)} ${formatMs(p.min).padStart(12)}`);
  console.log(`  ${'Max'.padEnd(12)} ${formatMs(m.max).padStart(10)} ${formatMs(p.max).padStart(12)}`);
}

async function time(fn) {
  const start = performance.now();
  await fn();
  return performance.now() - start;
}

async function main() {
  console.log('🏎️  Database Performance Benchmark');
  console.log(`   Rounds: ${ROUNDS}`);
  console.log(`   Prefix: ${PREFIX}`);

  const origEnv = process.env.USE_POSTGRES;
  process.env.USE_POSTGRES = 'true';

  await connectDatabases();
  const prisma = getPrisma();

  // Create test user in both DBs
  const hash = await bcrypt.hash('bench123', 10);
  const mongoUser = new User({ username: `${PREFIX}u`, passwordHash: hash });
  await mongoUser.save();
  const mongoUserId = mongoUser._id.toString();

  const pgUser = await prisma.user.create({
    data: { username: `${PREFIX}u`, passwordHash: hash, role: 'user' }
  });
  const pgUserId = pgUser.id;

  // =====================
  // 1. Single Write
  // =====================
  console.log('\n📝 Benchmark: Single Game Write');
  const writeMongoTimes = [];
  const writePgTimes = [];

  for (let i = 0; i < ROUNDS; i++) {
    const localId = `${PREFIX}w${i}`;
    const gameData = { version: '3.0', players: [{ name: 'A' }, { name: 'B' }], round_data: [], round: i };

    writeMongoTimes.push(await time(async () => {
      const game = new WizardGame({
        userId: mongoUserId,
        localId: `m_${localId}`,
        gameData
      });
      await game.save();
    }));

    writePgTimes.push(await time(async () => {
      await WizardGameRepo.create(prisma, {
        userId: pgUserId,
        localId: `p_${localId}`,
        gameData
      });
    }));
  }

  printStats('Single WizardGame Write', writeMongoTimes, writePgTimes);

  // =====================
  // 2. Single Read by localId
  // =====================
  console.log('\n📖 Benchmark: Single Read by localId');
  const readMongoTimes = [];
  const readPgTimes = [];

  for (let i = 0; i < ROUNDS; i++) {
    const localId = `${PREFIX}w${i % ROUNDS}`;

    readMongoTimes.push(await time(async () => {
      await WizardGame.findOne({ localId: `m_${localId}` }).lean();
    }));

    readPgTimes.push(await time(async () => {
      await WizardGameRepo.findByLocalId(prisma, `p_${localId}`);
    }));
  }

  printStats('Single Read by localId', readMongoTimes, readPgTimes);

  // =====================
  // 3. List games by userId (paginated)
  // =====================
  console.log('\n📋 Benchmark: List Games by User (limit 50)');
  const listMongoTimes = [];
  const listPgTimes = [];

  for (let i = 0; i < ROUNDS; i++) {
    listMongoTimes.push(await time(async () => {
      await WizardGame.find({ userId: mongoUserId })
        .sort({ createdAt: -1 })
        .limit(50)
        .lean();
    }));

    listPgTimes.push(await time(async () => {
      await WizardGameRepo.findByUserId(prisma, pgUserId, { limit: 50 });
    }));
  }

  printStats('List Games by User', listMongoTimes, listPgTimes);

  // =====================
  // 4. Count documents
  // =====================
  console.log('\n🔢 Benchmark: Count Games');
  const countMongoTimes = [];
  const countPgTimes = [];

  for (let i = 0; i < ROUNDS; i++) {
    countMongoTimes.push(await time(async () => {
      await WizardGame.countDocuments({ userId: mongoUserId });
    }));

    countPgTimes.push(await time(async () => {
      await WizardGameRepo.countByUserId(prisma, pgUserId);
    }));
  }

  printStats('Count Games by User', countMongoTimes, countPgTimes);

  // =====================
  // 5. Table game write (more fields)
  // =====================
  console.log('\n📊 Benchmark: TableGame Write (complex)');
  const tblWriteMongoTimes = [];
  const tblWritePgTimes = [];

  for (let i = 0; i < ROUNDS; i++) {
    const localId = `${PREFIX}tbl${i}`;
    const gameData = {
      players: [
        { name: 'Player1', points: [10, 20, 30] },
        { name: 'Player2', points: [15, 25, 35] },
        { name: 'Player3', points: [12, 22, 32] }
      ],
      rows: 3,
      gameName: 'Dutch',
      gameFinished: true,
      created_at: new Date().toISOString()
    };

    tblWriteMongoTimes.push(await time(async () => {
      const tg = new TableGame({
        userId: mongoUserId,
        localId: `m_${localId}`,
        name: 'Dutch',
        gameTypeName: 'dutch',
        gameData,
        gameType: 'table',
        gameFinished: true,
        playerCount: 3,
        totalRounds: 3
      });
      await tg.save();
    }));

    tblWritePgTimes.push(await time(async () => {
      await TableGameRepo.create(prisma, {
        userId: pgUserId,
        localId: `p_${localId}`,
        name: 'Dutch',
        gameTypeName: 'dutch',
        gameData,
        gameType: 'table',
        gameFinished: true,
        playerCount: 3,
        totalRounds: 3
      });
    }));
  }

  printStats('TableGame Write (complex)', tblWriteMongoTimes, tblWritePgTimes);

  // =====================
  // Cleanup
  // =====================
  console.log('\n\n🧹 Cleaning up benchmark data...');

  await WizardGame.deleteMany({ localId: { $regex: `^m_${PREFIX}` } });
  await TableGame.deleteMany({ localId: { $regex: `^m_${PREFIX}` } });
  await User.deleteMany({ username: { $regex: `^${PREFIX}` } });

  await prisma.wizardGame.deleteMany({ where: { localId: { startsWith: `p_${PREFIX}` } } });
  await prisma.tableGame.deleteMany({ where: { localId: { startsWith: `p_${PREFIX}` } } });
  await prisma.user.deleteMany({ where: { username: { startsWith: PREFIX } } });

  // =====================
  // Summary
  // =====================
  console.log('\n========================================');
  console.log('📊 Benchmark Complete');
  console.log('========================================');
  console.log(`  Rounds per test: ${ROUNDS}`);
  console.log(`  Ratio > 1.0 means MongoDB is slower (PG wins)`);
  console.log(`  Ratio < 1.0 means PostgreSQL is slower (MongoDB wins)`);

  process.env.USE_POSTGRES = origEnv;
  await disconnectDatabases();
  process.exit(0);
}

main().catch(err => {
  console.error('Benchmark failed:', err);
  process.exit(1);
});
