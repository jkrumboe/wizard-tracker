const getEnvValue = (value) => (typeof value === 'string' ? value.trim() : '');

// scripts/prerender-seo.js imports this file in plain Node, where import.meta.env is undefined
const viteEnv = import.meta.env ?? {};

const env = {
  siteName: getEnvValue(viteEnv.VITE_SEO_SITE_NAME),
  siteUrl: getEnvValue(viteEnv.VITE_SEO_SITE_URL),
  defaultTitle: getEnvValue(viteEnv.VITE_SEO_DEFAULT_TITLE),
  defaultDescription: getEnvValue(viteEnv.VITE_SEO_DEFAULT_DESCRIPTION),
  defaultKeywords: getEnvValue(viteEnv.VITE_SEO_DEFAULT_KEYWORDS),
  socialImageUrl: getEnvValue(viteEnv.VITE_SEO_SOCIAL_IMAGE_URL),
  twitterHandle: getEnvValue(viteEnv.VITE_SEO_TWITTER_HANDLE),
};

export const SEO_VALUES = {
  siteName: env.siteName || 'KeepWiz',
  siteUrl: env.siteUrl || 'https://wizard.jkrumboe.dev',
  defaultTitle: env.defaultTitle || 'KeepWiz - Wizard Score Tracker and Card Game Scorekeeper',
  defaultDescription:
    env.defaultDescription ||
    'Track Wizard and other card game scores online. Keep rounds, bids, tricks, and stats in one fast scorekeeper app.',
  defaultKeywords:
    env.defaultKeywords ||
    'wizard score tracker, wizard score app, wizard card game scorekeeper, card game score app, scorekeeper app, trick taking score tracker, game night score tracker, multiplayer score tracker, dutch card game score tracker',
  // 1200x630 share card, made from scripts/og-image.html (see the comment there)
  socialImageUrl:
    env.socialImageUrl || 'https://wizard.jkrumboe.dev/og-image.png',
  twitterHandle: env.twitterHandle || '@keepwizapp',
  socialImageAlt: 'KeepWiz: the free Wizard score tracker and card game scorekeeper',
  twitterCard: 'summary_large_image',
};

// Built-in games whose rules pages are public (names from BUILTIN_SYSTEM_TEMPLATES)
export const SEO_PUBLIC_GAMES = ['Wizard', 'Dutch', 'Flip 7', 'Volleyball', 'Basketball'];

/**
 * Public pages that get their own prerendered index.html and a sitemap entry
 * at build time (scripts/prerender-seo.js), so crawlers and link previews that
 * don't run JavaScript still see the right title, description and image.
 */
export const SEO_PRERENDER_ROUTES = [
  { path: '/', label: 'Home', changefreq: 'weekly', priority: '1.0' },
  { path: '/leaderboard', label: 'Leaderboard', changefreq: 'daily', priority: '0.8' },
  ...SEO_PUBLIC_GAMES.map((name, index) => ({
    path: `/game-types/${encodeURIComponent(name)}/info`,
    label: `${name} rules and scoring`,
    changefreq: 'monthly',
    priority: index === 0 ? '0.9' : '0.7',
  })),
];

// Route params arrive URL-encoded ("Flip%207"); fall back to the raw value on bad escapes
const decodeParam = (value) => {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

export const SEO_ROUTE_META = [
  {
    pattern: /^\/$/,
    title: `Wizard Score Tracker and Card Game Scorekeeper | ${SEO_VALUES.siteName}`,
    description:
      'Track Wizard card game scores with bids, tricks, rounds, and stats. Save game history and improve strategy with KeepWiz.',
    keywords:
      'wizard score tracker, wizard score app, wizard card game scorekeeper, card game scorekeeper',
    robots: 'index,follow',
  },
  {
    pattern: /^\/leaderboard\/?$/,
    title: `Wizard Leaderboard and Player Rankings | ${SEO_VALUES.siteName}`,
    description:
      'See Wizard player rankings, win rates, and performance trends in a live leaderboard built for score-based game nights.',
    keywords:
      'wizard leaderboard, wizard rankings, wizard player stats, card game leaderboard',
    robots: 'index,follow',
  },
  {
    pattern: /^\/login\/?$/,
    title: `Login | ${SEO_VALUES.siteName}`,
    description:
      'Sign in to access your saved games, player profiles, and synced score history.',
    robots: 'noindex,follow',
  },
  {
    // Public rules and box info for one game; the richest indexable content in the app
    pattern: /^\/game-types\/([^/]+)\/info\/?$/,
    title: ([, name]) => `${decodeParam(name)} Rules, Scoring and Score Tracker | ${SEO_VALUES.siteName}`,
    description: ([, name]) =>
      `How ${decodeParam(name)} is played and scored, with player count and playing time. Keep score of every round for free with KeepWiz.`,
    keywords: ([, name]) => {
      const game = decodeParam(name).toLowerCase();
      return `${game} rules, ${game} scoring, ${game} score tracker, ${game} score sheet, ${game} scorekeeper`;
    },
    robots: 'index,follow',
  },
];

export const SEO_NOINDEX_PATTERNS = [
  /^\/account(\/|$)/,
  /^\/profile(\/|$)/,
  /^\/stats(\/|$)/,
  /^\/start(\/|$)/,
  /^\/new-game(\/|$)/,
  /^\/table(\/|$)/,
  /^\/table-game(\/|$)/,
  /^\/game(\/|$)/,
  /^\/admin(\/|$)/,
  /^\/friend-leaderboard(\/|$)/,
  /^\/games(\/|$)/,
  /^\/user(\/|$)/,
  /^\/scoreboard(\/|$)/,
  /^\/scoreboard-game(\/|$)/,
  // A game type's own page lists the user's games; only its /info page is public
  /^\/game-types\/[^/]+\/?$/,
];

/**
 * Resolve the title, description, keywords and robots value for a path.
 * Route entries may give each field as a string or as a function of the
 * pattern's match.
 */
export function resolveSeoMeta(pathname) {
  let match = null;
  const route = SEO_ROUTE_META.find(({ pattern }) => {
    match = pattern.exec(pathname);
    return match !== null;
  });
  const field = (key) => {
    const value = route?.[key];
    return typeof value === 'function' ? value(match) : value;
  };
  const noindex = SEO_NOINDEX_PATTERNS.some((pattern) => pattern.test(pathname));

  return {
    title: field('title') || SEO_VALUES.defaultTitle,
    description: field('description') || SEO_VALUES.defaultDescription,
    keywords: field('keywords') || SEO_VALUES.defaultKeywords,
    robots: noindex ? 'noindex,nofollow' : field('robots') || 'index,follow',
  };
}

/** Absolute canonical URL for a path, without a trailing slash (except the root). */
export function getCanonicalUrl(pathname) {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
  return `${SEO_VALUES.siteUrl}${path || '/'}`;
}
