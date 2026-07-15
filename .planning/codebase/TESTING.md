# Testing Patterns

**Last updated:** 2026-07-16
**Focus:** Testing approach and practices

## Test Framework

- **Framework:** Jest 30.x (`jest@^30.2.0`)
- **Runner:** `ts-jest` 29.x for TypeScript transformation (both frontend and server)
- **Configuration:**
  - Frontend: `frontend/jest.config.ts` — jsdom environment, `testMatch: ['**/__tests__/**/*.{test,spec}.{ts,tsx}']`
  - Frontend setup: `frontend/jest.setup.ts` — imports `@testing-library/jest-dom`, mocks `import.meta.env`
  - Server: `server/jest.config.js` — node environment, `testMatch: ['**/__tests__/**/*.ts', '**/?(*.)+(spec|test).ts']`
  - Root: `jest.config.js` at repo root — uses `preset: 'ts-jest/presets/default-esm'`, roots to `server/src/`

## Test Structure

- **Location:** Tests are co-located in three directories:
  - `frontend/src/__tests__/` — Frontend tests (unit, import checks)
  - `server/src/` — Tests co-located beside source files (e.g., `auth.test.ts`, `database.test.ts`, `batchDetection.test.ts`, `reviewRoutes.test.ts`)
  - `server/tests/` — Server integration/service tests (e.g., `services/authenticationService.test.ts`, `utils/factories.ts`)
- **Naming:** `*.test.ts` pattern (no `.spec.ts` files found). Backend tests use `describe`/`it` from `@jest/globals`.
- **Organization:** `describe` blocks nested by feature/endpoint. Suites follow Arrange-Act-Assert structure.

## Test Types

| Type | Location | Frequency | Purpose |
|------|----------|-----------|---------|
| Unit (error classes) | `frontend/src/__tests__/baseClient.test.ts` | 1 suite | Validate error class instantiation |
| Unit (imports) | `frontend/src/__tests__/importTest.test.ts` | 1 file | Sanity check module resolution |
| Auth service unit | `server/tests/services/authenticationService.test.ts` | 1 file (533 lines) | Full auth flow with mocked dependencies |
| Route integration | `server/src/routes/auth.test.ts`, `batchDetection.test.ts`, `reviewRoutes.test.ts` | 3 files | API endpoint testing with supertest |
| DB initialization | `server/src/database.test.ts` | 1 file | DB connection lifecycle |
| Basic sanity | `server/tests/basic.test.ts`, `simple.test.ts`, `setup.test.ts` | 3 files | Verify test runner works |
| Express middleware | `server/src/index.test.ts` | 1 file | CORS, helmet, error handling |

## Mocking & Fixtures

- **Mocking library:** Jest manual mocks (`__mocks__/`) and `jest.mock()`.
- **Manual mock directory:** `frontend/src/__mocks__/` — currently mocks 3 modules:
  - `services/api/baseClient.ts` — Simplified `ApiError`/`fetchWithRetry` that does not throw on non-2xx
  - `services/api/authService.ts` — Auto-resolves all methods with `{ success: true }`
  - `lib/logger.ts` — No-op stubs for all log methods
- **Jest mock config** (`frontend/jest.config.ts`):
```typescript
moduleNameMapper: {
  '^@/services/api/baseClient$': '<rootDir>/src/__mocks__/services/api/baseClient.ts',
  '^@/services/api/authService$': '<rootDir>/src/__mocks__/services/api/authService.ts',
  '^@/lib/logger$': '<rootDir>/src/__mocks__/lib/logger.ts',
  '^@/(.*)$': '<rootDir>/src/$1',
}
```
- **Server mocking:** Uses `jest.mock()` on modules like `typeorm`, `../database.js`, `../middleware/authenticate.js`, `../config/index.js`. Mock dependencies injected manually via constructor overrides.
- **Fixture location:** `server/tests/utils/factories.ts` — contains full test factory suite.
- **Factories/builders pattern** (`server/tests/utils/factories.ts`):
```typescript
export class UserFactory {
  static create(overrides: Partial<TestUser> = {}): Partial<TestUser> {
    return {
      id: faker.datatype.uuid(),
      username: faker.internet.userName(),
      email: faker.internet.email(),
      passwordHash: crypto.randomBytes(32).toString('hex'),
      status: 'active',
      mfaEnabled: false,
      ...overrides
    };
  }
  static createMany(count: number, overrides = {}): Partial<TestUser>[] {
    return Array.from({ length: count }, () => this.create(overrides));
  }
}

export class MockDataGenerator {
  static generateValidUserData() { /* ... */ }
  static generateLoginData() { /* ... */ }
}

export class TestHelpers {
  static createMockResponse() {
    const res: any = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res;
  }
}
```

## Coverage

- **Current coverage:** Coverage reports exist at `frontend/coverage/lcov-report/`. No explicit percentage reading.
- **Target coverage:** Server root `jest.config.js` sets **80%** global threshold for branches, functions, lines, and statements:
```javascript
coverageThreshold: {
  global: {
    branches: 80,
    functions: 80,
    lines: 80,
    statements: 80
  }
}
```
- Frontend has **no coverage threshold** configured in `frontend/jest.config.ts`.
- **Coverage collection:**
  - Frontend: Not configured (no `collectCoverage` or `collectCoverageFrom`)
  - Server root config: `collectCoverageFrom: ['server/src/**/*.ts', '!server/src/**/*.d.ts', '!server/src/tests/**']`, `coverageReporters: ['text', 'lcov', 'html']`
  - Server local config: `collectCoverageFrom: ['src/**/*.ts', '!src/**/*.d.ts', '!src/tests/**']`
- **Critical paths:** Auth service (`server/tests/services/authenticationService.test.ts` at 533 lines) and route-level integration tests are the most thoroughly tested areas.

## CI Integration

- **CI provider:** Not detected. No `.github/`, `.circleci/`, or CI config files found.
- **Test stages:** No automated CI pipeline. Tests run locally via npm scripts:
  - `npm test` — frontend jest run
  - `npm run test:server` — server jest run (`cd server && node --experimental-vm-modules node_modules/.bin/jest`)
  - `npm run test:coverage` — frontend with coverage
  - `npm run test:all` — frontend with coverage
  - `npm run typecheck` — frontend TypeScript check
  - `npm run lint` — frontend ESLint
- **Parallelization:** Not configured. Single-threaded jest runs.

## Run Commands

```bash
# Frontend tests
npm run test                  # Full jest run
npm run test:watch            # Watch mode
npm run test:coverage         # With coverage
npm run test:services         # Pattern: services/*.test.ts
npm run test:utils            # Pattern: utils/*.test.ts

# Server tests (cd server)
cd server && npm run test:server   # node --experimental-vm-modules jest

# Type checking
npm run typecheck             # tsc --noEmit (frontend)

# Linting
npm run lint                  # ESLint (frontend)
```

## Special Testing Patterns

- **Snapshot testing:** Not used. No `.snap` files found.
- **Visual regression:** Not used.
- **Performance testing:** Not used.
- **E2E testing:** Not used. No Playwright, Cypress, or Puppeteer setup.
- **Integration testing:** Server uses **supertest** (`@types/supertest` + `supertest` installed in server `devDependencies`) for HTTP-level testing. Routes are tested by creating an Express app instance in `beforeEach` and making requests against it.

## Server Test Pattern (supertest)

```typescript
// Example from server/src/routes/auth.test.ts
import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import request from 'supertest';

jest.mock('../middleware/authenticate.js');

describe('Authentication Routes', () => {
  let app: any;

  beforeEach(() => {
    app = require('./index.ts').default;  // Route module
  });

  it('should login with valid credentials', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({ username: 'testuser', password: 'Password123!' });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.token).toBeDefined();
  });
});
```

## Server Test Pattern (service-level with DI)

```typescript
// Example from server/tests/services/authenticationService.test.ts
import { AuthenticationService } from '../../server/src/services/authenticationService';

jest.mock('../../server/src/utils/passwordSecurity');

describe('AuthenticationService', () => {
  let authService: AuthenticationService;
  let mockPasswordSecurity: jest.Mocked<PasswordSecurityService>;

  beforeEach(() => {
    mockPasswordSecurity = new PasswordSecurityService() as jest.Mocked<PasswordSecurityService>;
    authService = new AuthenticationService(
      {} as any,  // dataSource
      mockPasswordSecurity,
      // ...
    );
    jest.clearAllMocks();
  });

  it('should successfully register a new user', async () => {
    const userData = MockDataGenerator.generateValidUserData();
    mockPasswordSecurity.validatePassword.mockReturnValue({ isValid: true, errors: [] });
    const result = await authService.register(userData);
    expect(result.success).toBe(true);
  });
});
```

## Test Gaps

- **Frontend component tests:** Not a single component test exists. No tests for pages, components, or hooks. Only 2 test files exist in frontend (`baseClient.test.ts` tests error class constructors, `importTest.test.ts` verifies module resolution).
- **E2E tests:** Not configured. No Playwright, Cypress, or Puppeteer.
- **Socket/realtime tests:** Not covered. Socket.io interactions lack tests.
- **Database migration tests:** Not covered.
- **OpenCV integration tests:** Not covered (no Python test integration).

---

*Testing analysis: 2026-07-16*
