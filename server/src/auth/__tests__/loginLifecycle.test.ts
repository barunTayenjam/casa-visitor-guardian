import { describe, it, expect, jest, beforeAll } from '@jest/globals';
import bcrypt from 'bcrypt';

process.env.JWT_ACCESS_SECRET = 'login-lifecycle-test-secret-0123456789';
process.env.NODE_ENV = 'test';
process.env.BCRYPT_ROUNDS = '4';

jest.unstable_mockModule('../../database.js', () => ({
  AppDataSource: { isInitialized: true, query: jest.fn() },
}));

jest.unstable_mockModule('../../utils/logger.js', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

describe('Wave 3 login lifecycle', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let AppDataSource: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let cacheService: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let authService: any;

  const PASSWORD = 'Correct-Horse-1!';
  const USER_ID = 'u-login-1';

  beforeAll(async () => {
    ({ AppDataSource } = await import('../../database.js'));
    cacheService = (await import('../../services/cacheService.js')).default;
    authService = (await import('../index.js')).authService;
  });

  const stubUser = async (overrides: Record<string, unknown> = {}) => {
    const hash = await bcrypt.hash(PASSWORD, 4);
    AppDataSource.query.mockImplementation(async (sql: string) => {
      if (sql.includes('SELECT') && sql.includes('failed_login_attempts')) {
        return [
          {
            id: USER_ID,
            username: 'tester',
            email: 't@x.io',
            password_hash: hash,
            status: 'active',
            failed_login_attempts: 0,
            locked_until: null,
            mfa_enabled: false,
            role_name: 'admin',
            created_at: new Date(),
            updated_at: new Date(),
          },
        ];
      }
      return [];
    });
    return hash;
  };

  it('invalidates the session-validity cache on successful login (30s 401 race)', async () => {
    await stubUser();
    // A pre-login probe cached "no active session" for this user.
    await cacheService.set(`auth:session:${USER_ID}`, '0', 30);
    expect(await cacheService.get(`auth:session:${USER_ID}`)).toBe('0');

    const result = await authService.login({ username: 'tester', password: PASSWORD });
    expect(result.success).toBe(true);
    expect(await cacheService.get(`auth:session:${USER_ID}`)).toBeNull();
  });

  it('revokes all sessions when a login failure locks the account', async () => {
    const hash = await bcrypt.hash(PASSWORD, 4);
    AppDataSource.query.mockImplementation(async (sql: string) => {
      if (sql.includes('failed_login_attempts')) {
        return [
          {
            id: USER_ID,
            username: 'tester',
            email: 't@x.io',
            password_hash: hash,
            status: 'active',
            // Already at the default MAX_LOGIN_ATTEMPTS=5 → next failure locks.
            failed_login_attempts: 5,
            locked_until: null,
            mfa_enabled: false,
            role_name: 'admin',
            created_at: new Date(),
            updated_at: new Date(),
          },
        ];
      }
      return [];
    });

    const result = await authService.login({ username: 'tester', password: 'wrong-password' });
    expect(result.success).toBe(false);
    const revoke = AppDataSource.query.mock.calls.find((c: unknown[]) =>
      String(c[0]).includes('DELETE FROM user_sessions'),
    );
    expect(revoke).toBeDefined();
  });
});
