# Home Security - Development Guide

## Build Commands
- `npm run dev` - Start frontend dev server
- `npm run dev:server` - Start backend dev server  
- `npm run dev:full` - Start both frontend and backend
- `npm run build` - Build frontend for production
- `npm run build:server` - Build backend for production
- `npm run build:full` - Build both frontend and backend
- `npm run lint` - Run ESLint (ignores server/dist)
- `cd server && npm run test` - Run backend tests (currently no tests configured)

## Logging Configuration

### Backend Logging
The backend uses enhanced logging with file output:
- **Console**: Real-time logs to console
- **Files**: Stored in `server/logs/` directory
  - `combined.log` - All logs
  - `error.log` - Error logs only  
  - `access.log` - API and socket access logs
  - `audit/` - Audit logs (daily rotation)
- **Log Levels**: INFO, WARN, ERROR, DEBUG
- **Features**: 
  - Automatic log rotation (10MB max, 5 files)
  - Structured metadata logging
  - Performance monitoring
  - Socket connection tracking
  - API request/response logging

### Frontend Logging  
The frontend includes comprehensive logging:
- **Console**: Real-time logs to browser console
- **Local Storage**: Last 100 logs persisted
- **Remote Logging**: Optional endpoint configuration
- **Log Viewer Component**: `src/components/LogViewer.tsx`
- **Debug Page**: `src/pages/DebugPage.tsx`
- **Features**:
  - Global error handling
  - API request/response tracking
  - User action logging
  - Performance monitoring
  - Camera action tracking

### Viewing Logs

#### Backend
```bash
# View all logs
tail -f server/logs/combined.log

# View error logs only
tail -f server/logs/error.log

# View API access logs
tail -f server/logs/access.log

# View audit logs
tail -f server/logs/audit/audit-$(date +%Y-%m-%d).log
```

#### Frontend
1. Navigate to `/debug` route in the application
2. Use the LogViewer component with filters
3. Export logs for analysis
4. Configure logging settings in the UI

### Log Configuration Files
- Backend: `server/src/utils/logger.ts`
- Frontend: `src/lib/logger.ts`
- Audit: `server/src/utils/auditLogger.ts`

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

## Debugging Tips

### Common Issues
1. **Port Conflicts**: Backend automatically finds available port starting from 8082
2. **CORS Issues**: Check allowed origins in server/src/index.ts
3. **Socket Connection**: Monitor socket events in frontend LogViewer
4. **Camera Streams**: Verify RTSP URLs and network connectivity

### Performance Monitoring
- Backend: Memory usage tracked every 5 minutes
- Frontend: Performance API metrics logged automatically
- Both: Response times and connection monitoring

### Security Features
- Rate limiting with configurable thresholds
- IP blocking for violations
- Audit logging for all sensitive operations
- CORS protection with whitelist
- Security headers via Helmet