// Attach box art and BoardGameGeek info found by a barcode or name lookup to a game template.

import { LocalTableGameTemplate } from '@/shared/api';
import gameTemplateService from '@/shared/api/gameTemplateService';
import { getTemplateGameInfo, saveGameInfo } from '@/shared/utils/gameInfoStore';

// BGG descriptions can be long; the template details view only needs the gist
export const MAX_DESCRIPTION_LENGTH = 2000;

// Templates stored on the server (or built-ins the server knows) can carry shared barcodes and art
export const isSystemTemplate = (template) => template.type === 'system' || Boolean(template.isBuiltin);

/**
 * Attach box art to a template that has none yet: on the server for system games
 * (so everyone sees it), on the template itself for local templates (so it syncs),
 * and on this device for all. Local templates also get a description and player
 * counts from `details` where they have none.
 * @param {Object} template
 * @param {Object|null} gameInfo
 * @param {{description?: string, minPlayers?: number|null, maxPlayers?: number|null}} [details]
 */
export const attachGameInfo = (template, gameInfo, details = {}) => {
  if (!gameInfo) return;
  // A customised local copy shares the art with the system game it is based on
  const systemTemplate = isSystemTemplate(template) ? template : template.systemTemplate;
  if (systemTemplate && !systemTemplate.gameInfo) {
    void gameTemplateService.shareSystemGameInfo(systemTemplate._id, gameInfo);
  }

  if (getTemplateGameInfo(template)) return;
  saveGameInfo(template.name, gameInfo);
  if (template.id && LocalTableGameTemplate.getTemplate(template.id)) {
    const filled = { gameInfo };
    if (!template.description && details.description) {
      filled.description = details.description.slice(0, MAX_DESCRIPTION_LENGTH);
    }
    if (template.minPlayers == null && details.minPlayers != null) filled.minPlayers = details.minPlayers;
    if (template.maxPlayers == null && details.maxPlayers != null) filled.maxPlayers = details.maxPlayers;
    LocalTableGameTemplate.updateTemplate(template.id, template.name, filled);
  }
};
