// Game editions: versions of one game (e.g. Wizard Classic vs. an anniversary
// edition) that are played and listed under the same game name but differ in
// which special cards are in the deck.
//
// A game's editions come from three places:
//  1. editions the template ships with (built-in Wizard editions),
//  2. other templates named "<game>: <edition>" (the BoardGameGeek naming,
//     e.g. "Wizard: Jubiläumsedition"), which are folded into the base game,
//  3. editions the user added on this device.
// The user can choose the special cards of every edition; those choices and
// custom editions live in localStorage.
import { BUILTIN_SYSTEM_TEMPLATES } from '@/shared/constants/gameTemplates';
import { TRACKED_SPECIAL_CARDS } from '@/shared/constants/specialCards';
import { LocalTableGameTemplate } from '@/shared/api/localTableGameTemplate';
import { generateSecureId } from '@/shared/utils/secureRandom';

const EDITION_PREFS_KEY = 'wizardTracker_editionPrefs';
const EDITION_STORE_KEY = 'wizardTracker_editions';

// Plain game, offered when only folded or custom editions exist
export const STANDARD_EDITION_ID = 'standard';

const normalize = (name) => (name || '').trim().toLowerCase();
const category = (template) => template?.gameCategory || 'table';

const readJson = (key) => {
  try {
    const value = JSON.parse(localStorage.getItem(key) || '{}');
    return value && typeof value === 'object' ? value : {};
  } catch {
    return {};
  }
};

const writeJson = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    // Storage is unavailable (private mode); built-in editions still work
    return false;
  }
};

const notifyChanged = () => {
  globalThis.dispatchEvent(new CustomEvent('templatesChanged'));
};

/**
 * Split a "<game>: <edition>" template name.
 * @param {string} name
 * @returns {{ baseName: string, editionName: string }|null}
 */
export function splitEditionName(name) {
  const index = (name || '').indexOf(':');
  if (index <= 0) return null;
  const baseName = name.slice(0, index).trim();
  const editionName = name.slice(index + 1).trim();
  return baseName && editionName ? { baseName, editionName } : null;
}

/**
 * Fold "<game>: <edition>" templates into the game of the same category they
 * belong to. The folded templates leave the list and are kept on their base
 * game as `editionSources`.
 * @param {Array} templates
 * @returns {Array} Templates with edition templates folded away
 */
export function groupEditionTemplates(templates) {
  const byName = new Map(templates.map((tpl) => [normalize(tpl.name), tpl]));
  const sourcesByBase = new Map();

  for (const template of templates) {
    const split = splitEditionName(template.name);
    const base = split && byName.get(normalize(split.baseName));
    if (!base || base === template || category(base) !== category(template)) continue;
    const sources = sourcesByBase.get(base) || [];
    sources.push(template);
    sourcesByBase.set(base, sources);
  }

  const folded = new Set([...sourcesByBase.values()].flat());
  return templates
    .filter((tpl) => !folded.has(tpl))
    .map((tpl) => (sourcesByBase.has(tpl) ? { ...tpl, editionSources: sourcesByBase.get(tpl) } : tpl));
}

const escapeRegExp = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * The edition part of a scanned box's name: "Wizard: Jubiläumsedition" or
 * "Wizard - Jubiläumsedition" for the game "Wizard" gives "Jubiläumsedition".
 * A name that is just the game's gives ''.
 * @param {string} productName
 * @param {string} gameName
 * @returns {string}
 */
export function editionNameFromProduct(productName, gameName) {
  const name = (productName || '').trim();
  const pattern = new RegExp(`^${escapeRegExp((gameName || '').trim())}(?:[\\s:\\-–—]+|$)`, 'iu');
  return name.replace(pattern, '').trim();
}

const findBuiltin = (name) => BUILTIN_SYSTEM_TEMPLATES.find((tpl) => normalize(tpl.name) === normalize(name)) || null;

// Without a loaded template list, the edition templates saved on this device
const localEditionSources = (baseName) => LocalTableGameTemplate.getTemplatesList()
  .filter((tpl) => normalize(splitEditionName(tpl.name)?.baseName) === normalize(baseName));

const editionIdForSource = (sourceName) => `tpl:${normalize(sourceName)}`;

const readStore = (templateName) => {
  const entry = readJson(EDITION_STORE_KEY)[normalize(templateName)] || {};
  return {
    custom: Array.isArray(entry.custom) ? entry.custom : [],
    cards: entry.cards && typeof entry.cards === 'object' ? entry.cards : {},
  };
};

const updateStore = (templateName, update) => {
  const store = readJson(EDITION_STORE_KEY);
  const key = normalize(templateName);
  store[key] = update(readStore(templateName));
  const saved = writeJson(EDITION_STORE_KEY, store);
  if (saved) notifyChanged();
  return saved;
};

/**
 * All editions of a game, with the user's card choices applied.
 * @param {Object|string|null} templateOrName - Loaded template (see loadAllTemplates) or game name
 * @returns {Array<{ id: string, nameKey?: string, name?: string, specialCards: string[],
 *   isCustom?: boolean, cardsEdited?: boolean, sourceTemplate?: Object }>} Empty when the game has none
 */
export function getTemplateEditions(templateOrName) {
  const isName = typeof templateOrName === 'string';
  const template = isName ? (findBuiltin(templateOrName) || { name: templateOrName }) : templateOrName;
  if (!template?.name) return [];

  const own = template.editions?.length ? template.editions : (findBuiltin(template.name)?.editions || []);
  const sources = template.editionSources ?? localEditionSources(template.name);
  const folded = sources.map((source) => ({
    id: editionIdForSource(source.name),
    name: splitEditionName(source.name).editionName,
    specialCards: Array.isArray(source.specialCards) ? source.specialCards : [],
    sourceTemplate: source,
  }));
  const { custom, cards } = readStore(template.name);
  const customEditions = custom.map((edition) => ({ ...edition, isCustom: true }));

  let editions = [...own, ...folded, ...customEditions];
  if (editions.length > 0 && own.length === 0) {
    editions = [{ id: STANDARD_EDITION_ID, nameKey: 'editions.standard', specialCards: [] }, ...editions];
  }

  return editions.map((edition) => (
    Array.isArray(cards[edition.id]) && !edition.isCustom
      ? { ...edition, specialCards: cards[edition.id], cardsEdited: true }
      : edition
  ));
}

/**
 * Find an edition by id.
 * @param {Array} editions
 * @param {string|null} editionId
 * @returns {Object|null}
 */
export function findEdition(editions, editionId) {
  return editions.find((edition) => edition.id === editionId) || null;
}

/**
 * The edition a folded "<game>: <edition>" template name stands for.
 * @param {Object} template - Loaded base template
 * @param {string} sourceName - Full edition template name
 * @returns {Object|null}
 */
export function findEditionBySourceName(template, sourceName) {
  return findEdition(getTemplateEditions(template), editionIdForSource(sourceName));
}

/**
 * Choose which special cards an edition has.
 * @param {string} templateName
 * @param {string} editionId
 * @param {string[]} specialCards
 */
export function setEditionCards(templateName, editionId, specialCards) {
  return updateStore(templateName, (store) => {
    if (store.custom.some((edition) => edition.id === editionId)) {
      return {
        ...store,
        custom: store.custom.map((edition) => (edition.id === editionId ? { ...edition, specialCards } : edition)),
      };
    }
    return { ...store, cards: { ...store.cards, [editionId]: specialCards } };
  });
}

/**
 * Go back to an edition's original special cards.
 * @param {string} templateName
 * @param {string} editionId
 */
export function resetEditionCards(templateName, editionId) {
  return updateStore(templateName, (store) => {
    const { [editionId]: _removed, ...cards } = store.cards;
    return { ...store, cards };
  });
}

/**
 * Add an edition of a game on this device.
 * @param {string} templateName
 * @param {string} name
 * @param {string[]} [specialCards]
 * @returns {string|null} New edition id, or null when it could not be saved
 */
export function addCustomEdition(templateName, name, specialCards = []) {
  const id = generateSecureId('edition');
  const saved = updateStore(templateName, (store) => ({
    ...store,
    custom: [...store.custom, { id, name: name.trim(), specialCards }],
  }));
  return saved ? id : null;
}

/**
 * Remove an edition the user added. Games played with it keep their cards.
 * @param {string} templateName
 * @param {string} editionId
 */
export function removeCustomEdition(templateName, editionId) {
  return updateStore(templateName, (store) => ({
    ...store,
    custom: store.custom.filter((edition) => edition.id !== editionId),
  }));
}

/**
 * Remember the edition last used for a game, so the next setup preselects it.
 * @param {string} templateName
 * @param {string} editionId
 */
export function rememberEdition(templateName, editionId) {
  if (!templateName || !editionId) return;
  const prefs = readJson(EDITION_PREFS_KEY);
  prefs[normalize(templateName)] = editionId;
  writeJson(EDITION_PREFS_KEY, prefs);
}

/**
 * Edition to preselect for a game: the last one used, else the template's default.
 * @param {Object} template
 * @returns {Object|null} Edition, or null when the game has none
 */
export function getPreferredEdition(template) {
  const editions = getTemplateEditions(template);
  if (editions.length === 0) return null;
  const remembered = readJson(EDITION_PREFS_KEY)[normalize(template?.name)];
  return findEdition(editions, remembered)
    || findEdition(editions, template?.defaultEdition)
    || editions[0];
}

/**
 * Fields an edition adds to a game's templateConfig.
 * @param {Object|null} edition
 * @returns {{ edition?: string, specialCards?: string[] }}
 */
export function buildEditionConfig(edition) {
  if (!edition) return {};
  return { edition: edition.id, specialCards: [...edition.specialCards] };
}

/**
 * Special cards that get a switch on the game screen. Games without a recorded
 * deck (no editions, or started before editions existed) keep every switch.
 * @param {Object|null} templateConfig
 * @returns {string[]} Tracked special card ids
 */
export function getTrackedSpecialCards(templateConfig) {
  const deck = templateConfig?.specialCards;
  if (!Array.isArray(deck)) return TRACKED_SPECIAL_CARDS;
  return TRACKED_SPECIAL_CARDS.filter((id) => deck.includes(id));
}
