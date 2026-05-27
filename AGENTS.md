# AGENTS.md

This document provides essential information for AI agents working on the SentryVision home security system codebase.

## Project Overview

SentryVision is a comprehensive home security system with real-time camera streaming, motion detection, facial recognition, and visitor analytics. The system consists of a React/TypeScript frontend, Node.js/Express backend, PostgreSQL database, and Python OpenCV service.

**Current Status**: Production-ready with 2 cameras, 1,050+ events, optimized motion detection
**Last Updated**: February 2, 2026
**Timezone**: IST (Asia/Kolkata, UTC+5:30)

## Architecture

### Frontend (`/frontend/src`)
- **Framework**: React 18 with TypeScript (strict mode)
- **Build Tool**: Vite for fast development and optimized production builds
- **UI Library**: TailwindCSS + Radix UI components (shadcn/ui)
- **Routing**: React Router v6 for navigation
- **State Management**: React Query (@tanstack/react-query) for server state, Context API for global state
- **Real-time**: Socket.io client for live updates
- **Charts**: Recharts for analytics visualization

### Backend (`/server/src`)
- **Runtime**: Node.js with ES modules
- **Framework**: Express
- **Language**: TypeScript (strict mode)
- **Database**: PostgreSQL with TypeORM
- **Real-time**: Socket.io server for streaming and notifications
- **Stream Processing**: FFmpeg for RTSP camera streams
- **AI Service**: Python OpenCV service accessed via HTTP
- **Authentication**: JWT with refresh tokens + TOTP MFA

### Database (`/database`)
- **Engine**: PostgreSQL 15+
- **Migrations**: 8 migration files (numbered 001-008)
- **Tables**: 17 tables (users, events, visitors, batch_jobs, review_segments, etc.)

### Python OpenCV Service (`/opencv-service`)
- **Framework**: Flask (Python)
- **Computer Vision**: Native OpenCV with cv2
- **Face Recognition**: Custom implementation with embeddings
- **Motion Detection**: Optimized MOG2 background subtraction
- **Port**: 8084
- **Access**: HTTP from Node.js backend

## Port Configuration

| Service | Port | Purpose |
|---------|------|---------|
| Frontend | 5173 | React development server (Vite) |
| Backend | 9753 | Express API server |
| OpenCV | 8084 | Python Flask service |
| PostgreSQL | 5432 | Database |
| Redis | 6379 | Detection result caching (with in-memory fallback) |

## Essential Commands

### Root Level Commands

```bash
# Development
npm run dev                 # Start frontend only (port 5173)
npm run dev:server          # Start backend only (port 9753)
npm run dev:full            # Start both frontend and backend
npm run kill:ports          # Kill processes on ports 5173, 9753

# Building
npm run build               # Build frontend
npm run build:server        # Build backend TypeScript
npm run build:full          # Build both

# Docker
docker-compose up -d        # Start all 5 services
docker-compose down         # Stop all services
docker-compose ps           # Check service status
docker-compose logs -f      # View logs
docker-compose restart      # Restart services

# Frontend Testing
npm run lint                # ESLint check
npm run typecheck           # TypeScript type checking
npm run test                # Run Jest tests
```

### Backend Commands

```bash
cd server

# Development
npm run dev                 # Start with nodemon hot reload

# Production
npm run build               # Compile TypeScript to dist/
npm start                   # Start from dist/index.js

# Scripts
npm run init-batch-db       # Initialize batch processing database
npm run batch-process       # Run batch processing
npm run detect-from-files   # Detect objects from saved files
```

### Database Commands

```bash
cd database

# Run migrations
npm run migrate             # Execute pending migrations

# Manual database access
docker exec -it sentryvision-postgres psql -U sentryvision -d sentryvision

# Create database
createdb sentryvision
```

## Development Workflow

### 1. Service Dependencies
```
Frontend (5173)
    ↓ API calls
Backend (9753)
    ↓ HTTP requests
OpenCV Service (8084)
    ↓ Queries
PostgreSQL (5432) + Redis (6379)
```

### 2. Starting Development Environment
```bash
# Option A: Docker (recommended)
docker-compose up -d

# Option B: Local development
# Terminal 1: Start backend
npm run dev:server

# Terminal 2: Start frontend
npm run dev
```

### 3. API Proxy Configuration
Frontend proxies API calls to backend via Vite config:
```typescript
// frontend/vite.config.ts
server: {
  proxy: {
    '/api': 'http://localhost:9753'
  }
}
```

### 4. Real-time Communication
- **Socket.io**: Live camera streams and motion alerts
- **Events**: `requestStream`, `stopStream`, `frame`, `motionDetected`
- **Connection**: `http://localhost:9753` (backend URL)

## Code Organization

### Frontend Structure

```
frontend/src/
├── components/
│   ├── dashboard/         # Dashboard-specific components
│   │   ├── CameraGrid.tsx
│   │   ├── RecentDetectionsCarousel.tsx
│   │   └── SystemOverview.tsx
│   ├── analytics/         # Charts and analytics
│   ├── ui/               # shadcn/ui components (Radix UI)
│   └── ...
├── pages/                 # Route-level components
│   ├── Dashboard.tsx
│   ├── Gallery.tsx
│   ├── VisitorTimeline.tsx
│   ├── Review.tsx
│   └── Settings.tsx
├── services/              # API client layer
│   └── ApiService.ts
├── contexts/              # React context providers
│   ├── CameraContext.tsx
│   ├── SocketContext.tsx
│   └── AuthContext.tsx
├── hooks/                 # Custom React hooks
├── types/                 # TypeScript definitions
│   └── security.ts
└── lib/                   # Utilities
    └── utils.ts
```

### Backend Structure

```
server/src/
├── routes/                # API endpoint handlers
│   ├── index.ts           # Main routes (16K+ lines)
│   ├── auth.ts            # Authentication endpoints
│   ├── visitorRoutes.ts   # Visitor management
│   ├── detectionRoutes.ts # Object/face detection
│   ├── reviewRoutes.ts    # Review segments
│   └── timelineRoutes.ts  # Timeline queries
├── services/              # Business logic
├── models/                # TypeORM entities
│   ├── User.ts
│   ├── Event.ts
│   ├── Visitor.ts
│   ├── BatchJob.ts
│   └── index.ts           # Export all models
├── middleware/            # Express middleware
│   ├── auth.ts            # JWT verification
│   ├── rateLimit.ts       # Rate limiting
│   └── validation.ts      # Request validation
├── detection/             # Motion detection (3 implementations)
│   ├── optimizedMotionDetection.ts     # Main detection (988 lines)
│   ├── simpleMotionDetection.ts        # Basic detection (138 lines)
│   ├── motionTriggeredDetection.ts     # Object/face detection (664 lines)
│   ├── objectDetection.ts              # YOLO object detection
│   └── cleanupService.ts               # Event cleanup
├── streams/               # RTSP stream management
│   ├── rtspManager.ts     # Main stream orchestrator
│   └── streamManager.ts
├── config/                # Configuration
│   ├── index.ts
│   └── detectionConfig.ts
└── index.ts               # Application entry point
```

### OpenCV Service Structure

```
opencv-service/
├── app.py                 # Main Flask application (1,200+ lines)
├── improved_face_recognition.py  # Face recognition engine
├── models/                # ML model files
├── known_faces/           # Known face embeddings
└── data/                  # Temporary detection data
```

## Database Schema

### Current Tables (17 total)

**User Management**:
- `users` - User accounts with email, password, roles
- `roles` - Role definitions with permissions (admin, user, viewer)
- `user_sessions` - JWT session tracking
- `password_history` - Password change history
- `audit_logs` - Security audit trail

**Detection & Events**:
- `events` - Motion events with detection data (1,050+ records)
- `detection_config` - Detection configuration storage
- `processed_images` - Processed image metadata
- `adaptive_regions` - Spatial detection zones

**Visitor Management**:
- `visitor_timeline` - Visitor tracking with faces
- `timeline` - Timeline events

**Review & Batch**:
- `review_segments` - Bundled review periods with severity
- `user_review_status` - Review tracking per user
- `batch_jobs` - Async batch processing jobs

**System**:
- `retention_policies` - Data retention rules
- `storage_stats` - Storage usage statistics
- `system_settings` - System configuration

### Event Table Structure

Key columns in `events` table:
- `id` - UUID primary key
- `timestamp` - Event timestamp (IST timezone)
- `camera_id` - cam1 or cam2
- `event_type` - motion, object, face
- `confidence` - Detection confidence (0-100)
- `image_path` - Path to captured image
- `persons_detected` - Count of persons
- `faces_detected` - Count of faces
- `known_faces_count` - Known faces in frame
- `object_detections` - JSONB array of objects
- `face_detections` - JSONB array of faces

## Motion Detection System

### Three Active Implementations

**1. Optimized Motion Detection** (`optimizedMotionDetection.ts`)
- **Purpose**: Main motion detection with adaptive intervals
- **Used by**: routes/index.ts, streams/rtspManager.ts, detection/cleanupService.ts
- **Features**:
  - Adaptive sensitivity (90/100 maximum)
  - Night mode enhancement (22:00-06:00)
  - Zone-based detection
  - Cooldown period (10 seconds)
  - Detection interval (3 seconds)
- **Lines**: 988

**2. Simple Motion Detection** (`simpleMotionDetection.ts`)
- **Purpose**: Basic detection for event queue service
- **Used by**: services/eventQueueService.ts
- **Features**:
  - Lightweight implementation
  - Fast processing
  - Basic threshold comparison
- **Lines**: 138

**3. Motion-Triggered Detection** (`motionTriggeredDetection.ts`)
- **Purpose**: Trigger object/face detection on motion
- **Used by**: streams/rtspManager.ts, integrations/motionBatchIntegration.ts, routes/detectionRedoRoutes.ts
- **Features**:
  - Triggers YOLO object detection
  - Face recognition pipeline
  - Batch processing support
  - Detection result caching
- **Lines**: 664

### OpenCV Service Motion Detection

**Algorithm**: MOG2 (Mixture of Gaussians) background subtraction

**Optimized Parameters** (app.py):
```python
history=200              # Faster adaptation (default: 500)
varThreshold=8           # 2x more sensitive (default: 16)
detectShadows=False      # Reduce noise
kernel=(3,3)             # Smaller morphological kernel
iterations=1             # Lighter filtering
motion_threshold=0.002   # 0.2% of frame area
contour_threshold=0.0015 # 0.15% of frame area
confidence_multiplier=8  # Accurate confidence calculation
```

**Performance**:
- Processing time: 15-20ms per frame
- Sensitivity improvement: 2-4x over defaults
- False positive rate: Reduced with optimized parameters

### Camera Configuration

**File**: `server/cameras.json`

**Current Cameras**:
1. **cam1 - Front Door**
   - Resolution: 1920x1080 @ 4 FPS (stream), 640x360 @ 3 FPS (detection)
   - Objects: person, car, dog, cat, package
   - Zones: Front Steps, Driveway, Street

2. **cam2 - Back Door**
   - Resolution: 1920x1080 @ 4 FPS (stream), 640x360 @ 3 FPS (detection)
   - Objects: person, car, dog, cat
   - Zones: Back Patio, Gate

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login with email/password
- `POST /api/auth/refresh` - Refresh access token
- `POST /api/auth/logout` - Invalidate session
- `GET /api/auth/mfa/setup` - Generate MFA secret
- `POST /api/auth/mfa/verify` - Verify TOTP code
- `GET /api/auth/me` - Get current user info

### Events
- `GET /api/events/list` - List with pagination
- `GET /api/events/list-enhanced` - Enhanced list with filters
  - Query params: `page`, `pageSize`, `eventType`, `cameraId`, `startDate`, `endDate`
- `GET /api/events/:id` - Get single event
- `GET /api/events/image/:filename` - Serve event image
- `DELETE /api/events/:id` - Delete event

### Visitors
- `GET /api/visitors/list` - List all visitors
- `GET /api/visitors/timeline` - Get visitor timeline
- `GET /api/visitors/:id` - Get visitor details
- `PUT /api/visitors/:id` - Update visitor (name, tags, notes)
- `DELETE /api/visitors/:id` - Delete visitor

### Review
- `GET /api/review/segments` - Get review segments
- `GET /api/review/segments/:id` - Get segment details
- `POST /api/review/segments/:id/dismiss` - Mark as dismissed
- `POST /api/review/segments/:id/confirm` - Confirm as valid detection
- `GET /api/review/timeline` - Get review timeline

### Detection
- `POST /api/detection/redo` - Re-run detection on events
- `POST /api/detection/batch` - Batch detection request
- `GET /api/detection/status/:jobId` - Check batch job status

### System
- `GET /api/health` - Health check
- `GET /api/stats` - System statistics
- `GET /api/cameras` - List all cameras
- `POST /api/cameras/:id/snapshot` - Capture snapshot
- `GET /api/cameras/:id/stream` - Get camera stream URL

## Testing Approach

### Frontend Tests
- **Framework**: Jest with React Testing Library
- **Test files**: `*.test.ts` pattern
- **Setup**: `/frontend/src/tests/setup.ts`
- **Location**: Tests alongside components

### Backend Tests
- **Framework**: Jest with Supertest
- **Setup**: `/server/tests/setup.ts`
- **Database**: Isolated test schema
- **Coverage**: 80% threshold for branches, functions, lines, statements
- **Test files**:
  - `auth.test.ts` - Authentication endpoints
  - `batchDetection.test.ts` - Batch processing
  - `reviewRoutes.test.ts` - Review segments
  - `visitorRoutes.test.ts` - Visitor management

## Security Features

### Authentication
- **JWT**: Access tokens (15 min) + Refresh tokens (7 days)
- **MFA**: TOTP-based (Google Authenticator compatible)
- **Password**: BCrypt hashing, complexity requirements, history tracking

### Authorization
- **Roles**: admin (full access), user (limited), viewer (read-only)
- **Permissions**: Defined in `roles` table

### Input Validation
- **Schema**: Zod validation for all API inputs
- **Sanitization**: Input sanitization middleware

### Rate Limiting
- **Default**: 100 requests per 15 minutes
- **Customizable**: Per-endpoint configuration
- **Implementation**: express-rate-limit

### Audit Logging
- **Scope**: All sensitive operations (login, logout, MFA changes, role changes)
- **Storage**: `audit_logs` table
- **Fields**: user_id, action, ip_address, user_agent, timestamp

### Security Headers
- **Helmet.js**: Content Security Policy, X-Frame-Options, etc.
- **CORS**: Configured for specific domains

## Key Configuration Files

### Frontend
- `frontend/vite.config.ts` - Vite build config, proxy setup
- `frontend/tailwind.config.ts` - TailwindCSS customization
- `frontend/components.json` - shadcn/ui component config
- `frontend/package.json` - Dependencies and scripts

### Backend
- `server/tsconfig.json` - TypeScript configuration (strict)
- `server/jest.config.js` - Jest testing setup
- `server/.env.example` - Environment variable template
- `server/cameras.json` - Camera configuration (RTSP URLs, zones)

### Docker
- `docker-compose.yml` - Multi-service orchestration
- `server/Dockerfile` - Backend container
- `frontend/Dockerfile` - Frontend container
- `opencv-service/Dockerfile` - Python service container

### Database
- `database/migrations/` - SQL migration files (001-008)
- `database/run-migrations.ts` - Migration runner

## Development Workflow

### Adding New Features

**Frontend**:
1. Create component in appropriate directory
2. Follow shadcn/ui patterns for UI components
3. Use existing services/ApiService.ts for API calls
4. Add TypeScript types in types/
5. Write tests if needed

**Backend**:
1. Add TypeORM model in models/ if new entity needed
2. Create migration in database/migrations/
3. Add routes in routes/ following existing patterns
4. Implement business logic in services/
5. Add validation with Zod schemas
6. Write tests in tests/

**Database**:
1. Create new migration file: `009_feature_name.sql`
2. Write SQL for table changes
3. Test migration locally
4. Update TypeORM models to match

### Code Style

**TypeScript**:
- Strict mode enabled
- All files use `.ts` or `.tsx` extension
- No implicit any
- Proper type definitions required

**ESLint**:
- Follow project linting rules
- Run `npm run lint:fix` before committing

**File Naming**:
- Components: PascalCase (e.g., `CameraGrid.tsx`)
- Utilities: camelCase (e.g., `apiService.ts`)
- Hooks: camelCase with 'use' prefix (e.g., `useAuth.ts`)

**Import Order**:
1. External libraries
2. Internal imports (prefixed with @/ or relative)
3. Type imports

**Error Handling**:
- Use try-catch for async operations
- Proper error boundaries in React
- Log errors with context

## Common Issues & Solutions

### Port Already in Use
```bash
npm run kill:ports
# Or manually
lsof -ti:9753 | xargs kill -9
lsof -ti:5173 | xargs kill -9
```

### Database Connection Errors
1. Verify PostgreSQL is running: `docker ps | grep postgres`
2. Check credentials in docker-compose.yml
3. Ensure migrations have run: `cd database && npm run migrate`
4. Test connection: `docker exec -it sentryvision-postgres psql -U sentryvision -d sentryvision`

### Motion Detection Not Working
1. Verify RTSP URLs in cameras.json
2. Check OpenCV service: `curl http://localhost:8084/health`
3. Review OpenCV logs: `docker logs sentryvision-opencv`
4. Verify FFmpeg is installed in container
5. Check detection zones are configured

### Frontend Build Errors
1. Delete node_modules: `rm -rf frontend/node_modules`
2. Reinstall: `cd frontend && npm install`
3. Check TypeScript errors: `npm run typecheck`

### Backend TypeScript Errors
1. Clean build: `cd server && rm -rf dist && npm run build`
2. Check types: `tsc --noEmit`
3. Verify imports are correct

## Performance Considerations

### Connection Limits
- Max concurrent streams: Configurable in backend
- Socket.io connections: Auto-cleanup on disconnect

### Memory Management
- Automatic cleanup of disconnected clients
- Redis for detection result caching (graceful fallback to in-memory Map)
- Detection results cached for 1 hour

### Optimization
- Code splitting in frontend (Vite)
- Lazy loading for images
- Batch processing for heavy operations
- Detection intervals: 3 seconds (configurable)

## Deployment

### Docker Deployment (Recommended)
```bash
# Build and start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Check health
curl http://localhost:9753/api/health
curl http://localhost:8084/health
```

### Production Considerations
1. Change JWT secrets in docker-compose.yml
2. Update CORS configuration for production domain
3. Configure SSL/TLS for HTTPS
4. Set up backup for PostgreSQL database
5. Configure log rotation
6. Monitor resource usage

## Debugging

### Backend Debugging
```bash
# View logs
docker logs sentryvision-backend -f

# Check specific logs
docker logs sentryvision-backend | grep "Motion detected"

# Connect to container
docker exec -it sentryvision-backend sh
```

### Frontend Debugging
- React DevTools browser extension
- Network tab in browser DevTools
- Console for errors

### Database Debugging
```bash
# Connect to PostgreSQL
docker exec -it sentryvision-postgres psql -U sentryvision -d sentryvision

# Check recent events
SELECT * FROM events ORDER BY timestamp DESC LIMIT 10;

# Count events
SELECT COUNT(*) FROM events;

# Check database size
SELECT pg_size_pretty(pg_database_size('sentryvision'));
```

## System Statistics

**Current** (as of Feb 2, 2026):
- **Cameras**: 2 RTSP cameras
- **Events**: 1,050+ recorded events
- **Database Tables**: 17
- **Migrations**: 8
- **Detection Code**: 3,528 lines across 3 implementations
- **Timezone**: IST (Asia/Kolkata, UTC+5:30)
- **Simulation Mode**: Disabled (real detection only)

## Environment Variables

### Backend (.env)
```
NODE_ENV=development
PORT=9753
DB_HOST=postgres
DB_PORT=5432
DB_NAME=sentryvision
DB_USER=sentryvision
DB_PASSWORD=${POSTGRES_PASSWORD}
JWT_ACCESS_SECRET=change-in-production
JWT_REFRESH_SECRET=change-in-production
OPENCV_SERVICE_URL=http://opencv:8084
DETECTIONS_DIR=/app/data/detections
TZ=Asia/Kolkata
```

### Frontend (.env)
```
VITE_BACKEND_URL=http://localhost:9753
```

## Additional Resources

- **Deployment Guide**: See DEPLOYMENT.md
- **Container Best Practices**: See CONTAINERIZATION_BEST_PRACTICES.md
- **Docker Configuration**: See docker-compose.yml
- **Camera Setup**: Edit server/cameras.json
