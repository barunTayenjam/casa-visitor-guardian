import { describe, it, expect, jest, beforeEach } from '@jest/globals';

jest.mock('../../utils/logger.js', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    apiRequest: jest.fn(),
    apiResponse: jest.fn(),
    apiError: jest.fn(),
    socketConnect: jest.fn(),
    socketDisconnect: jest.fn(),
    socketError: jest.fn(),
    streamRequest: jest.fn(),
    streamStop: jest.fn(),
    serverStart: jest.fn(),
    corsBlock: jest.fn(),
    motionDetected: jest.fn(),
    motionError: jest.fn(),
    performance: jest.fn(),
    memoryUsage: jest.fn(),
  },
}));

jest.mock('../../utils/auditLogger.js', () => ({
  default: {
    log: jest.fn(),
    logEvent: jest.fn(),
    logApi: jest.fn(),
    getClientIP: jest.fn().mockReturnValue('127.0.0.1'),
    getUserId: jest.fn(),
    getUsername: jest.fn(),
    auditMiddleware: jest.fn(),
  },
  auditMiddleware: jest.fn(),
}));

import { AuthController } from '../AuthController.js';

const mockLogin: any = jest.fn();
const mockRegister: any = jest.fn();
const mockGetUserById: any = jest.fn();
const mockVerifyToken: any = jest.fn();
const mockGenerateToken: any = jest.fn();
const mockChangePassword: any = jest.fn();

const mockAuthService: any = {
  login: mockLogin,
  register: mockRegister,
  getUserById: mockGetUserById,
  verifyToken: mockVerifyToken,
  generateToken: mockGenerateToken,
  changePassword: mockChangePassword,
  hashPassword: jest.fn(),
  comparePassword: jest.fn(),
  getAllUsers: jest.fn(),
  updateUser: jest.fn(),
  deleteUser: jest.fn(),
};

function createMockRes(): any {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
}

describe('AuthController', () => {
  let controller: AuthController;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new AuthController(mockAuthService);
  });

  describe('login', () => {
    it('should return 200 with user and token on valid credentials', async () => {
      mockLogin.mockResolvedValue({
        success: true,
        user: { id: '1', username: 'admin', email: 'admin@test.com', role: 'admin' },
        token: 'jwt-token-123',
      });

      const req: any = {
        body: { username: 'admin', password: 'password123' },
        headers: {},
        get: jest.fn(),
        ip: '127.0.0.1',
      };
      const res = createMockRes();

      await controller.login(req, res);

      expect(mockLogin).toHaveBeenCalledWith({ username: 'admin', password: 'password123' });
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          token: 'jwt-token-123',
        })
      );
      const jsonCall = res.json.mock.calls[0][0];
      expect(jsonCall.user.username).toBe('admin');
    });

    it('should return 401 on invalid credentials', async () => {
      mockLogin.mockResolvedValue({
        success: false,
        error: 'Invalid username or password',
      });

      const req: any = {
        body: { username: 'admin', password: 'wrong' },
        headers: {},
        get: jest.fn(),
        ip: '127.0.0.1',
      };
      const res = createMockRes();

      await controller.login(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'Invalid username or password',
        })
      );
    });
  });

  describe('register', () => {
    it('should return 201 on successful registration', async () => {
      mockRegister.mockResolvedValue({
        success: true,
        user: { id: '2', username: 'newuser', email: 'new@test.com' },
        token: 'reg-token-456',
      });

      const req: any = {
        body: { username: 'newuser', email: 'new@test.com', password: 'pass123', role: 'user' },
        headers: {},
        get: jest.fn(),
        ip: '127.0.0.1',
      };
      const res = createMockRes();

      await controller.register(req, res);

      expect(mockRegister).toHaveBeenCalledWith({
        username: 'newuser',
        email: 'new@test.com',
        password: 'pass123',
        role: 'user',
      });
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          token: 'reg-token-456',
        })
      );
    });

    it('should return 400 on failed registration', async () => {
      mockRegister.mockResolvedValue({
        success: false,
        error: 'User with this username or email already exists',
      });

      const req: any = {
        body: { username: 'admin', email: 'admin@test.com', password: 'pass123' },
        headers: {},
        get: jest.fn(),
        ip: '127.0.0.1',
      };
      const res = createMockRes();

      await controller.register(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
        })
      );
    });
  });

  describe('refreshToken', () => {
    it('should return 200 with new token for valid token', async () => {
      mockVerifyToken.mockReturnValue({ userId: '1', username: 'admin', role: 'admin' });
      mockGetUserById.mockResolvedValue({
        id: '1',
        username: 'admin',
        email: 'admin@test.com',
        role: 'admin',
      });
      mockGenerateToken.mockReturnValue('new-jwt-token');

      const req: any = {
        headers: { authorization: 'Bearer old-token' },
        get: jest.fn(),
      };
      const res = createMockRes();

      await controller.refreshToken(req, res);

      expect(mockVerifyToken).toHaveBeenCalledWith('old-token');
      expect(mockGenerateToken).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          token: 'new-jwt-token',
        })
      );
    });

    it('should return 401 when no token provided', async () => {
      const req: any = {
        headers: { authorization: null },
        get: jest.fn(),
      };
      const res = createMockRes();

      await controller.refreshToken(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'No token provided',
        })
      );
    });
  });

  describe('changePassword', () => {
    it('should return 200 on successful password change', async () => {
      mockChangePassword.mockResolvedValue({ success: true });

      const req: any = {
        user: { userId: '1', username: 'admin' },
        body: { currentPassword: 'oldPass', newPassword: 'newPass' },
        get: jest.fn(),
      };
      const res = createMockRes();

      await controller.changePassword(req, res);

      expect(mockChangePassword).toHaveBeenCalledWith('1', 'oldPass', 'newPass');
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: 'Password changed successfully',
        })
      );
    });
  });

  describe('getProfile', () => {
    it('should return 200 with user profile for authenticated user', async () => {
      mockGetUserById.mockResolvedValue({
        id: '1',
        username: 'admin',
        email: 'admin@test.com',
        role: 'admin',
      });

      const req: any = {
        user: { userId: '1', username: 'admin' },
        get: jest.fn(),
      };
      const res = createMockRes();

      await controller.getProfile(req, res);

      expect(mockGetUserById).toHaveBeenCalledWith('1');
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
        })
      );
      const jsonCall = res.json.mock.calls[0][0];
      expect(jsonCall.user.username).toBe('admin');
    });
  });
});
