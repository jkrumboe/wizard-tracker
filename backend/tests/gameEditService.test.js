/**
 * Tests for the admin game editor (utils/gameEditService.js).
 * Score/winner recomputation is pure; player relinking runs against a mocked
 * PlayerIdentity model, so no database is required.
 */

const mongoose = require('mongoose');
const {
  GameEditError,
  wizardRoundScore,
  applyWizardRoundEdits,
  recomputeWizardResults,
  applyTablePointEdits,
  recomputeTableResults,
  resolvePlayerEdits
} = require('../utils/gameEditService');

const MATTES_ID = new mongoose.Types.ObjectId();
const MATES_ID = new mongoose.Types.ObjectId();
const CINDY_ID = new mongoose.Types.ObjectId();

const wizardGameData = (overrides = {}) => ({
  version: '3.0',
  created_at: '2026-08-08T20:55:00.000Z',
  total_rounds: 2,
  gameFinished: true,
  players: [
    { id: 'p1', name: 'Mates', identityId: MATES_ID },
    { id: 'p2', name: 'Cindy', identityId: CINDY_ID }
  ],
  round_data: [
    { players: [{ id: 'p1', call: 1, made: 1, score: 30 }, { id: 'p2', call: 0, made: 1, score: -10 }] },
    { players: [{ id: 'p1', call: 0, made: 0, score: 20 }, { id: 'p2', call: 2, made: 2, score: 40 }] }
  ],
  final_scores: { p1: 50, p2: 30 },
  winner_id: ['p1'],
  ...overrides
});

describe('wizardRoundScore', () => {
  it('scores a correct call with the base and per-trick bonus', () => {
    expect(wizardRoundScore(0, 0)).toBe(20);
    expect(wizardRoundScore(3, 3)).toBe(50);
  });

  it('penalises every trick of difference', () => {
    expect(wizardRoundScore(2, 0)).toBe(-20);
    expect(wizardRoundScore(0, 3)).toBe(-30);
  });

  it('returns null while call or made is missing', () => {
    expect(wizardRoundScore(null, 1)).toBeNull();
    expect(wizardRoundScore(1, null)).toBeNull();
  });
});

describe('applyWizardRoundEdits', () => {
  it('recalculates the score from call and made when no score is given', () => {
    const result = applyWizardRoundEdits(wizardGameData(), [
      { players: [{ id: 'p2', call: 1, made: 1 }] },
      { players: [] }
    ]);
    expect(result.round_data[0].players[1]).toMatchObject({ id: 'p2', call: 1, made: 1, score: 30 });
    // Untouched players are kept as they were
    expect(result.round_data[0].players[0]).toMatchObject({ id: 'p1', score: 30 });
  });

  it('keeps an explicit score (custom scoring formulas)', () => {
    const result = applyWizardRoundEdits(wizardGameData(), [
      { players: [{ id: 'p1', call: 1, made: 1, score: 99 }] },
      { players: [] }
    ]);
    expect(result.round_data[0].players[0].score).toBe(99);
  });

  it('refuses to add or remove rounds', () => {
    expect(() => applyWizardRoundEdits(wizardGameData(), [{ players: [] }])).toThrow(GameEditError);
  });

  it('rejects unknown players and invalid numbers', () => {
    expect(() => applyWizardRoundEdits(wizardGameData(), [
      { players: [{ id: 'ghost', call: 0, made: 0 }] }, { players: [] }
    ])).toThrow(/unknown player/);
    expect(() => applyWizardRoundEdits(wizardGameData(), [
      { players: [{ id: 'p1', call: -1, made: 0 }] }, { players: [] }
    ])).toThrow(GameEditError);
  });
});

describe('recomputeWizardResults', () => {
  it('rebuilds final scores and the winner from the rounds', () => {
    const edited = applyWizardRoundEdits(wizardGameData(), [
      { players: [] },
      { players: [{ id: 'p2', call: 4, made: 4 }] } // 40 -> 60
    ]);
    const result = recomputeWizardResults(edited);
    expect(result.final_scores).toEqual({ p1: 50, p2: 50 });
    expect(result.winner_id).toEqual(['p1', 'p2']);
  });

  it('also updates the legacy winner_ids field when present', () => {
    const result = recomputeWizardResults(wizardGameData({ winner_ids: ['p1'], final_scores: {} }));
    expect(result.winner_ids).toEqual(['p1']);
  });

  it('does not invent a winner for an unfinished game', () => {
    const result = recomputeWizardResults(wizardGameData({ gameFinished: false, winner_id: undefined }));
    expect(result.winner_id).toBeUndefined();
    expect(result.final_scores).toEqual({ p1: 50, p2: 30 });
  });
});

describe('table game edits', () => {
  const tableGameData = () => ({
    gameFinished: true,
    players: [
      { id: 'a', name: 'Mates', identityId: MATES_ID, points: [10, 5] },
      { id: 'b', name: 'Cindy', identityId: CINDY_ID, points: [3, 4] }
    ],
    winner_id: 'a',
    winner_ids: ['a'],
    winner_name: 'Mates'
  });

  it('stores edited points and keeps empty cells as ""', () => {
    const result = applyTablePointEdits(tableGameData(), [{ index: 1, points: ['20', ''] }]);
    expect(result.players[1].points).toEqual([20, '']);
    expect(result.players[0].points).toEqual([10, 5]);
  });

  it('recomputes winners after a correction', () => {
    const edited = applyTablePointEdits(tableGameData(), [{ index: 1, points: [20, 4] }]);
    const result = recomputeTableResults(edited, false);
    expect(result.winner_ids).toEqual(['b']);
    expect(result.winner_name).toBe('Cindy');
    expect(String(result.winner_identityId)).toBe(String(CINDY_ID));
  });

  it('respects lowIsBetter', () => {
    const result = recomputeTableResults(tableGameData(), true);
    expect(result.winner_ids).toEqual(['b']);
  });
});

describe('resolvePlayerEdits', () => {
  const identities = {
    [String(MATTES_ID)]: { _id: MATTES_ID, displayName: 'Mattes', userId: null, mergedInto: null },
    [String(MATES_ID)]: { _id: MATES_ID, displayName: 'Mates', userId: null, mergedInto: null },
    [String(CINDY_ID)]: { _id: CINDY_ID, displayName: 'Cindy', userId: null, mergedInto: null }
  };
  const byName = (name) => Object.values(identities)
    .find(identity => identity.displayName.toLowerCase() === name.toLowerCase()) || null;

  const PlayerIdentity = {
    findById: jest.fn(async (id) => identities[String(id)] || null),
    findOne: jest.fn(async (query) => identities[String(query._id.$eq)] || null),
    findByName: jest.fn(async (name) => byName(name)),
    findOrCreateByName: jest.fn(async (name) => ({
      _id: new mongoose.Types.ObjectId(), displayName: name, userId: null
    }))
  };

  let modelSpy;
  beforeEach(() => {
    jest.clearAllMocks();
    modelSpy = jest.spyOn(mongoose, 'model').mockImplementation(() => PlayerIdentity);
  });
  afterEach(() => modelSpy.mockRestore());

  const players = () => wizardGameData().players;
  const keyOf = (player) => String(player.id);

  it('relinks a misspelled player to the existing identity of the corrected name', async () => {
    const { players: result, changes } = await resolvePlayerEdits(
      players(), [{ key: 'p1', name: 'Mattes' }], keyOf, 'admin'
    );
    expect(result[0].name).toBe('Mattes');
    expect(String(result[0].identityId)).toBe(String(MATTES_ID));
    expect(result[0].id).toBe('p1'); // round data keeps pointing at the same player
    expect(changes).toEqual([expect.objectContaining({
      fromName: 'Mates',
      toName: 'Mattes',
      fromIdentityId: String(MATES_ID),
      toIdentityId: String(MATTES_ID),
      createdIdentity: false
    })]);
    expect(PlayerIdentity.findOrCreateByName).not.toHaveBeenCalled();
  });

  it('uses an explicitly selected identity', async () => {
    const { players: result } = await resolvePlayerEdits(
      players(), [{ key: 'p1', name: 'Mattes', identityId: String(MATTES_ID) }], keyOf, 'admin'
    );
    expect(String(result[0].identityId)).toBe(String(MATTES_ID));
  });

  it('creates a new guest identity for a name nobody has', async () => {
    const { players: result, changes } = await resolvePlayerEdits(
      players(), [{ key: 'p1', name: 'Matthias' }], keyOf, 'admin'
    );
    expect(result[0].name).toBe('Matthias');
    expect(changes[0].createdIdentity).toBe(true);
  });

  it('keeps the link when the name is unchanged', async () => {
    const { players: result, changes } = await resolvePlayerEdits(
      players(), [{ key: 'p1', name: 'Mates' }], keyOf, 'admin'
    );
    expect(String(result[0].identityId)).toBe(String(MATES_ID));
    expect(changes).toEqual([]);
  });

  it('refuses to put the same player into a game twice', async () => {
    await expect(resolvePlayerEdits(
      players(), [{ key: 'p1', name: 'Cindy' }], keyOf, 'admin'
    )).rejects.toThrow(/same player/);
  });

  it('rejects empty names', async () => {
    await expect(resolvePlayerEdits(
      players(), [{ key: 'p1', name: '   ' }], keyOf, 'admin'
    )).rejects.toThrow(GameEditError);
  });
});
