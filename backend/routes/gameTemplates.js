const express = require('express');
const mongoose = require('mongoose');
const SystemGameTemplate = require('../models/SystemGameTemplate');
const UserGameTemplate = require('../models/UserGameTemplate');
const TemplateSuggestion = require('../models/TemplateSuggestion');
const auth = require('../middleware/auth');
const catchAsync = require('../utils/catchAsync');
const { getBuiltinSystemTemplateById } = require('../utils/builtinSystemTemplates');
const {
  SuggestionReviewError,
  approveSuggestion,
  findSystemTemplate,
  listSuggestions,
  rejectSuggestion,
  snapshotTemplate,
} = require('../utils/templateSuggestionService');
const { BGG_API_TOKEN, fetchBggXml, fetchBggThingXml } = require('../utils/bggClient');
const {
  sanitizeGameInfo,
  pickGameUpcBggItem,
  listGameUpcCandidates,
  parseBggThing,
  parseBggThings,
  parseBggSearch,
  rankGameSearchResults,
} = require('../utils/gameInfo');

const router = express.Router();

// Mongoose returns a nested-document wrapper (not null) for an unset nested
// path, which fails to cast when copied into another model. Read the plain value.
const getScoringFormula = (template) => {
  if (!template) return null;
  const plain = typeof template.toObject === 'function' ? template.toObject() : template;
  return plain.scoringFormula || null;
};

// Middleware to check admin role
const BARCODE_PATTERN = /^\d{8,14}$/;

// Normalize a barcode list: trim, dedupe, and reject anything that isn't an EAN/UPC
const normalizeBarcodes = (barcodes) => {
  if (!Array.isArray(barcodes)) return null;
  const cleaned = [...new Set(barcodes.map((code) => String(code).trim()))];
  return cleaned.every((code) => BARCODE_PATTERN.test(code)) ? cleaned : null;
};

const requireAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};

// GET /api/game-templates/public - Get public system templates (no auth required)
router.get('/public', catchAsync(async (req, res) => {
  const systemTemplates = await SystemGameTemplate.find({ isActive: true })
    .select('_id name targetNumber lowIsBetter gameCategory scoringFormula roundPattern maxRounds minPlayers maxPlayers hasDealerRotation hasForbiddenCall usageCount description descriptionMarkdown barcodes gameInfo createdBy createdAt updatedAt')
    .sort({ name: 1 });

  res.json({ 
    templates: systemTemplates.map(t => ({ ...t.toObject(), type: 'system', isPublic: true }))
  });
}));

// Product info by barcode, cached so repeat scans don't burn the lookup quotas
const BARCODE_LOOKUP_TTL_MS = 24 * 60 * 60 * 1000;
const barcodeLookupCache = new Map();

// GameUPC's public demo key works on its test API; set GAMEUPC_API_KEY
// (request one from the GameUPC author) to use the production API instead
const GAMEUPC_BASE_URL = process.env.GAMEUPC_API_KEY
  ? 'https://api.gameupc.com/v1'
  : 'https://api.gameupc.com/test';
const GAMEUPC_API_KEY = process.env.GAMEUPC_API_KEY || 'test_test_test_test_test';

// Each source resolves to { title, names, gameInfo, verified, candidates } or null (not found),
// or throws (unavailable/rate limited). `names` are clean game names that can be matched exactly
// against template names; `candidates` are the games the barcode could be when it isn't verified.
const BARCODE_SOURCES = [
  // GameUPC: crowdsourced board game barcodes linked to BoardGameGeek, covers European boxes
  async (code) => {
    const response = await fetch(`${GAMEUPC_BASE_URL}/upc/${encodeURIComponent(code)}`, {
      headers: { Accept: 'application/json', 'x-api-key': GAMEUPC_API_KEY },
      signal: AbortSignal.timeout(5000),
    });
    if (response.status === 404) return null;
    if (!response.ok) throw new Error(`GameUPC responded ${response.status}`);
    const data = await response.json();
    // Only trust BGG matches once the community verified them; otherwise they're just search hits
    const verified = data?.bgg_info_status === 'verified';
    const bggNames = verified
      ? (data.bgg_info || []).map((item) => item.name)
      : [];
    const names = [...new Set([data?.name, ...bggNames].filter(Boolean))];
    if (!names.length) return null;
    const bggItem = pickGameUpcBggItem(data);
    const gameInfo = bggItem ? sanitizeGameInfo({
      bggId: bggItem.id,
      imageUrl: bggItem.image_url,
      thumbnailUrl: bggItem.thumbnail_url,
      yearPublished: bggItem.published,
    }) : null;
    return { title: names[0], names, gameInfo, verified, candidates: listGameUpcCandidates(data) };
  },
  // UPCitemdb free trial: no key needed, ~100 lookups/day per IP, broad but noisy titles
  async (code) => {
    const response = await fetch(`https://api.upcitemdb.com/prod/trial/lookup?upc=${encodeURIComponent(code)}`, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) throw new Error(`UPCitemdb responded ${response.status}`);
    const data = await response.json();
    const title = data?.items?.[0]?.title;
    return title ? { title, names: [], gameInfo: null, verified: false, candidates: [] } : null;
  },
];

/**
 * Fetch description, player counts, play time and stats for a BGG game (needs BGG_API_TOKEN).
 * Without a token scans still get box art.
 * @param {number} bggId
 * @returns {Promise<Object|null>} Parsed details, or null when unavailable
 */
const fetchBggDetails = async (bggId) => {
  if (!BGG_API_TOKEN || !bggId) return null;
  try {
    return parseBggThing(await fetchBggThingXml([bggId]));
  } catch (error) {
    console.warn('BGG details lookup failed:', error.message);
    return null;
  }
};

// GET /api/game-templates/barcode/:code - Look up product info for a barcode.
// Requires login: BGG's API terms don't allow passing its data on to anonymous third parties.
router.get('/barcode/:code', auth, catchAsync(async (req, res) => {
  const code = String(req.params.code).trim();
  if (!BARCODE_PATTERN.test(code)) {
    return res.status(400).json({ error: 'Barcode must be an 8-14 digit code' });
  }

  const cached = barcodeLookupCache.get(code);
  if (cached && cached.expires > Date.now()) {
    return res.json({ code, ...cached.result });
  }

  let result = null;
  let allSourcesAnswered = true;
  for (const lookup of BARCODE_SOURCES) {
    try {
      result = await lookup(code);
    } catch (error) {
      console.warn('Barcode lookup failed:', error.message);
      allSourcesAnswered = false;
    }
    if (result) break;
  }

  result = result || { title: null, names: [], gameInfo: null, verified: false, candidates: [] };
  const bggDetails = await fetchBggDetails(result.gameInfo?.bggId);
  if (bggDetails) {
    // Missing BGG fields shouldn't wipe what GameUPC already provided
    const knownDetails = Object.fromEntries(Object.entries(bggDetails).filter(([, value]) => value != null));
    result.gameInfo = sanitizeGameInfo({ ...result.gameInfo, ...knownDetails });
    result.details = {
      description: bggDetails.description,
      minPlayers: bggDetails.minPlayers,
      maxPlayers: bggDetails.maxPlayers,
    };
  }
  // 'unavailable' when there's no BGG game or token; clients then stop asking for a while
  if (bggDetails) result.detailsStatus = 'ok';
  else result.detailsStatus = BGG_API_TOKEN && result.gameInfo?.bggId ? 'failed' : 'unavailable';
  // Only remember a miss when every source actually answered, and don't keep
  // a result whose BGG details failed to load, so the next scan can fill them in
  if ((result.title || allSourcesAnswered) && result.detailsStatus !== 'failed') {
    barcodeLookupCache.set(code, { result, expires: Date.now() + BARCODE_LOOKUP_TTL_MS });
  }
  res.json({ code, ...result });
}));

// Game name searches, cached like barcode lookups since people retype the same names
const GAME_SEARCH_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_GAME_SEARCH_RESULTS = 8;
const gameSearchCache = new Map();

// GET /api/game-templates/search?q=<name> - Find games on BoardGameGeek by name, with box art,
// description and player counts. Requires login (BGG API terms) and BGG_API_TOKEN; without
// the token there are no results.
router.get('/search', auth, catchAsync(async (req, res) => {
  const query = String(req.query.q || '').trim();
  if (query.length < 2 || query.length > 100) {
    return res.status(400).json({ error: 'Search must be 2-100 characters' });
  }
  if (!BGG_API_TOKEN) return res.json({ results: [] });

  const cacheKey = query.toLowerCase();
  const cached = gameSearchCache.get(cacheKey);
  if (cached && cached.expires > Date.now()) {
    return res.json({ results: cached.results });
  }

  let results;
  try {
    const hits = rankGameSearchResults(
      parseBggSearch(await fetchBggXml(`search?query=${encodeURIComponent(query)}&type=boardgame`)),
      query,
    ).slice(0, MAX_GAME_SEARCH_RESULTS);
    // One /thing call for all hits gets their box art, description and player counts
    const things = hits.length
      ? parseBggThings(await fetchBggThingXml(hits.map((hit) => hit.bggId)))
      : new Map();
    results = hits.map((hit) => {
      const thing = things.get(hit.bggId) || {};
      return {
        name: hit.name,
        gameInfo: sanitizeGameInfo({
          ...thing,
          bggId: hit.bggId,
          yearPublished: hit.yearPublished ?? thing.yearPublished,
        }),
        details: {
          description: thing.description || '',
          minPlayers: thing.minPlayers ?? null,
          maxPlayers: thing.maxPlayers ?? null,
        },
      };
    });
  } catch (error) {
    console.warn('BGG game search failed:', error.message);
    return res.status(502).json({ error: 'Game search is unavailable right now' });
  }

  gameSearchCache.set(cacheKey, { results, expires: Date.now() + GAME_SEARCH_TTL_MS });
  res.json({ results });
}));

// GET /api/game-templates - Get all accessible templates (system + user's own)
router.get('/', auth, catchAsync(async (req, res) => {
  const userId = req.user._id;
  
  // Get system templates and user's own templates in parallel
  const [systemTemplates, userTemplates] = await Promise.all([
    SystemGameTemplate.find({ isActive: true })
      .select('_id name targetNumber lowIsBetter gameCategory scoringFormula roundPattern maxRounds minPlayers maxPlayers hasDealerRotation hasForbiddenCall usageCount description descriptionMarkdown barcodes gameInfo createdBy createdAt updatedAt')
      .sort({ name: 1 }),
    UserGameTemplate.find({ userId, approvedAsSystemTemplate: false })
      .select('_id localId name targetNumber lowIsBetter gameCategory scoringFormula roundPattern maxRounds minPlayers maxPlayers hasDealerRotation hasForbiddenCall usageCount description descriptionMarkdown gameInfo approvedAsSystemTemplate systemTemplateId createdAt updatedAt')
      .sort({ name: 1 })
  ]);

  // Mark templates with their type for frontend
  const templates = [
    ...systemTemplates.map(t => ({ ...t.toObject(), type: 'system', isPublic: true })),
    ...userTemplates.map(t => ({ ...t.toObject(), type: 'user', isPublic: false }))
  ];

  res.json({ templates });
}));

// POST /api/game-templates - Create a new user template
router.post('/', auth, catchAsync(async (req, res) => {
    const {
      name,
      localId,
      targetNumber,
      lowIsBetter,
      description,
      descriptionMarkdown,
      gameCategory,
      scoringFormula,
      roundPattern,
      maxRounds,
      hasDealerRotation,
      hasForbiddenCall,
      minPlayers,
      maxPlayers,
      gameInfo,
    } = req.body;
    const userId = req.user._id;

    // Validation
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return res.status(400).json({ error: 'Template name is required' });
    }

    // Check for duplicate by localId
    if (localId) {
      const existingByLocalId = await UserGameTemplate.findOne({ localId: { $eq: localId }, userId });
      if (existingByLocalId) {
        return res.status(200).json({
          message: 'Template already exists (by localId)',
          duplicate: true,
          template: existingByLocalId
        });
      }
    }

    // Check for duplicate by name for this user
    const existingByName = await UserGameTemplate.findOne({ 
      name: name.trim(), 
      userId
    });
    
    if (existingByName) {
      return res.status(200).json({
        message: 'Template with this name already exists',
        duplicate: true,
        template: existingByName
      });
    }

    // Create new template
    const template = new UserGameTemplate({
      userId,
      localId,
      name: name.trim(),
      targetNumber: targetNumber || null,
      lowIsBetter: lowIsBetter || false,
      gameCategory: gameCategory || 'table',
      scoringFormula: scoringFormula || null,
      roundPattern: roundPattern || null,
      maxRounds: maxRounds || null,
      hasDealerRotation: hasDealerRotation !== undefined ? hasDealerRotation : true,
      hasForbiddenCall: hasForbiddenCall !== undefined ? hasForbiddenCall : true,
      minPlayers: minPlayers ?? null,
      maxPlayers: maxPlayers ?? null,
      description: description || '',
      descriptionMarkdown: descriptionMarkdown || '',
      gameInfo: sanitizeGameInfo(gameInfo),
    });

    await template.save();

    res.status(201).json({
      message: 'Template created successfully',
      template,
      duplicate: false
    });
}));

// PUT /api/game-templates/:id - Update a user template
router.put('/:id', auth, catchAsync(async (req, res) => {
    const { id } = req.params;
    const {
      name,
      targetNumber,
      lowIsBetter,
      description,
      descriptionMarkdown,
      gameCategory,
      scoringFormula,
      roundPattern,
      maxRounds,
      hasDealerRotation,
      hasForbiddenCall,
      minPlayers,
      maxPlayers,
      gameInfo,
    } = req.body;
    const userId = req.user._id;

    const template = await UserGameTemplate.findOne({ _id: id, userId });

    if (!template) {
      return res.status(404).json({ error: 'Template not found or not authorized' });
    }

    // Update fields
    if (name !== undefined) template.name = name.trim();
    if (targetNumber !== undefined) template.targetNumber = targetNumber;
    if (lowIsBetter !== undefined) template.lowIsBetter = lowIsBetter;
    if (gameCategory !== undefined) template.gameCategory = gameCategory;
    if (scoringFormula !== undefined) template.scoringFormula = scoringFormula;
    if (roundPattern !== undefined) template.roundPattern = roundPattern;
    if (maxRounds !== undefined) template.maxRounds = maxRounds;
    if (hasDealerRotation !== undefined) template.hasDealerRotation = hasDealerRotation;
    if (hasForbiddenCall !== undefined) template.hasForbiddenCall = hasForbiddenCall;
    if (minPlayers !== undefined) template.minPlayers = minPlayers;
    if (maxPlayers !== undefined) template.maxPlayers = maxPlayers;
    if (description !== undefined) template.description = description;
    if (descriptionMarkdown !== undefined) template.descriptionMarkdown = descriptionMarkdown;
    if (gameInfo !== undefined) template.gameInfo = sanitizeGameInfo(gameInfo);

    await template.save();

    res.json({
      message: 'Template updated successfully',
      template
    });
}));

// DELETE /api/game-templates/:id - Delete a user template
router.delete('/:id', auth, catchAsync(async (req, res) => {
    const { id } = req.params;
    const userId = req.user._id;

    const template = await UserGameTemplate.findOneAndDelete({ 
      _id: id, 
      userId
    });

    if (!template) {
      return res.status(404).json({ error: 'Template not found or not authorized' });
    }

    res.json({ message: 'Template deleted successfully' });
}));

// POST /api/game-templates/:id/suggest - Suggest a user template to become a system template
router.post('/:id/suggest', auth, catchAsync(async (req, res) => {
    const { id } = req.params;
    const { suggestionNote, descriptionMarkdown } = req.body;
    const userId = req.user._id;

    // Find the user's template
    const userTemplate = await UserGameTemplate.findOne({ 
      _id: id, 
      userId
    });

    if (!userTemplate) {
      return res.status(404).json({ error: 'Template not found or not authorized' });
    }

    // Check if already suggested
    const existingSuggestion = await TemplateSuggestion.findOne({
      userTemplateId: id,
      userId,
      status: 'pending'
    });

    if (existingSuggestion) {
      return res.status(400).json({ 
        error: 'You have already suggested this template',
        suggestion: existingSuggestion
      });
    }

    // Create a template suggestion
    const suggestion = new TemplateSuggestion({
      userId,
      userTemplateId: id,
      suggestionType: 'new',
      name: userTemplate.name,
      targetNumber: userTemplate.targetNumber,
      lowIsBetter: userTemplate.lowIsBetter,
      gameCategory: userTemplate.gameCategory || 'table',
      scoringFormula: getScoringFormula(userTemplate),
      roundPattern: userTemplate.roundPattern || null,
      maxRounds: userTemplate.maxRounds || null,
      hasDealerRotation: userTemplate.hasDealerRotation !== false,
      hasForbiddenCall: userTemplate.hasForbiddenCall !== false,
      minPlayers: userTemplate.minPlayers ?? null,
      maxPlayers: userTemplate.maxPlayers ?? null,
      description: userTemplate.description,
      descriptionMarkdown: descriptionMarkdown || userTemplate.descriptionMarkdown || '',
      gameInfo: sanitizeGameInfo(userTemplate.gameInfo),
      suggestionNote: suggestionNote || '',
      status: 'pending'
    });

    await suggestion.save();

    res.status(201).json({
      message: 'Template suggestion submitted successfully',
      suggestion
    });
}));

/**
 * Box art and details for one BGG game, straight from BGG.
 * @param {number} bggId
 * @returns {Promise<Object|null>} Null without a BGG token or when BGG doesn't answer
 */
const fetchBggGameInfo = async (bggId) => {
  if (!BGG_API_TOKEN || !bggId) return null;
  try {
    const things = parseBggThings(await fetchBggThingXml([bggId]));
    const thing = things.get(bggId);
    return thing ? sanitizeGameInfo({ ...thing, bggId }) : null;
  } catch (error) {
    console.warn('BGG game info lookup failed:', error.message);
    return null;
  }
};

// A barcode lookup (GameUPC) only knows these; everything else comes from BGG itself
const LOOKUP_GAME_INFO_FIELDS = new Set(['bggId', 'imageUrl', 'thumbnailUrl', 'yearPublished']);
const hasBggDetails = (info) => Object.entries(info)
  .some(([key, value]) => !LOOKUP_GAME_INFO_FIELDS.has(key) && value != null);

// POST /api/game-templates/system/:id/game-info - Share box art from a scan with everyone.
// Any logged-in user may fill it in once, for a system game that has none yet; after that
// only admins change it (PUT /system/:id). With a BGG token the info is re-read from BGG
// by bggId, so clients can't pick the picture. Art shared before BGG details could be
// fetched gets them filled in from BGG (same game only), keeping the art.
router.post('/system/:id/game-info', auth, catchAsync(async (req, res) => {
  const submitted = sanitizeGameInfo(req.body?.gameInfo);
  if (!submitted?.bggId && !submitted?.thumbnailUrl && !submitted?.imageUrl) {
    return res.status(400).json({ error: 'gameInfo needs a bggId or an image' });
  }

  const systemTemplate = await findSystemTemplate(req.params.id, req.user._id);
  if (!systemTemplate) {
    return res.status(404).json({ error: 'System template not found' });
  }
  const existing = systemTemplate.gameInfo?.toObject?.() || systemTemplate.gameInfo;
  if (existing?.bggId || existing?.thumbnailUrl || existing?.imageUrl) {
    const sameGame = !existing.bggId || existing.bggId === submitted.bggId;
    // Details only ever come from BGG here, never from the client
    const verified = sameGame && !hasBggDetails(existing) ? await fetchBggGameInfo(submitted.bggId) : null;
    if (!verified) return res.json({ updated: false, gameInfo: systemTemplate.gameInfo });
    const known = Object.fromEntries(Object.entries(existing).filter(([, value]) => value != null));
    systemTemplate.gameInfo = { ...verified, ...known };
    await systemTemplate.save();
    return res.json({ updated: true, gameInfo: systemTemplate.gameInfo });
  }

  const verified = await fetchBggGameInfo(submitted.bggId);
  systemTemplate.gameInfo = verified ? { ...submitted, ...verified } : submitted;
  await systemTemplate.save();
  res.json({ updated: true, gameInfo: systemTemplate.gameInfo });
}));

// POST /api/game-templates/system/:id/suggest-box-art - Suggest replacing a system game's
// box art. Admins review it like other suggestions; a user's newer pick replaces their
// pending one. With a BGG token the info is re-read from BGG by bggId.
router.post('/system/:id/suggest-box-art', auth, catchAsync(async (req, res) => {
  const submitted = sanitizeGameInfo(req.body?.gameInfo);
  if (!submitted?.bggId && !submitted?.thumbnailUrl && !submitted?.imageUrl) {
    return res.status(400).json({ error: 'gameInfo needs a bggId or an image' });
  }

  const systemTemplate = await findSystemTemplate(req.params.id, req.user._id);
  if (!systemTemplate) {
    return res.status(404).json({ error: 'System template not found' });
  }
  if (submitted.bggId && submitted.bggId === systemTemplate.gameInfo?.bggId) {
    return res.status(400).json({ error: 'This game already has that box art' });
  }

  const verified = await fetchBggGameInfo(submitted.bggId);
  const gameInfo = verified ? { ...submitted, ...verified } : submitted;
  const builtinTemplateId = getBuiltinSystemTemplateById(req.params.id) ? req.params.id : null;
  const target = builtinTemplateId
    ? { builtinTemplateId }
    : { systemTemplateId: systemTemplate._id };

  const existing = await TemplateSuggestion.findOne({
    userId: req.user._id, status: 'pending', suggestionType: 'boxArt', ...target,
  });
  const suggestion = existing || new TemplateSuggestion({
    userId: req.user._id,
    suggestionType: 'boxArt',
    name: systemTemplate.name,
    ...target,
  });
  suggestion.gameInfo = gameInfo;
  suggestion.suggestionNote = typeof req.body?.suggestionNote === 'string'
    ? req.body.suggestionNote.slice(0, 500)
    : '';
  await suggestion.save();

  res.status(existing ? 200 : 201).json({ message: 'Box art suggestion submitted', suggestion });
}));

// PUT /api/game-templates/system/:id - Directly update a system template (admin only)
router.put('/system/:id', auth, requireAdmin, catchAsync(async (req, res) => {
    const { id } = req.params;
    const {
      name,
      targetNumber,
      lowIsBetter,
      gameCategory,
      scoringFormula,
      roundPattern,
      maxRounds,
      hasDealerRotation,
      hasForbiddenCall,
      description,
      descriptionMarkdown,
      minPlayers,
      maxPlayers,
      barcodes,
      gameInfo,
    } = req.body;

    let normalizedBarcodes;
    if (barcodes !== undefined) {
      normalizedBarcodes = normalizeBarcodes(barcodes);
      if (!normalizedBarcodes) {
        return res.status(400).json({ error: 'Barcodes must be an array of 8-14 digit codes' });
      }
    }

    const systemTemplate = await findSystemTemplate(id, req.user._id);
    if (!systemTemplate) {
      return res.status(404).json({ error: 'System template not found' });
    }

    if (name !== undefined) systemTemplate.name = name.trim();
    if (targetNumber !== undefined) systemTemplate.targetNumber = targetNumber;
    if (lowIsBetter !== undefined) systemTemplate.lowIsBetter = lowIsBetter;
    if (gameCategory !== undefined) systemTemplate.gameCategory = gameCategory;
    if (scoringFormula !== undefined) systemTemplate.scoringFormula = scoringFormula;
    if (roundPattern !== undefined) systemTemplate.roundPattern = roundPattern;
    if (maxRounds !== undefined) systemTemplate.maxRounds = maxRounds;
    if (hasDealerRotation !== undefined) systemTemplate.hasDealerRotation = hasDealerRotation;
    if (hasForbiddenCall !== undefined) systemTemplate.hasForbiddenCall = hasForbiddenCall;
    if (description !== undefined) systemTemplate.description = description;
    if (descriptionMarkdown !== undefined) systemTemplate.descriptionMarkdown = descriptionMarkdown;
    if (minPlayers !== undefined) systemTemplate.minPlayers = minPlayers ?? null;
    if (maxPlayers !== undefined) systemTemplate.maxPlayers = maxPlayers ?? null;
    if (normalizedBarcodes !== undefined) systemTemplate.barcodes = normalizedBarcodes;
    if (gameInfo !== undefined) systemTemplate.gameInfo = sanitizeGameInfo(gameInfo);

    await systemTemplate.save();

    res.json({ message: 'System template updated', template: systemTemplate });
}));

// POST /api/game-templates/system/:id/suggest-change - Suggest changes to a system template
router.post('/system/:id/suggest-change', auth, catchAsync(async (req, res) => {
    const { id } = req.params;
    const {
      name,
      targetNumber,
      lowIsBetter,
      gameCategory,
      scoringFormula,
      roundPattern,
      maxRounds,
      hasDealerRotation,
      hasForbiddenCall,
      description,
      descriptionMarkdown,
      suggestionNote,
      minPlayers,
      maxPlayers,
      gameInfo,
    } = req.body;
    const userId = req.user._id;

    const isMongoId = mongoose.Types.ObjectId.isValid(id);
    // A built-in that was stored by an earlier approval is read from the store
    const systemTemplate = isMongoId
      ? await SystemGameTemplate.findById(id)
      : getBuiltinSystemTemplateById(id) && await findSystemTemplate(id, userId);

    if (!systemTemplate) {
      return res.status(404).json({ error: 'System template not found' });
    }

    const existingSuggestionQuery = {
      userId,
      status: 'pending',
      suggestionType: 'change'
    };

    if (isMongoId) {
      existingSuggestionQuery.systemTemplateId = id;
    } else {
      existingSuggestionQuery.builtinTemplateId = id;
    }

    // Check if user already has a pending change request for this template
    const existingSuggestion = await TemplateSuggestion.findOne(existingSuggestionQuery);

    if (existingSuggestion) {
      return res.status(400).json({ 
        error: 'You have already submitted a change request for this template',
        suggestion: existingSuggestion
      });
    }

    // Create a change request suggestion
    const suggestion = new TemplateSuggestion({
      userId,
      systemTemplateId: isMongoId ? id : null,
      builtinTemplateId: isMongoId ? null : id,
      suggestionType: 'change',
      name: name || systemTemplate.name,
      targetNumber: targetNumber !== undefined ? targetNumber : systemTemplate.targetNumber,
      lowIsBetter: lowIsBetter !== undefined ? lowIsBetter : systemTemplate.lowIsBetter,
      gameCategory: gameCategory !== undefined ? gameCategory : (systemTemplate.gameCategory || 'table'),
      scoringFormula: scoringFormula !== undefined ? scoringFormula : getScoringFormula(systemTemplate),
      roundPattern: roundPattern !== undefined ? roundPattern : (systemTemplate.roundPattern || null),
      maxRounds: maxRounds !== undefined ? maxRounds : (systemTemplate.maxRounds || null),
      hasDealerRotation: hasDealerRotation !== undefined ? hasDealerRotation : (systemTemplate.hasDealerRotation !== false),
      hasForbiddenCall: hasForbiddenCall !== undefined ? hasForbiddenCall : (systemTemplate.hasForbiddenCall !== false),
      minPlayers: minPlayers !== undefined ? minPlayers : (systemTemplate.minPlayers ?? null),
      maxPlayers: maxPlayers !== undefined ? maxPlayers : (systemTemplate.maxPlayers ?? null),
      description: description !== undefined ? description : systemTemplate.description,
      descriptionMarkdown: descriptionMarkdown !== undefined ? descriptionMarkdown : systemTemplate.descriptionMarkdown,
      gameInfo: gameInfo !== undefined ? sanitizeGameInfo(gameInfo) : sanitizeGameInfo(systemTemplate.gameInfo),
      baseline: snapshotTemplate(systemTemplate),
      suggestionNote: suggestionNote || '',
      status: 'pending'
    });

    await suggestion.save();

    res.status(201).json({
      message: 'Change request submitted successfully',
      suggestion
    });
}));

// Review errors carry a status and, for duplicate names, the clashing template
const sendReviewError = (res, error) => {
  if (!(error instanceof SuggestionReviewError)) throw error;
  const body = { error: error.message };
  if (error.code) body.code = error.code;
  if (error.duplicateOf) body.duplicateOf = error.duplicateOf;
  return res.status(error.status).json(body);
};

// GET /api/game-templates/admin/suggestions?status=pending|approved|rejected|all
// The review queue (pending, oldest first) or the review history
router.get('/admin/suggestions', auth, requireAdmin, catchAsync(async (req, res) => {
    const status = typeof req.query.status === 'string' ? req.query.status : 'pending';
    res.json(await listSuggestions({ status }));
}));

// POST /api/game-templates/admin/suggestions/:id/approve - Approve a suggestion (admin only)
// Body: { reviewNote?, allowDuplicate? }
router.post('/admin/suggestions/:id/approve', auth, requireAdmin, catchAsync(async (req, res) => {
    try {
      const { suggestion, template, appliedFields } = await approveSuggestion(req.params.id, req.user, {
        reviewNote: req.body?.reviewNote,
        allowDuplicate: req.body?.allowDuplicate === true,
      });
      res.json({
        message: suggestion.suggestionType !== 'new'
          ? 'Template changes approved and system template updated'
          : 'Template suggestion approved and added to system templates',
        template,
        appliedFields,
      });
    } catch (error) {
      sendReviewError(res, error);
    }
}));

// DELETE /api/game-templates/admin/suggestions/:id - Reject a suggestion (admin only)
// Body: { reviewNote? }. It is kept as rejected for the history.
router.delete('/admin/suggestions/:id', auth, requireAdmin, catchAsync(async (req, res) => {
    try {
      await rejectSuggestion(req.params.id, req.user, req.body?.reviewNote);
      res.json({ message: 'Template suggestion rejected' });
    } catch (error) {
      sendReviewError(res, error);
    }
}));

module.exports = router;
