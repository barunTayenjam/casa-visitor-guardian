<!-- refreshed: 2026-07-16 -->
# Architecture

**Analysis Date:** 2026-07-16

## System Overview

The SentryVision codebase uses a **layered architecture with a microservice for computer vision**. The React SPA frontend communicates with an Express 5 backend via REST API and Socket.io WebSockets. The backend orchestrates a Python OpenCV microservice (Flask) for real-time detection, plus a go2rtc bridge for WebRTC streaming. PostgreSQL is the sole persistent storage.

```text
┌──────────────────────────────────────────────────────────────────────────┐
│                           FRONTEND (React SPA)                           │
│           Browser: Vite dev server / served by backend in prod           │
│  ┌─────────────────┐  ┌──────────────────┐  ┌─────────────────────────┐ │
│  │  Pages (routes)  │  │  Components (UI)  │  │  Contexts (state)       │ │
│  │ `frontend/src/   │  │ `frontend/src/    │  │ `frontend/src/         │ │
│  │  pages/`         │  │  components/`     │  │  contexts/`            │ │
│  └────────┬─────────┘  └────────┬──────────┘  └───────────┬─────────────┘ │
│           │                     │                         │               │
│           └─────────┬───────────┴──────────────┬──────────┘               │
│                     │                          │                          │
│           ┌─────────▼──────────┐    ┌──────────▼──────────┐              │
│           │  API Services       │    │  SocketService       │              │
│           │ `frontend/src/      │    │ `frontend/src/       │              │
│           │  services/api/`     │    │  services/           │              │
│           └─────────┬──────────┘    └──────────┬──────────┘              │
└─────────────────────┼──────────────────────────┼──────────────────────────┘
                      │ REST (fetch)             │ Socket.io (WS)
                      ▼                          ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                       BACKEND (Express 5 + TypeScript)                    │
│                         Port 9753                                          │
│  ┌──────────┐  ┌────────────────┐  ┌────────────┐  ┌───────────────────┐ │
│  │ Routes    │──│  Controllers   │──│  Services   │──│  TypeORM Models   │ │
│  │`server/   │  │ `server/src/   │  │ `server/src/│  │ `server/src/      │ │
│  │src/routes/`│  │ controllers/` │  │  services/` │  │  models/`         │ │
│  └──────────┘  └────────────────┘  └──────┬─────┘  └────────┬──────────┘ │
│                                            │                 │           │
│  ┌──────────┐  ┌──────────────────┐        │                 │           │
│  │Middleware │  │ Stream Manager   │        │                 │           │
│  │`server/   │  │ `server/src/     │────────┘                 │           │
│  │src/middle- │  │  streams/`       │                          │           │
│  │ware/`     │  └────────┬─────────┘                          │           │
│  └──────────┘           │ WS (Python)                        │           │
│                          ▼                                    ▼           │
│  ┌──────────────────────────────────────────────────────────────┐        │
│  │  PythonWsClient `server/src/services/pythonWsClient.ts`      │        │
│  │  WebSocket client ←→ Python OpenCV service (ws://opencv:9090)│        │
│  └──────────────────────────────────────────────────────────────┘        │
└──────────────────────────────────┬───────────────────────────────────────┘
                                   │ HTTP REST (Flask)
                                   ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                  OPENCV MICROSERVICE (Python Flask)                       │
│                     Ports 8084 (REST), 9090 (WS)                         │
│  ┌────────────────┐  ┌───────────────┐  ┌─────────────────────────────┐ │
│  │ YOLO Detector   │  │ MOG2 Motion   │  │ ArcFace Face Recognition   │ │
│  │ (object detect) │  │ (motion gate) │  │ (identity enrichment)      │ │
│  └────────────────┘  └───────────────┘  └─────────────────────────────┘ │
│  ┌────────────────┐  ┌───────────────┐                                  │
│  │ ByteTracker     │  │ WebSocket     │── ws://localhost:9090 ──► Node  │
│  │ (multi-object)  │  │ Publisher     │                                  │
│  └────────────────┘  └───────────────┘                                  │
└──────────────────────────────────────────────────────────────────────────┘
                                   │
                                   ▼
            ┌──────────────────────────────────────────────┐
            │              PostgreSQL 15+                   │
            │  Port 5432 · 27 SQL migrations                │
            │  Tables: events, users, cameras,              │
            │  face_embeddings, notifications, security,    │
            │  detection_cache, batch_jobs, storage_stats   │
            └──────────────────────────────────────────────┘

            ┌──────────────────────────────────────────────┐
            │              go2rtc (RTSP → WebRTC)           │
            │  Port 1984 · Proxied under /go2rtc route      │
            │  WebRTC streaming directly to browser         │
            └──────────────────────────────────────────────┘
```

## Component Responsibilities

| Component | Responsibility | File |
|-----------|----------------|------|
| Frontend App | SPA routing, auth, live streams, events, settings | `frontend/src/App.tsx` |
| AuthContext | Auth state (login/logout/token refresh), React context | `frontend/src/contexts/AuthContext.tsx` |
| SocketContext | Socket.io connection lifecycle | `frontend/src/contexts/SocketContext.tsx` |
| CameraContext | Camera state, stream management | `frontend/src/contexts/CameraContext.tsx` |
| API Services | REST clients (fetch-based, auto-refresh, typed) | `frontend/src/services/api/` |
| SocketService | Socket.io singleton with reconnect + stream mgmt | `frontend/src/services/SocketService.ts` |
| Express Entry | App bootstrap, Socket.io init, middleware, proxy | `server/src/index.ts` |
| Bootstrap | Service initialization, DB, streams, Python WS client | `server/src/bootstrap.ts` |
| ServiceRegistry | Typed DI container for backend services | `server/src/services/serviceRegistry.ts` |
| Routes | Express Router wiring with validation + auth middleware | `server/src/routes/` |
| Controllers | Request handling, delegation to services | `server/src/controllers/` |
| Services | Business logic (detection, review, timeline, notifications, etc.) | `server/src/services/` |
| Models | TypeORM entities (Event, User, etc.) | `server/src/models/` |
| Config | Environment-aware config, camera loading | `server/src/config/index.ts` |
| Database | TypeORM DataSource with pooling | `server/src/database.ts` |
| RTSP Manager | Camera lifecycle, viewer tracking, WebSocket frame relay | `server/src/streams/rtspManager.ts` |
| PythonWsClient | WebSocket client receiving frames/events from Python | `server/src/services/pythonWsClient.ts` |
| OpenCV Backend | Flask app, routes, detection pipeline | `opencv-service/app.py` |
| Pipeline | YOLO init, RTSP service start, motion detection | `opencv-service/pipeline.py` |
| WebSocket Publisher | Python WS server pushing frames + events to Node.js | `opencv-service/rtsp_ingestion/websocket_publisher.py` |
| Database Migrations | SQL migration files (1-27) | `database/migrations/` |

## Pattern Overview

**Overall:** Layered architecture with a sidecar microservice

**Key Characteristics:**
- **MVC in backend**: Routes define HTTP mapping + validation, Controllers handle request/response, Services contain domain logic, Models are TypeORM entities
- **React Context + hooks** for frontend state management (no Redux)
- **Typed ServiceRegistry** as a simple DI container replacing `(global as any)` pattern
- **Singleton services** throughout (cacheService, inMemoryState, serviceRegistry)
- **Event-driven real-time** via Socket.io (server → client push) and EventEmitter (Python WS → Node.js internal)
- **TypeORM with raw SQL fallback** — many database operations use `AppDataSource.query()` directly rather than repository patterns
- **Python detection pipeline** runs as a standalone service communicating over dual channels: HTTP REST (Flask) for on-demand detection, WebSocket (9090) for real-time streaming

## Layers

**Frontend (Presentation):**
- Purpose: SPA rendering, user interaction, live stream display
- Location: `frontend/src/`
- Contains: Pages, Components, Contexts, Services, Hooks
- Depends on: Backend API (REST + Socket.io)
- Key libraries: React 18, React Router v6, TanStack Query, TailwindCSS, Radix UI (shadcn/ui), Recharts, Socket.io-client

**Backend - API Layer (Routes + Controllers):**
- Purpose: HTTP routing, input validation, auth enforcement, response formatting
- Location: `server/src/routes/`, `server/src/controllers/`
- Contains: Route definitions with Zod validation schemas, controller classes extending `BaseController`
- Depends on: Service layer, Middleware
- Auth: JWT with role-based guards (`requireUser`, `requireAdmin`, `optionalAuth`)

**Backend - Service Layer:**
- Purpose: Business logic, orchestration, persistence
- Location: `server/src/services/`
- Contains: DetectionService, ReviewService, TimelineService, NotificationService, cacheService, retentionPolicyService, etc.
- Depends on: TypeORM models, Database, External microservices
- Sub-services organized by domain (`detection/`, `review/`, `timeline/`, `preview/`, `timelapse/`, `nvidia/`, `eventSearch/`)

**Backend - Data Layer (Models + Database):**
- Purpose: ORM entities, database connection, queries
- Location: `server/src/models/`, `server/src/database.ts`
- Contains: 22 TypeORM entities, PostgreSQL DataSource with connection pooling
- Depends on: PostgreSQL 15+

**OpenCV Service (Detection Layer):**
- Purpose: Real-time object detection, motion detection, face recognition, tracking
- Location: `opencv-service/`
- Contains: Flask app, YOLOv8 detector, MOG2 motion detector, ArcFace recognizer, ByteTracker, WebSocket publisher
- Depends on: PostgreSQL (detection cache), Redis (optional), OpenCV DNN modules
- Communication: HTTP REST (Flask endpoints) + WebSocket (frames/events → Node.js)

**Infrastructure Layer:**
- Purpose: Streaming bridge, container orchestration
- Contains: go2rtc (RTSP→WebRTC), Docker Compose (5 services)
- go2rtc is proxied through the Express backend at `/go2rtc`

## Data Flow

### Primary Request Path (REST API)

1. Browser request → Vite proxy (dev) or nginx (prod) → Express 5 (`server/src/index.ts:137`)
2. Express middleware chain: CORS → Helmet → JSON parser → Rate limiter → Auth middleware (`server/src/middleware/auth.ts`)
3. Route handler applies Zod validation (`server/src/middleware/zodValidation.ts`) then delegates to Controller
4. Controller method (extends `BaseController`) calls service method
5. Service performs business logic, queries DB via TypeORM or raw SQL
6. Response flows back: Service → Controller → Express Response (JSON with `{ success: true/false }` envelope)

### Real-time Detection Pipeline

1. Python `FFmpegReader` captures frames from RTSP at 5 FPS, 640×360 (`opencv-service/rtsp_ingestion/ffmpeg_reader.py`)
2. Python `MotionGate` runs MOG2 background subtraction — pixel threshold 500, 10-frame warmup
3. On motion → `YOLOObjectDetector` runs inference (`opencv-service/pipeline.py`, YOLOv8m → YOLOv5n → YOLOv4-tiny fallback)
4. `ByteTracker` assigns persistent track IDs (Kalman filter) (`opencv-service/rtsp_ingestion/byte_tracker.py`)
5. `IdentityEnrichment` runs ArcFace face recognition on new person tracks (`opencv-service/arcface_recognizer.py`)
6. `WebSocketPublisher` sends JPEG frames + JSON tracking events to Node.js via WebSocket (`ws://localhost:9090`) (`opencv-service/rtsp_ingestion/websocket_publisher.py`)
7. Node.js `PythonWsClient` receives and re-emits as Node EventEmitter (`server/src/services/pythonWsClient.ts`)
8. `rtspManager.wirePythonWsFrames()` relays frames to Socket.io rooms with adaptive FPS by viewer count (`server/src/streams/rtspManager.ts:89`)
9. `bootstrap.ts` listens for `trackingEvent` and persists events to PostgreSQL, emits Socket.io events (`personDetected`, `faceDetected`, `motionDetected`)
10. Frontend `SocketContext` / `SocketService` receives events and updates React state

### On-demand Detection (REST)

1. Frontend sends image → Backend `opencvMicroserviceClient` POSTs to Flask (`server/src/services/opencvMicroserviceClient.ts`)
2. Flask routes (`opencv-service/routes/detection.py`) process via YOLO + ArcFace
3. Results returned as JSON, cached in PostgreSQL + Redis detection cache

### Camera Stream Viewing

1. Frontend requests stream via Socket.io `requestStream` event (`frontend/src/services/SocketService.ts:147`)
2. Backend `rtspManager.setupConnectionTracking()` adds viewer to room (`server/src/streams/rtspManager.ts:166`)
3. Python WS client subscribes to camera's frame queue if not already active
4. Frames flow: Camera → FFmpeg → YOLO pipeline → WebSocket Publisher → PythonWsClient → rtspManager → Socket.io → Browser
5. Adaptive FPS: 4 FPS (≤3 viewers), 3 FPS (≤10), 2 FPS (≤20), 1 FPS (>20) (`server/src/streams/rtspManager.ts:236`)
6. 30s debounced unsubscribe when viewers disconnect (`server/src/streams/rtspManager.ts:62`)

**State Management:**
- Frontend: React Context (Auth, Camera, Socket) + `useReducer` (AuthContext) + TanStack Query cache
- Backend: In-memory state (`InMemoryStateService.ts`), Redis/memory cache (`CacheService.ts`), PostgreSQL persistence
- No Redux — state is distributed across contexts

## Key Abstractions

| Abstraction | Location | Purpose |
|-------------|----------|---------|
| `BaseController` | `server/src/controllers/BaseController.ts` | Generic HTTP response helpers (`ok`, `created`, `badRequest`, `notFound`, `serverError`) — all controllers extend this |
| `ServiceRegistry` | `server/src/services/serviceRegistry.ts` | Typed DI container with fail-fast getters — replaces global singleton pattern |
| `StreamManager` | `server/src/streams/rtspManager.ts` | Camera lifecycle, viewer tracking, adaptive FPS, frame relay — central streaming orchestrator |
| `PythonWsClient` | `server/src/services/pythonWsClient.ts` | EventEmitter-based WebSocket client reconnecting to Python, parses binary frame protocol |
| `CacheService` | `server/src/services/cacheService.ts` | Redis-first with in-memory fallback, TTL-based expiry, rate limiting helpers |
| `InMemoryStateService` | `server/src/services/inMemoryStateService.ts` | Recent events ring buffer, alert CRUD, system settings cache |
| `OpenCVMicroserviceClient` | `server/src/services/opencvMicroserviceClient.ts` | Axios HTTP client to Flask, health checks, detection + face recognition endpoints |
| `AuthContext` | `frontend/src/contexts/AuthContext.tsx` | `useReducer`-based auth with token refresh, MFA support, session management |
| `SocketService` | `frontend/src/services/SocketService.ts` | Singleton Socket.io client with reconnection, stream lifecycle, typed event helpers |
| `apiClient` | `frontend/src/services/api/baseClient.ts` | Fetch-based REST client with auto-refresh on 401, retry logic, typed error classes |
| `config (AppConfig)` | `server/src/config/index.ts` | Central config object loaded from env, cameras, pipeline mode — single source of truth |

## Entry Points

| Entry Point | Path | Purpose |
|-------------|------|---------|
| Frontend entry | `frontend/src/main.tsx` | React root mount, global error handlers, theme init, service worker |
| Frontend App | `frontend/src/App.tsx` | Router hierarchy, provider wrapping (Auth/Socket/Camera), lazy-loaded routes |
| Backend entry | `server/src/index.ts` | Express app creation, middleware, Socket.io init, SPA fallback |
| Backend bootstrap | `server/src/bootstrap.ts` | All service initialization: DB, cameras, Python WS, stream manager, cron jobs, notifications |
| OpenCV Flask app | `opencv-service/app.py` | Flask server, blueprint registration, pipeline init |
| go2rtc | `go2rtc.yaml` + `go2rtc-entrypoint.sh` | RTSP to WebRTC bridge, separate container |

## Architectural Constraints

- **Threading:** Node.js single-threaded event loop; Python uses `threaded=True` in Flask; OpenCV pipeline uses `asyncio` for WebSocket publisher + per-camera threads for FFmpeg reads
- **Global state:** `serviceRegistry` (singleton Map), `cacheService`, `inMemoryState`, `streamManager` — all module-level singletons in the backend. In Python, `state.py` is a global module for detector/recognizer/cache instances
- **Pipeline mode:** Backend supports `legacy`, `dual`, or `python-only` detection modes via `PIPELINE_MODE` env var. In `python-only` mode, all detection is delegated to the Python microservice
- **No Pub/Sub:** There is no message queue — real-time events flow through Socket.io directly and through PythonWsClient EventEmitter internally
- **WebSocket binary protocol:** Python → Node.js frames use a two-message pattern: text metadata JSON first, then binary JPEG bytes
- **Data directory structure:** Detections stored under `data/detections/YYYY-MM/events/{motion,faces}/`, snapshots in `data/detections/YYYY-MM/snapshots/` — all date-partitioned

## Anti-Patterns

### Mixed ORM / Raw SQL

**What happens:** Many backend operations use `AppDataSource.query()` directly with raw SQL strings instead of TypeORM repositories. For example, `AuthController.ts` mixes repository patterns with inline SQL queries extensively.
**Why it's wrong:** Bypasses TypeORM's type safety, migration tracking, and query building. Raw SQL strings with parameter interpolation are error-prone.
**Do this instead:** Use TypeORM repositories (`AppDataSource.getRepository(Entity)`) with QueryBuilder for complex queries. Reserve raw SQL for truly optimized bulk operations that QueryBuilder cannot express.

### Global Module-Level Mutable State

**What happens:** Backend uses multiple singleton modules (`serviceRegistry`, `cacheService`, `inMemoryState`, `streamManager`) that are stateful and mutated during initialization.
**Files:** `server/src/services/serviceRegistry.ts`, `server/src/services/cacheService.ts`, `server/src/services/inMemoryStateService.ts`, `server/src/streams/rtspManager.ts`
**Why it's wrong:** Creates implicit initialization dependencies — order matters across files. Testing requires careful reset. Hard to reason about state at any point.
**Do this instead:** The `ServiceRegistry` already improves on the prior `(global as any)` pattern. Complete the migration by making service initialization explicit and supporting lifecycle hooks for testability.

### Large Bootstrap Function

**What happens:** `server/src/bootstrap.ts` is 448 lines handling DB init, camera loading, Python WS client wiring, service construction, and cron job startup in a single function.
**Why it's wrong:** Hard to test, hard to reason about dependency order, mixing concerns (DB + networking + service construction).
**Do this instead:** Split into focused initializers (e.g., `DatabaseInitializer`, `CameraInitializer`, `StreamInitializer`) registered with `ServiceRegistry`.

## Error Handling

**Strategy:** Consistent `{ success: true/false, error?: string }` response envelope across all API endpoints. Controllers catch errors via try/catch and call `this.serverError(res, error)`.

**Patterns:**
- `BaseController` provides typed response helpers — all controllers use these
- `AuthController` adds `auditLogger.log()` calls before success/error responses
- Frontend `fetchWithRetry` implements automatic retry (3 attempts) with exponential backoff, plus auto-refresh on 401
- Unhandled promise rejections caught at `server/src/index.ts:131` and `frontend/src/main.tsx:12`
- Python WS client has silence monitoring + auto-reconnect with exponential backoff (1s → 30s max)

## Cross-Cutting Concerns

**Logging:** Custom `logger` module (`server/src/utils/logger.ts`) with configurable levels, file rotation (10MB max, 5 files), console output, and optional database logging. Uses `originalConsole*` to avoid recursion.

**Validation:** Zod schemas in `server/src/routes/auth.ts` and `server/src/middleware/zodValidation.ts`. Backend routes use `validateBody(schema)` middleware.

**Authentication:** JWT-based with access tokens (24h expiry) and auto-refresh support. Role-based guards (`requireAdmin`, `requireUser`, `optionalAuth`). Session tracking in `user_sessions` table. MFA via TOTP (speakeasy + QR codes).

**Authorization:** Three roles: `admin`, `user`, `viewer`. Admin required for user registration, system maintenance, and configuration. Optional auth used for snapshot/stream access.

**Rate Limiting:** `EnhancedRateLimit` middleware (`server/src/middleware/enhancedRateLimit.ts`) with separate sliders for auth, MFA, and general API.

**Audit:** `AuditLogger` (`server/src/utils/auditLogger.ts`) logs auth events (login, register, MFA, password changes) with IP, user agent, and success/failure. Written to `audit_logs` table.

**CORS:** Configured per-environment — `true` (allow all) in dev, explicit origins list in production via `CORS_ORIGIN` env var.

---

*Architecture analysis: 2026-07-16*
