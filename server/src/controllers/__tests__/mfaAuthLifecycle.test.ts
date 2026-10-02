import { describe, it, expect, jest, beforeAll } from '@jest/globals';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import speakeasy from 'speakeasy';

process.env.JWT_ACCESS_SECRET = 'mfa-lifecycle-test-secret-0123456789abcdef';
process.env.NODE_ENV = 'test';
process.env.BCRYPT_ROUNDS = '4';

jest.unstable_mockModule('../../database.js', () => ({
  AppDataSource: { isInitialized: true, query: jest.fn() },
}));

jest.unstable_mockModule('../../utils/auditLogger.js', () => ({
  default: {
    log: jest.fn(),
    getClientIP: jest.fn(() => '127.0.0.1'),
  },
}));

jest.unstable_mockModule('../../utils/logger.js', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

jest.unstable_mockModule('../../middleware/auth.js', () => ({
  invalidateSessionCache: jest.fn(),
}));

const mockRes = () => {
  const res: Record<string, unknown> = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.get = jest.fn();
  return res as never;
};

describe('Wave 3 auth lifecycle', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let AppDataSource: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let AuthController: any;

  const PASSWORD = 'Correct-Horse-1!';
  const USER_ID = 'u-1';

  beforeAll(async () => {
    ({ AppDataSource } = await import('../../database.js'));
    ({ AuthController } = await import('../AuthController.js'));
  });

  describe('mfaChallenge gates on account status', () => {
    const makeController = async () => new AuthController((await import('../../auth/index.js')).authService);
    const pendingToken = () =>
      jwt.sign(
        { userId: USER_ID, purpose: 'mfa', jti: crypto.randomUUID() },
        process.env.JWT_ACCESS_SECRET as string,
        { expiresIn: '5m' },
      );

    const stubUserRows = (status: string, mfaSecret: string, passwordHash: string) => {
      AppDataSource.query.mockImplementation(async (sql: string) => {
        if (sql.includes('mfa_secret, username, email')) {
          return [{ mfa_secret: mfaSecret, username: 'tester', email: 't@x.io' }];
        }
        if (sql.includes('u.status')) {
          return [
            {
              id: USER_ID,
              username: 'tester',
              email: 't@x.io',
              status,
              role_name: 'admin',
              created_at: new Date(),
              updated_at: new Date(),
              password_hash: passwordHash,
            },
          ];
        }
        return [];
      });
    };

    it('refuses to issue a JWT for a disabled account', async () => {
      const secret = speakeasy.generateSecret({ length: 20 }).base32 as string;
      const hash = await bcrypt.hash(PASSWORD, 4);
      stubUserRows('disabled', secret, hash);
      const controller = await makeController();
      const req = {
        body: { pendingToken: pendingToken(), code: speakeasy.totp({ secret, encoding: 'base32' }) },
        get: () => '',
      } as never;
      const res = mockRes();
      await controller.mfaChallenge(req, res);
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: false, error: expect.stringContaining('disabled') }),
      );
    });

    it('still succeeds for an active account', async () => {
      const secret = speakeasy.generateSecret({ length: 20 }).base32 as string;
      stubUserRows('active', secret, await bcrypt.hash(PASSWORD, 4));
      const controller = await makeController();
      const req = {
        body: { pendingToken: pendingToken(), code: speakeasy.totp({ secret, encoding: 'base32' }) },
        get: () => '',
      } as never;
      const res = mockRes();
      await controller.mfaChallenge(req, res);
      expect(res.status).not.toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true, token: expect.any(String) }),
      );
    });
  });

  describe('disableMfa requires re-authentication', () => {
    const makeController = async () => new AuthController((await import('../../auth/index.js')).authService);
    const baseReq = (body: Record<string, unknown>) =>
      ({ body, user: { userId: USER_ID, username: 'tester', role: 'admin' }, get: () => '' }) as never;

    const stubUser = async (hash: string) => {
      AppDataSource.query.mockImplementation(async (sql: string) => {
        if (sql.includes('password_hash')) {
          return [{ password_hash: hash, mfa_enabled: true }];
        }
        return [];
      });
    };

    it('rejects when no current password or TOTP code is provided', async () => {
      const controller = await makeController();
      const res = mockRes();
      await controller.disableMfa(baseReq({}), res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('rejects a wrong current password', async () => {
      await stubUser(await bcrypt.hash(PASSWORD, 4));
      const controller = await makeController();
      const res = mockRes();
      await controller.disableMfa(baseReq({ currentPassword: 'wrong' }), res);
      expect(res.status).toHaveBeenCalledWith(401);
    });

    it('disables MFA with the correct current password', async () => {
      await stubUser(await bcrypt.hash(PASSWORD, 4));
      const controller = await makeController();
      const res = mockRes();
      await controller.disableMfa(baseReq({ currentPassword: PASSWORD }), res);
      expect(res.status).not.toHaveBeenCalledWith(400);
      expect(res.status).not.toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
      const update = AppDataSource.query.mock.calls.find(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (c: any[]) => String(c[0]).includes('mfa_enabled = false'),
      );
      expect(update).toBeDefined();
    });
  });
});
