# Testing Patterns

**Analysis Date:** 2026-05-05

## Test Framework

### Frontend

**Runner:**
- Jest 30.x (`jest` package in `frontend/package.json`)
- Config: No separate jest.config.js (uses Jest defaults with ts-jest)

**Assertion Library:**
- Jest built-in expect assertions

**Run Commands:**
```bash
npm run test                # Run all tests
npm run test:watch         # Watch mode
npm run test:coverage     # With coverage
npm run test:setup        # Run setup tests only
npm run test:services     # Run service tests
npm run test:utils        # Run utility tests
npm run test:all         # All tests with coverage
```

### Backend

**Runner:**
- Jest 30.x with ts-jest preset
- Config: `server/jest.config.js`

**Additional Tools:**
- Supertest for HTTP endpoint testing
- Jest globals types (`@jest/globals`)

**Run Commands:**
```bash
cd server
npm test                  # Run all backend tests
npm run test:watch       # Watch mode
```

## Test File Organization

### Frontend

**Location:**
- Tests placed alongside source files
- Pattern: `*.test.ts` or `*.test.tsx` suffix

**Naming:**
- Component: `ComponentName.test.tsx`
- Utility: `functionName.test.ts`
- Service: `serviceName.test.ts`

**Currently Active Tests:**
- No frontend test files actively maintained
- Test runner configured but not extensively used

### Backend

**Location:**
- Primary: `server/src/**/*.test.ts` (co-located with source)
- Secondary: `server/tests/` directory for integration tests

**Pattern:**
- `filename.test.ts` (co-located)
- `filename.spec.ts` (alternative)

**Naming:**
```typescript
// Backend test file organization
server/src/
├── routes/
│   ├── auth.test.ts
│   ├── visitorRoutes.test.ts
│   ├── reviewRoutes.test.ts
│   └── batchDetection.test.ts
├── services/
│   ├── review/
│   │   └── reviewService.test.ts
│   ├── detection/
│   │   └── detectionService.test.ts
│   └── timeline/
│       └── timelineService.test.ts
├── models/
│   ├── User.test.ts
│   ├── Event.test.ts
│   └── Role.test.ts
├── utils/
│   ├── logger.test.ts
│   ├── encryption.test.ts
│   └── fileHash.test.ts
└── tests/
    ├── setup.test.ts
    ├── services/
    │   └── authenticationService.test.ts
    ├── simple.test.ts
    └── basic.test.ts
```

## Test Structure

### Backend Test Suite Pattern

```typescript
import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import request from 'supertest';

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

    // Generate test tokens
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
        .send({
          username: 'newuser',
          email: 'newuser@example.com',
          password: 'Password123!'
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
    });

    it('should reject registration without authentication', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'newuser',
          email: 'newuser@example.com',
          password: 'Password123!'
        });

      expect(response.status).toBe(401);
    });
  });
});
```

### Service Test Pattern

```typescript
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { ReviewService } from '../reviewService.js';

describe('ReviewService', () => {
  let reviewService: ReviewService;
  let mockReviewSegmentRepo: any;
  let mockReviewStatusRepo: any;

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
    };

    reviewService = new ReviewService(
      mockReviewSegmentRepo,
      mockReviewStatusRepo
    );
  });

  describe('getReviewSegments', () => {
    it('should return empty segments when no data exists', async () => {
      mockReviewSegmentRepo.createQueryBuilder().getManyAndCount.mockResolvedValue([[], 0]);

      const result = await reviewService.getReviewSegments({});

      expect(result.segments).toEqual([]);
      expect(result.total).toBe(0);
    });
  });
});
```

## Mocking

**Frontend:**
- Minimal frontend testing in use
- No specific mocking patterns documented

**Backend:**
- Jest mocks for dependencies

**What to Mock:**
- Database repositories (`getRepository`)
- Configuration modules
- External services
- Authentication middleware

**Example:**
```typescript
jest.mock('../middleware/authenticate.js');
jest.mock('../config/index.js');
jest.mock('../services/timeline/timelineService.js');
```

**Mock Pattern:**
```typescript
const mockReviewSegmentRepo = {
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
```

## Fixtures and Factories

**Location:** Inline in test files (no dedicated fixtures directory)

**Test Data:**
- Created inline in beforeEach hooks
- Mock repositories return predefined data

**Example:**
```typescript
const mockSegments = [
  { id: 'segment_1', camera: 'cam1', severity: 'alert' },
  { id: 'segment_2', camera: 'cam1', severity: 'detection' },
];
mockReviewSegmentRepo.createQueryBuilder().getManyAndCount.mockResolvedValue([mockSegments, 5]);
```

## Coverage

### Requirements

**Backend (enforced):**
- Branches: 80%
- Functions: 80%
- Lines: 80%
- Statements: 80%

**Frontend:**
- Coverage not currently enforced
- Test runner configured but underutilized

### Backend Configuration

```javascript
// server/jest.config.js
collectCoverageFrom: [
  'src/**/*.ts',
  '!src/**/*.d.ts',
  '!src/tests/**'
],
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

### View Coverage

```bash
npm test -- --coverage
# or
cd server && npm test
```

## Test Types

### Unit Tests

**Scope:**
- Individual route handlers
- Service methods
- Utility functions
- Model methods

**Approach:**
- Mock dependencies
- Test business logic in isolation

### Integration Tests

**Scope:**
- Full HTTP request/response cycles
- Database operations
- Multi-service workflows

**Approach:**
- Use Supertest for HTTP testing
- Use in-memory mocks for database

### E2E Tests

**Framework:** Not currently used

**Status:** No E2E test suite implemented

## Common Patterns

### Async Testing

```typescript
it('should return segments with pagination', async () => {
  const mockSegments = [
    { id: 'segment_1', camera: 'cam1', severity: 'alert' },
  ];
  mockReviewSegmentRepo.createQueryBuilder().getManyAndCount.mockResolvedValue([mockSegments, 5]);

  const result = await reviewService.getReviewSegments({ limit: 2 });

  expect(result.segments).toHaveLength(2);
  expect(result.total).toBe(5);
  expect(result.hasMore).toBe(true);
});
```

### Error Testing

```typescript
it('should reject invalid token', async () => {
  const response = await request(app)
    .get('/api/auth/me')
    .set('Authorization', 'Bearer invalid-token');

  expect(response.status).toBe(401);
});
```

### Validation Testing

```typescript
it('should validate password requirements', async () => {
  const response = await request(app)
    .post('/api/auth/register')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      username: 'testuser',
      email: 'test@example.com',
      password: 'short'
    });

  expect(response.status).toBe(400);
});
```

---

*Testing analysis: 2026-05-05*