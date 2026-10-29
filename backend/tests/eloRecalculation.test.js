/**
 * ELO persistence tests: the live per-game update and the full in-memory
 * recalculation must agree, and both must survive merged identities.
 *
 * Runs against its own throwaway database (dropped afterwards) because a
 * recalculation rewrites every identity's ratings. Skips when Mongo is
 * unreachable.
 */
const mongoose = require('mongoose');
require('../models/User');
const PlayerIdentity = require('../models/PlayerIdentity');
const WizardGame = require('../models/WizardGame');
const TableGame = require('../models/TableGame');
const eloService = require('../utils/eloService');
const { buildLeaderboardSnapshot, selectLeaderboard } = require('../utils/leaderboardService');

const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://localhost:27017/wizard-tracker-test';
const dbName = `elo-recalc-test-${Date.now()}`;

let connected = false;
const ownerId = new mongoose.Types.ObjectId();

const createIdentity = (name) => PlayerIdentity.create({
  displayName: name,
  normalizedName: name.toLowerCase(),
  type: 'guest',
  userId: new mongoose.Types.ObjectId()
});

// Saved without the post-save hook firing ELO, so each test controls when ratings apply
const insertWizardGame = async (players, scores, createdAt) => {
  const result = await WizardGame.collection.insertOne({
    userId: ownerId,
    localId: `game-${new mongoose.Types.ObjectId()}`,
    gameData: {
      gameFinished: true,
      created_at: createdAt.toISOString(),
      players: players.map((identity, i) => ({ id: `p${i}`, name: identity.displayName, identityId: identity._id })),
      final_scores: Object.fromEntries(scores.map((score, i) => [`p${i}`, score])),
      winner_id: 'p0'
    },
    createdAt
  });
  return WizardGame.findById(result.insertedId);
};

beforeAll(async () => {
  try {
    await mongoose.connect(mongoUri, { dbName, serverSelectionTimeoutMS: 3000 });
    connected = true;
  } catch (err) {
    console.warn('⚠️ Skipping ELO recalculation tests - MongoDB not reachable:', err.message);
  }
}, 15000);

afterAll(async () => {
  if (connected) {
    await mongoose.connection.dropDatabase();
  }
  await mongoose.disconnect();
}, 15000);

beforeEach(async () => {
  if (!connected) return;
  await Promise.all([
    PlayerIdentity.deleteMany({}),
    WizardGame.collection.deleteMany({}),
    TableGame.collection.deleteMany({}),
    mongoose.connection.collection('elolocks').deleteMany({})
  ]);
});

const insertTableGame = async (gameTypeName, players, totals, createdAt) => {
  const result = await TableGame.collection.insertOne({
    userId: ownerId,
    localId: `table-${new mongoose.Types.ObjectId()}`,
    name: gameTypeName,
    gameTypeName,
    gameFinished: true,
    gameData: {
      created_at: createdAt.toISOString(),
      gameFinished: true,
      players: players.map((identity, i) => ({
        id: `p${i}`, name: identity.displayName, identityId: identity._id, points: [totals[i]]
      }))
    },
    createdAt
  });
  return TableGame.findById(result.insertedId);
};

describe('ELO persistence', () => {
  test('live updates and a full recalculation produce the same ratings', async () => {
    if (!connected) return;
    const [alice, bob, carol] = await Promise.all(['Alice', 'Bob', 'Carol'].map(createIdentity));

    const games = [
      await insertWizardGame([alice, bob, carol], [180, 120, 60], new Date('2026-01-01')),
      await insertWizardGame([bob, alice, carol], [150, 140, 90], new Date('2026-01-02')),
      await insertWizardGame([alice, carol, bob], [200, 100, 20], new Date('2026-01-03'))
    ];
    for (const game of games) {
      await eloService.updateRatingsForGame(game, 'wizard');
    }
    const live = await PlayerIdentity.find().lean();

    const result = await eloService.recalculateAllElo();
    expect(result.gamesProcessed).toBe(3);
    expect(result.errors).toEqual([]);
    const recalculated = await PlayerIdentity.find().lean();

    for (const identity of live) {
      const after = recalculated.find(i => i._id.equals(identity._id));
      const { wizard } = identity.eloByGameType;
      expect(after.eloByGameType.wizard.rating).toBe(wizard.rating);
      expect(after.eloByGameType.wizard.gamesPlayed).toBe(3);
      expect(after.eloByGameType.wizard.wins).toBe(wizard.wins);
      expect(after.eloByGameType.wizard.history.map(h => h.gameId.toString()))
        .toEqual(wizard.history.map(h => h.gameId.toString()));
    }

    const aliceElo = recalculated.find(i => i._id.equals(alice._id)).eloByGameType.wizard;
    expect(aliceElo.wins).toBe(2);
    expect(aliceElo.rating).toBeGreaterThan(1000);
  }, 20000);

  test('live update is idempotent', async () => {
    if (!connected) return;
    const [alice, bob] = await Promise.all(['Alice', 'Bob'].map(createIdentity));
    const game = await insertWizardGame([alice, bob], [100, 50], new Date('2026-01-01'));

    expect(await eloService.updateRatingsForGame(game, 'wizard')).toHaveLength(2);
    expect(await eloService.updateRatingsForGame(game, 'wizard')).toEqual([]);

    const stored = await PlayerIdentity.findById(alice._id).lean();
    expect(stored.eloByGameType.wizard.gamesPlayed).toBe(1);
  }, 20000);

  test('a game with a merged-away player rates the surviving identity', async () => {
    if (!connected) return;
    const [alice, bob, bobGuest] = await Promise.all(['Alice', 'Bob', 'Bobby'].map(createIdentity));
    // What mergeIdentities leaves behind on the source identity
    await PlayerIdentity.updateOne(
      { _id: bobGuest._id },
      { $set: { mergedInto: bob._id, isDeleted: true, deletedAt: new Date() } }
    );

    const game = await insertWizardGame([alice, bobGuest], [100, 50], new Date('2026-01-01'));
    const updates = await eloService.updateRatingsForGame(game, 'wizard');

    expect(updates.map(u => u.identity._id.toString()).sort())
      .toEqual([alice._id.toString(), bob._id.toString()].sort());
    const stored = await PlayerIdentity.findById(bob._id).lean();
    expect(stored.eloByGameType.wizard.rating).toBeLessThan(1000);
  }, 20000);

  test('a single game type recalculation leaves other types alone', async () => {
    if (!connected) return;
    const [alice, bob] = await Promise.all(['Alice', 'Bob'].map(createIdentity));
    await PlayerIdentity.updateOne(
      { _id: alice._id },
      { $set: { 'eloByGameType.dutch': { rating: 1234, gamesPlayed: 7, history: [] } } }
    );
    await insertWizardGame([alice, bob], [100, 50], new Date('2026-01-01'));

    await eloService.recalculateAllElo({ gameType: 'wizard' });

    const stored = await PlayerIdentity.findById(alice._id).lean();
    expect(stored.eloByGameType.dutch.rating).toBe(1234);
    expect(stored.eloByGameType.wizard.gamesPlayed).toBe(1);
  }, 20000);

  test('nested table games are rated with their document-level lowIsBetter', async () => {
    if (!connected) return;
    const [alice, bob] = await Promise.all(['Alice', 'Bob'].map(createIdentity));
    const result = await TableGame.collection.insertOne({
      userId: ownerId,
      localId: `table-${new mongoose.Types.ObjectId()}`,
      name: 'Dutch',
      gameTypeName: 'Dutch',
      gameFinished: true,
      lowIsBetter: true,
      gameData: {
        gameData: {
          created_at: new Date('2026-01-01').toISOString(),
          players: [
            { id: 'p0', name: 'Alice', identityId: alice._id, points: [2, 3] },
            { id: 'p1', name: 'Bob', identityId: bob._id, points: [10, 12] }
          ]
        }
      },
      createdAt: new Date('2026-01-01')
    });
    const game = await TableGame.findById(result.insertedId);

    const updates = await eloService.updateRatingsForGame(game, 'Dutch');
    const aliceChange = updates.find(u => u.identity._id.equals(alice._id)).change;
    expect(aliceChange.placement).toBe(1);
    expect(aliceChange.change).toBeGreaterThan(0);
  }, 20000);

  test('rankings use the per-type win rate', async () => {
    if (!connected) return;
    const [alice, bob] = await Promise.all(['Alice', 'Bob'].map(createIdentity));
    for (let day = 1; day <= 5; day++) {
      await insertWizardGame(day <= 4 ? [alice, bob] : [bob, alice], [100, 50], new Date(`2026-01-0${day}`));
    }
    await eloService.recalculateAllElo();

    const { rankings } = await eloService.getEloRankings({ gameType: 'wizard', minGames: 1 });
    expect(rankings[0].displayName).toBe('Alice');
    expect(rankings[0].winRate).toBe('80.0');
    expect(rankings[1].winRate).toBe('20.0');
  }, 20000);
});

describe('game type keys', () => {
  test('every spelling of a game shares one rating', async () => {
    if (!connected) return;
    const [alice, bob] = await Promise.all(['Alice', 'Bob'].map(createIdentity));
    await insertTableGame('Flip 7', [alice, bob], [200, 150], new Date('2026-01-01'));
    await insertTableGame('Flip7', [alice, bob], [210, 120], new Date('2026-01-02'));
    await insertTableGame('FLIP-7', [bob, alice], [205, 190], new Date('2026-01-03'));

    await eloService.recalculateAllElo();

    const stored = await PlayerIdentity.findById(alice._id).lean();
    expect(Object.keys(stored.eloByGameType)).toEqual(['flip7']);
    expect(stored.eloByGameType.flip7.gamesPlayed).toBe(3);
    expect(stored.eloByGameType.flip7.wins).toBe(2);
  }, 20000);
});

describe('recalculation lock', () => {
  const lockDoc = () => mongoose.connection.collection('elolocks').findOne({ _id: 'elo-recalculation' });

  test('a game finished during a recalculation is rated once it is done', async () => {
    if (!connected) return;
    const [alice, bob] = await Promise.all(['Alice', 'Bob'].map(createIdentity));

    expect(await eloService.acquireRecalculationLock()).toBe(true);
    const game = await insertWizardGame([alice, bob], [100, 50], new Date('2026-01-01'));

    // Deferred instead of written underneath the running recalculation
    expect(await eloService.updateRatingsForGame(game, 'wizard')).toEqual([]);
    expect((await PlayerIdentity.findById(alice._id).lean()).eloByGameType?.wizard).toBeUndefined();

    const pending = await eloService.releaseRecalculationLock();
    expect(pending.map(p => p.gameId.toString())).toEqual([game._id.toString()]);
    await eloService.applyDeferredUpdates(pending);

    const stored = await PlayerIdentity.findById(alice._id).lean();
    expect(stored.eloByGameType.wizard.gamesPlayed).toBe(1);
  }, 20000);

  test('a second recalculation request is queued as a rerun, not run alongside', async () => {
    if (!connected) return;
    expect(await eloService.acquireRecalculationLock()).toBe(true);

    const result = await eloService.recalculateAllElo();
    expect(result.queued).toBe(true);
    expect((await lockDoc()).rerun).toBe(true);

    await eloService.releaseRecalculationLock();
  }, 20000);

  test('a recalculation releases the lock and counts a deferred game exactly once', async () => {
    if (!connected) return;
    const [alice, bob] = await Promise.all(['Alice', 'Bob'].map(createIdentity));

    // A crashed run left an expired lock with a queued game behind
    expect(await eloService.acquireRecalculationLock()).toBe(true);
    const game = await insertWizardGame([alice, bob], [100, 50], new Date('2026-01-01'));
    await eloService.updateRatingsForGame(game, 'wizard');
    await mongoose.connection.collection('elolocks').updateOne(
      { _id: 'elo-recalculation' },
      { $set: { expiresAt: new Date(Date.now() - 1000) } }
    );

    await eloService.recalculateAllElo();

    expect(await lockDoc()).toBeNull();
    const stored = await PlayerIdentity.findById(alice._id).lean();
    expect(stored.eloByGameType.wizard.gamesPlayed).toBe(1);
    expect(stored.eloByGameType.wizard.history).toHaveLength(1);
  }, 20000);
});

describe('leaderboard snapshot', () => {
  test('one snapshot serves every filter, grouping spellings of a game', async () => {
    if (!connected) return;
    const [alice, bob] = await Promise.all(['Alice', 'Bob'].map(createIdentity));
    await insertWizardGame([alice, bob], [100, 50], new Date('2026-01-01'));
    await insertTableGame('Flip 7', [alice, bob], [100, 150], new Date('2026-01-02'));
    await insertTableGame('Flip7', [alice, bob], [90, 150], new Date('2026-01-03'));
    await eloService.recalculateAllElo();

    const snapshot = await buildLeaderboardSnapshot();
    expect(snapshot.gameTypes).toEqual(['Flip 7', 'Wizard']);
    expect(snapshot.totalGames).toBe(3);

    const flip = selectLeaderboard(snapshot, { gameType: 'flip7' });
    expect(flip.leaderboard.map(p => [p.name, p.totalGames, p.wins])).toEqual([['Bob', 2, 2], ['Alice', 2, 0]]);
    expect(flip.leaderboard[0].elo).toBeGreaterThan(1000);
    expect(Object.keys(flip.leaderboard[0].gameTypes)).toEqual(['Flip 7']);

    const all = selectLeaderboard(snapshot, {});
    const aliceAll = all.leaderboard.find(p => p.name === 'Alice');
    expect(aliceAll.totalGames).toBe(3);
    expect(aliceAll.wins).toBe(1);
    expect(aliceAll.elo).toBe(1000);

    const paged = selectLeaderboard(snapshot, { gameType: 'Wizard', limit: 1, page: 2 });
    expect(paged.leaderboard.map(p => p.name)).toEqual(['Bob']);
    expect(paged.pagination).toMatchObject({ totalPlayers: 2, totalPages: 2, hasPrevPage: true });
  }, 20000);
});
