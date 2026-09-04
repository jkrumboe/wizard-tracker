import { describe, it, expect } from 'vitest';

import { calculateGameStats } from '../useGameStats';

// Three "Far Away" table games as the profile API returns them. Justin is the
// second player in every one and never wins; Cindy (first player) wins one.
const farAway = (index, winnerIdx, date) => ({
  id: `far-away-${index}`,
  gameType: 'table',
  gameTypeName: 'Far Away',
  created_at: date,
  gameFinished: true,
  lowIsBetter: false,
  winner_ids: [`player_${winnerIdx}`],
  gameData: {
    players: [
      { name: 'Cindy', identityId: 'identity-cindy', points: winnerIdx === 0 ? [90] : [10] },
      { name: 'Justin', identityId: 'identity-justin', points: winnerIdx === 1 ? [90] : [20] },
    ],
    winner_ids: [`player_${winnerIdx}`],
  },
});

const games = [
  farAway(1, 0, '2026-08-01T18:00:00.000Z'),
  farAway(2, 0, '2026-08-02T18:00:00.000Z'),
  farAway(3, 0, '2026-08-03T18:00:00.000Z'),
];

const justin = {
  id: 'user-1',
  username: 'Justin',
  identityIds: ['identity-justin'],
  identities: ['Justin'],
};

describe('calculateGameStats', () => {
  it('does not report a win for a game the user lost', () => {
    const stats = calculateGameStats(games, justin);
    const farAwayStats = stats.gameTypes.find(gt => gt.name === 'Far Away');

    expect(farAwayStats).toMatchObject({ matches: 3, wins: 0 });
    expect(farAwayStats.recentResults).toEqual(['L', 'L', 'L']);
    expect(stats.recentResults).toEqual(['L', 'L', 'L']);
  });

  it('counts the wins that are actually the users', () => {
    const withAWin = [...games, farAway(4, 1, '2026-08-04T18:00:00.000Z')];
    const stats = calculateGameStats(withAWin, justin);
    const farAwayStats = stats.gameTypes.find(gt => gt.name === 'Far Away');

    expect(farAwayStats).toMatchObject({ matches: 4, wins: 1 });
    // Newest first
    expect(farAwayStats.recentResults).toEqual(['W', 'L', 'L', 'L']);
  });

  it('trusts the result the API resolved for the profile', () => {
    const apiGames = games.map(game => ({ ...game, userPlayerIndex: 1, userWon: false }));
    const stats = calculateGameStats(apiGames, justin);

    expect(stats.gameTypes[0]).toMatchObject({ matches: 3, wins: 0 });
  });

  it('leaves out games the user did not play in', () => {
    const stats = calculateGameStats(games, { id: 'user-2', username: 'Bert' });
    expect(stats.gameTypes).toEqual([]);
  });

  it('skips paused and unfinished games', () => {
    const mixed = [
      ...games,
      { ...farAway(5, 1, '2026-08-05T18:00:00.000Z'), isPaused: true },
      { ...farAway(6, 1, '2026-08-06T18:00:00.000Z'), gameFinished: false },
    ];
    const stats = calculateGameStats(mixed, justin);

    expect(stats.gameTypes[0]).toMatchObject({ matches: 3, wins: 0 });
  });

  it('groups wizard games under their game mode', () => {
    const wizardGame = {
      id: 'wizard-1',
      gameType: 'wizard',
      game_mode: 'Local',
      created_at: '2026-08-07T18:00:00.000Z',
      gameFinished: true,
      winner_ids: ['p2'],
      gameData: {
        players: [
          { id: 'p1', name: 'Cindy', identityId: 'identity-cindy' },
          { id: 'p2', name: 'Justin', identityId: 'identity-justin' },
        ],
      },
    };
    const stats = calculateGameStats([...games, wizardGame], justin);
    const names = stats.gameTypes.map(gt => gt.name).sort();

    expect(names).toEqual(['Far Away', 'Wizard']);
    expect(stats.gameTypes.find(gt => gt.name === 'Wizard')).toMatchObject({
      matches: 1,
      wins: 1,
    });
  });

  it('caps recent results at ten entries', () => {
    const many = Array.from({ length: 12 }, (_, i) =>
      farAway(i, 0, `2026-08-${String(i + 1).padStart(2, '0')}T18:00:00.000Z`)
    );
    const stats = calculateGameStats(many, justin);

    expect(stats.gameTypes[0].matches).toBe(12);
    expect(stats.gameTypes[0].recentResults).toHaveLength(10);
    expect(stats.recentResults).toHaveLength(10);
  });
});
