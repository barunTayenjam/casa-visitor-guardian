# Coding Conventions

**Analysis Date:** 2026-08-13

## Naming Patterns

**Files:**
- Frontend components/pages: `PascalCase.tsx` (e.g., `Login.tsx`, `CameraStream.tsx`)
- Frontend hooks: `useCamelCase.ts` (e.g., `use-toast.ts`)
- Frontend utilities/services: `camelCase.ts` (e.g., `utils.ts`, `SocketService.ts`)
- Server files: `camelCase.ts` (e.g., `index.ts`, `auth.ts`, `database.ts`)
- Test files: `*.test.ts` or `*.test.tsx` (e.g., `baseClient.test.ts`, `AuthController.test.ts`)

**Functions:**
- `camelCase` for most functions (e.g., `login`, `hashPassword`, `generateTokenPair`).
- React components use `PascalCase` (e.g., `App`, `CameraStream`).

**Variables:**
- `camelCase` for local variables and properties.
- `PascalCase` for type names (interfaces, types).
- Constants in global scope or module scope may use `SCREAMING_SNAKE_CASE` (not explicitly observed but common).

**Types:**
- `PascalCase` for interfaces and type aliases (e.g., `ApiError`, `Config`, `User`).

## Code Style

**Formatting:**
- Controlled by ESLint. No explicit Prettier config found, ESLint likely handles formatting rules.
- Indentation: 2 spaces (inferred from `eslint.config.js` and common TypeScript practices).

**Linting:**
- **Tool used:** ESLint with `typescript-eslint` plugin.
- **Config:** `/home/barun/Documents/sentryvision/frontend/eslint.config.js`
- **Key rules:**
    - `js.configs.recommended`: Standard ESLint recommended rules.
    - `tseslint.configs.recommended`: TypeScript ESLint recommended rules.
    - `react-hooks/recommended`: Rules for React Hooks.
    - `react-refresh/only-export-components`: `off` (allows non-default exports in files with components).
    - `@typescript-eslint/no-unused-vars`: `off` (allows unused variables).

## Import Organization

**Order:**
Not strictly enforced by configuration. Common patterns observed:
1. Third-party library imports.
2. Project-internal imports, often grouped by module.

**Path Aliases:**
- `@/*`: Maps to `./src/*` in both frontend and server `tsconfig.json`.
  - Example: `import { cn } from "@/lib/utils"`

## Error Handling

**Patterns:**
- Custom error classes: `ApiError`, `NetworkError`, `TimeoutError` in frontend (`src/__tests__/baseClient.test.ts`) for structured API error handling.
- Service methods often return objects with `success` boolean and `errors` array or `error` string for consistent error reporting from business logic (e.g., `AuthenticationService.register` returns `{ success: boolean, errors?: string[] }`).
- `try...catch` blocks for asynchronous operations and external calls.

## Logging

**Framework:**
- Frontend: `console` directly or a wrapper `src/lib/logger.ts`. Mocks exist for testing (`src/__mocks__/lib/logger.ts`).
- Server: Not explicitly configured in initial scan, likely direct `console` or a simple wrapper.

**Patterns:**
- Basic `console.log`, `console.error`, `console.warn` for development and debugging.
- No sophisticated logging framework like Winston or Pino detected.

## Comments

**When to Comment:**
- Not strictly enforced. Code is generally self-documenting.
- Explanations for complex logic or non-obvious choices.

**JSDoc/TSDoc:**
- Minimal usage observed. Type definitions are often inline or in interfaces.

## Function Design

**Size:**
- Functions generally focused on a single responsibility. No explicit size limits configured.

**Parameters:**
- Clearly typed parameters using TypeScript.
- Object destructuring common for multiple parameters.

**Return Values:**
- Clearly typed return values.
- Objects with `success` and `data`/`errors` properties are common for service layer operations.

## Module Design

**Exports:**
- Default exports for components and pages.
- Named exports for utilities, hooks, and multiple related items from a single module.

**Barrel Files:**
- Not extensively used. Modules tend to export directly from their definition files.

---

*Convention analysis: 2026-08-13*