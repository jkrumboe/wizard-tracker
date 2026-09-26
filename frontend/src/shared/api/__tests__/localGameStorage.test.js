import { describe, it, expect, beforeEach } from 'vitest';
import { LocalGameStorage } from '../localGameStorage.js';

const STORAGE_KEY = 'wizardTracker_localGames';

function buildValidSavedGame(overrides = {}) {
  const now = new Date().toISOString();
  return {
    id: 'game-1',
    version: '3.0',
    created_at: now,
    duration_seconds: 0,
    total_rounds: 3,
    players: [
      { id: 'p1', name: 'Alice' },
      { id: 'p2', name: 'Bob' },
    ],
    round_data: [
      {
        players: [
          { id: 'p1', call: 1, made: 1, score: 30 },
          { id: 'p2', call: 0, made: 0, score: 20 },
        ],
      },
    ],
    gameFinished: false,
    name: 'Paused Game - Round 1/3',
    savedAt: now,
    lastPlayed: now,
    _internalState: {
      currentRound: 2,
      maxRounds: 3,
      gameStarted: true,
      mode: 'Local',
      isLocal: true,
      isPaused: true,
      referenceDate: now,
      templateConfig: { roundPattern: 'pyramid' },
    },
    ...overrides,
  };
}

describe('LocalGameStorage.loadGame', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns null for v3 saved game with empty root players', () => {
    const saved = buildValidSavedGame({ players: [] });
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ 'game-1': saved }));

    const loaded = LocalGameStorage.loadGame('game-1');

    expect(loaded).toBeNull();
  });

  it('fills round players from root players when a saved round has empty players', () => {
    const saved = buildValidSavedGame({
      round_data: [{ players: [] }],
    });
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ 'game-1': saved }));

    const loaded = LocalGameStorage.loadGame('game-1');

    expect(loaded).not.toBeNull();
    expect(loaded.players).toHaveLength(2);
    expect(loaded.roundData[0].players).toHaveLength(2);
    expect(loaded.roundData[0].players[0].name).toBe('Alice');
    expect(loaded.roundData[0].players[1].name).toBe('Bob');
  });

  it('normalizes currentRound to maxRounds upper bound', () => {
    const saved = buildValidSavedGame({
      _internalState: {
        currentRound: 99,
        maxRounds: 3,
        gameStarted: true,
        mode: 'Local',
        isLocal: true,
        isPaused: true,
      },
    });
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ 'game-1': saved }));

    const loaded = LocalGameStorage.loadGame('game-1');

    expect(loaded).not.toBeNull();
    expect(loaded.currentRound).toBe(3);
    expect(loaded.maxRounds).toBe(3);
  });

  it('returns null for legacy wrapper game without valid players', () => {
    const legacy = {
      id: 'legacy-1',
      name: 'Legacy',
      gameState: {
        players: [],
        roundData: [{ players: [] }],
        currentRound: 1,
        maxRounds: 2,
        gameStarted: true,
      },
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ 'legacy-1': legacy }));

    const loaded = LocalGameStorage.loadGame('legacy-1');

    expect(loaded).toBeNull();
  });
});

describe('LocalGameStorage.markGamePaused', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('flags a v3 game as paused and renames it away from the auto-save placeholder', () => {
    const saved = buildValidSavedGame({
      name: 'Current Game (Auto-save)',
      _internalState: { ...buildValidSavedGame()._internalState, isPaused: false },
    });
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ 'game-1': saved }));

    expect(LocalGameStorage.markGamePaused('game-1', 'Paused Game - Round 2/3')).toBe(true);

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY))['game-1'];
    expect(stored._internalState.isPaused).toBe(true);
    expect(stored.name).toBe('Paused Game - Round 2/3');
  });

  it('keeps the existing name when none is given', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ 'game-1': buildValidSavedGame() }));

    LocalGameStorage.markGamePaused('game-1');

    expect(JSON.parse(localStorage.getItem(STORAGE_KEY))['game-1'].name)
      .toBe('Paused Game - Round 1/3');
  });

  it('flags legacy wrapper games as paused', () => {
    const legacy = {
      id: 'legacy-1',
      name: 'Current Game (Auto-save)',
      gameFinished: false,
      gameState: { players: [{ id: 'p1', name: 'Alice' }], currentRound: 2, isPaused: false },
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ 'legacy-1': legacy }));

    expect(LocalGameStorage.markGamePaused('legacy-1', 'Paused Game')).toBe(true);

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY))['legacy-1'];
    expect(stored.isPaused).toBe(true);
    expect(stored.gameState.isPaused).toBe(true);
  });

  it('leaves finished games and unknown ids alone', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      'game-1': buildValidSavedGame({ gameFinished: true }),
    }));

    expect(LocalGameStorage.markGamePaused('game-1')).toBe(false);
    expect(LocalGameStorage.markGamePaused('missing')).toBe(false);
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY))['game-1'].gameFinished).toBe(true);
  });

  it('does not touch games belonging to another user on the device', () => {
    localStorage.setItem('wizardTracker_currentUserId', 'user-a');
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      'game-1': buildValidSavedGame({ userId: 'user-a' }),
      'game-2': buildValidSavedGame({ id: 'game-2', userId: 'user-b' }),
    }));

    LocalGameStorage.markGamePaused('game-1', 'Paused Game');

    expect(Object.keys(JSON.parse(localStorage.getItem(STORAGE_KEY)))).toEqual(['game-1', 'game-2']);
  });
});
