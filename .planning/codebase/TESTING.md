# Testing Patterns

**Analysis Date:** 2026-08-13

## Test Framework

**Runner:**
- **Frontend:** Jest 30.2.0 with `ts-jest` and `jsdom` environment
  - Config: `/home/barun/Documents/sentryvision/frontend/jest.config.ts`
- **Server:** Jest 30.2.0 with `ts-jest` and `node` environment
  - Config: `/home/barun/Documents/sentryvision/server/jest.config.js`
- **Test runner entry:** `npm run test` (runs frontend tests); `npm run test:server` (runs server tests)

**Assertion Library:**
- Jest built-in `expect` with `@testing-library/jest-dom` for DOM assertions (frontend).

**Run Commands:**
```bash
npm run test                    # Run all frontend tests
npm run test:watch              # Frontend watch mode
npm run test:coverage           # Frontend coverage report
npm run test:setup              # Frontend setup tests only
npm run test:services           # Frontend service tests only
npm run test:utils              # Frontend utility tests only
npm run test:all                # Frontend full coverage
cd server && npm run test:server   # Server tests
```

## Test File Organization

**Location:**
- **Frontend:** Co-located `__tests__` directories (`src/__tests__/`) and mock files (`src/__mocks__/`). Also allowed: `src/**/*.test.ts` and `src/**/*.test.tsx` (from `testMatch`).
- **Server:** `__tests__` subdirectories within modules (e.g., `src/controllers/__tests__/`, `src/models/Event.test.ts`) and top-level `tests/` directory.

**Naming:**
- `*.test.ts` or `*.test.tsx` for unit/integration tests.
- `*.spec.ts` also matched by config but less used.

**Structure:**
```
frontend/
├── src/
│   ├── __tests__/              # Test files
│   │   ├── baseClient.test.ts
│   │   └── importTest.test.ts
│   ├── __mocks__/              # Jest manual mocks
│   │   ├── lib/logger.ts
│   │   └── services/api/{authService.ts,baseClient.ts}
│   ├── services/api/           # Source code being tested
│   └── ...

server/
├── src/
│   ├── __tests__/              # Less used
│   ├── config/index.test.ts
│   ├── controllers/__tests__/AuthController.test.ts
│   ├── models/Event.test.ts
│   ├── routes/*.test.ts
│   ├── services/__tests__/cacheService.test.ts
│   ├── services/detection/detectionService.test.ts
│   └── ...
├── tests/                      # Top-level test directory
│   ├── setup.ts
│   ├── utils/factories.ts
│   └── services/authenticationService.test.ts
```

## Test Structure

**Suite Organization:**
```typescript
// Frontend example (src/__tests__/baseClient.test.ts)
describe('ApiError classes', () => {
  it('ApiError has correct properties', () => { ... });
  it('NetworkError extends ApiError', () => { ... });
});

describe('Token management (localStorage)', () => {
  beforeEach(() => {
    localStorage.clear();
  });
  it('stores and retrieves auth token', () => { ... });
  it('removes auth token', () => { ... });
});

// Server example (tests/services/authenticationService.test.ts)
describe('AuthenticationService', () => {
  let authService: AuthenticationService;
  let mockPasswordSecurity: jest.Mocked<PasswordSecurityService>;
  let mockJWTService: jest.Mocked<JWTService>;
  let mockAuditService: jest.Mocked<AuditService>;

  beforeEach(() => {
    // Setup mocks and service instance
  });

  describe('register', () => {
    it('should successfully register a new user with valid data', async () => { ... });
    it('should reject registration with invalid email', async () => { ... });
  });

  describe('login', () => {
    it('should successfully login with valid credentials', async () => { ... });
    it('should reject login with invalid credentials', async () => { ... });
    it('should lock account after 5 failed attempts', async () => { ... });
  });
});
```

**Patterns:**
- `describe` blocks for grouping by method/feature.
- `beforeEach` for test isolation and mock reset (`jest.clearAllMocks()`).
- `afterEach` / `afterAll` for cleanup (database teardown in server).
- `async/await` for all asynchronous tests.

## Mocking

**Framework:** Jest built-in mocking (`jest.fn`, `jest.mock`, `jest.mocked`).

**Patterns:**

*Frontend (manual mocks in `__mocks__/`):*
```typescript
// src/__mocks__/services/api/baseClient.ts
export const apiClient: ApiClient = {
  get: () => Promise.resolve({} as never),
  post: () => Promise.resolve({} as never),
  put: () => Promise.resolve({} as never),
  delete: () => Promise.resolve({} as never),
  fetchWithRetry,
};

// src/__mocks__/lib/logger.ts
export const logger: Record<string, LogFn> = {
  info: () => {},
  warn: () => {},
  error: () => {},
  debug: () => {},
};
```

*Server (inline mocking with `jest.mock`):*
```typescript
// tests/services/authenticationService.test.ts
jest.mock('../../server/src/utils/passwordSecurity');
jest.mock('../../server/src/utils/jwtService');
jest.mock('../../server/src/utils/auditService');

beforeEach(() => {
  mockPasswordSecurity = new PasswordSecurityService() as jest.Mocked<PasswordSecurityService>;
  mockJWTService = new JWTService() as jest.Mocked<JWTService>;
  mockAuditService = new AuditService({} as any) as jest.Mocked<AuditService>;
  
  authService = new AuthenticationService(
    {} as any, // dataSource
    mockPasswordSecurity,
    mockJWTService,
    mockAuditService
  );
  jest.clearAllMocks();
});

// Mock return values
mockPasswordSecurity.validatePassword.mockReturnValue({
  isValid: true,
  errors: []
});
mockPasswordSecurity.hashPassword.mockResolvedValue({
  hash: 'hashed-password',
  salt: 'random-salt'
});
```

*Controller/route mocking:*
```typescript
// src/routes/auth.test.ts
jest.mock('../middleware/authenticate.js');
jest.mock('../config/index.js');

beforeEach(() => {
  app = require('./index.ts').default;
  mockDb = { getRepository: jest.fn() };
  // Generate JWT tokens for auth
  adminToken = jwt.sign({ userId: 'admin-123', role: 'admin' }, 'test-secret', { expiresIn: '1h' });
});
```

**What to Mock:**
- External services (API clients, database, authentication utilities).
- Third-party modules (TypeORM `DataSource`, `jsonwebtoken`, external APIs).
- Time-dependent functions (not explicitly observed but common).

**What NOT to Mock:**
- Pure utility functions (test them directly).
- Internal business logic being tested.
- React components (use React Testing Library for component testing if needed).

## Fixtures and Factories

**Test Data:**
- Server uses factory pattern in `tests/utils/factories.ts`:
```typescript
// Interface definitions for test data
interface TestUser { ... }
interface TestSession { ... }
interface TestAuditLog { ... }
interface TestRole { ... }

// faker.js for generating realistic test data
import * as faker from '@faker-js/faker';
```

- Frontend tests use inline test data or localStorage for token simulation.

**Location:**
- Server: `/home/barun/Documents/sentryvision/server/tests/utils/factories.ts`
- Frontend: Inline in test files.

## Coverage

**Requirements:** (Server config)
```javascript
// server/jest.config.js
coverageThreshold: {
  global: {
    branches: 80,
    functions: 80,
    lines: 80,
    statements: 80
  }
},
coverageReporters: ['text', 'lcov', 'html'],
collectCoverage: true
```

**View Coverage:**
```bash
npm run test:coverage    # Frontend (opens HTML report)
cd server && npm run test:server  # Server (outputs text/lcov/html to coverage/)
```

## Test Types

**Unit Tests:**
- Service methods (e.g., `AuthenticationService.register`, `AuthController.login`).
- Utility functions (config validation, path helpers).
- Model/entity property validation.

**Integration Tests:**
- API routes with `supertest` (e.g., `auth.test.ts` testing `/api/auth/*` endpoints).
- Database operations with test TypeORM DataSource.
- WebSocket client tests (`pythonWsClient.test.ts`).

**E2E Tests:**
- Not configured. Playwright/Cypress not present in dependencies.

## Common Patterns

**Async Testing:**
```typescript
// Server integration test
it('should successfully login with valid credentials', async () => {
  const response = await request(app)
    .post('/api/auth/login')
    .send({ username: 'testuser', password: 'Password123!' });
  
  expect(response.status).toBe(200);
  expect(response.body.success).toBe(true);
});
```

**Error Testing:**
```typescript
it('should reject registration with invalid email', async () => {
  const userData = { ...generateValidUserData(), email: 'invalid-email' };
  const result = await authService.register(userData);
  
  expect(result.success).toBe(false);
  expect(result.errors).toContain('Invalid email format');
});

it('should handle database errors gracefully', async () => {
  const mockDataSource = {
    getRepository: jest.fn().mockReturnValue({
      findOne: jest.fn().mockRejectedValue(new Error('Database connection failed'))
    })
  };
  // ... test that service returns failure instead of throwing
});
```

**Database Testing:**
```typescript
// tests/setup.ts - Global TypeORM setup
const testDataSource = new DataSource({
  type: 'postgres',
  host: process.env.TEST_DB_HOST || 'localhost',
  // ...
  dropSchema: true,
  migrationsRun: true
});

beforeAll(async () => {
  await testDataSource.initialize();
});

beforeEach(async () => {
  // Clean tables between tests
  for (const entity of entities) {
    await repository.query(`DELETE FROM ${entity.tableName};`);
  }
});
```

---

*Testing analysis: 2026-08-13*