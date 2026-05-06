# Coding Conventions

**Analysis Date:** 2026-05-06

## Naming Patterns

**Files:**
- React components: PascalCase — e.g., `CameraGrid.tsx`, `ProtectedRoute.tsx`, `ErrorBoundary.tsx`
- React pages: PascalCase, optionally with `.new` suffix — e.g., `Dashboard.tsx`, `Review.new.tsx`
- React contexts: PascalCase with `Context` suffix — e.g., `AuthContext.tsx`, `SocketContext.tsx`
- React hooks: camelCase with `use` prefix — e.g., `use-toast.ts`, `useReview.ts`
- Server routes: camelCase with `Routes` suffix — e.g., `visitorRoutes.ts`, `storageRoutes.ts`, `reviewRoutes.ts`
- Server services: camelCase with `Service` suffix — e.g., `reviewService.ts`, `detectionService.ts`, `cacheService.ts`
- Server models (TypeORM entities): PascalCase — e.g., `Event.ts`, `User.ts`, `AuditLog.ts`
- Server utils: camelCase — e.g., `logger.ts`, `encryption.ts`, `fileHash.ts`
- Server middleware: camelCase — e.g., `auth.ts`, `rateLimit.ts`, `zodValidation.ts`
- Server config: camelCase — e.g., `index.ts`, `detectionConfig.ts`
- Test files: co-located with source, same name + `.test.ts` — e.g., `Event.ts` → `Event.test.ts`
- Barrel/index files: `index.ts` — e.g., `server/src/models/index.ts`, `server/src/routes/index.ts`
- Python: snake_case — e.g., `app.py`, `improved_face_recognition.py`

**Variables & Functions:**
- camelCase for all variables and functions: `mockDb`, `adminToken`, `validateCameraId()`, `generateBasicHTML()`
- Boolean variables use `is/has/should` prefix: `isAuthenticated`, `isLoading`, `hasRequiredRole`
- Constants: UPPER_SNAKE_CASE for true constants, camelCase for config objects — e.g., `CAMERA_ID_PATTERN`, `LOGGING_CONFIG`

**Types & Interfaces:**
- PascalCase for interfaces and types: `MotionEvent`, `CameraConfig`, `AuthState`
- Interface names never prefixed with `I` — e.g., `User` not `IUser`
- Type aliases for discriminated unions: `AuthAction`, `ValidationTarget`
- Generics use single letter: `T`, `K`

**Classes:**
- PascalCase for classes: `Event`, `ReviewService`, `DetectionService`, `CircuitBreaker`, `ApiError`
- Abstract base class: `BaseService` (`server/src/services/baseService.ts`)
- Private members use `private` keyword (not `#` prefix)

**Enums:**
- PascalCase for enum names, UPPER_SNAKE_CASE for values: `CircuitState.CLOSED`, `CircuitState.HALF_OPEN`
- String literal union types preferred for simple cases: `'active' | 'inactive' | 'suspended' | 'locked'`

## Code Style

**Formatting:**
- No Prettier config detected — formatting is not enforced via auto-formatter
- ESLint uses flat config format (`eslint.config.js`) at `frontend/eslint.config.js`
- Tab width: 2 spaces (observed consistently across files)
- Trailing commas: inconsistent (some files have, some don't)
- Semicolons: used consistently

**Linting:**
- ESLint v9 with flat config: `frontend/eslint.config.js`
- Plugins: `eslint-plugin-react-hooks`, `eslint-plugin-react-refresh`, `typescript-eslint`
- Key rules:
  - `@typescript-eslint/no-unused-vars: "off"` — unused vars allowed
  - `react-refresh/only-export-components: "warn"` — warn on non-component exports
- No ESLint config detected for backend — backend linting not configured

**TypeScript:**
- Frontend: `strict: false` — `noUnusedLocals: false`, `noUnusedParameters: false`, `noImplicitAny: false`
- Backend: `strict: false` — `experimentalDecorators: true`, `emitDecoratorMetadata: true` (for TypeORM)
- Both targets: ES2022
- Backend module: `nodenext`, Frontend module: `ESNext` (bundler resolution)
- Use `.js` extension in ESM imports even for `.ts` files: `import { Event } from './Event.js'`

## Import Organization

**Order (backend — `server/src/`):**
1. External libraries: `import express from 'express'`, `import { z } from 'zod'`
2. Node built-ins (with `node:` prefix): `import path from 'node:path'`, `import fs from 'node:fs'`
3. Internal imports with relative paths + `.js` extension: `import { Event } from '../models/Event.js'`

**Order (frontend — `frontend/src/`):**
1. External libraries: `import React from 'react'`, `import { Toaster } from "@/components/ui/toaster"`
2. Internal imports using `@/` alias: `import { Camera } from '@/types/security'`
3. Relative imports: `import { logger } from './lib/logger'`

**Path Aliases:**
- Frontend: `@/*` → `./src/*` (configured in `frontend/tsconfig.json` and `frontend/vite.config.ts`)
- Backend: No path aliases — uses relative paths exclusively

**ESM Convention:**
- All imports use `.js` extension for TypeScript files in the backend: `import { User } from './User.js'`
- Backend uses `"type": "module"` in `package.json` — native ES modules

## Error Handling

**Backend API Response Pattern:**
All API responses follow a consistent envelope:
```typescript
// Success
res.json({
  success: true,
  data: { ... },
});

// Error
res.status(400).json({
  success: false,
  error: 'Descriptive error message',
  details: error instanceof Error ? error.message : 'Unknown error',
});
```
Examples: `server/src/routes/storageRoutes.ts`, `server/src/middleware/auth.ts`

**Backend Error Handling in Route Handlers:**
```typescript
router.get('/stats/overview', async (req: Request, res: Response) => {
  try {
    const result = await someService.getData();
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Error retrieving data:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve data',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});
```
Source: `server/src/routes/storageRoutes.ts`

**Frontend Error Classes:**
Custom error hierarchy in `frontend/src/services/ApiService.ts`:
```typescript
export class ApiError extends Error { ... }
export class NetworkError extends ApiError { ... }
export class TimeoutError extends ApiError { ... }
```

**Frontend Error Boundaries:**
React error boundary at `frontend/src/components/ErrorBoundary.tsx`, wrapping the entire app in `frontend/src/App.tsx`.

**Authentication Errors:**
Structured error responses with specific status codes:
- 401: Missing/invalid token — `server/src/middleware/auth.ts`
- 403: Insufficient permissions — `server/src/middleware/auth.ts`
- 400: Validation failure — `server/src/middleware/zodValidation.ts`

**Validation Errors (Zod):**
```typescript
// server/src/middleware/zodValidation.ts
if (error instanceof ZodError) {
  const validationErrors = error.errors.map(err => ({
    field: err.path.join('.'),
    message: err.message,
    code: err.code
  }));
  res.status(400).json({
    error: 'Validation failed',
    message: 'Invalid input data',
    details: validationErrors,
  });
}
```

## Logging

**Backend Logger:** Custom logger at `server/src/utils/logger.ts`
- Exported as `logger` singleton with methods: `info()`, `warn()`, `error()`, `debug()`
- Source tagging: `logger.info('message', 'SOURCE', metadata)`
- Common sources: `'SERVER'`, `'API'`, `'SOCKET'`, `'STREAM'`, `'MOTION'`, `'CORS'`, `'PERFORMANCE'`, `'MEMORY'`
- Helper methods: `logger.apiRequest()`, `logger.apiResponse()`, `logger.apiError()`, `logger.motionDetected()`, `logger.socketConnect()`
- File logging available but disabled by default (`enableFileLogging: false`)
- Log rotation: 10MB max, 5 files max

**Frontend Logger:** Custom logger at `frontend/src/lib/logger.ts`
- Exported as `logger` singleton (class-based)
- Methods: `info()`, `warn()`, `error()`, `debug()`
- Helper methods: `apiRequest()`, `apiResponse()`, `apiError()`, `socketEvent()`, `userAction()`, `cameraAction()`, `performance()`
- Stores logs in localStorage (up to 1000 entries)
- Optional remote logging via configurable endpoint

**Pattern:** Both loggers use the same source-tagging convention — always pass a source string as the second argument.

## Comments

**When to Comment:**
- File-level comments on some model files: `// File: server/src/models/User.ts`
- Inline comments for non-obvious logic: regex patterns, numeric thresholds, workarounds
- TODO comments for deferred work: `// TODO: Migrate to PostgreSQL audit_logs` in `server/src/utils/logger.ts`

**TSDoc/JSDoc:**
- Not consistently used — most functions lack doc comments
- Module-level docstrings in Python: `"""OpenCV Detection Service - Python Implementation"""`
- TypeORM column comments used for schema documentation: `@Column({ comment: 'Type of event...' })`

## Function Design

**Size:** Route handlers can be long (the main `routes/index.ts` is 5000+ lines). Service functions tend to be more focused.

**Parameters:**
- Route handlers: Express `(req: Request, res: Response)` or `(req: Request, res: Response, next: NextFunction)`
- Services: Dependency injection via constructor — pass repositories and dependencies
- Middleware: Factory pattern returning `(req, res, next) => void`

**Return Values:**
- Route handlers: Always `res.json()` or `res.status().json()` — never return data directly
- Services: Return typed objects or `Promise<T>`
- API responses: Always wrapped in `{ success: boolean, data?: T, error?: string }`

## Module Design

**Exports:**
- Default exports for React components: `export default ProtectedRoute`
- Named exports for utilities, services, types: `export const logger`, `export class ReviewService`
- Named exports for Route configurators: `export function configureRoutes(app: Express)`
- Barrel file for models: `server/src/models/index.ts` — re-exports all entities

**Barrel Files:**
- `server/src/models/index.ts` — exports all TypeORM entities
- No barrel files for routes or services — imported directly

**Route Pattern:**
Routes use an Express Router or a configure function:
```typescript
// Pattern 1: Router export (storageRoutes.ts)
const router = Router();
router.get('/stats/overview', async (req, res) => { ... });
export default router;

// Pattern 2: Configure function (index.ts)
export function configureRoutes(app: Express, io: SocketIOServer): void {
  app.get('/api/events/list', async (req, res) => { ... });
}
```

**Service Pattern:**
Services use dependency injection via constructor:
```typescript
// server/src/services/review/reviewService.ts
export class ReviewService {
  constructor(
    private reviewSegmentRepo: Repository<ReviewSegment>,
    private reviewStatusRepo: Repository<UserReviewStatus>,
    private timelineService: TimelineService,
    private previewService: PreviewService,
  ) {}
}
```

**Context Pattern (Frontend):**
React contexts use `useReducer` for state management:
```typescript
// frontend/src/contexts/AuthContext.tsx
function authReducer(state: AuthState, action: AuthAction): AuthState { ... }
export function AuthProvider({ children }: { children: ReactNode }) { ... }
export function useAuth(): AuthContextType { ... }
```

## Validation

**Zod Schemas:** All API input validation uses Zod (`server/src/schemas/validationSchemas.ts`):
```typescript
export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20)
});
```

**Middleware:** Two validation middleware approaches:
- `server/src/middleware/zodValidation.ts` — Zod-specific with `validateBody()`, `validateQuery()`, `validateParams()`
- `server/src/middleware/validation.ts` — generic `validate()` with `commonSchemas`

---

*Convention analysis: 2026-05-06*
