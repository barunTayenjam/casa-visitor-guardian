# Codebase Structure

**Analysis Date:** 2026-07-16

## Directory Layout

```
sentryvision/
├── frontend/                     # React SPA (Vite + TypeScript + TailwindCSS)
│   ├── src/
│   │   ├── main.tsx              # React entry: root mount, error handlers
│   │   ├── App.tsx               # Router, providers, lazy-loaded routes
│   │   ├── index.css             # Global styles
│   │   ├── pages/                # Route-level page components
│   │   ├── components/           # Reusable UI components
│   │   │   ├── live/             # Camera streaming components
│   │   │   ├── events/           # Event detail, timeline, filters
│   │   │   ├── layout/           # App shell, bottom nav (MacDock)
│   │   │   ├── settings/         # Motion detection, optimization
│   │   │   ├── ui/               # shadcn/ui primitives (Radix)
│   │   │   ├── dashboard/        # Dashboard widgets
│   │   │   ├── detection/        # Detection UI (empty)
│   │   │   └── analytics/        # Analytics components (empty)
│   │   ├── services/
│   │   │   ├── api/              # REST service clients (fetch-based)
│   │   │   └── SocketService.ts  # Socket.io client singleton
│   │   ├── contexts/             # React contexts (Auth, Camera, Socket)
│   │   ├── hooks/                # Custom hooks (use-toast, useViewportStream)
│   │   ├── lib/                  # Utilities (logger, theme, cn())
│   │   ├── types/                # TypeScript types
│   │   ├── styles/               # Design tokens
│   │   ├── __mocks__/            # Jest mocks
│   │   └── __tests__/            # Additional test files
│   ├── public/                   # Static assets
│   ├── vite.config.ts            # Vite config + dev proxy
│   ├── tailwind.config.ts        # TailwindCSS configuration
│   ├── postcss.config.js         # PostCSS configuration
│   ├── eslint.config.js          # ESLint flat config
│   ├── jest.config.ts            # Jest configuration
│   ├── tsconfig.json             # TypeScript project config
│   ├── components.json           # shadcn/ui config
│   └── Dockerfile                # Frontend Docker image
│
├── server/                       # Express 5 backend (TypeScript + TypeORM)
│   ├── src/
│   │   ├── index.ts              # Express entry: app, routes, Socket.io
│   │   ├── bootstrap.ts          # Service initialization orchestrator
│   │   ├── database.ts           # TypeORM DataSource + connection pool
│   │   ├── controllers/          # Request handlers (MVC pattern)
│   │   │   ├── BaseController.ts # Shared HTTP response helpers
│   │   │   ├── AuthController.ts # Login, register, MFA
│   │   │   ├── CameraController.ts
│   │   │   ├── StreamController.ts
│   │   │   ├── EventController.ts
│   │   │   ├── DetectionController.ts
│   │   │   ├── AnalyticsController.ts
│   │   │   ├── SettingsController.ts
│   │   │   ├── SystemController.ts
│   │   │   ├── ReviewController.ts
│   │   │   ├── AlertController.ts
│   │   │   └── NvidiaController.ts
│   │   ├── routes/               # Express Router definitions
│   │   │   ├── index.ts          # Mount all routes, non-standard paths
│   │   │   ├── auth.ts           # /api/auth/*
│   │   │   ├── cameras.ts        # /api/cameras/*
│   │   │   ├── streams.ts        # /api/streams/*
│   │   │   ├── events.ts         # /api/events/*
│   │   │   ├── event-search.ts   # /api/events/search
│   │   │   ├── analytics.ts      # /api/analytics/*
│   │   │   ├── settings.ts       # /api/settings/*
│   │   │   ├── alerts.ts         # /api/alerts/*
│   │   │   ├── motion.ts         # /api/motion/*
│   │   │   ├── nvidiaRoutes.ts   # /api/nvidia/*
│   │   │   ├── notificationRoutes.ts
│   │   │   ├── detectionRoutes.ts
│   │   │   ├── detectionRedoRoutes.ts
│   │   │   ├── detection-operations.ts
│   │   │   ├── highlights.ts     # /api/highlights/*
│   │   │   ├── timelapse.ts      # /api/timelapse/*
│   │   │   ├── review.ts         # Review routes
│   │   │   ├── faceConfigRoutes.ts
│   │   │   ├── faceEmbeddingRoutes.ts
│   │   │   ├── visitorRoutes.ts
│   │   │   └── staticRoutes.ts   # Static file serving
│   │   ├── services/             # Business logic
│   │   │   ├── serviceRegistry.ts # Typed DI container
│   │   │   ├── pythonWsClient.ts # WebSocket client → Python
│   │   │   ├── opencvMicroserviceClient.ts # HTTP client → Python Flask
│   │   │   ├── cacheService.ts   # Redis + in-memory cache
│   │   │   ├── inMemoryStateService.ts # In-memory events/alerts/settings
│   │   │   ├── notificationService.ts
│   │   │   ├── retentionPolicyService.ts
│   │   │   ├── automatedCleanupService.ts
│   │   │   ├── credentialEncryption.ts
│   │   │   ├── batchProcessingWorker.ts
│   │   │   ├── batchProcessingDatabasePostgres.ts
│   │   │   ├── eventSearchService.ts
│   │   │   ├── visitorService.ts
│   │   │   ├── circuitBreaker.ts
│   │   │   ├── retryService.ts
│   │   │   ├── imageFileService.ts
│   │   │   ├── detection/        # Detection sub-services
│   │   │   ├── review/           # Review sub-services
│   │   │   ├── timeline/         # Timeline sub-services
│   │   │   ├── preview/          # Preview sub-services
│   │   │   ├── timelapse/        # Timelapse sub-services
│   │   │   ├── nvidia/           # NVIDIA AI integration
│   │   │   └── eventSearch/      # Event search sub-services
│   │   ├── models/               # TypeORM entities (22 entities)
│   │   ├── middleware/            # Express middleware
│   │   │   ├── auth.ts           # JWT verification + role guards
│   │   │   ├── validation.ts     # Zod validation middleware
│   │   │   ├── zodValidation.ts  # Standalone Zod body validator
│   │   │   └── enhancedRateLimit.ts # Rate limiting
│   │   ├── streams/              # Streaming orchestration
│   │   │   ├── rtspManager.ts    # Camera lifecycle, frame relay
│   │   │   └── streamHealthMonitor.ts
│   │   ├── detection/            # Detection types + cleanup
│   │   │   ├── consolidatedDetectionService.ts
│   │   │   └── cleanupService.ts
│   │   ├── config/               # Environment configuration
│   │   │   └── index.ts          # Central AppConfig object
│   │   ├── types/                # Shared TypeScript types
│   │   │   ├── api.ts            # ApiResponse, pagination
│   │   │   ├── auth.ts
│   │   │   ├── camera.ts
│   │   │   ├── detection.ts
│   │   │   └── event.ts
│   │   ├── utils/                # Utilities
│   │   │   ├── logger.ts         # Custom logging with file rotation
│   │   │   ├── auditLogger.ts    # Audit event logging (auth etc.)
│   │   │   ├── cronJobs.ts       # Scheduled tasks
│   │   │   ├── encryption.ts
│   │   │   ├── fileHash.ts
│   │   │   └── detectionDataNormalizer.ts
│   │   ├── auth/                 # Auth service module
│   │   │   └── index.ts
│   │   └── migrations/           # TypeORM migration files (4)
│   ├── tests/                    # Additional server tests
│   ├── cameras.json              # Camera config (gitignored)
│   ├── cameras.example.json      # Camera config template
│   ├── tsconfig.json
│   ├── jest.config.js
│   └── Dockerfile
│
├── opencv-service/               # Python detection microservice
│   ├── app.py                    # Flask entry point
│   ├── pipeline.py               # YOLO detector, motion detector, init
│   ├── state.py                  # Global state module
│   ├── utils.py                  # Shared utilities
│   ├── arcface_recognizer.py     # InsightFace ArcFace recognition
│   ├── enhanced_face_recognition.py
│   ├── improved_face_recognition.py
│   ├── embedding_quality_analyzer.py
│   ├── cosine_similarity.py
│   ├── person_analyzer.py
│   ├── scene_analyzer.py
│   ├── threat_detector.py
│   ├── download_all_models.py
│   ├── rtsp_ingestion/           # Real-time RTSP ingestion pipeline
│   │   ├── ffmpeg_reader.py      # FFmpeg subprocess frame capture
│   │   ├── frame_pipeline.py     # Frame orchestrator
│   │   ├── motion_gate.py        # MOG2 motion triggering
│   │   ├── byte_tracker.py       # Multi-object Kalman tracker
│   │   ├── websocket_publisher.py # WS server → Node.js
│   │   ├── config.py             # Pipeline config constants
│   │   ├── queues.py             # Drop-oldest queue
│   │   └── metrics.py            # Pipeline performance metrics
│   ├── routes/                   # Flask route blueprints
│   │   ├── detection.py
│   │   ├── face.py
│   │   └── system.py
│   ├── tests/                    # Python tests
│   ├── models/                   # YOLO model files (.onnx)
│   ├── known_faces/              # Reference face images
│   ├── data/                     # Data directories
│   ├── requirements.txt
│   ├── pytest.ini
│   └── Dockerfile
│
├── database/                     # Database management
│   ├── migrations/               # SQL migration files (27 numbered)
│   │   └── backup/               # 26 renumbered copies (not executed — used during schema reconciliation)
│   ├── init/                     # Init scripts
│   ├── run-migrations.ts         # TypeScript migration runner
│   ├── migrate-sqlite.js
│   └── Dockerfile
│
├── scripts/                      # Utility scripts
│   ├── health.sh
│   ├── diagnose.sh
│   ├── test-opencv.sh
│   ├── backup.sh
│   ├── deploy.sh
│   ├── sentryvision.sh           # Interactive management console
│   ├── batch-detect-and-update.py
│   ├── reindex-detection-files.cjs
│   ├── cleanup-orphaned-files.cjs
│   └── find-missing-db-records.cjs
│
├── docs/                         # Documentation
│   └── c4-streaming-pipeline.md
│
├── docker-compose.yml            # 5 services: postgres, backend, opencv, go2rtc
├── docker/                       # Docker support files
├── nginx.conf                    # Production nginx config
├── go2rtc.yaml                   # go2rtc configuration
├── go2rtc-entrypoint.sh
├── sentryvision.service          # systemd service
├── data/                         # Detection images, events, snapshots
└── .planning/                    # GSD planning directory
    └── codebase/                 # Codebase analysis documents
```

## Directory Purposes

**`frontend/src/pages/`:**
- Purpose: One component per route — these are the entry points for each view
- Contains: `StreamDashboard.tsx`, `EventsPage.tsx`, `Settings.tsx`, `Login.tsx`, `TimelapsePage.tsx`, `NotFound.tsx`
- Key files: `StreamDashboard.tsx` (live camera grid), `EventsPage.tsx` (event listing + filters)

**`frontend/src/components/`:**
- Purpose: Domain-specific reusable UI components organized by feature
- Contains: Sub-directories per domain (`live/`, `events/`, `layout/`, `settings/`, `ui/`, etc.)
- Key files: `ui/` (27 shadcn/ui primitives: button, card, dialog, toast, etc.), `layout/AppLayout.tsx`, `layout/MacDock.tsx`

**`frontend/src/services/`:**
- Purpose: API communication layer — REST clients + Socket.io
- Contains: `api/baseClient.ts` (shared fetch wrapper), domain-specific service files, `SocketService.ts`
- All REST services follow the same pattern — thin methods calling `apiGet`/`apiPost` helpers from `baseClient.ts`

**`server/src/controllers/`:**
- Purpose: HTTP request handling — parse params, call services, format response
- Contains: 12 controllers, all extending `BaseController`
- Pattern: Each controller method is `async (req, res) => void`, uses `try/catch` with `this.serverError()`
- Key files: `BaseController.ts` provides `ok()`, `created()`, `badRequest()`, `notFound()`, `serverError()`

**`server/src/routes/`:**
- Purpose: Thin Express Router definitions — middleware chain + controller delegation
- Contains: 21 route files, each exporting a Router
- Pattern: Route file imports schema validators, auth guards, rate limiters, and the controller — no business logic in routes

**`server/src/services/`:**
- Purpose: All business logic, external integrations, data processing
- Contains: Top-level service files + domain sub-directories
- Domain sub-directories: `detection/`, `review/`, `timeline/`, `preview/`, `timelapse/`, `nvidia/`, `eventSearch/`

**`server/src/models/`:**
- Purpose: TypeORM entity definitions (22 files)
- Contains: `User.ts`, `Role.ts`, `Event.ts`, `FaceEmbedding.ts`, `NotificationLog.ts`, `SecurityEvent.ts`, etc.
- Key files: `index.ts` (careful re-export order to avoid circular deps — `UserSession` before `User`)

**`opencv-service/rtsp_ingestion/`:**
- Purpose: Real-time video ingestion pipeline — FFmpeg capture, motion gate, YOLO detection, tracking, WS publishing
- Contains: 8 modules forming a pipeline chain
- Key files: `ffmpeg_reader.py` (frame source), `frame_pipeline.py` (orchestration), `websocket_publisher.py` (output)

**`database/migrations/`:**
- Purpose: Ordered SQL migration files (001-027) for schema evolution
- Contains: 27 numbered SQL files (active) + 26 in `backup/` (not executed)
- Pattern: Files are sorted by prefix number and executed in order by `run-migrations.ts`

## Module Organization

- **Module pattern:** ES Modules throughout (`"type": "module"` in all `package.json` files). Backend uses `.js` extensions in imports for ESM compatibility.
- **Module types:** React components (TSX), TypeScript services/models/utils (TS), Express routes/controllers (TS), Python modules (.py)

## Naming Conventions

**Files:**
- React components: PascalCase (e.g., `StreamDashboard.tsx`, `AdaptiveCameraGrid.tsx`)
- Services/utilities: camelCase (e.g., `baseClient.ts`, `cacheService.ts`, `logger.ts`)
- Controllers: PascalCase with "Controller" suffix (e.g., `AuthController.ts`, `StreamController.ts`)
- Routes: kebab-case or single word (e.g., `event-search.ts`, `cameras.ts`, `alerts.ts`)
- Python files: snake_case (e.g., `ffmpeg_reader.py`, `websocket_publisher.py`)
- SQL migrations: `NNN_description.sql` (zero-padded number prefix)
- Test files: `*.test.ts` or `*.test.tsx` (co-located or in `__tests__/`)

**Directories:**
- Backend: camelCase (`controllers/`, `services/`, `middleware/`, `streams/`)
- Frontend: camelCase (`components/`, `services/`, `contexts/`, `utils/`)
- Python: snake_case (`rtsp_ingestion/`)
- Top-level project: kebab-case (`opencv-service/`, `docker-compose.yml`)

**Symbols:**
- Classes: PascalCase (`StreamManager`, `AuthController`, `CacheService`)
- Functions/methods: camelCase (`getCameraById`, `setupRTSPStreams`, `wirePythonWsFrames`)
- Interfaces/Types: PascalCase (`CameraConfig`, `TrackingEvent`, `ApiResponse<T>`)
- Constants: UPPER_SNAKE_CASE for env-derived, camelCase for config objects

## Configuration Locations

| Config | Path | Format |
|--------|------|--------|
| Backend env | `server/.env` (gitignored) | dotenv key=value |
| Frontend env | `frontend/.env` (gitignored) | dotenv VITE_* |
| Root env | `./.env` (gitignored) | dotenv |
| Env reference (378 lines) | `.env.example` | dotenv (many vars undocumented/may be stale) |
| Cameras | `server/cameras.json` (gitignored) | JSON array of CameraConfig |
| Example cameras | `server/cameras.example.json` | JSON template |
| Migration config | `database/.env` (gitignored) | dotenv |
| go2rtc config | `go2rtc.yaml` | YAML |
| Docker Compose | `docker-compose.yml` | YAML |
| nginx | `nginx.conf` | Nginx config |
| System service | `sentryvision.service` | systemd unit file |
| shadcn/ui | `frontend/components.json` | JSON |

## Where to Add New Code

**New Feature (frontend):**
- Page: `frontend/src/pages/<FeatureName>.tsx`
- Components: `frontend/src/components/<feature-name>/`
- API service: `frontend/src/services/api/<featureName>Service.ts`
- Types: `frontend/src/types/` or inline in component

**New API Endpoint (backend):**
- Route definition: `server/src/routes/<name>.ts` (export Router)
- Controller: `server/src/controllers/<Name>Controller.ts` (extend BaseController)
- Service: `server/src/services/<name>Service.ts`
- Mount in: `server/src/routes/index.ts` (`app.use('/api/<name>', router)`)

**New Entity (database):**
- TypeORM model: `server/src/models/<Name>.ts`
- Export in: `server/src/models/index.ts`
- SQL migration: `database/migrations/<NNN>_description.sql`
- All entities auto-loaded by `database.ts` — no manual registration needed

**New Utility:**
- Backend: `server/src/utils/<name>.ts`
- Frontend: `frontend/src/lib/<name>.ts`

**New Python Detection Feature:**
- Module: `opencv-service/<name>.py`
- Route: `opencv-service/routes/<name>.py`
- Register blueprint in: `opencv-service/app.py`

**Tests:**
- Backend: `*.test.ts` co-located with source or in `__tests__/` directories
- Frontend: `*.test.tsx` co-located or in `frontend/src/__tests__/`
- Python: `opencv-service/tests/` with `pytest.ini` config

## Special Directories

**`data/`:**
- Purpose: Detection images, events, snapshots organized by date
- Structure: `detections/YYYY-MM/events/{motion,faces}/`, `detections/YYYY-MM/snapshots/`
- Generated: Yes (by detection pipeline)
- Committed: No (gitignored, `server/data/detections`)

**`server/dist/`:**
- Purpose: Compiled JavaScript output from TypeScript
- Generated: Yes (`npm run build:server`)
- Committed: No

**`frontend/dist/`:**
- Purpose: Vite production build output
- Generated: Yes (`npm run build`)
- Committed: No

**`server/public/`:**
- Purpose: Served static files (served by Express as SPA fallback in production)
- Generated: Yes (copy of frontend build)
- Committed: No

**`.planning/`:**
- Purpose: GSD (Goal-oriented Software Development) planning artifacts
- Contains: Roadmap, phases, codebase analysis, specs
- Generated: Yes (by GSD workflow tools)
- Committed: Yes (for cross-session continuity)

**`scripts/`:**
- Purpose: Operational scripts for health checks, backup, deployment, data maintenance
- Contains: Shell scripts, Python batch processing, Node.js data reconciliation
- Committed: Yes

---

*Structure analysis: 2026-07-16*
