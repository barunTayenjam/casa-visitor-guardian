<!-- refreshed: 2026-05-06 -->
# Architecture

**Analysis Date:** 2026-05-06

## System Overview

```text
┌─────────────────────────────────────────────────────────────────────────┐
│                      Frontend (React + TypeScript)                       │
│  `frontend/src/`  •  Vite dev server :5173  •  Nginx in production     │
├──────────────┬──────────────┬──────────────┬────────────────────────────┤
│   Pages      │  Contexts    │  Services    │  Components                │
│ `pages/`     │ `contexts/`  │ `services/`  │ `components/`              │
│ (9 routes)   │ (4 providers)│ (3 svcs)     │ (7 feature dirs + ui/)     │
└──────┬───────┴──────┬───────┴──────┬───────┴────────────────────────────┘
       │   REST /api   │  Socket.io   │
       ▼               ▼              │
┌─────────────────────────────────────┼──────────────────────────────────┐
│                  Backend (Express + TypeScript)                        │
│  `server/src/`  •  Port :9753 (or :8082)                              │
├──────────┬──────────┬──────────┬────┴────┬──────────┬─────────────────┤
│ Routes   │ Auth     │ Detection│ Streams │ Services │ Models (TypeORM)│
│ `routes/`│ `auth/`  │ `detection/`│`streams/`│`services/`│ `models/`   │
│ (12 files)│(JWT+MFA)│ (4 impls)│ (RTSP)  │(36 files)│ (20 entities)  │
└──────┬───┴──────────┴────┬─────┴─────────┴──────────┴──────┬──────────┘
       │                   │                                  │
       │  HTTP :8084       │         SQL                     │
       ▼                   ▼                                  ▼
┌──────────────────┐ ┌──────────────────────┐  ┌──────────────────────┐
│ OpenCV Service   │ │   PostgreSQL 15+     │  │   Redis :6379        │
│ `opencv-service/`│ │   Port :5432         │  │   Cache + Sessions   │
│ Flask + cv2      │ │   `database/`        │  │                      │
│ Port :8084       │ │   17 migration files │  │                      │
└──────────────────┘ └──────────────────────┘  └──────────────────────┘
```

## Component Responsibilities

| Component | Responsibility | Key Files |
|-----------|----------------|-----------|
| Frontend App | SPA routing, UI rendering, state management | `frontend/src/App.tsx`, `frontend/src/main.tsx` |
| API Service | Centralized HTTP client for all backend calls | `frontend/src/services/ApiService.ts` |
| Socket Service | Real-time camera streaming and event updates | `frontend/src/services/SocketService.ts` |
| Auth Context | Client-side auth state (JWT, login, logout) | `frontend/src/contexts/AuthContext.tsx` |
| Camera Context | Camera list, streaming control, snapshots | `frontend/src/contexts/CameraContext.tsx` |
| Socket Context | WebSocket connection lifecycle management | `frontend/src/contexts/SocketContext.tsx` |
| Events Context | Live motion event feed from socket | `frontend/src/contexts/EventsContext.tsx` |
| Backend Entry | Express server bootstrap, service init, Socket.io setup | `server/src/index.ts` |
| Main Routes | Core API endpoints (events, cameras, settings, alerts) | `server/src/routes/index.ts` (5,134 lines) |
| Auth System | JWT authentication, MFA, user management | `server/src/auth/index.ts`, `server/src/routes/auth.ts` |
| Stream Manager | RTSP camera connection, FFmpeg transcoding, frame distribution | `server/src/streams/rtspManager.ts` |
| Motion Detection | Frame analysis, MOG2 background subtraction, event creation | `server/src/detection/optimizedMotionDetection.ts` |
| Consolidated Detection | Proxy to OpenCV, caching, circuit breaker | `server/src/detection/consolidatedDetectionService.ts` |
| Motion-Triggered Detection | YOLO object + face detection on motion frames | `server/src/detection/motionTriggeredDetection.ts` |
| TypeORM Models | Database entity definitions (20 entities) | `server/src/models/index.ts` and individual model files |
| Database Init | TypeORM DataSource, connection management | `server/src/database.ts` |
| Event Bus | Internal pub/sub for cross-service communication | `server/src/events/eventBus.ts` |
| Base Service | Abstract service class with event bus integration | `server/src/services/baseService.ts` |
| OpenCV Service | Python Flask service: YOLO detection, face recognition, MOG2 | `opencv-service/app.py` |
| Migrations | SQL schema evolution (17 files, numbered 001-017) | `database/migrations/` |

## Pattern Overview

**Overall:** Layered monolith with microservice adjunct

**Key Characteristics:**
- Frontend: React SPA with lazy-loaded routes, Context-based state, React Query for server state
- Backend: Express MVC-like with route→service→model layers, global singletons for services
- Real-time: Socket.io for live camera streaming (binary frames) and event notifications
- Detection pipeline: Motion → Object/Face → Event → Socket notification → DB storage
- Cross-service communication: Internal EventBus (Node EventEmitter singleton) + HTTP to Python OpenCV
- Database: TypeORM entities for schema, but direct SQL queries also used for complex queries

## Layers

**Frontend Presentation Layer:**
- Purpose: User interface rendering and user interaction
- Location: `frontend/src/pages/`, `frontend/src/components/`
- Contains: Route components, UI components, feature components
- Depends on: Context providers, API/Socket services
- Used by: End user via browser

**Frontend State Layer:**
- Purpose: Client-side state management and API communication
- Location: `frontend/src/contexts/`, `frontend/src/services/`
- Contains: React contexts (Auth, Camera, Socket, Events), ApiService, SocketService
- Depends on: Backend API and Socket.io server
- Used by: Presentation layer components

**Backend Route Layer:**
- Purpose: HTTP endpoint definitions, request validation, response formatting
- Location: `server/src/routes/`
- Contains: Express route handlers (12 route files)
- Depends on: Services, middleware, models
- Used by: Frontend API calls

**Backend Service Layer:**
- Purpose: Business logic, orchestration, external service communication
- Location: `server/src/services/`
- Contains: 36 service files in subdirectories and root, organized by domain
- Depends on: Models, database, external APIs (OpenCV)
- Used by: Route layer

**Backend Detection Layer:**
- Purpose: Motion analysis, object detection, face recognition pipeline
- Location: `server/src/detection/`
- Contains: 4 detection implementations + supporting utilities
- Depends on: Stream manager (frames), OpenCV service (HTTP), Event model
- Used by: Stream manager (on-frame callback), route handlers

**Backend Stream Layer:**
- Purpose: RTSP camera management, FFmpeg transcoding, frame distribution
- Location: `server/src/streams/`
- Contains: StreamManager, StreamHealthMonitor
- Depends on: FFmpeg (system or ffmpeg-static), camera config, detection layer
- Used by: Socket.io handlers, route handlers

**Backend Data Layer:**
- Purpose: Database entities and connection management
- Location: `server/src/models/`, `server/src/database.ts`
- Contains: TypeORM entities (20), DataSource configuration
- Depends on: PostgreSQL, TypeORM
- Used by: All service and route layers

**Python OpenCV Service:**
- Purpose: Computer vision processing (YOLO, face recognition, motion)
- Location: `opencv-service/`
- Contains: Flask app, detection models, known faces data
- Depends on: OpenCV, YOLO models, PostgreSQL (for caching)
- Used by: Backend consolidated detection service (HTTP :8084)

## Data Flow

### Primary Request Path: Camera Streaming

1. Frontend requests stream — `SocketService.emit('requestStream', {cameraId, role})` (`frontend/src/services/SocketService.ts:30`)
2. Backend Socket handler joins room and starts stream — `io.on('connection')` handler (`server/src/index.ts:563`)
3. StreamManager spawns FFmpeg process for RTSP URL — `StreamManager.startStream()` (`server/src/streams/rtspManager.ts:67`)
4. FFmpeg pipes JPEG frames to Node.js — FFmpeg stdout → frame handler in rtspManager
5. Frames broadcast via Socket.io to room — `io.to('camera-{id}-{role}').emit('frame', buffer)`
6. Frontend SocketService receives frames — `socketService.on('frame', callback)` (`frontend/src/services/SocketService.ts`)
7. CameraContext distributes to components — `CameraContext` state update triggers re-render

### Motion Detection Pipeline

1. FFmpeg produces frame → MotionDetector receives it — `OptimizedMotionDetector` (`server/src/detection/optimizedMotionDetection.ts`)
2. Frame sent to OpenCV for MOG2 analysis — HTTP POST to `:8084/detect/motion`
3. If motion detected above threshold → consolidate detection — `consolidatedDetectionService.detect()` (`server/src/detection/consolidatedDetectionService.ts`)
4. Object detection (YOLO) + Face recognition triggered — `motionTriggeredDetection` (`server/src/detection/motionTriggeredDetection.ts`)
5. Event saved to PostgreSQL — `Event` entity persisted (`server/src/models/Event.ts`)
6. Socket.io notification to frontend — `io.emit('motionDetected', eventData)`
7. Frontend EventsContext adds to live feed — `EventsProvider` (`frontend/src/contexts/EventsContext.tsx`)

### REST API Request

1. Frontend ApiService makes HTTP call — `ApiService.getEvents()` etc. (`frontend/src/services/ApiService.ts`)
2. Vite proxy (dev) or nginx (prod) forwards to backend — `/api/*` → `:9753`
3. Express middleware chain: CORS → JSON parser → auth → rate limit — `server/src/index.ts:46-50`, middleware/
4. Route handler validates input with Zod — `server/src/schemas/validationSchemas.ts`
5. Service layer executes business logic — services directory
6. TypeORM or raw SQL queries PostgreSQL — `AppDataSource` (`server/src/database.ts`)
7. JSON response returned to frontend

**State Management:**
- **Server state:** PostgreSQL via TypeORM entities + direct SQL queries
- **Client server state:** React Query (`@tanstack/react-query`) for cached/fetched data
- **Client local state:** React Context (Auth, Camera, Socket, Events) for real-time/live data
- **Global singletons:** Backend uses `(global as any).serviceName` pattern for cross-module access

## Key Abstractions

**StreamManager (Singleton per process):**
- Purpose: Manages all RTSP camera connections, FFmpeg processes, frame distribution
- File: `server/src/streams/rtspManager.ts` (919 lines)
- Pattern: Manager class with per-camera Camera objects, each with role-based streams
- Key method: `startStream(cameraId, role)`, `stopStream()`, frame emission loop

**ConsolidatedDetectionService (Singleton):**
- Purpose: Unified detection interface proxying to OpenCV service with caching and circuit breaker
- File: `server/src/detection/consolidatedDetectionService.ts` (430 lines)
- Pattern: Facade + Circuit Breaker + Cache
- Key method: `detect(imageBuffer, cameraId, settings)`

**EventBus (Singleton):**
- Purpose: Internal pub/sub for decoupled inter-service communication
- File: `server/src/events/eventBus.ts` (285 lines)
- Pattern: Singleton EventEmitter with typed event map, queue-based processing
- Key method: `emitEvent(event)`, `registerHandler(type, handler)`

**BaseService (Abstract):**
- Purpose: Base class for services needing EventBus integration
- File: `server/src/services/baseService.ts` (137 lines)
- Pattern: Abstract class with `setupEventHandlers()` template method
- Examples: Services extending this get logging + event emission helpers

**ApiService (Singleton):**
- Purpose: Centralized HTTP client for all backend API communication
- File: `frontend/src/services/ApiService.ts` (3,162 lines)
- Pattern: Class with methods per API endpoint, error types (ApiError, NetworkError, TimeoutError)
- Key method: `getEvents()`, `getCameras()`, `login()`, etc.

## Entry Points

**Frontend Entry:**
- Location: `frontend/src/main.tsx`
- Triggers: Browser loads `index.html`
- Responsibilities: Theme init, global error handlers, performance monitoring, React root render

**Backend Entry:**
- Location: `server/src/index.ts` (640 lines)
- Triggers: `npm run dev:server` or `npm start` (production)
- Responsibilities: Express + Socket.io creation, middleware setup, route registration, service initialization sequence

**OpenCV Service Entry:**
- Location: `opencv-service/app.py` (1,903 lines)
- Triggers: `python app.py` or Docker container start
- Responsibilities: Flask server on port 8084, loads YOLO models, detection endpoints, DB connection pool

**Database Migration Runner:**
- Location: `database/run-migrations.ts`
- Triggers: `npm run migrate` in database directory
- Responsibilities: Executes numbered SQL migration files against PostgreSQL

## Architectural Constraints

- **Single-threaded event loop:** Node.js backend uses async I/O. CPU-bound detection work delegated to Python OpenCV service via HTTP
- **Global singletons:** Services stored on `(global as any)` in `server/src/index.ts:503-551`. This includes `streamManager`, `motionDetector`, `reviewService`, `timelineService`, `detectionConfigService`, `notificationService`, `storageStatsService`, `retentionPolicyService`, `automatedCleanupService`
- **Circular imports:** `server/src/models/index.ts` explicitly exports `UserSession` before `User` to break a circular dependency (noted in comment at line 1)
- **FFmpeg dependency:** Stream system requires FFmpeg installed on host or `ffmpeg-static` npm package. System FFmpeg preferred (`rtspManager.ts:20-27`)
- **Camera config via JSON:** Camera definitions loaded from `config.cameras` (derived from `server/cameras.json` or environment) at startup. No runtime camera add/remove via database
- **Timezone:** All timestamps in IST (Asia/Kolkata, UTC+5:30). Set via `TZ=Asia/Kolkata` env var

## Anti-Patterns

### Monolithic Routes File

**What happens:** `server/src/routes/index.ts` is 5,134 lines containing 20+ endpoint groups (events, cameras, settings, alerts, detection config, review, timeline, etc.)
**Why it's wrong:** Difficult to navigate, high merge conflict risk, unclear ownership boundaries. Some routes ARE extracted to separate files (auth, visitor, review, detection) but many remain in the monolith.
**Do this instead:** Extract remaining route groups into dedicated files matching the pattern in `server/src/routes/visitorRoutes.ts`, `server/src/routes/reviewRoutes.ts`, etc.

### Global Singleton Service Locator

**What happens:** Services initialized in `server/src/index.ts` are attached to `(global as any).serviceName` and accessed throughout the codebase
**Why it's wrong:** Hidden dependencies, no type safety, difficult to test. Every consumer must do `(global as any).reviewService` with no compile-time verification
**Do this instead:** Use dependency injection or pass service instances to route handlers via Express app locals or a service container

### Mixed Database Access Patterns

**What happens:** TypeORM entities exist for all tables (`server/src/models/`), but many routes use raw SQL via `AppDataSource.query()` (e.g., `server/src/index.ts:63-73`)
**Why it's wrong:** Bypasses TypeORM's type safety, migrations may not reflect actual query patterns, inconsistent error handling
**Do this instead:** Use TypeORM repository methods for standard CRUD, and centralize raw SQL in service layer methods with proper typing

## Error Handling

**Strategy:** Layered error handling with consistent JSON response format

**Patterns:**
- Backend routes: try/catch with `{ success: false, error: string }` JSON responses
- Frontend: Error boundaries at route level (`ErrorBoundary` component wrapping each route in `App.tsx`)
- API errors: Custom error classes (`ApiError`, `NetworkError`, `TimeoutError`) in `frontend/src/services/ApiService.ts:9-33`
- Detection: Circuit breaker pattern for OpenCV service (`server/src/services/circuitBreaker.ts`)
- Audit: Security events logged to database via `auditLogger` (`server/src/utils/auditLogger.ts`)

## Cross-Cutting Concerns

**Logging:** Backend uses custom logger (`server/src/utils/logger.ts`). Frontend uses custom logger (`frontend/src/lib/logger.ts`). OpenCV uses Python print/logging.

**Validation:** Zod schemas for request validation (`server/src/schemas/validationSchemas.ts`). Multer for file uploads with size limits.

**Authentication:** JWT access tokens (15 min) + refresh tokens. Auth middleware at `server/src/middleware/auth.ts` with role-based access (`requireUser`, `requireAdmin`, `optionalAuth`). MFA via TOTP at `server/src/services/totpService.ts`.

**Rate Limiting:** Express rate limiting at `server/src/middleware/rateLimit.ts` with enhanced version at `server/src/middleware/enhancedRateLimit.ts`. Default 100 req/15 min.

**Security Headers:** Helmet.js via `server/src/middleware/security.ts`. CORS configured for specific origins.

---

*Architecture analysis: 2026-05-06*
