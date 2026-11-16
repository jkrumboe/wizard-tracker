import { LocalTableGameTemplate } from '@/shared/api/localTableGameTemplate';
import { getTemplateGameInfo } from '@/shared/utils/gameInfoStore';

// Template fields an admin needs to publish the game for everyone
const SNAPSHOT_FIELDS = [
  'targetNumber',
  'lowIsBetter',
  'gameCategory',
  'scoringFormula',
  'roundPattern',
  'maxRounds',
  'minPlayers',
  'maxPlayers',
  'hasDealerRotation',
  'hasForbiddenCall',
  'description',
  'descriptionMarkdown',
];

const normalize = (name) => String(name || '').trim().toLowerCase();

/**
 * Copy of the local template a game was played with, or null when this device
 * has none by that name. Uploaded with the game so an admin can publish the
 * game for everyone without the player having to sync or suggest the template.
 * @param {string} gameName
 * @returns {Object|null}
 */
export const buildTemplateSnapshot = (gameName) => {
  const wanted = normalize(gameName);
  if (!wanted) return null;
  const template = LocalTableGameTemplate.getTemplatesList()
    .find((candidate) => normalize(candidate.name) === wanted);
  if (!template) return null;

  const snapshot = { name: template.name };
  SNAPSHOT_FIELDS.forEach((field) => {
    if (template[field] !== undefined && template[field] !== null) snapshot[field] = template[field];
  });
  const gameInfo = getTemplateGameInfo(template);
  if (gameInfo) snapshot.gameInfo = gameInfo;
  return snapshot;
};

/**
 * The game data with a template snapshot attached, when the game doesn't carry one yet.
 * @param {Object} gameData
 * @returns {Object}
 */
export const withTemplateSnapshot = (gameData) => {
  if (!gameData || typeof gameData !== 'object' || gameData.templateSnapshot) return gameData;
  try {
    const snapshot = buildTemplateSnapshot(gameData.gameName || gameData.name);
    return snapshot ? { ...gameData, templateSnapshot: snapshot } : gameData;
  } catch (error) {
    // A missing snapshot only means less to publish later; never block the upload
    console.warn('Could not attach template snapshot:', error);
    return gameData;
  }
};
