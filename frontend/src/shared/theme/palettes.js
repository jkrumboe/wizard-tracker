/*
 * Accent palette system.
 *
 * A single seed colour (a preset, or whatever the user picks) is expanded into
 * the full set of `--primary*` custom properties for both themes. Everything is
 * derived rather than hand-listed so a custom colour gets exactly the same
 * treatment — and the same guaranteed contrast — as a built-in preset.
 */

import {
  ensureContrast,
  hexToOklch,
  normalizeHex,
  oklchToHex,
  readableTextOn,
  toRgbString,
  withAlpha,
  clamp,
} from './colorUtils';

/** Surfaces the accent has to stay readable against, per theme. */
export const THEME_SURFACES = {
  light: { canvas: '#f4f6fa', surface: '#ffffff', ink: '#0f172a' },
  dark: { canvas: '#0b1120', surface: '#161e2e', ink: '#f1f5f9' },
};

/*
 * Seeds are chosen for a card-game scorekeeper: well separated hues so players
 * and chart series stay distinguishable, none so pale it disappears on white
 * or so dark it disappears on the night canvas. Names are card/table themed and
 * translated via `theme.accents.<id>` with `name` as the fallback.
 */
export const ACCENT_PRESETS = [
  { id: 'wizard', name: 'Wizard Blue', seed: '#3b82f6' },
  { id: 'arcane', name: 'Arcane Violet', seed: '#7c5cf5' },
  { id: 'mystic', name: 'Mystic Orchid', seed: '#c026d3' },
  { id: 'ruby', name: 'Ruby Trick', seed: '#e11d48' },
  { id: 'ember', name: 'Ember Orange', seed: '#ea580c' },
  { id: 'gold', name: 'Royal Gold', seed: '#d4a017' },
  { id: 'clover', name: 'Clover Green', seed: '#16a34a' },
  { id: 'jade', name: 'Jade Table', seed: '#0d9488' },
  { id: 'lagoon', name: 'Lagoon Cyan', seed: '#0891b2' },
  { id: 'graphite', name: 'Graphite', seed: '#5b6b83' },
];

export const DEFAULT_ACCENT_ID = 'wizard';

export const CUSTOM_ACCENT_ID = 'custom';

export const DEFAULT_CUSTOM_ACCENT = '#7c5cf5';

/**
 * Per-theme derivation targets. `light`/`dark` differ because an accent on a
 * white card needs to be dark enough to carry white button text, while on the
 * night canvas it needs to be bright enough to read as a highlight.
 */
const RECIPES = {
  light: {
    baseLightness: 0.555,
    // 4.5 against a white card keeps white button text at AA-large, which is
    // what the existing `color: white` primary buttons across the app assume.
    minContrastOnSurface: 4.5,
    hoverAlpha: 0.08,
    ringAlpha: 0.32,
    strongDelta: -0.085,
    softLightness: 0.955,
    softChroma: 0.35,
    tintLightness: 0.9,
    tintChroma: 0.5,
    borderLightness: 0.84,
    borderChroma: 0.55,
    subtleLightness: 0.46,
    lightDelta: 0.13,
  },
  dark: {
    baseLightness: 0.735,
    minContrastOnSurface: 4.6,
    hoverAlpha: 0.16,
    ringAlpha: 0.42,
    strongDelta: -0.09,
    softLightness: 0.28,
    softChroma: 0.45,
    tintLightness: 0.36,
    tintChroma: 0.5,
    borderLightness: 0.45,
    borderChroma: 0.6,
    subtleLightness: 0.82,
    lightDelta: 0.1,
  },
};

const shift = (lch, deltaL, chromaScale = 1) =>
  oklchToHex({
    l: clamp(lch.l + deltaL, 0.04, 0.99),
    c: Math.max(lch.c * chromaScale, 0),
    h: lch.h,
  });

const at = (lch, lightness, chromaScale = 1) =>
  oklchToHex({ l: clamp(lightness, 0.04, 0.99), c: Math.max(lch.c * chromaScale, 0), h: lch.h });

// Derivation is pure but not free (each token runs a gamut-mapping search), and
// the picker asks for every preset on every render, so results are memoised.
const derivationCache = new Map();

/**
 * Expand one seed colour into the accent custom properties for one theme.
 * Returns a plain `{ '--token': 'value' }` map ready to set on :root.
 */
export function deriveAccentTokens(seedHex, theme = 'light') {
  const seed = normalizeHex(seedHex) || ACCENT_PRESETS[0].seed;
  const cacheKey = `${seed}|${theme}`;
  const cached = derivationCache.get(cacheKey);
  if (cached) return cached;
  const recipe = RECIPES[theme] || RECIPES.light;
  const surfaces = THEME_SURFACES[theme] || THEME_SURFACES.light;

  const seedLch = hexToOklch(seed);
  // Pull the seed to the theme's working lightness first, then nudge it further
  // only if it still misses the contrast floor against that theme's surface.
  const normalized = oklchToHex({ ...seedLch, l: recipe.baseLightness });
  const primary = ensureContrast(normalized, surfaces.surface, recipe.minContrastOnSurface);
  const primaryLch = hexToOklch(primary);

  const primaryDark = shift(primaryLch, recipe.strongDelta);
  const primaryLight = shift(primaryLch, recipe.lightDelta, 0.9);
  const soft = at(primaryLch, recipe.softLightness, recipe.softChroma);
  const tint = at(primaryLch, recipe.tintLightness, recipe.tintChroma);
  const border = at(primaryLch, recipe.borderLightness, recipe.borderChroma);
  const subtle = at(primaryLch, recipe.subtleLightness, 0.85);
  // A companion hue for two-colour fills (gradients, paired chart series).
  const onPrimary = readableTextOn(primary, '#ffffff', '#0b1120');
  const secondary = oklchToHex({
    l: clamp(primaryLch.l + (theme === 'dark' ? 0.04 : 0.02), 0.04, 0.99),
    c: primaryLch.c * 0.95,
    h: (primaryLch.h + 38) % 360,
  });

  const tokens = {
    '--primary': primary,
    '--primary-dark': primaryDark,
    '--primary-light': primaryLight,
    '--primary-rgb': toRgbString(primary),
    '--primary-hover': withAlpha(primary, recipe.hoverAlpha),
    '--primary-soft': soft,
    '--primary-tint': tint,
    '--primary-border': border,
    '--primary-subtle': subtle,
    // Text drawn *on* the accent fill: always white vs. a near-black, never the
    // theme's own ink, or the dark theme would put white on a bright accent.
    '--primary-contrast': onPrimary,
    '--on-primary': onPrimary,
    '--focus-ring': withAlpha(primary, recipe.ringAlpha),
    '--secondary': secondary,
    '--accent-seed': seed,
  };

  derivationCache.set(cacheKey, tokens);
  return tokens;
}

/** Both themes at once — what we cache so the pre-React boot script can apply it. */
export function buildAccentTokenCache(seedHex) {
  return {
    seed: normalizeHex(seedHex) || ACCENT_PRESETS[0].seed,
    light: deriveAccentTokens(seedHex, 'light'),
    dark: deriveAccentTokens(seedHex, 'dark'),
  };
}

/** Resolve a stored accent id (+ custom colour) to the seed we should derive from. */
export function resolveAccentSeed(accentId, customColor) {
  if (accentId === CUSTOM_ACCENT_ID) {
    return normalizeHex(customColor) || DEFAULT_CUSTOM_ACCENT;
  }
  const preset = ACCENT_PRESETS.find((entry) => entry.id === accentId);
  return preset ? preset.seed : ACCENT_PRESETS.find((entry) => entry.id === DEFAULT_ACCENT_ID).seed;
}

/** The swatch colour to show for a preset in a given theme (what it'll look like). */
export function previewColor(seedHex, theme = 'light') {
  return deriveAccentTokens(seedHex, theme)['--primary'];
}

/** Write a derived token map onto the document root. */
export function applyAccentTokens(tokens, root = globalThis.document?.documentElement) {
  if (!root || !tokens) return;
  for (const [token, value] of Object.entries(tokens)) {
    root.style.setProperty(token, value);
  }
}

export { normalizeHex };
