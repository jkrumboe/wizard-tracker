// Which saved games belong to a game template (for the per-game page).

const WIZARD_TEMPLATE_NAME = 'wizard';

const normalize = (name) => (name || '').trim().toLowerCase();

/**
 * Template name recorded on a Call & Made game, if any (games started before
 * templates were recorded have none and count as Wizard).
 * @param {Object} game
 * @returns {string|null}
 */
const getCallAndMadeTemplateName = (game) =>
  game.templateName
  || game._internalState?.templateConfig?.templateName
  || game.gameState?.templateConfig?.templateName
  || game.templateConfig?.templateName
  || null;

/**
 * Whether a game (history entry or resumable entry) was played with a template.
 * Table and scoreboard games store the template name as their name; Call & Made
 * games are typed "wizard" and carry the template name in their config.
 * @param {Object} game - Game with `gameType` or `type` of wizard/table/scoreboard
 * @param {Object} template
 * @returns {boolean}
 */
export function gameBelongsToTemplate(game, template) {
  if (!game || !template?.name) return false;
  const type = game.gameType || game.type;
  const templateName = normalize(template.name);

  if (type === 'wizard' || (!type && template.gameCategory === 'callAndMade')) {
    if (template.gameCategory !== 'callAndMade') return false;
    const recorded = getCallAndMadeTemplateName(game);
    return recorded ? normalize(recorded) === templateName : templateName === WIZARD_TEMPLATE_NAME;
  }

  if (template.gameCategory === 'callAndMade') return false;
  return normalize(game.name || game.gameTypeName) === templateName;
}

/**
 * Name of the template a game was played with: table and scoreboard games are
 * named after it, Call & Made games record it (older ones are Wizard).
 * @param {Object} game - Game with `gameType` or `type`
 * @returns {string|null}
 */
export function getGameTemplateName(game) {
  if (!game) return null;
  const type = game.gameType || game.type;
  if (type === 'table' || type === 'scoreboard') return game.name || game.gameTypeName || null;
  return getCallAndMadeTemplateName(game) || 'Wizard';
}
