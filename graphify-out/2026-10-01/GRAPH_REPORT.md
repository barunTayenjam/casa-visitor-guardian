# Graph Report - sentryvision  (2026-10-01)

## Corpus Check
- 464 files · ~294,110 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 28 file(s) not represented in the graph (top: (none) 11, .onnx 3, .conf 2)

## Summary
- 3559 nodes · 7185 edges · 200 communities (135 shown, 65 thin omitted)
- Extraction: 96% EXTRACTED · 4% INFERRED · 0% AMBIGUOUS · INFERRED: 257 edges (avg confidence: 0.93)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `73d62a1e`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- routes/index.ts
- services.ts
- frame_pipeline.py
- src/index.ts
- FramePipeline
- EventsPage.tsx
- cn
- models/index.ts
- Settings.tsx
- sentryvision.sh
- FFmpegReader
- server/package.json
- InsightsPage.tsx
- batchProcessingWorker.ts
- config/index.ts
- src/database.ts
- factories.ts
- detection.py
- TimelapsePage.tsx
- Frontend Revamp Design Spec
- DropOldestQueue
- eventSearch/eventSearchService.ts
- security.ts
- detection/detectionService.ts
- dependencies
- consolidatedDetectionService
- Event
- download_all_models.py
- express
- package.json
- cameraController
- automatedCleanupService.ts
- frontend-next/package.json
- TimelapseService
- StreamManager
- WebSocketPublisher
- byte_tracker.py
- react
- logger.ts
- ReviewService
- detectionRoutes.ts
- Design System: SentryVision
- dependencies
- Technical Notes
- Shell.tsx
- devDependencies
- devDependencies
- LoginPage.tsx
- use-toast.ts
- scripts
- ArcFaceRecognizer
- retentionPolicyService
- baseClient.ts
- AskPage.tsx
- RTSPService
- LegacyRedirect
- cronJobs.ts
- SentryVision Release Notes
- health.sh
- ChatController.ts
- chat/chatService.ts
- useInsights.ts
- insightsService.ts
- compilerOptions
- cacheService
- compilerOptions
- providers.tsx
- YOLOObjectDetector
- README.md
- BatchProcessingDatabasePostgres
- SentryVision Architecture
- SocketService
- cameraLoader.ts
- backup.sh
- queryTools.ts
- nvidiaController
- Database
- MotionGate
- BatchJob
- NotificationLog
- Contributing to SentryVision
- database/package.json
- eventBus
- AuditLog
- automatedCleanupService
- nvidia/index.ts
- scan_and_embed
- SceneAnalyzer
- reindex-detection-files.cjs
- nvidiaClient.ts
- initializeServices
- InMemoryStateService
- Changes
- Frontend
- Route Mount Map
- PersonAnalyzer
- DetectionCache
- ThreatDetector
- reportGenerator.ts
- nvidiaProcessor.ts
- settingsController
- AGENTS.md
- authController
- add-known-person.ts
- MetricsCollector
- nvidia/types.ts
- AuditLogger
- systemController
- HumanVerifier
- scripts
- authService
- OpenCVMicroserviceClient
- PythonWsClient
- StreamHealthMonitor
- Backend
- OpenCV Service
- Product
- EventImageClassifierService
- dateResolver.ts
- CircuitBreaker
- PreviewService
- SentryVision — API Source of Truth
- Environment Variables
- faceClusterService.ts
- StreamSlotManager
- Critique — SentryVision frontend (session 2: ThreatBanner, login brand moment, streaming chat, empty-state art)
- blank_frame
- Security
- DetectionSettingsStore
- anomalyQuery.ts
- DOCS.md
- Complete Endpoint Inventory
- streamController
- 2026-09-25T10-50-52Z__frontend-next-src.md
- devDependencies
- chart-tokens.ts
- design-tokens.ts
- 2026-09-25T10-31-51Z__frontend-next-src.md
- AuthController.test.ts
- validation.ts
- ADR-001: Frontend State Management — Zustand over React Contexts
- fetchWithRetry
- NotificationPreferences
- TestMOG2MotionGate
- NotificationSubscription
- vehicleTimelineQuery.ts
- SentryVision Frontend Design Review
- tsconfig.typecheck.json
- create-test-image.ts
- detectionCleanupService
- DetectionConfig
- RateLimitCounter
- SecurityEventType
- EventMetadataWriter
- api.ts
- types/auth.ts
- analyticsController
- Frontend Service → Backend Endpoint Mapping
- extends
- scripts
- install.sh
- reviewController
- ChatLog
- FaceEmbedding
- HumanVerification
- SecurityEvent
- ServiceLog
- detection.ts
- ADR-002: Frontend Service Decomposition
- faceIdentityService.ts
- useWakeLock
- blank_frame_640_360
- <a id="capabilities"></a>🚀 Capabilities
- event.ts
- SentryVision — Home Security System
- next.config.mjs
- SentryVision Next frontend
- src/index.test.ts
- CreateUserSessionsTable1700000000000
- CreateEventsTable1702340575345
- AddDetectionIndexes1706582400000
- AddMissingEventColumns1738512000000
- types/camera.ts
- settings.json
- postcss.config.mjs
- tailwind.config.ts
- test-opencv.sh
- createMinimalJpeg
- go2rtc-entrypoint.sh
- dependencies
- diagnose.sh

## God Nodes (most connected - your core abstractions)
1. `cn()` - 121 edges
2. `logger` - 72 edges
3. `react` - 64 edges
4. `serviceRegistry` - 51 edges
5. `express` - 47 edges
6. `AppDataSource` - 41 edges
7. `typeorm` - 38 edges
8. `FramePipeline` - 36 edges
9. `Event` - 34 edges
10. `StreamManager` - 34 edges

## Surprising Connections (you probably didn't know these)
- `Critique-Driven Fixes (27 → 28/40, ready for 35+)` --references--> `PageContainer()`  [INFERRED]
  .claude/PLAN-100M.md → frontend-next/src/components/layout/PageContainer.tsx
- `Phase 1: Scaffold (Week 1)` --references--> `Shell()`  [INFERRED]
  docs/superpowers/specs/2026-09-24-frontend-revamp-design.md → frontend-next/src/components/layout/Shell.tsx
- `Workstream 2: Threat Banner — The Hero Moment (1–2 hr)` --references--> `useEvents()`  [INFERRED]
  .claude/PLAN-100M.md → frontend-next/src/hooks/useEvents.ts
- `Key Hooks` --references--> `useViewportStream()`  [INFERRED]
  FRONTEND.md → frontend-next/src/hooks/useViewportStream.ts
- `Consequences` --references--> `BaseController`  [INFERRED]
  ADR-003-route-consistency.md → server/src/controllers/BaseController.ts

## Import Cycles
- 3-file cycle: `server/src/services/serviceRegistry.ts -> server/src/streams/rtspManager.ts -> server/src/streams/streamHealthMonitor.ts -> server/src/services/serviceRegistry.ts`

## Communities (200 total, 65 thin omitted)

### Community 0 - "routes/index.ts"
Cohesion: 0.05
Nodes (59): JWTPayload, detectionDataController, ListParams, authenticate(), AuthOptions, express-serve-static-core, hasActiveSession(), invalidateSessionCache() (+51 more)

### Community 1 - "services.ts"
Cohesion: 0.05
Nodes (24): `notificationService.ts`, ws, BroadcastDetection, SceneDetection, router, setTimelapseService(), notificationLogRepository, NotificationPayload (+16 more)

### Community 2 - "frame_pipeline.py"
Cohesion: 0.08
Nodes (4): load_camera_config(), load_class_names(), connect_db(), verify_detections()

### Community 3 - "src/index.ts"
Cohesion: 0.05
Nodes (30): System Service Split, `systemService.ts`, compression, http-proxy-middleware, DetectionData, getFrontendDistPath(), __dirname, __filename (+22 more)

### Community 4 - "FramePipeline"
Cohesion: 0.06
Nodes (6): Pipeline Stages, ByteTracker, AdaptiveFrameProcessor, FramePipeline, IdentityCache, InProcessYOLO

### Community 5 - "EventsPage.tsx"
Cohesion: 0.08
Nodes (37): AnalyticsRoute(), metadata, EventsRoute(), metadata, metadata, SecurityRoute(), metadata, SettingsRoute() (+29 more)

### Community 6 - "cn"
Cohesion: 0.08
Nodes (38): DashboardPage(), metadata, Logo(), LogoMark(), ActiveVisitors(), Visitor, AdaptiveCameraGrid(), LiveCameraTile() (+30 more)

### Community 7 - "models/index.ts"
Cohesion: 0.07
Nodes (5): typeorm, PasswordHistory, Role, User, testDataSource

### Community 8 - "Settings.tsx"
Cohesion: 0.08
Nodes (37): FilterState, normalizeToISTBoundary(), QuickRangeOption, quickRangeOptions, SmartFilters(), SmartFiltersProps, MotionDetectionSettings, MotionDetectionSettingsHandle (+29 more)

### Community 9 - "sentryvision.sh"
Cohesion: 0.12
Nodes (46): backup.sh script, build_images(), check_dependencies(), check_user(), create_admin_user(), create_directories(), deploy(), generate_ssl_certificates() (+38 more)

### Community 11 - "server/package.json"
Cohesion: 0.04
Nodes (44): bcrypt, debug, express-rate-limit, ffmpeg-static, glob, multer, nodemon, qrcode (+36 more)

### Community 12 - "InsightsPage.tsx"
Cohesion: 0.09
Nodes (37): Migration Path, PageContainer(), PageContainerProps, Button, ButtonProps, EmptyState, EmptyStateProps, Input (+29 more)

### Community 13 - "batchProcessingWorker.ts"
Cohesion: 0.07
Nodes (19): MigrationManager, runMigrations(), { Client }, dedupDetections(), iou(), main(), FileMetadata, main() (+11 more)

### Community 14 - "config/index.ts"
Cohesion: 0.08
Nodes (29): socket.io, AppConfig, CameraConfig, CameraStreamConfig, DatabaseConfig, DetectConfig, __dirname, __filename (+21 more)

### Community 15 - "src/database.ts"
Cohesion: 0.09
Nodes (19): jsonwebtoken, AuthResult, User, gracefulShutdown(), initializeServices(), config, validateConfig(), AppDataSource (+11 more)

### Community 16 - "factories.ts"
Cohesion: 0.07
Nodes (12): AuditLogFactory, MockDataGenerator, PasswordHistoryFactory, RoleFactory, SessionFactory, TestAuditLog, TestHelpers, TestPasswordHistory (+4 more)

### Community 17 - "detection.py"
Cohesion: 0.08
Nodes (25): init_app(), require_api_token(), start_rtsp_service(), analyze_persons_route(), analyze_scene_route(), analyze_threat_route(), annotate_by_path_route(), detect_and_draw_route() (+17 more)

### Community 18 - "TimelapsePage.tsx"
Cohesion: 0.09
Nodes (33): 3. Cognitive Load Checklist, AIAnalysis, DetectionBoxV1, DetectionBoxV2, DetectionEntry, EventDetailPanel(), EventDetailPanelProps, formatConfidence() (+25 more)

### Community 19 - "Frontend Revamp Design Spec"
Cohesion: 0.05
Nodes (39): 10. Migration Strategy, 11. Constraints, 12. Success Criteria, 1. Problem Statement, 2. Goals, 3. Information Architecture, 4. Visual Design System, 5. Motion System (+31 more)

### Community 20 - "DropOldestQueue"
Cohesion: 0.07
Nodes (4): DropIfFullQueue, DropOldestQueue, TestDropIfFullQueue, TestDropOldestQueue

### Community 21 - "eventSearch/eventSearchService.ts"
Cohesion: 0.10
Nodes (11): Events — `/api/events`, Motion — `/api/motion`, eventController, EventSearchService, DetectionEventFilters, EventSearchFilters, EventSearchResponse, HistoryFilters (+3 more)

### Community 22 - "security.ts"
Cohesion: 0.08
Nodes (27): Key Hooks, getRelativeTime(), ThreatBanner(), AdaptiveCameraGridProps, useCameras(), camLog(), camWarn(), ConnectionState (+19 more)

### Community 23 - "detection/detectionService.ts"
Cohesion: 0.07
Nodes (14): ioredis, AdaptiveRegion, Timeline, CacheConfig, Redis, DEFAULT_LABELMAP, DEFAULT_THRESHOLDS, ThresholdConfig (+6 more)

### Community 24 - "dependencies"
Cohesion: 0.05
Nodes (37): dependencies, class-variance-authority, clsx, date-fns, @fontsource-variable/geist, @fontsource-variable/geist-mono, framer-motion, @hookform/resolvers (+29 more)

### Community 25 - "consolidatedDetectionService"
Cohesion: 0.09
Nodes (6): Detection — `/api/detection`, consolidatedDetectionService, MotionSettings, ObjectDetectionSettings, detectionService, ScoreHistory

### Community 26 - "Event"
Cohesion: 0.09
Nodes (11): DetectionResult, FaceDetection, Event, persistDetectionEvent(), EnhancedDetectionService, BoundingBox, DetectionStorageFormat, NormalizedDetection (+3 more)

### Community 27 - "download_all_models.py"
Cohesion: 0.10
Nodes (15): create_directory(), download_model(), download_with_progress(), main(), print_error(), print_header(), print_info(), print_success() (+7 more)

### Community 28 - "express"
Cohesion: 0.12
Nodes (14): express, BaseController, defaultSystemSettings, __dirname, __filename, instance, Alert, defaultSystemSettings (+6 more)

### Community 29 - "package.json"
Cohesion: 0.06
Nodes (32): eslint, @eslint/js, globals, jest, postcss, tailwindcss, ts-jest, tsx (+24 more)

### Community 30 - "cameraController"
Cohesion: 0.11
Nodes (10): ADR-003: Backend Route Consistency (MVC Enforcement), Alternatives Considered, Consequences, Context, Controller Standard, Decision, New Controllers to Create, Service Layer Extraction (+2 more)

### Community 31 - "automatedCleanupService.ts"
Cohesion: 0.09
Nodes (15): Migration, node-cron, { execSync }, { execSync }, fs, DB_DIR, __dirname, collectFromHtmlFile() (+7 more)

### Community 32 - "frontend-next/package.json"
Cohesion: 0.06
Nodes (31): eslint, postcss, tailwindcss, @types/node, @types/react, @types/react-dom, typescript, zod (+23 more)

### Community 33 - "TimelapseService"
Cohesion: 0.12
Nodes (3): FrameProvider, StreamManagerFrameProvider, TimelapseService

### Community 34 - "StreamManager"
Cohesion: 0.10
Nodes (4): Detection Pipeline, setupRTSPStreams(), StreamManager, generateTestJpegFrame()

### Community 35 - "WebSocketPublisher"
Cohesion: 0.10
Nodes (6): WebSocketPublisher, event_loop(), test_multiple_subscribers(), test_subscribe_and_receive_frames(), test_subscribe_unknown_camera_returns_error(), test_unsubscribe_stops_frame_delivery()

### Community 36 - "byte_tracker.py"
Cohesion: 0.11
Nodes (8): _bbox_iou(), _iou_cost_matrix(), KalmanBoxTracker, _linear_assignment(), _tlwh_to_tlbr(), _tlwh_to_xyah(), Track, _xyah_to_tlwh()

### Community 37 - "react"
Cohesion: 0.13
Nodes (19): ErrorPage(), ErrorBoundaryProps, ErrorBoundaryState, RouteError(), SHORTCUTS, OptimizationSettings(), Card, CardContent (+11 more)

### Community 38 - "logger.ts"
Cohesion: 0.10
Nodes (20): axios, DetectionResponse, DetectionClient, DEFAULT_FACIAL_RECOGNITION_SETTINGS, DEFAULT_MOTION_SETTINGS, DEFAULT_OBJECT_DETECTION_SETTINGS, FacialRecognitionSettings, EventMetadata (+12 more)

### Community 39 - "ReviewService"
Cohesion: 0.09
Nodes (6): ReviewSegment, UserReviewStatus, ALERT_LABELS, ReviewQuery, ReviewService, SegmentBundle

### Community 40 - "detectionRoutes.ts"
Cohesion: 0.13
Nodes (22): Middleware Stack, Middleware Stack, Middleware Stack, Rate Limiting, createApiRateLimit(), createAuthRateLimit(), createDetectionRateLimit(), createMfaRateLimit() (+14 more)

### Community 41 - "Design System: SentryVision"
Cohesion: 0.07
Nodes (28): Border Scale, Buttons, Cards / Containers, Chips / Badges, Colors, Components, Design System: SentryVision, Do: (+20 more)

### Community 42 - "dependencies"
Cohesion: 0.07
Nodes (29): dependencies, axios, bcrypt, compression, cors, debug, dotenv, express (+21 more)

### Community 43 - "Technical Notes"
Cohesion: 0.07
Nodes (26): Build & Deploy Cycle, Credentials (bootstrap.ts), Critique-Driven Fixes (27 → 28/40, ready for 35+), Design System Foundation, Docker Services, Impeccable Artifacts, Impeccable Skills Installed, Key File Locations (+18 more)

### Community 44 - "Shell.tsx"
Cohesion: 0.14
Nodes (22): ProtectedLayout(), AppFrame(), AuthLoading(), Clock(), isActive(), navItems, Shell(), SystemStatus() (+14 more)

### Community 45 - "devDependencies"
Cohesion: 0.07
Nodes (28): devDependencies, autoprefixer, concurrently, eslint, @eslint/js, eslint-plugin-react-hooks, eslint-plugin-react-refresh, globals (+20 more)

### Community 46 - "devDependencies"
Cohesion: 0.07
Nodes (27): devDependencies, eslint, @eslint/js, globals, jest, nodemon, supertest, ts-jest (+19 more)

### Community 47 - "LoginPage.tsx"
Cohesion: 0.14
Nodes (20): LoginRoute(), metadata, SectionTab, SectionWorkspace(), SectionWorkspaceProps, Alert, AlertDescription, AlertTitle (+12 more)

### Community 48 - "use-toast.ts"
Cohesion: 0.14
Nodes (22): Toast, ToastAction, ToastActionElement, ToastClose, ToastDescription, ToastProps, ToastTitle, toastVariants (+14 more)

### Community 49 - "scripts"
Cohesion: 0.08
Nodes (26): scripts, build, build:full, build:next, build:opencv, build:server, dev, dev:full (+18 more)

### Community 52 - "baseClient.ts"
Cohesion: 0.14
Nodes (14): API_URL, apiClient, ApiError, BACKEND_URL, NetworkError, TimeoutError, BackendCamera, LegacyBackendCamera (+6 more)

### Community 53 - "AskPage.tsx"
Cohesion: 0.16
Nodes (20): `chatService.ts`, AskRoute(), metadata, ChatEvidence, ChatHistoryEntry, ChatImage, ChatMessage, ChatResponse (+12 more)

### Community 55 - "LegacyRedirect"
Cohesion: 0.18
Nodes (11): LegacyAnalyticsPage(), LegacyAskPage(), LegacyEventsPage(), LegacyInsightsPage(), LegacyAppPage(), LegacyPeoplePage(), LegacySecurityPage(), LegacySettingsPage() (+3 more)

### Community 56 - "cronJobs.ts"
Cohesion: 0.16
Nodes (17): dotenv, getArchivePath(), initializeCron(), BatchJob, batchJobEntity, BatchJobSummary, ProcessedImage, processedImageEntity (+9 more)

### Community 57 - "SentryVision Release Notes"
Cohesion: 0.09
Nodes (21): Architecture & Hardening, Backend API Fixes, Breaking Changes, Bug Fixes, Class-Whitelisted YOLOv8n Detection, Fresh Install, From v1.5.0, Frontend (+13 more)

### Community 58 - "health.sh"
Cohesion: 0.39
Nodes (21): check_application_health(), check_backup_space(), check_database_health(), check_docker_services(), check_log_files(), check_redis_health(), check_ssl_certificate(), check_system_resources() (+13 more)

### Community 59 - "ChatController.ts"
Cohesion: 0.15
Nodes (12): AuthedUser, chatController, QueryResult, queryRegistry, ChatAnswer, ChatEvidence, ChatImage, ChatMessage (+4 more)

### Community 60 - "chat/chatService.ts"
Cohesion: 0.17
Nodes (18): chatLlm(), extractJsonObject(), answerFallback(), buildCaveat(), ChatError, classificationSchema, ClassifiedChatResult, classify() (+10 more)

### Community 61 - "useInsights.ts"
Cohesion: 0.13
Nodes (15): useInsights(), analyticsService, DayCount, HourCount, WeekCount, DaySummary, Highlight, HighlightsQuery (+7 more)

### Community 62 - "insightsService.ts"
Cohesion: 0.10
Nodes (19): BurstRow, CameraCount, CameraHourRow, ConfidenceStat, DailyTotals, emptyTotals, emptyWeekBaseline, GapRow (+11 more)

### Community 63 - "compilerOptions"
Cohesion: 0.10
Nodes (19): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+11 more)

### Community 65 - "compilerOptions"
Cohesion: 0.10
Nodes (19): compilerOptions, allowJs, allowSyntheticDefaultImports, declaration, esModuleInterop, experimentalDecorators, isolatedModules, module (+11 more)

### Community 66 - "providers.tsx"
Cohesion: 0.16
Nodes (11): geistMono, geistSans, metadata, RootLayout(), ErrorBoundary, AuthBootstrap(), Providers(), SocketBootstrap() (+3 more)

### Community 68 - "README.md"
Cohesion: 0.11
Nodes (18): <a id="architecture"></a>🏗 Architecture, <a id="docs"></a>📚 Documentation, <a id="quick-start"></a>⚡ Quick Start, 🙏 Acknowledgments, 🔧 Configuration, 🤝 Contributing, Default Credentials, Design Decisions That Matter (+10 more)

### Community 70 - "SentryVision Architecture"
Cohesion: 0.11
Nodes (17): Authentication & Security, Backend Data Flow, C4 Level 1 — System Context, C4 Level 2 — Container Diagram, C4 Level 3 — Backend Components, C4 Level 3 — Frontend Components, Container Details, Database Schema (Key Tables) (+9 more)

### Community 71 - "SocketService"
Cohesion: 0.17
Nodes (7): attemptTokenRefresh(), getAuthToken(), SocketCallback, SocketService, FaceDetectedEvent, PersonDetectedEvent, socket.io-client

### Community 72 - "cameraLoader.ts"
Cohesion: 0.19
Nodes (14): detectFromFiles(), convertLegacyCameraConfig(), decryptStreamPath(), __dirname, __filename, loadCamerasFromFile(), logSecurityEventDeferred(), setCameras() (+6 more)

### Community 73 - "backup.sh"
Cohesion: 0.39
Nodes (17): backup_database(), backup_files(), cleanup_old_database_backups(), cleanup_old_file_backups(), create_backup_dir(), decrypt_backup(), encrypt_backup(), list_backups() (+9 more)

### Community 74 - "queryTools.ts"
Cohesion: 0.15
Nodes (16): stripUnverifiedNumbers(), ALIAS_MAP, anomalies(), CameraActivityInput, classifyTrack(), detectDailyAnomalies(), EventCorrelationInput, HumanCountsParams (+8 more)

### Community 75 - "nvidiaController"
Cohesion: 0.26
Nodes (7): Detection Service Split, AI Analysis — `/api/nvidia`, nvidiaController, resolveCameraName(), safeJson(), analyzeImage(), analyzeWithBoundingBoxes()

### Community 76 - "Database"
Cohesion: 0.12
Nodes (16): Adding a Migration, Authentication, Backup, Connection, Core Detection, Database, Indexes, Key Queries (+8 more)

### Community 80 - "Contributing to SentryVision"
Cohesion: 0.12
Nodes (15): Architecture Rules, Backend, Backend Route Pattern, Code Conventions, Commit Messages, Contributing to SentryVision, Development Workflow, Frontend (+7 more)

### Community 81 - "database/package.json"
Cohesion: 0.12
Nodes (15): dependencies, pg, description, devDependencies, tsx, @types/pg, pg, tsx (+7 more)

### Community 82 - "eventBus"
Cohesion: 0.20
Nodes (5): eventBus, AppEvent, DetectionEvent, SystemEvent, TrackingEvent

### Community 85 - "nvidia/index.ts"
Cohesion: 0.19
Nodes (9): AnalysisConfig, analysisPipeline, imageLoader, ImageLoaderResult, BBOX_SYSTEM_PROMPT, PERSON_SYSTEM_PROMPT, SYSTEM_PROMPT, UNIFIED_SYSTEM_PROMPT (+1 more)

### Community 86 - "scan_and_embed"
Cohesion: 0.15
Nodes (8): append_checkpoint(), cluster_faces(), detect_face_in_roi(), load_checkpoint(), main(), save_to_db(), scan_and_embed(), write_status()

### Community 88 - "reindex-detection-files.cjs"
Cohesion: 0.21
Nodes (12): batchInsert(), { execSync }, fs, getExistingFiles(), getFileSize(), insertFile(), main(), parseFilename() (+4 more)

### Community 89 - "nvidiaClient.ts"
Cohesion: 0.21
Nodes (11): checkApiHealth(), callNvidiaApi(), ChatCompletionOptions, getEffectiveModel(), getModelFallbackChain(), getNvidiaBaseUrl(), nvidiaBreaker, parseLlmResponse() (+3 more)

### Community 90 - "initializeServices"
Cohesion: 0.22
Nodes (4): initializeServices(), BroadcastGate, SceneTracker, TrackDeduplicator

### Community 92 - "Changes"
Cohesion: 0.13
Nodes (13): 1. Migration `database/migrations/029_create_service_logs.sql`, 2. `server/src/models/ServiceLog.ts` entity + export in `models/index.ts`, 3. NEW `server/src/services/serviceLogService.ts`, 4. `server/src/utils/logger.ts`, 5. Python log shipping over the existing WebSocket, 6. `SystemController.getLogs/clearLogs` upgrade, 7. Retention, 8. `docker-compose.yml` (+5 more)

### Community 93 - "Frontend"
Cohesion: 0.14
Nodes (12): Real-time, Socket.io Events, Socket.io, Build, Deployment, Frontend, Key Files, Quick Start (+4 more)

### Community 94 - "Route Mount Map"
Cohesion: 0.18
Nodes (6): Alerts — `/api/alerts`, Route Mount Map, Controllers, alertController, detectionController, detectionImageController

### Community 96 - "DetectionCache"
Cohesion: 0.25
Nodes (3): DetectionCache, initialize(), RedisDetectionCache

### Community 98 - "reportGenerator.ts"
Cohesion: 0.19
Nodes (11): HumanCountsQuery, CONFIDENCE_FLOOR, HumanCountsInput, IST, collectReportStats(), fmtH(), fmtL(), reportMarkdown() (+3 more)

### Community 99 - "nvidiaProcessor.ts"
Cohesion: 0.23
Nodes (11): analyzePersons(), normalizeEntityArray(), buildResult(), drawBoundingBoxes(), normalizeBoxToPercent(), normalizeModelBoxes(), parseAIResponse(), parseRawBox() (+3 more)

### Community 100 - "settingsController"
Cohesion: 0.23
Nodes (6): Settings Service Split, Settings — `/api/settings`, `settingsService.ts`, loadSystemSettings(), saveSystemSettings(), settingsController

### Community 101 - "AGENTS.md"
Cohesion: 0.15
Nodes (12): Architecture, Backend Structure, Commands, Common Issues, Conventions, Database, Documentation, Environment Variables (+4 more)

### Community 102 - "authController"
Cohesion: 0.29
Nodes (3): Authentication — `/api/auth`, `authService.ts`, authController

### Community 103 - "add-known-person.ts"
Cohesion: 0.15
Nodes (7): DB_PATH, __dirname, __filename, addKnownPerson(), dbPath, __dirname, __filename

### Community 105 - "nvidia/types.ts"
Cohesion: 0.21
Nodes (8): aiResultNormalizer, BboxAnalysisResult, NvidiaApiError, NvidianalysisResult, PersonAttributeSummary, PersonDetectionResult, SensorMetadata, TrackSummary

### Community 109 - "scripts"
Cohesion: 0.17
Nodes (12): scripts, add-test-detections, batch-process, build, detect-from-files, dev, dev:old, docker:dev (+4 more)

### Community 114 - "Backend"
Cohesion: 0.18
Nodes (10): Authentication, Backend, Entry Point, go2rtc Proxy, Key Files, Memory Management, Python WebSocket Client, Quick Start (+2 more)

### Community 115 - "OpenCV Service"
Cohesion: 0.18
Nodes (11): Architecture, Confidence Thresholds, Detection Classes, go2rtc Integration, Health Check, Key Files, Known Faces, Models (+3 more)

### Community 116 - "Product"
Cohesion: 0.18
Nodes (11): Accessibility & Inclusion, Brand Commitments, Capabilities and Constraints, Evidence on Hand, Operating Context, Platform, Positioning, Product (+3 more)

### Community 118 - "dateResolver.ts"
Cohesion: 0.29
Nodes (10): resolveParamsRange(), fmtDay(), istDayStart(), istNow(), MAX_RANGE_DAYS, RangeToken, rangeTokenSchema, ResolvedRange (+2 more)

### Community 119 - "CircuitBreaker"
Cohesion: 0.24
Nodes (4): CircuitBreaker, CircuitBreakerOptions, CircuitState, getNvidiaBreakerState()

### Community 121 - "SentryVision — API Source of Truth"
Cohesion: 0.20
Nodes (9): Architecture Summary, Backend endpoints NOT called by any frontend service, ⚠️ Broken Calls (Frontend → Backend Mismatch), Fixed (2026-09-24), Frontend Routes, Key Contexts (React), Removed dead code (2026-09-24), SentryVision — API Source of Truth (+1 more)

### Community 122 - "Environment Variables"
Cohesion: 0.20
Nodes (9): Backend (Express), Detection Pipeline, Docker vs Local, Environment Variables, Frontend, Generating Secrets, go2rtc, LLM / AI Analysis (+1 more)

### Community 123 - "faceClusterService.ts"
Cohesion: 0.27
Nodes (5): ClusteringStatus, ClusteringStatusResponse, FaceCluster, faceClusterService, FaceClustersResponse

### Community 124 - "StreamSlotManager"
Cohesion: 0.20
Nodes (3): StreamSlotManager, useViewportStream(), UseViewportStreamConfig

### Community 125 - "Critique — SentryVision frontend (session 2: ThreatBanner, login brand moment, streaming chat, empty-state art)"
Cohesion: 0.20
Nodes (9): Critique — SentryVision frontend (session 2: ThreatBanner, login brand moment, streaming chat, empty-state art), Design Health Score, Design Specificity Verdict, Minor Observations, Overall Impression, Persona Red Flags, Priority Issues, Questions to Consider (+1 more)

### Community 126 - "blank_frame"
Cohesion: 0.24
Nodes (4): blank_frame(), camera_config(), mock_frame(), motion_frame()

### Community 127 - "Security"
Cohesion: 0.20
Nodes (9): Authentication, Authorization, Data Protection, Headers, Input Validation, Known Risks, Network, Security (+1 more)

### Community 129 - "anomalyQuery.ts"
Cohesion: 0.27
Nodes (6): AnomalyQuery, detectDailyAnomalies(), QueryHandler, AnomaliesInput, AnomalyResult, DailyCount

### Community 130 - "DOCS.md"
Cohesion: 0.22
Nodes (5): Architecture Decision Records (ADRs), Core Docs, Documentation Index, Quick Links, Reference

### Community 131 - "Complete Endpoint Inventory"
Cohesion: 0.22
Nodes (9): Chat — `/api/chat`, Complete Endpoint Inventory, Detection Data — `/api/detection-data`, Detection Redo — `/api/detection-redo`, Face Clusters — `/api/face-clusters`, Highlights — `/api/highlights`, Notifications — `/api/notifications`, Static Routes — `server/src/routes/staticRoutes.ts` (+1 more)

### Community 133 - "2026-09-25T10-50-52Z__frontend-next-src.md"
Cohesion: 0.22
Nodes (8): Design Health Score, Design Specificity Verdict, Minor Observations, Overall Impression, Persona Red Flags, Priority Issues, Questions to Consider, What's Working

### Community 134 - "devDependencies"
Cohesion: 0.22
Nodes (9): devDependencies, eslint, eslint-config-next, postcss, tailwindcss, @types/node, @types/react, @types/react-dom (+1 more)

### Community 135 - "chart-tokens.ts"
Cohesion: 0.22
Nodes (8): AXIS_STYLE, GRID_STYLE, SERIES, SEVERITY_COLORS, STATUS, THREAT, THREAT_COLORS, TOOLTIP_STYLE

### Community 136 - "design-tokens.ts"
Cohesion: 0.22
Nodes (8): bezier, colors, darkColors, darkTokens, lightTokens, radius, shadows, typography

### Community 137 - "2026-09-25T10-31-51Z__frontend-next-src.md"
Cohesion: 0.22
Nodes (8): Design Health Score, Design Specificity Verdict, Minor Observations, Overall Impression, Persona Red Flags, Priority Issues, Questions to Consider, What's Working

### Community 138 - "AuthController.test.ts"
Cohesion: 0.22
Nodes (7): mockAuthService, mockChangePassword, mockGenerateToken, mockGetUserById, mockLogin, mockRegister, mockVerifyToken

### Community 139 - "validation.ts"
Cohesion: 0.31
Nodes (6): validate(), validateObject(), validateType(), ValidationError, ValidationRule, ValidationSchema

### Community 140 - "ADR-001: Frontend State Management — Zustand over React Contexts"
Cohesion: 0.25
Nodes (7): ADR-001: Frontend State Management — Zustand over React Contexts, Alternatives Considered, Consequences, Context, Decision, Migration Path, Stores to Create

### Community 141 - "fetchWithRetry"
Cohesion: 0.64
Nodes (8): Decision, `baseClient.ts`, API Services, apiDelete(), apiGet(), apiPost(), apiPut(), fetchWithRetry()

### Community 145 - "vehicleTimelineQuery.ts"
Cohesion: 0.46
Nodes (6): VehicleTimelineQuery, clusterSessions(), fmtIstTime(), resolveVehicleClasses(), vehicleTimeline(), VehicleTimelineInput

### Community 146 - "SentryVision Frontend Design Review"
Cohesion: 0.29
Nodes (6): 1. Design Specificity, 2. Holistic Design, 4. Nielsen's 10 Heuristics, 5. Emotional Journey & Priority Issues, 6. Persona Red Flags, SentryVision Frontend Design Review

### Community 147 - "tsconfig.typecheck.json"
Cohesion: 0.29
Nodes (6): compilerOptions, incremental, exclude, extends, include, ./tsconfig.json

### Community 148 - "create-test-image.ts"
Cohesion: 0.29
Nodes (4): sharp, __dirname, eventsDir, __filename

### Community 152 - "SecurityEventType"
Cohesion: 0.29
Nodes (7): SecurityEventType, CREDENTIAL_DECRYPTION_FAILED, PLAINTEXT_CREDENTIALS_DETECTED, RATE_LIMIT_EXCEEDED, SUSPICIOUS_ACTIVITY, UNAUTHORIZED_ACCESS_ATTEMPT, VALIDATION_FAILED

### Community 154 - "api.ts"
Cohesion: 0.29
Nodes (6): ApiError, ApiResponse, ApiResult, PaginatedResponse, PaginationMeta, PaginationParams

### Community 155 - "types/auth.ts"
Cohesion: 0.29
Nodes (6): AuthResponse, AuthUser, ChangePasswordRequest, LoginRequest, RegisterRequest, UserRole

### Community 157 - "Frontend Service → Backend Endpoint Mapping"
Cohesion: 0.33
Nodes (6): `cameraService.ts`, `detectionService.ts`, `eventService.ts`, Frontend Service → Backend Endpoint Mapping, `insightsService.ts`, `personService.ts`

### Community 158 - "extends"
Cohesion: 0.33
Nodes (5): extends, rules, @next/next/no-img-element, next/core-web-vitals, next/typescript

### Community 159 - "scripts"
Cohesion: 0.33
Nodes (6): scripts, build, dev, lint, start, typecheck

### Community 160 - "install.sh"
Cohesion: 0.53
Nodes (4): err(), info(), install.sh script, step()

### Community 167 - "detection.ts"
Cohesion: 0.33
Nodes (5): DetectionResult, FaceDetection, FaceRecognitionSettings, MotionSettings, PersonDetectionSettings

### Community 168 - "ADR-002: Frontend Service Decomposition"
Cohesion: 0.40
Nodes (4): ADR-002: Frontend Service Decomposition, Alternatives Considered, Consequences, Context

### Community 169 - "faceIdentityService.ts"
Cohesion: 0.60
Nodes (3): FaceIdentitiesResponse, FaceIdentity, faceIdentityService

### Community 170 - "useWakeLock"
Cohesion: 0.50
Nodes (3): useWakeLock(), activate(), requestLock()

### Community 172 - "<a id="capabilities"></a>🚀 Capabilities"
Cohesion: 0.40
Nodes (5): <a id="capabilities"></a>🚀 Capabilities, Analytics & Intelligence, Enterprise Features, Live Streaming, Real-Time Intelligence

### Community 173 - "event.ts"
Cohesion: 0.40
Nodes (4): EventListFilters, EventResponse, EventRow, HistoryEventResponse

### Community 174 - "SentryVision — Home Security System"
Cohesion: 0.50
Nodes (3): Available Models, Commands, SentryVision — Home Security System

### Community 176 - "SentryVision Next frontend"
Cohesion: 0.50
Nodes (3): Development, SentryVision Next frontend, Verification

### Community 177 - "src/index.test.ts"
Cohesion: 0.50
Nodes (3): cors, helmet, supertest

### Community 183 - "types/camera.ts"
Cohesion: 0.50
Nodes (3): CameraResponse, CameraStatus, CameraStreamInfo

## Knowledge Gaps
- **1006 isolated node(s):** `$schema`, `permissions`, `__filename`, `__dirname`, `DB_PATH` (+1001 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 1601 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **65 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Detection Pipeline` connect `StreamManager` to `WebSocketPublisher`, `FramePipeline`, `AGENTS.md`, `FFmpegReader`, `HumanVerifier`, `MotionGate`, `PythonWsClient`?**
  _High betweenness centrality (0.246) - this node is a cross-community bridge._
- **Why does `PythonWsClient` connect `PythonWsClient` to `services.ts`, `StreamManager`, `initializeServices`?**
  _High betweenness centrality (0.209) - this node is a cross-community bridge._
- **Why does `WebSocketPublisher` connect `WebSocketPublisher` to `StreamManager`, `frame_pipeline.py`, `FramePipeline`, `DropOldestQueue`, `RTSPService`?**
  _High betweenness centrality (0.082) - this node is a cross-community bridge._
- **What connects `$schema`, `permissions`, `__filename` to the rest of the system?**
  _1006 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `routes/index.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.05479059093516925 - nodes in this community are weakly interconnected._
- **Should `services.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.05480769230769231 - nodes in this community are weakly interconnected._
- **Should `frame_pipeline.py` be split into smaller, more focused modules?**
  _Cohesion score 0.08166969147005444 - nodes in this community are weakly interconnected._