const request = require('supertest');
const { app, initializeServer } = require('../server');
const User = require('../models/User');
const mongoose = require('mongoose');

let mongoConnected = false;

// Initialize server before all tests
beforeAll(async () => {
  try {
    await initializeServer();
    mongoConnected = mongoose.connection.readyState === 1;
  } catch (err) {
    console.warn('Failed to initialize server:', err.message);
    mongoConnected = false;
  }
}, 30000); // 30 second timeout for server initialization

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
    if (!mongoConnected) {
      console.warn('⚠️ Skipping test - MongoDB not connected');
      return;
    }
    
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
    if (!mongoConnected) {
      console.warn('⚠️ Skipping test - MongoDB not connected');
      return;
    }
    
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
    if (!mongoConnected) {
      console.warn('⚠️ Skipping Admin Authorization tests - MongoDB not connected');
      return;
    }
    
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
      if (!mongoConnected) { console.warn('⚠️ Skipping test - MongoDB not connected'); return; }
      
      const response = await request(app)
        .get('/api/users/admin/all')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.users).toBeDefined();
      expect(Array.isArray(response.body.users)).toBe(true);
      expect(response.body.users.length).toBeGreaterThan(0);
    });

    test('should deny access to non-admin users', async () => {
      if (!mongoConnected) { console.warn('⚠️ Skipping test - MongoDB not connected'); return; }
      
      const response = await request(app)
        .get('/api/users/admin/all')
        .set('Authorization', `Bearer ${regularUserToken}`)
        .expect(403);

      expect(response.body.error).toBe('Admin access required');
    });

    test('should deny access to unauthenticated requests', async () => {
      if (!mongoConnected) { console.warn('⚠️ Skipping test - MongoDB not connected'); return; }
      
      await request(app)
        .get('/api/users/admin/all')
        .expect(401);
    });
  });

  describe('PUT /api/users/:userId/username', () => {
    test('should allow admin users to update usernames', async () => {
      if (!mongoConnected) { console.warn('⚠️ Skipping test - MongoDB not connected'); return; }
      
      const response = await request(app)
        .put(`/api/users/${regularUserId}/username`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ username: 'updatedusername' })
        .expect(200);

      expect(response.body.message).toBe('Username updated successfully across all records');
      expect(response.body.user.username).toBe('updatedusername');
    });

    test('should deny access to non-admin users', async () => {
      if (!mongoConnected) { console.warn('⚠️ Skipping test - MongoDB not connected'); return; }
      
      const response = await request(app)
        .put(`/api/users/${regularUserId}/username`)
        .set('Authorization', `Bearer ${regularUserToken}`)
        .send({ username: 'hackername' })
        .expect(403);

      expect(response.body.error).toBe('Admin access required');
    });

    test('should deny access to unauthenticated requests', async () => {
      if (!mongoConnected) { console.warn('⚠️ Skipping test - MongoDB not connected'); return; }
      
      await request(app)
        .put(`/api/users/${regularUserId}/username`)
        .send({ username: 'hackername' })
        .expect(401);
    });
  });

  describe('PUT /api/users/:userId/role', () => {
    test('should allow admin users to update user roles', async () => {
      if (!mongoConnected) { console.warn('⚠️ Skipping test - MongoDB not connected'); return; }
      
      const response = await request(app)
        .put(`/api/users/${regularUserId}/role`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ role: 'admin' })
        .expect(200);

      expect(response.body.message).toBe('User role updated successfully');
      expect(response.body.user.role).toBe('admin');
    });

    test('should deny access to non-admin users', async () => {
      if (!mongoConnected) { console.warn('⚠️ Skipping test - MongoDB not connected'); return; }
      
      const response = await request(app)
        .put(`/api/users/${adminUserId}/role`)
        .set('Authorization', `Bearer ${regularUserToken}`)
        .send({ role: 'admin' })
        .expect(403);

      expect(response.body.error).toBe('Admin access required');
    });

    test('should deny access to unauthenticated requests', async () => {
      if (!mongoConnected) { console.warn('⚠️ Skipping test - MongoDB not connected'); return; }
      
      await request(app)
        .put(`/api/users/${regularUserId}/role`)
        .send({ role: 'admin' })
        .expect(401);
    });

    test('should reject invalid role values', async () => {
      if (!mongoConnected) { console.warn('⚠️ Skipping test - MongoDB not connected'); return; }
      
      const response = await request(app)
        .put(`/api/users/${regularUserId}/role`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ role: 'superadmin' })
        .expect(400);

      expect(response.body.error).toBe('Invalid role. Must be "user" or "admin"');
    });
  });
});
