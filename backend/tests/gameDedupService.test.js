/**
 * Tests for the duplicate game detection used by scripts/dedupe-games.js
 * Fingerprinting and grouping are pure; the removal path runs against a mocked
 * mongoose, so no database is required.
 */

const {
  getWizardFingerprint,
  getTableFingerprint,
  groupDuplicates,
  pickKeeper
} = require('../utils/gameDedupService');

const wizardDoc = (overrides = {}, gameDataOverrides = {}) => ({
  _id: 'a1',
  localId: 'game_1000',
  userId: 'user_justin',
  createdAt: '2026-08-08T21:00:00.000Z',
  gameData: {
    version: '3.0',
    created_at: '2026-08-08T20:55:00.000Z',
    total_rounds: 15,
    gameFinished: true,
    players: [
      { id: 'p1', name: 'Justin' },
      { id: 'p2', name: 'Cindy' },
      { id: 'p3', name: 'Jürgen' }
    ],
    final_scores: { p1: 210, p2: 180, p3: 320 },
    ...gameDataOverrides
  },
  ...overrides
});

const tableDoc = (overrides = {}, gameDataOverrides = {}) => ({
  _id: 't1',
  localId: 'table_game_1',
  userId: 'user_justin',
  name: 'Flip 7',
  gameTypeName: 'Flip 7',
  totalRounds: 8,
  createdAt: '2026-08-08T18:30:00.000Z',
  gameData: {
    created_at: '2026-08-08T18:00:00.000Z',
    gameName: 'Flip 7',
    rows: 8,
    gameFinished: true,
    players: [
      { name: 'Justin', points: [10, 20, 30] },
      { name: 'Karina', points: [40, 50, 60] }
    ],
    ...gameDataOverrides
  },
  ...overrides
});

describe('getWizardFingerprint', () => {
  it('matches two uploads of the same game', () => {
    const first = wizardDoc();
    const second = wizardDoc({
      _id: 'a2',
      localId: 'game_2000',
      userId: 'user_juergen',
      createdAt: '2026-08-09T08:12:00.000Z' // uploaded later, by someone else
    });
    expect(getWizardFingerprint(first)).toBe(getWizardFingerprint(second));
  });

  it('is independent of player and score ordering', () => {
    const reordered = wizardDoc({}, {
      players: [
        { id: 'p3', name: 'Jürgen' },
        { id: 'p1', name: 'Justin' },
        { id: 'p2', name: 'Cindy' }
      ],
      final_scores: { p3: 320, p2: 180, p1: 210 }
    });
    expect(getWizardFingerprint(reordered)).toBe(getWizardFingerprint(wizardDoc()));
  });

  it('separates games that differ in scores, rounds or players', () => {
    const base = getWizardFingerprint(wizardDoc());
    expect(getWizardFingerprint(wizardDoc({}, { final_scores: { p1: 210, p2: 180, p3: 300 } }))).not.toBe(base);
    expect(getWizardFingerprint(wizardDoc({}, { total_rounds: 13 }))).not.toBe(base);
    expect(getWizardFingerprint(wizardDoc({}, {
      players: [{ id: 'p1', name: 'Justin' }, { id: 'p2', name: 'Frida' }]
    }))).not.toBe(base);
  });

  it('separates games played on different days unless the date is ignored', () => {
    const otherDay = wizardDoc({}, { created_at: '2026-08-09T20:55:00.000Z' });
    expect(getWizardFingerprint(otherDay)).not.toBe(getWizardFingerprint(wizardDoc()));
    expect(getWizardFingerprint(otherDay, { includeDate: false }))
      .toBe(getWizardFingerprint(wizardDoc(), { includeDate: false }));
  });

  it('returns null for games that cannot be compared safely', () => {
    expect(getWizardFingerprint(wizardDoc({}, { final_scores: {} }))).toBeNull();
    expect(getWizardFingerprint(wizardDoc({}, { players: [] }))).toBeNull();
    expect(getWizardFingerprint(wizardDoc({}, { total_rounds: 0 }))).toBeNull();
  });
});

describe('getTableFingerprint', () => {
  it('matches two uploads of the same table game', () => {
    const second = tableDoc({ _id: 't2', localId: 'table_game_2', userId: 'user_karina' });
    expect(getTableFingerprint(second)).toBe(getTableFingerprint(tableDoc()));
  });

  it('reads the double-nested payload older uploads produced', () => {
    const nested = {
      ...tableDoc({ _id: 't3', localId: 'table_game_3' }),
      gameData: { gameData: tableDoc().gameData }
    };
    expect(getTableFingerprint(nested)).toBe(getTableFingerprint(tableDoc()));
  });

  it('separates two same-day games with generic team names', () => {
    // Real case: "Team 1" vs "Team 2", one round, played 45 minutes apart
    const scoreboard = (id, playedAt) => tableDoc(
      { _id: id, localId: `scoreboard_game_${id}`, name: 'Volleyball', gameTypeName: 'Volleyball', totalRounds: 1 },
      {
        created_at: playedAt,
        players: [{ name: 'Team 1', points: [25] }, { name: 'Team 2', points: [18] }]
      }
    );
    const first = scoreboard('s1', '2026-03-29T13:50:15.070Z');
    const second = scoreboard('s2', '2026-03-29T14:34:58.687Z');

    expect(getTableFingerprint(first)).not.toBe(getTableFingerprint(second));
    // A re-uploaded copy keeps the original start time and is still detected
    const reupload = scoreboard('s3', '2026-03-29T13:50:15.070Z');
    expect(getTableFingerprint(reupload)).toBe(getTableFingerprint(first));
  });

  it('separates different games of the same type', () => {
    const otherScores = tableDoc({}, {
      players: [
        { name: 'Justin', points: [10, 20, 30] },
        { name: 'Karina', points: [40, 50, 61] }
      ]
    });
    expect(getTableFingerprint(otherScores)).not.toBe(getTableFingerprint(tableDoc()));
  });
});

describe('pickKeeper', () => {
  it('prefers the copy with resolved player identities', () => {
    const plain = wizardDoc({ _id: 'a1' });
    const migrated = wizardDoc({ _id: 'a2', createdAt: '2026-08-12T21:00:00.000Z' }, {
      players: [
        { id: 'p1', name: 'Justin', identityId: 'i1' },
        { id: 'p2', name: 'Cindy', identityId: 'i2' },
        { id: 'p3', name: 'Jürgen', identityId: 'i3' }
      ]
    });
    expect(pickKeeper([plain, migrated]).keep._id).toBe('a2');
  });

  it('otherwise keeps the earliest upload', () => {
    const older = wizardDoc({ _id: 'a1', createdAt: '2026-08-08T21:00:00.000Z' });
    const newer = wizardDoc({ _id: 'a2', createdAt: '2026-08-09T21:00:00.000Z' });
    const result = pickKeeper([newer, older]);
    expect(result.keep._id).toBe('a1');
    expect(result.remove.map(doc => doc._id)).toEqual(['a2']);
  });
});

describe('groupDuplicates', () => {
  const groupWizard = (docs, options = {}) =>
    groupDuplicates(docs, { fingerprint: getWizardFingerprint, ...options });

  it('groups the duplicates and leaves unique games alone', () => {
    const docs = [
      wizardDoc(),
      wizardDoc({ _id: 'a2', localId: 'game_2000', userId: 'user_juergen' }),
      wizardDoc({ _id: 'a3', localId: 'game_3000' }, { final_scores: { p1: 100, p2: 90, p3: 80 } })
    ];
    const { groups } = groupWizard(docs);
    expect(groups).toHaveLength(1);
    expect(groups[0].keep._id).toBe('a1');
    expect(groups[0].remove.map(doc => doc._id)).toEqual(['a2']);
  });

  it('handles a game uploaded three times', () => {
    const docs = [
      wizardDoc(),
      wizardDoc({ _id: 'a2', localId: 'game_2000', createdAt: '2026-08-09T10:00:00.000Z' }),
      wizardDoc({ _id: 'a3', localId: 'game_3000', createdAt: '2026-08-10T10:00:00.000Z' })
    ];
    const { groups } = groupWizard(docs);
    expect(groups).toHaveLength(1);
    expect(groups[0].remove).toHaveLength(2);
  });

  it('does not group across uploaders when sameUserOnly is set', () => {
    const docs = [
      wizardDoc(),
      wizardDoc({ _id: 'a2', localId: 'game_2000', userId: 'user_juergen' })
    ];
    expect(groupWizard(docs, { sameUserOnly: true }).groups).toHaveLength(0);
    expect(groupWizard(docs).groups).toHaveLength(1);
  });

  it('counts games it cannot compare instead of grouping them', () => {
    const docs = [
      wizardDoc(),
      wizardDoc({ _id: 'a2', localId: 'game_2000' }, { final_scores: {} }),
      wizardDoc({ _id: 'a3', localId: 'game_3000' }, { players: [] })
    ];
    const { groups, skipped } = groupWizard(docs);
    expect(skipped).toBe(2);
    expect(groups).toHaveLength(0);
  });

  it('never removes every copy of a game', () => {
    const docs = [wizardDoc(), wizardDoc({ _id: 'a2', localId: 'game_2000' })];
    const { groups } = groupWizard(docs);
    const removedIds = groups.flatMap(group => group.remove.map(doc => doc._id));
    const keptIds = groups.map(group => group.keep._id);
    expect(removedIds).not.toContain(keptIds[0]);
    expect(removedIds.length).toBe(docs.length - keptIds.length);
  });
});

/**
 * Removal path - mongoose is mocked so the calls can be asserted without a database.
 */
describe('removeDuplicateGroups', () => {
  const models = {};
  const calls = { updates: [], deletes: [] };

  jest.mock('mongoose', () => ({
    model: (name) => models[name]
  }), { virtual: true });

  beforeEach(() => {
    calls.updates = [];
    calls.deletes = [];
    const makeModel = (name) => ({
      updateOne: jest.fn(async (filter, update) => {
        calls.updates.push({ model: name, filter, update });
        return { modifiedCount: 1 };
      }),
      deleteMany: jest.fn(async (filter) => {
        calls.deletes.push({ model: name, filter });
        const ids = filter._id?.$in || filter.gameId?.$in || [];
        return { deletedCount: ids.length };
      })
    });
    models.WizardGame = makeModel('WizardGame');
    models.TableGame = makeModel('TableGame');
    models.GameEvent = makeModel('GameEvent');
  });

  const { removeDuplicateGroups } = require('../utils/gameDedupService');

  it('deletes only the duplicates and never the kept game', async () => {
    const keep = wizardDoc({ _id: 'a1' });
    const remove = [wizardDoc({ _id: 'a2', localId: 'game_2000' }), wizardDoc({ _id: 'a3', localId: 'game_3000' })];

    const stats = await removeDuplicateGroups([{ fingerprint: 'fp', keep, remove }], 'WizardGame');

    expect(stats).toEqual({ removed: 2, groupsProcessed: 1, eventsRemoved: 0 });
    expect(calls.deletes).toHaveLength(1);
    expect(calls.deletes[0].filter._id.$in).toEqual(['a2', 'a3']);
    expect(calls.deletes[0].filter._id.$in).not.toContain('a1');
  });

  it('records the merged copies on the kept game', async () => {
    const keep = wizardDoc({ _id: 'a1' });
    const remove = [wizardDoc({ _id: 'a2', localId: 'game_2000', userId: 'user_juergen' })];

    await removeDuplicateGroups([{ fingerprint: 'fp', keep, remove }], 'WizardGame');

    expect(calls.updates).toHaveLength(1);
    expect(calls.updates[0].filter).toEqual({ _id: 'a1' });
    const merged = calls.updates[0].update.$set['gameData.mergedDuplicates'];
    expect(merged).toHaveLength(1);
    expect(merged[0]).toMatchObject({ cloudId: 'a2', localId: 'game_2000', userId: 'user_juergen' });
  });

  it('leaves sync events alone unless asked to purge them', async () => {
    const group = { fingerprint: 'fp', keep: wizardDoc({ _id: 'a1' }), remove: [wizardDoc({ _id: 'a2', localId: 'game_2000' })] };

    await removeDuplicateGroups([group], 'WizardGame');
    expect(calls.deletes.filter(call => call.model === 'GameEvent')).toHaveLength(0);

    const stats = await removeDuplicateGroups([group], 'WizardGame', { purgeEvents: true });
    const eventDeletes = calls.deletes.filter(call => call.model === 'GameEvent');
    expect(eventDeletes).toHaveLength(1);
    expect(eventDeletes[0].filter.gameId.$in).toEqual(['game_2000']);
    expect(stats.eventsRemoved).toBe(1);
  });

  it('does nothing for a group with no duplicates', async () => {
    const stats = await removeDuplicateGroups([{ fingerprint: 'fp', keep: wizardDoc(), remove: [] }], 'WizardGame');
    expect(stats).toEqual({ removed: 0, groupsProcessed: 0, eventsRemoved: 0 });
    expect(calls.deletes).toHaveLength(0);
    expect(calls.updates).toHaveLength(0);
  });
});
