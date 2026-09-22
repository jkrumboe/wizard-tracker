/*
 * Perceptual colour helpers (OKLab / OKLCH).
 *
 * The accent system derives a whole ramp from a single seed colour. Doing that
 * in sRGB makes some hues (yellow, cyan) come out far brighter than others at
 * the same nominal step, so every derivation goes through OKLCH where a given
 * lightness looks like the same lightness regardless of hue. Out-of-gamut
 * results are pulled back by reducing chroma, which keeps the hue intact.
 */

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

/** "#abc" / "#aabbcc" -> [r, g, b] in 0..1. Returns null when unparseable. */
export function parseHex(hex) {
  if (typeof hex !== 'string') return null;
  let value = hex.trim().replace(/^#/, '');
  if (value.length === 3) {
    value = value.split('').map((char) => char + char).join('');
  }
  if (!/^[0-9a-fA-F]{6}$/.test(value)) return null;
  const int = Number.parseInt(value, 16);
  return [(int >> 16) & 255, (int >> 8) & 255, int & 255].map((channel) => channel / 255);
}

/** [r, g, b] in 0..1 -> "#rrggbb". */
export function toHex(rgb) {
  return `#${rgb
    .map((channel) => Math.round(clamp(channel, 0, 1) * 255).toString(16).padStart(2, '0'))
    .join('')}`;
}

/** true when the string is a colour we can derive a ramp from. */
export function isValidHex(hex) {
  return parseHex(hex) !== null;
}

/** Normalise any accepted hex spelling to the "#rrggbb" form we persist. */
export function normalizeHex(hex) {
  const rgb = parseHex(hex);
  return rgb ? toHex(rgb) : null;
}

const srgbToLinear = (channel) =>
  channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;

const linearToSrgb = (channel) =>
  channel <= 0.0031308 ? channel * 12.92 : 1.055 * channel ** (1 / 2.4) - 0.055;

function rgbToOklab([r, g, b]) {
  const lr = srgbToLinear(r);
  const lg = srgbToLinear(g);
  const lb = srgbToLinear(b);

  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);

  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

function oklabToRgb([L, a, b]) {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;

  return [
    linearToSrgb(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    linearToSrgb(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    linearToSrgb(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
  ];
}

/** "#rrggbb" -> { l: 0..1, c: 0..~0.4, h: degrees }. */
export function hexToOklch(hex) {
  const rgb = parseHex(hex);
  if (!rgb) return null;
  const [L, a, b] = rgbToOklab(rgb);
  const c = Math.hypot(a, b);
  let h = (Math.atan2(b, a) * 180) / Math.PI;
  if (h < 0) h += 360;
  return { l: L, c, h };
}

function oklchToRgbRaw({ l, c, h }) {
  const radians = (h * Math.PI) / 180;
  return oklabToRgb([l, Math.cos(radians) * c, Math.sin(radians) * c]);
}

const inGamut = (rgb) => rgb.every((channel) => channel >= -0.0005 && channel <= 1.0005);

/**
 * OKLCH -> "#rrggbb". Colours outside sRGB keep their hue and lightness and
 * give up chroma instead, which is what a designer would do by hand.
 */
export function oklchToHex({ l, c, h }) {
  const lightness = clamp(l, 0, 1);
  const chroma = Math.max(c, 0);
  if (inGamut(oklchToRgbRaw({ l: lightness, c: chroma, h }))) {
    return toHex(oklchToRgbRaw({ l: lightness, c: chroma, h }));
  }

  let low = 0;
  let high = chroma;
  for (let i = 0; i < 18; i += 1) {
    const mid = (low + high) / 2;
    if (inGamut(oklchToRgbRaw({ l: lightness, c: mid, h }))) {
      low = mid;
    } else {
      high = mid;
    }
  }
  return toHex(oklchToRgbRaw({ l: lightness, c: low, h }));
}

/** WCAG relative luminance for a hex colour. */
export function relativeLuminance(hex) {
  const rgb = parseHex(hex);
  if (!rgb) return 0;
  const [r, g, b] = rgb.map(srgbToLinear);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio between two hex colours (1..21). */
export function contrastRatio(hexA, hexB) {
  const a = relativeLuminance(hexA);
  const b = relativeLuminance(hexB);
  const lighter = Math.max(a, b);
  const darker = Math.min(a, b);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Darken (or lighten) until the colour clears `minRatio` against `against`.
 * Used so a user-picked accent stays readable on whichever surface it sits on
 * instead of trusting them to pick something with enough contrast.
 */
export function ensureContrast(hex, against, minRatio, direction = 'auto') {
  const lch = hexToOklch(hex);
  if (!lch) return hex;

  const backgroundIsLight = relativeLuminance(against) > 0.18;
  const step = direction === 'auto' ? (backgroundIsLight ? -0.02 : 0.02) : direction === 'darker' ? -0.02 : 0.02;

  let current = { ...lch };
  let candidate = oklchToHex(current);
  for (let i = 0; i < 40; i += 1) {
    if (contrastRatio(candidate, against) >= minRatio) break;
    const next = clamp(current.l + step, 0.05, 0.98);
    if (next === current.l) break;
    current = { ...current, l: next };
    candidate = oklchToHex(current);
  }
  return candidate;
}

/** "r, g, b" — for the `rgba(var(--x-rgb), a)` pattern already used in the app. */
export function toRgbString(hex) {
  const rgb = parseHex(hex);
  if (!rgb) return '0, 0, 0';
  return rgb.map((channel) => Math.round(channel * 255)).join(', ');
}

/** Same colour with an alpha channel, as an `rgba()` string. */
export function withAlpha(hex, alpha) {
  return `rgba(${toRgbString(hex)}, ${alpha})`;
}

/** Whichever of `light` / `dark` reads better on top of `hex`. */
export function readableTextOn(hex, light = '#ffffff', dark = '#111827') {
  return contrastRatio(hex, light) >= contrastRatio(hex, dark) ? light : dark;
}

/** Shift a colour along the hue wheel while keeping lightness and chroma. */
export function rotateHue(hex, degrees) {
  const lch = hexToOklch(hex);
  if (!lch) return hex;
  return oklchToHex({ ...lch, h: (lch.h + degrees + 360) % 360 });
}

export { clamp };
