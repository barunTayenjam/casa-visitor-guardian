# Coding Conventions

**Last updated:** 2026-07-16
**Focus:** Code style and conventions analysis

## Language Conventions

- **Dialect/version:** TypeScript 5.5+ with ES2020 target (frontend) / ES2022 target (server). Both root and server packages use `"type": "module"` and ESM throughout.
- **Formatting:** No Prettier config detected. No automatic formatting tool enforced. Code formatting is inconsistent — some files use 2-space, others tab indentation.
- **Linting:** ESLint 9 flat config (`eslint.config.js`) at root level, applied only to frontend. Uses `@eslint/js` recommended, `typescript-eslint` recommended, `eslint-plugin-react-hooks` recommended. Key rules: `@typescript-eslint/no-unused-vars` is **off**, `react-refresh/only-export-components` is **off**.
- **Backend linting:** Not configured. Server has its own `tsconfig.json` but no ESLint config.

## Naming Conventions

| Category | Convention | Example |
|----------|------------|---------|
| Variables | camelCase | `isLoading`, `authToken`, `selectedEventId` |
| Functions | camelCase | `getAuthToken()`, `handleAnalyzeEvent()` |
| React Components | PascalCase with default export | `EventsPage`, `ErrorBoundary`, `SmartFilters` |
| Classes | PascalCase | `ApiError`, `SocketService`, `Logger` |
| React Hooks | camelCase with `use` prefix | `useAuth`, `useToast`, `useScrollReveal` |
| React Contexts | PascalCase with `Context` suffix | `AuthContext`, `SocketContext` |
| Types/Interfaces | PascalCase | `MotionEvent`, `CameraConfig`, `AuthState` |
| Enums | PascalCase (const objects with UPPER keys used) | `actionTypes = { ADD_TOAST: "ADD_TOAST" }` |
| Files (components) | PascalCase.tsx | `CameraGrid.tsx`, `EventTimeline.tsx` |
| Files (utils/services) | camelCase.ts | `baseClient.ts`, `eventService.ts`, `utils.ts` |
| Files (pages) | PascalCase.tsx | `EventsPage.tsx`, `StreamDashboard.tsx` |
| Directories | camelCase under src/ | `services/api/`, `components/ui/` |

## Code Patterns

### Pattern 1: API Service Object Literal
- **Used for:** All HTTP client communication modules
- **Example location:** `frontend/src/services/api/authService.ts`, `frontend/src/services/api/eventService.ts`
- **Code example:**
```typescript
// Services are plain objects with async methods, not classes
import { fetchWithRetry, ApiError, API_URL } from './baseClient';

export const authService = {
  async login(username: string, password: string) {
    const response = await fetchWithRetry(`${API_URL}/auth/login`, {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
    return response.json();
  },

  async getProfile() {
    const response = await fetchWithRetry(`${API_URL}/auth/profile`);
    return response.json();
  },
};
```

### Pattern 2: Context + useReducer for State Management
- **Used for:** Global application state (auth, camera, socket)
- **Example location:** `frontend/src/contexts/AuthContext.tsx`, `frontend/src/contexts/CameraContext.tsx`
- **Code example:**
```typescript
// AuthContext.tsx pattern
type AuthAction =
  | { type: 'AUTH_START' }
  | { type: 'AUTH_SUCCESS'; payload: { user: User; token: string } }
  | { type: 'AUTH_FAILURE'; payload: string };

function authReducer(state: AuthState, action: AuthAction): AuthState {
  switch (action.type) {
    case 'AUTH_START': return { ...state, isLoading: true, error: null };
    case 'AUTH_SUCCESS': return { ...state, user: action.payload.user, isAuthenticated: true, isLoading: false };
    case 'AUTH_FAILURE': return { ...state, user: null, isAuthenticated: false, isLoading: false, error: action.payload };
    default: return state;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(authReducer, initialState);
  // ...methods using dispatch
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
```

### Pattern 3: Controller (MVC) with BaseController
- **Used for:** Backend route handlers
- **Example location:** `server/src/controllers/CameraController.ts`, `server/src/controllers/BaseController.ts`
- **Code example:**
```typescript
// BaseController provides standardized response helpers
export class BaseController {
  protected ok(res: Response, data: Record<string, unknown>): void {
    res.json({ success: true, ...data });
  }
  protected created(res: Response, data: Record<string, unknown>): void {
    res.status(201).json({ success: true, ...data });
  }
  protected badRequest(res: Response, error: string): void {
    res.status(400).json({ success: false, error });
  }
  protected notFound(res: Response, error: string = 'Not found'): void {
    res.status(404).json({ success: false, error });
  }
}

// Controllers extend BaseController
export class CameraController extends BaseController {
  listAll(req: Request, res: Response): void {
    try {
      // ... logic
      this.ok(res, { cameras: optimizedCameras });
    } catch (error) {
      this.serverError(res, error, 'listAll');
    }
  }
}
```

### Pattern 4: Custom Error Class Hierarchy
- **Used for:** Structured error handling across API boundary
- **Example location:** `frontend/src/services/api/baseClient.ts`, `server/src/middleware/validation.ts`
- **Code example:**
```typescript
// Frontend error classes
export class ApiError extends Error {
  constructor(
    message: string,
    public status?: number,
    public code?: string,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export class NetworkError extends ApiError { /* ... */ }
export class TimeoutError extends ApiError { /* ... */ }

// Server validation error
export class ValidationError extends Error {
  constructor(public field: string, public message: string) {
    super(`Validation failed for ${field}: ${message}`);
    this.name = 'ValidationError';
  }
}
```

### Pattern 5: Service Registry for DI
- **Used for:** Backend service dependency injection
- **Example location:** `server/src/services/serviceRegistry.ts`
- **Code example:**
```typescript
// Servicies retrieved by name from a registry
const streamManager = serviceRegistry.getStreamManager();
const dataSource = serviceRegistry.getAppDataSource();
```

### Pattern 6: Route Modularization
- **Used for:** Backend route definitions
- **Example location:** `server/src/routes/index.ts`
- **Code example:**
```typescript
// Routes are mounted under domain prefixes
app.use('/api/auth', authRoutes);
app.use('/api/cameras', cameraRoutes);
app.use('/api/streams', streamRoutes);
```

### Pattern 7: API Response Shape
- **Used for:** Consistent API response protocol
- **Example location:** Throughout all controllers
- **Code example:**
```typescript
// Success
{ success: true, ...data }

// Error
{ success: false, error: 'message', details?: [...] }
```

### Pattern 8: Async Error Handling with Service Error Boundaries
- **Used for:** Safe API calls that return graceful fallback values
- **Example location:** `frontend/src/services/api/eventService.ts`
- **Code example:**
```typescript
async getDailyStats(): Promise<number> {
  try {
    const response = await fetchWithRetry(`${API_URL}/events/stats/today`);
    const data = await response.json();
    if (!data.success) {
      throw new ApiError(data.error || 'Failed', response.status, 'ERROR', data);
    }
    return data.count;
  } catch (error) {
    console.error('Error fetching daily stats:', error);
    return 0; // Graceful fallback — prevents UI crash
  }
}
```

## Error Handling

- **Strategy:** Hybrid — use custom error classes (`ApiError`, `NetworkError`, `TimeoutError`) on frontend, then fall back to safe defaults to prevent UI crashing. Backend uses try/catch in every controller with standardized JSON responses.
- **Custom errors:** `ApiError`, `NetworkError`, `TimeoutError` (frontend); `ValidationError` (server middleware).
- **Graceful degradation:** Frontend services return fallback values (`0`, `[]`, `{}`) on API failure, logging the error to console. `catch` blocks in controllers produce `{ success: false, error: '...' }` responses without crashing.
- **Async error propagation:** Frontend follows a consistent pattern: `if (error instanceof ApiError) throw error;` → throw generic `ApiError` wrapping the original.
- **Global error handling:** React `ErrorBoundary` component at `frontend/src/components/ErrorBoundary.tsx` with optional custom fallback. `unhandledrejection` and `error` window events logged by `main.tsx` and `frontend/src/lib/logger.ts`.
- **Server:** `unhandledRejection` process handler logs but does not exit. `EADDRINUSE` detected on startup.

## Imports Organization

**Frontend order (observed):**
1. React/core imports (`import React, { useState } from 'react'`)
2. Third-party library imports (`react-router-dom`, `lucide-react`, `date-fns`)
3. Internal absolute imports (`@/hooks/...`, `@/components/...`, `@/services/...`)
4. Relative imports (`./baseClient`)

**Server order (observed):**
1. Built-in modules (`express`, `path`, `fs`)
2. Third-party libraries (`cors`, `helmet`, `socket.io`)
3. Internal relative imports (`../utils/logger.js`, `../services/serviceRegistry.js`)

**Path Aliases:**
- Frontend: `@/` maps to `./src/` via Vite `resolve.alias`
- Server: No path aliases — uses relative imports with `.js` extensions for ESM

**Barrel files:** Minimal use. `server/src/models/index.ts` re-exports all models. No barrel files in frontend.

## Comments & Documentation

- **Doc style:** Sparse. Leading file-level comments on some files (`// Shared HTTP client infrastructure...`). No JSDoc/TSDoc used anywhere. No `@param` or `@returns` annotations.
- **Required docs:** AGENTS.md (project overview) and CLAUDE.md (project orientation) at root level. No README-style docstrings in code.
- **TODO format:** Only one `TODO` across the entire codebase — in `server/src/utils/logger.ts` line 110: `// TODO: Migrate to PostgreSQL audit_logs - logDatabase disabled`.

## State Management

- **Pattern:** React Context + `useReducer` for global state (Auth, Camera, Socket). `@tanstack/react-query` for server state (configured in `frontend/src/App.tsx`).
- **State locations:**
  - Auth state: `frontend/src/contexts/AuthContext.tsx` — `useReducer` with dispatch actions
  - Camera state: `frontend/src/contexts/CameraContext.tsx`
  - Socket connection: `frontend/src/contexts/SocketContext.tsx`
  - Server cache: `@tanstack/react-query` `QueryClient` instance
  - Local component state: `useState` / `useMemo` / `useCallback` throughout pages
- **Mutability rules:** Reducers use immutable update patterns. Components use `useState` with setter functions — no direct mutation.
- **Persistence:** Auth token stored in `localStorage` via `baseClient.ts`. Logger stores last 100 entries in `localStorage`.

## UI Component Patterns

- **Pattern:** shadcn/ui with Radix primitives, TailwindCSS, `cn()` utility for conditional classes (`clsx` + `tailwind-merge`)
- **Lazy loading:** All page components loaded via `React.lazy()` with `<Suspense>` in `App.tsx`
- **Animation:** Custom keyframes in tailwind config (`fade-in-up`, `slide-up-reveal`, `scale-in`, `glow-pulse`). Spring-like cubic-bezier curves: `cubic-bezier(0.32, 0.72, 0, 1)` used throughout.

---

*Convention analysis: 2026-07-16*
