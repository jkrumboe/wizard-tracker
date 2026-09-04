import { useMemo } from 'react';
import { createPlayerMatcher, resolveUserGameResult } from '@/shared/utils/playerMatching';

/**
 * Resolve the label a game is grouped under on the overview.
 */
const getGameTypeName = (game) => {
  if (game.gameType === 'table' || game.gameType === 'scoreboard') {
    return game.gameTypeName || game.name || 'Table Game';
  }

  const mode =
    game.game_mode || game.gameData?.game_mode || game.gameState?.game_mode || 'Wizard';
  // Locally played games are stored as "Local" but belong to the Wizard bucket.
  return mode === 'Local' ? 'Wizard' : mode;
};

const getGameDate = (game) =>
  new Date(game.created_at || game.savedAt || game.lastPlayed || 0);

const isCountable = (game) => !game.isPaused && game.gameFinished !== false;

const MAX_RECENT_RESULTS = 10;

/**
 * Unified game stats calculation
 * Works with both localStorage games and API games
 *
 * Which player in a game is "the user" is resolved by
 * `@/shared/utils/playerMatching`, which prefers the API's own identity-based
 * answer and never falls back to comparing two undefined ids. Games the user
 * did not play in, and games with no usable result data, are left out entirely
 * rather than being counted as losses.
 *
 * @param {Array} games - Array of game objects (wizard + table games)
 * @param {Object} user - Current user object (should include `identities`/`identityIds` from API)
 * @returns {Object} - { gameTypes: [], recentResults: [] }
 */
export const calculateGameStats = (games, user) => {
  const allGamesList = games || [];

  if (!user || allGamesList.length === 0) {
    return { gameTypes: [], recentResults: [] };
  }

  const matcher = createPlayerMatcher(user);
  if (!matcher.hasIdentifiers) {
    return { gameTypes: [], recentResults: [] };
  }

  // Newest first - recent results read left to right from the latest game.
  const sortedGames = allGamesList
    .filter(isCountable)
    .slice()
    .sort((a, b) => getGameDate(b) - getGameDate(a));

  // Resolve every game once so the per-game-type cards and the overall
  // recent-results strip can never disagree with each other.
  const evaluatedGames = sortedGames
    .map((game) => ({ game, ...resolveUserGameResult(game, matcher) }))
    .filter((entry) => entry.playerIndex !== -1 && typeof entry.won === 'boolean');

  const gameTypeStats = {};

  evaluatedGames.forEach(({ game, won }) => {
    const name = getGameTypeName(game);

    if (!gameTypeStats[name]) {
      gameTypeStats[name] = { name, matches: 0, wins: 0, recentResults: [] };
    }

    const stats = gameTypeStats[name];
    stats.matches++;
    if (won) stats.wins++;
    if (stats.recentResults.length < MAX_RECENT_RESULTS) {
      stats.recentResults.push(won ? 'W' : 'L');
    }
  });

  const gameTypes = Object.values(gameTypeStats).filter((gt) => gt.matches > 0);

  const recentResults = evaluatedGames
    .slice(0, MAX_RECENT_RESULTS)
    .map(({ won }) => (won ? 'W' : 'L'));

  return { gameTypes, recentResults };
};

/** React binding for {@link calculateGameStats}. */
export const useGameStats = (games, user) =>
  useMemo(() => calculateGameStats(games, user), [games, user]);
