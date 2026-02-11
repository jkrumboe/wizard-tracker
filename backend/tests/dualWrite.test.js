/**
 * Dual-Write Integration Tests
 *
 * Tests the dual-write logic for User, PlayerIdentity, and FriendRequest
 * operations across both MongoDB and PostgreSQL.
 *
 * Prerequisites:
 *   - MongoDB running (Docker)
 *   - PostgreSQL running (Docker)
 *   - USE_POSTGRES=true in .env
 *
 * Run: npx jest tests/dualWrite.test.js --forceExit
 */

const { connectDatabases, disconnectDatabases, getPrisma, usePostgres } = require('../database');
const { dualWrite, dualRead, dualReadWithFallback, FAILURE_STRATEGY, DualWriteError } = require('../utils/dualWrite');
const UserRepository = require('../repositories/UserRepository');
const PlayerIdentityRepo = require('../repositories/PlayerIdentityRepository');
const FriendRequestRepo = require('../repositories/FriendRequestRepository');
const mongoose = require('mongoose');
const User = require('../models/User');
const PlayerIdentity = require('../models/PlayerIdentity');
const FriendRequest = require('../models/FriendRequest');
const bcrypt = require('bcryptjs');

// Test configuration - keep prefix short so usernames stay under 20 chars
const TEST_PREFIX = `_t${Date.now().toString(36)}_`;
let prisma;
let postgresEnabled;

// Increase timeout for database operations
jest.setTimeout(30000);

beforeAll(async () => {
  try {
    await connectDatabases();
    prisma = getPrisma();
    postgresEnabled = usePostgres();
    if (!postgresEnabled) {
      console.warn('⚠️  USE_POSTGRES is not true — PostgreSQL tests will be skipped');
    }
  } catch (error) {
    console.error('Failed to connect to databases:', error.message);
    // Still allow tests to run; they'll skip PG-specific assertions
    postgresEnabled = false;
  }
}, 30000);

afterAll(async () => {
  // Clean up test data
  try {
    if (mongoose.connection.readyState === 1) {
      await User.deleteMany({ username: { $regex: `^${TEST_PREFIX}` } });
      await PlayerIdentity.deleteMany({ displayName: { $regex: `^${TEST_PREFIX}` } });
      await FriendRequest.deleteMany({});
    }
    if (prisma && postgresEnabled) {
      // Delete friend requests involving test users first (FK constraints)
      const testUsers = await prisma.user.findMany({
        where: { username: { startsWith: TEST_PREFIX } },
        select: { id: true }
      });
      const testUserIds = testUsers.map(u => u.id);
      if (testUserIds.length > 0) {
        await prisma.friendRequest.deleteMany({
          where: { OR: [
            { senderId: { in: testUserIds } },
            { receiverId: { in: testUserIds } }
          ] }
        });
      }
      await prisma.playerIdentity.deleteMany({ where: { displayName: { startsWith: TEST_PREFIX } } });
      await prisma.user.deleteMany({ where: { username: { startsWith: TEST_PREFIX } } });
    }
  } catch (e) {
    console.warn('Cleanup error:', e.message);
  }

  await disconnectDatabases();
}, 30000);

// ============================================
// DualWrite Utility Tests
// ============================================

describe('dualWrite utility', () => {
  test('should write to MongoDB only when PostgreSQL is disabled', async () => {
    const originalEnv = process.env.USE_POSTGRES;
    process.env.USE_POSTGRES = 'false';

    try {
      const result = await dualWrite(
        {
          mongoWrite: async () => ({ id: 'test-mongo' }),
          postgresWrite: async () => ({ id: 'test-pg' }),
          mongoRollback: async () => {},
          postgresRollback: async () => {}
        },
        FAILURE_STRATEGY.PRIORITIZE_MONGO,
        'Test'
      );

      expect(result.mongo).toEqual({ id: 'test-mongo' });
      expect(result.postgres).toBeNull();
      expect(result.usedPostgres).toBe(false);
    } finally {
      process.env.USE_POSTGRES = originalEnv;
    }
  });

  test('should write to both when PostgreSQL is enabled', async () => {
    const originalEnv = process.env.USE_POSTGRES;
    process.env.USE_POSTGRES = 'true';

    try {
      const result = await dualWrite(
        {
          mongoWrite: async () => ({ id: 'test-mongo' }),
          postgresWrite: async () => ({ id: 'test-pg' }),
          mongoRollback: async () => {},
          postgresRollback: async () => {}
        },
        FAILURE_STRATEGY.PRIORITIZE_MONGO,
        'Test'
      );

      expect(result.mongo).toEqual({ id: 'test-mongo' });
      expect(result.postgres).toEqual({ id: 'test-pg' });
      expect(result.usedPostgres).toBe(true);
    } finally {
      process.env.USE_POSTGRES = originalEnv;
    }
  });

  test('PRIORITIZE_MONGO should succeed if only PG fails', async () => {
    const originalEnv = process.env.USE_POSTGRES;
    process.env.USE_POSTGRES = 'true';

    try {
      const result = await dualWrite(
        {
          mongoWrite: async () => ({ id: 'test-mongo' }),
          postgresWrite: async () => { throw new Error('PG down'); },
          mongoRollback: async () => {}
        },
        FAILURE_STRATEGY.PRIORITIZE_MONGO,
        'Test'
      );

      expect(result.mongo).toEqual({ id: 'test-mongo' });
      expect(result.postgres).toBeNull();
      expect(result.postgresError).toBeDefined();
    } finally {
      process.env.USE_POSTGRES = originalEnv;
    }
  });

  test('ROLLBACK_BOTH should throw and rollback on failure', async () => {
    const originalEnv = process.env.USE_POSTGRES;
    process.env.USE_POSTGRES = 'true';

    let mongoRolledBack = false;

    try {
      await dualWrite(
        {
          mongoWrite: async () => ({ id: 'test-mongo' }),
          postgresWrite: async () => { throw new Error('PG down'); },
          mongoRollback: async () => { mongoRolledBack = true; }
        },
        FAILURE_STRATEGY.ROLLBACK_BOTH,
        'Test'
      );
      fail('Should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(DualWriteError);
      expect(mongoRolledBack).toBe(true);
    } finally {
      process.env.USE_POSTGRES = originalEnv;
    }
  });
});

// ============================================
// dualReadWithFallback Tests
// ============================================

describe('dualReadWithFallback', () => {
  test('should return MongoDB result when PG is disabled', async () => {
    const originalEnv = process.env.USE_POSTGRES;
    process.env.USE_POSTGRES = 'false';

    try {
      const result = await dualReadWithFallback(
        async () => ({ source: 'mongo' }),
        async () => ({ source: 'pg' })
      );
      expect(result.source).toBe('mongo');
    } finally {
      process.env.USE_POSTGRES = originalEnv;
    }
  });

  test('should try PG first and fall back to Mongo on error', async () => {
    const originalEnv = process.env.USE_POSTGRES;
    process.env.USE_POSTGRES = 'true';

    try {
      const result = await dualReadWithFallback(
        async () => ({ source: 'mongo' }),
        async () => { throw new Error('PG fail'); }
      );
      expect(result.source).toBe('mongo');
    } finally {
      process.env.USE_POSTGRES = originalEnv;
    }
  });
});

// ============================================
// User Dual-Write Integration Tests
// ============================================

describe('User dual-write integration', () => {
  const testUsername = `${TEST_PREFIX}user1`;
  let mongoUserId;

  test('should create user in MongoDB', async () => {
    const passwordHash = await bcrypt.hash('test123', 10);
    const user = new User({ username: testUsername, passwordHash });
    await user.save();
    mongoUserId = user._id.toString();

    const found = await User.findById(mongoUserId);
    expect(found).not.toBeNull();
    expect(found.username).toBe(testUsername);
  });

  test('should create corresponding user in PostgreSQL', async () => {
    if (!postgresEnabled) return;

    await UserRepository.create(prisma, {
      username: testUsername,
      passwordHash: 'hash-test',
      role: 'user'
    });

    const pgUser = await UserRepository.findByUsername(prisma, testUsername);
    expect(pgUser).not.toBeNull();
    expect(pgUser.username).toBe(testUsername);
  });

  test('should read user from both databases', async () => {
    if (!postgresEnabled) return;

    const result = await dualRead(
      async () => {
        const user = await User.findById(mongoUserId).lean();
        return user ? { username: user.username } : null;
      },
      async () => {
        const user = await UserRepository.findByUsername(prisma, testUsername);
        return user ? { username: user.username } : null;
      },
      (mongo, pg) => mongo?.username === pg?.username
    );

    expect(result.match).toBe(true);
    expect(result.mongo.username).toBe(testUsername);
  });

  test('should update lastLogin in PostgreSQL', async () => {
    if (!postgresEnabled) return;

    const pgUser = await UserRepository.findByUsername(prisma, testUsername);
    const now = new Date();

    const updated = await UserRepository.update(prisma, pgUser.id, { lastLogin: now });
    expect(updated.lastLogin).toBeTruthy();
  });
});

// ============================================
// PlayerIdentity Dual-Write Integration Tests
// ============================================

describe('PlayerIdentity dual-write integration', () => {
  const testIdentityName = `${TEST_PREFIX}player1`;

  test('should create identity in MongoDB', async () => {
    const identity = await PlayerIdentity.findOrCreateByName(testIdentityName, {
      type: 'guest'
    });
    expect(identity).not.toBeNull();
    expect(identity.displayName).toBe(testIdentityName);
  });

  test('should create identity in PostgreSQL', async () => {
    if (!postgresEnabled) return;

    const pgIdentity = await PlayerIdentityRepo.findOrCreate(prisma, testIdentityName, {
      type: 'guest'
    });
    expect(pgIdentity).not.toBeNull();
    expect(pgIdentity.displayName).toBe(testIdentityName);
  });

  test('should find identity by name in both databases', async () => {
    if (!postgresEnabled) return;

    const mongoIdentity = await PlayerIdentity.findByName(testIdentityName);
    const pgIdentity = await PlayerIdentityRepo.findByName(prisma, testIdentityName);

    expect(mongoIdentity).not.toBeNull();
    expect(pgIdentity).not.toBeNull();
    expect(mongoIdentity.displayName).toBe(pgIdentity.displayName);
  });

  test('should link identity to user in PostgreSQL', async () => {
    if (!postgresEnabled) return;

    const pgUser = await prisma.user.findFirst({
      where: { username: { startsWith: TEST_PREFIX } }
    });
    if (!pgUser) return; // User test must have run

    const pgIdentity = await PlayerIdentityRepo.findByName(prisma, testIdentityName);
    const linked = await PlayerIdentityRepo.linkToUser(prisma, pgIdentity.id, pgUser.id);

    expect(linked.userId).toBe(pgUser.id);
    expect(linked.type).toBe('user');
  });
});

// ============================================
// FriendRequest Dual-Write Integration Tests
// ============================================

describe('FriendRequest dual-write integration', () => {
  const user1Name = `${TEST_PREFIX}friend1`;
  const user2Name = `${TEST_PREFIX}friend2`;
  let user1MongoId, user2MongoId;
  let user1PgId, user2PgId;

  beforeAll(async () => {
    // Create two users in MongoDB
    const hash = await bcrypt.hash('test123', 10);
    const u1 = new User({ username: user1Name, passwordHash: hash });
    const u2 = new User({ username: user2Name, passwordHash: hash });
    await u1.save();
    await u2.save();
    user1MongoId = u1._id.toString();
    user2MongoId = u2._id.toString();

    // Create in PostgreSQL
    if (postgresEnabled) {
      const pg1 = await UserRepository.create(prisma, { username: user1Name, passwordHash: hash, role: 'user' });
      const pg2 = await UserRepository.create(prisma, { username: user2Name, passwordHash: hash, role: 'user' });
      user1PgId = pg1.id;
      user2PgId = pg2.id;
    }
  }, 15000);

  test('should create friend request in both databases', async () => {
    // MongoDB
    const mongoFr = new FriendRequest({ sender: user1MongoId, receiver: user2MongoId, status: 'pending' });
    await mongoFr.save();

    const found = await FriendRequest.findOne({ sender: user1MongoId, receiver: user2MongoId });
    expect(found).not.toBeNull();
    expect(found.status).toBe('pending');

    // PostgreSQL
    if (!postgresEnabled) return;
    const pgFr = await FriendRequestRepo.create(prisma, user1PgId, user2PgId);
    expect(pgFr).not.toBeNull();
    expect(pgFr.status).toBe('pending');
  });

  test('should accept friend request with transaction in PostgreSQL', async () => {
    if (!postgresEnabled) return;

    await prisma.$transaction(async (tx) => {
      // Update friend request status
      const pgFr = await tx.friendRequest.findFirst({
        where: { senderId: user1PgId, receiverId: user2PgId, status: 'pending' }
      });
      expect(pgFr).not.toBeNull();

      await tx.friendRequest.update({
        where: { id: pgFr.id },
        data: { status: 'accepted' }
      });

      // Add mutual friendship
      await tx.user.update({
        where: { id: user1PgId },
        data: { friends: { connect: { id: user2PgId } } }
      });
      await tx.user.update({
        where: { id: user2PgId },
        data: { friends: { connect: { id: user1PgId } } }
      });
    });

    // Verify friendship persisted
    const u1 = await prisma.user.findUnique({
      where: { id: user1PgId },
      include: { friends: { select: { id: true } } }
    });
    const friendIds = u1.friends.map(f => f.id);
    expect(friendIds).toContain(user2PgId);
  });

  test('should unfriend using transaction in PostgreSQL', async () => {
    if (!postgresEnabled) return;

    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: user1PgId },
        data: { friends: { disconnect: { id: user2PgId } } }
      });
      await tx.user.update({
        where: { id: user2PgId },
        data: { friends: { disconnect: { id: user1PgId } } }
      });
    });

    const u1 = await prisma.user.findUnique({
      where: { id: user1PgId },
      include: { friends: { select: { id: true } } }
    });
    expect(u1.friends).toHaveLength(0);
  });
});

// ============================================
// Repository Method Tests
// ============================================

describe('Repository methods', () => {
  test('UserRepository.usernameExists should work', async () => {
    if (!postgresEnabled) return;

    const exists = await UserRepository.usernameExists(prisma, `${TEST_PREFIX}user1`);
    expect(exists).toBe(true);

    const notExists = await UserRepository.usernameExists(prisma, 'nonexistent_user_xyz');
    expect(notExists).toBe(false);
  });

  test('UserRepository.searchByUsername should return results', async () => {
    if (!postgresEnabled) return;

    const results = await UserRepository.searchByUsername(prisma, TEST_PREFIX, { limit: 10 });
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].username).toContain(TEST_PREFIX);
  });

  test('PlayerIdentityRepo.search should return results', async () => {
    if (!postgresEnabled) return;

    const results = await PlayerIdentityRepo.search(prisma, TEST_PREFIX, { limit: 10 });
    expect(results.identities.length).toBeGreaterThan(0);
  });

  test('FriendRequestRepo.findAnyBetweenUsers should find requests', async () => {
    if (!postgresEnabled) return;

    const pgUser1 = await prisma.user.findFirst({ where: { username: `${TEST_PREFIX}friend1` } });
    const pgUser2 = await prisma.user.findFirst({ where: { username: `${TEST_PREFIX}friend2` } });

    if (!pgUser1 || !pgUser2) return;

    const request = await FriendRequestRepo.findAnyBetweenUsers(prisma, pgUser1.id, pgUser2.id);
    expect(request).not.toBeNull();
  });
});
