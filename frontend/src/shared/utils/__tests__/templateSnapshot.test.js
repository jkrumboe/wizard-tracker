import { describe, it, expect, beforeEach } from 'vitest';
import { buildTemplateSnapshot, withTemplateSnapshot } from '@/shared/utils/templateSnapshot';

const TEMPLATES_KEY = 'wizardTracker_tableGameTemplates';

const storeTemplates = (templates) => {
  localStorage.setItem(TEMPLATES_KEY, JSON.stringify(
    Object.fromEntries(templates.map((template) => [template.id, template])),
  ));
};

describe('template snapshot for uploaded games', () => {
  beforeEach(() => localStorage.clear());

  it('copies the local template the game was played with', () => {
    storeTemplates([{
      id: 'template_1',
      name: 'Die Siedler von Catan',
      targetNumber: 10,
      lowIsBetter: false,
      minPlayers: 3,
      maxPlayers: 4,
      description: 'Build roads',
      usageCount: 7,
      cloudId: 'abc',
      gameInfo: { bggId: 13, thumbnailUrl: 'https://cf.geekdo-images.com/x.jpg' },
    }]);

    expect(buildTemplateSnapshot('  die siedler von catan ')).toEqual({
      name: 'Die Siedler von Catan',
      targetNumber: 10,
      lowIsBetter: false,
      minPlayers: 3,
      maxPlayers: 4,
      description: 'Build roads',
      gameInfo: { bggId: 13, thumbnailUrl: 'https://cf.geekdo-images.com/x.jpg' },
    });
  });

  it('leaves game data alone without a matching template or when it already has a copy', () => {
    storeTemplates([{ id: 'template_1', name: 'Catan', targetNumber: 10 }]);

    const unknown = { gameName: 'Something else', players: [] };
    expect(withTemplateSnapshot(unknown)).toBe(unknown);

    const existing = { gameName: 'Catan', templateSnapshot: { name: 'Catan', targetNumber: 12 } };
    expect(withTemplateSnapshot(existing)).toBe(existing);

    expect(withTemplateSnapshot({ gameName: 'Catan' }).templateSnapshot).toEqual({ name: 'Catan', targetNumber: 10 });
  });
});
