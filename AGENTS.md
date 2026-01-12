# AGENTS.md

This document provides essential information for AI agents working on the SentryVision home security system codebase.

## Project Overview

SentryVision is a comprehensive home security system with real-time camera streaming, motion detection, facial recognition, and visitor analytics. The system consists of a React/TypeScript frontend, Node.js/Express backend, and PostgreSQL database.

## Architecture

### Frontend (`/frontend/src`)
- React 18 with TypeScript
- Vite for build tooling
- TailwindCSS + Radix UI components
- React Router for navigation
- React Query for state management
- Socket.io client for real-time updates

### Backend (`/server/src`)
- Node.js with Express
- TypeScript
- PostgreSQL with TypeORM
- Socket.io for real-time communication
- FFmpeg for RTSP stream processing
- Python OpenCV service for motion detection and facial recognition (via HTTP)
- JWT authentication with MFA support

### Database (`/database`)
- PostgreSQL with migration system
- Comprehensive user management with roles
- Audit trails and session tracking

### Python OpenCV Service (`/opencv-service`)
- Python Flask server with native OpenCV
- YOLO-based object detection
- Face recognition with embeddings
- Runs on port 8084
- Accessed via HTTP from Node.js backend

## Essential Commands

### Frontend Development
```bash
# Start frontend development server
npm run dev

# Build for production
npm run build

# Type checking
npm run typecheck

# Linting
npm run lint
npm run lint:fix

# Testing
npm run test
npm run test:watch
npm run test:coverage
```

### Backend Development
```bash
cd server

# Start backend development server
npm run dev

# Build TypeScript
npm run build

# Start production server
npm start

# Testing
npm test
```

### Full Stack Development
```bash
# Start both frontend and backend concurrently
npm run dev:full

# Build entire project
npm run build:full

# Kill ports (useful for restarts)
npm run kill:ports
```

### Database Operations
```bash
cd database

# Run migrations
npm run migrate

# Create database
createdb sentryvision
```

## Development Workflow

1. **Port Allocation**: Frontend runs on 5173, backend on 9753
2. **API Proxy**: Frontend proxies API calls to backend via Vite configuration
3. **Real-time Updates**: Socket.io handles streaming and notifications
4. **Authentication**: JWT tokens with refresh mechanism and MFA support

## Code Organization

### Frontend Structure
- `/frontend/src/components` - Reusable UI components
- `/frontend/src/pages` - Route-level page components
- `/frontend/src/contexts` - React context providers
- `/frontend/src/services` - API service layer
- `/frontend/src/types` - TypeScript type definitions
- `/frontend/src/hooks` - Custom React hooks

### Backend Structure
- `/server/src/routes` - Express route handlers
- `/server/src/services` - Business logic layer
- `/server/src/models` - TypeORM database models
- `/server/src/middleware` - Express middleware
- `/server/src/utils` - Utility functions
- `/server/src/detection` - Image processing and AI
- `/server/src/streams` - RTSP stream management

## Testing Approach

### Frontend Tests
- Jest for unit/integration tests
- Test files follow `*.test.ts` pattern
- Test setup in `/frontend/src/tests/setup.ts`

### Backend Tests
- Jest with Supertest for API testing
- Test setup in `/server/tests/setup.ts`
- Test database with isolated schema
- Coverage thresholds: 80% for branches, functions, lines, statements

## Security Considerations

1. **Authentication**: JWT with refresh tokens, MFA via TOTP
2. **Authorization**: Role-based access control (admin, user, viewer)
3. **Input Validation**: Zod schemas for request validation
4. **Rate Limiting**: Configurable limits per endpoint
5. **Audit Logging**: Complete audit trail for sensitive operations
6. **File Security**: Path validation for uploaded files
7. **CORS**: Configured for development and production domains

## Key Configuration Files

### Frontend
- `frontend/vite.config.ts` - Build configuration and proxy setup
- `frontend/tailwind.config.ts` - TailwindCSS configuration
- `frontend/components.json` - shadcn/ui component configuration

### Backend
- `server/.env.example` - Environment variable template
- `server/tsconfig.json` - TypeScript configuration
- `server/jest.config.js` - Jest testing configuration

## Database Schema

Key tables:
- `users` - User accounts with roles and status
- `roles` - Role definitions with permissions
- `sessions` - JWT session management
- `audit_logs` - Comprehensive audit trail
- `password_history` - Password change tracking

## API Conventions

1. **Response Format**: Standard JSON responses with `success`, `data`, and `error` fields
2. **Error Handling**: Custom error types (ApiError, NetworkError, TimeoutError)
3. **Pagination**: Standard pagination with `page`, `pageSize`, and total count
4. **Authentication**: Bearer tokens in Authorization header
5. **File Uploads**: Multipart form data with validation

## Real-time Features

### Socket.io Events
- `requestStream` - Request camera stream
- `stopStream` - Stop camera stream
- `frame` - New frame from camera
- `motionDetected` - Motion detection alert
- `batchCompleted` - Processing batch completed

### Stream Management
- RTSP streams processed via FFmpeg
- WebSockets for real-time frame delivery
- Automatic stream cleanup on disconnect

## Motion Detection & AI

1. **Motion Detection**: OpenCV-based background subtraction
2. **Object Detection**: YOLO-style object classification
3. **Facial Recognition**: Face detection and known person matching
4. **Batch Processing**: Async processing for resource-intensive operations

## Performance Considerations

1. **Connection Limits**: Configurable limits for concurrent streams
2. **Memory Management**: Automatic cleanup of disconnected clients
3. **Caching**: Redis caching for frequently accessed data
4. **Optimization**: Code splitting and lazy loading in frontend

## Development Tips

1. **Hot Reloading**: Both frontend and backend support hot reload in development
2. **Error Boundaries**: React error boundaries for graceful error handling
3. **Environment Variables**: Use `.env.example` as template for configuration
4. **Type Safety**: Strict TypeScript configuration throughout
5. **Component Reuse**: Leverage shadcn/ui components for consistency

## Debugging

1. **Development Routes**: `/debug` route available in development mode
2. **Console Output**: Structured logging with context
3. **Test Data**: Scripts available for generating test data
4. **Performance Monitoring**: Built-in memory and connection monitoring

## Deployment

1. **Docker Support**: Dockerfile and docker-compose configurations
2. **Nginx Configuration**: Proxy configuration for production
3. **Environment-Specific Settings**: Different configurations for dev/prod
4. **Database Migrations**: Automated migration system for database updates

## Common Gotchas

1. **Port Conflicts**: Ensure ports 5173, 9753, and 8084 (OpenCV service) are available
2. **Python OpenCV**: Required for motion detection functionality (runs in Docker on port 8084)
3. **FFmpeg Installation**: Required for RTSP stream processing
4. **Database Setup**: PostgreSQL must be running before migrations
5. **File Permissions**: Ensure write permissions for snapshots and events directories

## Testing Considerations

1. **Database Isolation**: Tests use separate test database
2. **Mock Dependencies**: Network requests and external services mocked
3. **Coverage Requirements**: Maintain 80% test coverage
4. **Integration Tests**: Test API endpoints with Supertest
5. **Component Testing**: Test React components with Jest

## Security Best Practices

1. **Never Log Credentials**: Use structured logging for sensitive data
2. **Validate All Input**: Use Zod schemas for request validation
3. **Secure File Handling**: Validate file paths and prevent directory traversal
4. **Rate Limiting**: Implement rate limiting for all endpoints
5. **Audit Everything**: Log all sensitive operations with context

## Troubleshooting

1. **Stream Issues**: Check FFmpeg installation and camera RTSP URLs
2. **Database Errors**: Verify PostgreSQL is running and migrations applied
3. **Authentication Problems**: Check JWT secrets and token expiration
4. **Permission Errors**: Verify user roles and permissions in database
5. **Performance Issues**: Monitor memory usage and connection limits

## Adding New Features

1. **Frontend Components**: Follow shadcn/ui patterns in `/frontend/src/components/ui`
2. **API Endpoints**: Add to appropriate route files in `/server/src/routes`
3. **Database Models**: Create new TypeORM entities in `/server/src/models`
4. **Tests**: Add corresponding tests for new functionality
5. **Documentation**: Update relevant documentation sections

## Code Style

1. **TypeScript**: Strict mode enabled, proper type definitions required
2. **ESLint**: Follow project linting rules
3. **File Naming**: PascalCase for components, camelCase for utilities
4. **Import Order**: External libraries first, then internal imports
5. **Error Handling**: Proper error boundaries and try-catch blocks