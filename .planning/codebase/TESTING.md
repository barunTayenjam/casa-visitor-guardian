# Testing Patterns

**Analysis Date:** 2026-05-15

## Test Framework

**Runner:**
- Jest 30.2 with ts-jest 29.4.5
- Backend config: `server/jest.config.js`
- Root config: `jest.config.js` (points to `server/src`)

**Assertion Library:**
- Jest built-in (`expect` from `@jest/globals`)
- Supertest 7.1.4 for HTTP endpoint testing

**Run Commands:**
```bash
# From root
npm run test                    # Run frontend tests via Jest
npm run test:coverage           # Frontend tests with coverage
npm run test:watch              # Frontend tests in watch mode

# From server/
cd server && npm run test:server   # Run backend tests

# Specific test patterns
npm run test:setup              # Run setup tests only
npm run test:services           # Run service tests only
npm run test:utils              # Run utility tests only
```

## Test File Organization

**Location:**
- Co-located with source files: test files sit next to the code they test
- Additional test directory: `server/tests/` for integration-style tests

**Naming:**
- Pattern: `<sourceFile>.test.ts`
- Examples: `User.test.ts`, `auth.test.ts`, `logger.test.ts`, `encryption.test.ts`

**Structure:**
```
server/src/
├── models/
│   ├── User.ts
│   ├── User.test.ts           # Model tests
│   ├── Event.ts
│   ├── Event.test.ts
│   └── ...
├── routes/
│   ├── auth.ts
│   ├── auth.test.ts           # Route tests
│   ├── visitorRoutes.test.ts
│   └── ...
├── services/
│   ├── review/
│   │   ├── reviewService.ts
│   │   └── reviewService.test.ts  # Service tests
│   ├── detection/
│   │   ├── detectionService.ts
│   │   └── detectionService.test.ts
│   └── timeline/
│       ├── timelineService.ts
│       └── timelineService.test.ts
├── utils/
│   ├── logger.ts
│   ├── logger.test.ts         # Utility tests
│   ├── encryption.ts
│   ├── encryption.test.ts
│   └── ...
├── database.test.ts           # Core module tests
└── index.test.ts              # Entry point tests

server/tests/
├── simple.test.ts             # Sanity check tests
├── setup.test.ts              # Environment setup tests
├── services/
│   ├── basic.test.ts
│   └── authenticationService.test.ts  # Integration-level service tests
```

## Test Structure

**Suite Organization:**
```typescript
// Pattern from server/src/routes/auth.test.ts
import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import request from 'supertest';
import jwt from 'jsonwebtoken';

jest.mock('../middleware/authenticate.js');
jest.mock('../config/index.js');

describe('Authentication Routes', () => {
  let app: any;
  let mockDb: any;
  let adminToken: string;
  let userToken: string;

  beforeEach(() => {
    app = require('./index.ts').default;
    mockDb = {
      getRepository: jest.fn(),
    };
    adminToken = jwt.sign(
      { userId: 'admin-123', username: 'admin', role: 'admin' },
      'test-secret',
      { expiresIn: '1h' }
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/auth/register (Admin Only)', () => {
    it('should allow admin to register a new user', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ username: 'newuser', email: 'newuser@example.com', password: 'Password123!' });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
    });
  });
});
```

**Patterns:**
- **Setup:** `beforeEach` creates fresh mocks and app instances per test
- **Teardown:** `afterEach` calls `jest.clearAllMocks()` or `jest.restoreAllMocks()`
- **Assertion style:** Standard Jest `expect().toBe()`, `toBeDefined()`, `toEqual()`
- **Grouping:** Nested `describe()` blocks for route groups, HTTP methods, and scenarios

## Mocking

**Framework:** Jest built-in mocking (`jest.mock()`, `jest.fn()`)

**Patterns:**

### Database Repository Mocking
```typescript
// Pattern from server/src/services/review/reviewService.test.ts
let mockReviewSegmentRepo: any;

beforeEach(() => {
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
    create: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
  };

  reviewService = new ReviewService(
    mockReviewSegmentRepo,
    mockReviewStatusRepo,
    mockTimelineService,
    mockPreviewService
  );
});
```

### Module-Level Mocking
```typescript
// Pattern from server/src/routes/auth.test.ts
jest.mock('../middleware/authenticate.js');
jest.mock('../config/index.js');

// Pattern from server/src/services/timeline/timelineService.test.ts
jest.mock('../models/Timeline.js');
jest.mock('../models/AdaptiveRegion.js');
jest.mock('./cacheService.js');
```

### Dependency Injection for Services
```typescript
// Services accept mocked repos via constructor
detectionService = new DetectionService(mockConfigRepo);
reviewService = new ReviewService(mockSegmentRepo, mockStatusRepo, mockTimelineService, mockPreviewService);
timelineService = new TimelineService(mockTimelineRepo, mockRegionRepo);
```

### TypeORM Mocking
```typescript
// Pattern from server/src/models/User.test.ts
jest.mock('../models/Role.js');

// Pattern from server/src/database.test.ts
jest.mock('typeorm');
jest.mock('../database.js');
```

**What to Mock:**
- Database connections (`typeorm`, `../database.js`)
- Authentication middleware (`../middleware/authenticate.js`)
- Configuration (`../config/index.js`)
- External services (cache, timeline, preview)
- Repository return values

**What NOT to Mock:**
- Entity class instantiation (create `new User()`, `new Event()` directly)
- Simple utility functions (test them directly)
- Encryption/decryption (test actual encrypt→decrypt cycle)

## Fixtures and Factories

**Test Data:**
```typescript
// Pattern from server/tests/services/authenticationService.test.ts
import { UserFactory, MockDataGenerator, TestHelpers } from '../utils/factories';

// Generating valid test data
const userData = MockDataGenerator.generateValidUserData();

// Creating mock entity instances
const user = new User();
user.username = 'testuser';
user.email = 'test@example.com';
user.passwordHash = 'hashedpassword123';
```

**Inline Test Data:**
```typescript
// JWT token generation for auth tests
adminToken = jwt.sign(
  { userId: 'admin-123', username: 'admin', role: 'admin' },
  'test-secret',
  { expiresIn: '1h' }
);

// Mock request data
const response = await request(app)
  .post('/api/auth/register')
  .set('Authorization', `Bearer ${adminToken}`)
  .send({
    username: 'newuser',
    email: 'newuser@example.com',
    password: 'Password123!'
  });
```

**Location:**
- Factory/test utilities: `server/tests/utils/factories` (referenced but may be in progress)
- Inline test data in test files

## Coverage

**Requirements:** 80% threshold enforced for all metrics (branches, functions, lines, statements)

**Configuration** (`server/jest.config.js` and root `jest.config.js`):
```javascript
coverageThreshold: {
  global: {
    branches: 80,
    functions: 80,
    lines: 80,
    statements: 80
  }
},
collectCoverage: true,
collectCoverageFrom: [
  'src/**/*.ts',
  '!src/**/*.d.ts',
  '!src/tests/**'
],
coverageReporters: ['text', 'lcov', 'html'],
```

**View Coverage:**
```bash
npm run test:coverage      # Terminal output + lcov report
# Open coverage/lcov-report/index.html in browser for HTML report
```

**Timeout:** 10 seconds per test (configured in root `jest.config.js` via `testTimeout: 10000`)

## Test Types

**Unit Tests:**
- Model entity tests: instantiation, default values, serialization (e.g., `User.test.ts`, `Event.test.ts`)
- Utility tests: pure function testing (e.g., `logger.test.ts`, `encryption.test.ts`, `fileHash.test.ts`)
- Service tests: constructor injection with mocked repos (e.g., `reviewService.test.ts`, `detectionService.test.ts`)
- Pattern: Create instance, set properties, assert values

**Integration Tests:**
- Route tests: Full Express app or Router mounted on test Express instance, tested via Supertest
- Storage routes test (`storageRoutes.test.ts`): Uses `beforeAll` to initialize real services
- Authentication service test (`authenticationService.test.ts`): Tests full register/login flow with mocked dependencies

**E2E Tests:**
- Not currently implemented
- `puppeteer` and `jest-environment-jsdom` are listed as devDependencies but no E2E test files found

## Common Patterns

### HTTP Endpoint Testing
```typescript
// Create test app and make requests with supertest
import request from 'supertest';
import express from 'express';

describe('GET /api/visitors', () => {
  let app: express.Express;

  beforeEach(() => {
    app = express();
    app.use(express.json());
  });

  it('should return visitors list', async () => {
    const response = await request(app)
      .get('/api/visitors')
      .set('Authorization', 'Bearer valid-token');

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(Array.isArray(response.body.data)).toBe(true);
  });
});
```

### Error Testing
```typescript
// Testing error responses
it('should return 404 for non-existent visitor', async () => {
  const response = await request(app)
    .get('/api/visitors/non-existent')
    .set('Authorization', 'Bearer valid-token');

  expect(response.status).toBe(404);
  expect(response.body.success).toBe(false);
});
```

### Async Testing
```typescript
// All route tests use async/await with supertest
it('should create new batch job', async () => {
  const response = await request(app)
    .post('/api/batch/process')
    .set('Authorization', 'Bearer valid-token')
    .send({
      cameraId: 'cam1',
      startTime: '2024-01-01T00:00:00Z',
      endTime: '2024-01-01T01:00:00Z'
    });

  expect(response.status).toBe(201);
  expect(response.body.success).toBe(true);
  expect(response.body.data.id).toBeDefined();
});
```

### Query Builder Mocking
```typescript
// Mocking TypeORM QueryBuilder chain
mockTimelineRepo.createQueryBuilder.mockReturnValue({
  where: jest.fn().mockReturnThis(),
  andWhere: jest.fn().mockReturnThis(),
  orderBy: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis(),
  getMany: jest.fn().mockResolvedValue([]),
  skip: jest.fn().mockReturnThis(),
  take: jest.fn().mockReturnThis(),
  getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
});

// Asserting query builder calls
expect(mockTimelineRepo.createQueryBuilder().andWhere).toHaveBeenCalledWith(
  'timeline.camera = :camera',
  { camera: 'front_door' }
);
```

## Test Environment Configuration

**TypeScript in Tests:**
- ts-jest with ESM support (`ts-jest/presets/default-esm`)
- ESM module resolution via `moduleNameMapper`: `'^(\\.{1,2}/.*)\\.js$': '$1'`
- Test files use `.js` extension in import paths (ESM requirement)
- `@jest/globals` imported for type-safe test functions

**Environment:**
- `testEnvironment: 'node'` for all server tests
- Test timeout: 10,000ms
- `process.env.NODE_ENV` expected to be `'test'`

## Test File Inventory

**Backend Tests (co-located in `server/src/`):**
| File | Category | Lines |
|------|----------|-------|
| `server/src/models/User.test.ts` | Model unit | 89 |
| `server/src/models/Event.test.ts` | Model unit | 79 |
| `server/src/models/Role.test.ts` | Model unit | 48 |
| `server/src/models/AuditLog.test.ts` | Model unit | 59 |
| `server/src/models/Timeline.test.ts` | Model unit | 54 |
| `server/src/routes/auth.test.ts` | Route integration | 171 |
| `server/src/routes/visitorRoutes.test.ts` | Route integration | 79 |
| `server/src/routes/reviewRoutes.test.ts` | Route integration | 58 |
| `server/src/routes/batchDetection.test.ts` | Route integration | 104 |
| `server/src/routes/storageRoutes.test.ts` | Route integration | 224 |
| `server/src/services/review/reviewService.test.ts` | Service unit | 192 |
| `server/src/services/detection/detectionService.test.ts` | Service unit | 222 |
| `server/src/services/timeline/timelineService.test.ts` | Service unit | 219 |
| `server/src/utils/logger.test.ts` | Utility unit | 66 |
| `server/src/utils/encryption.test.ts` | Utility unit | 98 |
| `server/src/utils/fileHash.test.ts` | Utility unit | 46 |
| `server/src/utils/cronJobs.test.ts` | Utility unit | 65 |
| `server/src/database.test.ts` | Core module | 45 |
| `server/src/index.test.ts` | Entry point | 64 |

**Backend Tests (in `server/tests/`):**
| File | Category | Lines |
|------|----------|-------|
| `server/tests/simple.test.ts` | Sanity check | 6 |
| `server/tests/setup.test.ts` | Environment setup | 14 |
| `server/tests/services/authenticationService.test.ts` | Service integration | 533 |
| `server/tests/services/basic.test.ts` | Basic check | — |

**Frontend Tests:**
- Frontend has test scripts configured in `package.json` but no co-located `.test.ts`/`.test.tsx` files were found in `frontend/src/`
- Jest configuration exists at the frontend level with `jest-environment-jsdom` as a devDependency

---

*Testing analysis: 2026-05-15*
