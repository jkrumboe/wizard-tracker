/**
 * Scoring formula utilities for Call & Made games.
 *
 * Formula shape: { baseCorrect, bonusPerTrick, penaltyPerDiff }
 * - If call === made: score = baseCorrect + (made * bonusPerTrick)
 * - If call !== made: score = penaltyPerDiff * |call - made|
 */

export const WIZARD_FORMULA = {
  baseCorrect: 20,
  bonusPerTrick: 10,
  penaltyPerDiff: -10,
};

export function calculateScore(formula, call, made) {
  if (call === null || made === null) return null;
  const f = formula || WIZARD_FORMULA;
  if (call === made) {
    return f.baseCorrect + (made * f.bonusPerTrick);
  }
  return f.penaltyPerDiff * Math.abs(call - made);
}

/**
 * Round pattern generators for Call & Made games.
 * Each returns an array of card counts per round.
 */
export const ROUND_PATTERNS = {
  pyramid: {
    generate: (maxRounds) => {
      const half = Math.ceil(maxRounds / 2);
      return Array.from({ length: maxRounds }, (_, i) => {
        const round = i + 1;
        return round <= half ? round : maxRounds + 1 - round;
      });
    },
  },
  ascending: {
    generate: (maxRounds) => Array.from({ length: maxRounds }, (_, i) => i + 1),
  },
  fixed: {
    generate: (maxRounds, cardsPerRound = 5) =>
      Array.from({ length: maxRounds }, () => cardsPerRound),
  },
};

export function generateRoundPattern(patternKey, maxRounds, options = {}) {
  const pattern = ROUND_PATTERNS[patternKey] || ROUND_PATTERNS.pyramid;
  return pattern.generate(maxRounds, options.cardsPerRound);
}
