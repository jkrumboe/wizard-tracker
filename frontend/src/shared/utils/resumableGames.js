/**
 * Resumable games helper.
 *
 * Call & Made games, table games and scoreboard games each live in their own
 * local store, so anything that wants to offer "continue where you left off"
 * (the home screen) needs one merged, newest-first view over all of them.
 */

import { LocalGameStorage } from '../api/localGameStorage.js';
import { LocalTableGameStorage } from '../api/localTableGameStorage.js';
import { LocalScoreboardGameStorage } from '../api/localScoreboardGameStorage.js';

// Placeholder name a Call & Made game is stored under while it is on screen.
// Those entries are deleted by the startup cleanup, so they are not offered.
const AUTO_SAVE_NAME = /auto-save/i;

// Call & Made games without a template are plain Wizard games
export const WIZARD_TYPE_NAME = 'Wizard';

// Names the pause flow stores by default ("Paused Game - Round 2/20" and its
// German form). They say nothing about the game, so they are never shown.
const GENERIC_PAUSED_NAME = /^(paused game|pausiertes spiel)\b/i;

/**
 * Label for a resumable game: the game type, the round progress when known,
 * and the game's own name when the player gave it one.
 * @param {Object} game - Entry from getResumableGames
 * @param {Function} t - i18next translate function
 * @returns {string} - Display label
 */
export function getResumableGameLabel(game, t) {
  const typeName = game.gameTypeName || game.name || t('home.continueGame');
  const customName = game.name
    && !GENERIC_PAUSED_NAME.test(game.name)
    && game.name !== typeName
    ? game.name
    : null;
  const title = customName ? `${typeName} · ${customName}` : typeName;

  if (game.currentRound && game.maxRounds) {
    return t('home.resumeGameLabel', {
      game: title,
      current: game.currentRound,
      max: game.maxRounds,
    });
  }

  return title;
}

const isScoreboardGame = (game, gameData) =>
  gameData?.scoreEntryMode === 'twoSideGesture'
  || gameData?.gameType === 'scoreboard'
  || game.id?.startsWith?.('scoreboard_game')
  || game.gameTypeName === 'Volleyball'
  || game.name === 'Volleyball';

/**
 * Paused / in-progress Call & Made games from local storage.
 * @returns {Array<Object>} - Resumable game entries
 */
function getResumableWizardGames() {
  try {
    return Object.entries(LocalGameStorage.getAllSavedGames())
      .filter(([, game]) => game
        && !game.gameFinished
        && !game.gameState?.gameFinished
        && !AUTO_SAVE_NAME.test(game.name || ''))
      .map(([id, game]) => {
        const internalState = game._internalState || game.gameState || {};
        const players = game.players || internalState.players || [];

        return {
          id,
          type: 'wizard',
          name: game.name || null,
          gameTypeName: internalState.templateConfig?.templateName || WIZARD_TYPE_NAME,
          players: players.map(player => player?.name || player).filter(Boolean),
          templateName: internalState.templateConfig?.templateName || null,
          currentRound: internalState.currentRound || null,
          maxRounds: internalState.maxRounds || game.total_rounds || null,
          lastPlayed: game.lastPlayed || game.savedAt || game.created_at || null,
          route: '/game/current',
        };
      });
  } catch (error) {
    console.error('Error reading resumable Call & Made games:', error);
    return [];
  }
}

/**
 * Paused / in-progress games from one of the table-style stores.
 * @param {Object} storage - LocalTableGameStorage or LocalScoreboardGameStorage
 * @param {string} defaultType - Type to use when the game is not a scoreboard game
 * @returns {Array<Object>} - Resumable game entries
 */
function getResumableTableStyleGames(storage, defaultType) {
  try {
    return storage.getSavedTableGamesList()
      .filter(game => !game.gameFinished)
      .map(game => {
        const gameData = game.gameData?.gameData || game.gameData;
        return { game, gameData };
      })
      .map(({ game, gameData }) => {
        const isScoreboard = isScoreboardGame(game, gameData);

        return {
          id: game.id,
          type: isScoreboard ? 'scoreboard' : defaultType,
          name: game.name || game.gameTypeName || null,
          gameTypeName: game.gameTypeName || gameData?.gameName || null,
          players: game.players || [],
          currentRound: null,
          maxRounds: null,
          lastPlayed: game.lastPlayed || game.savedAt || null,
          route: isScoreboard ? `/scoreboard/${game.id}` : `/table/${game.id}`,
        };
      });
  } catch (error) {
    console.error('Error reading resumable table games:', error);
    return [];
  }
}

/**
 * All locally stored games that can still be continued.
 *
 * Ordered by lastPlayed, which every game screen stamps when it is left, so the
 * first entry is the game the player was in most recently.
 * @param {Object} options - Options
 * @param {number} options.limit - Maximum number of entries to return
 * @returns {Array<Object>} - Entries of { id, type, name, gameTypeName, players, currentRound, maxRounds, lastPlayed, route }
 */
export function getResumableGames({ limit = 4 } = {}) {
  const entries = [
    ...getResumableWizardGames(),
    ...getResumableTableStyleGames(LocalTableGameStorage, 'table'),
    ...getResumableTableStyleGames(LocalScoreboardGameStorage, 'scoreboard'),
  ];

  const uniqueEntries = [];
  const seenIds = new Set();

  entries
    .sort((a, b) => new Date(b.lastPlayed || 0) - new Date(a.lastPlayed || 0))
    .forEach(entry => {
      if (!entry.id || seenIds.has(entry.id)) return;
      seenIds.add(entry.id);
      uniqueEntries.push(entry);
    });

  return typeof limit === 'number' ? uniqueEntries.slice(0, limit) : uniqueEntries;
}
