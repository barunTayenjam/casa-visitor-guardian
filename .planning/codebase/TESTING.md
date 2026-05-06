# Testing Patterns

**Analysis Date:** 2026-05-06

## Test Framework

**Runner:**
- Jest 30.2.0
- Backend config: `server/jest.config.js` (ESM mode)
- Root config: `jest.config.js` (points to server tests)
- Frontend config: No dedicated Jest config — uses root `package.json` scripts pointing to `cd frontend && jest`

**Assertion Library:**
- Jest built-in (`expect` from `@jest/globals`)
- Supertest 7.1.4 for HTTP endpoint testing

**Run Commands:**
```bash
# Frontend tests
npm run test                    # Run all frontend tests
npm run test:watch              # Watch mode
npm run test:coverage           # Coverage report
npm run test:services           # Only service tests
npm run test:utils              # Only utility tests

# Backend tests
cd server && npm run test:server   # Run backend tests with --experimental-vm-modules

# Root level
npm run test                    # Equivalent to cd frontend && jest
```

## Test File Organization

**Location:**
- Backend tests: **Co-located** with source files — test files sit next to the files they test
  - `server/src/routes/auth.test.ts` next to `server/src/routes/auth.ts`
  - `server/src/models/Event.test.ts` next to `server/src/models/Event.ts`
  - `server/src/utils/logger.test.ts` next to `server/src/utils/logger.ts`
  - `server/src/services/review/reviewService.test.ts` next to `reviewService.ts`
- Backend also has a separate `server/tests/` directory with basic/smoke tests
- Frontend tests: Separate `frontend/src/tests/setup.ts` exists but **no actual test files found** — frontend test coverage is effectively zero

**Naming:**
- Pattern: `<filename>.test.ts`
- Examples: `auth.test.ts`, `Event.test.ts`, `logger.test.ts`, `reviewService.test.ts`

**Structure:**
```
server/
├── src/
│   ├── routes/
│   │   ├── index.ts
│   │   ├── auth.ts
│   │   ├── auth.test.ts              ← Route-level integration tests
│   │   ├── visitorRoutes.ts
│   │   ├── visitorRoutes.test.ts
│   │   ├── reviewRoutes.ts
│   │   ├── reviewRoutes.test.ts
│   │   ├── storageRoutes.ts
│   │   ├── storageRoutes.test.ts
│   │   ├── batchDetection.ts
│   │   └── batchDetection.test.ts
│   ├── models/
│   │   ├── Event.ts
│   │   ├── Event.test.ts             ← Model unit tests
│   │   ├── User.ts
│   │   ├── User.test.ts
│   │   ├── Role.ts
│   │   ├── Role.test.ts
│   │   ├── AuditLog.ts
│   │   ├── AuditLog.test.ts
│   │   ├── Timeline.ts
│   │   └── Timeline.test.ts
│   ├── services/
│   │   ├── review/
│   │   │   ├── reviewService.ts
│   │   │   └── reviewService.test.ts ← Service unit tests
│   │   ├── detection/
│   │   │   ├── detectionService.ts
│   │   │   └── detectionService.test.ts
│   │   └── timeline/
│   │       └── timelineService.test.ts
│   └── utils/
│       ├── logger.ts
│       ├── logger.test.ts            ← Utility unit tests
│       ├── encryption.ts
│       ├── encryption.test.ts
│       ├── fileHash.ts
│       ├── fileHash.test.ts
│       ├── cronJobs.ts
│       └── cronJobs.test.ts
├── tests/
│   ├── simple.test.ts                ← Smoke test
│   ├── setup.test.ts                 ← Setup verification
│   ├── basic.test.ts
│   └── services/
│       ├── authenticationService.test.ts
│       └── basic.test.ts
frontend/
└── src/
    └── tests/
        └── setup.ts                  ← DB setup file (no actual tests)
```

## Test Structure

**Suite Organization:**
```typescript
import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';

describe('ReviewService', () => {
  let reviewService: ReviewService;
  let mockReviewSegmentRepo: any;
  let mockReviewStatusRepo: any;

  beforeEach(() => {
    // Set up mocks and service instance
    mockReviewSegmentRepo = {
      createQueryBuilder: jest.fn().mockReturnValue({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
      }),
      findOne: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
    };

    reviewService = new ReviewService(
      mockReviewSegmentRepo,
      mockReviewStatusRepo,
      mockTimelineService,
      mockPreviewService,
    );
  });

  describe('getReviewSegments', () => {
    it('should return empty segments when no data exists', async () => {
      // Arrange
      mockReviewSegmentRepo.createQueryBuilder().getManyAndCount
        .mockResolvedValue([[], 0]);
      // Act
      const result = await reviewService.getReviewSegments({});
      // Assert
      expect(result.segments).toEqual([]);
      expect(result.total).toBe(0);
      expect(result.hasMore).toBe(false);
    });
  });
});
```
Source: `server/src/services/review/reviewService.test.ts`

**Patterns:**
- **Setup:** `beforeEach` creates fresh mock objects and service instances per test
- **Teardown:** `afterEach` calls `jest.clearAllMocks()` or `jest.restoreAllMocks()`
- **Imports:** Always from `@jest/globals` — `import { describe, it, expect, beforeEach, jest } from '@jest/globals'`
- **Nesting:** `describe` blocks for class/module → method → specific scenarios
- **Test naming:** Descriptive sentences — `'should return empty segments when no data exists'`

## Mocking

**Framework:** Jest built-in mocking (`jest.fn()`, `jest.mock()`, `jest.spyOn()`)

**Patterns:**

**1. Service Mocking (Unit Tests):**
Mock repositories are plain objects with `jest.fn()` methods:
```typescript
const mockConfigRepo = {
  findOne: jest.fn(),
  update: jest.fn(),
  save: jest.fn(),
};

detectionService = new DetectionService(mockConfigRepo);
```
Source: `server/src/services/detection/detectionService.test.ts`

**2. TypeORM QueryBuilder Mocking:**
Chainable mock builder pattern:
```typescript
mockReviewSegmentRepo = {
  createQueryBuilder: jest.fn().mockReturnValue({
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
  }),
};
```
Source: `server/src/services/review/reviewService.test.ts`

**3. Module Mocking (Integration Tests):**
```typescript
jest.mock('../middleware/authenticate.js');
jest.mock('../config/index.js');
```
Source: `server/src/routes/auth.test.ts`

**4. Express App for HTTP Tests:**
Two approaches used:

Approach A — Require the app (fragile):
```typescript
beforeEach(() => {
  app = require('./index.ts').default;
});
```
Source: `server/src/routes/auth.test.ts`

Approach B — Create fresh Express app with specific routes:
```typescript
beforeAll(async () => {
  app = express();
  app.use(express.json());
  app.use('/api/storage', storageRoutes);
  await storageStatsService.initialize();
});
```
Source: `server/src/routes/storageRoutes.test.ts`

**5. Accessing Private Methods:**
Use type assertion to test private methods:
```typescript
const severity = (reviewService as any).calculateSeverity(objects);
```
Source: `server/src/services/review/reviewService.test.ts`

**6. Internal State Access:**
```typescript
(detectionService as any).scoreHistories.set('obj1', { scores: [1, 2, 3] });
expect((detectionService as any).scoreHistories.size).toBe(0);
```
Source: `server/src/services/detection/detectionService.test.ts`

**What to Mock:**
- TypeORM repositories and query builders
- External services (OpenCV, Redis)
- Authentication middleware (when testing routes)
- Configuration modules
- Console output in some tests

**What NOT to Mock:**
- The service class under test itself
- Zod validation logic (test it directly)
- Encryption/decryption (test with real implementation — see `encryption.test.ts`)

## Fixtures and Factories

**Test Data:**
Inline test data created directly in tests — no external fixture files or factory functions:
```typescript
// Inline event creation
const event = new Event();
event.event_type = 'motion';
event.file_path = '/path/to/snapshot.jpg';
event.camera_id = 'cam1';

// Inline JWT tokens for auth tests
adminToken = jwt.sign(
  { userId: 'admin-123', username: 'admin', role: 'admin' },
  'test-secret',
  { expiresIn: '1h' }
);

// Inline detection data
const detections = [
  { label: 'person', score: 0.2, object_id: 'p1' },
  { label: 'person', score: 0.5, object_id: 'p2' },
];
```

**Location:**
- No dedicated fixtures directory
- No factory functions detected
- Test data lives directly in test files

## Coverage

**Requirements:** 80% threshold enforced across all dimensions

**Configuration (both root and server `jest.config.js`):**
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

**View Coverage:**
```bash
cd server && npm run test:server    # collectCoverage: true in config
npm run test:coverage               # Frontend coverage
```

**Coverage Collection:**
```javascript
collectCoverageFrom: [
  'src/**/*.ts',
  '!src/**/*.d.ts',
  '!src/tests/**'
],
coverageReporters: ['text', 'lcov', 'html'],
collectCoverage: true,
```
Source: `server/jest.config.js`

**Note:** Despite the 80% threshold being configured, actual coverage likely falls short given the number of files without corresponding tests (e.g., detection implementations, stream managers, many service files).

## Test Types

**Unit Tests:**
- Models: Test entity instantiation and property defaults — `server/src/models/*.test.ts`
- Utilities: Test individual utility functions — `server/src/utils/*.test.ts`
- Services: Test business logic with mocked repositories — `server/src/services/*/service.test.ts`
- Pattern: Instantiate class with mock deps, call methods, assert results

**Integration Tests:**
- Routes: Test full HTTP request/response cycle using Supertest — `server/src/routes/*.test.ts`
- Storage: Test against real service initialization — `server/src/routes/storageRoutes.test.ts`
- Pattern: Create Express app, mount routes, make HTTP requests, assert responses

**E2E Tests:**
- Not used in the test suite
- Manual E2E scripts exist at root level (e.g., `test_auth.mjs`, `test-gallery.mjs`) — these are standalone scripts, not part of the Jest suite

## Common Patterns

**Async Testing:**
```typescript
it('should return camera-specific config when exists', async () => {
  mockConfigRepo.findOne.mockResolvedValue({
    id: 'uuid-1',
    camera: 'front_door',
    config: { ... },
  });

  const result = await detectionService.getConfig('front_door');

  expect(result.thresholds.person.min_score).toBe(0.5);
});
```

**Error Testing:**
```typescript
it('should reject registration without authentication', async () => {
  const response = await request(app)
    .post('/api/auth/register')
    .send({ username: 'newuser', email: 'newuser@example.com', password: 'Password123!' });

  expect(response.status).toBe(401);
  expect(response.body.success).toBe(false);
});
```

**Mocked Return Sequences:**
```typescript
mockConfigRepo.findOne
  .mockResolvedValueOnce(null)           // First call: camera-specific not found
  .mockResolvedValueOnce({               // Second call: global fallback
    id: 'uuid-2',
    camera: null,
    config: { ... },
  });
```

**Asserting Mock Calls:**
```typescript
expect(mockReviewSegmentRepo.createQueryBuilder).toHaveBeenCalledWith('segment');
expect(mockReviewStatusRepo.save).toHaveBeenCalledWith(
  expect.objectContaining({
    user_id: 'user_1',
    has_been_reviewed: true,
  })
);
```

## Test Environment

**Backend:**
- `testEnvironment: 'node'`
- ESM mode with `ts-jest` preset: `preset: 'ts-jest/presets/default-esm'`
- Module name mapper: `'^(\\.{1,2}/.*)\\.js$': '$1'` (resolves `.js` imports to `.ts` files)
- Test timeout: 10000ms (root config)

**Frontend Test Setup:**
- `frontend/src/tests/setup.ts` — configures test database, mocks console, sets test env vars
- References models from `frontend/src/models` (which doesn't exist as a frontend dir — likely unused/broken setup)
- No `jest.config.js` in frontend — relies on root config or default settings

**Jest Global Setup in Frontend (`frontend/src/tests/setup.ts`):**
```typescript
beforeAll(async () => {
  await testDataSource.initialize();
});

afterAll(async () => {
  await testDataSource.destroy();
});

beforeEach(async () => {
  // Clean all tables between tests
  for (const entity of testDataSource.entityMetadatas) {
    const repository = testDataSource.getRepository(entity.name);
    await repository.query(`DELETE FROM ${entity.tableName};`);
  }
});

// Mock console to reduce noise
global.console = { ...console, log: jest.fn(), debug: jest.fn(), ... };
```

## Gaps and Notes

**Frontend Testing:** Zero frontend test files exist despite the test infrastructure being set up. No component tests, no hook tests, no service tests. The `frontend/src/tests/setup.ts` file references backend models (out of scope for frontend).

**Backend Coverage:** Tests exist for major routes (auth, visitors, review, storage, batch detection) and some services (review, detection, timeline), but many files lack test coverage:
- `server/src/routes/index.ts` (5134 lines) — no direct test file
- `server/src/detection/*.ts` — no test files
- `server/src/streams/*.ts` — no test files
- `server/src/services/notificationService.ts` — no test file
- `opencv-service/app.py` (1903 lines) — no tests

**Test Quality Note:** Some tests are superficial — e.g., `logger.test.ts` tests that methods exist and don't throw, but doesn't verify logging output. Model tests (`Event.test.ts`) only test property assignment, not database interactions.

---

*Testing analysis: 2026-05-06*
