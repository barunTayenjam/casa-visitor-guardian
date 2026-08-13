---
mapped: 2026-08-13
focus: quality
---

# Testing

> Generated from codebase analysis on 2026-08-13

## Test Framework
- **Runner**: Jest.
- **Config**: `server/jest.config.js`, `frontend/jest.config.ts`.
- **Environment**: Backend (`node`), Frontend (`jsdom`).

## Test File Organization
- **Location**: Co-located with code or in `__tests__/` directories.
- **Naming**: `*.test.ts` or `*.spec.ts`.

## Test Structure
- **Suite Organization**: Use `describe` blocks.
- **Setup**: `setupFilesAfterEnv` points to `jest.setup.ts`.

## Mocking
- **Mocking**: Used in `frontend/src/__mocks__/` to mock services like `baseClient` or `authService` during testing.

## Coverage
- **Threshold**: Global 80% coverage (branches, functions, lines, statements) enforced in Jest configs.

## Running Tests
- **Frontend**: `npm run test` (executes `jest`).
- **Backend**: `npm run test:server` (executes `jest` via `node --experimental-vm-modules`).
- **All**: `npm run test:all` (executes `jest --coverage`).

---
*Testing analysis: 2026-08-13*
