import { jest } from '@jest/globals';
import express from 'express';
import request from 'supertest';

jest.unstable_mockModule('../controllers/AuthController.js', () => ({
  authController: {
    register: jest.fn((req: any, res: any) =>
      res.status(201).json({ success: true, user: req.body }),
    ),
    login: jest.fn((req: any, res: any) =>
      res.status(200).json({ success: true, token: 'fake-token' }),
    ),
    me: jest.fn((req: any, res: any) => res.status(200).json({ user: { id: 'test-123' } })),
    getProfile: jest.fn((req: any, res: any) => res.status(200).json({ user: { id: 'test-123' } })),
    changePassword: jest.fn((req: any, res: any) => res.status(200).json({ success: true })),
    refreshToken: jest.fn((req: any, res: any) =>
      res.status(200).json({ success: true, token: 'fake-token' }),
    ),
    mfaChallenge: jest.fn((req: any, res: any) => res.status(200).json({ success: true })),
    logout: jest.fn((req: any, res: any) => res.status(200).json({ success: true })),
    setupMfa: jest.fn((req: any, res: any) => res.status(200).json({ success: true })),
    verifyMfa: jest.fn((req: any, res: any) => res.status(200).json({ success: true })),
    disableMfa: jest.fn((req: any, res: any) => res.status(200).json({ success: true })),
  },
}));

jest.unstable_mockModule('../middleware/auth.js', () => ({
  authenticate: jest.fn((options: any) => (req: any, res: any, next: any) => {
    req.user = { userId: 'admin-123', role: 'admin' };
    next();
  }),
}));

jest.unstable_mockModule('../middleware/enhancedRateLimit.js', () => ({
  createAuthRateLimit: jest.fn(() => (req: any, res: any, next: any) => next()),
  createMfaRateLimit: jest.fn(() => (req: any, res: any, next: any) => next()),
  EnhancedRateLimit: jest.fn().mockImplementation(() => ({
    middleware: jest.fn(() => (req: any, res: any, next: any) => next()),
  })),
}));

jest.unstable_mockModule('../middleware/zodValidation.js', () => ({
  validateBody: jest.fn(() => (req: any, res: any, next: any) => next()),
}));

describe('Authentication Routes', () => {
  let app: express.Express;

  beforeEach(async () => {
    const authRoutes = (await import('./auth.js')).default;
    app = express();
    app.use(express.json());
    app.use('/api/auth', authRoutes);
  });

  it('should register a new user', async () => {
    const response = await request(app).post('/api/auth/register').send({
      username: 'TestUser1',
      email: 'newuser@example.com',
      password: 'Password123!',
    });
    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
  });

  it('should login with valid credentials', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({ username: 'TestUser1', password: 'Password123!' });
    expect(response.status).toBe(200);
    expect(response.body.token).toBe('fake-token');
  });

  it('should return authenticated user', async () => {
    const response = await request(app).get('/api/auth/profile');
    expect(response.status).toBe(200);
  });
});
