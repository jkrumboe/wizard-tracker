// Attach box art and BoardGameGeek info found by a barcode or name lookup to a game template.

import { LocalTableGameTemplate } from '@/shared/api';
import gameTemplateService from '@/shared/api/gameTemplateService';
import {
  getTemplateGameInfo, saveGameInfo, wasGameInfoCheckedRecently,
} from '@/shared/utils/gameInfoStore';

// BGG descriptions can be long; the template details view only needs the gist
export const MAX_DESCRIPTION_LENGTH = 2000;

// Templates stored on the server (or built-ins the server knows) can carry shared barcodes and art
export const isSystemTemplate = (template) => template.type === 'system' || Boolean(template.isBuiltin);

// A barcode lookup (GameUPC) only knows the BGG id, box art and year; everything
// else comes from BoardGameGeek itself
const LOOKUP_FIELDS = new Set(['bggId', 'imageUrl', 'thumbnailUrl', 'yearPublished']);
const hasBggDetails = (info) => Object.entries(info).some(([key, value]) => !LOOKUP_FIELDS.has(key) && value != null);

// Info of the same game (or one without a BGG id) that `incoming` can complete
const canFillDetails = (existing, incoming) => !hasBggDetails(existing) && hasBggDetails(incoming)
  && (!existing.bggId || !incoming.bggId || existing.bggId === incoming.bggId);

/**
 * Whether a template is missing box art or the BGG details an earlier lookup
 * couldn't get (e.g. scanned while BoardGameGeek was unreachable). Games whose
 * details aren't on BGG (or the server can't fetch them) aren't asked about again
 * for a while.
 * @param {Object} template
 * @returns {boolean}
 */
export const needsGameInfo = (template) => {
  const info = getTemplateGameInfo(template);
  if (!info) return true;
  return !hasBggDetails(info) && !wasGameInfoCheckedRecently(template.name);
};

const withoutEmpty = (info) => Object.fromEntries(Object.entries(info).filter(([, value]) => value != null));

/**
 * Attach box art to a template that has none yet: on the server for system games
 * (so everyone sees it), on the template itself for local templates (so it syncs),
 * and on this device for all. Info an earlier lookup left incomplete is filled in,
 * keeping what is already there. Local templates also get a description and player
 * counts from `details` where they have none.
 * With `suggest`, a system game's art goes to the admins for review instead.
 * @param {Object} template
 * @param {Object|null} gameInfo
 * @param {{description?: string, minPlayers?: number|null, maxPlayers?: number|null}} [details]
 * @param {{suggest?: boolean}} [options]
 * @returns {Promise<Object>|null} The pending suggestion request, when one was sent
 */
export const attachGameInfo = (template, gameInfo, details = {}, { suggest = false } = {}) => {
  if (!gameInfo) return null;
  // A customised local copy shares the art with the system game it is based on
  const systemTemplate = isSystemTemplate(template) ? template : template.systemTemplate;
  let suggestion = null;
  if (systemTemplate && !systemTemplate.gameInfo) {
    if (suggest) suggestion = gameTemplateService.suggestSystemBoxArt(systemTemplate._id, gameInfo);
    else void gameTemplateService.shareSystemGameInfo(systemTemplate._id, gameInfo);
  } else if (systemTemplate && canFillDetails(systemTemplate.gameInfo, gameInfo)) {
    // The server only fills in what's missing, it keeps the shared art
    void gameTemplateService.shareSystemGameInfo(systemTemplate._id, gameInfo);
  }

  const existing = getTemplateGameInfo(template);
  if (existing && !canFillDetails(existing, gameInfo)) return suggestion;
  const merged = existing ? { ...gameInfo, ...withoutEmpty(existing) } : gameInfo;
  saveGameInfo(template.name, merged);
  if (template.id && LocalTableGameTemplate.getTemplate(template.id)) {
    const filled = { gameInfo: merged };
    if (!template.description && details.description) {
      filled.description = details.description.slice(0, MAX_DESCRIPTION_LENGTH);
    }
    if (template.minPlayers == null && details.minPlayers != null) filled.minPlayers = details.minPlayers;
    if (template.maxPlayers == null && details.maxPlayers != null) filled.maxPlayers = details.maxPlayers;
    LocalTableGameTemplate.updateTemplate(template.id, template.name, filled);
  }
  return suggestion;
};
