# Testing

> Generated: 2026-08-15 | Focus: Quality | Scope: full repo

## Testing Stack

- **Framework**: Jest
- **Run**: `npm run test`, `npm run test:all` (with coverage)
- **Frontend Environment**: `jest-environment-jsdom`
- **Python Framework**: pytest (in `opencv-service/tests/`)

## Structure

- Frontend tests live in `frontend/src/__tests__/`, `frontend/src/tests/`.
- Python tests in `opencv-service/tests/` using fixtures and mocks.
- Service-specific tests in `server/src/services/__tests__/` (e.g. `circuitBreaker.test.ts`).

## Approach

- **Unit tests**: Focus on isolated business logic, service clients, hooks, and utility functions.
- **Mocking**: Use mocks for API calls (`jest.mock`), external service clients, and DB connections.
- **Regression**: Capture snapshots for UI components to prevent unintended visual drifts.
- **Pipeline**: Python OpenCV tests ensure detection components work independently of Node.

## CI/CD

- `npm run health:check` in root package triggers build + lint validation.
- Tests are part of the `package.json` script structure (`test:*`).
- Database migrations tested against `sentryvision_test` database via `.env` variables.
