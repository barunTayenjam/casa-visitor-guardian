import { describe, it, expect, jest, beforeAll } from '@jest/globals';
import bcrypt from 'bcrypt';

process.env.JWT_ACCESS_SECRET = 'register-role-test-secret-0123456789';
process.env.NODE_ENV = 'test';
process.env.BCRYPT_ROUNDS = '4';

jest.unstable_mockModule('../../database.js', () => ({
  AppDataSource: { isInitialized: true, query: jest.fn() },
}));

jest.unstable_mockModule('../../utils/logger.js', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

describe('Register assigns roles even when roles table is empty', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let AppDataSource: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let authService: any;

  beforeAll(async () => {
    ({ AppDataSource } = await import('../../database.js'));
    authService = (await import('../index.js')).authService;
  });

  it('creates the missing role and assigns its id to the new user', async () => {
    // Fresh-deploy shape: no users, roles lookup returns nothing.
    let adminRoleId: string | null = null;
    AppDataSource.query.mockImplementation(async (sql: string, params: unknown[]) => {
      if (sql.includes('SELECT id FROM users')) return [];
      if (sql.includes('SELECT id FROM roles')) {
        if (!adminRoleId) return [];
        return [{ id: adminRoleId }];
      }
      if (sql.includes('INSERT INTO roles')) {
        adminRoleId = 'role-admin-uuid';
        return [{ id: adminRoleId }];
      }
      if (sql.includes('INSERT INTO users')) {
        return [
          {
            id: params[4] === 'role-admin-uuid' ? 'new-user-id' : 'unassigned',
            username: params[0],
            email: params[1],
            created_at: new Date(),
            updated_at: new Date(),
          },
        ];
      }
      return [];
    });

    const result = await authService.register({
      username: 't-role-user',
      email: 't-role@test.local',
      password: 'Test-Pass-123!',
      role: 'admin',
    });

    // RED today: role lookup returns [] → roleId null → user registered with
    // no role, silently downgraded to 'user' at login time.
    expect(result.success).toBe(true);
    expect(result.user.role).toBe('admin');

    const userInsert = AppDataSource.query.mock.calls.find(
      (c: unknown[]) => typeof c[0] === 'string' && c[0].includes('INSERT INTO users'),
    );
    expect(userInsert).toBeDefined();
    // role_id param (4th) must be the created role's id, not null
    expect(userInsert![1][3]).toBe('role-admin-uuid');
  });

  it('still assigns the role when it already exists', async () => {
    AppDataSource.query.mockClear();
    AppDataSource.query.mockImplementation(async (sql: string) => {
      if (sql.includes('SELECT id FROM users')) return [];
      if (sql.includes('SELECT id FROM roles')) return [{ id: 'existing-role-id' }];
      if (sql.includes('INSERT INTO users')) {
        return [
          {
            id: 'new-user-id-2',
            username: 't-role-user-2',
            email: 't-role2@test.local',
            created_at: new Date(),
            updated_at: new Date(),
          },
        ];
      }
      return [];
    });

    const result = await authService.register({
      username: 't-role-user-2',
      email: 't-role2@test.local',
      password: 'Test-Pass-123!',
      role: 'viewer',
    });

    expect(result.success).toBe(true);
    expect(result.user.role).toBe('viewer');
    const userInsert = AppDataSource.query.mock.calls.find(
      (c: unknown[]) => typeof c[0] === 'string' && c[0].includes('INSERT INTO users'),
    );
    expect(userInsert![1][3]).toBe('existing-role-id');
  });
});
