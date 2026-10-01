# Graph Report - sentryvision  (2026-10-01)

## Corpus Check
- 465 files · ~294,074 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 28 file(s) not represented in the graph (top: (none) 11, .onnx 3, .conf 2)

## Summary
- 4065 nodes · 7944 edges · 267 communities (181 shown, 86 thin omitted)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 259 edges (avg confidence: 0.93)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `73d62a1e`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- routes/index.ts
- detectionPersistence.ts
- frame_pipeline.py
- src/index.ts
- FramePipeline
- react
- cn
- User
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
- DropIfFullQueue
- eventSearch/eventSearchService.ts
- utils.ts
- services.ts
- dependencies
- serviceRegistry
- EventsPage.tsx
- download_all_models.py
- SystemController.ts
- package.json
- cameraController
- logger.ts
- frontend-next/package.json
- TimelapseService
- StreamManager
- WebSocketPublisher
- byte_tracker.py
- lucide-react
- migrations/003_create_detection_files_table.sql
- ReviewService
- EnhancedRateLimit
- Design System: SentryVision
- dependencies
- Technical Notes
- Shell.tsx
- devDependencies
- devDependencies
- backup/003_create_detection_files_table.sql
- use-toast.ts
- scripts
- ArcFaceRecognizer
- retentionPolicyService
- ApiError
- AskPage.tsx
- RTSPService
- LegacyRedirect
- models/index.ts
- SentryVision Release Notes
- health.sh
- ChatController.ts
- chat/chatService.ts
- useInsights.ts
- insightsService.ts
- compilerOptions
- cacheService
- compilerOptions
- 018_add_unknown_faces_tracking.sql
- 012_add_unknown_faces_tracking.sql
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
- NvidiaController.ts
- scan_and_embed
- SceneAnalyzer
- reindex-detection-files.cjs
- migrations/001_create_user_management.sql
- initializeServices
- InMemoryStateService
- Changes
- Frontend
- Route Mount Map
- PersonAnalyzer
- backup/001_create_user_management.sql
- ThreatDetector
- reportGenerator.ts
- 010_create_review_timeline_tables.sql
- settingsController
- AGENTS.md
- authController
- add-known-person.ts
- MetricsCollector
- 007_create_review_timeline_tables.sql
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
- 005_create_batch_processing.sql
- PreviewService
- SentryVision — API Source of Truth
- Environment Variables
- faceClusterService.ts
- StreamSlotManager
- Critique — SentryVision frontend (session 2: ThreatBanner, login brand moment, streaming chat, empty-state art)
- conftest.py
- Security
- DetectionSettingsStore
- anomalyQuery.ts
- Documentation Index
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
- baseClient.ts
- NotificationPreferences
- TestMOG2MotionGate
- NotificationService
- vehicleTimelineQuery.ts
- SentryVision Frontend Design Review
- tsconfig.typecheck.json
- create-test-image.ts
- detectionCleanupService
- 011_fix_missing_tables_and_mismatches.sql
- RateLimitCounter
- SecurityEventType
- EventMetadataWriter
- api.ts
- types/auth.ts
- 013_notifications.sql
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
- 004_create_batch_processing.sql
- 008_fix_missing_tables_and_mismatches.sql
- 009_notifications.sql
- StorageMigration
- ADR-003: Backend Route Consistency (MVC Enforcement)
- 007_create_visitor_tables.sql
- 016_add_visitors_table.sql
- 019_create_storage_stats.sql
- 020_recreate_storage_stats.sql
- 025_camera_settings_and_alerts.sql
- 005_create_visitor_tables.sql
- 011_add_visitors_table.sql
- 011_event_search_indexes.sql
- 013_create_storage_stats.sql
- 014_recreate_storage_stats.sql
- 019_camera_settings_and_alerts.sql
- MigrationManager
- make_pipeline
- 017_event_search_indexes.sql
- face_embeddings
- 022_rate_limit_counters.sql
- face_embeddings
- 016_rate_limit_counters.sql
- PasswordHistory
- human_verifications
- event_detections
- 009_enhance_events_table.sql
- 015_notification_preferences.sql
- security_events
- 023_ai_analysis_results.sql
- 026_create_cameras_table.sql
- 029_create_service_logs.sql
- 006_enhance_events_table.sql
- 010_notification_preferences.sql
- security_events
- 017_ai_analysis_results.sql
- 020_create_cameras_table.sql
- migrations/002_create_detection_cache_postgres.sql
- 004_create_events_table.sql
- 014_add_face_recognition_config.sql
- backup/002_create_detection_cache_postgres.sql
- 003_create_events_table.sql
- 010_add_face_recognition_config.sql
- <a id="quick-start"></a>⚡ Quick Start
- fix-person-counts.cjs
- detectionController
- chat_messages
- 1786610461000-CreateSecurityEvents.sql
- imageResolver
- idx_events_severity
- generateTestJpegFrame
- 028_create_detection_config.sql
- 030_create_system_settings.sql

## God Nodes (most connected - your core abstractions)
1. `cn()` - 121 edges
2. `logger` - 72 edges
3. `react` - 64 edges
4. `serviceRegistry` - 51 edges
5. `express` - 47 edges
6. `AppDataSource` - 41 edges
7. `FramePipeline` - 38 edges
8. `typeorm` - 38 edges
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

## Communities (267 total, 86 thin omitted)

### Community 0 - "routes/index.ts"
Cohesion: 0.05
Nodes (64): express, BaseController, detectionDataController, defaultSystemSettings, authenticate(), AuthOptions, express-serve-static-core, hasActiveSession() (+56 more)

### Community 1 - "detectionPersistence.ts"
Cohesion: 0.12
Nodes (13): ws, BroadcastDetection, SceneDetection, FrameMessage, FrameMetadata, HumanVerification, SubscriptionMessage, TrackingEvent (+5 more)

### Community 2 - "frame_pipeline.py"
Cohesion: 0.07
Nodes (8): load_camera_config(), load_class_names(), get_db_connection(), process_images(), update_file_metadata(), YOLOObjectDetector, connect_db(), verify_detections()

### Community 3 - "src/index.ts"
Cohesion: 0.06
Nodes (33): compression, http-proxy-middleware, detectFromFiles(), DetectionData, FileMetadata, MigrationResult, collectFromHtmlFile(), collectInlineScriptHashes() (+25 more)

### Community 4 - "FramePipeline"
Cohesion: 0.06
Nodes (4): AdaptiveFrameProcessor, FramePipeline, IdentityCache, InProcessYOLO

### Community 5 - "react"
Cohesion: 0.08
Nodes (41): AnalyticsRoute(), metadata, EventsRoute(), metadata, metadata, SecurityRoute(), metadata, SettingsRoute() (+33 more)

### Community 6 - "cn"
Cohesion: 0.11
Nodes (28): Logo(), LogoMark(), ErrorBoundaryProps, ErrorBoundaryState, OptimizationSettings(), Card, CardContent, CardDescription (+20 more)

### Community 7 - "User"
Cohesion: 0.10
Nodes (3): Role, User, testDataSource

### Community 8 - "Settings.tsx"
Cohesion: 0.08
Nodes (38): 3. Cognitive Load Checklist, FilterState, normalizeToISTBoundary(), QuickRangeOption, quickRangeOptions, SmartFilters(), SmartFiltersProps, MotionDetectionSettings (+30 more)

### Community 9 - "sentryvision.sh"
Cohesion: 0.12
Nodes (46): backup.sh script, build_images(), check_dependencies(), check_user(), create_admin_user(), create_directories(), deploy(), generate_ssl_certificates() (+38 more)

### Community 11 - "server/package.json"
Cohesion: 0.04
Nodes (45): bcrypt, debug, express-rate-limit, ffmpeg-static, glob, ioredis, multer, nodemon (+37 more)

### Community 12 - "InsightsPage.tsx"
Cohesion: 0.10
Nodes (35): PageContainer(), PageContainerProps, Button, buttonVariants, EmptyState, EmptyStateProps, Input, useFaceIdentities() (+27 more)

### Community 13 - "batchProcessingWorker.ts"
Cohesion: 0.22
Nodes (9): generateFileHash(), main(), opencvService, processBatchImages(), saveResults(), SimpleOpenCVClient, updateProcessedImagesTable(), WorkerData (+1 more)

### Community 14 - "config/index.ts"
Cohesion: 0.05
Nodes (50): dotenv, jsonwebtoken, node-cron, socket.io, AuthResult, JWTPayload, User, gracefulShutdown() (+42 more)

### Community 15 - "src/database.ts"
Cohesion: 0.04
Nodes (42): axios, CameraConfig, ListParams, AppDataSource, __dirname, entityFiles, __filename, initializeDatabase() (+34 more)

### Community 16 - "factories.ts"
Cohesion: 0.07
Nodes (12): AuditLogFactory, MockDataGenerator, PasswordHistoryFactory, RoleFactory, SessionFactory, TestAuditLog, TestHelpers, TestPasswordHistory (+4 more)

### Community 17 - "detection.py"
Cohesion: 0.08
Nodes (25): init_app(), require_api_token(), start_rtsp_service(), analyze_persons_route(), analyze_scene_route(), analyze_threat_route(), annotate_by_path_route(), detect_and_draw_route() (+17 more)

### Community 18 - "TimelapsePage.tsx"
Cohesion: 0.09
Nodes (32): AIAnalysis, DetectionBoxV1, DetectionBoxV2, DetectionEntry, EventDetailPanel(), EventDetailPanelProps, formatConfidence(), normalizeBoundingBox() (+24 more)

### Community 19 - "Frontend Revamp Design Spec"
Cohesion: 0.05
Nodes (39): 10. Migration Strategy, 11. Constraints, 12. Success Criteria, 1. Problem Statement, 2. Goals, 3. Information Architecture, 4. Visual Design System, 5. Motion System (+31 more)

### Community 21 - "eventSearch/eventSearchService.ts"
Cohesion: 0.10
Nodes (10): Events — `/api/events`, Motion — `/api/motion`, eventController, EventSearchService, DetectionEventFilters, EventSearchFilters, EventSearchResponse, HistoryFilters (+2 more)

### Community 22 - "utils.ts"
Cohesion: 0.06
Nodes (45): Key Hooks, DashboardPage(), metadata, getRelativeTime(), ThreatBanner(), ActiveVisitors(), Visitor, AdaptiveCameraGrid() (+37 more)

### Community 23 - "services.ts"
Cohesion: 0.04
Nodes (27): DetectionResult, EnhancedRateLimitOptions, AdaptiveRegion, DetectionConfig, Event, EventDetection, Timeline, CameraDetectionConfigSchema (+19 more)

### Community 24 - "dependencies"
Cohesion: 0.05
Nodes (37): dependencies, class-variance-authority, clsx, date-fns, @fontsource-variable/geist, @fontsource-variable/geist-mono, framer-motion, @hookform/resolvers (+29 more)

### Community 25 - "serviceRegistry"
Cohesion: 0.07
Nodes (10): Detection — `/api/detection`, consolidatedDetectionService, DetectionResponse, FaceDetection, FacialRecognitionSettings, MotionSettings, ObjectDetectionSettings, detectionService (+2 more)

### Community 26 - "EventsPage.tsx"
Cohesion: 0.17
Nodes (19): Migration Path, ButtonProps, Pagination(), PaginationContent, PaginationEllipsis(), PaginationItem, PaginationLink(), PaginationLinkProps (+11 more)

### Community 27 - "download_all_models.py"
Cohesion: 0.17
Nodes (11): create_directory(), download_model(), download_with_progress(), main(), print_error(), print_header(), print_info(), print_success() (+3 more)

### Community 28 - "SystemController.ts"
Cohesion: 0.17
Nodes (9): __dirname, __filename, Alert, defaultSystemSettings, GeneralSettings, MotionEvent, NotificationSettings, StorageSettings (+1 more)

### Community 29 - "package.json"
Cohesion: 0.06
Nodes (32): eslint, @eslint/js, globals, jest, postcss, tailwindcss, ts-jest, tsx (+24 more)

### Community 31 - "logger.ts"
Cohesion: 0.08
Nodes (20): Migration, { execSync }, { execSync }, fs, DB_DIR, __dirname, CleanupResult, CleanupStats (+12 more)

### Community 32 - "frontend-next/package.json"
Cohesion: 0.07
Nodes (28): eslint, postcss, tailwindcss, @types/node, @types/react, @types/react-dom, typescript, zod (+20 more)

### Community 33 - "TimelapseService"
Cohesion: 0.12
Nodes (3): FrameProvider, StreamManagerFrameProvider, TimelapseService

### Community 34 - "StreamManager"
Cohesion: 0.12
Nodes (3): Detection Pipeline, setupRTSPStreams(), StreamManager

### Community 35 - "WebSocketPublisher"
Cohesion: 0.06
Nodes (9): DropOldestQueue, WebSocketPublisher, FakePublisher, TestDropOldestQueue, event_loop(), test_multiple_subscribers(), test_subscribe_and_receive_frames(), test_subscribe_unknown_camera_returns_error() (+1 more)

### Community 36 - "byte_tracker.py"
Cohesion: 0.09
Nodes (10): Pipeline Stages, _bbox_iou(), ByteTracker, _iou_cost_matrix(), KalmanBoxTracker, _linear_assignment(), _tlwh_to_tlbr(), _tlwh_to_xyah() (+2 more)

### Community 37 - "lucide-react"
Cohesion: 0.24
Nodes (4): ErrorPage(), RouteError(), SHORTCUTS, lucide-react

### Community 38 - "migrations/003_create_detection_files_table.sql"
Cohesion: 0.16
Nodes (14): calculate_storage_stats(), detection_files, idx_detection_files_camera_id, idx_detection_files_capture_timestamp, idx_detection_files_created_at, idx_detection_files_file_type, idx_detection_files_is_archived, idx_detection_files_is_deleted (+6 more)

### Community 39 - "ReviewService"
Cohesion: 0.10
Nodes (6): ReviewSegment, UserReviewStatus, ALERT_LABELS, ReviewQuery, ReviewService, SegmentBundle

### Community 40 - "EnhancedRateLimit"
Cohesion: 0.32
Nodes (11): Middleware Stack, Middleware Stack, Middleware Stack, Rate Limiting, createApiRateLimit(), createAuthRateLimit(), createDetectionRateLimit(), createMfaRateLimit() (+3 more)

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
Cohesion: 0.07
Nodes (37): ProtectedLayout(), geistMono, geistSans, metadata, RootLayout(), ErrorBoundary, AppFrame(), AuthLoading() (+29 more)

### Community 45 - "devDependencies"
Cohesion: 0.07
Nodes (28): devDependencies, autoprefixer, concurrently, eslint, @eslint/js, eslint-plugin-react-hooks, eslint-plugin-react-refresh, globals (+20 more)

### Community 46 - "devDependencies"
Cohesion: 0.07
Nodes (27): devDependencies, eslint, @eslint/js, globals, jest, nodemon, supertest, ts-jest (+19 more)

### Community 47 - "backup/003_create_detection_files_table.sql"
Cohesion: 0.16
Nodes (14): calculate_storage_stats(), detection_files, idx_detection_files_camera_id, idx_detection_files_capture_timestamp, idx_detection_files_created_at, idx_detection_files_file_type, idx_detection_files_is_archived, idx_detection_files_is_deleted (+6 more)

### Community 48 - "use-toast.ts"
Cohesion: 0.14
Nodes (23): Toast, ToastAction, ToastActionElement, ToastClose, ToastDescription, ToastProps, ToastTitle, toastVariants (+15 more)

### Community 49 - "scripts"
Cohesion: 0.08
Nodes (26): scripts, build, build:full, build:next, build:opencv, build:server, dev, dev:full (+18 more)

### Community 50 - "ArcFaceRecognizer"
Cohesion: 0.07
Nodes (6): ArcFaceRecognizer, DetectionCache, initialize(), MotionDetector, RedisDetectionCache, YOLOObjectDetector

### Community 52 - "ApiError"
Cohesion: 0.12
Nodes (15): API_URL, apiClient, ApiError, BackendCamera, LegacyBackendCamera, MotionSettings, detectionService, NotificationPreferences (+7 more)

### Community 53 - "AskPage.tsx"
Cohesion: 0.16
Nodes (20): `chatService.ts`, AskRoute(), metadata, ChatEvidence, ChatHistoryEntry, ChatImage, ChatMessage, ChatResponse (+12 more)

### Community 55 - "LegacyRedirect"
Cohesion: 0.18
Nodes (11): LegacyAnalyticsPage(), LegacyAskPage(), LegacyEventsPage(), LegacyInsightsPage(), LegacyAppPage(), LegacyPeoplePage(), LegacySecurityPage(), LegacySettingsPage() (+3 more)

### Community 57 - "SentryVision Release Notes"
Cohesion: 0.09
Nodes (21): Architecture & Hardening, Backend API Fixes, Breaking Changes, Bug Fixes, Class-Whitelisted YOLOv8n Detection, Fresh Install, From v1.5.0, Frontend (+13 more)

### Community 58 - "health.sh"
Cohesion: 0.39
Nodes (21): check_application_health(), check_backup_space(), check_database_health(), check_docker_services(), check_log_files(), check_redis_health(), check_ssl_certificate(), check_system_resources() (+13 more)

### Community 59 - "ChatController.ts"
Cohesion: 0.19
Nodes (9): AuthedUser, chatController, ChatAnswer, ChatEvidence, ChatMessage, ChatRequest, ChatResponse, ToolEvidence (+1 more)

### Community 60 - "chat/chatService.ts"
Cohesion: 0.19
Nodes (16): chatLlm(), extractJsonObject(), answerFallback(), buildCaveat(), ChatError, classificationSchema, ClassifiedChatResult, classify() (+8 more)

### Community 61 - "useInsights.ts"
Cohesion: 0.13
Nodes (14): analyticsService, DayCount, HourCount, WeekCount, DaySummary, Highlight, HighlightsQuery, HighlightsResponse (+6 more)

### Community 62 - "insightsService.ts"
Cohesion: 0.10
Nodes (19): BurstRow, CameraCount, CameraHourRow, ConfidenceStat, DailyTotals, emptyTotals, emptyWeekBaseline, GapRow (+11 more)

### Community 63 - "compilerOptions"
Cohesion: 0.10
Nodes (19): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+11 more)

### Community 65 - "compilerOptions"
Cohesion: 0.10
Nodes (19): compilerOptions, allowJs, allowSyntheticDefaultImports, declaration, esModuleInterop, experimentalDecorators, isolatedModules, module (+11 more)

### Community 66 - "018_add_unknown_faces_tracking.sql"
Cohesion: 0.21
Nodes (15): idx_unknown_face_alerts_created, idx_unknown_face_alerts_detection, idx_unknown_face_alerts_severity, idx_unknown_face_alerts_status, idx_unknown_face_detections_camera, idx_unknown_face_detections_event, idx_unknown_face_detections_marked_visitor, idx_unknown_face_detections_similarity (+7 more)

### Community 67 - "012_add_unknown_faces_tracking.sql"
Cohesion: 0.21
Nodes (15): idx_unknown_face_alerts_created, idx_unknown_face_alerts_detection, idx_unknown_face_alerts_severity, idx_unknown_face_alerts_status, idx_unknown_face_detections_camera, idx_unknown_face_detections_event, idx_unknown_face_detections_marked_visitor, idx_unknown_face_detections_similarity (+7 more)

### Community 68 - "README.md"
Cohesion: 0.12
Nodes (13): <a id="architecture"></a>🏗 Architecture, <a id="docs"></a>📚 Documentation, 🙏 Acknowledgments, 🔧 Configuration, 🤝 Contributing, Design Decisions That Matter, Detection Pipeline (Runs Entirely in Python), 📄 License (+5 more)

### Community 70 - "SentryVision Architecture"
Cohesion: 0.11
Nodes (17): Authentication & Security, Backend Data Flow, C4 Level 1 — System Context, C4 Level 2 — Container Diagram, C4 Level 3 — Backend Components, C4 Level 3 — Frontend Components, Container Details, Database Schema (Key Tables) (+9 more)

### Community 71 - "SocketService"
Cohesion: 0.19
Nodes (5): SocketCallback, SocketService, FaceDetectedEvent, PersonDetectedEvent, socket.io-client

### Community 72 - "cameraLoader.ts"
Cohesion: 0.25
Nodes (12): convertLegacyCameraConfig(), decryptStreamPath(), __dirname, __filename, loadCamerasFromFile(), logSecurityEventDeferred(), decryptCredential(), encryptCredential() (+4 more)

### Community 73 - "backup.sh"
Cohesion: 0.39
Nodes (17): backup_database(), backup_files(), cleanup_old_database_backups(), cleanup_old_file_backups(), create_backup_dir(), decrypt_backup(), encrypt_backup(), list_backups() (+9 more)

### Community 74 - "queryTools.ts"
Cohesion: 0.15
Nodes (16): stripUnverifiedNumbers(), ALIAS_MAP, anomalies(), CameraActivityInput, classifyTrack(), detectDailyAnomalies(), EventCorrelationInput, HumanCountsParams (+8 more)

### Community 75 - "nvidiaController"
Cohesion: 0.26
Nodes (6): Detection Service Split, AI Analysis — `/api/nvidia`, nvidiaController, resolveCameraName(), safeJson(), analyzeWithBoundingBoxes()

### Community 76 - "Database"
Cohesion: 0.12
Nodes (16): Adding a Migration, Authentication, Backup, Connection, Core Detection, Database, Indexes, Key Queries (+8 more)

### Community 80 - "Contributing to SentryVision"
Cohesion: 0.13
Nodes (15): Architecture Rules, Backend, Backend Route Pattern, Code Conventions, Commit Messages, Contributing to SentryVision, Development Workflow, Frontend (+7 more)

### Community 81 - "database/package.json"
Cohesion: 0.12
Nodes (15): dependencies, pg, description, devDependencies, tsx, @types/pg, pg, tsx (+7 more)

### Community 82 - "eventBus"
Cohesion: 0.20
Nodes (5): eventBus, AppEvent, DetectionEvent, SystemEvent, TrackingEvent

### Community 85 - "NvidiaController.ts"
Cohesion: 0.07
Nodes (42): aiResultNormalizer, AnalysisConfig, analysisPipeline, imageLoader, ImageLoaderResult, EventMetadata, analyzeImage(), analyzePersons() (+34 more)

### Community 86 - "scan_and_embed"
Cohesion: 0.15
Nodes (8): append_checkpoint(), cluster_faces(), detect_face_in_roi(), load_checkpoint(), main(), save_to_db(), scan_and_embed(), write_status()

### Community 88 - "reindex-detection-files.cjs"
Cohesion: 0.21
Nodes (12): batchInsert(), { execSync }, fs, getExistingFiles(), getFileSize(), insertFile(), main(), parseFilename() (+4 more)

### Community 89 - "migrations/001_create_user_management.sql"
Cohesion: 0.25
Nodes (15): audit_logs, idx_audit_logs_action, idx_audit_logs_timestamp, idx_audit_logs_user_id, idx_password_history_user_id, idx_user_sessions_expires_at, idx_user_sessions_refresh_token, idx_user_sessions_user_id (+7 more)

### Community 90 - "initializeServices"
Cohesion: 0.27
Nodes (4): initializeServices(), BroadcastGate, SceneTracker, TrackDeduplicator

### Community 92 - "Changes"
Cohesion: 0.13
Nodes (13): 1. Migration `database/migrations/029_create_service_logs.sql`, 2. `server/src/models/ServiceLog.ts` entity + export in `models/index.ts`, 3. NEW `server/src/services/serviceLogService.ts`, 4. `server/src/utils/logger.ts`, 5. Python log shipping over the existing WebSocket, 6. `SystemController.getLogs/clearLogs` upgrade, 7. Retention, 8. `docker-compose.yml` (+5 more)

### Community 93 - "Frontend"
Cohesion: 0.14
Nodes (12): Socket.io Events, Socket.io Events, Socket.io, Build, Deployment, Frontend, Key Files, Quick Start (+4 more)

### Community 94 - "Route Mount Map"
Cohesion: 0.20
Nodes (7): Alerts — `/api/alerts`, Analytics — `/api/analytics`, Route Mount Map, Controllers, alertController, analyticsController, detectionImageController

### Community 96 - "backup/001_create_user_management.sql"
Cohesion: 0.25
Nodes (15): audit_logs, idx_audit_logs_action, idx_audit_logs_timestamp, idx_audit_logs_user_id, idx_password_history_user_id, idx_user_sessions_expires_at, idx_user_sessions_refresh_token, idx_user_sessions_user_id (+7 more)

### Community 98 - "reportGenerator.ts"
Cohesion: 0.19
Nodes (11): HumanCountsQuery, CONFIDENCE_FLOOR, HumanCountsInput, IST, collectReportStats(), fmtH(), fmtL(), reportMarkdown() (+3 more)

### Community 99 - "010_create_review_timeline_tables.sql"
Cohesion: 0.24
Nodes (12): adaptive_regions, idx_review_segments_camera_start, idx_review_segments_labels, idx_review_segments_severity, idx_timeline_camera_timestamp, idx_timeline_class_type, idx_timeline_source_id, idx_timeline_source_timestamp (+4 more)

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

### Community 105 - "007_create_review_timeline_tables.sql"
Cohesion: 0.24
Nodes (12): adaptive_regions, idx_review_segments_camera_start, idx_review_segments_labels, idx_review_segments_severity, idx_timeline_camera_timestamp, idx_timeline_class_type, idx_timeline_source_id, idx_timeline_source_timestamp (+4 more)

### Community 109 - "scripts"
Cohesion: 0.17
Nodes (12): scripts, add-test-detections, batch-process, build, detect-from-files, dev, dev:old, docker:dev (+4 more)

### Community 111 - "OpenCVMicroserviceClient"
Cohesion: 0.14
Nodes (3): CircuitBreaker, getNvidiaBreakerState(), OpenCVMicroserviceClient

### Community 114 - "Backend"
Cohesion: 0.18
Nodes (10): Authentication, Backend, Entry Point, go2rtc Proxy, Key Files, Memory Management, Python WebSocket Client, Quick Start (+2 more)

### Community 115 - "OpenCV Service"
Cohesion: 0.17
Nodes (11): Architecture, Confidence Thresholds, Detection Classes, go2rtc Integration, Health Check, Key Files, Known Faces, Models (+3 more)

### Community 116 - "Product"
Cohesion: 0.18
Nodes (11): Accessibility & Inclusion, Brand Commitments, Capabilities and Constraints, Evidence on Hand, Operating Context, Platform, Positioning, Product (+3 more)

### Community 118 - "dateResolver.ts"
Cohesion: 0.29
Nodes (10): resolveParamsRange(), fmtDay(), istDayStart(), istNow(), MAX_RANGE_DAYS, RangeToken, rangeTokenSchema, ResolvedRange (+2 more)

### Community 119 - "005_create_batch_processing.sql"
Cohesion: 0.35
Nodes (10): batch_jobs, idx_batch_jobs_created_at, idx_batch_jobs_status, idx_processed_images_camera_id, idx_processed_images_file_hash, idx_processed_images_file_hash_unique, idx_processed_images_filename, idx_processed_images_job_id (+2 more)

### Community 121 - "SentryVision — API Source of Truth"
Cohesion: 0.22
Nodes (8): Architecture Summary, Backend endpoints NOT called by any frontend service, ⚠️ Broken Calls (Frontend → Backend Mismatch), Fixed (2026-09-24), Frontend Routes, Key Contexts (React), Removed dead code (2026-09-24), SentryVision — API Source of Truth

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

### Community 126 - "conftest.py"
Cohesion: 0.24
Nodes (4): blank_frame(), camera_config(), mock_frame(), motion_frame()

### Community 127 - "Security"
Cohesion: 0.20
Nodes (9): Authentication, Authorization, Data Protection, Headers, Input Validation, Known Risks, Network, Security (+1 more)

### Community 129 - "anomalyQuery.ts"
Cohesion: 0.18
Nodes (10): AnomalyQuery, detectDailyAnomalies(), QueryHandler, QueryResult, queryRegistry, AnomaliesInput, AnomalyResult, DailyCount (+2 more)

### Community 130 - "Documentation Index"
Cohesion: 0.40
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

### Community 141 - "baseClient.ts"
Cohesion: 0.25
Nodes (14): Decision, `baseClient.ts`, API Services, apiDelete(), apiGet(), apiPost(), apiPut(), attemptTokenRefresh() (+6 more)

### Community 144 - "NotificationService"
Cohesion: 0.12
Nodes (3): NotificationSubscription, persistDetectionEvent(), NotificationService

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

### Community 150 - "011_fix_missing_tables_and_mismatches.sql"
Cohesion: 0.31
Nodes (10): adaptive_regions, idx_review_segments_camera_start, idx_review_segments_labels, idx_review_segments_severity, idx_visitor_timeline_camera_id, idx_visitor_timeline_date, idx_visitor_timeline_first_seen, idx_visitor_timeline_visitor_type (+2 more)

### Community 152 - "SecurityEventType"
Cohesion: 0.29
Nodes (7): SecurityEventType, CREDENTIAL_DECRYPTION_FAILED, PLAINTEXT_CREDENTIALS_DETECTED, RATE_LIMIT_EXCEEDED, SUSPICIOUS_ACTIVITY, UNAUTHORIZED_ACCESS_ATTEMPT, VALIDATION_FAILED

### Community 154 - "api.ts"
Cohesion: 0.29
Nodes (6): ApiError, ApiResponse, ApiResult, PaginatedResponse, PaginationMeta, PaginationParams

### Community 155 - "types/auth.ts"
Cohesion: 0.29
Nodes (6): AuthResponse, AuthUser, ChangePasswordRequest, LoginRequest, RegisterRequest, UserRole

### Community 156 - "013_notifications.sql"
Cohesion: 0.31
Nodes (8): idx_notification_logs_created_at, idx_notification_logs_event_id, idx_notification_logs_status, idx_notification_logs_user_id, idx_notification_subscriptions_is_active, idx_notification_subscriptions_user_id, notification_logs, notification_subscriptions

### Community 157 - "Frontend Service → Backend Endpoint Mapping"
Cohesion: 0.18
Nodes (9): System Service Split, `cameraService.ts`, `detectionService.ts`, `eventService.ts`, Frontend Service → Backend Endpoint Mapping, `insightsService.ts`, `notificationService.ts`, `personService.ts` (+1 more)

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

### Community 200 - "004_create_batch_processing.sql"
Cohesion: 0.35
Nodes (10): batch_jobs, idx_batch_jobs_created_at, idx_batch_jobs_status, idx_processed_images_camera_id, idx_processed_images_file_hash, idx_processed_images_file_hash_unique, idx_processed_images_filename, idx_processed_images_job_id (+2 more)

### Community 201 - "008_fix_missing_tables_and_mismatches.sql"
Cohesion: 0.31
Nodes (10): adaptive_regions, idx_review_segments_camera_start, idx_review_segments_labels, idx_review_segments_severity, idx_visitor_timeline_camera_id, idx_visitor_timeline_date, idx_visitor_timeline_first_seen, idx_visitor_timeline_visitor_type (+2 more)

### Community 202 - "009_notifications.sql"
Cohesion: 0.31
Nodes (8): idx_notification_logs_created_at, idx_notification_logs_event_id, idx_notification_logs_status, idx_notification_logs_user_id, idx_notification_subscriptions_is_active, idx_notification_subscriptions_user_id, notification_logs, notification_subscriptions

### Community 204 - "ADR-003: Backend Route Consistency (MVC Enforcement)"
Cohesion: 0.20
Nodes (8): ADR-003: Backend Route Consistency (MVC Enforcement), Alternatives Considered, Consequences, Context, Controller Standard, Decision, New Controllers to Create, Service Layer Extraction

### Community 205 - "007_create_visitor_tables.sql"
Cohesion: 0.33
Nodes (9): idx_visitor_reports_type_period, idx_visitor_schedules_enabled, idx_visitor_timeline_camera, idx_visitor_timeline_date, idx_visitor_timeline_first_seen, idx_visitor_timeline_visitor_type, visitor_reports, visitor_schedules (+1 more)

### Community 206 - "016_add_visitors_table.sql"
Cohesion: 0.36
Nodes (8): idx_visitor_events_event, idx_visitor_events_visitor, idx_visitors_active, idx_visitors_last_seen, idx_visitors_name, idx_visitors_type, visitor_events, visitors

### Community 207 - "019_create_storage_stats.sql"
Cohesion: 0.36
Nodes (8): idx_storage_stats_camera, idx_storage_stats_camera_category, idx_storage_stats_category, idx_storage_stats_category_global, idx_storage_stats_created_at, idx_storage_stats_last_calculated, storage_stats, trigger_update_storage_stats_updated_at

### Community 208 - "020_recreate_storage_stats.sql"
Cohesion: 0.36
Nodes (8): idx_storage_stats_camera, idx_storage_stats_camera_category, idx_storage_stats_category, idx_storage_stats_category_global, idx_storage_stats_created_at, idx_storage_stats_last_calculated, storage_stats, trigger_update_storage_stats_updated_at

### Community 209 - "025_camera_settings_and_alerts.sql"
Cohesion: 0.33
Nodes (8): alerts, camera_settings, idx_alerts_acknowledged, idx_alerts_camera_created, idx_alerts_created_at, idx_camera_settings_updated_at, trigger_update_alerts_updated_at, trigger_update_camera_settings_updated_at

### Community 210 - "005_create_visitor_tables.sql"
Cohesion: 0.33
Nodes (9): idx_visitor_reports_type_period, idx_visitor_schedules_enabled, idx_visitor_timeline_camera, idx_visitor_timeline_date, idx_visitor_timeline_first_seen, idx_visitor_timeline_visitor_type, visitor_reports, visitor_schedules (+1 more)

### Community 211 - "011_add_visitors_table.sql"
Cohesion: 0.36
Nodes (8): idx_visitor_events_event, idx_visitor_events_visitor, idx_visitors_active, idx_visitors_last_seen, idx_visitors_name, idx_visitors_type, visitor_events, visitors

### Community 212 - "011_event_search_indexes.sql"
Cohesion: 0.36
Nodes (8): idx_events_camera_id, idx_events_confidence, idx_events_confidence_timestamp, idx_events_event_type, idx_events_face_status, idx_events_recent, idx_events_timestamp_camera, idx_events_type_timestamp

### Community 213 - "013_create_storage_stats.sql"
Cohesion: 0.36
Nodes (8): idx_storage_stats_camera, idx_storage_stats_camera_category, idx_storage_stats_category, idx_storage_stats_category_global, idx_storage_stats_created_at, idx_storage_stats_last_calculated, storage_stats, trigger_update_storage_stats_updated_at

### Community 214 - "014_recreate_storage_stats.sql"
Cohesion: 0.36
Nodes (8): idx_storage_stats_camera, idx_storage_stats_camera_category, idx_storage_stats_category, idx_storage_stats_category_global, idx_storage_stats_created_at, idx_storage_stats_last_calculated, storage_stats, trigger_update_storage_stats_updated_at

### Community 215 - "019_camera_settings_and_alerts.sql"
Cohesion: 0.33
Nodes (8): alerts, camera_settings, idx_alerts_acknowledged, idx_alerts_camera_created, idx_alerts_created_at, idx_camera_settings_updated_at, trigger_update_alerts_updated_at, trigger_update_camera_settings_updated_at

### Community 217 - "make_pipeline"
Cohesion: 0.42
Nodes (4): Real-time, frame(), make_pipeline(), TestLiveFrameRouting

### Community 218 - "017_event_search_indexes.sql"
Cohesion: 0.39
Nodes (7): idx_events_camera_id, idx_events_confidence, idx_events_confidence_timestamp, idx_events_event_type, idx_events_face_status, idx_events_timestamp_camera, idx_events_type_timestamp

### Community 219 - "face_embeddings"
Cohesion: 0.43
Nodes (6): face_embeddings, idx_face_embeddings_active, idx_face_embeddings_camera, idx_face_embeddings_quality, idx_face_embeddings_visitor_id, idx_face_embeddings_visitor_quality

### Community 220 - "022_rate_limit_counters.sql"
Cohesion: 0.39
Nodes (5): idx_rate_limit_counters_unique, idx_rate_limit_counters_user_endpoint_window, idx_rate_limit_counters_window_start, rate_limit_counters, trigger_update_rate_limit_counters_updated_at

### Community 221 - "face_embeddings"
Cohesion: 0.43
Nodes (6): face_embeddings, idx_face_embeddings_active, idx_face_embeddings_camera, idx_face_embeddings_quality, idx_face_embeddings_visitor_id, idx_face_embeddings_visitor_quality

### Community 222 - "016_rate_limit_counters.sql"
Cohesion: 0.39
Nodes (5): idx_rate_limit_counters_unique, idx_rate_limit_counters_user_endpoint_window, idx_rate_limit_counters_window_start, rate_limit_counters, trigger_update_rate_limit_counters_updated_at

### Community 224 - "human_verifications"
Cohesion: 0.48
Nodes (5): human_verifications, idx_human_verifications_camera, idx_human_verifications_event, idx_human_verifications_tier, idx_human_verifications_timestamp

### Community 225 - "event_detections"
Cohesion: 0.48
Nodes (5): event_detections, idx_event_detections_camera, idx_event_detections_class, idx_event_detections_event_id, idx_event_detections_timestamp

### Community 226 - "009_enhance_events_table.sql"
Cohesion: 0.53
Nodes (4): idx_events_camera_timestamp_type, idx_events_detection_counts, idx_events_face_detections, idx_events_object_detections

### Community 227 - "015_notification_preferences.sql"
Cohesion: 0.47
Nodes (3): idx_notification_preferences_user_id, notification_preferences, update_notification_preferences_updated_at

### Community 228 - "security_events"
Cohesion: 0.53
Nodes (4): idx_security_events_event_type, idx_security_events_timestamp, idx_security_events_user_id, security_events

### Community 229 - "023_ai_analysis_results.sql"
Cohesion: 0.60
Nodes (5): ai_analysis_results, idx_ai_analysis_analyzed_at, idx_ai_analysis_camera_date, idx_ai_analysis_camera_id, idx_ai_analysis_event_id

### Community 230 - "026_create_cameras_table.sql"
Cohesion: 0.53
Nodes (4): cameras, idx_cameras_created_at, idx_cameras_enabled, trigger_update_cameras_updated_at

### Community 231 - "029_create_service_logs.sql"
Cohesion: 0.60
Nodes (5): idx_service_logs_camera, idx_service_logs_level, idx_service_logs_service, idx_service_logs_timestamp, service_logs

### Community 232 - "006_enhance_events_table.sql"
Cohesion: 0.53
Nodes (4): idx_events_camera_timestamp_type, idx_events_detection_counts, idx_events_face_detections, idx_events_object_detections

### Community 233 - "010_notification_preferences.sql"
Cohesion: 0.47
Nodes (3): idx_notification_preferences_user_id, notification_preferences, update_notification_preferences_updated_at

### Community 234 - "security_events"
Cohesion: 0.53
Nodes (4): idx_security_events_event_type, idx_security_events_timestamp, idx_security_events_user_id, security_events

### Community 235 - "017_ai_analysis_results.sql"
Cohesion: 0.60
Nodes (5): ai_analysis_results, idx_ai_analysis_analyzed_at, idx_ai_analysis_camera_date, idx_ai_analysis_camera_id, idx_ai_analysis_event_id

### Community 236 - "020_create_cameras_table.sql"
Cohesion: 0.53
Nodes (4): cameras, idx_cameras_created_at, idx_cameras_enabled, trigger_update_cameras_updated_at

### Community 237 - "migrations/002_create_detection_cache_postgres.sql"
Cohesion: 0.70
Nodes (4): detection_cache, idx_detection_cache_created_at, idx_detection_cache_file_hash, idx_detection_cache_file_path

### Community 238 - "004_create_events_table.sql"
Cohesion: 0.70
Nodes (4): events, idx_events_camera_id, idx_events_event_type, idx_events_timestamp

### Community 239 - "014_add_face_recognition_config.sql"
Cohesion: 0.70
Nodes (4): face_recognition_config, idx_face_recognition_config_active, idx_face_recognition_config_category, idx_face_recognition_config_key

### Community 240 - "backup/002_create_detection_cache_postgres.sql"
Cohesion: 0.70
Nodes (4): detection_cache, idx_detection_cache_created_at, idx_detection_cache_file_hash, idx_detection_cache_file_path

### Community 241 - "003_create_events_table.sql"
Cohesion: 0.70
Nodes (4): events, idx_events_camera_id, idx_events_event_type, idx_events_timestamp

### Community 242 - "010_add_face_recognition_config.sql"
Cohesion: 0.70
Nodes (4): face_recognition_config, idx_face_recognition_config_active, idx_face_recognition_config_category, idx_face_recognition_config_key

### Community 243 - "<a id="quick-start"></a>⚡ Quick Start"
Cohesion: 0.40
Nodes (5): <a id="quick-start"></a>⚡ Quick Start, Default Credentials, Docker Compose (Manual), Local Development, One-Line Install (Recommended)

### Community 244 - "fix-person-counts.cjs"
Cohesion: 0.60
Nodes (4): { Client }, dedupDetections(), iou(), main()

### Community 248 - "1786610461000-CreateSecurityEvents.sql"
Cohesion: 0.83
Nodes (3): idx_security_events_created_at, idx_security_events_event_type, security_events

## Knowledge Gaps
- **1016 isolated node(s):** `$schema`, `permissions`, `__filename`, `__dirname`, `DB_PATH` (+1011 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 1674 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **86 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Detection Pipeline` connect `StreamManager` to `WebSocketPublisher`, `FramePipeline`, `AGENTS.md`, `byte_tracker.py`, `FFmpegReader`, `HumanVerifier`, `MotionGate`, `PythonWsClient`?**
  _High betweenness centrality (0.145) - this node is a cross-community bridge._
- **Why does `PythonWsClient` connect `PythonWsClient` to `detectionPersistence.ts`, `StreamManager`, `services.ts`, `initializeServices`, `logger.ts`?**
  _High betweenness centrality (0.134) - this node is a cross-community bridge._
- **Why does `WebSocketPublisher` connect `WebSocketPublisher` to `StreamManager`, `frame_pipeline.py`, `byte_tracker.py`, `FramePipeline`, `RTSPService`?**
  _High betweenness centrality (0.045) - this node is a cross-community bridge._
- **What connects `$schema`, `permissions`, `__filename` to the rest of the system?**
  _1016 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `routes/index.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.049116676373519706 - nodes in this community are weakly interconnected._
- **Should `detectionPersistence.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.12333333333333334 - nodes in this community are weakly interconnected._
- **Should `frame_pipeline.py` be split into smaller, more focused modules?**
  _Cohesion score 0.07211538461538461 - nodes in this community are weakly interconnected._