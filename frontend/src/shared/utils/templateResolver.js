import gameTemplateService from '@/shared/api/gameTemplateService';
import { queryClient, queryKeys } from '@/shared/api/queryClient';
import { LocalTableGameTemplate } from '@/shared/api';
import { BUILTIN_SYSTEM_TEMPLATES } from '@/shared/constants/gameTemplates';
import { groupEditionTemplates, findEditionBySourceName } from '@/shared/utils/gameEditions';

/**
 * Merge server system templates with built-ins by name, keeping builtin defaults
 * for any field the server version leaves empty. Built-ins without a server
 * counterpart are kept so games stay playable.
 * @param {Array} builtins - Built-in templates (already filtered by the caller)
 * @param {Array} serverTemplates - Templates from the public system endpoint
 * @returns {Array} Merged system templates
 */
export const mergeSystemTemplates = (builtins, serverTemplates) => {
  const builtinsByName = new Map(builtins.map((b) => [b.name, b]));
  const mergedServer = serverTemplates.map((serverTemplate) => {
    const builtin = builtinsByName.get(serverTemplate.name);
    if (!builtin) return serverTemplate;

    return {
      ...builtin,
      ...serverTemplate,
      gameCategory: serverTemplate.gameCategory || builtin.gameCategory,
      scoreEntryMode: serverTemplate.scoreEntryMode || builtin.scoreEntryMode || null,
      scoringFormula: serverTemplate.scoringFormula || builtin.scoringFormula,
      roundPattern: serverTemplate.roundPattern || builtin.roundPattern,
      maxRounds: serverTemplate.maxRounds || builtin.maxRounds,
      minPlayers: serverTemplate.minPlayers ?? builtin.minPlayers,
      maxPlayers: serverTemplate.maxPlayers ?? builtin.maxPlayers,
      hasDealerRotation: serverTemplate.hasDealerRotation !== undefined ? serverTemplate.hasDealerRotation : builtin.hasDealerRotation,
      hasForbiddenCall: serverTemplate.hasForbiddenCall !== undefined ? serverTemplate.hasForbiddenCall : builtin.hasForbiddenCall,
      barcodes: [...new Set([...(builtin.barcodes || []), ...(serverTemplate.barcodes || [])])],
      gameInfo: serverTemplate.gameInfo || builtin.gameInfo || null,
      editions: serverTemplate.editions?.length ? serverTemplate.editions : builtin.editions,
      defaultEdition: serverTemplate.defaultEdition || builtin.defaultEdition,
    };
  });

  const serverNames = new Set(mergedServer.map((t) => t.name));
  const extraBuiltins = builtins.filter((b) => !serverNames.has(b.name));
  return [...extraBuiltins, ...mergedServer];
};

/**
 * Load system templates (server merged with built-ins), falling back to built-ins offline.
 * @returns {Promise<Array>}
 */
export const loadSystemTemplates = async () => {
  try {
    // Cached and de-duplicated: every page using useGameTemplates loads these on mount
    const serverTemplates = await queryClient.fetchQuery({
      queryKey: queryKeys.systemTemplates,
      queryFn: gameTemplateService.getSystemTemplates,
    });
    return mergeSystemTemplates(BUILTIN_SYSTEM_TEMPLATES, serverTemplates);
  } catch (error) {
    console.warn('Using built-in system templates (offline):', error);
    return BUILTIN_SYSTEM_TEMPLATES;
  }
};

/**
 * Whether a local template is a customised copy of a system template with the same name.
 * @param {Object} localTemplate
 * @param {Object} systemTemplate
 * @returns {boolean}
 */
export const isLocalVariant = (localTemplate, systemTemplate) => {
  if (!systemTemplate) return false;
  return (
    localTemplate.targetNumber !== systemTemplate.targetNumber ||
    localTemplate.lowIsBetter !== systemTemplate.lowIsBetter ||
    (localTemplate.gameCategory || 'table') !== (systemTemplate.gameCategory || 'table') ||
    (localTemplate.roundPattern || null) !== (systemTemplate.roundPattern || null) ||
    (localTemplate.maxRounds || null) !== (systemTemplate.maxRounds || null) ||
    JSON.stringify(localTemplate.scoringFormula || null) !== JSON.stringify(systemTemplate.scoringFormula || null) ||
    (localTemplate.hasDealerRotation !== false) !== (systemTemplate.hasDealerRotation !== false) ||
    (localTemplate.hasForbiddenCall !== false) !== (systemTemplate.hasForbiddenCall !== false) ||
    localTemplate.description !== systemTemplate.description ||
    localTemplate.descriptionMarkdown !== systemTemplate.descriptionMarkdown
  );
};

/**
 * Load every template the user can start, one per name: system templates plus
 * local user templates. A local customised copy of a system template replaces
 * it (marked `isVariant`, with the original as `systemTemplate`); an unchanged
 * local copy is skipped. "<game>: <edition>" templates are listed as editions of
 * their game (see gameEditions.groupEditionTemplates).
 * @returns {Promise<Array>}
 */
export const loadAllTemplates = async () => {
  const systemTemplates = await loadSystemTemplates();
  const systemByName = new Map(systemTemplates.map((t) => [t.name, t]));
  const variantsByName = new Map();
  const localOnly = [];

  LocalTableGameTemplate.getTemplatesList()
    .filter((t) => !t.approvedAsSystemTemplate)
    .forEach((local) => {
      const system = systemByName.get(local.name);
      if (!system) {
        localOnly.push(local);
      } else if (isLocalVariant(local, system)) {
        variantsByName.set(local.name, {
          ...local,
          // Keep shared box art and barcodes the local copy doesn't have
          gameInfo: local.gameInfo || system.gameInfo || null,
          barcodes: system.barcodes,
          editions: local.editions || system.editions,
          defaultEdition: local.defaultEdition || system.defaultEdition,
          isVariant: true,
          systemTemplate: system,
        });
      }
    });

  return groupEditionTemplates([
    ...systemTemplates.map((system) => variantsByName.get(system.name) || system),
    ...localOnly,
  ]);
};

/**
 * Whether a template is played as a two-side live scoreboard.
 * @param {Object} template
 * @returns {boolean}
 */
export const isScoreboardTemplate = (template) => {
  const normalizedName = (template?.name || '').trim().toLowerCase();
  return template?.scoreEntryMode === 'twoSideGesture'
    || normalizedName === 'volleyball'
    || normalizedName === 'basketball';
};

/**
 * Find a startable game by name (case-insensitive). An edition's name
 * ("Wizard: Jubiläumsedition") resolves to its game plus that edition.
 * @param {string} name
 * @returns {Promise<{ template: Object, edition: Object|null }|null>}
 */
export const resolveTemplateEdition = async (name) => {
  const normalized = (name || '').trim().toLowerCase();
  if (!normalized) return null;
  const templates = await loadAllTemplates();
  const template = templates.find((t) => (t.name || '').trim().toLowerCase() === normalized);
  if (template) return { template, edition: null };

  for (const base of templates) {
    const source = (base.editionSources || []).find((t) => (t.name || '').trim().toLowerCase() === normalized);
    if (source) return { template: base, edition: findEditionBySourceName(base, source.name) };
  }
  return null;
};

/**
 * Find a startable template by name (case-insensitive); edition names resolve to their game.
 * @param {string} name
 * @returns {Promise<Object|null>}
 */
export const resolveTemplateByName = async (name) => (await resolveTemplateEdition(name))?.template || null;
