/**
 * Achievement definitions and evaluation.
 *
 * Definitions are data only - each one knows which stat it reads and what the
 * target is. Names and descriptions live in the
 * i18n files under `achievements.<id>` / `achievements.<id>Desc`, so this
 * module stays free of translation and rendering concerns.
 *
 * The stats object is the one produced by PerformanceStatsEnhanced.
 */

/**
 * category: used for grouping/sorting only
 * unit:     'count' renders "3 / 10", 'percent' renders "42% / 60%"
 * bidBased: hidden for game types that have no bidding (table games)
 * value:    reads the current progress value out of the stats object
 * gate:     optional sample-size requirement that must be met first. While it is
 *           unmet it - not the headline value - is what the card reports, so a
 *           player at 100% over 3 games sees "3 / 10 games" rather than a full bar.
 */
export const ACHIEVEMENTS = [
  // Games played
  { id: 'firstGame', category: 'games', target: 1, unit: 'count', value: s => s.totalGames },
  { id: 'gettingStarted', category: 'games', target: 5, unit: 'count', value: s => s.totalGames },
  { id: 'regularPlayer', category: 'games', target: 10, unit: 'count', value: s => s.totalGames },
  { id: 'dedicated', category: 'games', target: 25, unit: 'count', value: s => s.totalGames },
  { id: 'committed', category: 'games', target: 50, unit: 'count', value: s => s.totalGames },
  { id: 'veteran', category: 'games', target: 100, unit: 'count', value: s => s.totalGames },

  // Wins
  { id: 'champion', category: 'wins', target: 10, unit: 'count', value: s => s.wins },
  { id: 'legend', category: 'wins', target: 50, unit: 'count', value: s => s.wins },
  { id: 'immortal', category: 'wins', target: 100, unit: 'count', value: s => s.wins },

  // Streaks
  { id: 'hotStreak', category: 'streaks', target: 3, unit: 'count', value: s => s.longestWinStreak },
  { id: 'onFire', category: 'streaks', target: 5, unit: 'count', value: s => s.longestWinStreak },
  { id: 'unstoppable', category: 'streaks', target: 10, unit: 'count', value: s => s.longestWinStreak },

  // Win rate - gated on a minimum number of games so a single lucky win cannot unlock them
  { id: 'elite', category: 'rate', target: 60, unit: 'percent', value: s => s.winRateValue, gate: { unit: 'games', target: 10, value: s => s.totalGames } },
  { id: 'untouchable', category: 'rate', target: 75, unit: 'percent', value: s => s.winRateValue, gate: { unit: 'games', target: 20, value: s => s.totalGames } },

  // Bidding (wizard only)
  { id: 'perfectPredictor', category: 'bidding', target: 1, unit: 'count', bidBased: true, value: s => s.correctBidRounds },
  { id: 'mindReader', category: 'bidding', target: 3, unit: 'count', bidBased: true, value: s => s.bestPerfectRoundsInGame },
  { id: 'sharpshooter', category: 'bidding', target: 50, unit: 'percent', bidBased: true, value: s => s.bidAccuracyValue, gate: { unit: 'rounds', target: 50, value: s => s.totalBidRounds } },
  { id: 'flawlessGame', category: 'bidding', target: 1, unit: 'count', bidBased: true, value: s => s.perfectGames },

  // Notable wins
  { id: 'dominator', category: 'wins', target: 1, unit: 'count', value: s => s.dominantWins },
  { id: 'nailBiter', category: 'wins', target: 1, unit: 'count', value: s => s.closeWins },
  { id: 'comebackKing', category: 'wins', target: 1, unit: 'count', value: s => s.comebackWins },

  // Variety
  { id: 'socialButterfly', category: 'variety', target: 10, unit: 'count', value: s => s.opponentCount },
  { id: 'marathoner', category: 'variety', target: 500, unit: 'count', value: s => s.totalRounds }
];

/**
 * Evaluate every achievement against a stats object.
 *
 * @param {Object} stats - stats produced by PerformanceStatsEnhanced
 * @param {Object} [options]
 * @param {boolean} [options.includeBidAchievements=true] - false for game types without bidding
 * @returns {Array} definitions enriched with { value, unlocked, progress }, unlocked first
 */
const toNumber = (raw) => (Number.isFinite(raw) ? Math.max(0, raw) : 0);

export const evaluateAchievements = (stats, { includeBidAchievements = true } = {}) => {
  if (!stats) return [];

  return ACHIEVEMENTS
    .filter(definition => includeBidAchievements || !definition.bidBased)
    .map((definition, index) => {
      const value = toNumber(definition.value(stats));
      const gateValue = definition.gate ? toNumber(definition.gate.value(stats)) : 0;
      const eligible = definition.gate ? gateValue >= definition.gate.target : true;
      const unlocked = eligible && value >= definition.target;

      // An unmet gate is the binding constraint, so it drives the bar as well
      const progress = eligible
        ? Math.min(value / definition.target, 1)
        : Math.min(gateValue / definition.gate.target, 1);

      return {
        ...definition,
        index,
        value,
        gateValue,
        eligible,
        unlocked,
        progress
      };
    })
    .sort((a, b) => {
      // Unlocked first, then whatever the player is closest to unlocking
      if (a.unlocked !== b.unlocked) return a.unlocked ? -1 : 1;
      if (!a.unlocked && b.progress !== a.progress) return b.progress - a.progress;
      return a.index - b.index;
    });
};

/**
 * Human readable progress, e.g. "7 / 10" or "42% / 60%".
 *
 * While a gate is unmet it reports the gate instead - the numbers on the card
 * then match the bar, and match what the player actually has to do next.
 */
export const formatAchievementProgress = (achievement) => {
  if (achievement.gate && !achievement.eligible) {
    return `${Math.min(Math.floor(achievement.gateValue), achievement.gate.target)} / ${achievement.gate.target}`;
  }

  const { unit, target } = achievement;
  const value = unit === 'percent'
    ? Math.min(achievement.value, target).toFixed(0)
    : Math.min(Math.floor(achievement.value), target);

  return unit === 'percent' ? `${value}% / ${target}%` : `${value} / ${target}`;
};

/**
 * i18n key describing what a locked card is still waiting for - either the unmet
 * gate ("games played") or nothing, in which case the progress speaks for itself.
 */
export const getAchievementGateKey = (achievement) =>
  achievement.gate && !achievement.eligible ? `achievements.gate_${achievement.gate.unit}` : null;
