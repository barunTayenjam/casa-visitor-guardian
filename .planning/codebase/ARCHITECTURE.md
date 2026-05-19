<!-- refreshed: 2026-05-15 -->
# Architecture

**Analysis Date:** 2026-05-15

## System Overview

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                         Frontend (React/TypeScript)                         │
│                         `frontend/src/`                                     │
├──────────────────┬───────────────────┬──────────────────┬───────────────────┤
│  Pages (Routes)  │  Contexts (State) │ Services (API)   │ Components (UI)   │
│  `pages/*.tsx`   │ `contexts/*.tsx`  │ `services/*.ts`  │ `components/*/`   │
├──────────────────┴───────────────────┴──────────────────┴───────────────────┤
│  React Router v6   │  React Query + Context API  │  Socket.io Client       │
└───────────┬────────────────────────┬─────────────────────┬──────────────────┘
            │ HTTP /api              │                     │ WebSocket
            ▼                        │                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                     Backend (Express/TypeScript)                            │
│                     `server/src/`                                           │
├──────────────────┬───────────────────┬──────────────────┬───────────────────┤
│   Routes (API)   │  Middleware       │  Services (Logic)│ Detection Engine  │
│  `routes/*.ts`   │ `middleware/*.ts` │ `services/*/`    │ `detection/*.ts`  │
├──────────────────┴───────────────────┴──────────────────┴───────────────────┤
│  Socket.io Server   │  TypeORM   │  FFmpeg/RTSP   │  EventBus (singleton)  │
└───────────┬────────────────────────┬─────────────────────┬──────────────────┘
            │ SQL                    │ HTTP                │ FFmpeg RTSP
            ▼                        ▼                     ▼
┌───────────────────┐  ┌──────────────────────┐  ┌──────────────────────┐
│  PostgreSQL 15+   │  │  OpenCV Service       │  │  RTSP Cameras        │
│  Port 5432        │  │  (Python/Flask)       │  │  (IP Cameras)        │
│  TypeORM entities │  │  Port 8084            │  │  RTSP streams        │
│  `server/models/` │  │  `opencv-service/`    │  │  `cameras.json`      │
└───────────────────┘  └──────────────────────┘  └──────────────────────┘
                                │
                       ┌────────┴────────┐
                       │  Redis (6379)    │
                       │  Detection cache │
                       └─────────────────┘
```

## Component Responsibilities

| Component | Responsibility | File |
|-----------|----------------|------|
| `index.ts` (server) | Application bootstrap, service initialization, Socket.io setup | `server/src/index.ts` |
| `rtspManager.ts` | FFmpeg process management, camera stream lifecycle, frame distribution | `server/src/streams/rtspManager.ts` |
| `optimizedMotionDetection.ts` | Primary motion detection with adaptive sensitivity, zone-based detection | `server/src/detection/optimizedMotionDetection.ts` |
| `motionTriggeredDetection.ts` | Triggers object/face detection pipeline on motion events | `server/src/detection/motionTriggeredDetection.ts` |
| `consolidatedDetectionService.ts` | HTTP client to OpenCV service, Redis cache, circuit breaker | `server/src/detection/consolidatedDetectionService.ts` |
| `eventBus.ts` | Singleton EventEmitter for cross-service communication | `server/src/events/eventBus.ts` |
| `baseService.ts` | Abstract base class for services with EventBus integration | `server/src/services/baseService.ts` |
| `App.tsx` (frontend) | Root React component, route definitions, provider nesting | `frontend/src/App.tsx` |
| `ApiService.ts` | Centralized HTTP client for all backend API calls | `frontend/src/services/ApiService.ts` |
| `SocketService.ts` | Socket.io client singleton, stream management, event handling | `frontend/src/services/SocketService.ts` |
| `AuthContext.tsx` | JWT auth state management (login, register, token refresh) | `frontend/src/contexts/AuthContext.tsx` |
| `CameraContext.tsx` | Camera list state, stream control, motion event handling | `frontend/src/contexts/CameraContext.tsx` |
| `SocketContext.tsx` | WebSocket connection lifecycle management | `frontend/src/contexts/SocketContext.tsx` |
| `app.py` (OpenCV) | Flask HTTP service for YOLO object detection, face recognition, MOG2 motion detection | `opencv-service/app.py` |
| `database.ts` | TypeORM DataSource initialization, entity loading | `server/src/database.ts` |
| `config/index.ts` | Centralized configuration from env vars and `cameras.json` | `server/src/config/index.ts` |

## Pattern Overview

**Overall:** Layered service-oriented architecture with event-driven communication

**Key Characteristics:**
- **Global singleton services**: Backend initializes services and stores them on `(global as any)` — e.g., `(global as any).streamManager`, `(global as any).reviewService`
- **Event-driven**: `EventBus` singleton (`server/src/events/eventBus.ts`) with typed events for cross-service communication; `BaseService` abstract class at `server/src/services/baseService.ts`
- **Lazy-loaded frontend routes**: All pages loaded via `React.lazy()` in `frontend/src/App.tsx`
- **Context-based state**: React Context API for auth, cameras, socket; React Query for server state
- **HTTP proxy pattern**: Frontend proxies `/api` to backend via Vite config (dev) or nginx (prod)

## Layers

**Presentation Layer (Frontend):**
- Purpose: User interface, camera streaming, event visualization, analytics
- Location: `frontend/src/`
- Contains: React pages, components, contexts, services, types
- Depends on: Backend API (HTTP), Backend Socket.io (WebSocket)
- Used by: End users (browser)

**API Layer (Backend Routes):**
- Purpose: HTTP endpoint definitions, request validation, response formatting
- Location: `server/src/routes/`
- Contains: Express route handlers, endpoint tests
- Depends on: Services, middleware, models
- Used by: Frontend API calls, external consumers

**Service Layer (Backend Business Logic):**
- Purpose: Core business logic, orchestration, cross-cutting concerns
- Location: `server/src/services/`
- Contains: Domain services with sub-directories (`detection/`, `review/`, `timeline/`, `preview/`)
- Depends on: Models, database, EventBus, external services
- Used by: Routes, other services

**Detection Layer (Backend Computer Vision Pipeline):**
- Purpose: Motion detection, object detection coordination, face recognition triggering
- Location: `server/src/detection/`
- Contains: Motion detection algorithms, consolidated detection service (OpenCV client)
- Depends on: OpenCV service (HTTP), streams, config
- Used by: Routes, stream manager, batch processing

**Stream Layer (Backend RTSP Management):**
- Purpose: FFmpeg process lifecycle, frame extraction, adaptive streaming, viewer tracking
- Location: `server/src/streams/`
- Contains: `rtspManager.ts` (stream orchestrator), `streamHealthMonitor.ts`
- Depends on: Config, FFmpeg binary, detection layer, Socket.io server
- Used by: Routes, detection layer, Socket.io handlers

**Data Access Layer (Backend Models + Database):**
- Purpose: TypeORM entity definitions, database connection
- Location: `server/src/models/`, `server/src/database.ts`
- Contains: Entity classes, model barrel exports
- Depends on: TypeORM, PostgreSQL
- Used by: Services, routes

**Computer Vision Service (Python/OpenCV):**
- Purpose: YOLO object detection, face recognition, motion detection using MOG2
- Location: `opencv-service/`
- Contains: Flask app, face recognition module, ML models
- Depends on: PostgreSQL, Redis, OpenCV, YOLO weights
- Used by: Backend detection service (HTTP on port 8084)

**Database Layer (Migrations):**
- Purpose: Schema evolution, table creation, data migrations
- Location: `database/migrations/`
- Contains: Numbered SQL migration files (001-017)
- Depends on: PostgreSQL
- Used by: Deployment/initialization

## Data Flow

### Primary Request Path — Live Camera Streaming

1. User opens `/app/streams` → `StreamDashboard.new.tsx` renders (`frontend/src/pages/StreamDashboard.new.tsx`)
2. `CameraContext` fetches camera list via `ApiService.getCameras()` (`frontend/src/contexts/CameraContext.tsx`)
3. `AdaptiveCameraGrid` renders `StreamPanel` per camera (`frontend/src/components/live/AdaptiveCameraGrid.tsx`)
4. `StreamPanel` calls `socketService.requestStream(cameraId)` → emits `requestStream` event (`frontend/src/components/live/StreamPanel.tsx`)
5. Backend Socket.io handler receives → `streamManager.startStream(cameraId, role)` (`server/src/index.ts:563`)
6. `StreamManager` spawns FFmpeg process for RTSP URL from `cameras.json` (`server/src/streams/rtspManager.ts`)
7. FFmpeg extracts JPEG frames → `StreamManager` emits frames via `io.to()` to room `camera-{id}-{role}` (`server/src/streams/rtspManager.ts`)
8. Frontend `SocketService` receives `frame` event → `CameraStream` component displays JPEG blob (`frontend/src/components/dashboard/CameraStream.tsx`)

### Motion Detection Flow

1. `StreamManager` captures frames from FFmpeg → passes to `OptimizedMotionDetector` (`server/src/detection/optimizedMotionDetection.ts`)
2. Motion detector uses adaptive sensitivity, zone filtering, cooldown periods
3. On motion detected → triggers `motionTriggeredDetection` pipeline (`server/src/detection/motionTriggeredDetection.ts`)
4. `motionTriggeredDetection` sends frame to `consolidatedDetectionService` (`server/src/detection/consolidatedDetectionService.ts`)
5. `consolidatedDetectionService` checks Redis cache → HTTP POST to OpenCV service at `http://opencv:8084/detect` (`server/src/detection/consolidatedDetectionService.ts`)
6. OpenCV service runs YOLO object detection + face recognition → returns results (`opencv-service/app.py`)
7. Results cached in Redis (5 min TTL) → returned to `motionTriggeredDetection`
8. Event saved to PostgreSQL via TypeORM `Event` entity → Socket.io notifies frontend (`server/src/detection/motionTriggeredDetection.ts`)
9. Frontend `CameraContext` receives `motionDetected` socket event → updates state (`frontend/src/contexts/CameraContext.tsx`)

### Authentication Flow

1. User submits login form → `AuthContext.login()` calls `ApiService.login()` (`frontend/src/contexts/AuthContext.tsx`)
2. Frontend sends `POST /api/auth/login` with credentials (`frontend/src/services/ApiService.ts`)
3. Backend `auth.ts` route handler validates via `authService.login()` (`server/src/routes/auth.ts`)
4. `AuthService` verifies bcrypt password, generates JWT access token + refresh token (`server/src/auth/index.ts`)
5. Frontend stores access token in `localStorage` → sets `Authorization: Bearer` header (`frontend/src/contexts/AuthContext.tsx`)
6. Subsequent API calls pass through `auth.ts` middleware → `authenticate()` verifies JWT (`server/src/middleware/auth.ts`)

**State Management:**
- Frontend: React Context for auth/camera/socket state; React Query for server state; localStorage for JWT persistence
- Backend: In-memory for `recentEvents`, `alerts`; PostgreSQL for persistent entities; Redis for detection cache; `(global as any)` for service singletons

## Key Abstractions

**`BaseService` abstract class:**
- Purpose: Provides structured logging, EventBus integration, and typed event emission for all backend services
- Examples: `server/src/services/baseService.ts`
- Pattern: Abstract class with `setupEventHandlers()` contract; all services extending it get EventBus singleton access

**`StreamManager` singleton:**
- Purpose: Central orchestrator for all RTSP camera streams, manages FFmpeg processes and viewer counts
- Examples: `server/src/streams/rtspManager.ts`
- Pattern: Class instantiated once in `setupRTSPStreams()`, stored globally; manages `Map<string, Camera>` with per-camera FFmpeg processes

**`EventBus` singleton:**
- Purpose: Application-wide event distribution for decoupled service communication
- Examples: `server/src/events/eventBus.ts`
- Pattern: Node.js `EventEmitter` with queue-based processing, max 1000 events, batch size 50

**Context Provider pattern (Frontend):**
- Purpose: Global state management for cross-cutting concerns
- Examples: `frontend/src/contexts/AuthContext.tsx`, `frontend/src/contexts/CameraContext.tsx`, `frontend/src/contexts/SocketContext.tsx`
- Pattern: React Context + `useReducer` (auth) or `useState` (camera, socket); provider components wrap app in `App.tsx`

**Service singleton pattern (Backend):**
- Purpose: Single-instance services stored on `global` object for cross-module access
- Examples: `(global as any).streamManager`, `(global as any).reviewService`, `(global as any).detectionService`
- Pattern: Services initialized in `initializeServices()` function in `server/src/index.ts:497`, accessed via `(global as any).serviceName`

## Entry Points

**Frontend entry point:**
- Location: `frontend/src/main.tsx`
- Triggers: Browser loads page
- Responsibilities: Creates React root, applies theme, sets up global error handlers, renders `<App />`

**Backend entry point:**
- Location: `server/src/index.ts`
- Triggers: `node dist/index.js` or `npm run dev`
- Responsibilities: Creates Express app + HTTP server, configures Socket.io, registers routes, calls `initializeServices()`, starts listening

**OpenCV service entry point:**
- Location: `opencv-service/app.py`
- Triggers: `python app.py` or Docker container start
- Responsibilities: Flask app on port 8084, initializes PostgreSQL connection pool, loads YOLO models

**Database migration runner:**
- Location: `database/run-migrations.ts`
- Triggers: `npm run migrate` in `database/` directory
- Responsibilities: Executes SQL migration files against PostgreSQL

## Architectural Constraints

- **Threading:** Node.js single-threaded event loop; FFmpeg processes spawned as `child_process` (separate OS processes); Python OpenCV service runs independently with Flask's threaded mode
- **Global state:** Backend uses `(global as any)` for service singletons — `streamManager`, `reviewService`, `timelineService`, `detectionService`, `detectionConfigService`, `notificationService`, `storageStatsService`, `retentionPolicyService`, `automatedCleanupService`, `motionDetector`, `AppDataSource` — all set in `server/src/index.ts:497-556`
- **Circular imports:** `server/src/models/index.ts` explicitly documents that `UserSession` must be exported before `User` to avoid circular dependency
- **Database synchronization:** TypeORM `synchronize: false` enforced — schema changes require explicit migration files
- **Camera configuration:** Loaded from `cameras.json` or `CAMERAS` env var at startup; supports encrypted RTSP credentials via `credentialEncryption.ts`

## Anti-Patterns

### Global Service Registry

**What happens:** Services are stored on `(global as any)` and accessed by string key throughout the codebase (e.g., `(global as any).reviewService`)
**Why it's wrong:** No type safety, implicit dependencies, difficult to test, easy to typo service names
**Do this instead:** Use a typed service container or dependency injection; at minimum, create a typed `ServiceRegistry` interface in a central location

### Monolithic Route File

**What happens:** `server/src/routes/index.ts` is 4,073 lines containing dozens of endpoints, inline business logic, and route definitions
**Why it's wrong:** Difficult to navigate, high merge conflict risk, mixes HTTP concerns with business logic
**Do this instead:** Extract domain-specific route modules (like `visitorRoutes.ts`, `auth.ts`) and keep `index.ts` as a registration-only file; move inline endpoint handlers from `server/src/index.ts` (lines 341-487) into route modules

### Inline Routes in Entry Point

**What happens:** Review, timeline, and detection config endpoints are defined directly in `server/src/index.ts` (lines 341-487) instead of in route files
**Why it's wrong:** Entry point should only bootstrap; endpoint logic scattered across files makes API surface hard to discover
**Do this instead:** Move all endpoint definitions to dedicated files in `server/src/routes/`; keep `index.ts` focused on server setup and initialization

## Error Handling

**Strategy:** Multi-layer error handling with graceful degradation

**Patterns:**
- Frontend: `ErrorBoundary` component wraps all routes (`frontend/src/components/ErrorBoundary.tsx`); `ApiError`/`NetworkError`/`TimeoutError` custom error classes in `frontend/src/services/ApiService.ts`
- Backend: try-catch in route handlers returning `{ success: false, error: string }`; `EventBus` error handling with queue overflow protection; circuit breaker for OpenCV service calls (`server/src/services/circuitBreaker.ts`)
- Graceful shutdown: SIGTERM/SIGINT handlers in `server/src/index.ts:636-682` with 10s timeout, sequential cleanup of stream manager → motion detection → detection service → cleanup service → Socket.io → database

## Cross-Cutting Concerns

**Logging:** Custom `logger` utility in `server/src/utils/logger.ts` with component-based tagging; frontend logger in `frontend/src/lib/logger.ts`; `auditLogger` for security events in `server/src/utils/auditLogger.ts`
**Validation:** Zod schemas via `validation.ts` middleware (`server/src/middleware/validation.ts`); `commonSchemas` for reusable validations; camera ID regex validation
**Authentication:** JWT middleware in `server/src/middleware/auth.ts` with role-based guards (`requireUser`, `requireAdmin`, `optionalAuth`); rate limiting in `server/src/middleware/rateLimit.ts` and `enhancedRateLimit.ts`
**Security Headers:** Helmet.js applied globally; CORS configured for specific origins
**File Storage:** Date-partitioned directory structure (`YYYY-MM/events/{motion,faces}/`); configured via `getDetectionsPath()` and `getEventPath()` in `server/src/config/index.ts`

---

*Architecture analysis: 2026-05-15*
