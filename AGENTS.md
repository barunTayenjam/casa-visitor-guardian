# AGENTS.md

Essential information for AI agents working on the SentryVision codebase.

## Project Overview

Home security system: React/TypeScript frontend, Express 5 backend, PostgreSQL, Python OpenCV service.

**Version**: 1.4.0 | **Timezone**: IST (UTC+5:30) | **Status**: Production

## Architecture

| Layer | Tech | Port |
|-------|------|------|
| Frontend | React 18, TypeScript (strict), Vite, TailwindCSS, Radix UI (shadcn/ui) | 5173 |
| Backend | Express 5, TypeScript (strict), TypeORM, Socket.io | 9753 |
| OpenCV | Flask, OpenCV MOG2 + YOLOv4-tiny + face recognition | 8084 |
| Database | PostgreSQL 15+ (28 migrations) | 5432 |
| Cache | Redis with in-memory fallback | 6379 |

**Data flow**: `Frontend → Backend API → OpenCV Service → PostgreSQL + Redis`

## Commands

```bash
# Dev
npm run dev              # Frontend only
npm run dev:server       # Backend only
npm run dev:full         # Both (kills stale ports first)

# Build
npm run build            # Frontend (Vite)
npm run build:server     # Backend (tsc → dist/)
npm run build:full       # Both

# Quality
npm run lint             # ESLint (frontend)
npm run typecheck        # tsc --noEmit (frontend)
npm run test             # Jest (frontend)

# Server (cd server)
npm run dev              # Nodemon hot reload
npm run build            # Compile TS
npm start                # Production

# Database (cd database)
npm run migrate          # Run pending migrations

# Docker
docker-compose up -d / down / ps / logs -f
```

**Always run `npm run lint && npm run typecheck` after frontend changes.**

## Frontend Structure

```
frontend/src/
├── pages/                    # Route-level views
│   ├── App.tsx               # Router + layout
│   ├── EventsPage.tsx        # Main events view with filters
│   ├── Analytics.tsx         # Charts and stats
│   ├── Settings.tsx          # System settings
│   ├── DayHighlights.tsx     # Daily highlight reels
│   ├── StreamDashboard.tsx   # Live camera view
│   └── Login.tsx
├── components/
│   ├── live/                 # AdaptiveCameraGrid, StreamPanel, RecentDetectionsSection
│   ├── events/               # EventDetailPanel, SmartFilters, EventTimeline, RelatedEvents
│   ├── layout/               # AppLayout, MacDock (bottom nav)
│   ├── settings/             # MotionDetectionSettings, OptimizationSettings
│   ├── analytics/            # Charts
│   ├── detection/            # Detection UI
│   ├── dashboard/            # Dashboard widgets
│   ├── ui/                   # shadcn/ui primitives (Radix)
│   ├── ErrorBoundary.tsx
│   └── ProtectedRoute.tsx
├── services/
│   ├── api/                  # REST clients
│   │   ├── baseClient.ts     # Shared fetch wrapper with auth
│   │   ├── cameraService.ts  # Camera CRUD + snapshots
│   │   ├── eventService.ts   # Event listing/detail
│   │   ├── detectionService.ts
│   │   ├── authService.ts
│   │   ├── systemService.ts
│   │   ├── settingsService.ts
│   │   └── notificationService.ts
│   └── SocketService.ts      # Socket.io client
├── contexts/
│   ├── AuthContext.tsx        # Auth state, login/logout, MFA
│   ├── CameraContext.tsx      # Camera state, stream management
│   └── SocketContext.tsx      # Socket.io connection
├── hooks/
│   └── use-toast.ts
├── types/
│   └── security.ts
├── lib/
│   ├── utils.ts              # cn() helper
│   ├── theme.ts
│   └── logger.ts
└── styles/
    └── design-tokens.ts
```

## Backend Structure

```
server/src/
├── index.ts                  # Express app bootstrap
├── database.ts               # TypeORM connection
├── controllers/              # MVC pattern
│   ├── CameraController.ts   # Camera CRUD + snapshots
│   ├── StreamController.ts   # RTSP streaming
│   ├── AuthController.ts     # Login, register, MFA
│   ├── DetectionController.ts
│   ├── EventController.ts
│   ├── ReviewController.ts
│   ├── AnalyticsController.ts
│   ├── SettingsController.ts
│   ├── SystemController.ts
│   ├── AlertController.ts
│   └── NvidiaController.ts   # AI scene analysis
├── routes/                   # Route definitions
│   ├── index.ts              # Mount all routes
│   ├── auth.ts, cameras.ts, events.ts, streams.ts
│   ├── detection-operations.ts, detectionRedoRoutes.ts, detectionRoutes.ts
│   ├── motion.ts, faceConfigRoutes.ts, faceEmbeddingRoutes.ts
│   ├── notificationRoutes.ts, nvidiaRoutes.ts
│   ├── review.ts, settings.ts, highlights.ts
│   ├── visitorRoutes.ts, analytics.ts, alerts.ts
│   └── event-search.ts
├── services/                 # Business logic
│   ├── nvidiaAnalysisService.ts       # NVIDIA AI integration
│   ├── eventSearchService.ts          # Full-text event search
│   ├── batchProcessingWorker.ts       # Async batch detection
│   ├── batchProcessingDatabasePostgres.ts
│   ├── retentionPolicyService.ts      # Data retention
│   ├── notificationService.ts
│   ├── automatedCleanupService.ts
│   ├── opencvMicroserviceClient.ts    # HTTP client to OpenCV
│   ├── cacheService.ts                # Redis/in-memory cache
│   ├── serviceRegistry.ts
│   ├── visitorService.ts
│   ├── credentialEncryption.ts
│   ├── inMemoryStateService.ts
│   ├── circuitBreaker.ts
│   ├── retryService.ts
│   ├── detection/                     # Detection sub-services
│   ├── review/                        # Review sub-services
│   ├── timeline/                      # Timeline sub-services
│   └── preview/                       # Preview sub-services
├── models/                   # TypeORM entities
│   ├── User.ts, Role.ts, UserSession.ts, PasswordHistory.ts
│   ├── Event.ts, DetectionConfig.ts, ProcessedImage.ts, AdaptiveRegion.ts
│   ├── Visitor (in timeline), FaceEmbedding.ts
│   ├── BatchJob.ts, ReviewSegment.ts, UserReviewStatus.ts
│   ├── RetentionPolicy.ts, StorageStats (system)
│   ├── NotificationLog.ts, NotificationPreferences.ts, NotificationSubscription.ts
│   ├── SecurityEvent.ts, RateLimitCounter.ts, AuditLog.ts
│   └── index.ts              # Re-exports all models
├── middleware/
│   ├── auth.ts               # JWT verification
│   ├── validation.ts         # Zod schemas
│   └── enhancedRateLimit.ts  # Rate limiting
├── detection/                # Motion detection
│   ├── optimizedMotionDetection.ts      # Main: adaptive sensitivity, night mode, zones
│   ├── motionTriggeredDetection.ts      # Triggers YOLO + face recognition on motion
│   ├── consolidatedDetectionService.ts  # Unified detection pipeline
│   ├── objectDetection.ts               # YOLO object detection
│   └── cleanupService.ts                # Event cleanup
├── streams/
│   ├── rtspManager.ts        # RTSP stream orchestration
│   └── streamHealthMonitor.ts
├── utils/
│   ├── logger.ts, auditLogger.ts
│   ├── encryption.ts, fileHash.ts
│   ├── detectionDataNormalizer.ts
│   ├── cronJobs.ts
│   └── testImageGenerator.ts
├── config/
│   ├── index.ts, detectionConfig.ts, performance.ts, rateLimits.ts
├── types/
│   ├── api.ts, auth.ts, camera.ts, detection.ts, event.ts
├── auth/
│   └── index.ts
├── migrations/               # TypeORM migrations
└── events/
    └── eventBus.ts
```

## Detection Pipeline

1. `rtspManager.ts` captures frames from RTSP via FFmpeg
2. `optimizedMotionDetection.ts` runs MOG2 background subtraction (adaptive sensitivity, night mode 22:00-06:00, zone-based, 3s interval, 10s cooldown)
3. On motion → `motionTriggeredDetection.ts` sends frame to OpenCV service
4. OpenCV runs YOLOv4-tiny object detection + face recognition
5. Results stored as `events` in PostgreSQL with image captures
6. `consolidatedDetectionService.ts` provides unified query interface

## Key Configuration

| File | Purpose |
|------|---------|
| `server/cameras.json` | Camera RTSP URLs, zones, tracked objects (gitignored) |
| `server/cameras.example.json` | Camera config template |
| `frontend/vite.config.ts` | Vite build + API proxy to :9753 |
| `docker-compose.yml` | All 5 services |
| `.env.example` | Environment variable reference |

## Database

28 SQL migrations in `database/migrations/`. Key tables:

- **users, roles, user_sessions, password_history, audit_logs** — Auth
- **events** — Core detection events (UUID PK, timestamp, camera_id, event_type, confidence, image_path, persons_detected, faces_detected, object_detections JSONB, face_detections JSONB)
- **face_embeddings** — Face vectors for recognition
- **visitor_timeline, timeline** — Visitor tracking
- **review_segments, user_review_status** — Review workflow
- **batch_jobs** — Async processing
- **notification_*** — Notification preferences and logs
- **system_settings, retention_policies, storage_stats** — System config
- **security_events, rate_limit_counters** — Security

## Conventions

- **TypeScript strict mode** everywhere. No `any`.
- **File naming**: PascalCase components (`CameraGrid.tsx`), camelCase utils (`apiService.ts`)
- **Import order**: external → internal → types
- **API calls**: Use `services/api/baseClient.ts` (handles auth headers, refresh)
- **Components**: Follow shadcn/ui patterns, Radix primitives
- **Backend routes**: MVC pattern — Controller handles logic, Route file just wires Express
- **Validation**: Zod schemas in `middleware/validation.ts`
- **No comments** in code unless asked

## Real-time

- **Socket.io** for live camera frames and motion alerts
- Events: `requestStream`, `stopStream`, `frame`, `motionDetected`
- Frontend connects via `SocketService.ts` → `SocketContext.tsx`

## Environment Variables

```bash
# Backend (.env)
NODE_ENV=development
PORT=9753
DB_HOST=localhost       # "postgres" in Docker
DB_PORT=5432
DB_NAME=sentryvision
DB_USER=sentryvision
DB_PASSWORD=<secret>
JWT_ACCESS_SECRET=<secret>
JWT_REFRESH_SECRET=<secret>
OPENCV_SERVICE_URL=http://localhost:8084  # "http://opencv:8084" in Docker
DETECTIONS_DIR=./data/detections
TZ=Asia/Kolkata

# Frontend (.env)
VITE_BACKEND_URL=http://localhost:9753
```

## Common Issues

| Issue | Fix |
|-------|-----|
| Port in use | `npm run kill:ports` |
| DB connection | Verify postgres running, check credentials, run migrations |
| OpenCV down | `curl http://localhost:8084/health` |
| No motion detected | Check RTSP URLs in cameras.json, verify FFmpeg, check detection zones |
| Frontend build errors | `rm -rf frontend/node_modules && cd frontend && npm install` |
| Backend TS errors | `cd server && rm -rf dist && npm run build` |

## Utility Scripts

| Script | Purpose |
|--------|---------|
| `scripts/health.sh` | Service health monitoring |
| `scripts/diagnose.sh` | System diagnostics (cameras, ports, FFmpeg) |
| `scripts/test-opencv.sh` | End-to-end test (OpenCV + backend + frontend) |
| `scripts/backup.sh` | Database and file backups |
| `scripts/deploy.sh` | Production deployment |
| `scripts/sentryvision.sh` | Interactive management console |
| `scripts/batch-detect-and-update.py` | Python batch detection |
| `scripts/reindex-detection-files.cjs` | Reindex detection files |
| `scripts/cleanup-orphaned-files.cjs` | Remove orphaned detection files |
| `scripts/find-missing-db-records.cjs` | Reconcile files vs DB records |
