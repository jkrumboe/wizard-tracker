/**
 * Ratchet on the stylesheet's desktop-first debt.
 *
 * The styles are being moved to mobile-first: base rules describe the phone,
 * and `min-width` layers add to them at three shared breakpoints. For every
 * stylesheet this test counts
 *
 *   - maxWidth:     `max-width` media queries (desktop-first overrides),
 *   - nonStandard:  width breakpoints other than the shared ones,
 *   - important:    `!important` declarations,
 *
 * and fails if any count rises above the baseline in cssDebt.baseline.json.
 * Files missing from the baseline must be at zero. It also fails when a count
 * drops, so the baseline is lowered in the same change that paid the debt
 * off and cannot quietly creep back up.
 *
 * Regenerate the baseline after converting a file:
 *   UPDATE_CSS_DEBT=1 npx vitest run src/styles/__tests__/cssDebt.test.js
 */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import process from 'node:process';
import { describe, it, expect } from 'vitest';

/** Shared breakpoints: phone base, then sm / md / lg layers. */
export const BREAKPOINTS = { sm: 600, md: 768, lg: 1024 };

const STANDARD_MIN = new Set(Object.values(BREAKPOINTS));
// A max-width is only standard as the exact complement of a min-width tier.
const STANDARD_MAX = new Set(Object.values(BREAKPOINTS).map((px) => px - 1));

const here = dirname(fileURLToPath(import.meta.url));
const stylesDir = join(here, '..');
const baselinePath = join(here, 'cssDebt.baseline.json');

const listCss = (dir) =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === '__tests__' ? [] : listCss(path);
    return entry.name.endsWith('.css') ? [path] : [];
  });

/** Counts the debt in one stylesheet's source. */
export function measureCss(source) {
  const css = source.replace(/\/\*[\s\S]*?\*\//g, '');
  const counts = { maxWidth: 0, nonStandard: 0, important: 0 };

  for (const [, prelude] of css.matchAll(/@media([^{]*)\{/g)) {
    if (/max-width/.test(prelude)) counts.maxWidth++;
    for (const [, kind, px] of prelude.matchAll(/(min|max)-width\s*:\s*(\d+)px/g)) {
      const allowed = kind === 'min' ? STANDARD_MIN : STANDARD_MAX;
      if (!allowed.has(Number(px))) counts.nonStandard++;
    }
  }
  counts.important = (css.match(/!\s*important/g) || []).length;
  return counts;
}

function measureAll() {
  const result = {};
  for (const file of listCss(stylesDir).sort()) {
    const counts = measureCss(readFileSync(file, 'utf8'));
    if (counts.maxWidth || counts.nonStandard || counts.important) {
      result[relative(stylesDir, file).split('\\').join('/')] = counts;
    }
  }
  return result;
}

describe('measureCss', () => {
  it('counts max-width queries, off-scale breakpoints and !important', () => {
    const css = `
      /* @media (max-width: 123px) { a { color: red !important; } } */
      @media (max-width: 767px) { a { color: red !important; } }
      @media (min-width: 820px) { a { color: blue; } }
      @media (min-width: 600px) and (max-width: 1023px) { a { color: green; } }
      @media (hover: hover) { a:hover { color: red; } }
    `;
    expect(measureCss(css)).toEqual({ maxWidth: 2, nonStandard: 1, important: 1 });
  });
});

describe('stylesheet debt ratchet', () => {
  const actual = measureAll();

  if (process.env.UPDATE_CSS_DEBT) {
    writeFileSync(baselinePath, `${JSON.stringify(actual, null, 2)}\n`);
  }

  const baseline = JSON.parse(readFileSync(baselinePath, 'utf8'));

  it('adds no new desktop-first debt', () => {
    const grown = [];
    for (const [file, counts] of Object.entries(actual)) {
      const allowed = baseline[file] || { maxWidth: 0, nonStandard: 0, important: 0 };
      for (const key of Object.keys(counts)) {
        if (counts[key] > allowed[key]) grown.push(`${file}: ${key} ${allowed[key]} -> ${counts[key]}`);
      }
    }
    expect(grown, 'Use min-width at 600/768/1024px and avoid !important').toEqual([]);
  });

  it('keeps the baseline tight once debt is paid off', () => {
    const paid = [];
    for (const [file, allowed] of Object.entries(baseline)) {
      const counts = actual[file] || { maxWidth: 0, nonStandard: 0, important: 0 };
      for (const key of Object.keys(allowed)) {
        if (counts[key] < allowed[key]) paid.push(`${file}: ${key} ${allowed[key]} -> ${counts[key]}`);
      }
    }
    expect(paid, 'Lower the baseline: UPDATE_CSS_DEBT=1 npx vitest run src/styles/__tests__/cssDebt.test.js').toEqual([]);
  });
});
