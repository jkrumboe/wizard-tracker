const request = require('supertest');
const app = require('../server');

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
