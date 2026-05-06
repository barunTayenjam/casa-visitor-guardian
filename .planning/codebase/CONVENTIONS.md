# Coding Conventions

**Analysis Date:** 2026-05-05

## Naming Patterns

**Files:**
- React components: PascalCase (e.g., `CameraGrid.tsx`, `Login.tsx`)
- Utilities and services: camelCase (e.g., `utils.ts`, `authenticationService.ts`)
- Test files: `.test.ts` or `.spec.ts` suffix (e.g., `auth.test.ts`)
- Configuration: camelCase with descriptive names (e.g., `cameras.json`)

**Functions:**
- React hooks: camelCase with `use` prefix (e.g., `useAuth`, `useCamera`)
- General functions: camelCase (e.g., `formatDate`, `handleLogin`)
- Service methods: camelCase (e.g., `getReviewSegments`, `authenticateUser`)
- Event handlers: `handle` prefix (e.g., `handleLoginSubmit`, `handleChange`)

**Variables:**
- camelCase for local variables (e.g., `loginData`, `validationErrors`)
- PascalCase for React component references (e.g., `Comp`, `Button`)
- UPPER_SNAKE_CASE for constants (e.g., `DEFAULT_TIMEOUT`)

**Types:**
- Interfaces: PascalCase with descriptive suffix (e.g., `ButtonProps`, `AuthResponse`)
- Types: PascalCase (e.g., `VariantProps`)
- Enums: PascalCase with UPPER_SNAKE_CASE members (e.g., `EventType.MOTION`)

## Code Style

**Formatting:**
- Tool: Prettier (integrated via ESLint)
- Key settings: 2-space indent, single quotes, trailing commas
- Line length: Soft wrap at editor width
- Semicolons: Required

**Linting:**
- Frontend: ESLint 9.x with React plugins
- Backend: ESLint 9.x with TypeScript support
- Rules enforced: `react-hooks/rules-of-hooks`, `react-refresh/only-export-components`
- Commands: `npm run lint`, `npm run lint:fix`

**TypeScript:**
- Strict mode: **Disabled** in both frontend and backend (`"strict": false`)
- The codebase uses loose TypeScript settings:
  - `noImplicitAny`: false
  - `noUnusedLocals`: false
  - `noUnusedParameters`: false
- This is a known area for improvement

## Import Organization

**Order (top to bottom):**
1. External libraries (React, Radix UI, etc.)
2. Internal imports using path alias `@/` (e.g., `@/components/ui/button`)
3. Relative imports (e.g., `../services/authService`)
4. Type imports (segregated with `import type`)

**Path Aliases:**
- Frontend: `@/*` maps to `./src/*`
- Backend: Relative imports (no path aliases configured)

**Example:**
```typescript
import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import type { User } from '@/types';
import { formatDate } from '../utils/dateUtils';
```

## Error Handling

**Frontend Patterns:**
- Try-catch with async/await for API calls
- Error state managed via React Context (e.g., `AuthContext`)
- User-friendly error messages displayed via Alert components
- Error boundary components for React component trees

**Example (Login.tsx):**
```typescript
try {
  await login(loginData.username, loginData.password);
} catch (error) {
  // Error is handled by the auth context
}
```

**Backend Patterns:**
- Try-catch blocks in route handlers
- Zod schema validation for request bodies
- Error responses with structured JSON: `{ success: false, error: string }`
- Centralized error logging via logger utility

**Example (authenticationService.ts):**
```typescript
export const LoginRequestSchema = z.object({
  identifier: z.string().min(1),
  password: z.string().min(1),
  rememberMe: z.boolean().optional(),
});
```

## Logging

**Framework:** Custom logger utility (`/server/src/utils/logger.ts`)

**Pattern:**
- Timestamp included in log format
- Context passed as second parameter
- Stack traces captured for errors

**Frontend:** Console methods (`console.error`, `console.warn`)

**Example (frontend/src/lib/utils.ts):**
```typescript
export function logError(error: unknown, context?: string): void {
  const timestamp = new Date().toISOString();
  const message = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error ? error.stack : undefined;
  console.error(`[${timestamp}] ${context ? `${context}: ` : ''}${message}`, stack || '');
}
```

## Comments

**When to Comment:**
- Complex business logic
- Workarounds and known issues
- Configuration that requires explanation
- Public API interfaces

**JSDoc/TSDoc:**
- Used for utility functions (e.g., `formatDate`, `formatRelativeTime`)
- Interfaces documented with descriptive comments

**Avoid:**
- Obvious code that is self-explanatory
- Commented-out code (remove instead)

## Function Design

**Parameters:**
- Limit to 3-4 parameters maximum
- Use objects for many parameters
- Optional parameters marked with `?`

**Return Values:**
- Always specify return type for exported functions
- Promise return types for async functions

**Size:**
- Keep functions under 50 lines when possible
- Extract complex logic into helper functions

**Example:**
```typescript
export function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  
  if (diffInSeconds < 60) {
    return 'just now';
  }
  // ... additional logic
}
```

## React Component Patterns

**Functional Components:**
- Use React functional components exclusively
- Destructure props in component definition
- Use TypeScript interfaces for props

**Example:**
```typescript
export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";
```

**Component Structure:**
1. Imports
2. Type definitions
3. Component definition
4. Export statement

**Context Usage:**
- Wrap components with Context providers
- Custom hooks for context access (e.g., `useAuth`, `useCamera`)

## Module Design

**Exports:**
- Named exports for utilities and components
- Default exports for page components
- Re-export from barrel files (e.g., `index.ts`)

**Barrel Files:**
- Used for organizing related exports (e.g., `models/index.ts`)
- Reduces import paths

---

*Convention analysis: 2026-05-05*