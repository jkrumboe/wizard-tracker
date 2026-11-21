const request = require('supertest');
const mongoose = require('mongoose');
const { app, initializeServer } = require('../server');
const User = require('../models/User');
const WizardGame = require('../models/WizardGame');
const GamePhoto = require('../models/GamePhoto');

// Smallest valid JPEG-signed payload: the route checks the magic bytes, not the full image
const JPEG_BYTES = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(64, 1)]);
const JPEG_DATA_URL = `data:image/jpeg;base64,${JPEG_BYTES.toString('base64')}`;

let mongoConnected = false;
const users = {};
const gameIds = [];

const register = async (key) => {
  const username = `wp${key}${Date.now().toString().slice(-8)}`; // max 20 chars
  const res = await request(app)
    .post('/api/users/register')
    .send({ username, password: 'password123' })
    .expect(201);
  users[key] = { token: res.body.token, id: res.body.user.id, username };
};

const skipIfNoMongo = () => {
  if (!mongoConnected) {
    console.warn('⚠️ Skipping test - MongoDB not connected');
    return true;
  }
  return false;
};

const createWizardGame = async (tag) => {
  const players = [
    { id: 'p1', name: users.own.username },
    { id: 'p2', name: users.pla.username },
    { id: 'p3', name: 'Some Guest' },
  ];
  const game = await WizardGame.create({
    userId: new mongoose.Types.ObjectId(users.own.id),
    localId: `wizard_photo_${tag}_${Date.now()}`,
    gameData: {
      version: '3.0',
      created_at: new Date().toISOString(),
      duration_seconds: 600,
      total_rounds: 1,
      players,
      round_data: [{ players: players.map((p) => ({ id: p.id, call: 0, made: 0, score: 20 })) }],
    },
  });
  gameIds.push(game._id);
  return game._id.toString();
};

const addPhoto = (gameId, key) => {
  const req = request(app).post(`/api/wizard-games/${gameId}/photos`).send({ image: JPEG_DATA_URL, width: 1200, height: 900 });
  return key ? req.set('Authorization', `Bearer ${users[key].token}`) : req;
};

beforeAll(async () => {
  try {
    await initializeServer();
    mongoConnected = mongoose.connection.readyState === 1;
  } catch (err) {
    console.warn('Failed to initialize server:', err.message);
    mongoConnected = false;
  }
  if (!mongoConnected) return;

  await register('own');
  await register('pla');
  await register('out');
  await register('adm');
  // Before any authenticated request, so the cached user already has the role
  await User.updateOne({ _id: users.adm.id }, { role: 'admin' });
}, 30000);

afterAll(async () => {
  if (!mongoConnected) return;
  await GamePhoto.deleteMany({ gameId: { $in: gameIds } });
  await WizardGame.deleteMany({ _id: { $in: gameIds } });
  await User.deleteMany({ _id: { $in: Object.values(users).map((u) => u.id) } });
}, 30000);

describe('Wizard game photos', () => {
  test('players with an account can add photos, everyone can see them', async () => {
    if (skipIfNoMongo()) return;
    const gameId = await createWizardGame('add');

    const { body: { photo } } = await addPhoto(gameId, 'own').expect(201);
    expect(photo.url).toBe(`/api/wizard-games/photos/${photo.id}/image`);
    await addPhoto(gameId, 'pla').expect(201);
    await addPhoto(gameId, 'out').expect(403);
    await addPhoto(gameId, null).expect(401);

    const stored = await GamePhoto.findById(photo.id).select('gameType').lean();
    expect(stored.gameType).toBe('wizard');

    const anon = await request(app).get(`/api/wizard-games/${gameId}/photos`).expect(200);
    expect(anon.body.photos).toHaveLength(2);
    expect(anon.body.canAdd).toBe(false);

    const image = await request(app).get(photo.url).expect(200);
    expect(image.headers['content-type']).toBe('image/jpeg');
    expect(Buffer.compare(image.body, JPEG_BYTES)).toBe(0);
  });

  test('admins can always add photos, even to games they did not play', async () => {
    if (skipIfNoMongo()) return;
    const gameId = await createWizardGame('adm');

    const list = await request(app)
      .get(`/api/wizard-games/${gameId}/photos`)
      .set('Authorization', `Bearer ${users.adm.token}`)
      .expect(200);
    expect(list.body.canAdd).toBe(true);

    const { body: { photo } } = await addPhoto(gameId, 'adm').expect(201);
    expect(photo.canDelete).toBe(true);
  });

  test('players can delete only their own photos', async () => {
    if (skipIfNoMongo()) return;
    const gameId = await createWizardGame('del');
    const { body: { photo: ownerPhoto } } = await addPhoto(gameId, 'own').expect(201);

    await request(app)
      .delete(`/api/wizard-games/${gameId}/photos/${ownerPhoto.id}`)
      .set('Authorization', `Bearer ${users.pla.token}`)
      .expect(403);
    await request(app)
      .delete(`/api/wizard-games/${gameId}/photos/${ownerPhoto.id}`)
      .set('Authorization', `Bearer ${users.own.token}`)
      .expect(200);
  });

  test('an unknown game is a 404, not a table game lookup', async () => {
    if (skipIfNoMongo()) return;
    await request(app).get(`/api/wizard-games/${new mongoose.Types.ObjectId()}/photos`).expect(404);
  });

  test('deleting the game deletes its photos', async () => {
    if (skipIfNoMongo()) return;
    const gameId = await createWizardGame('gone');
    await addPhoto(gameId, 'own').expect(201);

    await request(app)
      .delete(`/api/wizard-games/${gameId}`)
      .set('Authorization', `Bearer ${users.own.token}`)
      .expect(200);

    expect(await GamePhoto.countDocuments({ gameId })).toBe(0);
  });
});
