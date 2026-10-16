import { describe, it, expect } from 'vitest';
import { gameBelongsToTemplate } from '../templateGames';

const wizard = { name: 'Wizard', gameCategory: 'callAndMade' };
const customCallAndMade = { name: 'Oh Hell', gameCategory: 'callAndMade' };
const dutch = { name: 'Dutch', gameCategory: 'table' };
const volleyball = { name: 'Volleyball', gameCategory: 'table', scoreEntryMode: 'twoSideGesture' };

describe('gameBelongsToTemplate', () => {
  it('matches table and scoreboard games by name, ignoring case', () => {
    expect(gameBelongsToTemplate({ gameType: 'table', name: 'dutch ' }, dutch)).toBe(true);
    expect(gameBelongsToTemplate({ gameType: 'table', name: 'Flip 7' }, dutch)).toBe(false);
    expect(gameBelongsToTemplate({ type: 'scoreboard', name: 'Volleyball' }, volleyball)).toBe(true);
  });

  it('counts Call & Made games without a recorded template as Wizard', () => {
    const legacyGame = { gameType: 'wizard', name: 'Paused Game - Round 2/3' };
    expect(gameBelongsToTemplate(legacyGame, wizard)).toBe(true);
    expect(gameBelongsToTemplate(legacyGame, customCallAndMade)).toBe(false);
  });

  it('uses the recorded template name for Call & Made games', () => {
    const game = { type: 'wizard', templateName: 'Oh Hell' };
    expect(gameBelongsToTemplate(game, customCallAndMade)).toBe(true);
    expect(gameBelongsToTemplate(game, wizard)).toBe(false);

    const stored = { gameType: 'wizard', _internalState: { templateConfig: { templateName: 'Oh Hell' } } };
    expect(gameBelongsToTemplate(stored, customCallAndMade)).toBe(true);
  });

  it('never puts Call & Made games under table templates or vice versa', () => {
    expect(gameBelongsToTemplate({ gameType: 'wizard', name: 'Dutch' }, dutch)).toBe(false);
    expect(gameBelongsToTemplate({ gameType: 'table', name: 'Wizard' }, wizard)).toBe(false);
  });

  it('handles missing input', () => {
    expect(gameBelongsToTemplate(null, dutch)).toBe(false);
    expect(gameBelongsToTemplate({ gameType: 'table', name: 'Dutch' }, null)).toBe(false);
  });
});
