# SentryVision Code Conventions

## Overview

SentryVision follows modern TypeScript/JavaScript conventions with React on the frontend and Express on the backend. The codebase prioritizes type safety, modularity, and maintainability while remaining pragmatic.

## General Principles

- **Type safety first:** TypeScript for both frontend and backend
- **Explicit over implicit:** Clear naming, explicit types where useful
- **Composition over inheritance:** Prefer composition patterns
- **Separation of concerns:** Clear boundaries between layers
- **DRY (Don't Repeat Yourself):** Extract common logic
- **Pragmatic over dogmatic:** Practical solutions over strict patterns

## Code Style

### Frontend (React + TypeScript)

**Component Structure:**
```typescript
// Imports: External libraries first, then internal
import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import type { User } from '@/types/security';

// Interface definitions
interface MyComponentProps {
  title: string;
  onAction: () => void;
}

// Component function
export function MyComponent({ title, onAction }: MyComponentProps) {
  // Hooks first
  const [state, setState] = useState(initialValue);
  const { user } = useAuth();

  // Effects
  useEffect(() => {
    // Effect logic
  }, [dependencies]);

  // Event handlers
  const handleClick = () => {
    onAction();
  };

  // Render
  return (
    <div className="container">
      <h1>{title}</h1>
      <Button onClick={handleClick}>Action</Button>
    </div>
  );
}
```

**Naming Conventions:**
- **Components:** PascalCase (`CameraGrid.tsx`, `EventCard.tsx`)
- **Hooks:** camelCase with 'use' prefix (`useAuth.ts`, `useCamera.ts`)
- **Utilities:** camelCase (`formatDate`, `cn`)
- **Types/Interfaces:** PascalCase (`User`, `CameraConfig`)
- **Constants:** UPPER_SNAKE_CASE (`MAX_RETRIES`, `DEFAULT_TIMEOUT`)
- **File names:** Match export (PascalCase for components, camelCase for utilities)

**Component Patterns:**
- Functional components with hooks (no class components)
- Props interfaces defined before component
- Hooks ordered: useState → useEffect → custom hooks
- Event handlers prefixed with 'handle' (`handleClick`, `handleSubmit`)
- Boolean props: `isOpen`, `isLoading`, `hasPermission`
- Render props sparingly (prefer composition)

**State Management:**
- **Local state:** useState for component-specific state
- **Global state:** React Context for auth, camera, socket
- **Server state:** React Query for API data (caching, revalidation)
- **Form state:** React Hook Form for forms

**Styling Conventions:**
- TailwindCSS utility classes
- `cn()` helper for conditional classes
- Responsive: mobile-first approach
- Dark mode: via `next-themes` provider
- Consistent spacing (4px grid: `p-4`, `gap-2`, `m-8`)

### Backend (Node.js + Express + TypeScript)

**Route Handler Structure:**
```typescript
// Imports
import express from 'express';
import { z } from 'zod';
import { AppDataSource } from '../database.js';
import { User } from '../models/User.js';

// Validation schema
const createUserSchema = z.object({
  username: z.string().min(3).max(50),
  email: z.string().email(),
  password: z.string().min(8)
});

// Router
const router = express.Router();

// Middleware
router.use(authenticate);
router.use(rateLimiter);

// GET endpoint
router.get('/', async (req, res) => {
  try {
    const users = await AppDataSource.getRepository(User).find();
    res.json({ success: true, data: users });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST endpoint with validation
router.post('/', async (req, res) => {
  try {
    const validatedData = createUserSchema.parse(req.body);
    const user = await createUserService(validatedData);
    res.status(201).json({ success: true, data: user });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, errors: error.errors });
    }
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
```

**Naming Conventions:**
- **Routes:** camelCase with 'Routes' suffix (`authRoutes`, `visitorRoutes`)
- **Services:** camelCase with 'Service' suffix (`detectionService`, `notificationService`)
- **Models:** PascalCase (`User`, `Event`, `Visitor`)
- **Middleware:** camelCase (`authenticate`, `validateRequest`)
- **Utilities:** camelCase (`logger`, `fileHelper`)

**File Organization:**
- One export per file (default export)
- ES modules (type: "module" in package.json)
- Import with `.js` extension (TypeScript requirement)
- Barrel files: `index.ts` for exporting multiple items

**Function Conventions:**
- Async functions: use `async/await` (no callbacks)
- Error handling: try-catch with meaningful error messages
- Return types: explicit return types on exported functions
- Parameter validation: Zod schemas for API inputs

**Service Pattern:**
```typescript
export class DetectionService {
  private repository: Repository<Event>;

  constructor() {
    this.repository = AppDataSource.getRepository(Event);
  }

  async createEvent(data: CreateEventDto): Promise<Event> {
    try {
      const event = this.repository.create(data);
      return await this.repository.save(event);
    } catch (error) {
      this.logError(error, { context: 'createEvent' });
      throw new Error('Failed to create event');
    }
  }

  private logError(error: Error, context?: any): void {
    console.error(`[DetectionService] Error:`, {
      message: error.message,
      stack: error.stack,
      context
    });
  }
}

export const detectionService = new DetectionService();
```

**Database Access:**
- TypeORM repositories for data access
- Queries in services, not in routes
- Use transactions for multi-step operations
- Eager loading with `relations` option
- Parameterized queries (no SQL injection)

### OpenCV Service (Python + Flask)

**Conventions:**
- Snake_case for functions and variables (`detect_motion`, `get_frames`)
- PascalCase for classes (`FaceRecognizer`, `MotionDetector`)
- Type hints on all functions
- Docstrings for public functions
- Error handling with try-except

```python
def detect_motion(frame: np.ndarray, threshold: float = 0.002) -> Dict[str, Any]:
    """
    Detect motion in frame using MOG2 background subtraction.

    Args:
        frame: Input frame as numpy array
        threshold: Motion threshold (0-1)

    Returns:
        Dictionary with detection results
    """
    try:
        # Detection logic
        results = process_frame(frame, threshold)
        return {"success": True, "data": results}
    except Exception as e:
        logger.error(f"Motion detection failed: {str(e)}")
        return {"success": False, "error": str(e)}
```

## Import Conventions

### Import Order

**Frontend:**
```typescript
// 1. External libraries
import React from 'react';
import { useQuery } from '@tanstack/react-query';

// 2. Internal imports (absolute with @ alias)
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';

// 3. Type imports
import type { User } from '@/types/security';
```

**Backend:**
```typescript
// 1. Node.js built-ins
import path from 'node:path';
import fs from 'node:fs';

// 2. External packages
import express from 'express';
import { Repository } from 'typeorm';

// 3. Internal imports (relative)
import { User } from '../models/User.js';
import { logger } from '../utils/logger.js';
```

**Import Guidelines:**
- Use absolute imports with `@/` alias for frontend
- Use relative imports for backend (with `.js` extension)
- Group imports by type (external, internal, types)
- Sort imports alphabetically within groups
- No unused imports (ESLint rule)

## Error Handling

### Frontend Error Handling

**Component-Level:**
```typescript
try {
  await mutation.mutateAsync(data);
} catch (error) {
  console.error('Operation failed:', error);
  toast.error('Failed to complete operation');
}
```

**Global Error Boundary:**
```typescript
<ErrorBoundary fallback={<ErrorFallback />}>
  <App />
</ErrorBoundary>
```

**API Error Handling (React Query):**
```typescript
const query = useQuery({
  queryKey: ['events'],
  queryFn: fetchEvents,
  retry: 3,
  onError: (error) => {
    console.error('Failed to fetch events:', error);
  }
});
```

### Backend Error Handling

**Route Handlers:**
```typescript
router.post('/endpoint', async (req, res) => {
  try {
    // Business logic
    const result = await service.doSomething(req.body);
    res.json({ success: true, data: result });
  } catch (error) {
    // Log error
    logger.error('Operation failed', { error, context: req.body });

    // Return appropriate status
    if (error instanceof ValidationError) {
      return res.status(400).json({ success: false, error: error.message });
    }
    if (error instanceof AuthError) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    // Generic error
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});
```

**Service Layer:**
```typescript
async performOperation(data: any): Promise<Result> {
  try {
    // Validate
    if (!data.requiredField) {
      throw new ValidationError('requiredField is missing');
    }

    // Execute
    const result = await repository.save(data);
    return result;
  } catch (error) {
    this.logError(error, { context: 'performOperation', data });
    throw error; // Re-throw for route handler to catch
  }
}
```

**Custom Error Classes:**
```typescript
export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthError';
  }
}
```

### Error Logging

**Frontend:**
```typescript
// Utility function (from utils.ts)
export function logError(error: unknown, context?: string): void {
  const timestamp = new Date().toISOString();
  const message = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error ? error.stack : undefined;

  console.error(`[${timestamp}] ${context ? `${context}: ` : ''}${message}`, stack || '');
}
```

**Backend:**
```typescript
// BaseService pattern
protected logError(error: Error, context?: any): void {
  console.error(`[${this.serviceName}] Error:`, {
    message: error.message,
    stack: error.stack,
    context
  });
}
```

## Naming Patterns

### Boolean Variables
- Prefix with `is`, `has`, `should`, `can`
```typescript
const isActive = true;
const hasPermission = false;
const shouldRetry = true;
const canDelete = false;
```

### Functions
- Verb-first for actions
```typescript
// Good
function getUserById(id: string) { }
function createEvent(data: EventData) { }
function handleError(error: Error) { }

// Avoid
function user() { }
function data() { }
```

### Event Handlers
- Prefix with `handle` or `on`
```typescript
const handleClick = () => { };
const handleSubmit = (data: FormData) => { };
const onUserLogin = (user: User) => { };
```

### Constants
- UPPER_SNAKE_CASE
```typescript
const MAX_RETRY_ATTEMPTS = 3;
const DEFAULT_TIMEOUT = 30000;
const API_BASE_URL = 'https://api.example.com';
```

### Types/Interfaces
- PascalCase, descriptive names
```typescript
interface User { }
type UserRole = 'admin' | 'user' | 'viewer';
interface CameraConfig { }
type DetectionResult = SuccessResult | ErrorResult;
```

## Commenting Conventions

### JSDoc Comments
Use for exported functions and complex logic:
```typescript
/**
 * Detects motion in a video frame using background subtraction.
 *
 * @param frame - The video frame to analyze (Buffer or base64 string)
 * @param threshold - Motion detection threshold (0-100, default: 50)
 * @param options - Additional detection options
 * @returns Promise resolving to detection results with confidence score
 * @throws {Error} When frame format is invalid
 *
 * @example
 * ```typescript
 * const result = await detectMotion(frameBuffer, 60, { useGaussianBlur: true });
 * console.log(`Motion detected: ${result.hasMotion}, confidence: ${result.confidence}%`);
 * ```
 */
async function detectMotion(
  frame: Buffer | string,
  threshold: number = 50,
  options?: DetectionOptions
): Promise<DetectionResult> {
  // Implementation
}
```

### Inline Comments
- Use for "why", not "what"
- Keep comments up-to-date
- Avoid obvious comments

```typescript
// Good: Explains why
// Use Gaussian blur to reduce noise before thresholding
const blurred = cv2.GaussianBlur(frame, (5, 5), 0);

// Bad: States the obvious
// Increment counter
counter++;
```

### TODO Comments
Mark with TODO for future work:
```typescript
// TODO: Implement adaptive thresholding based on time of day
// FIXME: This is a workaround for https://github.com/issue/123
// HACK: Temporary fix until FFmpeg 6.0 is released
```

## File Organization

### Frontend Component File
```typescript
// 1. Imports
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import type { MyComponentProps } from './types';

// 2. Types/Interfaces
interface MyComponentProps {
  title: string;
}

// 3. Component
export function MyComponent({ title }: MyComponentProps) {
  // Hooks
  const [state, setState] = useState();

  // Handlers
  const handleClick = () => { };

  // Effects
  useEffect(() => { }, []);

  // Render
  return <div>{title}</div>;
}

// 4. Sub-components (if any)
function SubComponent() {
  return <span>Sub</span>;
}

// 5. Styles (if CSS-in-JS)
const styles = {
  container: 'p-4 bg-white rounded',
};
```

### Backend Service File
```typescript
// 1. Imports
import { Repository } from 'typeorm';
import { Event } from '../models/Event.js';

// 2. Types/Interfaces
interface CreateEventDto {
  cameraId: string;
  confidence: number;
}

// 3. Service class
export class EventService {
  private repository: Repository<Event>;

  constructor() {
    this.repository = AppDataSource.getRepository(Event);
  }

  // Public methods
  async create(data: CreateEventDto): Promise<Event> {
    // Implementation
  }

  // Private helpers
  private validate(data: any): boolean {
    // Implementation
  }
}

// 4. Export singleton
export const eventService = new EventService();
```

## Code Quality

### ESLint Rules
**Frontend (`.eslintrc`):**
- `react-hooks/rules-of-hooks` - Enforce hooks rules
- `@typescript-eslint/no-unused-vars` - No unused vars
- `react-refresh/only-export-components` - Fast refresh optimization

**Backend:**
- No strict ESLint config (relies on TypeScript compiler)

### TypeScript Configuration
**Frontend (`tsconfig.json`):**
- `strict: false` - Disabled for pragmatic development
- `target: ES2020`
- `module: ESNext`
- `jsx: react-jsx`

**Backend (`tsconfig.json`):**
- `strict: false` - Disabled for pragmatic development
- `target: ES2022`
- `module: nodenext`
- `moduleResolution: nodenext`

### Linting Commands
```bash
# Frontend
npm run lint           # Check linting
npm run lint:fix       # Auto-fix issues
npm run typecheck      # TypeScript type check

# Backend
npm run build          # TypeScript compilation
```

## Git Conventions

### Commit Messages
Follow conventional commits:
```
feat: add camera streaming feature
fix: resolve motion detection false positives
docs: update README with setup instructions
refactor: simplify event service
test: add auth endpoint tests
chore: upgrade dependencies
```

### Branch Naming
- `feature/` - New features
- `fix/` - Bug fixes
- `refactor/` - Code refactoring
- `docs/` - Documentation updates

## Security Conventions

### Sensitive Data
- **Never commit:** `.env` files, credentials, API keys
- **Use environment variables:** For all secrets
- **TypeORM:** Parameterized queries (no SQL injection)
- **Input validation:** Zod schemas on all API inputs
- **Password hashing:** bcrypt with salt rounds
- **JWT:** HttpOnly cookies, short-lived access tokens

### RTSP Credentials
- **File:** `server/cameras.json`
- **Format:** RTSP URLs with embedded credentials
- **Risk:** Exposed in file (local network only)
- **Recommendation:** Use separate credential management

## Performance Conventions

### Frontend
- **Code splitting:** React.lazy() for routes
- **Image optimization:** JPEG quality 80%, lazy loading
- **Debouncing:** User input events (search, filters)
- **Memoization:** useMemo, useCallback for expensive operations

### Backend
- **Connection pooling:** TypeORM manages DB connections
- **Caching:** Redis for frequently accessed data
- **Async operations:** Non-blocking I/O
- **Batch operations:** Bulk inserts/updates

### Database
- **Indexes:** On frequently queried columns
- **Pagination:** Limit result sets (avoid SELECT *)
- **Eager loading:** Use `relations` to avoid N+1 queries

## Testing Conventions

### Test Structure
```typescript
describe('Feature', () => {
  // Setup
  let mockService: any;

  beforeEach(() => {
    mockService = createMock();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Specific Behavior', () => {
    it('should do something when condition is met', async () => {
      // Arrange
      const input = { value: 'test' };

      // Act
      const result = await performAction(input);

      // Assert
      expect(result).toBeDefined();
      expect(result.value).toBe('test');
    });
  });
});
```

### Test Naming
- Should describe behavior: "should [do something] when [condition]"
- Use `it()` for individual tests
- Use `describe()` for grouping

## Documentation Conventions

### Code Comments
- Public APIs: JSDoc comments
- Complex logic: Explanation of algorithm/approach
- Workarounds: Mark with `HACK:` or `FIXME:`
- Future work: Mark with `TODO:`

### README Files
- Project root: Overview, setup, quick start
- Service directories: Purpose, usage examples
- Component directories: Component props, usage

## Anti-Patterns to Avoid

### Frontend
- ❌ Class components (use functional with hooks)
- ❌ Prop drilling (use React Context)
- ❌ Managing server state with useState (use React Query)
- ❌ Inline styles (use TailwindCSS classes)
- ❌ `any` type (use proper types or `unknown`)

### Backend
- ❌ Callback hell (use async/await)
- ❌ Business logic in routes (use services)
- ❌ Direct SQL queries (use TypeORM)
- ❌ Global state (use services/singletons)
- ❌ Blocking operations (use async/promises)

### General
- ❌ Hardcoded values (use constants/env vars)
- ❌ Magic numbers (use named constants)
- ❌ Deeply nested code (extract functions)
- ❌ Premature optimization (measure first)
- ❌ Copy-paste code (DRY principle)

## Best Practices Summary

**Do:**
- Use TypeScript types
- Write error handling (try-catch)
- Extract reusable logic
- Name variables descriptively
- Comment complex logic
- Use const by default, let when needed
- Keep functions small (< 50 lines)
- Use async/await for async code
- Validate inputs (Zod schemas)
- Log errors with context

**Don't:**
- Use `any` type loosely
- Ignore errors (silent failures)
- Repeat code (extract functions)
- Use vague names (data, stuff, temp)
- Comment obvious code
- Use var (use const/let)
- Write long functions (> 100 lines)
- Mix callbacks and promises
- Trust user input (always validate)
- Log without context
