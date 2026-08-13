---
mapped: 2026-08-13
focus: quality
---

# Coding Conventions

> Generated from codebase analysis on 2026-08-13

## Language Conventions
- **TypeScript Strictness**: Frontend (`frontend/tsconfig.json`) and Backend (`server/tsconfig.json`) both have `strict: false`. Prefer explicit types where possible, but use `noImplicitAny: false`.
- **Async/Await**: Everywhere. Controllers are async, services are async. Use `try-catch` blocks liberally, especially in controllers and service methods involving network or DB.
- **ESM**: Node.js backend (`server/package.json` with `type: "module"`) and Vite frontend use ESM modules.

## Naming Conventions
- **Files**: PascalCase for components (`CameraGrid.tsx`, `CameraController.ts`), camelCase for utilities (`apiService.ts`, `authMiddleware.ts`).
- **Variables/Functions**: camelCase.
- **Entities/Models**: PascalCase (e.g., `Event.ts`, `User.ts`).

## Code Organization
- **Imports**: External libraries first, then absolute path aliases (`@/*` in frontend, `src/*` in backend), then relative paths.
- **Barrel Files**: `server/src/models/index.ts` is used to re-export entities.

## Error Handling
- **Controllers**: Always wrap in `try-catch`.
- **API Errors**: Use custom classes like `ApiError`, `NetworkError`, `TimeoutError` (see `frontend/src/services/api/baseClient.ts`).
- **Middleware**: Validation middleware `server/src/middleware/validation.ts` catches validation issues and returns structured JSON responses.

## State Management
- **Frontend**: React Context (`frontend/src/contexts/AuthContext.tsx`) for global authentication state.

## API Patterns
- **Base Client**: `frontend/src/services/api/baseClient.ts` uses `fetch` with automatic retries and auth header injection.
- **Response Format**: Consistent JSON responses. OK responses use `{ success: true, ...data }`. Errors use `{ success: false, error: "..." }`.

## Logging & Observability
- **Logger**: A centralized logger exists in `server/src/utils/logger.ts`. It logs to console, error/combined/access log files, and optionally the database.

## Linting & Formatting
- **Linting**: ESLint (`frontend/eslint.config.js`) for React/TS. Use `npm run lint` and `npm run lint:fix`.
- **Formatting**: Not explicitly configured with a formatter tool, but maintain consistent spacing.

---
*Convention analysis: 2026-08-13*
