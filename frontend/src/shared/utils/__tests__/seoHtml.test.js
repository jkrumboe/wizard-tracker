import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import process from 'node:process';
import { applySeoMeta, buildFallbackHtml, buildSitemap, escapeHtml } from '../seoHtml';
import { SEO_PRERENDER_ROUTES, getCanonicalUrl, resolveSeoMeta } from '../../constants/seo';

// The real template, so a renamed tag in index.html fails here before it fails the build.
// Vitest runs from frontend/; import.meta.url isn't a file URL under jsdom.
const template = readFileSync(resolve(process.cwd(), 'index.html'), 'utf-8');

const meta = {
  title: 'Flip 7 Rules & "Scoring" | KeepWiz',
  description: 'Costs $5 & more <b>',
  keywords: 'flip 7',
  robots: 'index,follow',
  canonicalUrl: 'https://example.com/game-types/Flip%207/info',
  fallbackHtml: '<h1>Flip 7</h1>',
};

describe('applySeoMeta', () => {
  const html = applySeoMeta(template, meta);

  it('replaces the title and canonical link', () => {
    expect(html).toContain('<title>Flip 7 Rules &amp; &quot;Scoring&quot; | KeepWiz</title>');
    expect(html).toContain('<link rel="canonical" href="https://example.com/game-types/Flip%207/info" />');
  });

  it('replaces description, social and robots tags with escaped values', () => {
    const description = 'content="Costs $5 &amp; more &lt;b&gt;"';
    expect(html).toContain(`<meta name="description" ${description} />`);
    expect(html).toContain(`<meta property="og:description" ${description} />`);
    expect(html).toContain(`<meta name="twitter:description" ${description} />`);
    expect(html).toContain('<meta property="og:url" content="https://example.com/game-types/Flip%207/info" />');
    expect(html).toContain('<meta name="robots" content="index,follow" />');
  });

  it('swaps the noscript fallback body and leaves the rest alone', () => {
    expect(html).toMatch(/<main data-seo-fallback[^>]*><h1>Flip 7<\/h1><\/main>/);
    expect(html).toContain('id="root"');
    expect(html).toContain('application/ld+json');
  });

  it('throws when a tag is missing from the template', () => {
    expect(() => applySeoMeta('<html><head></head></html>', meta)).toThrow(/<title>/);
  });
});

describe('buildFallbackHtml', () => {
  it('lists links to the other public pages', () => {
    const html = buildFallbackHtml({
      heading: 'Wizard',
      description: 'Rules',
      links: [{ href: '/leaderboard', label: 'Leaderboard' }],
    });
    expect(html).toContain('<h1>Wizard</h1>');
    expect(html).toContain('<a href="/leaderboard">Leaderboard</a>');
  });
});

describe('buildSitemap', () => {
  it('writes one <url> per entry and escapes locations', () => {
    const xml = buildSitemap([
      { loc: 'https://example.com/', lastmod: '2026-10-28', priority: '1.0' },
      { loc: 'https://example.com/a?b&c' },
    ]);
    expect(xml.match(/<url>/g)).toHaveLength(2);
    expect(xml).toContain('<lastmod>2026-10-28</lastmod>');
    expect(xml).toContain('<loc>https://example.com/a?b&amp;c</loc>');
    expect(xml).not.toContain('<changefreq>');
  });
});

describe('SEO_PRERENDER_ROUTES', () => {
  it.each(SEO_PRERENDER_ROUTES.map(({ path }) => path))('%s is indexable', (path) => {
    expect(resolveSeoMeta(path).robots).toBe('index,follow');
    expect(getCanonicalUrl(path).endsWith(path)).toBe(true);
  });
});

describe('escapeHtml', () => {
  it('escapes attribute-breaking characters', () => {
    expect(escapeHtml('a"<b>&')).toBe('a&quot;&lt;b&gt;&amp;');
  });
});
