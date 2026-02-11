/**
 * Schema Improvements Integration Tests
 * 
 * Tests for: PlayerAlias, SystemGameTemplate, UserGameTemplate,
 * TemplateSuggestion repositories + template dual-write service +
 * GameEventAction enum validation.
 */

require('dotenv').config();
const { connectDatabases, disconnectDatabases, getPrisma, usePostgres } = require('../database');
const bcrypt = require('bcryptjs');
const User = require('../models/User');

const PlayerAliasRepo = require('../repositories/PlayerAliasRepository');
const SystemTemplateRepo = require('../repositories/SystemGameTemplateRepository');
const UserTemplateRepo = require('../repositories/UserGameTemplateRepository');
const SuggestionRepo = require('../repositories/TemplateSuggestionRepository');
const GameEventRepo = require('../repositories/GameEventRepository');

const {
  mirrorUserTemplateCreate,
  mirrorUserTemplateUpdate,
  mirrorUserTemplateDelete,
  mirrorSystemTemplateCreate,
  mirrorSuggestionCreate
} = require('../utils/templateDualWrite');

const PREFIX = `_ts${Date.now().toString(36)}_`;
let prisma;
let mongoUserId;
let pgUserId;

beforeAll(async () => {
  process.env.USE_POSTGRES = 'true';
  await connectDatabases();
  prisma = getPrisma();

  // Create test user in both DBs
  const hash = await bcrypt.hash('test123', 10);
  const mongoUser = new User({ username: `${PREFIX}u`, passwordHash: hash });
  await mongoUser.save();
  mongoUserId = mongoUser._id.toString();

  pgUserId = (await prisma.user.create({
    data: { username: `${PREFIX}u`, passwordHash: hash, role: 'user' }
  })).id;
});

afterAll(async () => {
  // Cleanup in FK-safe order
  await prisma.templateSuggestion.deleteMany({ where: { suggestedById: pgUserId } });
  await prisma.userGameTemplate.deleteMany({ where: { userId: pgUserId } });
  await prisma.systemGameTemplate.deleteMany({ where: { name: { startsWith: PREFIX } } });
  await prisma.playerAlias.deleteMany({ where: { userId: pgUserId } });
  await prisma.gameEvent.deleteMany({ where: { gameId: { startsWith: PREFIX } } });
  await prisma.user.deleteMany({ where: { username: { startsWith: PREFIX } } });
  await User.deleteMany({ username: { $regex: `^${PREFIX}` } });

  await disconnectDatabases();
});

// ========================================
// PlayerAlias Repository
// ========================================
describe('PlayerAlias repository', () => {
  let aliasId;

  test('should create an alias', async () => {
    const alias = await PlayerAliasRepo.create(prisma, {
      aliasName: `${PREFIX}alias1`,
      userId: pgUserId,
      createdById: pgUserId,
      notes: 'Test alias'
    });
    expect(alias).toBeDefined();
    expect(alias.aliasName).toBe(`${PREFIX}alias1`);
    expect(alias.notes).toBe('Test alias');
    aliasId = alias.id;
  });

  test('should find alias by name', async () => {
    const alias = await PlayerAliasRepo.findByName(prisma, `${PREFIX}alias1`);
    expect(alias).toBeDefined();
    expect(alias.user).toBeDefined();
    expect(alias.createdBy).toBeDefined();
  });

  test('should find aliases by userId', async () => {
    const aliases = await PlayerAliasRepo.findByUserId(prisma, pgUserId);
    expect(aliases.length).toBeGreaterThanOrEqual(1);
  });

  test('should count aliases by userId', async () => {
    const count = await PlayerAliasRepo.countByUserId(prisma, pgUserId);
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test('should delete alias', async () => {
    await PlayerAliasRepo.deleteById(prisma, aliasId);
    const found = await PlayerAliasRepo.findByName(prisma, `${PREFIX}alias1`);
    expect(found).toBeNull();
  });
});

// ========================================
// SystemGameTemplate Repository
// ========================================
describe('SystemGameTemplate repository', () => {
  let templateId;

  test('should create a system template', async () => {
    const tmpl = await SystemTemplateRepo.create(prisma, {
      name: `${PREFIX}Wizard`,
      targetNumber: null,
      lowIsBetter: false,
      description: 'Test wizard template',
      descriptionMarkdown: '# Wizard\nA card game',
      isActive: true,
      createdById: pgUserId
    });
    expect(tmpl).toBeDefined();
    expect(tmpl.name).toBe(`${PREFIX}Wizard`);
    expect(tmpl.descriptionMarkdown).toBe('# Wizard\nA card game');
    expect(tmpl.isActive).toBe(true);
    templateId = tmpl.id;
  });

  test('should enforce unique name', async () => {
    await expect(
      SystemTemplateRepo.create(prisma, {
        name: `${PREFIX}Wizard`,
        description: 'Duplicate'
      })
    ).rejects.toThrow();
  });

  test('should find by name', async () => {
    const tmpl = await SystemTemplateRepo.findByName(prisma, `${PREFIX}Wizard`);
    expect(tmpl).toBeDefined();
    expect(tmpl.id).toBe(templateId);
  });

  test('should find all active templates', async () => {
    const templates = await SystemTemplateRepo.findAllActive(prisma);
    expect(templates.some(t => t.id === templateId)).toBe(true);
  });

  test('should update template', async () => {
    const updated = await SystemTemplateRepo.update(prisma, templateId, {
      isActive: false,
      description: 'Updated'
    });
    expect(updated.isActive).toBe(false);
    expect(updated.description).toBe('Updated');
  });

  test('should increment usage', async () => {
    // Reset to active first
    await SystemTemplateRepo.update(prisma, templateId, { isActive: true });
    const updated = await SystemTemplateRepo.incrementUsage(prisma, templateId);
    expect(updated.usageCount).toBe(1);
  });
});

// ========================================
// UserGameTemplate Repository
// ========================================
describe('UserGameTemplate repository', () => {
  let templateId;

  test('should create a user template', async () => {
    const tmpl = await UserTemplateRepo.create(prisma, {
      userId: pgUserId,
      localId: `${PREFIX}tmpl1`,
      name: `${PREFIX}MyGame`,
      targetNumber: 100,
      lowIsBetter: true,
      description: 'Low score wins',
      descriptionMarkdown: '# My Game'
    });
    expect(tmpl).toBeDefined();
    expect(tmpl.name).toBe(`${PREFIX}MyGame`);
    expect(tmpl.descriptionMarkdown).toBe('# My Game');
    expect(tmpl.approvedAsSystemTemplate).toBe(false);
    templateId = tmpl.id;
  });

  test('should find by localId', async () => {
    const tmpl = await UserTemplateRepo.findByLocalId(prisma, `${PREFIX}tmpl1`);
    expect(tmpl).toBeDefined();
    expect(tmpl.id).toBe(templateId);
  });

  test('should find by user and name', async () => {
    const tmpl = await UserTemplateRepo.findByUserAndName(prisma, pgUserId, `${PREFIX}MyGame`);
    expect(tmpl).toBeDefined();
  });

  test('should find by userId', async () => {
    const templates = await UserTemplateRepo.findByUserId(prisma, pgUserId);
    expect(templates.length).toBeGreaterThanOrEqual(1);
  });

  test('should update template', async () => {
    const updated = await UserTemplateRepo.update(prisma, templateId, {
      approvedAsSystemTemplate: true,
      isPublic: true
    });
    expect(updated.approvedAsSystemTemplate).toBe(true);
    expect(updated.isPublic).toBe(true);
  });
});

// ========================================
// TemplateSuggestion Repository
// ========================================
describe('TemplateSuggestion repository', () => {
  let suggestionId;

  test('should create a suggestion with new enum fields', async () => {
    const suggestion = await SuggestionRepo.create(prisma, {
      name: `${PREFIX}NewGame`,
      description: 'Suggest a new game',
      descriptionMarkdown: '# New Game',
      suggestedById: pgUserId,
      suggestionNote: 'Please add this',
      suggestionType: 'new_template',
      status: 'pending'
    });
    expect(suggestion).toBeDefined();
    expect(suggestion.status).toBe('pending');
    expect(suggestion.suggestionType).toBe('new_template');
    expect(suggestion.descriptionMarkdown).toBe('# New Game');
    suggestionId = suggestion.id;
  });

  test('should find pending suggestions', async () => {
    const suggestions = await SuggestionRepo.findPending(prisma);
    expect(suggestions.some(s => s.id === suggestionId)).toBe(true);
  });

  test('should approve a suggestion', async () => {
    const approved = await SuggestionRepo.approve(prisma, suggestionId, 'Looks good!');
    expect(approved.status).toBe('approved');
    expect(approved.reviewedAt).toBeDefined();
    expect(approved.reviewNote).toBe('Looks good!');
  });

  test('should create and reject a suggestion', async () => {
    const suggestion = await SuggestionRepo.create(prisma, {
      name: `${PREFIX}RejectMe`,
      suggestedById: pgUserId,
      suggestionType: 'change'
    });
    const rejected = await SuggestionRepo.reject(prisma, suggestion.id, 'Not suitable');
    expect(rejected.status).toBe('rejected');
    expect(rejected.reviewNote).toBe('Not suitable');
  });

  test('should find by status', async () => {
    const approved = await SuggestionRepo.findByStatus(prisma, 'approved');
    expect(approved.some(s => s.id === suggestionId)).toBe(true);

    const rejected = await SuggestionRepo.findByStatus(prisma, 'rejected');
    expect(rejected.length).toBeGreaterThanOrEqual(1);
  });

  test('should find by userId', async () => {
    const suggestions = await SuggestionRepo.findByUserId(prisma, pgUserId);
    expect(suggestions.length).toBeGreaterThanOrEqual(2);
  });
});

// ========================================
// GameEventAction enum validation
// ========================================
describe('GameEventAction enum', () => {
  test('should accept valid enum values', async () => {
    const validActions = [
      'GAME_START', 'GAME_END', 'ROUND_START', 'ROUND_COMPLETE',
      'SCORE_UPDATE', 'BATCH_SCORE_UPDATE', 'BID_PLACED', 'TRICK_RECORDED'
    ];

    for (const action of validActions) {
      const event = await GameEventRepo.create(prisma, {
        eventId: `${PREFIX}ev_${action}`,
        gameId: `${PREFIX}game_enum`,
        actionType: action,
        payload: { test: true },
        timestamp: Date.now(),
        localVersion: 1,
        userId: pgUserId,
        serverVersion: validActions.indexOf(action) + 1
      });
      expect(event.actionType).toBe(action);
    }
  });

  test('should reject invalid enum values', async () => {
    await expect(
      GameEventRepo.create(prisma, {
        eventId: `${PREFIX}ev_invalid`,
        gameId: `${PREFIX}game_enum`,
        actionType: 'INVALID_ACTION',
        payload: {},
        timestamp: Date.now(),
        localVersion: 1,
        userId: pgUserId,
        serverVersion: 100
      })
    ).rejects.toThrow();
  });
});

// ========================================
// Template Dual-Write Service
// ========================================
describe('Template dual-write service', () => {
  test('mirrorUserTemplateCreate should create in PG', async () => {
    const mockTemplate = {
      userId: pgUserId,
      localId: `${PREFIX}dw_tmpl`,
      name: `${PREFIX}DualWriteGame`,
      targetNumber: 50,
      lowIsBetter: false,
      description: 'Test dual-write'
    };
    const result = await mirrorUserTemplateCreate(mockTemplate);
    expect(result).toBeDefined();
    expect(result.name).toBe(`${PREFIX}DualWriteGame`);

    // Verify it's in PG
    const found = await UserTemplateRepo.findByLocalId(prisma, `${PREFIX}dw_tmpl`);
    expect(found).toBeDefined();
  });

  test('mirrorUserTemplateUpdate should update in PG', async () => {
    const mockTemplate = {
      userId: pgUserId,
      localId: `${PREFIX}dw_tmpl`,
      name: `${PREFIX}DualWriteGame`
    };
    const result = await mirrorUserTemplateUpdate(mockTemplate, {
      name: `${PREFIX}DualWriteGameUpdated`,
      description: 'Updated via dual-write'
    });
    expect(result).toBeDefined();
    expect(result.name).toBe(`${PREFIX}DualWriteGameUpdated`);
  });

  test('mirrorUserTemplateDelete should remove from PG', async () => {
    const mockTemplate = {
      userId: pgUserId,
      localId: `${PREFIX}dw_tmpl`,
      name: `${PREFIX}DualWriteGameUpdated`
    };
    const result = await mirrorUserTemplateDelete(mockTemplate);
    expect(result).toBe(true);

    const found = await UserTemplateRepo.findByLocalId(prisma, `${PREFIX}dw_tmpl`);
    expect(found).toBeNull();
  });

  test('mirrorSystemTemplateCreate should create in PG', async () => {
    const mockTemplate = {
      name: `${PREFIX}SystemDW`,
      description: 'System dual-write test',
      descriptionMarkdown: '# System',
      isActive: true,
      createdBy: pgUserId
    };
    const result = await mirrorSystemTemplateCreate(mockTemplate);
    expect(result).toBeDefined();
    expect(result.name).toBe(`${PREFIX}SystemDW`);
  });

  test('mirrorSuggestionCreate should create in PG', async () => {
    const mockSuggestion = {
      name: `${PREFIX}SuggestionDW`,
      userId: pgUserId,
      suggestionNote: 'DW test',
      suggestionType: 'new',
      status: 'pending'
    };
    const result = await mirrorSuggestionCreate(mockSuggestion);
    expect(result).toBeDefined();
    expect(result.status).toBe('pending');
  });
});
