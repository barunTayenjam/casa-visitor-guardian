# SentryVision Testing Guide

## Overview

SentryVision uses Jest as the testing framework for both frontend and backend. Tests are organized alongside source code with a focus on unit testing routes, services, and models. The project maintains an 80% coverage threshold for all code.

## Testing Stack

### Frontend Testing
**Framework:** Jest 30.2.0
**Environment:** jsdom (browser simulation)
**Additional Tools:**
- React Testing Library (component testing)
- ts-jest (TypeScript preprocessor)
- @jest/globals (global test functions)

### Backend Testing
**Framework:** Jest 30.2.0
**Environment:** Node (server-side)
**Additional Tools:**
- Supertest 7.1.4 (HTTP endpoint testing)
- ts-jest (TypeScript preprocessor)
- @jest/globals (global test functions)

## Test Configuration

### Root Jest Config (`jest.config.js`)
```javascript
module.exports = {
  preset: 'ts-jest/presets/default-esm',
  extensionsToTreatAsEsm: ['.ts'],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1'
  },
  testEnvironment: 'node',
  roots: ['<rootDir>/server/src'],
  testMatch: ['**/__tests__/**/*.ts', '**/?(*.)+(spec|test).ts'],
  transform: {
    '^.+\\.ts$': ['ts-jest', {
      useESM: true,
      tsconfig: {
        module: 'ESNext',
        target: 'ES2022'
      }
    }]
  },
  collectCoverageFrom: [
    'server/src/**/*.ts',
    '!server/src/**/*.d.ts',
    '!server/src/tests/**'
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
  collectCoverage: true,
  testTimeout: 10000
};
```

### Server Jest Config (`server/jest.config.js`)
Same as root config but scoped to server directory.

## Test Structure

### File Naming Convention
- Test files: `*.test.ts` or `*.spec.ts`
- Location: Alongside source code or in `tests/` directory
- Examples:
  - `server/src/routes/auth.test.ts`
  - `server/src/models/Event.test.ts`
  - `server/src/routes/reviewRoutes.test.ts`

### Test File Organization

**Backend Route Tests:**
```typescript
import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import request from 'supertest';

describe('Feature Name', () => {
  let app: any;
  let mockDb: any;

  // Setup before all tests
  beforeEach(() => {
    app = require('./index.ts').default;
    mockDb = {
      getRepository: jest.fn(),
    };
  });

  // Cleanup after each test
  afterEach(() => {
    jest.clearAllMocks();
  });

  // Test groups
  describe('GET /endpoint', () => {
    it('should return data when authenticated', async () => {
      // Arrange
      const token = generateTestToken('admin');

      // Act
      const response = await request(app)
        .get('/api/endpoint')
        .set('Authorization', `Bearer ${token}`);

      // Assert
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });
});
```

**Model Tests:**
```typescript
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { Event } from './Event.js';

describe('Event Model', () => {
  let mockAppDataSource: any;

  beforeEach(() => {
    mockAppDataSource = {
      getRepository: jest.fn().mockReturnValue({
        create: jest.fn(),
        findOne: jest.fn(),
        find: jest.fn(),
        save: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      }),
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Event entity', () => {
    it('should create a new Event instance', () => {
      const event = new Event();
      event.event_type = 'motion';
      event.file_path = '/path/to/snapshot.jpg';
      event.camera_id = 'cam1';

      expect(event.event_type).toBe('motion');
      expect(event.file_path).toBe('/path/to/snapshot.jpg');
      expect(event.camera_id).toBe('cam1');
    });

    it('should set default values', () => {
      const event = new Event();

      expect(event.thumbnail_path).toBeNull();
      expect(event.metadata).toBeNull();
    });
  });
});
```

## Testing Patterns

### AAA Pattern (Arrange-Act-Assert)
```typescript
it('should update user email', async () => {
  // Arrange
  const userId = 'user-123';
  const newEmail = 'newemail@example.com';
  const mockUser = { id: userId, email: 'old@example.com' };
  mockDb.findOne.mockResolvedValue(mockUser);

  // Act
  const result = await userService.updateEmail(userId, newEmail);

  // Assert
  expect(result.email).toBe(newEmail);
  expect(mockDb.save).toHaveBeenCalledWith(
    expect.objectContaining({ email: newEmail })
  );
});
```

### Mocking Database
```typescript
beforeEach(() => {
  // Mock TypeORM repository
  mockRepository = {
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };

  mockDb.getRepository.mockReturnValue(mockRepository);
});

it('should find all events', async () => {
  const mockEvents = [
    { id: '1', event_type: 'motion' },
    { id: '2', event_type: 'person' }
  ];
  mockRepository.find.mockResolvedValue(mockEvents);

  const events = await eventService.findAll();

  expect(events).toEqual(mockEvents);
  expect(mockRepository.find).toHaveBeenCalled();
});
```

### Mocking External Services
```typescript
jest.mock('../services/opencvMicroserviceClient.js');

it('should detect motion using OpenCV service', async () => {
  const mockDetectionResult = {
    hasMotion: true,
    confidence: 0.85
  };

  (opencvService.detectMotion as jest.Mock).mockResolvedValue(mockDetectionResult);

  const result = await detectionService.detectMotion(frameData);

  expect(result.hasMotion).toBe(true);
  expect(opencvService.detectMotion).toHaveBeenCalledWith(frameData);
});
```

### Testing Async Operations
```typescript
it('should handle async errors', async () => {
  const expectedError = new Error('Database connection failed');
  mockRepository.save.mockRejectedValue(expectedError);

  await expect(eventService.createEvent(data))
    .rejects
    .toThrow('Database connection failed');

  expect(mockRepository.save).toHaveBeenCalled();
});
```

## Testing Best Practices

### Do's
- ✅ Use descriptive test names: "should [do something] when [condition]"
- ✅ Follow AAA pattern (Arrange, Act, Assert)
- ✅ Test one thing per test
- ✅ Use beforeEach/afterEach for setup/teardown
- ✅ Mock external dependencies (database, APIs)
- ✅ Test edge cases and error conditions
- ✅ Keep tests independent (no shared state)
- ✅ Use meaningful assertions

### Don'ts
- ❌ Test implementation details (test behavior, not code)
- ❌ Write tests that depend on execution order
- ❌ Mock everything (only mock external dependencies)
- ❌ Use vague assertions (`expect(result).toBeDefined()`)
- ❌ Ignore failing tests
- ❌ Write tests that are too brittle

## Coverage Requirements

### Current Threshold: 80%
All code must maintain at least 80% coverage for:
- **Branches:** Conditional logic coverage
- **Functions:** Function execution coverage
- **Lines:** Line execution coverage
- **Statements:** Statement execution coverage

### Running Coverage
```bash
# Backend
npm run test           # Run tests with coverage
npm run test:coverage  # Explicit coverage report

# Frontend (if configured)
cd frontend
npm run test:coverage
```

### Coverage Reports
Generated in:
- Console output (text format)
- `coverage/` directory (HTML report)
- `coverage/lcov.info` (for CI tools)

## Test Categories

### Unit Tests
**Purpose:** Test individual functions/classes in isolation

**Examples:**
- Model validation logic
- Service methods
- Utility functions
- Custom hooks

```typescript
describe('EventService', () => {
  it('should create event with valid data', async () => {
    const data = { event_type: 'motion', camera_id: 'cam1' };
    const event = await eventService.create(data);
    expect(event.event_type).toBe('motion');
  });
});
```

### Integration Tests
**Purpose:** Test interactions between components

**Examples:**
- API endpoint to database
- Route to service to repository
- Middleware to route handler

```typescript
describe('POST /api/events', () => {
  it('should create event and save to database', async () => {
    const eventData = { event_type: 'motion', camera_id: 'cam1' };
    const response = await request(app)
      .post('/api/events')
      .send(eventData)
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(201);
    expect(mockRepository.save).toHaveBeenCalled();
  });
});
```

### Endpoint Tests (Supertest)
**Purpose:** Test HTTP endpoints end-to-end

```typescript
describe('Authentication Routes', () => {
  describe('POST /api/auth/register', () => {
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
      expect(response.body.user.username).toBe('newuser');
    });

    it('should reject registration attempt by non-admin user', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          username: 'newuser',
          email: 'newuser@example.com',
          password: 'Password123!'
        });

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('permissions');
    });
  });
});
```

## Test Data Management

### Test Fixtures
```typescript
const testUser = {
  id: 'user-123',
  username: 'testuser',
  email: 'test@example.com',
  role: 'user'
};

const testEvent = {
  id: 'event-123',
  event_type: 'motion',
  camera_id: 'cam1',
  timestamp: new Date().toISOString()
};
```

### Mock Data Generation
```typescript
function createMockEvent(overrides = {}) {
  return {
    id: 'event-' + Math.random(),
    event_type: 'motion',
    camera_id: 'cam1',
    confidence: 0.85,
    timestamp: new Date().toISOString(),
    ...overrides
  };
}
```

### Database Transactions in Tests
```typescript
it('should rollback on error', async () => {
  await AppDataSource.transaction(async (transactionalEntityManager) => {
    // Perform operations
    const event = transactionalEntityManager.create(Event, data);
    await transactionalEntityManager.save(event);

    // Simulate error
    throw new Error('Test error');
  });

  // Verify rollback
  const count = await repository.count();
  expect(count).toBe(0);
});
```

## Current Test Coverage

### Existing Tests
| File | Description |
|------|-------------|
| `server/src/routes/auth.test.ts` | Authentication endpoints |
| `server/src/routes/batchDetection.test.ts` | Batch detection endpoints |
| `server/src/routes/reviewRoutes.test.ts` | Review segment endpoints |
| `server/src/routes/visitorRoutes.test.ts` | Visitor management endpoints |
| `server/src/models/Event.test.ts` | Event entity tests |
| `server/src/models/User.test.ts` | User entity tests |
| `server/src/models/Role.test.ts` | Role entity tests |
| `server/src/models/AuditLog.test.ts` | Audit log entity tests |
| `server/src/services/review/reviewService.test.ts` | Review service tests |
| `server/src/services/timeline/timelineService.test.ts` | Timeline service tests |
| `server/src/services/detection/detectionService.test.ts` | Detection service tests |

### Test Gaps
Areas needing more tests:
- OpenCV service integration (Python)
- Real-time streaming (Socket.io)
- Motion detection logic
- Face recognition pipeline
- Notification service
- Storage cleanup jobs
- Frontend component tests

## Running Tests

### Backend Tests
```bash
# Run all tests
cd server
npm run test:server

# Run tests in watch mode
npm run test:server -- --watch

# Run specific test file
npm run test:server -- auth.test.ts

# Run tests matching pattern
npm run test:server -- --testNamePattern="should create"

# Generate coverage report
npm run test:server -- --coverage
```

### Frontend Tests
```bash
# Run all tests
cd frontend
npm run test

# Run tests in watch mode
npm run test:watch

# Run coverage
npm run test:coverage

# Run specific test pattern
npm run test -- --testPathPattern="services"
```

### Root Level
```bash
# Run backend tests
npm run test:server

# Run frontend tests
npm run test
```

## CI/CD Integration

### GitHub Actions (if configured)
```yaml
name: Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm install
      - run: npm run test:server
      - run: npm run test
```

### Pre-commit Hooks (if configured)
```json
{
  "husky": {
    "hooks": {
      "pre-commit": "npm run test && npm run lint"
    }
  }
}
```

## Testing Database

### Test Database Setup
```typescript
// tests/setup.ts
import { AppDataSource } from '../src/database.js';

beforeAll(async () => {
  // Initialize test database
  await AppDataSource.initialize({
    type: 'postgres',
    host: 'localhost',
    port: 5432,
    username: 'test',
    password: 'test',
    database: 'sentryvision_test',
    synchronize: true,
    dropSchema: true
  });
});

afterAll(async () => {
  // Close connection
  await AppDataSource.destroy();
});

afterEach(async () => {
  // Clean tables after each test
  const entities = AppDataSource.entityMetadatas;
  for (const entity of entities) {
    const repository = AppDataSource.getRepository(entity.name);
    await repository.clear();
  }
});
```

## Debugging Tests

### Debug Mode
```bash
# Run tests in debug mode
node --inspect-brk node_modules/.bin/jest --runInBand

# Then attach debugger in VS Code
```

### Console Output
```typescript
it('should log debug info', () => {
  console.log('Debug:', variable);
  expect(true).toBe(true);
});
```

### Test Isolation
```bash
# Run single test file
npm run test:server -- auth.test.ts

# Run single test
npm run test:server -- --testNamePattern="should login"
```

## Performance Testing

### Load Testing (not implemented)
Consider tools like:
- Artillery (API load testing)
- k6 (Performance testing)
- JMeter (Load testing)

### Benchmarking (not implemented)
```typescript
describe('Performance', () => {
  it('should complete detection within 100ms', async () => {
    const start = Date.now();
    await detectionService.detectMotion(frame);
    const duration = Date.now() - start;

    expect(duration).toBeLessThan(100);
  });
});
```

## Testing Anti-Patterns

### Brittle Tests
```typescript
// Bad: Tests implementation
it('should call repository.find', () => {
  await service.getAll();
  expect(mockRepository.find).toHaveBeenCalled();
});

// Good: Tests behavior
it('should return all events', () => {
  const events = await service.getAll();
  expect(events).toHaveLength(10);
});
```

### Overspecified Tests
```typescript
// Bad: Too many assertions
it('should create event', () => {
  const event = await service.create(data);
  expect(event.id).toBeDefined();
  expect(event.event_type).toBe('motion');
  expect(event.camera_id).toBe('cam1');
  expect(event.timestamp).toBeDefined();
  expect(event.confidence).toBe(0.85);
  expect(event.metadata).toBeNull();
});

// Good: One assertion per test
it('should create event with correct type', () => {
  const event = await service.create(data);
  expect(event.event_type).toBe('motion');
});
```

### Shared State
```typescript
// Bad: Tests depend on order
let eventId;

it('should create event', async () => {
  const event = await service.create(data);
  eventId = event.id;
});

it('should update event', async () => {
  await service.update(eventId, { event_type: 'person' });
});

// Good: Each test is independent
it('should create and update event', async () => {
  const event = await service.create(data);
  const updated = await service.update(event.id, { event_type: 'person' });
  expect(updated.event_type).toBe('person');
});
```

## Future Testing Improvements

### Recommended Additions
1. **Frontend component tests** - React Testing Library
2. **E2E tests** - Playwright or Cypress
3. **Visual regression tests** - Percy or Chromatic
4. **Contract tests** - OpenAPI validation
5. **Performance tests** - Load testing for detection endpoints
6. **Integration tests** - Full stack tests with test database

### Testing Goals
- Increase coverage to 90%+
- Add E2E tests for critical paths
- Implement visual regression testing
- Add load testing for streaming endpoints
- Contract testing for API contracts

## Resources

### Documentation
- Jest: https://jestjs.io/
- Supertest: https://github.com/visionmedia/supertest
- React Testing Library: https://testing-library.com/react

### Internal
- Test files: `server/src/**/*.test.ts`
- Jest config: `jest.config.js`, `server/jest.config.js`
- Test scripts: `package.json` → `scripts`
