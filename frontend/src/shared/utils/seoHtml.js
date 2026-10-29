/**
 * Build-time helpers that bake one route's SEO tags into the built index.html
 * and write the sitemap. Used by scripts/prerender-seo.js; kept free of Node
 * APIs so they can be unit tested here.
 */

export function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

// Throw when the template has drifted, so a renamed tag fails the build
// instead of silently shipping the homepage tags for every route.
function replaceOnce(html, pattern, replacement, label) {
  if (!pattern.test(html)) {
    throw new Error(`prerender: could not find ${label} in index.html`);
  }
  // A function keeps "$" in titles from being read as a replacement pattern
  return html.replace(pattern, typeof replacement === 'function' ? replacement : () => replacement);
}

function replaceMeta(html, attribute, key, content) {
  const pattern = new RegExp(String.raw`<meta ${attribute}="${key}" content="[^"]*"\s*/?>`);
  return replaceOnce(html, pattern, `<meta ${attribute}="${key}" content="${escapeHtml(content)}" />`, key);
}

/**
 * Body text for visitors and crawlers without JavaScript: the page's own
 * heading and description, plus links so crawlers find the other public pages.
 */
export function buildFallbackHtml({ heading, description, links }) {
  const items = links
    .map(({ href, label }) => `<li><a href="${escapeHtml(href)}">${escapeHtml(label)}</a></li>`)
    .join('');
  return [
    `<h1>${escapeHtml(heading)}</h1>`,
    `<p>${escapeHtml(description)}</p>`,
    '<p>KeepWiz is a free score sheet for Wizard and other card and table games. It works offline and can be installed on your phone. Please enable JavaScript to use it.</p>',
    `<nav><ul>${items}</ul></nav>`,
  ].join('');
}

export function applySeoMeta(html, { title, description, keywords, robots, canonicalUrl, fallbackHtml }) {
  let out = replaceOnce(html, /<title>[\s\S]*?<\/title>/, `<title>${escapeHtml(title)}</title>`, '<title>');
  out = replaceOnce(
    out,
    /<link rel="canonical" href="[^"]*"\s*\/?>/,
    `<link rel="canonical" href="${escapeHtml(canonicalUrl)}" />`,
    'canonical link',
  );
  out = replaceMeta(out, 'name', 'description', description);
  out = replaceMeta(out, 'name', 'keywords', keywords);
  out = replaceMeta(out, 'name', 'robots', robots);
  out = replaceMeta(out, 'property', 'og:title', title);
  out = replaceMeta(out, 'property', 'og:description', description);
  out = replaceMeta(out, 'property', 'og:url', canonicalUrl);
  out = replaceMeta(out, 'name', 'twitter:title', title);
  out = replaceMeta(out, 'name', 'twitter:description', description);
  if (fallbackHtml) {
    out = replaceOnce(
      out,
      /(<main data-seo-fallback[^>]*>)[\s\S]*?(<\/main>)/,
      (_, open, close) => `${open}${fallbackHtml}${close}`,
      'noscript fallback',
    );
  }
  return out;
}

export function buildSitemap(entries) {
  const urls = entries
    .map(({ loc, lastmod, changefreq, priority }) => [
      '  <url>',
      `    <loc>${escapeHtml(loc)}</loc>`,
      lastmod && `    <lastmod>${lastmod}</lastmod>`,
      changefreq && `    <changefreq>${changefreq}</changefreq>`,
      priority && `    <priority>${priority}</priority>`,
      '  </url>',
    ].filter(Boolean).join('\n'))
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}
