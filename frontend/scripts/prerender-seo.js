#!/usr/bin/env node

/**
 * Write a static index.html for each public route (SEO_PRERENDER_ROUTES) with
 * that route's title, description, canonical URL and social tags baked in,
 * plus dist/sitemap.xml. Link previews and crawlers that don't run JavaScript
 * only ever see this HTML; the app still boots normally from every copy.
 *
 * nginx serves /leaderboard from dist/leaderboard/index.html via
 * `try_files $uri $uri/index.html /index.html` (see nginx.conf).
 */

import fs from 'fs';
import path from 'path';
import process from 'process';
import { fileURLToPath } from 'url';
import { SEO_PRERENDER_ROUTES, SEO_VALUES, getCanonicalUrl, resolveSeoMeta } from '../src/shared/constants/seo.js';
import { applySeoMeta, buildFallbackHtml, buildSitemap } from '../src/shared/utils/seoHtml.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.join(__dirname, '..', 'dist');
const indexPath = path.join(distDir, 'index.html');

if (!fs.existsSync(indexPath)) {
  console.error('❌ dist/index.html not found. Run vite build first.');
  process.exit(1);
}

const template = fs.readFileSync(indexPath, 'utf-8');
const links = SEO_PRERENDER_ROUTES.map(({ path: href, label }) => ({ href, label }));
const titleSuffix = ` | ${SEO_VALUES.siteName}`;

for (const route of SEO_PRERENDER_ROUTES) {
  const meta = resolveSeoMeta(route.path);
  const html = applySeoMeta(template, {
    ...meta,
    canonicalUrl: getCanonicalUrl(route.path),
    fallbackHtml: buildFallbackHtml({
      heading: meta.title.replace(titleSuffix, ''),
      description: meta.description,
      links,
    }),
  });

  // decodeURIComponent: nginx looks up the decoded path ("Flip 7"), not "Flip%207"
  const target = path.join(distDir, decodeURIComponent(route.path), 'index.html');
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, html);
  console.log(`✓ Prerendered ${route.path}`);
}

const lastmod = new Date().toISOString().slice(0, 10);
const sitemap = buildSitemap(SEO_PRERENDER_ROUTES.map((route) => ({
  loc: getCanonicalUrl(route.path),
  lastmod,
  changefreq: route.changefreq,
  priority: route.priority,
})));
fs.writeFileSync(path.join(distDir, 'sitemap.xml'), sitemap);
console.log(`✓ Wrote sitemap.xml with ${SEO_PRERENDER_ROUTES.length} URLs`);
