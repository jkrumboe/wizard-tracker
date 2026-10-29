/*
 * What a template suggestion would change, for the review screen. Mirrors
 * backend/utils/templateSuggestionService.js: a change request is compared with
 * its `baseline` (the template when the request was made), and approval applies
 * only the fields that differ from it.
 */

export const CHANGE_FIELDS = [
  'name',
  'targetNumber',
  'lowIsBetter',
  'gameCategory',
  'scoringFormula',
  'roundPattern',
  'maxRounds',
  'minPlayers',
  'maxPlayers',
  'hasDealerRotation',
  'hasForbiddenCall',
  'description',
  'descriptionMarkdown',
  'gameInfo',
];

/** Comparable form of a value: null, undefined and '' are all empty, object keys sorted. */
export function canonical(value) {
  if (value === undefined || value === null || value === '') return null;
  if (Array.isArray(value)) return value.map(canonical);
  if (typeof value === 'object') {
    const entries = Object.keys(value)
      .sort()
      .map(key => [key, canonical(value[key])])
      .filter(([, entry]) => entry !== null);
    return entries.length > 0 ? Object.fromEntries(entries) : null;
  }
  return value;
}

export const sameValue = (a, b) => JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));

/** Box art is the same picture when the BGG game (or, without one, the image) matches. */
export function sameBoxArt(a, b) {
  if (a?.bggId || b?.bggId) return (a?.bggId ?? null) === (b?.bggId ?? null);
  return (a?.imageUrl || a?.thumbnailUrl || null) === (b?.imageUrl || b?.thumbnailUrl || null);
}

/**
 * The field changes of a change request.
 * @param {Object} suggestion - As returned by GET /admin/suggestions
 * @returns {{changes: Array<{field: string, before: *, after: *, current: *, conflict: boolean}>,
 *   hasBaseline: boolean, changedSinceRequest: string[]}}
 *   `conflict`: the template changed this field since the request was made, to
 *   something else than the request; approving overwrites that newer value.
 *   `changedSinceRequest`: other fields that changed meanwhile and are kept.
 */
export function describeChange(suggestion) {
  const baseline = suggestion?.baseline || null;
  const current = suggestion?.originalTemplate || null;
  const before = baseline || current || {};

  const candidates = suggestion?.changedFields
    || CHANGE_FIELDS.filter(field => !sameValue(suggestion?.[field], before[field]));

  const changes = candidates
    .filter(field => !sameValue(suggestion[field], before[field]))
    .map(field => ({
      field,
      before: before[field] ?? null,
      after: suggestion[field] ?? null,
      current: current ? current[field] ?? null : null,
      conflict: Boolean(
        baseline && current
        && !sameValue(current[field], baseline[field])
        && !sameValue(current[field], suggestion[field])
      ),
    }));

  const changedFields = new Set(changes.map(change => change.field));
  const changedSinceRequest = baseline && current
    ? CHANGE_FIELDS.filter(field => !changedFields.has(field) && !sameValue(current[field], baseline[field]))
    : [];

  return { changes, hasBaseline: Boolean(baseline), changedSinceRequest };
}

/** Pending suggestions that target the same template as this one (other users' requests). */
export function siblingsOf(suggestion, suggestions) {
  const target = templateKey(suggestion);
  if (!target) return [];
  return suggestions.filter(other => other._id !== suggestion._id && templateKey(other) === target);
}

function templateKey(suggestion) {
  if (suggestion.suggestionType === 'new') return null;
  const id = suggestion.systemTemplateId?._id || suggestion.systemTemplateId || suggestion.builtinTemplateId;
  return id ? String(id) : null;
}
