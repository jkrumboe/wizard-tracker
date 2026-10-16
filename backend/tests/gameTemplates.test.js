const request = require('supertest');
const mongoose = require('mongoose');
const { app, initializeServer } = require('../server');
const TemplateSuggestion = require('../models/TemplateSuggestion');
const SystemGameTemplate = require('../models/SystemGameTemplate');
const UserGameTemplate = require('../models/UserGameTemplate');
const User = require('../models/User');

let mongoConnected = false;
let token;
let userId;

beforeAll(async () => {
  try {
    await initializeServer();
    mongoConnected = mongoose.connection.readyState === 1;
  } catch (err) {
    console.warn('Failed to initialize server:', err.message);
    mongoConnected = false;
  }

  if (!mongoConnected) {
    return;
  }

  const username = `tpl-${Date.now()}`; // max 20 chars
  const registerResponse = await request(app)
    .post('/api/users/register')
    .send({
      username,
      password: 'password123'
    })
    .expect(201);

  token = registerResponse.body.token;
  userId = registerResponse.body.user.id;
}, 30000);

afterAll(async () => {
  if (!mongoConnected || !userId) {
    return;
  }

  await TemplateSuggestion.deleteMany({ userId });
  await User.findByIdAndDelete(userId);
}, 30000);

beforeEach(async () => {
  if (!mongoConnected || !userId) {
    return;
  }

  await TemplateSuggestion.deleteMany({ userId });
});

describe('Built-in system template change suggestions', () => {
  test('POST /api/game-templates/system/__builtin_wizard__/suggest-change should accept built-in template IDs', async () => {
    if (!mongoConnected) {
      console.warn('⚠️ Skipping test - MongoDB not connected');
      return;
    }

    const response = await request(app)
      .post('/api/game-templates/system/__builtin_wizard__/suggest-change')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Wizard',
        gameCategory: 'callAndMade',
        description: 'The classic Wizard card game',
        descriptionMarkdown: '# Wizard\n\nCustom rules for the built-in template.',
        scoringFormula: {
          baseCorrect: 20,
          bonusPerTrick: 10,
          penaltyPerDiff: -10,
        },
        roundPattern: 'pyramid',
        maxRounds: 20,
        hasDealerRotation: true,
        hasForbiddenCall: true,
      })
      .expect(201);

    expect(response.body.message).toBe('Change request submitted successfully');
    expect(response.body.suggestion.builtinTemplateId).toBe('__builtin_wizard__');
    expect(response.body.suggestion.systemTemplateId).toBeNull();
    expect(response.body.suggestion.descriptionMarkdown).toContain('Custom rules');

    const storedSuggestion = await TemplateSuggestion.findById(response.body.suggestion._id).lean();
    expect(storedSuggestion).toBeTruthy();
    expect(storedSuggestion.builtinTemplateId).toBe('__builtin_wizard__');
  });

  test('GET /api/game-templates/admin/suggestions should include original template data for built-in change requests', async () => {
    if (!mongoConnected) {
      console.warn('⚠️ Skipping test - MongoDB not connected');
      return;
    }

    await request(app)
      .post('/api/game-templates/system/__builtin_wizard__/suggest-change')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Wizard',
        gameCategory: 'callAndMade',
        description: 'Updated Wizard description',
        descriptionMarkdown: '## Rules\n\nUpdated Wizard markdown.',
      })
      .expect(201);

    const response = await request(app)
      .get('/api/game-templates/admin/suggestions')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const wizardSuggestion = response.body.suggestions.find(
      (suggestion) => suggestion.builtinTemplateId === '__builtin_wizard__'
    );

    expect(wizardSuggestion).toBeTruthy();
    expect(wizardSuggestion.originalTemplate).toBeTruthy();
    expect(wizardSuggestion.originalTemplate._id).toBe('__builtin_wizard__');
    expect(wizardSuggestion.originalTemplate.name).toBe('Wizard');
  });

  test('E2E: suggest built-in Wizard change, approve it, and expose updated template via public endpoint', async () => {
    if (!mongoConnected) {
      console.warn('⚠️ Skipping test - MongoDB not connected');
      return;
    }

    const marker = `e2e-${Date.now()}`;
    const updatedDescription = `Wizard template description ${marker}`;
    const updatedMarkdown = `# Wizard\n\nE2E rules marker: ${marker}`;

    const originalWizard = await SystemGameTemplate.findOne({ name: 'Wizard' }).lean();
    let createdTemplateId = null;

    try {
      const suggestResponse = await request(app)
        .post('/api/game-templates/system/__builtin_wizard__/suggest-change')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Wizard',
          gameCategory: 'callAndMade',
          description: updatedDescription,
          descriptionMarkdown: updatedMarkdown,
          scoringFormula: {
            baseCorrect: 20,
            bonusPerTrick: 10,
            penaltyPerDiff: -10,
          },
          roundPattern: 'pyramid',
          maxRounds: 20,
          hasDealerRotation: true,
          hasForbiddenCall: true,
        })
        .expect(201);

      const suggestionId = suggestResponse.body.suggestion?._id;
      expect(suggestionId).toBeTruthy();

      const approveResponse = await request(app)
        .post(`/api/game-templates/admin/suggestions/${suggestionId}/approve`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(approveResponse.body.template).toBeTruthy();
      expect(approveResponse.body.template.description).toBe(updatedDescription);
      expect(approveResponse.body.template.descriptionMarkdown).toBe(updatedMarkdown);

      createdTemplateId = approveResponse.body.template._id;

      const publicResponse = await request(app)
        .get('/api/game-templates/public')
        .expect(200);

      const publicTemplate = (publicResponse.body.templates || []).find(
        (template) => String(template._id) === String(createdTemplateId)
      );

      expect(publicTemplate).toBeTruthy();
      expect(publicTemplate.name).toBe('Wizard');
      expect(publicTemplate.description).toBe(updatedDescription);
      expect(publicTemplate.descriptionMarkdown).toBe(updatedMarkdown);
      expect(publicTemplate.gameCategory).toBe('callAndMade');
    } finally {
      if (originalWizard) {
        await SystemGameTemplate.findByIdAndUpdate(originalWizard._id, {
          name: originalWizard.name,
          targetNumber: originalWizard.targetNumber,
          lowIsBetter: originalWizard.lowIsBetter,
          gameCategory: originalWizard.gameCategory,
          scoringFormula: originalWizard.scoringFormula,
          roundPattern: originalWizard.roundPattern,
          maxRounds: originalWizard.maxRounds,
          hasDealerRotation: originalWizard.hasDealerRotation,
          hasForbiddenCall: originalWizard.hasForbiddenCall,
          description: originalWizard.description,
          descriptionMarkdown: originalWizard.descriptionMarkdown,
          isActive: originalWizard.isActive,
          createdBy: originalWizard.createdBy,
        });
      } else if (createdTemplateId) {
        await SystemGameTemplate.findByIdAndDelete(createdTemplateId);
      }
    }
  });
});
describe('System template barcodes', () => {
  let template;

  beforeEach(async () => {
    if (!mongoConnected) return;
    await User.findByIdAndUpdate(userId, { role: 'admin' });
    template = await SystemGameTemplate.create({ name: `Barcode Test ${Date.now()}` });
  });

  afterEach(async () => {
    if (!mongoConnected) return;
    await User.findByIdAndUpdate(userId, { role: 'user' });
    if (template) await SystemGameTemplate.findByIdAndDelete(template._id);
  });

  test('PUT /api/game-templates/system/:id saves barcodes and GET /public returns them', async () => {
    if (!mongoConnected) {
      console.warn('⚠️ Skipping test - MongoDB not connected');
      return;
    }

    const updateResponse = await request(app)
      .put(`/api/game-templates/system/${template._id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ barcodes: [' 4001234567890 ', '4001234567890', '12345670'] })
      .expect(200);

    expect(updateResponse.body.template.barcodes).toEqual(['4001234567890', '12345670']);

    const publicResponse = await request(app)
      .get('/api/game-templates/public')
      .expect(200);

    const publicTemplate = publicResponse.body.templates.find(
      (t) => String(t._id) === String(template._id)
    );
    expect(publicTemplate.barcodes).toEqual(['4001234567890', '12345670']);
  });

  test('PUT /api/game-templates/system/:id rejects invalid barcodes', async () => {
    if (!mongoConnected) {
      console.warn('⚠️ Skipping test - MongoDB not connected');
      return;
    }

    await request(app)
      .put(`/api/game-templates/system/${template._id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ barcodes: ['not-a-barcode'] })
      .expect(400);

    const unchanged = await SystemGameTemplate.findById(template._id).lean();
    expect(unchanged.barcodes).toEqual([]);
  });
});

describe('Template game info (box art)', () => {
  const createdIds = [];

  afterAll(async () => {
    if (!mongoConnected) return;
    await UserGameTemplate.deleteMany({ _id: { $in: createdIds } });
  });

  test('POST /api/game-templates keeps BGG images and drops other image hosts', async () => {
    if (!mongoConnected) {
      console.warn('⚠️ Skipping test - MongoDB not connected');
      return;
    }

    const thumb = 'https://cf.geekdo-images.com/a__thumb/img/x.jpg';
    const response = await request(app)
      .post('/api/game-templates')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: `Box Art ${Date.now()}`,
        gameInfo: { bggId: 13, thumbnailUrl: thumb, imageUrl: 'https://evil.example/x.png', playingTime: 60 },
      })
      .expect(201);

    createdIds.push(response.body.template._id);
    expect(response.body.template.gameInfo).toMatchObject({
      bggId: 13,
      thumbnailUrl: thumb,
      imageUrl: null,
      playingTime: 60,
    });
  });
});
