const request = require('supertest');
const mongoose = require('mongoose');
const { app, initializeServer } = require('../server');
const User = require('../models/User');
const TableGame = require('../models/TableGame');
const GamePhoto = require('../models/GamePhoto');

// Smallest valid JPEG-signed payload: the route checks the magic bytes, not the full image
const JPEG_BYTES = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(64, 1)]);
const JPEG_DATA_URL = `data:image/jpeg;base64,${JPEG_BYTES.toString('base64')}`;

let mongoConnected = false;
const users = {};
let gameId;

const register = async (key) => {
  const username = `ph${key}${Date.now().toString().slice(-8)}`; // max 20 chars
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

const addPhoto = (key, body = { image: JPEG_DATA_URL, width: 1600, height: 1200 }) => {
  const req = request(app).post(`/api/table-games/${gameId}/photos`).send(body);
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

  const res = await request(app)
    .post('/api/table-games')
    .set('Authorization', `Bearer ${users.own.token}`)
    .send({
      localId: `table_photo_test_${Date.now()}`,
      gameData: {
        gameName: 'Catan',
        rows: 1,
        players: [
          { id: 'p1', name: users.own.username, points: [10] },
          { id: 'p2', name: users.pla.username, points: [8] },
          { id: 'p3', name: 'Some Guest', points: [6] },
        ],
      },
    })
    .expect(201);
  gameId = res.body.game._id;
}, 30000);

afterAll(async () => {
  if (!mongoConnected) return;
  if (gameId) {
    await GamePhoto.deleteMany({ gameId });
    await TableGame.findByIdAndDelete(gameId);
  }
  await User.deleteMany({ _id: { $in: Object.values(users).map((u) => u.id) } });
}, 30000);

beforeEach(async () => {
  if (mongoConnected && gameId) await GamePhoto.deleteMany({ gameId });
});

describe('Table game photos', () => {
  test('owner and a player with an account can add photos; outsiders and anonymous cannot', async () => {
    if (skipIfNoMongo()) return;

    const ownerRes = await addPhoto('own').expect(201);
    expect(ownerRes.body.photo).toMatchObject({ uploaderName: users.own.username, width: 1600, height: 1200, canDelete: true });
    expect(ownerRes.body.photo).not.toHaveProperty('data');

    await addPhoto('pla').expect(201);
    await addPhoto('out').expect(403);
    await addPhoto(null).expect(401);
  });

  test('anyone can list and load photos, but only players are offered to add', async () => {
    if (skipIfNoMongo()) return;
    const { body: { photo } } = await addPhoto('own').expect(201);

    const anon = await request(app).get(`/api/table-games/${gameId}/photos`).expect(200);
    expect(anon.body.canAdd).toBe(false);
    expect(anon.body.photos).toHaveLength(1);
    expect(anon.body.photos[0].canDelete).toBe(false);

    const player = await request(app)
      .get(`/api/table-games/${gameId}/photos`)
      .set('Authorization', `Bearer ${users.pla.token}`)
      .expect(200);
    expect(player.body.canAdd).toBe(true);

    const image = await request(app).get(photo.url).expect(200);
    expect(image.headers['content-type']).toBe('image/jpeg');
    expect(Buffer.compare(image.body, JPEG_BYTES)).toBe(0);
  });

  test('owner can delete any photo; players only their own', async () => {
    if (skipIfNoMongo()) return;
    const { body: { photo: ownerPhoto } } = await addPhoto('own').expect(201);
    const { body: { photo: playerPhoto } } = await addPhoto('pla').expect(201);

    await request(app)
      .delete(`/api/table-games/${gameId}/photos/${ownerPhoto.id}`)
      .set('Authorization', `Bearer ${users.pla.token}`)
      .expect(403);

    await request(app)
      .delete(`/api/table-games/${gameId}/photos/${playerPhoto.id}`)
      .set('Authorization', `Bearer ${users.pla.token}`)
      .expect(200);

    const { body: { photo: secondPlayerPhoto } } = await addPhoto('pla').expect(201);
    await request(app)
      .delete(`/api/table-games/${gameId}/photos/${secondPlayerPhoto.id}`)
      .set('Authorization', `Bearer ${users.own.token}`)
      .expect(200);

    expect(await GamePhoto.countDocuments({ gameId })).toBe(1);
  });

  test('rejects bad image data and enforces the per-game limit', async () => {
    if (skipIfNoMongo()) return;

    await addPhoto('own', { image: 'not a data url' }).expect(400);
    await addPhoto('own', { image: `data:image/svg+xml;base64,${Buffer.from('<svg/>').toString('base64')}` }).expect(400);
    // Declared JPEG, but the bytes are not
    await addPhoto('own', { image: `data:image/jpeg;base64,${Buffer.from('hello world').toString('base64')}` }).expect(400);

    for (let i = 0; i < 6; i += 1) {
      await addPhoto('own').expect(201);
    }
    const res = await addPhoto('own').expect(409);
    expect(res.body.code).toBe('PHOTO_LIMIT');
  });

  test('deleting the game deletes its photos', async () => {
    if (skipIfNoMongo()) return;

    const res = await request(app)
      .post('/api/table-games')
      .set('Authorization', `Bearer ${users.own.token}`)
      .send({
        localId: `table_photo_delete_${Date.now()}`,
        gameData: { gameName: 'Catan', rows: 1, players: [{ id: 'p1', name: users.own.username, points: [3] }] },
      })
      .expect(201);
    const otherGameId = res.body.game._id;

    await request(app)
      .post(`/api/table-games/${otherGameId}/photos`)
      .set('Authorization', `Bearer ${users.own.token}`)
      .send({ image: JPEG_DATA_URL })
      .expect(201);

    await request(app)
      .delete(`/api/table-games/${otherGameId}`)
      .set('Authorization', `Bearer ${users.own.token}`)
      .expect(200);

    expect(await GamePhoto.countDocuments({ gameId: otherGameId })).toBe(0);
  });
});
