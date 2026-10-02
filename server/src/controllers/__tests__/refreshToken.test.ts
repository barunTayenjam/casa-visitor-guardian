import { describe, it, expect, jest, beforeAll } from '@jest/globals';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import speakeasyPkg from 'speakeasy';

process.env.JWT_ACCESS_SECRET = 'refresh-flow-test-secret-0123456789abcdef';
process.env.NODE_ENV = 'test';

jest.unstable_mockModule('../../database.js', () => ({
  AppDataSource: { isInitialized: true, query: jest.fn() },
}));

jest.unstable_mockModule('../../utils/auditLogger.js', () => ({
  default: { log: jest.fn(), getClientIP: jest.fn(() => '127.0.0.1') },
}));

jest.unstable_mockModule('../../utils/logger.js', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

jest.unstable_mockModule('../../middleware/auth.js', () => ({
  invalidateSessionCache: jest.fn(),
  authenticate: jest.fn(() => (req: unknown, _res: unknown, next: () => void) => next()),
  optionalAuth: jest.fn(() => (req: unknown, _res: unknown, next: () => void) => next()),
  requireUser: jest.fn(() => (req: unknown, _res: unknown, next: () => void) => next()),
  requireAdmin: jest.fn(() => (req: unknown, _res: unknown, next: () => void) => next()),
}));

const mockRes = () => {
  const res: Record<string, unknown> = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.get = jest.fn();
  return res as never;
};

describe('Wave 3 real refresh flow', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let AppDataSource: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let AuthController: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let authService: any;

  const USER_ID = 'u-ref-1';

  beforeAll(async () => {
    ({ AppDataSource } = await import('../../database.js'));
    ({ AuthController } = await import('../AuthController.js'));
    ({ authService } = await import('../../auth/index.js'));
  });

  const makeController = () => new AuthController(authService);

  const user = {
    id: USER_ID,
    username: 'tester',
    email: 't@x.io',
    role: 'admin',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastLogin: new Date(),
  };

  const stubDb = (sessionRows: unknown[]) => {
    AppDataSource.query.mockImplementation(async (sql: string) => {
      if (sql.includes('SELECT') && sql.includes('u.id, u.username, u.email, u.status, r.name as role_name, u.created_at, u.updated_at, u.last_login')) {
        return [
          {
            id: USER_ID,
            username: 'tester',
            email: 't@x.io',
            status: 'active',
            role_name: 'admin',
            created_at: new Date(),
            updated_at: new Date(),
            last_login: new Date(),
          },
        ];
      }
      if (sql.includes('refresh_token') && sql.includes('SELECT')) {
        return sessionRows;
      }
      return [];
    });
  };

  it('rejects a request with no refresh token', async () => {
    stubDb([]);
    const controller = makeController();
    const res = mockRes();
    await controller.refreshToken({ body: {}, user: undefined } as never, res);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('rejects an access token presented as a refresh token', async () => {
    stubDb([]);
    const access = authService.generateToken({
      ...user,
      password: '',
    });
    const controller = makeController();
    const res = mockRes();
    await controller.refreshToken({ body: { refreshToken: access }, user: undefined } as never, res);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('rejects when no active session row matches the refresh token', async () => {
    stubDb([]);
    const refresh = authService.generateRefreshToken({ ...user, password: '' });
    const controller = makeController();
    const res = mockRes();
    await controller.refreshToken({ body: { refreshToken: refresh }, user: undefined } as never, res);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('rotates both tokens and persists the new refresh hash on a valid refresh', async () => {
    stubDb([{ id: 'sess-1' }]);
    const refresh = authService.generateRefreshToken({ ...user, password: '' });
    const controller = makeController();
    const res = mockRes();
    await controller.refreshToken({ body: { refreshToken: refresh }, user: undefined } as never, res);

    const body = (res.json as jest.Mock).mock.calls.at(-1)?.[0] as {
      success: boolean;
      token: string;
      refreshToken: string;
    };
    expect(body.success).toBe(true);
    expect(jwt.verify(body.token, process.env.JWT_ACCESS_SECRET as string)).toBeTruthy();
    expect(jwt.verify(body.refreshToken, process.env.JWT_ACCESS_SECRET as string)).toMatchObject({
      purpose: 'refresh',
    });
    // Rotated refresh must differ from the one presented.
    expect(body.refreshToken).not.toBe(refresh);

    const update = AppDataSource.query.mock.calls.find((c: unknown[]) =>
      String(c[0]).includes('UPDATE user_sessions'),
    );
    expect(update).toBeDefined();
  });

  it('mfaChallenge session insert stores the refresh-token hash, not a copy of the access token', async () => {
    const secret = speakeasyPkg.generateSecret({ length: 20 }).base32 as string;
    const pending = jwt.sign(
      { userId: USER_ID, purpose: 'mfa', jti: crypto.randomUUID() },
      process.env.JWT_ACCESS_SECRET as string,
      { expiresIn: '5m' },
    );
    AppDataSource.query.mockImplementation(async (sql: string) => {
      if (sql.includes('mfa_secret, username, email')) {
        return [{ mfa_secret: secret, username: 'tester', email: 't@x.io' }];
      }
      if (sql.includes('u.status')) {
        return [
          {
            id: USER_ID,
            username: 'tester',
            email: 't@x.io',
            status: 'active',
            role_name: 'admin',
            created_at: new Date(),
            updated_at: new Date(),
          },
        ];
      }
      return [];
    });
    const controller = makeController();
    const res = mockRes();
    await controller.mfaChallenge(
      {
        body: { pendingToken: pending, code: speakeasyPkg.totp({ secret, encoding: 'base32' }) },
        get: () => '',
      } as never,
      res,
    );

    const sessionInsert = AppDataSource.query.mock.calls.find((c: unknown[]) =>
      String(c[0]).includes('INSERT INTO user_sessions'),
    );
    expect(sessionInsert).toBeDefined();
    const [, refreshHash, accessHash] = sessionInsert[1] as string[];
    expect(refreshHash).toBeDefined();
    // The whole bug: refresh_token was a copy of sha256(access token).
    expect(refreshHash).not.toBe(accessHash);
  });
});
