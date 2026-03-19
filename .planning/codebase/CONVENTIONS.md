# Code Conventions

## TypeScript Conventions

### Strict Mode
- **Enabled project-wide**: `strict: true` in all tsconfig.json files
- **No implicit any**: All variables must have explicit types or be inferred
- **Strict null checks**: Null and undefined must be explicitly handled
- **Strict bind/call/apply**: Function context checking enforced

### File Organization
- **Extensions**: 
  - `.tsx` for React components with JSX
  - `.ts` for TypeScript files without JSX
  - `.js` only for configuration files
- **Naming**:
  - Components: PascalCase (e.g., `CameraGrid.tsx`)
  - Files and directories: camelCase (e.g., `apiService.ts`)
  - Constants: UPPER_SNAKE_CASE (e.g., `MAX_DETECTION_INTERVAL`)
  - Interface names: Prefix with `I` (e.g., `ICameraConfig`) - though this appears inconsistent
  - Type aliases: PascalCase (e.g., `DetectionResult`)

### Import Order
1. **External libraries** (from node_modules)
   ```typescript
   import express from 'express';
   import { z } from 'zod';
   ```
2. **Internal absolute imports** (using @ alias)
   ```typescript
   import { ApiService } from '@/services/ApiService';
   import { useAuth } from '@/hooks/useAuth';
   ```
3. **Internal relative imports**
   ```typescript
   import { validateRequest } from '../middleware/validation';
   import type { Event } from '../models/Event';
   ```
4. **Type-only imports** (when only importing types)
   ```typescript
   import type { CameraConfig } from '../config/index';
   ```

### Formatting
- **Semicolons**: Required
- **Quotes**: Single quotes for strings (`'hello'`), double quotes only in JSX attributes
- **Indentation**: 2 spaces
- **Line length**: No strict limit, but prefer readability
- **Function spacing**: Empty line between function declarations
- **Object spacing**: Spaces inside braces (`{ prop: value }`)
- **Array spacing**: No spaces in brackets (`[item1, item2]`)

### Naming Conventions
#### Variables and Functions
- **camelCase** for variables, functions, and method names
- **Descriptive names**: Prefer clarity over brevity
- **Boolean variables**: Prefix with `is`, `has`, `should`, `can` (e.g., `isLoading`, `hasAccess`)
- **Function names**: Verb-first (e.g., `calculateTotal`, `validateInput`, `processEvent`)

#### Constants
- **UPPER_SNAKE_CASE** for module-level constants
- **Enums**: PascalCase for enum name, UPPER_SNAKE_CASE for values
- **Configuration keys**: UPPER_SNAKE_CASE

#### Classes and Interfaces
- **PascalCase** for class and interface names
- **Interfaces**: May optionally prefix with `I` (inconsistent in codebase)
- **Methods**: camelCase within classes

#### React Components
- **PascalCase** for component names
- **Props**: camelCase
- **Event handlers**: Prefix with `handle` or `on` (e.g., `handleClick`, `onSubmit`)
- **State variables**: Use `useState` hooks with descriptive names

### React-Specific Conventions
#### Component Structure
1. **Imports** (external, internal, types)
2. **Component definition**
3. **Hooks** (useState, useEffect, custom hooks)
4. **Event handlers**
5. **Render return statement**

#### Hooks Usage
- **Custom hooks**: Prefix with `use` (e.g., `useAuth`, `useCameraStream`)
- **Built-in hooks**: Follow React rules of hooks
- **Dependency arrays**: Exhaustive deps for useEffect/useCallback

#### JSX
- **Self-closing tags**: For elements without children (`<img src={src} />`)
- **Multiline JSX**: Wrap in parentheses
- **Conditional rendering**: Prefer ternary operators or logical AND
- **List keys**: Stable, predictable IDs (not array indices when order matters)

### Error Handling
#### Synchronous Code
- **Try/catch**: For synchronous operations that may throw
- **Custom errors**: Extend Error class for domain-specific errors
- **Error boundaries**: React components for UI error isolation

#### Asynchronous Code
- **Try/catch**: Around await expressions
- **Promise rejection**: `.catch()` for unhandled rejections
- **Service layer**: Consistent error formatting and logging
- **Controller level**: Convert to appropriate HTTP responses

#### Logging
- **Logger service**: Use centralized logger (`logger.ts`)
- **Levels**: 
  - `error`: Unexpected failures requiring attention
  - `warn`: Potential issues or deprecated usage
  - `info`: Important operational events
  - `debug`: Detailed troubleshooting information
- **Context**: Include relevant IDs, timestamps, and metadata

### Security Conventions
#### Authentication
- **JWT handling**: Never store tokens in localStorage; use HttpOnly cookies
- **Password validation**: Server-side validation regardless of client checks
- **Route protection**: Middleware-based authentication checking
- **Session management**: Server-side session tracking with Redis

#### Input Validation
- **Zod schemas**: Validate all incoming data (query, params, body)
- **Schema location**: Near route definitions or in validation middleware
- **Sanitization**: Input sanitization middleware for XSS prevention
- **Type coercion**: Explicit conversion with validation

#### Data Protection
- **PII handling**: Minimize collection and retention
- **Encryption**: Sensitive data at rest and in transit
- **Access logs**: Audit trail for sensitive operations
- **Principle of least privilege**: Database and service accounts

## Backend-Specific Conventions

### Express Route Organization
#### Route Files
- **Size consideration**: Split large route files (like index.ts) by concern
- **HTTP verbs**: Use approprixate methods (GET for retrieval, POST for creation, etc.)
- **Path parameters**: Prefixed with colon (`:cameraId`)
- **Query parameters**: For filtering, pagination, sorting
- **Status codes**: Semantic use of HTTP status codes

#### Controller Pattern
- **Thin controllers**: Delegate business logic to services
- **Input validation**: At controller entrance using Zod
- **Response formatting**: Consistent success/error response structure
- **Async handling**: Try/catch with error forwarding to error middleware

### Service Layer
#### Dependency Injection
- **Constructor injection**: Services receive dependencies via parameters
- **No service locator pattern**: Explicit dependencies preferred
- **Circular dependency avoidance**: Through careful design and interfaces

#### Business Logic
- **Single responsibility**: Each service handles one domain concern
- **Transaction boundaries**: Services manage database transactions when needed
- **External service wrapping**: Abstraction for third-party APIs
- **Testing facilitation**: Interfaces or clear contracts for mocking

### Database/TypeORM Conventions
#### Entity Design
- **Decorators**: Use @Entity, @Column, @PrimaryColumn, etc.
- **Relationships**: Explicit @OneToMany, @ManyToOne, etc. with proper inverses
- **Naming**: Match database column names unless explicitly specified
- **Indexes**: Explicit @Index decorator for performance

#### Migrations
- **SQL files**: Plain SQL in database/migrations/ directory
- **Naming convention**: Numeric prefix for ordering (001_, 002_, etc.)
- **Idempotency**: Design migrations to be safely reapplicable
- **Data preservation**: Careful with destructive operations

#### Repository Usage
- **Encapsulation**: Services use repositories rather than direct EntityManager
- **Custom methods**: Repository extensions for complex queries
- **Transaction management**: Use QueryRunner for complex transactions

## Frontend-Specific Conventions

### State Management
#### React Query
- **Query keys**: Arrays for hierarchical invalidation (`['events', cameraId]`)
- **Stale time**: Configure based on data volatility
- **Cache time**: Longer stale time for less frequently changing data
- **Background updates**: Refetching on window focus/reconnect

#### Context API
- **Limited use**: Primarily for global state like auth, theme, settings
- **Performance**: Split contexts to prevent unnecessary re-renders
- **Default values**: Provide meaningful defaults for consumers

### Component Patterns
#### Presentation vs Container
- **Separation of concerns**: Presentational components focus on UI
- **Container components**: Handle data fetching and state management
- **Reusability**: Presentational components are highly reusable

#### Styling
- **TailwindCSS**: Utility-first approach
- **Component extraction**: When utility classes become repetitive
- **Variants**: Use `twMerge` and `clsx` for conditional classes
- **Dark mode**: `dark:` prefix for dark variant styling

#### Forms
- **React Hook Form**: With Zod validation via resolver
- **Field validation**: Per-field and form-level validation
- **Error display**: Field-specific and general form errors
- **Loading states**: Submission and validation loading indicators

## Development Process Conventions

### Branching Strategy
- **Main branch**: Production-ready code
- **Feature branches**: Short-lived branches for features/fixes
- **Pull required**: All changes via pull request with review
- **Naming**: `feature/`, `bugfix/`, `refactor/`, `docs/` prefixes

### Commit Messages
- **Conventional Commits**: type(scope): description format
- **Types**: feat, fix, docs, style, refactor, perf, test, chore
- **Scopes**: Optional module or component name
- **Description**: Imperative mood ("add" not "added" or "adding")

### Code Review
- **Checklist**:
  - [ ] Functionality matches requirements
  - [ ] Follows established conventions
  - [ ] Includes appropriate tests
  - [ ] No console.log or debugger statements
  - [ ] Proper error handling
  - [ ] Performance considerations addressed
  - [ ] Security implications considered

### Documentation
- **JSDoc**: For public APIs and complex functions
- **Inline comments**: For non-obvious logic or important notes
- **README updates**: When adding/removing features or changing setup
- **API documentation**: Keep in sync with implementation

## Legacy and Migration Considerations

### Areas for Improvement
1. **Inconsistent interface naming**: Mixed usage of I prefix
2. **Large route files**: index.ts is very large and could be split
3. **Error handling patterns**: Some inconsistency in error propagation
4. **Configuration management**: Multiple sources (environment, JSON files, hardcoded)
5. **Service coupling**: Direct HTTP calls to OpenCV service rather than abstraction

### Established Patterns to Maintain
1. **TypeScript strictness**: Continue enforcing type safety
2. **Modular service architecture**: Keep separating concerns
3. **Validation-first approach**: Validate inputs at boundaries
4. **Security-conscious defaults**: Secure by default implementation
5. **Testability**: Design for testability with dependency injection