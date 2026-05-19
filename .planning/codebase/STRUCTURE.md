# Codebase Structure

**Analysis Date:** 2026-05-15

## Directory Layout

```
home-security-non-docker/
├── frontend/                    # React 18 + TypeScript frontend application
│   ├── src/
│   │   ├── components/          # Reusable UI components organized by domain
│   │   │   ├── analytics/       # Analytics visualization (currently empty)
│   │   │   ├── dashboard/       # Dashboard-specific (CameraStream.tsx)
│   │   │   ├── detection/       # Detection components (currently empty)
│   │   │   ├── events/          # Event browsing components
│   │   │   ├── layout/          # App layout, navigation (AppLayout, MacDock)
│   │   │   ├── live/            # Live streaming components
│   │   │   └── ui/              # shadcn/ui primitives (button, card, dialog, etc.)
│   │   ├── contexts/            # React Context providers (Auth, Camera, Socket)
│   │   ├── hooks/               # Custom React hooks (use-toast)
│   │   ├── lib/                 # Utility modules (utils, logger, theme)
│   │   ├── pages/               # Route-level page components
│   │   ├── services/            # API client layer (ApiService, SocketService)
│   │   ├── styles/              # Design tokens
│   │   ├── tests/               # Test setup
│   │   ├── types/               # TypeScript type definitions (security.ts)
│   │   ├── App.tsx              # Root component with routing
│   │   └── main.tsx             # Application entry point
│   ├── index.html               # HTML template
│   ├── vite.config.ts           # Vite build config with API proxy
│   ├── tailwind.config.ts       # TailwindCSS customization
│   ├── tsconfig.json            # TypeScript config
│   └── package.json             # Frontend dependencies
├── server/                      # Express + TypeScript backend application
│   ├── src/
│   │   ├── auth/                # Authentication logic (JWT, bcrypt, user seeding)
│   │   ├── config/              # Configuration modules (app config, detection, rate limits, performance)
│   │   ├── detection/           # Motion/object detection engine
│   │   ├── events/              # Event bus singleton for cross-service communication
│   │   ├── integrations/        # External integrations (currently empty)
│   │   ├── middleware/          # Express middleware (auth, rate limiting, validation, security)
│   │   ├── migrations/          # TypeORM migrations (if any)
│   │   ├── models/              # TypeORM entity definitions (30+ files)
│   │   ├── routes/              # API endpoint handlers
│   │   ├── schemas/             # Validation schemas (currently empty)
│   │   ├── scripts/             # One-off utility scripts
│   │   ├── services/            # Business logic services with sub-directories
│   │   │   ├── detection/       # Detection configuration service
│   │   │   ├── preview/         # Frame preview service
│   │   │   ├── review/          # Review segment service + tests
│   │   │   └── timeline/        # Timeline service + tests
│   │   ├── streams/             # RTSP stream management (FFmpeg process control)
│   │   ├── types/               # Shared TypeScript types
│   │   ├── utils/               # Shared utilities (logger, encryption, audit, cron)
│   │   ├── database.ts          # TypeORM DataSource setup
│   │   └── index.ts             # Application entry point (707 lines)
│   ├── cameras.json             # Camera configuration (RTSP URLs, zones, objects)
│   ├── tsconfig.json            # TypeScript config (strict mode)
│   └── package.json             # Backend dependencies
├── opencv-service/              # Python Flask computer vision service
│   ├── app.py                   # Main Flask application (1,922 lines)
│   ├── improved_face_recognition.py  # Face recognition engine
│   ├── enhanced_face_recognition.py  # Enhanced face recognition
│   ├── cosine_similarity.py     # Cosine similarity for face matching
│   ├── embedding_quality_analyzer.py # Embedding quality checks
│   ├── models/                  # ML model files (YOLO, Caffe, ONNX)
│   ├── known_faces/             # Known face embeddings organized by person
│   ├── requirements.txt         # Python dependencies
│   └── Dockerfile               # Container definition
├── database/                    # Database migration management
│   ├── migrations/              # SQL migration files (001-017)
│   ├── run-migrations.ts        # Migration runner
│   └── package.json             # Migration tooling
├── nginx.conf                   # Reverse proxy configuration
├── docker-compose.yml           # Multi-service orchestration
├── package.json                 # Root-level monorepo scripts
├── .env.example                 # Environment variable template
└── AGENTS.md                    # AI agent documentation
```

## Directory Purposes

**`frontend/src/components/`:**
- Purpose: Reusable UI components organized by feature domain
- Contains: `.tsx` React components with co-located logic
- Key files: `live/StreamPanel.tsx` (camera streams), `events/EventTimeline.tsx` (event browsing), `layout/AppLayout.tsx` (app shell)

**`frontend/src/components/ui/`:**
- Purpose: shadcn/ui primitive components (auto-generated, do not modify directly)
- Contains: Button, Card, Dialog, Drawer, Tabs, Tooltip, Badge, etc. (25+ components)
- Key files: All `.tsx` files are Radix UI + TailwindCSS wrappers

**`frontend/src/contexts/`:**
- Purpose: React Context providers for global state
- Contains: AuthContext (JWT state + user), CameraContext (camera list + stream control), SocketContext (WebSocket connection)
- Key files: `AuthContext.tsx` (429 lines), `CameraContext.tsx` (307 lines)

**`frontend/src/services/`:**
- Purpose: API client and WebSocket communication layer
- Contains: Centralized HTTP client (`ApiService.ts` - 3,208 lines), Socket.io client (`SocketService.ts` - 265 lines)
- Key files: `ApiService.ts` is the sole backend communication point

**`frontend/src/pages/`:**
- Purpose: Route-level page components (lazy-loaded)
- Contains: 7 page components matching app routes
- Key files: `StreamDashboard.new.tsx`, `EventsPage.new.tsx`, `Analytics.new.tsx`, `Settings.new.tsx`, `DayHighlights.new.tsx`, `Login.tsx`, `NotFound.tsx`

**`server/src/routes/`:**
- Purpose: Express API endpoint definitions
- Contains: Route handler files with co-located tests
- Key files: `index.ts` (4,073 lines — monolithic), `auth.ts`, `visitorRoutes.ts`, `detectionRoutes.ts`

**`server/src/models/`:**
- Purpose: TypeORM entity definitions mapping to PostgreSQL tables
- Contains: 24 active entity files, 3 disabled files (`.disabled` suffix), 6 test files
- Key files: `Event.ts` (motion events), `User.ts`, `Visitor.ts`, `ReviewSegment.ts`, `index.ts` (barrel exports)

**`server/src/detection/`:**
- Purpose: Motion detection algorithms and detection orchestration
- Contains: 5 detection modules totaling ~3,500+ lines
- Key files: `optimizedMotionDetection.ts` (988 lines), `motionTriggeredDetection.ts` (664 lines), `consolidatedDetectionService.ts` (431 lines)

**`server/src/streams/`:**
- Purpose: RTSP stream lifecycle management
- Contains: `rtspManager.ts` (958 lines), `streamHealthMonitor.ts`
- Key files: `rtspManager.ts` — manages FFmpeg child processes, frame distribution, adaptive FPS

**`server/src/services/`:**
- Purpose: Core business logic organized by domain
- Contains: Top-level services + 4 sub-directories (`detection/`, `preview/`, `review/`, `timeline/`)
- Key files: `batchProcessingService.ts`, `notificationService.ts`, `retentionPolicyService.ts`, `automatedCleanupService.ts`

**`server/src/middleware/`:**
- Purpose: Express request pipeline middleware
- Contains: Authentication, rate limiting, validation, security headers
- Key files: `auth.ts` (JWT verification + role guards), `rateLimit.ts`, `validation.ts` (Zod schemas)

**`server/src/config/`:**
- Purpose: Application configuration loading and validation
- Contains: `index.ts` (394 lines — central config), `detectionConfig.ts`, `rateLimits.ts`, `performance.ts`
- Key files: `index.ts` — loads env vars, `cameras.json`, provides typed `AppConfig` export

**`opencv-service/`:**
- Purpose: Standalone Python computer vision microservice
- Contains: Flask app, face recognition modules, ML model files, known face data
- Key files: `app.py` (1,922 lines — all CV endpoints), `improved_face_recognition.py`

**`database/migrations/`:**
- Purpose: PostgreSQL schema evolution
- Contains: 17+ numbered SQL files (001 through 017)
- Key files: `001_create_user_management.sql`, `003_create_events_table.sql`, `009_add_face_embeddings_table.sql`

## Key File Locations

**Entry Points:**
- `frontend/src/main.tsx`: React application bootstrap
- `server/src/index.ts`: Express server + Socket.io + service initialization
- `opencv-service/app.py`: Flask OpenCV service

**Configuration:**
- `server/src/config/index.ts`: Centralized typed configuration from env + files
- `server/cameras.json`: Camera RTSP URLs, zones, detection settings
- `frontend/vite.config.ts`: Vite build config with `/api` proxy to backend
- `docker-compose.yml`: Multi-service container orchestration
- `nginx.conf`: Production reverse proxy
- `.env.example`: Environment variable template

**Core Logic:**
- `server/src/streams/rtspManager.ts`: Camera stream orchestration
- `server/src/detection/optimizedMotionDetection.ts`: Primary motion detection
- `server/src/detection/consolidatedDetectionService.ts`: OpenCV service client + caching
- `server/src/detection/motionTriggeredDetection.ts`: Detection pipeline coordinator
- `server/src/events/eventBus.ts`: Cross-service event distribution
- `frontend/src/services/ApiService.ts`: All backend API communication

**Authentication:**
- `server/src/auth/index.ts`: JWT generation/verification, bcrypt, user seeding
- `server/src/middleware/auth.ts`: Express auth middleware (authenticate, requireUser, requireAdmin)
- `frontend/src/contexts/AuthContext.tsx`: Frontend auth state management

**Testing:**
- `server/src/routes/auth.test.ts`: Auth endpoint tests
- `server/src/routes/visitorRoutes.test.ts`: Visitor route tests
- `server/src/routes/reviewRoutes.test.ts`: Review route tests
- `server/src/routes/batchDetection.test.ts`: Batch detection tests
- `server/src/services/timeline/timelineService.test.ts`: Timeline service tests
- `server/src/services/review/reviewService.test.ts`: Review service tests
- `server/src/models/*.test.ts`: Model-specific tests

**Database:**
- `server/src/database.ts`: TypeORM DataSource (PostgreSQL connection)
- `server/src/models/index.ts`: Barrel export for all entities
- `database/migrations/*.sql`: Schema migration files

## Naming Conventions

**Files:**
- React components: PascalCase — `StreamPanel.tsx`, `CameraStream.tsx`, `EventTimeline.tsx`
- Service/utility files: camelCase — `apiService.ts`, `socketService.ts`, `logger.ts`
- Test files: `<name>.test.ts` or `<name>.test.tsx` — co-located with source
- Disabled files: `.disabled` suffix — `logDatabase.ts.disabled`, `AuditLog.ts.disabled`
- Page components: PascalCase with `.new.tsx` suffix for current versions — `EventsPage.new.tsx`, `Analytics.new.tsx`
- TypeORM entities: PascalCase matching table name — `Event.ts`, `Visitor.ts`, `ReviewSegment.ts`
- Route files: camelCase or PascalCase — `visitorRoutes.ts`, `auth.ts`, `detectionRoutes.ts`
- Config files: camelCase — `detectionConfig.ts`, `rateLimits.ts`

**Directories:**
- Feature domains: lowercase — `live/`, `events/`, `analytics/`, `dashboard/`
- Service sub-domains: lowercase — `detection/`, `review/`, `timeline/`, `preview/`
- Shared libraries: lowercase — `lib/`, `utils/`, `hooks/`, `types/`

## Where to Add New Code

**New Feature Page (Frontend):**
- Page component: `frontend/src/pages/<PageName>.tsx`
- Register route in: `frontend/src/App.tsx` (add lazy import + Route element)
- Add to navigation: `frontend/src/components/layout/AppLayout.tsx` or `MacDock.tsx`

**New API Endpoint (Backend):**
- Route definition: `server/src/routes/<feature>Routes.ts` (new file or append to existing)
- Register in: `server/src/index.ts` (line ~330-340, add `app.use('/api/<feature>', routes)`)
- Auth middleware: Import from `server/src/middleware/auth.ts`

**New Database Entity:**
- TypeORM model: `server/src/models/<EntityName>.ts`
- Export from: `server/src/models/index.ts` (add to barrel exports)
- Migration file: `database/migrations/<next_number>_<description>.sql`

**New Service (Backend):**
- Service class: `server/src/services/<serviceName>.ts` or sub-directory `server/src/services/<domain>/<serviceName>.ts`
- Extend `BaseService` from `server/src/services/baseService.ts` for EventBus integration
- Initialize in: `server/src/index.ts` `initializeServices()` function (~line 497)
- Store on global: `(global as any).<serviceName> = <instance>`

**New Frontend Component:**
- Shared component: `frontend/src/components/<domain>/<ComponentName>.tsx`
- shadcn/ui component: Use CLI to add to `frontend/src/components/ui/` (do not hand-edit)
- Types: Add to `frontend/src/types/security.ts`

**New Detection Algorithm:**
- Detection module: `server/src/detection/<name>.ts`
- Integrate with: `server/src/detection/motionTriggeredDetection.ts` (detection pipeline)
- Or integrate with: `server/src/streams/rtspManager.ts` (frame callback)

**New Migration:**
- Migration file: `database/migrations/<NNN>_<description>.sql` (NNN = next number after 017)
- Run: `cd database && npm run migrate`

## Special Directories

**`server/src/data/detections/`:**
- Purpose: Detection images organized by `YYYY-MM/events/{motion,faces}/` and `YYYY-MM/snapshots/`
- Generated: Yes (by detection pipeline at runtime)
- Committed: Partially (contains historical detection images from January 2026)
- Note: Path configured in `server/src/config/index.ts` via `DETECTIONS_DIR` env var

**`opencv-service/known_faces/`:**
- Purpose: Known face embeddings organized by person subdirectory
- Generated: Yes (uploaded via face management API)
- Committed: Yes (includes test person faces)

**`opencv-service/models/`:**
- Purpose: ML model weights (YOLO, Caffe face detector, ONNX)
- Generated: No (downloaded via `download_models.py` scripts)
- Committed: Yes (binary model files — YOLOv3 weights, Caffe model)

**`frontend/src/components/ui/`:**
- Purpose: Auto-generated shadcn/ui component library
- Generated: Yes (via shadcn CLI)
- Committed: Yes
- Note: Do not hand-edit; regenerate using shadcn CLI if updates needed

**`server/src/integrations/` and `server/src/schemas/`:**
- Purpose: Placeholder directories (currently empty)
- Status: Reserved for future use — external integrations and Zod schema definitions

---

*Structure analysis: 2026-05-15*
