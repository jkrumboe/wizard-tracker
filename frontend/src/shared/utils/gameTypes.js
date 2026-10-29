/**
 * Game type keys and grouping for the stats screens.
 *
 * Table and scoreboard games only carry the name they were played under, so
 * "Flip 7", "Flip7" and "flip-7" are the same game typed three ways. The key
 * ignores case, spacing, punctuation and accents so they group - and look up
 * ELO - as one game. Must match `normalizeGameType` in backend/utils/eloService.js.
 */

export const WIZARD_GAME_TYPE = 'wizard';

/**
 * Canonical key for a game type name ("Flip 7" -> "flip7", "Wizard" -> "wizard").
 * @param {string} name
 * @returns {string}
 */
export const getGameTypeKey = (name) => {
  if (!name) return 'unknown';
  const key = String(name)
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '');
  return key || 'unknown';
};

export const isTableLikeGame = (game) =>
  game?.gameType === 'table' || game?.gameType === 'scoreboard';

/** Name a table/scoreboard game was played under. */
const getTableGameName = (game) => game.gameTypeName || game.name || null;

/** Key of the game type a single game belongs to. */
export const getGameTypeKeyOf = (game) =>
  isTableLikeGame(game) ? getGameTypeKey(getTableGameName(game)) : WIZARD_GAME_TYPE;

/**
 * Game types present in a list of games, for a stats type selector.
 * Wizard first, then table games in order of how often they were played; each
 * labelled with the spelling used most.
 *
 * @param {Array} games
 * @returns {Array<{ value: string, label: string, count: number }>}
 */
export const getStatsGameTypes = (games) => {
  const list = games || [];
  const types = [];

  const wizardCount = list.filter((game) => !isTableLikeGame(game)).length;
  if (wizardCount > 0) {
    types.push({ value: WIZARD_GAME_TYPE, label: 'Wizard', count: wizardCount });
  }

  const tableTypes = new Map();
  list.filter(isTableLikeGame).forEach((game) => {
    const name = getTableGameName(game);
    if (!name) return;
    const key = getGameTypeKey(name);
    const entry = tableTypes.get(key) || { value: key, count: 0, spellings: new Map() };
    entry.count++;
    entry.spellings.set(name, (entry.spellings.get(name) || 0) + 1);
    tableTypes.set(key, entry);
  });

  [...tableTypes.values()]
    .sort((a, b) => b.count - a.count)
    .forEach(({ value, count, spellings }) => {
      const [label] = [...spellings.entries()].sort((a, b) => b[1] - a[1])[0];
      types.push({ value, label, count });
    });

  return types;
};

/**
 * Games of one game type (as produced by getStatsGameTypes).
 * @param {Array} games
 * @param {string} typeKey
 */
export const filterGamesByType = (games, typeKey) =>
  (games || []).filter((game) => getGameTypeKeyOf(game) === typeKey);
