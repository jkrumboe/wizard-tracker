const request = require('supertest');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const { app, initializeServer } = require('../server');
const { signAuthToken, shouldRenewToken, TOKEN_TTL_DAYS } = require('../utils/authToken');

const DAY_IN_SECONDS = 24 * 60 * 60;

describe('authToken util', () => {
  const user = { _id: '507f1f77bcf86cd799439011', username: 'tokenuser' };

  test('signs a token with the configured long lifetime', () => {
    const payload = jwt.verify(signAuthToken(user), process.env.JWT_SECRET);

    expect(payload.userId).toBe(user._id);
    expect(payload.username).toBe(user.username);
    expect(Math.round((payload.exp - payload.iat) / DAY_IN_SECONDS)).toBe(TOKEN_TTL_DAYS);
    expect(TOKEN_TTL_DAYS).toBeGreaterThanOrEqual(30);
  });

  test('does not renew a freshly issued token', () => {
    const payload = jwt.verify(signAuthToken(user), process.env.JWT_SECRET);

    expect(shouldRenewToken(payload)).toBe(false);
  });

  test('renews a token that is past half its lifetime', () => {
    const now = Math.floor(Date.now() / 1000);
    const lifetime = TOKEN_TTL_DAYS * DAY_IN_SECONDS;

    expect(shouldRenewToken({ iat: now - lifetime * 0.6, exp: now + lifetime * 0.4 })).toBe(true);
  });

  test('ignores payloads without an expiry', () => {
    expect(shouldRenewToken({})).toBe(false);
    expect(shouldRenewToken(null)).toBe(false);
  });
});

describe('POST /api/users/refresh', () => {
  let mongoConnected = false;
  let token;

  beforeAll(async () => {
    try {
      await initializeServer();
      mongoConnected = mongoose.connection.readyState === 1;
    } catch (err) {
      console.warn('Failed to initialize server:', err.message);
      mongoConnected = false;
    }

    if (!mongoConnected) return;

    const response = await request(app)
      .post('/api/users/register')
      .send({ username: 'refreshuser', password: 'refreshpass123' });

    token = response.body.token;
  }, 30000);

  test('returns a fresh token for a valid session', async () => {
    if (!mongoConnected) {
      console.warn('⚠️ Skipping test - MongoDB not connected');
      return;
    }

    const response = await request(app)
      .post('/api/users/refresh')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(response.body.token).toBeDefined();
    expect(response.body.user.username).toBe('refreshuser');

    const payload = jwt.verify(response.body.token, process.env.JWT_SECRET);
    expect(payload.username).toBe('refreshuser');
    expect(payload.exp).toBeGreaterThanOrEqual(jwt.decode(token).exp);
  });

  test('rejects a request without a token', async () => {
    await request(app).post('/api/users/refresh').expect(401);
  });
});
