import { describe, it, expect, jest } from '@jest/globals';
import request from 'supertest';
import jwt from 'jsonwebtoken';

jest.mock('../middleware/authenticate.js');
jest.mock('../config/index.js');

describe('Authentication Routes', () => {
  let app: any;
  let mockDb: any;

  beforeEach(() => {
    app = require('./index.ts').default;
    mockDb = {
      getRepository: jest.fn(),
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/auth/register', () => {
    it('should register a new user', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'newuser',
          email: 'newuser@example.com',
          password: 'Password123!'
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.user.username).toBe('newuser');
      expect(response.body.token).toBeDefined();
    });

    it('should reject duplicate username', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'existinguser',
          email: 'different@example.com',
          password: 'Password123!'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should validate password requirements', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'testuser',
          email: 'test@example.com',
          password: 'short'
        });

      expect(response.status).toBe(400);
    });

    it('should validate email format', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'testuser',
          email: 'invalid-email',
          password: 'Password123!'
        });

      expect(response.status).toBe(400);
    });
  });

  describe('POST /api/auth/login', () => {
    it('should login with valid credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'testuser',
          password: 'Password123!'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.token).toBeDefined();
      expect(response.body.user).toBeDefined();
    });

    it('should reject invalid credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'testuser',
          password: 'wrongpassword'
        });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/auth/me', () => {
    it('should return authenticated user', async () => {
      const validToken = jwt.sign({ userId: 'test-123' }, 'test-secret');
      
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${validToken}`);

      expect(response.status).toBe(200);
      expect(response.body.user.id).toBe('test-123');
    });

    it('should reject invalid token', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer invalid-token');

      expect(response.status).toBe(401);
    });
  });
});
