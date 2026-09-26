import { describe, it, expect, beforeEach } from 'vitest';
import { getResumableGames } from '../resumableGames';
import { LocalGameStorage } from '../../api/localGameStorage.js';

const WIZARD_KEY = 'wizardTracker_localGames';
const TABLE_KEY = 'wizardTracker_tableGames';
const SCOREBOARD_KEY = 'wizardTracker_scoreboardGames';

const wizardGame = (overrides = {}) => ({
  id: 'game-1',
  version: '3.0',
  name: 'Paused Game - Round 2/3',
  total_rounds: 3,
  players: [{ id: 'p1', name: 'Alice' }, { id: 'p2', name: 'Bob' }],
  round_data: [{ players: [{ id: 'p1', call: 1, made: 1, score: 30 }] }],
  gameFinished: false,
  savedAt: '2026-09-20T10:00:00.000Z',
  lastPlayed: '2026-09-20T10:00:00.000Z',
  _internalState: { currentRound: 2, maxRounds: 3, gameStarted: true, isPaused: true },
  ...overrides,
});

const tableGame = (overrides = {}) => ({
  id: 'table_game_1',
  name: 'Rummy',
  savedAt: '2026-09-21T10:00:00.000Z',
  lastPlayed: '2026-09-21T10:00:00.000Z',
  gameFinished: false,
  gameData: {
    players: [
      { id: 'p1', name: 'Alice', points: ['12', ''] },
      { id: 'p2', name: 'Bob', points: ['8', ''] },
    ],
    rows: 10,
  },
  ...overrides,
});

const scoreboardGame = (overrides = {}) => ({
  id: 'scoreboard_game_1',
  name: 'Volleyball',
  savedAt: '2026-09-22T10:00:00.000Z',
  lastPlayed: '2026-09-22T10:00:00.000Z',
  gameFinished: false,
  gameData: {
    players: [
      { id: 'a', name: 'Team A', points: ['21'] },
      { id: 'b', name: 'Team B', points: ['18'] },
    ],
    scoreEntryMode: 'twoSideGesture',
    rows: 3,
  },
  ...overrides,
});

describe('getResumableGames', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('collects unfinished games from every local store, newest first', () => {
    localStorage.setItem(WIZARD_KEY, JSON.stringify({ 'game-1': wizardGame() }));
    localStorage.setItem(TABLE_KEY, JSON.stringify({ table_game_1: tableGame() }));
    localStorage.setItem(SCOREBOARD_KEY, JSON.stringify({ scoreboard_game_1: scoreboardGame() }));

    const games = getResumableGames();

    expect(games.map(game => game.id)).toEqual(['scoreboard_game_1', 'table_game_1', 'game-1']);
    expect(games.map(game => game.route)).toEqual([
      '/scoreboard/scoreboard_game_1',
      '/table/table_game_1',
      '/game/current',
    ]);
  });

  it('leaves out finished games', () => {
    localStorage.setItem(WIZARD_KEY, JSON.stringify({
      'game-1': wizardGame({ gameFinished: true }),
    }));
    localStorage.setItem(TABLE_KEY, JSON.stringify({
      table_game_1: tableGame({ gameFinished: true }),
    }));

    expect(getResumableGames()).toEqual([]);
  });

  it('leaves out the auto-save placeholder of a running Call & Made game', () => {
    localStorage.setItem(WIZARD_KEY, JSON.stringify({
      'game-1': wizardGame({ name: 'Current Game (Auto-save)' }),
    }));

    expect(getResumableGames()).toEqual([]);
  });

  it('offers a freshly opened table game that has no scores yet', () => {
    localStorage.setItem(TABLE_KEY, JSON.stringify({
      table_game_1: tableGame({
        gameData: {
          players: [{ id: 'p1', name: 'Alice', points: ['', ''] }],
          rows: 10,
        },
      }),
    }));

    expect(getResumableGames().map(game => game.id)).toEqual(['table_game_1']);
  });

  it('puts the game that was left most recently first', () => {
    localStorage.setItem(WIZARD_KEY, JSON.stringify({
      'game-1': wizardGame({ lastPlayed: '2026-09-23T10:00:00.000Z' }),
    }));
    localStorage.setItem(TABLE_KEY, JSON.stringify({
      table_game_1: tableGame({ lastPlayed: '2026-09-23T11:00:00.000Z' }),
    }));

    expect(getResumableGames()[0].id).toBe('table_game_1');

    // Re-opening the Call & Made game stamps it as the newest again
    LocalGameStorage.markGamePaused('game-1');

    expect(getResumableGames()[0].id).toBe('game-1');
  });

  it('routes table games saved in gesture mode to the scoreboard page', () => {
    localStorage.setItem(TABLE_KEY, JSON.stringify({
      table_game_1: tableGame({
        gameData: { ...tableGame().gameData, scoreEntryMode: 'twoSideGesture' },
      }),
    }));

    const [game] = getResumableGames();

    expect(game.type).toBe('scoreboard');
    expect(game.route).toBe('/scoreboard/table_game_1');
  });

  it('offers a Call & Made game that was auto-paused on leaving the game screen', () => {
    localStorage.setItem(WIZARD_KEY, JSON.stringify({
      'game-1': wizardGame({ name: 'Current Game (Auto-save)' }),
    }));

    LocalGameStorage.markGamePaused('game-1', 'Paused Game - Round 2/3');

    const [game] = getResumableGames();

    expect(game.id).toBe('game-1');
    expect(game.name).toBe('Paused Game - Round 2/3');
    expect(game.currentRound).toBe(2);
    expect(game.maxRounds).toBe(3);
  });

  it('honours the limit', () => {
    localStorage.setItem(WIZARD_KEY, JSON.stringify({
      'game-1': wizardGame(),
      'game-2': wizardGame({ id: 'game-2', lastPlayed: '2026-09-19T10:00:00.000Z' }),
    }));

    expect(getResumableGames({ limit: 1 })).toHaveLength(1);
  });
});
