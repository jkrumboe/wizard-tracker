import { describe, it, expect } from 'vitest';
import {
  createPlayerMatcher,
  didPlayerWin,
  getGamePlayers,
  getPlayerScore,
  resolveUserGameResult,
} from '../playerMatching';

// A table game as the profile API returns it: players carry an identityId, and
// winner_ids are positional ids calculated against this exact players array.
const farAwayGame = (overrides = {}) => ({
  id: 'game-far-away-1',
  gameType: 'table',
  gameTypeName: 'Far Away',
  created_at: '2026-08-01T18:00:00.000Z',
  gameFinished: true,
  lowIsBetter: false,
  winner_ids: ['player_0'],
  gameData: {
    players: [
      { name: 'Cindy', identityId: 'identity-cindy', points: [40, 60] },
      { name: 'Justin', identityId: 'identity-justin', points: [10, 20] },
    ],
    winner_ids: ['player_0'],
  },
  ...overrides,
});

describe('createPlayerMatcher', () => {
  it('does not match a player when both sides are missing the id (the undefined === undefined bug)', () => {
    // Table game players have no userId, and the logged-in user object has no _id
    const matcher = createPlayerMatcher({ id: 'user-1', username: 'Justin' });
    const players = [{ name: 'Cindy' }, { name: 'Bert' }];

    expect(matcher.findIndex(players)).toBe(-1);
    expect(matcher.matches(players[0])).toBe(false);
  });

  it('ignores literal "undefined"/"null" id strings', () => {
    const matcher = createPlayerMatcher({ id: undefined, _id: null, username: 'Justin' });
    expect(matcher.matches({ name: 'Cindy', userId: 'undefined' })).toBe(false);
    expect(matcher.matches({ name: 'Cindy', id: 'null' })).toBe(false);
  });

  it('prefers an identity match on a later player over a name match on an earlier one', () => {
    const matcher = createPlayerMatcher({
      username: 'Justin',
      identityIds: ['identity-justin'],
    });
    const players = [
      { name: 'Justin', identityId: 'identity-other' }, // a different person, same name
      { name: 'JK', identityId: 'identity-justin' },
    ];

    expect(matcher.findIndex(players)).toBe(1);
  });

  it('matches merged guest identities by id and by display name', () => {
    const matcher = createPlayerMatcher({
      username: 'Justin',
      identityIds: ['identity-justin', 'identity-jk'],
      identities: ['Justin', 'JK'],
    });

    expect(matcher.findIndex([{ name: 'Cindy' }, { identityId: 'identity-jk' }])).toBe(1);
    expect(matcher.findIndex([{ name: 'Cindy' }, { name: 'jk' }])).toBe(1);
  });

  it('matches Mongo ObjectId-like identity values', () => {
    const objectId = { toString: () => 'identity-justin' };
    const matcher = createPlayerMatcher({ identityIds: [objectId] });

    expect(matcher.findIndex([{ identityId: 'identity-justin' }])).toBe(0);
  });

  it('reports when a user carries no usable identifiers at all', () => {
    expect(createPlayerMatcher(null).hasIdentifiers).toBe(false);
    expect(createPlayerMatcher({}).hasIdentifiers).toBe(false);
    expect(createPlayerMatcher({}).findIndex([{ name: 'Cindy' }])).toBe(-1);
  });
});

describe('getGamePlayers', () => {
  it('reads table game players out of gameData', () => {
    expect(getGamePlayers(farAwayGame())).toHaveLength(2);
  });

  it('ignores the plain name list local table game summaries carry', () => {
    const game = { players: ['Cindy', 'Justin'], gameState: { players: [{ name: 'Justin' }] } };
    expect(getGamePlayers(game)).toEqual([{ name: 'Justin' }]);
  });

  it('reads legacy wizard players out of gameState', () => {
    const game = { gameState: { players: [{ id: 'p1', name: 'Justin' }] } };
    expect(getGamePlayers(game)).toHaveLength(1);
  });
});

describe('didPlayerWin', () => {
  it('does not credit a positional winner id to the wrong player', () => {
    const game = farAwayGame();
    const players = getGamePlayers(game);

    expect(didPlayerWin(game, players, 0)).toBe(true); // Cindy won
    expect(didPlayerWin(game, players, 1)).toBe(false); // Justin did not
  });

  it('resolves winner ids in the players own id space, not by position', () => {
    // winner_ids reference player ids, and those ids are not in list order
    const game = {
      gameType: 'wizard',
      gameData: {
        players: [
          { id: 'player_1', name: 'Cindy' },
          { id: 'player_0', name: 'Justin' },
        ],
        winner_ids: ['player_1'],
      },
    };
    const players = getGamePlayers(game);

    expect(didPlayerWin(game, players, 0)).toBe(true); // id player_1 => Cindy
    expect(didPlayerWin(game, players, 1)).toBe(false);
  });

  it('uses identity based winners when they are present', () => {
    const game = farAwayGame({
      winner_ids: ['player_0'],
      gameData: {
        players: [
          { name: 'Cindy', identityId: 'identity-cindy', points: [10] },
          { name: 'Justin', identityId: 'identity-justin', points: [40] },
        ],
        winner_identityIds: ['identity-justin'],
        winner_ids: ['player_0'],
      },
    });
    const players = getGamePlayers(game);

    expect(didPlayerWin(game, players, 1)).toBe(true);
    expect(didPlayerWin(game, players, 0)).toBe(false);
  });

  it('falls back to the winner name for legacy payloads', () => {
    const game = {
      gameType: 'table',
      gameData: {
        players: [{ name: 'Cindy' }, { name: 'Justin' }],
        winner_name: 'Justin',
      },
    };
    const players = getGamePlayers(game);

    expect(didPlayerWin(game, players, 1)).toBe(true);
    expect(didPlayerWin(game, players, 0)).toBe(false);
  });

  it('falls back to the scores, honouring lowIsBetter', () => {
    const game = {
      gameType: 'table',
      lowIsBetter: true,
      gameData: {
        players: [
          { name: 'Cindy', points: [40, 60] },
          { name: 'Justin', points: [10, 20] },
        ],
      },
    };
    const players = getGamePlayers(game);

    expect(didPlayerWin(game, players, 1)).toBe(true);
    expect(didPlayerWin(game, players, 0)).toBe(false);
  });

  it('returns null when the game carries no result data at all', () => {
    const game = { gameType: 'table', gameData: { players: [{ name: 'Cindy' }, { name: 'Justin' }] } };
    expect(didPlayerWin(game, getGamePlayers(game), 0)).toBeNull();
  });
});

describe('getPlayerScore', () => {
  it('sums a table game points array', () => {
    const game = farAwayGame();
    expect(getPlayerScore(game, getGamePlayers(game), 1)).toBe(30);
  });

  it('reads wizard scores from final_scores by player id', () => {
    const game = {
      gameType: 'wizard',
      final_scores: { p1: 210, p2: 180 },
      gameData: { players: [{ id: 'p1', name: 'Justin' }, { id: 'p2', name: 'Cindy' }] },
    };
    expect(getPlayerScore(game, getGamePlayers(game), 0)).toBe(210);
  });
});

describe('resolveUserGameResult', () => {
  it('does not hand the first player\'s win to a user who only has an account id', () => {
    // Regression: Justin is player 1, Cindy (player 0) won. The old matching
    // compared String(player.userId) with String(user._id) - both undefined -
    // and so reported Cindy's win as Justin's.
    const game = farAwayGame();
    const matcher = createPlayerMatcher({ id: 'user-1', username: 'Justin' });

    expect(resolveUserGameResult(game, matcher)).toMatchObject({ playerIndex: 1, won: false });
  });

  it('prefers the result the API already resolved', () => {
    const game = farAwayGame({ userPlayerIndex: 1, userWon: false });
    const matcher = createPlayerMatcher({ username: 'Nobody In This Game' });

    expect(resolveUserGameResult(game, matcher)).toMatchObject({ playerIndex: 1, won: false });
  });

  it('ignores an out of range userPlayerIndex', () => {
    const game = farAwayGame({ userPlayerIndex: 7, userWon: true });
    const matcher = createPlayerMatcher({ identityIds: ['identity-justin'] });

    expect(resolveUserGameResult(game, matcher)).toMatchObject({ playerIndex: 1, won: false });
  });

  it('reports no participation when the user is not in the game', () => {
    const game = farAwayGame();
    const matcher = createPlayerMatcher({ username: 'Someone Else' });

    expect(resolveUserGameResult(game, matcher)).toMatchObject({ playerIndex: -1, won: null });
  });
});
