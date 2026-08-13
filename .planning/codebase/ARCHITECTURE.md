<!-- refreshed: 2026-08-13 -->
# Architecture

**Analysis Date:** 2026-08-13

## System Overview

```text
┌─────────────────────────────────────────────────────────────┐
│                      Client (Frontend)                      │
│         `frontend/src/` (React, Vite, Socket.io)            │
├──────────────────┬──────────────────┬───────────────────────┤
│    Dashboard     │  Event Search    │      Live Stream      │
│ `pages/Dashboard`│ `pages/EventsPage`│ `pages/StreamDashboard`│
└────────┬─────────┴────────┬─────────┴──────────┬────────────┘
         │                  │                    │
         ▼                  ▼                    ▼
┌─────────────────────────────────────────────────────────────┐
│                      API Gateway/Server                     │
│               `server/src/` (Express, Node.js)              │
│  [Routes] `server/src/routes/` → [Controllers] `server/src/controllers/`
└─────────────────────────────────────────────────────────────┘
         │                  │                    │
         ▼                  ▼                    ▼
┌─────────────────────────────────────────────────────────────┐
│                 Services / Business Logic                   │
│   [Services] `server/src/services/` (Registry pattern)      │
│   [Detection] `server/src/detection/` (Processing)          │
│   [Streams] `server/src/streams/` (RTSP/Socket.io)          │
└─────────────────────────────────────────────────────────────┘
         │                  │
         ▼                  ▼
┌─────────────────────────────────────────────────────────────┐
│                 Data / External Storage                     │
│  [Postgres] `database/` (TypeORM)                           │
│  [Filesystem] `data/` (Snapshots, Detections, Events)       │
└─────────────────────────────────────────────────────────────┘
```

## Component Responsibilities

| Component | Responsibility | File |
|-----------|----------------|------|
| Streaming | RTSP ingestion, framing, socket streaming | `server/src/streams/rtspManager.ts` |
| Detection | Object/Face detection logic orchestration | `server/src/detection/consolidatedDetectionService.ts` |
| API | Route handling, auth, validation | `server/src/routes/index.ts` |
| Database | Persistence layer (Postgres/TypeORM) | `server/src/database.js` |
| Service Registry| Dependency injection/service management | `server/src/services/serviceRegistry.ts` |

## Pattern Overview

**Overall:** Modular Monolith / Service-Oriented (within server)

**Key Characteristics:**
- Controller-Service-Repository pattern on backend
- Centralized Service Registry to avoid global singleton/circular dependencies
- WebSocket-based communication between Python detection service and Node backend

## Layers

**API Layer:**
- Purpose: HTTP request handling, validation, routing
- Location: `server/src/routes/`, `server/src/controllers/`
- Contains: Express routes, request validation, controller logic
- Depends on: Services, Models, Middleware

**Service Layer:**
- Purpose: Orchestrate business logic, interact with external systems
- Location: `server/src/services/`
- Contains: Business services, clients (Python, Notification)
- Depends on: Repository layer, Database

**Persistence/Data Layer:**
- Purpose: Database schemas, migrations, filesystem interaction
- Location: `server/src/models/`, `database/`, `data/`
- Contains: TypeORM entities, DB migrations, file management logic

## Data Flow

### Primary Detection Path

1. RTSP Stream (`server/src/streams/rtspManager.ts`)
2. Python Pipeline (External) → `PythonWsClient` (`server/src/services/pythonWsClient.ts`)
3. Detection Service processes & persists (`server/src/detection/consolidatedDetectionService.ts`)
4. Event broadcast via `socket.io` (`server/src/index.ts`)

**State Management:**
- `inMemoryStateService.ts` for real-time alert state
- Postgres for historical events and configuration

## Key Abstractions

**`ServiceRegistry` (`server/src/services/serviceRegistry.ts`):**
- Purpose: Holds all initialized business services (Streams, Detection, etc)
- Pattern: Singleton container with type-safe accessors

## Entry Points

**Server:**
- Location: `server/src/index.ts`
- Triggers: Startup/Systemd
- Responsibilities: Server config, route registration, graceful shutdown

**Frontend:**
- Location: `frontend/src/main.tsx`
- Triggers: Browser loading
- Responsibilities: React app bootstrap, providers, routing

## Architectural Constraints

- **Threading:** Single-threaded Node.js server (event loop). CPU-intensive tasks (OpenCV/Python) offloaded to external microservice.
- **Global state:** Minimally used via `serviceRegistry.ts`
- **Data storage:** Mixed storage — structured data in Postgres, unstructured media (snapshots/events) on local filesystem.

## Error Handling

**Strategy:** Express middleware for API errors; custom `logger` for backend; React `ErrorBoundary` for frontend.

**Patterns:**
- `gracefulShutdown` in `server/src/bootstrap.ts` ensures connections closed on SIGTERM.
- `fail-fast` in `serviceRegistry.ts` getters for missing initialized services.

## Cross-Cutting Concerns

**Logging:** Centralized `server/src/utils/logger.js`.
**Validation:** `zod` used for request validation (`server/src/middleware/zodValidation.ts`).
**Authentication:** `authService` and `auth` middleware (`server/src/auth/`, `server/src/middleware/auth.ts`).

---

*Architecture analysis: 2026-08-13*
