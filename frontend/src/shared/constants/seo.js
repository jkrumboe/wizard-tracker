const getEnvValue = (value) => (typeof value === 'string' ? value.trim() : '');

const env = {
  siteName: getEnvValue(import.meta.env.VITE_SEO_SITE_NAME),
  siteUrl: getEnvValue(import.meta.env.VITE_SEO_SITE_URL),
  defaultTitle: getEnvValue(import.meta.env.VITE_SEO_DEFAULT_TITLE),
  defaultDescription: getEnvValue(import.meta.env.VITE_SEO_DEFAULT_DESCRIPTION),
  defaultKeywords: getEnvValue(import.meta.env.VITE_SEO_DEFAULT_KEYWORDS),
  socialImageUrl: getEnvValue(import.meta.env.VITE_SEO_SOCIAL_IMAGE_URL),
  twitterHandle: getEnvValue(import.meta.env.VITE_SEO_TWITTER_HANDLE),
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
  socialImageUrl:
    env.socialImageUrl || 'https://wizard.jkrumboe.dev/icons/logo-512.png',
  twitterHandle: env.twitterHandle || '@keepwizapp',
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
  /^\/shared(\/|$)/,
  /^\/admin(\/|$)/,
  /^\/friend-leaderboard(\/|$)/,
];
