/**
 * Game Dual-Write Integration Tests
 *
 * Tests the dual-write logic for Game, WizardGame, TableGame,
 * GameEvent, and GameSnapshot operations across both databases.
 *
 * Prerequisites:
 *   - MongoDB running (Docker, port 27017)
 *   - PostgreSQL running (Docker, port 5432)
 *   - USE_POSTGRES=true in .env
 *
 * Run: npx jest tests/gameDualWrite.test.js --forceExit
 */

const { connectDatabases, disconnectDatabases, getPrisma, usePostgres } = require('../database');
const GameRepo = require('../repositories/GameRepository');
const WizardGameRepo = require('../repositories/WizardGameRepository');
const TableGameRepo = require('../repositories/TableGameRepository');
const GameEventRepo = require('../repositories/GameEventRepository');
const GameSnapshotRepo = require('../repositories/GameSnapshotRepository');
const {
  mirrorGameCreate,
  mirrorGameUpdate,
  mirrorGameShare,
  mirrorWizardGameCreate,
  mirrorTableGameCreate,
  mirrorTableGameDelete,
  mirrorGameEventCreate,
  mirrorGameSnapshotCreate
} = require('../utils/gameDualWrite');
const mongoose = require('mongoose');
const Game = require('../models/Game');
const WizardGame = require('../models/WizardGame');
const TableGame = require('../models/TableGame');
const GameEvent = require('../models/GameEvent');
const GameSnapshot = require('../models/GameSnapshot');
const User = require('../models/User');
const bcrypt = require('bcryptjs');

// Keep prefix short for any username constraints
const TEST_PREFIX = `_tg${Date.now().toString(36)}_`;
let prisma;
let postgresEnabled;
let testUserId;
let testPgUserId;

jest.setTimeout(30000);

beforeAll(async () => {
  try {
    await connectDatabases();
    prisma = getPrisma();
    postgresEnabled = usePostgres();
    if (!postgresEnabled) {
      console.warn('⚠️  USE_POSTGRES is not true — PostgreSQL tests will be skipped');
    }

    // Create a test user in both databases (needed for FK constraints)
    const hash = await bcrypt.hash('test123', 10);
    const mongoUser = new User({ username: `${TEST_PREFIX}u`, passwordHash: hash });
    await mongoUser.save();
    testUserId = mongoUser._id.toString();

    if (postgresEnabled) {
      const pgUser = await prisma.user.create({
        data: { username: `${TEST_PREFIX}u`, passwordHash: hash, role: 'user' }
      });
      testPgUserId = pgUser.id;
    }
  } catch (error) {
    console.error('Failed to connect to databases:', error.message);
    postgresEnabled = false;
  }
}, 30000);

afterAll(async () => {
  try {
    if (mongoose.connection.readyState === 1) {
      await GameSnapshot.deleteMany({ gameId: { $regex: `^${TEST_PREFIX}` } });
      await GameEvent.deleteMany({ gameId: { $regex: `^${TEST_PREFIX}` } });
      await Game.deleteMany({ localId: { $regex: `^${TEST_PREFIX}` } });
      await WizardGame.deleteMany({ localId: { $regex: `^${TEST_PREFIX}` } });
      await TableGame.deleteMany({ localId: { $regex: `^${TEST_PREFIX}` } });
      await User.deleteMany({ username: { $regex: `^${TEST_PREFIX}` } });
    }
    if (prisma && postgresEnabled) {
      await prisma.gameSnapshot.deleteMany({ where: { gameId: { startsWith: TEST_PREFIX } } });
      await prisma.gameEvent.deleteMany({ where: { gameId: { startsWith: TEST_PREFIX } } });
      await prisma.game.deleteMany({ where: { localId: { startsWith: TEST_PREFIX } } });
      await prisma.wizardGame.deleteMany({ where: { localId: { startsWith: TEST_PREFIX } } });
      await prisma.tableGame.deleteMany({ where: { localId: { startsWith: TEST_PREFIX } } });
      await prisma.user.deleteMany({ where: { username: { startsWith: TEST_PREFIX } } });
    }
  } catch (e) {
    console.warn('Cleanup error:', e.message);
  }
  await disconnectDatabases();
}, 30000);

// ============================================
// gameDualWrite service tests
// ============================================

describe('gameDualWrite service', () => {
  test('mirrorGameCreate should create game in PG', async () => {
    if (!postgresEnabled) return;

    const localId = `${TEST_PREFIX}g1`;
    const fakeMongoGame = {
      userId: testPgUserId,
      localId,
      gameData: { version: '3.0', test: true },
      shareId: null,
      isShared: false
    };

    const pgGame = await mirrorGameCreate(fakeMongoGame);
    expect(pgGame).not.toBeNull();
    expect(pgGame.localId).toBe(localId);

    // Verify it exists
    const found = await GameRepo.findByLocalId(prisma, localId);
    expect(found).not.toBeNull();
  });

  test('mirrorGameUpdate should update game in PG', async () => {
    if (!postgresEnabled) return;

    const localId = `${TEST_PREFIX}g1`;
    const fakeMongoGame = { localId };

    const updated = await mirrorGameUpdate(fakeMongoGame, {
      gameData: { version: '3.0', test: true, updated: true }
    });
    expect(updated).not.toBeNull();

    const found = await GameRepo.findByLocalId(prisma, localId);
    expect(found.gameData.updated).toBe(true);
  });

  test('mirrorGameShare should update share fields in PG', async () => {
    if (!postgresEnabled) return;

    const localId = `${TEST_PREFIX}g1`;
    const now = new Date();
    const fakeMongoGame = {
      localId,
      shareId: `share_${TEST_PREFIX}`,
      isShared: true,
      sharedAt: now
    };

    const shared = await mirrorGameShare(fakeMongoGame);
    expect(shared).not.toBeNull();
    expect(shared.isShared).toBe(true);
    expect(shared.shareId).toBe(`share_${TEST_PREFIX}`);
  });

  test('mirrorWizardGameCreate should create wizard game in PG', async () => {
    if (!postgresEnabled) return;

    const localId = `${TEST_PREFIX}wg1`;
    const fakeGame = {
      userId: testPgUserId,
      localId,
      gameData: { version: '3.0', players: [], round_data: [] },
      migratedFrom: null,
      shareId: null,
      isShared: false
    };

    const pgGame = await mirrorWizardGameCreate(fakeGame);
    expect(pgGame).not.toBeNull();
    expect(pgGame.localId).toBe(localId);
  });

  test('mirrorTableGameCreate should create table game in PG', async () => {
    if (!postgresEnabled) return;

    const localId = `${TEST_PREFIX}tg1`;
    const fakeGame = {
      userId: testPgUserId,
      localId,
      name: 'Test Table Game',
      gameTypeName: 'dutch',
      gameData: { players: [] },
      gameType: 'table',
      gameFinished: false,
      playerCount: 3,
      totalRounds: 10
    };

    const pgGame = await mirrorTableGameCreate(fakeGame);
    expect(pgGame).not.toBeNull();
    expect(pgGame.localId).toBe(localId);
    expect(pgGame.name).toBe('Test Table Game');
  });

  test('mirrorTableGameDelete should remove table game from PG', async () => {
    if (!postgresEnabled) return;

    const localId = `${TEST_PREFIX}tg1`;
    const result = await mirrorTableGameDelete(localId);
    expect(result).toBe(true);

    const found = await TableGameRepo.findByLocalId(prisma, localId);
    expect(found).toBeNull();
  });

  test('mirrorGameEventCreate should create event in PG', async () => {
    if (!postgresEnabled) return;

    const fakeEvent = {
      id: `${TEST_PREFIX}ev1`,
      gameId: `${TEST_PREFIX}g1`,
      actionType: 'GAME_START',
      payload: { started: true },
      timestamp: Date.now(),
      localVersion: 1,
      userId: testPgUserId,
      clientId: 'test-client',
      serverVersion: 1,
      acknowledged: true
    };

    const pgEvent = await mirrorGameEventCreate(fakeEvent);
    expect(pgEvent).not.toBeNull();
    expect(pgEvent.actionType).toBe('GAME_START');
  });

  test('mirrorGameSnapshotCreate should create snapshot in PG', async () => {
    if (!postgresEnabled) return;

    const fakeSnapshot = {
      gameId: `${TEST_PREFIX}g1`,
      serverVersion: 1,
      gameState: { round: 1, players: [] },
      userId: testPgUserId,
      eventCount: 5
    };

    const pgSnapshot = await mirrorGameSnapshotCreate(fakeSnapshot);
    expect(pgSnapshot).not.toBeNull();
    expect(pgSnapshot.serverVersion).toBe(1);
  });
});

// ============================================
// Repository Integration Tests
// ============================================

describe('Game repository operations', () => {
  test('GameRepo.createFromMongo should upsert correctly', async () => {
    if (!postgresEnabled) return;

    const localId = `${TEST_PREFIX}g_upsert`;
    const mongoDoc = {
      userId: testPgUserId,
      localId,
      gameData: { version: '3.0', round: 1 },
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const created = await GameRepo.createFromMongo(prisma, mongoDoc);
    expect(created.localId).toBe(localId);

    // Upsert again with updated data
    mongoDoc.gameData.round = 2;
    const upserted = await GameRepo.createFromMongo(prisma, mongoDoc);
    expect(upserted.gameData.round).toBe(2);
  });

  test('WizardGameRepo CRUD operations', async () => {
    if (!postgresEnabled) return;

    const localId = `${TEST_PREFIX}wg_crud`;
    
    // Create
    const created = await WizardGameRepo.create(prisma, {
      userId: testPgUserId,
      localId,
      gameData: { version: '3.0', players: [{ name: 'Test' }], round_data: [] }
    });
    expect(created.localId).toBe(localId);

    // Read
    const found = await WizardGameRepo.findByLocalId(prisma, localId);
    expect(found).not.toBeNull();

    // Count
    const count = await WizardGameRepo.countAll(prisma);
    expect(count).toBeGreaterThan(0);

    // Delete
    await WizardGameRepo.deleteById(prisma, created.id);
    const deleted = await WizardGameRepo.findByLocalId(prisma, localId);
    expect(deleted).toBeNull();
  });

  test('TableGameRepo CRUD operations', async () => {
    if (!postgresEnabled) return;

    const localId = `${TEST_PREFIX}tg_crud`;

    // Create
    const created = await TableGameRepo.create(prisma, {
      userId: testPgUserId,
      localId,
      name: 'CRUD Test Game',
      gameData: { players: [{ name: 'P1' }, { name: 'P2' }] },
      playerCount: 2,
      totalRounds: 5
    });
    expect(created.name).toBe('CRUD Test Game');

    // Read by user
    const userGames = await TableGameRepo.findByUserId(prisma, testPgUserId);
    expect(userGames.length).toBeGreaterThan(0);

    // Delete
    await TableGameRepo.deleteById(prisma, created.id);
    const deleted = await TableGameRepo.findByLocalId(prisma, localId);
    expect(deleted).toBeNull();
  });

  test('GameEventRepo operations', async () => {
    if (!postgresEnabled) return;

    const gameId = `${TEST_PREFIX}ev_game`;
    const eventId = `${TEST_PREFIX}ev_test`;

    // Create
    const created = await GameEventRepo.create(prisma, {
      eventId,
      gameId,
      actionType: 'ROUND_START',
      payload: { round: 1 },
      timestamp: Date.now(),
      localVersion: 1,
      userId: testPgUserId,
      serverVersion: 1
    });
    expect(created.actionType).toBe('ROUND_START');

    // Find latest
    const latest = await GameEventRepo.findLatestByGameId(prisma, gameId);
    expect(latest).not.toBeNull();
    expect(latest.serverVersion).toBe(1);

    // Count
    const count = await GameEventRepo.countByGameId(prisma, gameId);
    expect(count).toBe(1);

    // Find since version
    const events = await GameEventRepo.findSinceVersion(prisma, gameId, 0);
    expect(events.length).toBe(1);
  });

  test('GameSnapshotRepo operations', async () => {
    if (!postgresEnabled) return;

    const gameId = `${TEST_PREFIX}snap_game`;

    // Upsert
    const created = await GameSnapshotRepo.upsert(prisma, {
      gameId,
      serverVersion: 1,
      gameState: { round: 1 },
      userId: testPgUserId,
      eventCount: 10
    });
    expect(created.serverVersion).toBe(1);

    // Find latest
    const latest = await GameSnapshotRepo.findLatestByGameId(prisma, gameId);
    expect(latest).not.toBeNull();
    expect(latest.eventCount).toBe(10);

    // Upsert update
    const updated = await GameSnapshotRepo.upsert(prisma, {
      gameId,
      serverVersion: 1,
      gameState: { round: 2 },
      userId: testPgUserId,
      eventCount: 20
    });
    expect(updated.eventCount).toBe(20);
  });
});

// ============================================
// MongoDB + PG consistency check
// ============================================

describe('MongoDB-PostgreSQL game consistency', () => {
  const testLocalId = `${TEST_PREFIX}consist`;

  test('should create game in both databases and verify consistency', async () => {
    if (!postgresEnabled) return;

    // Create in MongoDB
    const mongoGame = new Game({
      userId: testUserId,
      localId: testLocalId,
      gameData: { version: '3.0', test: 'consistency' }
    });
    await mongoGame.save();

    // Mirror to PG
    await mirrorGameCreate({
      userId: testPgUserId, // PG user ID for FK
      localId: testLocalId,
      gameData: { version: '3.0', test: 'consistency' }
    });

    // Verify both exist
    const mongoFound = await Game.findOne({ localId: testLocalId });
    const pgFound = await GameRepo.findByLocalId(prisma, testLocalId);

    expect(mongoFound).not.toBeNull();
    expect(pgFound).not.toBeNull();
    expect(mongoFound.localId).toBe(pgFound.localId);
    expect(mongoFound.gameData.test).toBe(pgFound.gameData.test);
  });
});
