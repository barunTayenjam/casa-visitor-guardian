# Codebase Structure

**Analysis Date:** 2026-05-05

## Directory Layout

```
/home/barun/Documents/home-security-non-docker/
├── frontend/                    # React TypeScript frontend
│   ├── src/
│   │   ├── components/         # React components
│   │   ├── pages/              # Route-level pages
│   │   ├── services/           # API clients
│   │   ├── contexts/           # React contexts
│   │   ├── hooks/              # Custom hooks
│   │   ├── types/              # TypeScript types
│   │   ├── lib/                # Utilities
│   │   └── styles/             # CSS/styling
│   └── package.json
├── server/                     # Node.js/Express backend
│   ├── src/
│   │   ├── routes/             # Express routes
│   │   ├── services/           # Business logic
│   │   ├── models/             # TypeORM entities
│   │   ├── detection/          # Motion detection
│   │   ├── streams/            # RTSP stream management
│   │   ├── middleware/        # Express middleware
│   │   ├── config/             # Configuration
│   │   ├── migrations/         # Database migrations
│   │   ├── utils/              # Utilities
│   │   └── index.ts            # Entry point
│   ├── cameras.json            # Camera configuration
│   └── package.json
├── opencv-service/             # Python Flask service
│   ├── app.py                  # Main Flask app
│   ├── improved_face_recognition.py
│   ├── models/                 # ML model files
│   └── requirements.txt
├── database/                   # PostgreSQL setup
│   ├── migrations/             # SQL migrations
│   ├── run-migrations.ts       # Migration runner
│   └── Dockerfile
├── data/                       # Runtime data (images, events)
├── docker-compose.yml          # Container orchestration
└── package.json                # Root scripts
```

## Directory Purposes

### Frontend Structure (`frontend/src/`)

**`frontend/src/components/`**
- Purpose: Reusable React components
- Contains:
  - `ui/` - shadcn/ui base components (Radix UI)
  - `dashboard/` - Dashboard-specific components
  - `live/` - Live streaming components (StreamPanel, CameraStream)
  - `events/` - Event-related components (EventDetailPanel, EventTimeline)
  - `layout/` - Layout components (AppLayout, MinimalHeader)
  - `detection/` - Detection overlay components
  - `ProtectedRoute.tsx` - Auth guard component
  - `ErrorBoundary.tsx` - Error handling

**`frontend/src/pages/`**
- Purpose: Route-level components (lazy-loaded)
- Key files:
  - `StreamDashboard.new.tsx` - Live camera view
  - `EventsPage.new.tsx` - Event list and management
  - `Settings.new.tsx` - System configuration
  - `Analytics.new.tsx` - Charts and analytics
  - `VisitorTimeline.new.tsx` - Visitor tracking
  - `Review.new.tsx` - Event review workflow
  - `BatchDetectionPage.tsx` - Batch processing UI
  - `DayHighlights.new.tsx` - Daily highlights
  - `Login.tsx` - Authentication

**`frontend/src/services/`**
- Purpose: API client layer
- Key files:
  - `ApiService.ts` - REST API client (3120+ lines)
  - `SocketService.ts` - Socket.io real-time client
  - `ReviewApi.ts` - Review-specific API

**`frontend/src/contexts/`**
- Purpose: React context providers for global state
- Key files:
  - `AuthContext.tsx` - Authentication state and methods
  - `CameraContext.tsx` - Camera state management
  - `SocketContext.tsx` - Socket connection management
  - `EventsContext.tsx` - Events state management

**`frontend/src/hooks/`**
- Purpose: Custom React hooks
- Key files:
  - `useReview.ts` - Review-related logic
  - `use-toast.ts` - Toast notification hook

**`frontend/src/types/`**
- Purpose: TypeScript type definitions
- Key files:
  - `security.ts` - Main type definitions (Camera, Event, Visitor, etc.)

**`frontend/src/lib/`**
- Purpose: Utility functions and helpers
- Key files:
  - `utils.ts` - Common utilities
  - `theme.ts` - Theme configuration
  - `logger.ts` - Frontend logging
  - `severity.ts` - Severity level definitions

### Backend Structure (`server/src/`)

**`server/src/routes/`**
- Purpose: Express route handlers
- Key files:
  - `index.ts` - Main routes (16K+ lines, 100+ endpoints)
  - `auth.ts` - Authentication endpoints
  - `visitorRoutes.ts` - Visitor management
  - `detectionRoutes.ts` - Detection endpoints
  - `reviewRoutes.ts` - Review segments
  - `timelineRoutes.ts` - Timeline queries
  - `storageRoutes.ts` - Storage management

**`server/src/services/`**
- Purpose: Business logic layer
- Key files:
  - `detection/detectionService.ts` - Unified detection interface
  - `review/reviewService.ts` - Review segment logic
  - `timeline/timelineService.ts` - Timeline aggregation
  - `visitorAnalyticsService.ts` - Visitor analytics
  - `batchProcessingService.ts` - Batch job processing
  - `opencvMicroserviceClient.ts` - OpenCV HTTP client
  - `redisCache.ts` - Redis caching
  - `sessionManager.ts` - Session management
  - `totpService.ts` - TOTP MFA

**`server/src/models/`**
- Purpose: TypeORM entities
- Key files:
  - `Event.ts` - Motion/event records
  - `User.ts` - User accounts
  - `Visitor.ts` - Visitor tracking
  - `BatchJob.ts` - Batch processing jobs
  - `ReviewSegment.ts` - Review segments
  - `FaceEmbedding.ts` - Face recognition embeddings
  - `UserSession.ts` - Session tracking
  - `index.ts` - Entity exports

**`server/src/detection/`**
- Purpose: Motion detection implementations
- Key files:
  - `optimizedMotionDetection.ts` - Main detection (988 lines)
  - `simpleMotionDetection.ts` - Lightweight detection (138 lines)
  - `motionTriggeredDetection.ts` - Triggered detection (664 lines)
  - `objectDetection.ts` - YOLO object detection
  - `consolidatedDetectionService.ts` - Unified detection service

**`server/src/streams/`**
- Purpose: RTSP stream management
- Key files:
  - `rtspManager.ts` - FFmpeg stream orchestration (919 lines)
  - `streamHealthMonitor.ts` - Stream health tracking

**`server/src/middleware/`**
- Purpose: Express middleware
- Key files:
  - `auth.ts` - JWT verification
  - `rateLimit.ts` - Rate limiting
  - `validation.ts` - Request validation

**`server/src/config/`**
- Purpose: Configuration management
- Key files:
  - `index.ts` - Main configuration (394 lines)
  - `detectionConfig.ts` - Detection settings
  - `rateLimits.ts` - Rate limit configs

**`server/src/utils/`**
- Purpose: Utility functions
- Key files:
  - `logger.ts` - Structured logging
  - `jwtService.ts` - JWT handling
  - `encryption.ts` - Credential encryption
  - `cronJobs.ts` - Scheduled tasks

**`server/src/migrations/`**
- Purpose: TypeORM migrations
- Key files:
  - `1702340575345-CreateEventsTable.ts`
  - `AddDetectionIndexes1706582400000.ts`

### OpenCV Service Structure (`opencv-service/`)

**`opencv-service/`**
- Purpose: Python computer vision service
- Key files:
  - `app.py` - Flask application (1903 lines)
  - `improved_face_recognition.py` - Face embedding generation
  - `enhanced_face_recognition.py` - Enhanced face recognition
  - `cosine_similarity.py` - Similarity matching
  - `embedding_quality_analyzer.py` - Quality assessment
- Models directory:
  - `yolov5n.onnx` - YOLO object detection
  - `res10_300x300_ssd_iter_140000_fp16.caffemodel` - Face detector
  - `yolo_classes.txt` - COCO class names
- Known faces directory:
  - `known_faces/` - Known face embeddings

### Database Structure (`database/`)

**`database/migrations/`**
- Purpose: SQL migration files
- Key files (001-017):
  - `001_create_user_management.sql` - Users, roles, sessions
  - `003_create_events_table.sql` - Events table
  - `005_create_visitor_tables.sql` - Visitor tracking
  - `007_create_review_timeline_tables.sql` - Review segments
  - `009_add_face_embeddings_table.sql` - Face storage
  - `011_add_visitors_table.sql` - Visitor management
  - `017_ai_analysis_results.sql` - AI analysis

**`database/`**
- Key files:
  - `run-migrations.ts` - Migration runner script
  - `migrate.ts` - TypeScript migration utility

## Key File Locations

### Entry Points
- `frontend/src/main.tsx` - React application entry
- `frontend/src/App.tsx` - App component with routing
- `server/src/index.ts` - Express server entry (639 lines)
- `opencv-service/app.py` - Flask application entry

### Configuration
- `server/cameras.json` - Camera RTSP URLs and settings
- `server/src/config/index.ts` - Configuration loader
- `server/src/config/detectionConfig.ts` - Detection parameters

### Core Logic
- `server/src/streams/rtspManager.ts` - RTSP stream handling
- `server/src/detection/optimizedMotionDetection.ts` - Main detection
- `server/src/routes/index.ts` - Main API routes (16K+ lines)

### API Client
- `frontend/src/services/ApiService.ts` - REST client
- `frontend/src/services/SocketService.ts` - WebSocket client

## Naming Conventions

**Files:**
- Components: PascalCase (`CameraGrid.tsx`, `StreamPanel.tsx`)
- Services: camelCase (`apiService.ts`, `socketService.ts`)
- Hooks: camelCase with 'use' prefix (`useReview.ts`, `useToast.ts`)
- Types: PascalCase (`security.ts`, `types.ts`)
- Utilities: camelCase (`utils.ts`, `logger.ts`)

**Directories:**
- Components: camelCase or kebab-case (`components/dashboard`, `components/live`)
- Pages: PascalCase or camelCase with page suffix
- Services: camelCase
- Models: PascalCase (TypeORM entities)

**Functions/Methods:**
- camelCase (`getEvents`, `startStream`, `detectMotion`)

**TypeScript Types:**
- PascalCase (`Camera`, `Event`, `MotionSettings`)

## Where to Add New Code

### New Feature (Frontend)
- Implementation: `frontend/src/components/` (create in appropriate subdirectory)
- Pages: `frontend/src/pages/`
- Types: `frontend/src/types/security.ts`
- API calls: `frontend/src/services/ApiService.ts`
- Tests: `frontend/src/tests/` (or co-located)

### New Feature (Backend)
- Routes: `server/src/routes/` (or add to `index.ts`)
- Services: `server/src/services/` (or `server/src/services/[feature]/`)
- Models: `server/src/models/`
- Detection: `server/src/detection/`
- Tests: `server/src/routes/` (as `.test.ts`)

### New Component/Module
- Backend service: `server/src/services/`
- TypeORM model: `server/src/models/`
- Config: `server/src/config/`

### Utilities
- Shared helpers: `server/src/utils/` or `frontend/src/lib/`
- Logger: Use existing `logger.ts`

### API Endpoint
- Add to `server/src/routes/index.ts` or create new route file
- Register in main app: `app.use('/api', newRoutes)`

### Database Migration
- Create SQL file: `database/migrations/XXX_description.sql`
- Add TypeORM migration: `server/src/migrations/`

## Special Directories

**`server/src/data/detections/`**
- Purpose: Stored detection images organized by date
- Generated: Yes (runtime)
- Committed: No (in .gitignore)

**`server/src/public/`**
- Purpose: Static files served by Express
- Contains: Event classifier HTML/JS

**`opencv-service/models/`**
- Purpose: ML model files (YOLO, face detection)
- Generated: No (downloaded)
- Committed: Partial (some weights)

**`database/migrations/`**
- Purpose: SQL schema migrations
- Generated: No (manually written)
- Committed: Yes

---

*Structure analysis: 2026-05-05*