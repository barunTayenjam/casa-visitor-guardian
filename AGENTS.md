# Home Security - Agent Guidelines

## Build Commands
- `npm run dev` - Start frontend dev server
- `npm run dev:server` - Start backend dev server  
- `npm run dev:full` - Start both frontend and backend
- `npm run build` - Build frontend for production
- `npm run build:server` - Build backend for production
- `npm run build:full` - Build both frontend and backend
- `npm run lint` - Run ESLint (ignores server/dist)
- `cd server && npm run test` - Run backend tests (currently no tests configured)

## Code Style Guidelines

### Imports & Formatting
- Use absolute imports with `@/` prefix for src files
- Group imports: React/external libs → internal components → types → utils
- Use TypeScript with relaxed config (noImplicitAny: false, strictNullChecks: false)

### Component Patterns
- Use functional components with hooks
- Export components with descriptive names (PascalCase)
- Use shadcn/ui components from `@/components/ui/`
- Follow existing component structure in src/components/

### Naming Conventions
- Components: PascalCase (CameraGrid, ErrorBoundary)
- Files: PascalCase for components, camelCase for utilities
- Variables/Functions: camelCase
- Constants: UPPER_SNAKE_CASE
- Types/Interfaces: PascalCase

### Error Handling
- Use custom ApiError, NetworkError, TimeoutError classes from ApiService
- Wrap async operations in try-catch blocks
- Log errors with context using console.error
- Return meaningful error messages to users

### Styling
- Use Tailwind CSS with custom theme colors (security palette)
- Follow existing design patterns with Card components
- Use CSS variables for theming (hsl(var(--primary)))
- Leverage shadcn/ui component variants

### State Management
- Use React Context for global state (CameraContext, EventsContext, SocketContext)
- Use TanStack Query for server state
- Keep local state in useState hooks

### API Integration
- Use ApiService singleton for all API calls
- Handle loading/error states consistently
- Use relative URLs (/api) - Vite proxy handles routing in dev
- Follow existing error handling patterns with custom error classes