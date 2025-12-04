const request = require('supertest');
const app = require('../server');
const User = require('../models/User');

describe('API Health Check', () => {
  test('GET /api/health should return OK status', async () => {
    const response = await request(app)
      .get('/api/health')
      .expect(200);
    
    expect(response.body).toEqual({
      status: 'OK',
      message: 'Server is running'
    });
  });
});

describe('User Registration and Login', () => {
  test('POST /api/users/register should create a new user', async () => {
    const userData = {
      username: 'testuser',
      password: 'password123'
    };

    const response = await request(app)
      .post('/api/users/register')
      .send(userData)
      .expect(201);

    expect(response.body.message).toBe('User created successfully');
    expect(response.body.token).toBeDefined();
    expect(response.body.user.username).toBe('testuser');
  });

  test('POST /api/users/login should authenticate user', async () => {
    const loginData = {
      username: 'testuser',
      password: 'password123'
    };

    const response = await request(app)
      .post('/api/users/login')
      .send(loginData)
      .expect(200);

    expect(response.body.message).toBe('Login successful');
    expect(response.body.token).toBeDefined();
  });
});

describe('Admin Authorization', () => {
  let adminToken;
  let regularUserToken;
  let adminUserId;
  let regularUserId;

  beforeAll(async () => {
    // Create admin user
    const adminResponse = await request(app)
      .post('/api/users/register')
      .send({
        username: 'adminuser',
        password: 'adminpass123'
      });
    
    adminToken = adminResponse.body.token;
    adminUserId = adminResponse.body.user.id;

    // Update user to admin role directly in database
    await User.findByIdAndUpdate(adminUserId, { role: 'admin' });

    // Create regular user
    const userResponse = await request(app)
      .post('/api/users/register')
      .send({
        username: 'regularuser',
        password: 'regularpass123'
      });
    
    regularUserToken = userResponse.body.token;
    regularUserId = userResponse.body.user.id;
  });

  describe('GET /api/users/admin/all', () => {
    test('should allow admin users to get all users', async () => {
      const response = await request(app)
        .get('/api/users/admin/all')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.users).toBeDefined();
      expect(Array.isArray(response.body.users)).toBe(true);
      expect(response.body.users.length).toBeGreaterThan(0);
    });

    test('should deny access to non-admin users', async () => {
      const response = await request(app)
        .get('/api/users/admin/all')
        .set('Authorization', `Bearer ${regularUserToken}`)
        .expect(403);

      expect(response.body.error).toBe('Admin access required');
    });

    test('should deny access to unauthenticated requests', async () => {
      await request(app)
        .get('/api/users/admin/all')
        .expect(401);
    });
  });

  describe('PUT /api/users/:userId/username', () => {
    test('should allow admin users to update usernames', async () => {
      const response = await request(app)
        .put(`/api/users/${regularUserId}/username`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ username: 'updatedusername' })
        .expect(200);

      expect(response.body.message).toBe('Username updated successfully across all records');
      expect(response.body.user.username).toBe('updatedusername');
    });

    test('should deny access to non-admin users', async () => {
      const response = await request(app)
        .put(`/api/users/${regularUserId}/username`)
        .set('Authorization', `Bearer ${regularUserToken}`)
        .send({ username: 'hackername' })
        .expect(403);

      expect(response.body.error).toBe('Admin access required');
    });

    test('should deny access to unauthenticated requests', async () => {
      await request(app)
        .put(`/api/users/${regularUserId}/username`)
        .send({ username: 'hackername' })
        .expect(401);
    });
  });

  describe('PUT /api/users/:userId/role', () => {
    test('should allow admin users to update user roles', async () => {
      const response = await request(app)
        .put(`/api/users/${regularUserId}/role`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ role: 'admin' })
        .expect(200);

      expect(response.body.message).toBe('User role updated successfully');
      expect(response.body.user.role).toBe('admin');
    });

    test('should deny access to non-admin users', async () => {
      const response = await request(app)
        .put(`/api/users/${adminUserId}/role`)
        .set('Authorization', `Bearer ${regularUserToken}`)
        .send({ role: 'admin' })
        .expect(403);

      expect(response.body.error).toBe('Admin access required');
    });

    test('should deny access to unauthenticated requests', async () => {
      await request(app)
        .put(`/api/users/${regularUserId}/role`)
        .send({ role: 'admin' })
        .expect(401);
    });

    test('should reject invalid role values', async () => {
      const response = await request(app)
        .put(`/api/users/${regularUserId}/role`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ role: 'superadmin' })
        .expect(400);

      expect(response.body.error).toBe('Invalid role. Must be "user" or "admin"');
    });
  });
});
