import { describe, expect, it } from 'vitest';
import { describeChange, sameBoxArt, sameValue, siblingsOf } from '../suggestionReview';

const template = {
  name: 'Dutch',
  targetNumber: 100,
  lowIsBetter: true,
  description: 'Lowest score wins',
  gameInfo: { bggId: 3, thumbnailUrl: 'a.jpg' },
};

describe('sameValue', () => {
  it('treats empty values alike and ignores key order', () => {
    expect(sameValue('', null)).toBe(true);
    expect(sameValue({ a: 1, b: undefined }, { a: 1 })).toBe(true);
    expect(sameValue({ b: 2, a: 1 }, { a: 1, b: 2 })).toBe(true);
    expect(sameValue(0, null)).toBe(false);
    expect(sameValue(false, null)).toBe(false);
  });
});

describe('sameBoxArt', () => {
  it('compares by BGG game, falling back to the image', () => {
    expect(sameBoxArt({ bggId: 1, thumbnailUrl: 'x' }, { bggId: 1, thumbnailUrl: 'y' })).toBe(true);
    expect(sameBoxArt({ bggId: 1 }, { bggId: 2 })).toBe(false);
    expect(sameBoxArt({ imageUrl: 'x' }, { imageUrl: 'x' })).toBe(true);
    expect(sameBoxArt(null, null)).toBe(true);
  });
});

describe('describeChange', () => {
  it('lists only what the request changed relative to its baseline', () => {
    const { changes, hasBaseline } = describeChange({
      ...template,
      targetNumber: 150,
      baseline: template,
      originalTemplate: template,
      changedFields: ['targetNumber'],
    });
    expect(hasBaseline).toBe(true);
    expect(changes).toEqual([
      { field: 'targetNumber', before: 100, after: 150, current: 100, conflict: false },
    ]);
  });

  it('flags fields that changed on the template since the request', () => {
    const current = { ...template, targetNumber: 120, gameInfo: { bggId: 9 } };
    const { changes, changedSinceRequest } = describeChange({
      ...template,
      targetNumber: 150,
      baseline: template,
      originalTemplate: current,
      changedFields: ['targetNumber'],
    });
    expect(changes[0]).toMatchObject({ field: 'targetNumber', conflict: true, current: 120 });
    expect(changedSinceRequest).toEqual(['gameInfo']);
  });

  it('compares older requests without a baseline against the current template', () => {
    const { changes, hasBaseline } = describeChange({
      ...template,
      description: 'New text',
      originalTemplate: template,
    });
    expect(hasBaseline).toBe(false);
    expect(changes.map(change => change.field)).toEqual(['description']);
  });
});

describe('siblingsOf', () => {
  it('finds other requests for the same template, never for new templates', () => {
    const a = { _id: 'a', suggestionType: 'change', builtinTemplateId: '__builtin_dutch__' };
    const b = { _id: 'b', suggestionType: 'boxArt', builtinTemplateId: '__builtin_dutch__' };
    const c = { _id: 'c', suggestionType: 'change', systemTemplateId: { _id: 'x' } };
    const d = { _id: 'd', suggestionType: 'new' };
    expect(siblingsOf(a, [a, b, c, d])).toEqual([b]);
    expect(siblingsOf(d, [a, b, c, d])).toEqual([]);
  });
});
