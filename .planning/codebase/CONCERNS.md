# Codebase Concerns

**Analysis Date:** 2026-05-15

## Tech Debt

### God File: `server/src/routes/index.ts` (4,073 lines)
- Issue: Single file contains 75+ route handlers, in-memory state (recentEvents, alerts, cachedSystemSettings), settings CRUD, analytics, camera management, stream management, and helper functions. This is the single biggest maintainability risk in the codebase.
- Files: `server/src/routes/index.ts`
- Impact: Any change to any API endpoint requires navigating a 4,000+ line file. Conflicts are likely in team development. Testing individual routes in isolation is extremely difficult.
- Fix approach: Break into domain-specific route modules (already partially started — `auth.ts`, `visitorRoutes.ts`, `detectionRoutes.ts`, `storageRoutes.ts` exist). Extract remaining endpoints into `cameraRoutes.ts`, `analyticsRoutes.ts`, `settingsRoutes.ts`, `alertRoutes.ts`, `streamRoutes.ts`, `systemRoutes.ts`. Move in-memory state (`recentEvents`, `alerts`, `cachedSystemSettings`) into dedicated services.

### God File: `frontend/src/services/ApiService.ts` (3,208 lines)
- Issue: Monolithic API client with every endpoint call in one file. Includes type definitions, error classes, and all API methods.
- Files: `frontend/src/services/ApiService.ts`
- Impact: Hard to navigate, slow to modify, and any import pulls in the entire service.
- Fix approach: Split into domain-specific service modules (`cameraService.ts`, `eventService.ts`, `settingsService.ts`, `authService.ts`, etc.) with shared base client for error handling and configuration.

### God File: `opencv-service/app.py` (1,922 lines)
- Issue: Single Flask file contains all detection logic, caching (both PostgreSQL and Redis), YOLO detection, face recognition, batch processing, training, and all endpoints.
- Files: `opencv-service/app.py`
- Impact: Any change to detection, caching, or face recognition requires editing the same massive file.
- Fix approach: Split into Flask blueprints (`routes/detection.py`, `routes/faces.py`, `routes/batch.py`) and separate modules for `detection_cache.py`, `yolo_detector.py`, `face_recognition_service.py`.

### `.new.tsx` Page Files Not Renamed
- Issue: Five frontend page files use a `.new.tsx` naming convention suggesting they were replacements that were never cleaned up. `App.tsx` already imports and uses these files in routes, confirming they are the active versions. The original page files (without `.new`) have been deleted for all except `Login.tsx` and `NotFound.tsx`.
- Files: `frontend/src/pages/StreamDashboard.new.tsx`, `frontend/src/pages/EventsPage.new.tsx`, `frontend/src/pages/Settings.new.tsx`, `frontend/src/pages/Analytics.new.tsx`, `frontend/src/pages/DayHighlights.new.tsx`
- Impact: Confusing naming for developers. Suggests in-progress work that was never finalized.
- Fix approach: Rename all `.new.tsx` files to standard `.tsx` names (e.g., `StreamDashboard.new.tsx` → `StreamDashboard.tsx`) and update all imports in `App.tsx`.

### Disabled Model Files
- Issue: Two TypeORM model files are disabled with `.disabled` extension, meaning `Session.ts.disabled` and `AuditLog.ts.disabled` are not loaded but remain in the codebase.
- Files: `server/src/models/Session.ts.disabled`, `server/src/models/AuditLog.ts.disabled`
- Impact: Session tracking and audit logging models may be partially implemented but are not active. Audit logging functionality referenced in `server/src/utils/auditLogger.ts` may be non-functional without the model.
- Fix approach: Either complete and enable these models (remove `.disabled`) or remove them if replaced by other implementations. The `AuditLog.ts` model is referenced by `server/src/models/AuditLog.test.ts` which also exists.

### Global Mutable State via `(global as any)`
- Issue: Server relies on `(global as any)` to share service instances across modules. At least 20+ assignments and 30+ reads from global are scattered across `server/src/index.ts`, `server/src/routes/index.ts`, and `server/src/detection/optimizedMotionDetection.ts`. Services stored include `AppDataSource`, `streamManager`, `motionDetector`, `detectionService`, `timelineService`, `detectionConfigService`, `reviewService`, `notificationService`, `storageStatsService`, `retentionPolicyService`, and `automatedCleanupService`.
- Files: `server/src/index.ts` (lines 503-550), `server/src/routes/index.ts` (lines 347-362), `server/src/detection/optimizedMotionDetection.ts` (references to `(global as any).timelineService`, `(global as any).reviewService`)
- Impact: No type safety, impossible to test in isolation, circular dependency potential, race conditions if services aren't initialized before access.
- Fix approach: Use a proper dependency injection container or service locator pattern. At minimum, create a typed `ServiceRegistry` class that holds all services and can be imported where needed. Initialize it during startup and export the singleton.

### `as any` Type Casts Pervasive
- Issue: Extensive use of `as any` type casts throughout the server codebase, particularly for camera objects (`(c: any) => c.isActive`) and global service access. The `detectionService` field in `OptimizedMotionDetector` is typed as `any` (line 106-107, 118 of `optimizedMotionDetection.ts`).
- Files: `server/src/routes/index.ts`, `server/src/streams/rtspManager.ts`, `server/src/detection/optimizedMotionDetection.ts`
- Impact: TypeScript strict mode provides no protection in these areas. Refactoring is risky because the compiler can't catch type mismatches.
- Fix approach: Define proper interfaces for all service types and camera objects. Replace `any` with specific types.

## Known Bugs

### Unimplemented Storage Usage Calculation
- Symptoms: System overview endpoint always returns `storageUsed: 0` and hardcoded `storageTotal: 1000000000`.
- Files: `server/src/routes/index.ts` line 2966
- Trigger: Calling `GET /api/system/overview` always shows zero storage.
- Workaround: `server/src/services/storageStatsService.ts` exists but is not used in this endpoint.

### Unimplemented Detection Overlay Rendering
- Symptoms: When `overlays=true` is passed to detection image endpoint, a note is returned saying "Overlay rendering not yet implemented" instead of actual overlays.
- Files: `server/src/routes/index.ts` line 3214
- Trigger: Request `GET /api/detection/image/:id?overlays=true`
- Workaround: None; overlay rendering was planned but never implemented.

### Database Logging Permanently Disabled
- Symptoms: The `writeToDatabase` function in logger immediately returns without logging anything. Both `enableFileLogging` and `enableDatabaseLogging` are set to `false` in the config.
- Files: `server/src/utils/logger.ts` lines 41-42, 108-111
- Trigger: Any server-side log statement. Database logging was disabled "temporarily to fix HTTP hanging" but never re-enabled.
- Workaround: Console logging still works.

### PostgreSQL Cache Cleanup Disabled in OpenCV Service
- Symptoms: The `_cleanup_old_cache` method in `DetectionCache` is never called. The cleanup thread is commented out (line 225-226).
- Files: `opencv-service/app.py` lines 79, 224-226
- Trigger: Detection cache entries in PostgreSQL are never cleaned up, causing unbounded growth of the `detection_cache` table.
- Workaround: Manual SQL `DELETE FROM detection_cache WHERE updated_at < NOW() - INTERVAL '300 seconds'`.

### SQL Syntax Bug in Cache `get()` Method
- Symptoms: The `SELECT` query in `DetectionCache.get()` uses `INTERVAL '%s seconds'` with string formatting inside a parameterized query, which is incorrect PostgreSQL syntax. The `%s` will not be interpolated correctly because it's inside a string literal.
- Files: `opencv-service/app.py` line 140-141
- Trigger: Every cache lookup via PostgreSQL will either fail or never return cached results.
- Workaround: Redis cache is also used and may mask this issue.

## Security Considerations

### Many API Routes Lack Authentication
- Risk: Out of 75+ route handlers in `server/src/routes/index.ts`, at least 67 have no authentication middleware. Routes like camera listing, camera control (start/stop stream), motion settings, zone management, filter configuration, events history, search, and image serving are all unauthenticated. In `server/src/index.ts`, routes like `/api/review`, `/api/timeline`, `/api/detection/config`, and `/api/timeline/active/:camera` also lack auth.
- Files: `server/src/routes/index.ts`, `server/src/index.ts`
- Current mitigation: The system is designed for local network use, but this is not a valid security boundary.
- Recommendations: Add `requireUser` or `optionalAuth` middleware to all sensitive endpoints. At minimum, protect camera control, settings changes, and event deletion.

### Path Traversal Risk in Image Serving
- Risk: The `/events/:filename` endpoint in `server/src/index.ts` (line 53) does not validate the filename parameter for path traversal characters (`..`). While `server/src/routes/index.ts` has a check (`filename.includes('..')` at line ~130), the same protection is not applied in `index.ts`. An attacker could potentially request `/events/../../etc/passwd` to read arbitrary files.
- Files: `server/src/index.ts` lines 53-130, `server/src/routes/index.ts` (has partial protection)
- Current mitigation: Database lookup adds some indirection, but filesystem scanning fallback is vulnerable.
- Recommendations: Add filename validation (reject `..`, `/`, `\`) to all image serving endpoints in `server/src/index.ts`.

### Hardcoded Fallback JWT Secret
- Risk: The config falls back to `'fallback-secret-change-in-production'` when `JWT_ACCESS_SECRET` and `JWT_SECRET` are both unset. While `validateConfig()` warns in development and throws in production, if `NODE_ENV` is not set to `production`, the fallback is used.
- Files: `server/src/config/index.ts` line 245
- Current mitigation: `validateConfig()` at line 386 checks for this, but it may not be called during startup.
- Recommendations: Remove the fallback string entirely. Fail fast if JWT secret is not configured.

### Hardcoded Database Password in Python Service
- Risk: The OpenCV service defaults to `'sentryvision123'` as the PostgreSQL password if `POSTGRES_PASSWORD` env var is not set.
- Files: `opencv-service/app.py` line 73
- Current mitigation: Environment variable override exists.
- Recommendations: Do not provide a default password. Fail to start if credentials are not provided via environment.

### Hardcoded IP Addresses
- Risk: Database host defaults to `'172.26.0.3'` (a Docker internal IP), and CORS origins include `'http://192.168.31.99:5173'` and `'http://192.168.31.99:8082'`. The `CameraContext.tsx` contains hardcoded RTSP URLs.
- Files: `server/src/config/index.ts` line 248, `server/src/index.ts` line 47, `frontend/src/contexts/CameraContext.tsx`
- Current mitigation: Environment variable overrides exist for most values.
- Recommendations: Remove hardcoded IPs from source code. Use environment variables exclusively.

### Debug Endpoints in Production Code
- Risk: A `/test` endpoint exists in `server/src/index.ts` that returns a test response. A `/api/cameras/debug` endpoint returns detailed camera streaming status including internal state. Neither requires authentication.
- Files: `server/src/index.ts` (test endpoint), `server/src/routes/index.ts` line 476
- Current mitigation: None.
- Recommendations: Guard debug endpoints behind `requireAdmin` middleware. Consider removing them in production builds.

### OpenCV Service Has No Authentication
- Risk: The Python OpenCV service at port 8084 has zero authentication on any endpoint. Anyone with network access can trigger detection, train faces, retrain models, and access known faces.
- Files: `opencv-service/app.py`
- Current mitigation: The service is only accessible from the backend server (internal network).
- Recommendations: Add API key authentication or restrict access to the backend server's IP only.

## Performance Bottlenecks

### In-Memory Event Storage with O(n) Operations
- Problem: `recentEvents` is an in-memory array capped at 100 entries with `unshift()` and `pop()` operations. Analytics endpoints (`/api/analytics/hourly`, `/api/analytics/weekly`) iterate over this array for every request, filtering by date. With 100 events max, analytics data is limited and potentially stale.
- Files: `server/src/routes/index.ts` lines 92-93, 3238-3298
- Cause: Events are stored only in memory, not queried from the database for analytics.
- Improvement path: Query PostgreSQL for analytics data using proper SQL aggregation. The `events` table already has 1,050+ records.

### Filesystem Scanning Fallback for Image Serving
- Problem: When database lookup fails for image serving, the server scans up to 60 directories (5 years × 12 months) sequentially using `fs.existsSync()` in a synchronous loop. This blocks the event loop.
- Files: `server/src/index.ts` lines 80-93, 160-173
- Cause: Missing or incorrect database records for file paths.
- Improvement path: Ensure all files are properly indexed in the `detection_files` table. Remove or make the filesystem scan asynchronous.

### Dual Cache Layer in OpenCV Service
- Problem: The OpenCV service maintains both a PostgreSQL `DetectionCache` and a Redis `RedisDetectionCache` for the same detection results. The code checks Redis first, then PostgreSQL. This adds latency for every detection request.
- Files: `opencv-service/app.py` lines 67-222
- Cause: Migration from PostgreSQL cache to Redis was never completed; both remain active.
- Improvement path: Remove PostgreSQL cache entirely and use only Redis for detection caching. The PostgreSQL cache has a SQL syntax bug anyway (see Known Bugs).

### Synchronous FFmpeg Detection on Main Thread
- Problem: The `OptimizedMotionDetector` processes frames on the main thread for motion detection. While it uses worker threads for some operations, the core detection loop runs in the Node.js event loop.
- Files: `server/src/detection/optimizedMotionDetection.ts`
- Cause: Original architecture did not isolate detection processing.
- Improvement path: Move all frame processing to worker threads completely. Use a queue-based approach where frames are sent to workers and results come back via messages.

## Fragile Areas

### Service Initialization Order in `server/src/index.ts`
- Files: `server/src/index.ts` lines 497-556
- Why fragile: The `initializeServices()` function relies on strict ordering: database → detection service → stream manager → motion detection → services. If any step fails, subsequent services are not initialized but the server continues running. Global state assignments mean other modules access potentially undefined services.
- Safe modification: Add explicit null checks before using any global service. Consider failing fast if critical services (database, stream manager) can't initialize.
- Test coverage: No tests for startup sequence.

### Motion Detection with Three Overlapping Implementations
- Files: `server/src/detection/optimizedMotionDetection.ts` (1,104 lines), `server/src/detection/motionTriggeredDetection.ts` (671 lines), `server/src/detection/simpleMotionDetection.ts` (138 lines)
- Why fragile: Three different motion detection implementations exist with overlapping functionality. `optimizedMotionDetection.ts` is the primary one used by the main server, but `motionTriggeredDetection.ts` is used by `rtspManager.ts` and `simpleMotionDetection.ts` is used by `eventQueueService.ts`. Changes to detection behavior need to be replicated across multiple files.
- Safe modification: Any detection-related changes should be verified across all three implementations. Document which components use which implementation.
- Test coverage: No tests found for any of the three detection implementations.

### RTSP Stream Manager Process Lifecycle
- Files: `server/src/streams/rtspManager.ts` (958 lines)
- Why fragile: FFmpeg child processes are spawned and managed manually. The `StreamManager` class handles process restarts, viewer tracking, adaptive FPS, and health monitoring. Process crashes, memory leaks in FFmpeg, or unhandled disconnections can leave zombie processes.
- Safe modification: Always test with actual RTSP cameras when modifying stream management. Use `StreamHealthMonitor` to verify stability.
- Test coverage: No tests found for stream manager.

### Camera Configuration Loading
- Files: `server/src/config/index.ts` lines 263-302, `server/cameras.json`
- Why fragile: Camera config is loaded from either `CAMERAS` env var (JSON) or `cameras.json` file. Legacy format conversion happens inline. RTSP credentials are decrypted at load time. If the JSON is malformed, cameras silently default to empty array `[]`.
- Safe modification: Always validate camera config changes against both JSON formats. Test credential encryption/decryption.
- Test coverage: No tests for config loading.

### OpenCV Service Model Loading
- Files: `opencv-service/app.py` lines 228-280
- Why fragile: YOLO model loading depends on specific files in `opencv-service/models/` directory. If model files are missing or corrupted, the service starts but detection silently fails. No health check verifies model availability.
- Safe modification: Verify model files exist before deploying. Add model validation to `/health` endpoint.
- Test coverage: No tests.

## Scaling Limits

### In-Memory Alerts and Events
- Current capacity: 100 events and 100 alerts stored in Node.js process memory.
- Limit: All data lost on server restart. No persistence for alerts. Analytics limited to last 100 events.
- Scaling path: Move all state to PostgreSQL. Alerts table already exists conceptually. Events table has 1,050+ records.

### Single-Process Architecture
- Current capacity: One Node.js process handles all HTTP requests, WebSocket connections, RTSP streams, and motion detection.
- Limit: CPU-bound detection processing blocks event loop. Memory usage grows with stream count.
- Scaling path: Separate detection processing into dedicated worker processes. Use Redis pub/sub for inter-process communication. Consider horizontal scaling with sticky sessions for WebSocket connections.

### Detection Cache Growing Unbounded
- Current capacity: PostgreSQL `detection_cache` table grows without cleanup.
- Limit: Cleanup is disabled (see Known Bugs). Table will eventually consume significant disk space.
- Scaling path: Fix the SQL syntax bug and re-enable periodic cleanup. Add a TTL index or cron job.

### FFmpeg Process Per Camera
- Current capacity: One FFmpeg child process per camera for stream processing.
- Limit: Each process consumes ~50-100MB of memory. With many cameras, system memory becomes the bottleneck.
- Scaling path: Implement process pooling or shared stream processing. Consider GPU-accelerated decoding for large camera counts.

## Dependencies at Risk

### `ffmpeg-static` Package
- Risk: The `ffmpeg-static` package bundles a full FFmpeg binary. It's 50MB+ and may lag behind security updates. The code already tries system FFmpeg first (line 20-27 of `rtspManager.ts`).
- Impact: If `ffmpeg-static` has vulnerabilities or breaks on new OS versions, stream processing fails.
- Migration plan: Remove `ffmpeg-static` dependency entirely. Require system FFmpeg installation instead.

### `node-env` Directory in Server
- Risk: A `server/node-env/` directory contains a full Python 3.14 installation with pip, setuptools, and other packages (~100+ files). This appears to be an accidentally committed virtual environment or build artifact.
- Files: `server/node-env/` (entire directory)
- Impact: Bloats the repository significantly. May cause confusion about Python dependency management.
- Migration plan: Add `node-env/` to `.gitignore` and remove from version control.

## Missing Critical Features

### No Structured Logging in Production
- Problem: Database logging is permanently disabled. File logging is disabled. Only console output is available, which is lost on container restart.
- Blocks: Production debugging, audit compliance, incident investigation.
- Files: `server/src/utils/logger.ts`

### No Automated Tests for Core Detection Pipeline
- Problem: Zero tests exist for the three motion detection implementations, stream manager, or RTSP processing pipeline. These are the most critical paths in the system.
- Blocks: Safe refactoring, regression testing, CI/CD confidence.
- Files: `server/src/detection/optimizedMotionDetection.ts`, `server/src/detection/motionTriggeredDetection.ts`, `server/src/streams/rtspManager.ts`

### No Frontend Tests
- Problem: No test files (`.test.ts` or `.test.tsx`) exist in `frontend/src/`. The `frontend/src/tests/setup.ts` file exists but no actual tests use it.
- Blocks: Safe UI refactoring, component library updates.
- Files: `frontend/src/` (entire directory)

### No Database Migration Runner Integration
- Problem: Migrations exist in `database/migrations/` (001-008) but the server startup does not run them automatically. `database.ts` has `synchronize: false` which is correct, but migrations must be run manually.
- Blocks: Reliable deployment, especially after schema changes.
- Files: `server/src/database.ts`, `database/migrations/`

## Test Coverage Gaps

### Server Core — Zero Coverage
- What's not tested: Motion detection pipeline (3 implementations), RTSP stream management, FFmpeg process lifecycle, camera configuration parsing, OpenCV service communication, notification dispatching, batch processing worker, automated cleanup service.
- Files: `server/src/detection/*.ts`, `server/src/streams/*.ts`, `server/src/services/batchProcessingWorker.ts`, `server/src/services/automatedCleanupService.ts`, `server/src/services/notificationService.ts`
- Risk: Any change to the core detection or streaming pipeline could break silently.
- Priority: High

### Server Routes — Partial Coverage
- What's not tested: The massive `server/src/routes/index.ts` (4,073 lines, 75+ routes) has zero direct test coverage. Only the extracted route modules (`auth.test.ts`, `visitorRoutes.test.ts`, `reviewRoutes.test.ts`, `batchDetection.test.ts`, `storageRoutes.test.ts`) have tests.
- Files: `server/src/routes/index.ts`
- Risk: Route changes, auth middleware changes, or settings serialization changes could break API contracts.
- Priority: High

### Frontend — Zero Coverage
- What's not tested: All 12,945 lines of frontend TypeScript/React code. No component tests, no integration tests, no E2E tests.
- Files: `frontend/src/**/*.tsx`, `frontend/src/**/*.ts`
- Risk: UI regressions, broken API integrations, state management bugs go undetected.
- Priority: Medium

### OpenCV Service — Zero Coverage
- What's not tested: The entire 1,922-line Python service including YOLO detection, face recognition, caching, and all API endpoints.
- Files: `opencv-service/app.py`, `opencv-service/improved_face_recognition.py`
- Risk: Detection algorithm changes, cache bugs, model loading failures go undetected.
- Priority: Medium

---

*Concerns audit: 2026-05-15*
