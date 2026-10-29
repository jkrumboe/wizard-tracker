import { describe, it, expect } from 'vitest';
import { getGameTypeKey, getStatsGameTypes, filterGamesByType } from '../gameTypes';

const table = (gameTypeName) => ({ gameType: 'table', gameTypeName });

describe('getGameTypeKey', () => {
  it('treats spellings of one game as the same key', () => {
    expect(getGameTypeKey('Flip 7')).toBe('flip7');
    expect(getGameTypeKey('Flip7')).toBe('flip7');
    expect(getGameTypeKey('FLIP-7')).toBe('flip7');
    expect(getGameTypeKey(' flip 7 ')).toBe('flip7');
  });

  it('drops punctuation and accents but keeps other letters', () => {
    expect(getGameTypeKey('Dr. Eureka')).toBe('dreureka');
    expect(getGameTypeKey('Mölkky')).toBe('molkky');
    expect(getGameTypeKey('6 nimmt!')).toBe('6nimmt');
  });

  it('keeps Wizard as "wizard" and handles empty names', () => {
    expect(getGameTypeKey('Wizard')).toBe('wizard');
    expect(getGameTypeKey('')).toBe('unknown');
    expect(getGameTypeKey('!!!')).toBe('unknown');
  });
});

describe('getStatsGameTypes', () => {
  it('lists Wizard first and merges spellings under the most used one', () => {
    const games = [
      { gameType: 'wizard' },
      table('Flip 7'),
      table('Flip7'),
      table('Flip 7'),
      table('Dutch'),
    ];

    expect(getStatsGameTypes(games)).toEqual([
      { value: 'wizard', label: 'Wizard', count: 1 },
      { value: 'flip7', label: 'Flip 7', count: 3 },
      { value: 'dutch', label: 'Dutch', count: 1 },
    ]);
  });

  it('returns nothing for no games', () => {
    expect(getStatsGameTypes(undefined)).toEqual([]);
  });
});

describe('filterGamesByType', () => {
  it('keeps every spelling of the selected game and nothing else', () => {
    const games = [{ gameType: 'wizard' }, table('Flip 7'), table('flip7'), table('Dutch')];

    expect(filterGamesByType(games, 'flip7')).toHaveLength(2);
    expect(filterGamesByType(games, 'wizard')).toEqual([{ gameType: 'wizard' }]);
  });

  it('counts scoreboard games as table-like', () => {
    const games = [{ gameType: 'scoreboard', gameTypeName: 'Skull King' }];
    expect(filterGamesByType(games, 'skullking')).toHaveLength(1);
    expect(filterGamesByType(games, 'wizard')).toHaveLength(0);
  });
});
