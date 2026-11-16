/**
 * Template Suggestion Service
 *
 * Users propose three kinds of template work and admins review them:
 * - 'new'    a user's own template becomes a system template
 * - 'change' edits to a system template (or a built-in one)
 * - 'boxArt' new box art for a system template
 *
 * A change request carries the whole edit form, so applying it blindly would
 * also roll back anything that changed on the template after the request was
 * made (box art approved in between, another change request). Change requests
 * therefore store a `baseline` - the template's fields when the request was
 * made - and approval applies only the fields the user actually changed.
 * Requests made before baselines existed apply every field except box art.
 *
 * Review is claimed atomically (pending -> approved/rejected in one update), so
 * two admins reviewing at once can't apply the same suggestion twice.
 */
const mongoose = require('mongoose');
const SystemGameTemplate = require('../models/SystemGameTemplate');
const UserGameTemplate = require('../models/UserGameTemplate');
const TemplateSuggestion = require('../models/TemplateSuggestion');
const { BUILTIN_SYSTEM_TEMPLATES, getBuiltinSystemTemplateById } = require('./builtinSystemTemplates');
const { sanitizeGameInfo } = require('./gameInfo');

const STATUSES = ['pending', 'approved', 'rejected'];
const MAX_REVIEW_NOTE_LENGTH = 500;
const HISTORY_LIMIT = 100;

// Every template field a change request can touch, in display order
const CHANGE_FIELDS = [
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

// Legacy change requests have no baseline; their gameInfo is a snapshot that
// would undo later box art approvals, so it is left alone
const LEGACY_CHANGE_FIELDS = CHANGE_FIELDS.filter((field) => field !== 'gameInfo');

const ORIGINAL_TEMPLATE_FIELDS = [...CHANGE_FIELDS, 'barcodes'].join(' ');

class SuggestionReviewError extends Error {
  constructor(message, status = 400, details = {}) {
    super(message);
    this.name = 'SuggestionReviewError';
    this.status = status;
    Object.assign(this, details);
  }
}

const toPlain = (doc) => (doc && typeof doc.toObject === 'function' ? doc.toObject() : doc);

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Comparable form of a field value: null, undefined and '' are all "empty",
 * object keys are sorted and empty entries dropped.
 */
const canonical = (value) => {
  if (value === undefined || value === null || value === '') return null;
  if (Array.isArray(value)) return value.map(canonical);
  if (value instanceof Date) return value.toISOString();
  if (value instanceof mongoose.Types.ObjectId) return String(value);
  if (typeof value === 'object') {
    const entries = Object.keys(value)
      .sort()
      .map((key) => [key, canonical(value[key])])
      .filter(([, entry]) => entry !== null);
    return entries.length > 0 ? Object.fromEntries(entries) : null;
  }
  return value;
};

const sameValue = (a, b) => JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));

/** A template's change-request fields as plain values. */
const snapshotTemplate = (template) => {
  const plain = toPlain(template) || {};
  return Object.fromEntries(CHANGE_FIELDS.map((field) => {
    if (field === 'gameInfo') return [field, sanitizeGameInfo(plain.gameInfo) || null];
    if (field === 'scoringFormula') return [field, canonical(plain.scoringFormula)];
    return [field, plain[field] ?? null];
  }));
};

/** Fields a change request actually changes relative to its baseline. */
const changedFields = (suggestion) => {
  const plain = toPlain(suggestion);
  if (!plain?.baseline) return [...LEGACY_CHANGE_FIELDS];
  return CHANGE_FIELDS.filter((field) => !sameValue(plain[field], plain.baseline[field]));
};

/**
 * A system template by Mongo id or built-in id. Built-ins the server hasn't
 * stored yet come back as an unsaved document.
 * @param {string} id
 * @param {string} userId - Recorded as creator when a built-in is first stored
 * @returns {Promise<Object|null>}
 */
const findSystemTemplate = async (id, userId) => {
  if (mongoose.Types.ObjectId.isValid(id)) {
    const stored = await SystemGameTemplate.findById(id);
    if (stored) return stored;
  }
  const builtin = getBuiltinSystemTemplateById(id);
  if (!builtin) return null;
  // The built-in's '__builtin_x__' id isn't an ObjectId and would fail to save
  const { _id: builtinId, isBuiltin, ...fields } = builtin;
  return await SystemGameTemplate.findOne({ name: builtin.name })
    || new SystemGameTemplate({ ...fields, createdBy: userId, isActive: true });
};

/**
 * A system template (stored or built-in) whose name matches, ignoring case.
 * @param {string} name
 * @returns {Promise<{_id: string, name: string}|null>}
 */
const findTemplateNamed = async (name) => {
  const wanted = String(name || '').trim();
  if (!wanted) return null;
  const stored = await SystemGameTemplate.findOne({
    name: new RegExp(`^${escapeRegex(wanted)}$`, 'i'),
    isActive: { $ne: false },
  }).select('name').lean();
  if (stored) return { _id: String(stored._id), name: stored.name };
  const builtin = BUILTIN_SYSTEM_TEMPLATES.find((template) => template.name.toLowerCase() === wanted.toLowerCase());
  return builtin ? { _id: builtin._id, name: builtin.name } : null;
};

/** The template a change or box art suggestion targets, as it is right now. */
const currentTemplateFor = async (suggestion) => {
  if (suggestion.systemTemplateId && typeof suggestion.systemTemplateId === 'object' && suggestion.systemTemplateId.name) {
    return suggestion.systemTemplateId;
  }
  const builtin = getBuiltinSystemTemplateById(suggestion.builtinTemplateId);
  if (!builtin) return null;
  // An approved change stores the built-in, after which the stored copy is the truth
  const stored = await SystemGameTemplate.findOne({ name: builtin.name }).select(ORIGINAL_TEMPLATE_FIELDS).lean();
  return stored || builtin;
};

const normaliseReviewNote = (note) => (typeof note === 'string' ? note.trim().slice(0, MAX_REVIEW_NOTE_LENGTH) : '');

/**
 * Suggestions for the review queue, with the template they target and a
 * duplicate-name hint for new templates.
 * @param {Object} [options]
 * @param {'pending'|'approved'|'rejected'|'all'} [options.status='pending']
 * @returns {Promise<{suggestions: Object[], counts: Object}>}
 */
const listSuggestions = async ({ status = 'pending' } = {}) => {
  const filter = STATUSES.includes(status) ? { status } : {};
  const isQueue = status === 'pending';

  let query = TemplateSuggestion.find(filter)
    .populate('userId', 'username')
    .populate('reviewedBy', 'username')
    .populate('systemTemplateId', ORIGINAL_TEMPLATE_FIELDS)
    // The queue is worked oldest first; history reads newest first
    .sort(isQueue ? { createdAt: 1 } : { reviewedAt: -1, updatedAt: -1 });
  if (!isQueue) query = query.limit(HISTORY_LIMIT);

  const [suggestions, countRows] = await Promise.all([
    query,
    TemplateSuggestion.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
  ]);

  const hydrated = await Promise.all(suggestions.map(async (suggestion) => {
    const plain = suggestion.toObject();
    if (plain.suggestionType === 'change' || plain.suggestionType === 'boxArt') {
      plain.originalTemplate = await currentTemplateFor(plain);
    } else if (plain.status === 'pending') {
      plain.duplicateOf = await findTemplateNamed(plain.name);
    }
    if (plain.suggestionType === 'change') {
      plain.changedFields = changedFields(plain);
    }
    return plain;
  }));

  const counts = Object.fromEntries(STATUSES.map((key) => [key, 0]));
  countRows.forEach(({ _id, count }) => {
    if (_id in counts) counts[_id] = count;
  });

  return { suggestions: hydrated, counts };
};

const valueForTemplate = (suggestion, field) => {
  if (field === 'gameInfo') return sanitizeGameInfo(suggestion.gameInfo);
  if (field === 'scoringFormula') return toPlain(suggestion).scoringFormula || null;
  if (field === 'name') return String(suggestion.name || '').trim();
  return suggestion[field] ?? null;
};

const applyBoxArt = async (suggestion) => {
  const systemTemplate = suggestion.systemTemplateId
    ? await SystemGameTemplate.findById(suggestion.systemTemplateId)
    : await findSystemTemplate(suggestion.builtinTemplateId, suggestion.userId);
  if (!systemTemplate) throw new SuggestionReviewError('System template not found', 404);
  systemTemplate.gameInfo = sanitizeGameInfo(suggestion.gameInfo);
  await systemTemplate.save();
  return { template: systemTemplate, appliedFields: ['gameInfo'] };
};

const applyChange = async (suggestion) => {
  const systemTemplate = suggestion.systemTemplateId
    ? await SystemGameTemplate.findById(suggestion.systemTemplateId)
    : await findSystemTemplate(suggestion.builtinTemplateId, suggestion.userId);
  if (!systemTemplate) {
    throw new SuggestionReviewError('The template this change was suggested for no longer exists', 404);
  }

  const appliedFields = changedFields(suggestion);
  appliedFields.forEach((field) => {
    systemTemplate[field] = valueForTemplate(suggestion, field);
  });
  await systemTemplate.save();
  return { template: systemTemplate, appliedFields };
};

const applyNew = async (suggestion, { allowDuplicate }) => {
  const duplicate = await findTemplateNamed(suggestion.name);
  if (duplicate && !allowDuplicate) {
    throw new SuggestionReviewError(
      `A system template named "${duplicate.name}" already exists`,
      409,
      { code: 'DUPLICATE_NAME', duplicateOf: duplicate }
    );
  }

  const template = new SystemGameTemplate({
    ...Object.fromEntries(CHANGE_FIELDS.map((field) => [field, valueForTemplate(suggestion, field)])),
    gameCategory: suggestion.gameCategory || 'table',
    hasDealerRotation: suggestion.hasDealerRotation !== false,
    hasForbiddenCall: suggestion.hasForbiddenCall !== false,
    descriptionMarkdown: suggestion.descriptionMarkdown || '',
    createdBy: suggestion.userId,
    isActive: true,
  });
  await template.save();

  if (suggestion.userTemplateId) {
    await UserGameTemplate.findByIdAndUpdate(suggestion.userTemplateId, {
      approvedAsSystemTemplate: true,
      systemTemplateId: template._id,
    });
  }
  return { template, appliedFields: CHANGE_FIELDS.filter((field) => valueForTemplate(suggestion, field) !== null) };
};

/**
 * Approve a pending suggestion and apply it to the system templates.
 * @param {string} id
 * @param {Object} reviewer - The admin user
 * @param {Object} [options]
 * @param {string} [options.reviewNote]
 * @param {boolean} [options.allowDuplicate] - Add a new template even if one has that name
 * @returns {Promise<{suggestion: Object, template: Object, appliedFields: string[]}>}
 */
const approveSuggestion = async (id, reviewer, { reviewNote, allowDuplicate = false } = {}) => {
  const pending = await TemplateSuggestion.findOne({ _id: id, status: 'pending' });
  if (!pending) throw new SuggestionReviewError('Suggestion not found or already reviewed', 404);

  // Checked before claiming, so a refused duplicate stays in the queue
  if (pending.suggestionType === 'new' && !allowDuplicate) {
    const duplicate = await findTemplateNamed(pending.name);
    if (duplicate) {
      throw new SuggestionReviewError(
        `A system template named "${duplicate.name}" already exists`,
        409,
        { code: 'DUPLICATE_NAME', duplicateOf: duplicate }
      );
    }
  }

  const claimed = await TemplateSuggestion.findOneAndUpdate(
    { _id: id, status: 'pending' },
    {
      $set: {
        status: 'approved',
        reviewedAt: new Date(),
        reviewedBy: reviewer._id,
        reviewNote: normaliseReviewNote(reviewNote),
      },
    },
    { new: true }
  );
  if (!claimed) throw new SuggestionReviewError('Suggestion not found or already reviewed', 404);

  try {
    let result;
    if (claimed.suggestionType === 'boxArt') result = await applyBoxArt(claimed);
    else if (claimed.suggestionType === 'change') result = await applyChange(claimed);
    else result = await applyNew(claimed, { allowDuplicate });
    return { suggestion: claimed, ...result };
  } catch (error) {
    // Nothing was applied, so the suggestion goes back into the queue
    await TemplateSuggestion.updateOne(
      { _id: id },
      { $set: { status: 'pending', reviewedAt: null, reviewedBy: null, reviewNote: '' } }
    );
    throw error;
  }
};

/**
 * Reject a pending suggestion, keeping it (and the reason) for the history.
 * @param {string} id
 * @param {Object} reviewer - The admin user
 * @param {string} [reviewNote]
 * @returns {Promise<Object>} The rejected suggestion
 */
const rejectSuggestion = async (id, reviewer, reviewNote) => {
  const rejected = await TemplateSuggestion.findOneAndUpdate(
    { _id: id, status: 'pending' },
    {
      $set: {
        status: 'rejected',
        reviewedAt: new Date(),
        reviewedBy: reviewer._id,
        reviewNote: normaliseReviewNote(reviewNote),
      },
    },
    { new: true }
  );
  if (!rejected) throw new SuggestionReviewError('Suggestion not found or already reviewed', 404);
  return rejected;
};

const finiteOrNull = (value) => (typeof value === 'number' && Number.isFinite(value) ? value : null);
const textOrEmpty = (value, max) => (typeof value === 'string' ? value.slice(0, max) : '');

/**
 * The template copy a client uploads with a table game, reduced to known
 * template fields with sane types and lengths. Null when there is nothing usable.
 * @param {*} input
 * @returns {Object|null}
 */
const sanitizeTemplateSnapshot = (input) => {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
  const name = textOrEmpty(input.name, 100).trim();
  if (!name) return null;
  const formula = input.scoringFormula && typeof input.scoringFormula === 'object'
    ? {
      baseCorrect: finiteOrNull(input.scoringFormula.baseCorrect),
      bonusPerTrick: finiteOrNull(input.scoringFormula.bonusPerTrick),
      penaltyPerDiff: finiteOrNull(input.scoringFormula.penaltyPerDiff),
    }
    : null;
  return {
    name,
    targetNumber: finiteOrNull(input.targetNumber),
    lowIsBetter: input.lowIsBetter === true,
    gameCategory: ['table', 'callAndMade'].includes(input.gameCategory) ? input.gameCategory : 'table',
    scoringFormula: formula && Object.values(formula).some((value) => value !== null) ? formula : null,
    roundPattern: ['pyramid', 'ascending', 'fixed'].includes(input.roundPattern) ? input.roundPattern : null,
    maxRounds: finiteOrNull(input.maxRounds),
    minPlayers: finiteOrNull(input.minPlayers),
    maxPlayers: finiteOrNull(input.maxPlayers),
    hasDealerRotation: input.hasDealerRotation !== false,
    hasForbiddenCall: input.hasForbiddenCall !== false,
    description: textOrEmpty(input.description, 5000),
    descriptionMarkdown: textOrEmpty(input.descriptionMarkdown, 7500),
    gameInfo: sanitizeGameInfo(input.gameInfo) || null,
  };
};

/**
 * Make the game a played table game belongs to available to everyone, without
 * the player who created it having to suggest it. Settings come from, in order:
 * the template copy uploaded with the game (what was actually played), the
 * player's cloud template (the uploader's first, then anyone's with the same
 * name), or the game's own scoring settings. Recorded as an approved
 * suggestion by the template's creator so it shows in the review history.
 * @param {string} gameId - TableGame _id or the client's localId
 * @param {Object} admin - The admin user
 * @returns {Promise<{template: Object, source: 'gameSnapshot'|'userTemplate'|'game'}>}
 */
const publishFromGame = async (gameId, admin) => {
  const TableGame = require('../models/TableGame');
  const id = String(gameId || '');
  const game = mongoose.Types.ObjectId.isValid(id)
    ? await TableGame.findById(id)
    : await TableGame.findOne({ localId: { $eq: id } });
  if (!game) throw new SuggestionReviewError('Game not found', 404);

  const gameData = toPlain(game).gameData?.gameData || toPlain(game).gameData || {};
  const name = String(game.gameTypeName || game.name || gameData.gameName || '').trim();
  if (!name) throw new SuggestionReviewError('This game has no name to publish', 400);

  const duplicate = await findTemplateNamed(name);
  if (duplicate) {
    throw new SuggestionReviewError(
      `"${duplicate.name}" is already available to everyone`,
      409,
      { code: 'DUPLICATE_NAME', duplicateOf: duplicate }
    );
  }

  const sameName = { name: new RegExp(`^${escapeRegex(name)}$`, 'i') };
  const userTemplate = (game.userId && await UserGameTemplate.findOne({ ...sameName, userId: game.userId }))
    || await UserGameTemplate.findOne(sameName).sort({ updatedAt: -1 });

  const snapshot = sanitizeTemplateSnapshot(gameData.templateSnapshot);
  const templateSource = snapshot || userTemplate;
  let source = 'game';
  if (snapshot) source = 'gameSnapshot';
  else if (userTemplate) source = 'userTemplate';

  const fields = templateSource
    ? Object.fromEntries(CHANGE_FIELDS.map((field) => [field, valueForTemplate(templateSource, field)]))
    : {
      name,
      targetNumber: game.targetNumber ?? gameData.targetNumber ?? null,
      lowIsBetter: Boolean(game.lowIsBetter ?? gameData.lowIsBetter),
    };
  fields.name = name;

  const creatorId = userTemplate?.userId || game.userId || admin._id;
  const template = new SystemGameTemplate({
    ...fields,
    gameCategory: fields.gameCategory || 'table',
    hasDealerRotation: fields.hasDealerRotation !== false,
    hasForbiddenCall: fields.hasForbiddenCall !== false,
    descriptionMarkdown: fields.descriptionMarkdown || '',
    createdBy: creatorId,
    isActive: true,
  });
  await template.save();

  if (userTemplate) {
    userTemplate.approvedAsSystemTemplate = true;
    userTemplate.systemTemplateId = template._id;
    await userTemplate.save();
  }

  await TemplateSuggestion.create({
    ...fields,
    userId: creatorId,
    userTemplateId: userTemplate?._id || null,
    systemTemplateId: template._id,
    suggestionType: 'new',
    status: 'approved',
    reviewedAt: new Date(),
    reviewedBy: admin._id,
    reviewNote: 'Published by admin from a played game',
  });

  return { template, source };
};

module.exports = {
  CHANGE_FIELDS,
  STATUSES,
  SuggestionReviewError,
  approveSuggestion,
  canonical,
  changedFields,
  findSystemTemplate,
  findTemplateNamed,
  listSuggestions,
  publishFromGame,
  rejectSuggestion,
  sameValue,
  sanitizeTemplateSnapshot,
  snapshotTemplate,
};
