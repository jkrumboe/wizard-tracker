import { describe, it, expect } from 'vitest';
import { SEO_VALUES, resolveSeoMeta, getCanonicalUrl } from '../seo';

describe('resolveSeoMeta', () => {
  it('uses the home page entry for the root', () => {
    const meta = resolveSeoMeta('/');
    expect(meta.title).toContain('Wizard Score Tracker');
    expect(meta.robots).toBe('index,follow');
  });

  it('builds game info meta from the decoded game name', () => {
    const meta = resolveSeoMeta('/game-types/Flip%207/info');
    expect(meta.title).toBe(`Flip 7 Rules, Scoring and Score Tracker | ${SEO_VALUES.siteName}`);
    expect(meta.description).toContain('Flip 7');
    expect(meta.keywords).toContain('flip 7 score tracker');
    expect(meta.robots).toBe('index,follow');
  });

  it('keeps a malformed game name instead of throwing', () => {
    expect(resolveSeoMeta('/game-types/%E0/info').title).toContain('%E0');
  });

  it.each([
    '/game-types/Wizard',
    '/games',
    '/user/abc',
    '/scoreboard/123',
    '/scoreboard-game/123',
    '/table/1',
    '/game/current',
    '/account',
    '/admin/users',
  ])('marks %s as noindex', (path) => {
    expect(resolveSeoMeta(path).robots).toBe('noindex,nofollow');
  });

  it('falls back to the defaults for unknown routes', () => {
    const meta = resolveSeoMeta('/somewhere');
    expect(meta.title).toBe(SEO_VALUES.defaultTitle);
    expect(meta.description).toBe(SEO_VALUES.defaultDescription);
    expect(meta.robots).toBe('index,follow');
  });
});

describe('getCanonicalUrl', () => {
  it('drops trailing slashes but keeps the root', () => {
    expect(getCanonicalUrl('/')).toBe(`${SEO_VALUES.siteUrl}/`);
    expect(getCanonicalUrl('/leaderboard/')).toBe(`${SEO_VALUES.siteUrl}/leaderboard`);
  });
});
