import { describe, it, expect } from 'vitest';
import { calculatePerformanceStats } from '../performanceStats';

const user = { username: 'Justin', identityIds: ['identity-justin'], identities: ['Justin'] };

let dayCounter = 0;
// A table game whose players finish on the given totals (one round each)
const tableGame = (totals, { lowIsBetter = false, names } = {}) => {
  dayCounter++;
  const playerNames = names || ['Justin', 'Cindy', 'Bert'].slice(0, totals.length);
  const best = lowIsBetter ? Math.min(...totals) : Math.max(...totals);
  return {
    id: `game-${dayCounter}`,
    gameType: 'table',
    gameTypeName: 'Far Away',
    created_at: new Date(Date.UTC(2026, 0, dayCounter)).toISOString(),
    gameFinished: true,
    lowIsBetter,
    winner_ids: totals.map((total, i) => (total === best ? `player_${i}` : null)).filter(Boolean),
    gameData: {
      players: playerNames.map((name, i) => ({
        name,
        identityId: `identity-${name.toLowerCase()}`,
        points: [totals[i]],
      })),
    },
  };
};

describe('calculatePerformanceStats', () => {
  it('returns null when there is nothing to evaluate', () => {
    expect(calculatePerformanceStats([], user)).toBeNull();
    expect(calculatePerformanceStats(null, user)).toBeNull();
  });

  it('leaves out games the user is not in instead of counting them as losses', () => {
    const games = [
      tableGame([50, 40]),
      tableGame([10, 20], { names: ['Cindy', 'Bert'] }), // user not in this game
    ];

    const stats = calculatePerformanceStats(games, user, { isWizardGame: false });

    expect(stats.totalGames).toBe(1);
    expect(stats.wins).toBe(1);
    expect(stats.losses).toBe(0);
    expect(stats.averageScore).toBe('50.0');
  });

  it('returns null when the user is in none of the games', () => {
    const games = [tableGame([10, 20], { names: ['Cindy', 'Bert'] })];
    expect(calculatePerformanceStats(games, user)).toBeNull();
  });

  it('skips paused and unfinished games', () => {
    const games = [
      tableGame([50, 40]),
      { ...tableGame([10, 40]), isPaused: true },
      { ...tableGame([10, 40]), gameFinished: false },
    ];

    expect(calculatePerformanceStats(games, user).totalGames).toBe(1);
  });

  it('reports the recent trend from the last ten games', () => {
    const losses = Array.from({ length: 5 }, () => tableGame([10, 40]));
    const wins = Array.from({ length: 5 }, () => tableGame([50, 40]));

    expect(calculatePerformanceStats([...losses, ...wins], user).recentTrend).toBe('improving');
    expect(calculatePerformanceStats([...wins.map(g => ({ ...g, created_at: '2025-01-01' })), ...losses], user).recentTrend)
      .toBe('declining');
  });

  it('marks exactly one best and one worst game when scores tie', () => {
    const games = [tableGame([50, 40]), tableGame([50, 40]), tableGame([10, 40]), tableGame([10, 40])];

    const stats = calculatePerformanceStats(games, user);

    expect(stats.bestGame).toMatchObject({ game: 1, score: 50 });
    expect(stats.worstGame).toMatchObject({ game: 3, score: 10 });
  });

  it('treats the lowest score as best in low-is-better games', () => {
    const games = [tableGame([5, 9], { lowIsBetter: true }), tableGame([12, 3], { lowIsBetter: true })];

    const stats = calculatePerformanceStats(games, user);

    expect(stats.bestGame.score).toBe(5);
    expect(stats.worstGame.score).toBe(12);
  });

  it('tracks the current streak from the most recent games', () => {
    const games = [tableGame([50, 40]), tableGame([10, 40]), tableGame([10, 40])];

    expect(calculatePerformanceStats(games, user).currentStreak).toEqual({ type: 'loss', count: 2 });
  });

  describe('win margins outside Wizard', () => {
    it('scales close and dominant wins to the game scores', () => {
      // 1000 vs 980 is 2% - close, even though it is 20 points
      const close = calculatePerformanceStats([tableGame([1000, 980])], user);
      expect(close.closeWins).toBe(1);
      expect(close.dominantWins).toBe(0);

      // 30 vs 20 is a third of the score - dominant, even though it is 10 points
      const dominant = calculatePerformanceStats([tableGame([30, 20])], user);
      expect(dominant.dominantWins).toBe(1);
      expect(dominant.closeWins).toBe(0);
    });

    it('measures low-is-better margins against the runner-up', () => {
      const stats = calculatePerformanceStats([tableGame([20, 40, 21], { lowIsBetter: true })], user);
      expect(stats.wins).toBe(1);
      expect(stats.closeWins).toBe(1);
      expect(stats.dominantWins).toBe(0);
    });
  });

  it('breaks the win rate down by table size against the 1-in-N share', () => {
    const games = [
      tableGame([50, 40]),
      tableGame([10, 40]),
      tableGame([50, 40, 10]),
    ];

    const { playerCountData } = calculatePerformanceStats(games, user);

    expect(playerCountData).toEqual([
      expect.objectContaining({ count: 2, games: 2, winRate: '50.0', expectedWinRate: 50 }),
      expect.objectContaining({ count: 3, games: 1, winRate: '100.0', expectedWinRate: 33 }),
    ]);
  });

  describe('rivals', () => {
    it('records whether the user finished ahead of each opponent, not just whether they won', () => {
      const games = [
        tableGame([30, 40, 10]), // lost the game, but finished ahead of Bert
        tableGame([30, 40, 10]),
        tableGame([50, 40, 10]),
      ];

      const { topOpponents } = calculatePerformanceStats(games, user);
      const cindy = topOpponents.find(o => o.name === 'Cindy');
      const bert = topOpponents.find(o => o.name === 'Bert');

      expect(cindy).toMatchObject({ games: 3, ahead: 1, behind: 2, tied: 0, aheadRate: 33 });
      expect(bert).toMatchObject({ games: 3, ahead: 3, behind: 0, aheadRate: 100 });
    });

    it('counts ties separately', () => {
      const { topOpponents } = calculatePerformanceStats([tableGame([40, 40])], user);
      expect(topOpponents[0]).toMatchObject({ ahead: 0, behind: 0, tied: 1 });
    });

    it('orders opponents by games played together', () => {
      const games = [
        tableGame([50, 40, 10]),
        tableGame([50, 40], { names: ['Justin', 'Bert'] }),
      ];

      const { topOpponents } = calculatePerformanceStats(games, user);
      expect(topOpponents.map(o => o.name)).toEqual(['Bert', 'Cindy']);
    });
  });
  it('reads the round count from profile API games (gameData.total_rounds)', () => {
    const wizardGame = {
      id: 'wizard-1',
      gameType: 'wizard',
      created_at: new Date(Date.UTC(2026, 5, 1)).toISOString(),
      userPlayerIndex: 0,
      userWon: true,
      gameData: {
        players: [
          { id: 'p1', name: 'Justin', identityId: 'identity-justin' },
          { id: 'p2', name: 'Cindy', identityId: 'identity-cindy' },
        ],
        final_scores: { p1: 120, p2: 80 },
        total_rounds: 15,
        winner_ids: ['p1'],
      },
    };

    const stats = calculatePerformanceStats([wizardGame], user);

    expect(stats.totalRounds).toBe(15);
    expect(stats.averageRoundsPerGame).toBe('15.0');
  });
});
