# Testing Approach

## Overview
SentryVision employs a comprehensive testing strategy with unit, integration, and end-to-end tests. The primary testing framework is Jest, with different configurations and utilities for frontend and backend testing.

## Testing Framework

### Jest
- **Primary testing framework** for both frontend and backend
- **Version**: ^30.2.0
- **Configuration**: 
  - Root: `jest.config.js` (configured for backend/server tests)
  - Frontend: Inherited from Vite/react-scripts setup
- **Features**:
  - Mocking and spying capabilities
  - Code coverage reporting
  - Watch mode for development
  - Parallel test execution
  - TypeScript support via ts-jest

### Testing Libraries
#### Frontend
- **React Testing Library**: For testing React components
  - Focuses on user behavior rather than implementation details
  - Queries elements by role, label, text, etc.
  - Encourages accessible component design
- **Jest DOM**: Custom Jest matchers for DOM assertions
- **User Event**: Simulates user interactions

#### Backend
- **Supertest**: For testing HTTP endpoints
  - Version: ^7.1.4
  - High-level abstraction for testing HTTP
  - Built on top of superagent
  - Assertions for status codes, headers, and response bodies
- **Test Doubles**: Jest's built-in mocking functionality
  - Manual mocks for external dependencies
  - SpyOn for tracking function calls
  - Mock implementations for services and repositories

## Test Organization

### Backend Tests (`/server/tests/`)
```
tests/
├── setup.ts                  # Test environment setup
├── setup.test.ts             # Verifies test setup
├── basic.test.ts             # Basic functionality tests
├── services/                 # Service layer tests
│   ├── authenticationService.test.ts
│   └── basic.test.ts
├── routes/                   # Route handler tests
│   ├── auth.test.ts          # Authentication endpoints
│   ├── batchDetection.test.ts # Batch processing endpoints
│   ├── reviewRoutes.test.ts  # Review segment endpoints
│   └── visitorRoutes.test.ts # Visitor management endpoints
└── utils/                    # Utility function tests
    ├── fileHash.test.ts
    ├── encryption.test.ts
    ├── cronJobs.test.ts
    └── logger.test.ts
```

### Frontend Tests
Frontend tests are co-located with the source files they test:
```
frontend/src/
├── components/
│   ├── *.test.tsx           # Component tests
│   └── ...
├── pages/
│   ├── *.test.tsx           # Page tests
│   └── ...
├── hooks/
│   ├── *.test.ts            # Custom hook tests
│   └── ...
├── services/
│   ├── *.test.ts            # Service tests
│   └── ...
├── contexts/
│   ├── *.test.ts            # Context tests
│   └── ...
└── lib/
    ├── *.test.ts            # Utility tests
    └── ...
```

Note: Based on codebase examination, frontend test files appear to be minimal or not yet extensively implemented, while backend has a more established test suite.

## Test Configuration

### Backend Jest Configuration (`jest.config.js`)
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

### Key Configuration Points
- **ESM Support**: Configured for TypeScript ES modules
- **Test Environment**: Node.js environment for backend tests
- **Coverage Collection**: 
  - Collects from all backend source files
  - Excludes declaration files and test files themselves
  - Threshold: 80% for branches, functions, lines, statements
- **Test Matching**: Flexible pattern matching for test files
- **Transform**: Uses ts-jest for TypeScript compilation
- **Timeout**: 10 second test timeout

## Testing Patterns and Practices

### Unit Testing
#### Service Layer Tests
- **Isolation**: Services tested with mocked dependencies
- **Mocking**: External services (OpenCV, database, email) mocked
- **Focus**: Business logic validation and error handling
- **Examples**:
  - Authentication service: JWT generation, validation, MFA handling
  - Detection service: Result normalization, confidence calculation
  - Notification service: Email templating, send logic

#### Repository/DAO Tests
- **Limited**: Most data access tested through service tests
- **Direct testing**: Complex queries or performance-critical operations
- **Mock database**: Using in-memory SQLite or jest.mocked repositories

#### Utility Function Tests
- **Pure functions**: String manipulation, date formatting, validation
- **Edge cases**: Boundary conditions and error conditions
- **Examples**:
  - Password security: Hashing and validation
  - Encryption: Symmetric encryption/decryption
  - File operations: Safe file handling, path resolution
  - JWT service: Token generation and verification

### Integration Testing
#### API Endpoint Tests
- **Supertest**: Actual HTTP requests to running Express app
- **Test database**: Isolated test schema for database operations
- **Middleware stack**: Full middleware execution (auth, validation, etc.)
- **Authentication**: Mocked or bypassed for test scenarios
- **Examples**:
  - Auth endpoints: Login, logout, refresh, MFA flows
  - Event endpoints: Creation, retrieval, filtering, deletion
  - Review endpoints: Segment creation, acknowledgment, filtering
  - Visitor endpoints: CRUD operations and timeline queries

#### Service Integration Tests
- **Cross-service interactions**: Testing how services work together
- **Limited mocking**: Some external dependencies mocked, others real
- **Database**: Real test database connections
- **Examples**:
  - Detection pipeline: Motion → Object/Face detection → Storage
  - Notification triggering: Event → Alert generation → Delivery
  - Batch processing: Job queuing → Processing → Completion

### End-to-End Testing
- **Limited implementation**: Based on codebase examination, E2E tests appear to be minimal
- **Potential tools**: Cypress or Playwright would be typical choices
- **Current approach**: Likies rely on integration tests for critical user flows

## Test Data and Fixtures

### Factories and Test Data Generation
#### Factory Pattern
- **Location**: `/server/tests/utils/factories.ts`
- **Purpose**: Generate test data for entities and models
- **Usage**: Consistently create test objects with valid data
- **Customization**: Override default values for specific test scenarios

#### Test Data Management
- **Isolated database**: Test schema separate from development/production
- **Seeding**: Common test data loaded before test suites
- **Cleanup**: Database cleared between tests to ensure isolation
- **Fixtures**: Pre-defined test scenarios for complex setups

### Mocking Strategies
#### External Services
- **OpenCV Service**: Mocked HTTP responses for detection results
- **Email Service**: Mocked nodemailer transport
- **Push Notifications**: Mocked web-push library
- **MQTT**: Mocked mqtt client connections
- **File System**: Mocked fs operations where appropriate

#### Timing Functions
- **Jest fake timers**: For testing timeouts, intervals, and delays
- **Date mocking**: For time-sensitive functionality
- **Cron jobs**: Testing scheduling logic without waiting

## Coverage Requirements
- **Threshold**: 80% for branches, functions, lines, and statements (global)
- **Enforcement**: Configured in jest.config.js
- **Reporting**: Text, lcov, and HTML reports generated
- **Monitoring**: Coverage tracked over time to prevent regression

## Test Execution

### Scripts
#### Backend
```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Run specific test suites
npm run test:services
npm run test:utils
```

#### Frontend (based on package.json scripts)
```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Run specific test types
npm run test:setup
npm run test:services
npm run test:utils
```

### Continuous Integration
- **Pre-commit**: Linting and type checking
- **Pull request**: Tests run on CI platform
- **Main branch**: Tests required to pass before merge
- **Nightly**: Extended test runs including coverage reports

## Best Practices and Conventions

### Test Naming
- **Files**: Same name as source with `.test.ts` suffix
- **Blocks**: `describe()` for units under test
- **Assertions**: `it()` or `test()` for individual test cases
- **Behavioral**: Focus on what the code does, not how
- **Examples**:
  - `describe('AuthenticationService', () => {`
  - `it('should generate valid JWT token', () => {`
  - `it('should reject invalid credentials', () => {`

### Arrange-Act-Assert Pattern
1. **Arrange**: Set up test data, mocks, and preconditions
2. **Act**: Execute the function or method being tested
3. **Assert**: Verify expected outcomes and side effects

### Testing Philosophy
- **Test behavior, not implementation**: Resistant to refactoring
- **Test at appropriate levels**: Unit for logic, integration for interactions
- **Maintain test isolation**: No shared state between tests
- **Fast tests**: Prefer unit tests over slow end-to-end when possible
- **Meaningful assertions**: Check for specific expected outcomes
- **Edge cases**: Test boundary conditions and error paths
- **Positive and negative**: Test both valid and invalid inputs

### Common Test Utilities
#### Test Helpers
- **Request builders**: For creating HTTP test requests
- **Response validators**: For checking response structures
- **Authentication mocks**: For bypassing auth in tests
- **Database reset**: Utilities to clean test database
- **Time controllers**: For manipulating dates and timers

#### Mock Repositories
- **Interface adherence**: Matching repository method signatures
- **Configurable responses**: Return predefined data or throw errors
- **Call tracking**: Monitoring which methods were called with what args
- **Reset capability**: Clear call history between tests

## Areas for Improvement

### Current Gaps
1. **Frontend testing**: Limited test coverage for components, hooks, and pages
2. **End-to-end testing**: Minimal implementation of user flow tests
3. **Test maintenance**: Some tests may be brittle due to implementation details
4. **Performance testing**: Lack of load and stress testing for detection pipeline
5. **Security testing**: Limited penetration testing or vulnerability scanning

### Recommended Enhancements
1. **Increase frontend test coverage**: Add React Testing Library tests for components
2. **Implement E2E tests**: Use Cypress or Playwright for critical user journeys
3. **Add visual regression testing**: For UI component consistency
4. **Implement contract testing**: For backend-frontend API agreements
5. **Add chaos engineering**: Test system behavior under failure conditions
6. **Implement mutation testing**: To assess test effectiveness
7. **Add API contract validation**: Using tools like Pact or Dredd
8. **Implement performance benchmarks**: For detection latency and throughput