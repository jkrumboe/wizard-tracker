import { ACHIEVEMENTS, evaluateAchievements, formatAchievementProgress, getAchievementGateKey } from '../achievements';

const baseStats = {
  totalGames: 0,
  wins: 0,
  winRateValue: 0,
  longestWinStreak: 0,
  correctBidRounds: 0,
  totalBidRounds: 0,
  bidAccuracyValue: 0,
  bestPerfectRoundsInGame: 0,
  perfectGames: 0,
  dominantWins: 0,
  closeWins: 0,
  comebackWins: 0,
  opponentCount: 0,
  totalRounds: 0
};

const byId = (list, id) => list.find(a => a.id === id);

describe('achievements', () => {

  it('has a unique id for every definition', () => {
    const ids = ACHIEVEMENTS.map(a => a.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('returns every achievement, locked, for a brand new player', () => {
    const result = evaluateAchievements(baseStats);
    expect(result).toHaveLength(ACHIEVEMENTS.length);
    expect(result.every(a => !a.unlocked)).toBe(true);
    expect(result.every(a => a.progress === 0)).toBe(true);
  });

  it('unlocks milestones once the target is reached', () => {
    const result = evaluateAchievements({ ...baseStats, totalGames: 10, wins: 10 });
    expect(byId(result, 'regularPlayer').unlocked).toBe(true);
    expect(byId(result, 'champion').unlocked).toBe(true);
    expect(byId(result, 'dedicated').unlocked).toBe(false);
  });

  it('reports partial progress on locked achievements', () => {
    const result = evaluateAchievements({ ...baseStats, totalGames: 5 });
    const dedicated = byId(result, 'dedicated');
    expect(dedicated.unlocked).toBe(false);
    expect(dedicated.progress).toBeCloseTo(0.2);
    expect(formatAchievementProgress(dedicated)).toBe('5 / 25');
  });

  it('gates win rate achievements behind a minimum number of games', () => {
    const lucky = evaluateAchievements({ ...baseStats, totalGames: 3, wins: 3, winRateValue: 100 });
    expect(byId(lucky, 'elite').unlocked).toBe(false);

    const proven = evaluateAchievements({ ...baseStats, totalGames: 10, wins: 8, winRateValue: 80 });
    expect(byId(proven, 'elite').unlocked).toBe(true);
    expect(byId(proven, 'untouchable').unlocked).toBe(false); // needs 20 games
  });

  it('gates bid accuracy behind a minimum number of rounds', () => {
    const few = evaluateAchievements({ ...baseStats, bidAccuracyValue: 100, totalBidRounds: 10 });
    expect(byId(few, 'sharpshooter').unlocked).toBe(false);

    const many = evaluateAchievements({ ...baseStats, bidAccuracyValue: 60, totalBidRounds: 50 });
    expect(byId(many, 'sharpshooter').unlocked).toBe(true);
  });

  it('reports the unmet gate rather than a full bar', () => {
    // 100% win rate over 4 games: the win rate target is met, the sample size is not
    const result = evaluateAchievements({ ...baseStats, totalGames: 4, wins: 4, winRateValue: 100 });
    const elite = byId(result, 'elite');

    expect(elite.unlocked).toBe(false);
    expect(elite.eligible).toBe(false);
    expect(elite.progress).toBeCloseTo(0.4);
    expect(formatAchievementProgress(elite)).toBe('4 / 10');
    expect(getAchievementGateKey(elite)).toBe('achievements.gate_games');
  });

  it('switches to the headline value once the gate is met', () => {
    const result = evaluateAchievements({ ...baseStats, totalGames: 20, wins: 9, winRateValue: 45 });
    const elite = byId(result, 'elite');

    expect(elite.eligible).toBe(true);
    expect(elite.unlocked).toBe(false);
    expect(elite.progress).toBeCloseTo(0.75);
    expect(formatAchievementProgress(elite)).toBe('45% / 60%');
    expect(getAchievementGateKey(elite)).toBeNull();
  });

  it('has no gate label for ungated achievements', () => {
    const result = evaluateAchievements({ ...baseStats, totalGames: 3 });
    expect(getAchievementGateKey(byId(result, 'veteran'))).toBeNull();
  });

  it('hides bid based achievements for game types without bidding', () => {
    const result = evaluateAchievements(baseStats, { includeBidAchievements: false });
    expect(byId(result, 'perfectPredictor')).toBeUndefined();
    expect(byId(result, 'sharpshooter')).toBeUndefined();
    expect(byId(result, 'firstGame')).toBeDefined();
  });

  it('sorts unlocked first, then by how close the rest are', () => {
    const result = evaluateAchievements({ ...baseStats, totalGames: 5, wins: 1 });
    const unlockedCount = result.filter(a => a.unlocked).length;
    const locked = result.slice(unlockedCount);

    expect(result.slice(0, unlockedCount).every(a => a.unlocked)).toBe(true);
    locked.forEach((a, i) => {
      if (i > 0) expect(locked[i - 1].progress).toBeGreaterThanOrEqual(a.progress);
    });
  });

  it('caps progress and its label at the target', () => {
    const result = evaluateAchievements({ ...baseStats, totalGames: 400 });
    const firstGame = byId(result, 'firstGame');
    expect(firstGame.progress).toBe(1);
    expect(formatAchievementProgress({ ...firstGame, unit: 'count' })).toBe('1 / 1');
  });

  it('formats percentage progress with the percent sign', () => {
    const result = evaluateAchievements({ ...baseStats, totalGames: 10, winRateValue: 42.4 });
    expect(formatAchievementProgress(byId(result, 'elite'))).toBe('42% / 60%');
  });

  it('survives missing or malformed stat values', () => {
    const result = evaluateAchievements({});
    expect(result.every(a => a.progress === 0 && !a.unlocked)).toBe(true);
    expect(evaluateAchievements(null)).toEqual([]);
  });

});
