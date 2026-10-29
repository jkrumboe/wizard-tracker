const {
  CHANGE_FIELDS,
  changedFields,
  sameValue,
  snapshotTemplate,
} = require('../utils/templateSuggestionService');

describe('templateSuggestionService helpers', () => {
  test('sameValue treats empty values alike and ignores key order', () => {
    expect(sameValue(null, undefined)).toBe(true);
    expect(sameValue('', null)).toBe(true);
    expect(sameValue({ a: 1, b: 2 }, { b: 2, a: 1 })).toBe(true);
    expect(sameValue({ a: 1, b: null }, { a: 1 })).toBe(true);
    expect(sameValue(0, null)).toBe(false);
    expect(sameValue(false, null)).toBe(false);
    expect(sameValue({ a: 1 }, { a: 2 })).toBe(false);
  });

  test('snapshotTemplate keeps exactly the change fields', () => {
    const snapshot = snapshotTemplate({
      name: 'Dutch',
      targetNumber: 100,
      lowIsBetter: true,
      barcodes: ['12345678'],
      gameInfo: { bggId: 3, thumbnailUrl: 'https://cf.geekdo-images.com/x.jpg' },
    });
    expect(Object.keys(snapshot)).toEqual(CHANGE_FIELDS);
    expect(snapshot.name).toBe('Dutch');
    expect(snapshot.maxRounds).toBeNull();
    expect(snapshot.gameInfo).toMatchObject({ bggId: 3 });
  });

  test('changedFields returns only what differs from the baseline', () => {
    const baseline = snapshotTemplate({
      name: 'Dutch',
      targetNumber: 100,
      lowIsBetter: true,
      description: 'Old',
      gameInfo: { bggId: 3 },
    });
    const suggestion = {
      ...baseline,
      description: 'New',
      targetNumber: 150,
      baseline,
    };
    expect(changedFields(suggestion)).toEqual(['targetNumber', 'description']);
  });

  test('changedFields leaves box art alone for requests without a baseline', () => {
    const fields = changedFields({ name: 'Dutch', baseline: null });
    expect(fields).not.toContain('gameInfo');
    expect(fields).toContain('name');
  });
});
