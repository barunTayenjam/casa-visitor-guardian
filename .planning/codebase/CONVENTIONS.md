# Coding Conventions

**Analysis Date:** 2026-05-15

## Naming Patterns

**Files:**
- React components: PascalCase (e.g., `CameraStream.tsx`, `ErrorBoundary.tsx`, `ProtectedRoute.tsx`)
- Pages: PascalCase (e.g., `Login.tsx`, `NotFound.tsx`, `Dashboard.tsx` — note: many pages use `.new.tsx` suffix)
- Utility/service files: camelCase (e.g., `apiService.ts`, `auditLogger.ts`, `cronJobs.ts`)
- TypeORM models: PascalCase matching entity name (e.g., `User.ts`, `Event.ts`, `AuditLog.ts`)
- Test files: co-located with source, same name + `.test.ts` (e.g., `User.test.ts`, `logger.test.ts`)
- Route files: camelCase with descriptive suffix (e.g., `visitorRoutes.ts`, `reviewRoutes.ts`, `detectionRoutes.ts`)
- Detection modules: camelCase descriptive (e.g., `optimizedMotionDetection.ts`, `simpleMotionDetection.ts`)
- Config files: camelCase (e.g., `detectionConfig.ts`, `index.ts`)

**Functions:**
- Route handler functions: camelCase (e.g., `configureAuthRoutes`, `configureRoutes`)
- Middleware factory functions: camelCase (e.g., `authenticate`, `validate`, `createAuthRateLimit`)
- Utility functions: camelCase (e.g., `fileHash`, `validateCameraId`, `getOpenCVServiceUrl`)
- React hooks: `use` prefix + PascalCase (e.g., `useAuth`, `useCameras`, `useSocketContext`)
- Python functions: snake_case (e.g., `load_class_names`, `detect_objects`)

**Variables:**
- camelCase throughout TypeScript/JavaScript (e.g., `mockDb`, `adminToken`, `connectionStatus`)
- Constants: UPPER_SNAKE_CASE (e.g., `CAMERA_ID_PATTERN`, `DEFAULT_TRACKED_OBJECTS`, `LOGGING_CONFIG`)
- Python variables: snake_case (e.g., `connection_pool`, `class_names`, `cache_ttl`)

**Types/Interfaces:**
- PascalCase for interfaces and types (e.g., `AuthState`, `AuthOptions`, `MotionEvent`, `Camera`)
- Use `interface` for object shapes; `type` for unions/intersections
- Exported types are defined in dedicated files (e.g., `frontend/src/types/security.ts`)
- Type-only imports should use `import type` when possible

## Code Style

**Formatting:**
- No Prettier configuration file detected
- ESLint configured for frontend via `frontend/eslint.config.js`
- No Biome configuration detected
- Indentation: 2 spaces
- Single quotes for strings (consistent in backend); double quotes in some frontend files
- Trailing commas in multi-line structures

**Linting (Frontend):**
- Tool: ESLint 9 with `@eslint/js` + `typescript-eslint`
- Config: `frontend/eslint.config.js`
- Plugins: `eslint-plugin-react-hooks`, `eslint-plugin-react-refresh`
- Key rules:
  - `@typescript-eslint/no-unused-vars`: `"off"` (intentionally disabled)
  - `react-refresh/only-export-components`: `"warn"` with `allowConstantExport: true`
- Ignored: `dist/`, `data/`, `logs/`, `node_modules/`, `.vite/`, `coverage/`
- Run: `npm run lint` (from `frontend/` or root)
- Fix: `npm run lint:fix`

**Linting (Backend):**
- No dedicated ESLint config detected for server
- TypeScript strict mode is `false` in both `frontend/tsconfig.json` and `server/tsconfig.json`

**TypeScript Settings:**
- Frontend target: ES2020, module: ESNext, bundler resolution
- Backend target: ES2022, module: nodenext, nodenext resolution
- Both use `strict: false` — not strict mode
- `noImplicitAny: false`, `noUnusedLocals: false`, `noUnusedParameters: false` (frontend)
- Experimental decorators enabled in backend (for TypeORM)

## Import Organization

**Order:**
1. External library imports (React, Express, TypeORM, etc.)
2. Internal imports using path aliases or relative paths
3. Type imports

**Path Aliases:**
- Frontend: `@/*` maps to `./src/*` (configured in `frontend/tsconfig.json` and `frontend/vite.config.ts`)
  ```typescript
  import { Button } from '@/components/ui/button';
  import { useAuth } from '@/contexts/AuthContext';
  import { Camera } from '@/types/security';
  import { cn } from '@/lib/utils';
  ```
- Backend: No path aliases; uses relative paths with `.js` extension for ESM
  ```typescript
  import { authService } from '../auth/index.js';
  import { validate, commonSchemas } from '../middleware/validation.js';
  import { logger } from '../utils/logger.js';
  ```

**ES Module Convention:**
- Both frontend and backend use `"type": "module"` in `package.json`
- Backend imports MUST include `.js` extension for ESM resolution:
  ```typescript
  import { User } from './User.js';    // Correct
  import { User } from './User';        // Incorrect — will fail in ESM
  ```
- Node.js built-ins use `node:` prefix:
  ```typescript
  import path from 'node:path';
  import fs from 'node:fs';
  import http from 'node:http';
  ```

**Python (OpenCV Service):**
- Standard library imports first, then third-party, then local
  ```python
  from flask import Flask, request, jsonify
  import cv2
  import numpy as np
  ```

## Error Handling

**Backend API Responses:**
- Consistent response envelope: `{ success: boolean, error?: string, data?: any }`
- HTTP status codes follow REST conventions:
  - `200` — success
  - `201` — created
  - `400` — validation error
  - `401` — unauthorized
  - `403` — forbidden
  - `404` — not found
  - `500` — server error
- All route handlers wrapped in try-catch:
  ```typescript
  // Pattern from server/src/routes/auth.ts
  async (req: Request, res: Response) => {
    try {
      const result = await authService.register({ ... });
      if (result.success) {
        return res.status(201).json({ success: true, ... });
      } else {
        return res.status(400).json({ success: false, error: result.error });
      }
    } catch (error) {
      logger.error(`Registration error: ${error}`, 'AuthRoutes');
      return res.status(500).json({ success: false, error: 'Registration failed' });
    }
  }
  ```
- Never expose internal error details to client in 500 responses

**Frontend Error Handling:**
- Custom error classes: `ApiError`, `NetworkError`, `TimeoutError` in `frontend/src/services/ApiService.ts`
- React Error Boundary component: `frontend/src/components/ErrorBoundary.tsx`
- Error state in Context API: `AuthContext` uses `error: string | null` in state
- Toast notifications via `sonner` library for user-facing errors

**Validation:**
- Backend: Custom validation middleware in `server/src/middleware/validation.ts`
  - Schema-based validation with `ValidationRule` interface
  - `validate(schema: ValidationSchema)` middleware factory
  - Returns `400` with field-level error details
- Frontend: Zod for form validation, `react-hook-form` with `@hookform/resolvers`

## Logging

**Backend Framework:** Custom logger wrapping console methods (`server/src/utils/logger.ts`)

**API:**
```typescript
import { logger } from '../utils/logger.js';

logger.info(`User registered: ${username}`, 'AuthRoutes');
logger.warn(`Auth rate limit check failed: ${err}`, 'AuthRoutes');
logger.error(`Registration error: ${error}`, 'AuthRoutes');
logger.debug('Successfully decrypted RTSP credential', 'Config');
```

**Source Tags:** Second argument is a source tag string for filtering:
- `AuthRoutes`, `AuthMiddleware`, `Validation`, `ROUTES`, `SOCKET`, `STREAM`, `SERVER`, `MOTION`, `PERFORMANCE`, `CORS`, `Config`, `API`

**Specialized methods:**
```typescript
logger.socketConnect(socketId, address, totalClients);
logger.motionDetected(cameraId, confidence, timestamp);
logger.apiRequest(method, url, ip, userAgent);
logger.serverStart(port);
```

**Configuration flags:** `LOGGING_CONFIG` in `logger.ts` controls which categories are enabled. Most info/debug logging is disabled by default to reduce overhead.

**Frontend:** Custom Logger class in `frontend/src/lib/logger.ts` with console + localStorage + optional remote logging.

## Comments

**When to Comment:**
- File-level comments on some files (e.g., `// File: server/src/models/User.ts`)
- Inline comments for configuration decisions and non-obvious logic
- `// Note:` prefix for important implementation notes
- Section separators using `//` comments in large files

**JSDoc/TSDoc:**
- Not consistently used
- TypeORM models use `comment` property on column decorators for documentation
- Some interfaces have inline field descriptions

## Function Design

**Size:** No strict limit enforced, but large files exist (e.g., `server/src/routes/index.ts` is 4,073 lines, `frontend/src/services/ApiService.ts` is 3,208 lines)

**Parameters:**
- Destructured from `req.body` in route handlers:
  ```typescript
  const { username, email, password, role } = req.body;
  ```
- Options objects for middleware factories:
  ```typescript
  export function authenticate(options: AuthOptions = {}) {
  ```

**Return Values:**
- Backend services return result objects: `{ success: boolean, user?: User, error?: string, token?: string }`
- Express handlers return `res.status().json()` with early `return` to prevent fallthrough

## Module Design

**Exports:**
- Named exports preferred for services and utilities:
  ```typescript
  export const logger = { ... };
  export function authenticate(options: AuthOptions = {}) { ... }
  export function configureAuthRoutes(app: Express) { ... }
  ```
- Default exports for React components:
  ```typescript
  export default function Login() { ... }
  ```
- Named exports for React components also used:
  ```typescript
  export const CameraStream: React.FC<CameraStreamProps> = ({ ... }) => { ... }
  export function ProtectedRoute({ children, requiredRole }: ProtectedRouteProps) { ... }
  ```
- TypeORM entities use named exports:
  ```typescript
  export class User { ... }
  ```

**Barrel Files:**
- Models barrel: `server/src/models/index.ts`
- No component barrel files in frontend — imports are direct

**Route Registration:**
- Routes use a configuration function pattern rather than Express Router:
  ```typescript
  export function configureAuthRoutes(app: Express) {
    app.post('/api/auth/register', authenticate({ roles: ['admin'] }), ...);
    app.post('/api/auth/login', ...);
  }
  ```
- Some routes use Express Router with default export:
  ```typescript
  // server/src/routes/storageRoutes.ts
  export default storageRoutes; // Express Router
  ```

## React Patterns

**Component Types:**
- Functional components with hooks (standard)
- One class component: `ErrorBoundary` (required for error boundaries)

**State Management:**
- `useReducer` for complex state (AuthContext)
- `useState` for simple component state
- React Query (`@tanstack/react-query`) for server state
- Context API for global state (Auth, Socket, Camera)

**Component Props:**
- Explicit interface for props:
  ```typescript
  interface CameraStreamProps {
    camera: Camera;
    autoStart?: boolean;
  }
  export const CameraStream: React.FC<CameraStreamProps> = ({ camera, autoStart = true }) => {
  ```

**Styling:**
- TailwindCSS utility classes throughout
- `cn()` utility from `@/lib/utils.ts` for conditional classes (uses `clsx` + `tailwind-merge`)
- shadcn/ui components in `frontend/src/components/ui/`

## Python Conventions (OpenCV Service)

**File:** `opencv-service/app.py`
- Flask application
- snake_case for functions and variables
- PascalCase for classes (e.g., `DetectionCache`)
- Type hints using `typing` module: `Optional`, `List`, `Dict`, `Any`
- Environment variables via `os.getenv()` with defaults

---

*Convention analysis: 2026-05-15*
