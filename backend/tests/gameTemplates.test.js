const request = require('supertest');
const mongoose = require('mongoose');
const { app, initializeServer } = require('../server');
const TemplateSuggestion = require('../models/TemplateSuggestion');
const SystemGameTemplate = require('../models/SystemGameTemplate');
const UserGameTemplate = require('../models/UserGameTemplate');
const User = require('../models/User');
const cache = require('../utils/redis');

// A BGG token without network: tests that need BGG answers mock them per call
jest.mock('../utils/bggClient', () => ({
  BGG_API_TOKEN: 'test-token',
  MAX_THING_IDS: 20,
  fetchBggXml: jest.fn(() => Promise.reject(new Error('BGG not reachable in tests'))),
  fetchBggThingXml: jest.fn(() => Promise.reject(new Error('BGG not reachable in tests'))),
}));
const { fetchBggThingXml } = require('../utils/bggClient');

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

describe('Sharing scanned box art on system games', () => {
  const thumb = 'https://cf.geekdo-images.com/b__thumb/img/y.jpg';
  let template;

  beforeEach(async () => {
    if (!mongoConnected) return;
    template = await SystemGameTemplate.create({ name: `Shared Art ${Date.now()}` });
  });

  afterEach(async () => {
    if (!mongoConnected) return;
    if (template) await SystemGameTemplate.findByIdAndDelete(template._id);
  });

  test('POST /system/:id/game-info lets any user fill in missing box art for everyone', async () => {
    if (!mongoConnected) {
      console.warn('⚠️ Skipping test - MongoDB not connected');
      return;
    }

    const response = await request(app)
      .post(`/api/game-templates/system/${template._id}/game-info`)
      .set('Authorization', `Bearer ${token}`)
      .send({ gameInfo: { bggId: 42, thumbnailUrl: thumb, imageUrl: 'https://evil.example/x.png' } })
      .expect(200);

    expect(response.body.updated).toBe(true);
    const publicResponse = await request(app).get('/api/game-templates/public').expect(200);
    const publicTemplate = publicResponse.body.templates.find((t) => String(t._id) === String(template._id));
    expect(publicTemplate.gameInfo).toMatchObject({ bggId: 42, thumbnailUrl: thumb, imageUrl: null });
  });

  test('POST /system/:id/game-info does not replace box art that is already there', async () => {
    if (!mongoConnected) {
      console.warn('⚠️ Skipping test - MongoDB not connected');
      return;
    }

    await SystemGameTemplate.findByIdAndUpdate(template._id, { gameInfo: { bggId: 1, thumbnailUrl: thumb } });

    const response = await request(app)
      .post(`/api/game-templates/system/${template._id}/game-info`)
      .set('Authorization', `Bearer ${token}`)
      .send({ gameInfo: { bggId: 99, thumbnailUrl: 'https://cf.geekdo-images.com/other.jpg' } })
      .expect(200);

    expect(response.body.updated).toBe(false);
    const stored = await SystemGameTemplate.findById(template._id).lean();
    expect(stored.gameInfo.bggId).toBe(1);
  });

  test('POST /system/:id/game-info fills in BGG details missing from shared art, keeping the art', async () => {
    if (!mongoConnected) {
      console.warn('⚠️ Skipping test - MongoDB not connected');
      return;
    }

    await SystemGameTemplate.findByIdAndUpdate(template._id, { gameInfo: { bggId: 1, thumbnailUrl: thumb } });
    fetchBggThingXml.mockResolvedValueOnce(`<items><item type="boardgame" id="1">
      <thumbnail>https://cf.geekdo-images.com/bgg.jpg</thumbnail>
      <minplayers value="3" /><maxplayers value="6" /><playingtime value="45" /><minage value="10" />
    </item></items>`);

    const response = await request(app)
      .post(`/api/game-templates/system/${template._id}/game-info`)
      .set('Authorization', `Bearer ${token}`)
      .send({ gameInfo: { bggId: 1, playingTime: 999 } })
      .expect(200);

    expect(response.body.updated).toBe(true);
    const stored = await SystemGameTemplate.findById(template._id).lean();
    expect(stored.gameInfo).toMatchObject({
      bggId: 1, thumbnailUrl: thumb, minPlayers: 3, maxPlayers: 6, playingTime: 45, minAge: 10,
    });
  });

  test('POST /system/:id/game-info does not fill in details of a different game', async () => {
    if (!mongoConnected) {
      console.warn('⚠️ Skipping test - MongoDB not connected');
      return;
    }

    await SystemGameTemplate.findByIdAndUpdate(template._id, { gameInfo: { bggId: 1, thumbnailUrl: thumb } });

    const response = await request(app)
      .post(`/api/game-templates/system/${template._id}/game-info`)
      .set('Authorization', `Bearer ${token}`)
      .send({ gameInfo: { bggId: 2, playingTime: 45 } })
      .expect(200);

    expect(response.body.updated).toBe(false);
    expect(fetchBggThingXml).not.toHaveBeenCalledWith([2]);
    const stored = await SystemGameTemplate.findById(template._id).lean();
    expect(stored.gameInfo.playingTime).toBeNull();
  });

  test('POST /system/:id/game-info rejects empty info and unknown games', async () => {
    if (!mongoConnected) {
      console.warn('⚠️ Skipping test - MongoDB not connected');
      return;
    }

    await request(app)
      .post(`/api/game-templates/system/${template._id}/game-info`)
      .set('Authorization', `Bearer ${token}`)
      .send({ gameInfo: { imageUrl: 'https://evil.example/x.png' } })
      .expect(400);

    await request(app)
      .post(`/api/game-templates/system/${new mongoose.Types.ObjectId()}/game-info`)
      .set('Authorization', `Bearer ${token}`)
      .send({ gameInfo: { bggId: 5 } })
      .expect(404);

    await request(app)
      .post(`/api/game-templates/system/${template._id}/game-info`)
      .send({ gameInfo: { bggId: 5 } })
      .expect(401);
  });
});

describe('Box art suggestions for system games', () => {
  const thumb = 'https://cf.geekdo-images.com/a__thumb/img/x.jpg';
  const newThumb = 'https://cf.geekdo-images.com/c__thumb/img/z.jpg';
  let template;

  beforeEach(async () => {
    if (!mongoConnected) return;
    template = await SystemGameTemplate.create({
      name: `Suggested Art ${Date.now()}`,
      gameInfo: { bggId: 1, thumbnailUrl: thumb },
    });
  });

  afterEach(async () => {
    if (!mongoConnected) return;
    if (template) await SystemGameTemplate.findByIdAndDelete(template._id);
  });

  test('POST /system/:id/suggest-box-art queues the art for review without changing the game', async () => {
    if (!mongoConnected) {
      console.warn('⚠️ Skipping test - MongoDB not connected');
      return;
    }

    const response = await request(app)
      .post(`/api/game-templates/system/${template._id}/suggest-box-art`)
      .set('Authorization', `Bearer ${token}`)
      .send({ gameInfo: { bggId: 77, thumbnailUrl: newThumb }, suggestionNote: 'Newer edition' })
      .expect(201);

    expect(response.body.suggestion).toMatchObject({
      suggestionType: 'boxArt',
      status: 'pending',
      name: template.name,
      suggestionNote: 'Newer edition',
    });
    expect(response.body.suggestion.gameInfo).toMatchObject({ bggId: 77, thumbnailUrl: newThumb });

    const stored = await SystemGameTemplate.findById(template._id).lean();
    expect(stored.gameInfo.bggId).toBe(1);
  });

  test('a second pick replaces the pending suggestion instead of adding another', async () => {
    if (!mongoConnected) {
      console.warn('⚠️ Skipping test - MongoDB not connected');
      return;
    }

    await request(app)
      .post(`/api/game-templates/system/${template._id}/suggest-box-art`)
      .set('Authorization', `Bearer ${token}`)
      .send({ gameInfo: { bggId: 77, thumbnailUrl: newThumb } })
      .expect(201);
    await request(app)
      .post(`/api/game-templates/system/${template._id}/suggest-box-art`)
      .set('Authorization', `Bearer ${token}`)
      .send({ gameInfo: { bggId: 78, thumbnailUrl: newThumb } })
      .expect(200);

    const pending = await TemplateSuggestion.find({ userId, suggestionType: 'boxArt' }).lean();
    expect(pending).toHaveLength(1);
    expect(pending[0].gameInfo.bggId).toBe(78);
  });

  test('rejects the art the game already has, unsafe-only info and logged-out users', async () => {
    if (!mongoConnected) {
      console.warn('⚠️ Skipping test - MongoDB not connected');
      return;
    }

    await request(app)
      .post(`/api/game-templates/system/${template._id}/suggest-box-art`)
      .set('Authorization', `Bearer ${token}`)
      .send({ gameInfo: { bggId: 1, thumbnailUrl: thumb } })
      .expect(400);

    await request(app)
      .post(`/api/game-templates/system/${template._id}/suggest-box-art`)
      .set('Authorization', `Bearer ${token}`)
      .send({ gameInfo: { imageUrl: 'https://evil.example/x.png' } })
      .expect(400);

    await request(app)
      .post(`/api/game-templates/system/${template._id}/suggest-box-art`)
      .send({ gameInfo: { bggId: 5 } })
      .expect(401);
  });

  test('admins see the current art next to the suggestion, and approving replaces only the art', async () => {
    if (!mongoConnected) {
      console.warn('⚠️ Skipping test - MongoDB not connected');
      return;
    }

    const suggestResponse = await request(app)
      .post(`/api/game-templates/system/${template._id}/suggest-box-art`)
      .set('Authorization', `Bearer ${token}`)
      .send({ gameInfo: { bggId: 77, thumbnailUrl: newThumb } })
      .expect(201);
    const suggestionId = suggestResponse.body.suggestion._id;

    // Review as an admin; auth caches the user, so drop the cached copy
    const setRole = async (role) => {
      await User.findByIdAndUpdate(userId, { role });
      await cache.del(`user:${userId}`);
    };
    await setRole('admin');
    try {
      const listResponse = await request(app)
        .get('/api/game-templates/admin/suggestions')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      const listed = listResponse.body.suggestions.find((s) => s._id === suggestionId);
      expect(listed.originalTemplate.gameInfo).toMatchObject({ bggId: 1, thumbnailUrl: thumb });

      await request(app)
        .post(`/api/game-templates/admin/suggestions/${suggestionId}/approve`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
    } finally {
      await setRole('user');
    }

    const stored = await SystemGameTemplate.findById(template._id).lean();
    expect(stored.name).toBe(template.name);
    expect(stored.gameInfo).toMatchObject({ bggId: 77, thumbnailUrl: newThumb });
  });
});

describe('Suggestion review workflow', () => {
  const thumb = 'https://cf.geekdo-images.com/a__thumb/img/x.jpg';
  const newThumb = 'https://cf.geekdo-images.com/c__thumb/img/z.jpg';
  let template;

  // Review as an admin; auth caches the user, so drop the cached copy
  const setRole = async (role) => {
    await User.findByIdAndUpdate(userId, { role });
    await cache.del(`user:${userId}`);
  };

  beforeEach(async () => {
    if (!mongoConnected) return;
    template = await SystemGameTemplate.create({
      name: `Review Flow ${Date.now()}`,
      targetNumber: 100,
      description: 'Original description',
      gameInfo: { bggId: 1, thumbnailUrl: thumb },
    });
    await setRole('admin');
  });

  afterEach(async () => {
    if (!mongoConnected) return;
    await setRole('user');
    if (template) await SystemGameTemplate.findByIdAndDelete(template._id);
  });

  const suggestChange = (changes) => request(app)
    .post(`/api/game-templates/system/${template._id}/suggest-change`)
    .set('Authorization', `Bearer ${token}`)
    .send({ ...changes, suggestionNote: 'please' })
    .expect(201);

  test('a change request only applies what it changed, keeping box art approved in between', async () => {
    if (!mongoConnected) return;

    // The edit form sends every field, including the box art it saw
    const change = await suggestChange({
      name: template.name,
      targetNumber: 150,
      description: 'Original description',
      gameInfo: { bggId: 1, thumbnailUrl: thumb },
    });
    expect(change.body.suggestion.baseline).toMatchObject({ targetNumber: 100 });

    // Box art changes before the change request is reviewed
    await SystemGameTemplate.findByIdAndUpdate(template._id, { gameInfo: { bggId: 77, thumbnailUrl: newThumb } });

    const listed = await request(app)
      .get('/api/game-templates/admin/suggestions')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const queued = listed.body.suggestions.find((s) => s._id === change.body.suggestion._id);
    expect(queued.changedFields).toEqual(['targetNumber']);
    expect(listed.body.counts.pending).toBeGreaterThanOrEqual(1);

    const approved = await request(app)
      .post(`/api/game-templates/admin/suggestions/${change.body.suggestion._id}/approve`)
      .set('Authorization', `Bearer ${token}`)
      .send({ reviewNote: 'Looks right' })
      .expect(200);
    expect(approved.body.appliedFields).toEqual(['targetNumber']);

    const stored = await SystemGameTemplate.findById(template._id).lean();
    expect(stored.targetNumber).toBe(150);
    expect(stored.gameInfo).toMatchObject({ bggId: 77, thumbnailUrl: newThumb });

    const suggestion = await TemplateSuggestion.findById(change.body.suggestion._id).lean();
    expect(suggestion.status).toBe('approved');
    expect(suggestion.reviewNote).toBe('Looks right');
    expect(String(suggestion.reviewedBy)).toBe(String(userId));
  });

  test('a suggestion can only be reviewed once', async () => {
    if (!mongoConnected) return;

    const change = await suggestChange({ targetNumber: 120 });
    const approveUrl = `/api/game-templates/admin/suggestions/${change.body.suggestion._id}/approve`;

    await request(app).post(approveUrl).set('Authorization', `Bearer ${token}`).expect(200);
    await request(app).post(approveUrl).set('Authorization', `Bearer ${token}`).expect(404);
    await request(app)
      .delete(`/api/game-templates/admin/suggestions/${change.body.suggestion._id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(404);
  });

  test('rejecting keeps the reason and moves the suggestion into the history', async () => {
    if (!mongoConnected) return;

    const change = await suggestChange({ targetNumber: 999 });
    await request(app)
      .delete(`/api/game-templates/admin/suggestions/${change.body.suggestion._id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ reviewNote: 'Target is 100 in the rulebook' })
      .expect(200);

    const history = await request(app)
      .get('/api/game-templates/admin/suggestions?status=rejected')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const rejected = history.body.suggestions.find((s) => s._id === change.body.suggestion._id);
    expect(rejected.reviewNote).toBe('Target is 100 in the rulebook');
    expect(rejected.reviewedBy.username).toBeTruthy();

    const stored = await SystemGameTemplate.findById(template._id).lean();
    expect(stored.targetNumber).toBe(100);
  });

  test('a new template named like an existing one needs explicit confirmation', async () => {
    if (!mongoConnected) return;

    const userTemplate = await UserGameTemplate.create({ userId, name: template.name.toUpperCase() });
    let createdId = null;
    try {
      const suggested = await request(app)
        .post(`/api/game-templates/${userTemplate._id}/suggest`)
        .set('Authorization', `Bearer ${token}`)
        .send({ suggestionNote: '' })
        .expect(201);
      const id = suggested.body.suggestion._id;

      const listed = await request(app)
        .get('/api/game-templates/admin/suggestions')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect(listed.body.suggestions.find((s) => s._id === id).duplicateOf.name).toBe(template.name);

      const refused = await request(app)
        .post(`/api/game-templates/admin/suggestions/${id}/approve`)
        .set('Authorization', `Bearer ${token}`)
        .expect(409);
      expect(refused.body.code).toBe('DUPLICATE_NAME');
      expect((await TemplateSuggestion.findById(id).lean()).status).toBe('pending');

      const approved = await request(app)
        .post(`/api/game-templates/admin/suggestions/${id}/approve`)
        .set('Authorization', `Bearer ${token}`)
        .send({ allowDuplicate: true })
        .expect(200);
      createdId = approved.body.template._id;
    } finally {
      await UserGameTemplate.findByIdAndDelete(userTemplate._id);
      if (createdId) await SystemGameTemplate.findByIdAndDelete(createdId);
    }
  });
});
