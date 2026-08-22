import { describe, it, expect } from 'vitest';
import { dedupeGames, getGameContentKey, getGameIdentityKeys, mergeGameEntries } from '../gameDedup';

const cloudWizardGame = (overrides = {}) => ({
  id: 'cloud-1',
  cloudId: 'cloud-1',
  localId: 'game_1000',
  gameType: 'wizard',
  players: [{ id: 'p1', name: 'Justin' }, { id: 'p2', name: 'Cindy' }],
  final_scores: { p1: 210, p2: 180 },
  total_rounds: 15,
  created_at: '2026-08-08T20:55:00.000Z',
  gameFinished: true,
  isCloud: true,
  isUploaded: true,
  ...overrides
});

const localWizardGame = (overrides = {}) => ({
  id: 'game_1000',
  cloudGameId: null,
  version: '3.0',
  players: [{ id: 'p1', name: 'Justin' }, { id: 'p2', name: 'Cindy' }],
  final_scores: { p1: 210, p2: 180 },
  total_rounds: 15,
  created_at: '2026-08-08T20:55:00.000Z',
  gameFinished: true,
  isLocal: true,
  isUploaded: false,
  ...overrides
});

const tableGame = (overrides = {}) => ({
  id: 'table_game_1',
  name: 'Flip 7',
  gameType: 'table',
  players: ['Justin', 'Karina'],
  totalRounds: 8,
  winner_name: 'Karina',
  created_at: '2026-08-08T18:00:00.000Z',
  gameFinished: true,
  ...overrides
});

describe('getGameIdentityKeys', () => {
  it('collects every identifier a game is known by', () => {
    expect(getGameIdentityKeys(cloudWizardGame())).toEqual(['cloud-1', 'game_1000']);
  });

  it('ignores empty identifiers', () => {
    expect(getGameIdentityKeys(localWizardGame())).toEqual(['game_1000']);
  });

  it('returns an empty list for missing games', () => {
    expect(getGameIdentityKeys(null)).toEqual([]);
  });
});

describe('getGameContentKey', () => {
  it('matches a cloud game and its local copy regardless of timestamp source', () => {
    const cloud = cloudWizardGame({ created_at: '2026-08-08T21:03:00.000Z' });
    const local = localWizardGame();
    expect(getGameContentKey(cloud)).toBe(getGameContentKey(local));
  });

  it('is order independent for players and scores', () => {
    const reordered = localWizardGame({
      players: [{ id: 'p2', name: 'Cindy' }, { id: 'p1', name: 'Justin' }],
      final_scores: { p2: 180, p1: 210 }
    });
    expect(getGameContentKey(reordered)).toBe(getGameContentKey(localWizardGame()));
  });

  it('separates games that differ in scores, players or rounds', () => {
    const base = getGameContentKey(localWizardGame());
    expect(getGameContentKey(localWizardGame({ final_scores: { p1: 210, p2: 190 } }))).not.toBe(base);
    expect(getGameContentKey(localWizardGame({ total_rounds: 12 }))).not.toBe(base);
    expect(getGameContentKey(localWizardGame({
      players: [{ id: 'p1', name: 'Justin' }, { id: 'p3', name: 'Frida' }]
    }))).not.toBe(base);
  });

  it('returns null when there is not enough signal to match by content', () => {
    expect(getGameContentKey(localWizardGame({ final_scores: {} }))).toBeNull();
    expect(getGameContentKey(localWizardGame({ players: [] }))).toBeNull();
    expect(getGameContentKey(tableGame({ created_at: null, lastPlayed: null, savedAt: null }))).toBeNull();
  });
});

describe('mergeGameEntries', () => {
  it('keeps the base id and inherits the ids and flags of the duplicate', () => {
    const merged = mergeGameEntries(cloudWizardGame(), localWizardGame({ id: 'game_9999' }));
    expect(merged.id).toBe('cloud-1');
    expect(merged.cloudId).toBe('cloud-1');
    expect(merged.isLocal).toBe(true);
    expect(merged.isCloud).toBe(true);
    expect(merged.isUploaded).toBe(true);
  });

  it('fills gaps from the duplicate without overwriting known values', () => {
    const merged = mergeGameEntries(
      tableGame({ winner_name: 'Not determined', scoreEntryMode: undefined }),
      tableGame({ id: 'cloud-t1', winner_name: 'Karina', scoreEntryMode: 'twoSideGesture' })
    );
    expect(merged.winner_name).toBe('Karina');
    expect(merged.scoreEntryMode).toBe('twoSideGesture');
    expect(merged.name).toBe('Flip 7');
  });
});

describe('dedupeGames', () => {
  it('collapses a cloud game and the local copy linked by localId', () => {
    const result = dedupeGames([cloudWizardGame(), localWizardGame()]);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('cloud-1');
    expect(result[0].isLocal).toBe(true);
  });

  it('collapses a local copy linked only by cloudGameId', () => {
    const local = localWizardGame({ id: 'game_downloaded_42', cloudGameId: 'cloud-1', isUploaded: true });
    const result = dedupeGames([cloudWizardGame(), local]);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('cloud-1');
  });

  it('collapses copies with no shared id by content', () => {
    // Upload was rejected as a duplicate, so the local game never learned its cloud id
    const local = localWizardGame({ id: 'game_from_other_device' });
    const result = dedupeGames([cloudWizardGame(), local]);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('cloud-1');
    expect(result[0].isLocal).toBe(true);
  });

  it('collapses two cloud documents of the same game uploaded by different users', () => {
    const result = dedupeGames([
      cloudWizardGame(),
      cloudWizardGame({ id: 'cloud-2', cloudId: 'cloud-2', localId: 'game_2000' })
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('cloud-1');
  });

  it('collapses the same local game listed twice from two storages', () => {
    const scoreboard = { ...tableGame({ id: 'scoreboard_game_1', gameType: 'scoreboard' }), isLocal: true };
    const result = dedupeGames([scoreboard, { ...scoreboard, storageType: 'scoreboard' }]);
    expect(result).toHaveLength(1);
  });

  it('keeps genuinely different games', () => {
    const result = dedupeGames([
      cloudWizardGame(),
      cloudWizardGame({ id: 'cloud-2', cloudId: 'cloud-2', localId: 'game_2000', final_scores: { p1: 300, p2: 120 } }),
      tableGame()
    ]);
    expect(result).toHaveLength(3);
  });

  it('does not merge two local table games with the same shape played on the same day', () => {
    const first = { ...tableGame(), isLocal: true };
    const rematch = { ...tableGame({ id: 'table_game_2' }), isLocal: true };
    expect(dedupeGames([first, rematch])).toHaveLength(2);
  });

  it('does not merge two table games played at different times of the same day', () => {
    // Generic team names and few rounds repeat all evening - only the start time separates them
    const cloud = tableGame({
      id: 'cloud-t1', cloudId: 'cloud-t1', name: 'Volleyball', players: ['Team 1', 'Team 2'],
      totalRounds: 1, winner_name: 'Team 1', created_at: '2026-08-08T13:50:15.000Z',
      isCloud: true, isUploaded: true
    });
    const local = tableGame({
      id: 'scoreboard_game_2', name: 'Volleyball', players: ['Team 1', 'Team 2'],
      totalRounds: 1, winner_name: 'Team 1', created_at: '2026-08-08T14:34:58.000Z',
      isLocal: true
    });
    expect(dedupeGames([cloud, local])).toHaveLength(2);
  });

  it('merges a local table game into its cloud copy by content', () => {
    const cloud = tableGame({ id: 'cloud-t1', cloudId: 'cloud-t1', localId: 'other', isCloud: true, isUploaded: true });
    const local = { ...tableGame(), isLocal: true };
    const result = dedupeGames([cloud, local]);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('cloud-t1');
    expect(result[0].isLocal).toBe(true);
  });

  it('honours input order when choosing which entry to keep', () => {
    const result = dedupeGames([localWizardGame(), cloudWizardGame()]);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('game_1000');
    expect(result[0].cloudId).toBe('cloud-1');
    expect(result[0].isUploaded).toBe(true);
  });

  it('tolerates empty and invalid input', () => {
    expect(dedupeGames([])).toEqual([]);
    expect(dedupeGames(null)).toEqual([]);
    expect(dedupeGames([null, undefined, cloudWizardGame()])).toHaveLength(1);
  });
});
