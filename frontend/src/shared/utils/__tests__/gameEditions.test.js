import { describe, it, expect, beforeEach } from 'vitest';
import {
  getTemplateEditions,
  findEdition,
  getPreferredEdition,
  rememberEdition,
  buildEditionConfig,
  getTrackedSpecialCards,
  splitEditionName,
  groupEditionTemplates,
  findEditionBySourceName,
  setEditionCards,
  resetEditionCards,
  addCustomEdition,
  removeCustomEdition,
  editionNameFromProduct,
  STANDARD_EDITION_ID,
} from '../gameEditions';
import { findStartForBarcode } from '../barcodeTemplateMap';
import { WIZARD_TEMPLATE, WIZARD_EDITIONS } from '../../constants/gameTemplates';
import { gameBelongsToTemplate } from '../templateGames';

describe('gameEditions', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('getTemplateEditions', () => {
    it('returns the editions a template defines', () => {
      expect(getTemplateEditions(WIZARD_TEMPLATE)).toEqual(WIZARD_EDITIONS);
    });

    it('falls back to the built-in template by name', () => {
      expect(getTemplateEditions({ name: 'wizard ' })).toEqual(WIZARD_EDITIONS);
      expect(getTemplateEditions('Wizard')).toEqual(WIZARD_EDITIONS);
    });

    it('returns no editions for games without them', () => {
      expect(getTemplateEditions({ name: 'Dutch' })).toEqual([]);
      expect(getTemplateEditions(null)).toEqual([]);
    });
  });

  it('only anniversary editions of Wizard contain bomb and cloud', () => {
    const classic = findEdition(WIZARD_EDITIONS, 'classic');
    expect(classic.specialCards).toEqual([]);
    for (const id of ['anniversary20', 'anniversary25', 'anniversary30']) {
      expect(findEdition(WIZARD_EDITIONS, id).specialCards).toEqual(expect.arrayContaining(['bomb', 'cloud']));
    }
  });

  describe('getPreferredEdition', () => {
    it('defaults to the template default edition', () => {
      expect(getPreferredEdition(WIZARD_TEMPLATE).id).toBe('classic');
    });

    it('uses the edition last remembered for the game', () => {
      rememberEdition('Wizard', 'anniversary25');
      expect(getPreferredEdition(WIZARD_TEMPLATE).id).toBe('anniversary25');
    });

    it('ignores a remembered edition that no longer exists', () => {
      rememberEdition('Wizard', 'gone');
      expect(getPreferredEdition(WIZARD_TEMPLATE).id).toBe('classic');
    });

    it('returns null for templates without editions', () => {
      expect(getPreferredEdition({ name: 'Dutch' })).toBeNull();
    });
  });

  describe('getTrackedSpecialCards', () => {
    it('shows no switches for the classic deck', () => {
      const config = buildEditionConfig(findEdition(WIZARD_EDITIONS, 'classic'));
      expect(getTrackedSpecialCards(config)).toEqual([]);
    });

    it('only shows switches for cards that change the scoring', () => {
      const config = buildEditionConfig(findEdition(WIZARD_EDITIONS, 'anniversary30'));
      expect(getTrackedSpecialCards(config)).toEqual(['bomb', 'cloud']);
    });

    it('keeps every switch for games without a recorded deck', () => {
      expect(getTrackedSpecialCards(null)).toEqual(['bomb', 'cloud']);
      expect(getTrackedSpecialCards({ templateName: 'Wizard' })).toEqual(['bomb', 'cloud']);
    });
  });

  it('lists games of every edition under the main template', () => {
    for (const edition of WIZARD_EDITIONS) {
      const game = {
        gameType: 'wizard',
        templateConfig: { templateName: 'Wizard', ...buildEditionConfig(edition) },
      };
      expect(gameBelongsToTemplate(game, WIZARD_TEMPLATE)).toBe(true);
    }
  });

  describe('edition templates ("<game>: <edition>")', () => {
    const jubilee = { name: 'Wizard: Jubiläumsedition', gameCategory: 'callAndMade', barcodes: ['4007396021018'] };
    const grouped = () => groupEditionTemplates([WIZARD_TEMPLATE, jubilee, { name: 'Dutch', gameCategory: 'table' }]);

    it('splits names at the first colon', () => {
      expect(splitEditionName('Wizard: Jubiläumsedition')).toEqual({ baseName: 'Wizard', editionName: 'Jubiläumsedition' });
      expect(splitEditionName('Wizard')).toBeNull();
      expect(splitEditionName('Wizard:')).toBeNull();
    });

    it('folds them into their game so only the main game is listed', () => {
      const templates = grouped();
      expect(templates.map((tpl) => tpl.name)).toEqual(['Wizard', 'Dutch']);
      expect(templates[0].editionSources).toEqual([jubilee]);
    });

    it('keeps them separate when the main game is missing or of another type', () => {
      const tableEdition = { name: 'Wizard: Table', gameCategory: 'table' };
      expect(groupEditionTemplates([jubilee]).map((tpl) => tpl.name)).toEqual(['Wizard: Jubiläumsedition']);
      expect(groupEditionTemplates([WIZARD_TEMPLATE, tableEdition])).toHaveLength(2);
    });

    it('offers them as editions of the main game', () => {
      const [wizard] = grouped();
      const edition = findEditionBySourceName(wizard, 'Wizard: Jubiläumsedition');
      expect(edition).toMatchObject({ name: 'Jubiläumsedition', specialCards: [] });
      expect(getTemplateEditions(wizard).map((e) => e.id)).toContain(edition.id);
    });

    it('adds a standard edition for games without their own editions', () => {
      const catan = { name: 'Catan', gameCategory: 'table' };
      const [base] = groupEditionTemplates([catan, { name: 'Catan: Seafarers', gameCategory: 'table' }]);
      expect(getTemplateEditions(base).map((e) => e.id)).toEqual([STANDARD_EDITION_ID, 'tpl:catan: seafarers']);
    });

    it('counts their games under the main game', () => {
      const [wizard] = grouped();
      const game = { gameType: 'wizard', templateName: 'Wizard: Jubiläumsedition' };
      expect(gameBelongsToTemplate(game, wizard)).toBe(true);
    });

    it('finds the main game by an edition barcode and starts it with the edition name', () => {
      expect(findStartForBarcode('4007396021018', grouped())).toMatchObject({
        template: { name: 'Wizard' },
        startName: 'Wizard: Jubiläumsedition',
      });
    });
  });

  describe('choosing cards', () => {
    it('overrides and resets the cards of an edition', () => {
      setEditionCards('Wizard', 'classic', ['bomb']);
      expect(findEdition(getTemplateEditions(WIZARD_TEMPLATE), 'classic'))
        .toMatchObject({ specialCards: ['bomb'], cardsEdited: true });

      resetEditionCards('Wizard', 'classic');
      expect(findEdition(getTemplateEditions(WIZARD_TEMPLATE), 'classic').specialCards).toEqual([]);
    });

    it('adds, edits and removes custom editions', () => {
      const id = addCustomEdition('Wizard', 'House rules');
      expect(findEdition(getTemplateEditions(WIZARD_TEMPLATE), id)).toMatchObject({ name: 'House rules', isCustom: true });

      setEditionCards('Wizard', id, ['cloud']);
      expect(findEdition(getTemplateEditions(WIZARD_TEMPLATE), id).specialCards).toEqual(['cloud']);

      removeCustomEdition('Wizard', id);
      expect(findEdition(getTemplateEditions(WIZARD_TEMPLATE), id)).toBeNull();
    });
  });

  describe('editionNameFromProduct', () => {
    it('takes the edition part of a scanned box name', () => {
      expect(editionNameFromProduct('Wizard: Jubiläumsedition', 'Wizard')).toBe('Jubiläumsedition');
      expect(editionNameFromProduct('wizard - 30 Jahre', 'Wizard')).toBe('30 Jahre');
      expect(editionNameFromProduct('Skull King Deluxe', 'Skull King')).toBe('Deluxe');
    });

    it('gives nothing when the box is just the game', () => {
      expect(editionNameFromProduct('Wizard', 'Wizard')).toBe('');
    });

    it('keeps names that only start with the same letters', () => {
      expect(editionNameFromProduct('Wizardry Deluxe', 'Wizard')).toBe('Wizardry Deluxe');
    });
  });
});
