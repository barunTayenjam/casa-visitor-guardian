# Codebase Concerns

**Analysis Date:** 2026-05-06

## Tech Debt

### Monolithic Routes File (5,133 lines)
- Issue: `server/src/routes/index.ts` is a single 5,133-line file containing 91 route definitions — camera management, streaming, events, analytics, detection, batch processing, system health, settings, and more. Only 9 of those routes use auth middleware.
- Files: `server/src/routes/index.ts`
- Impact: Extremely difficult to navigate, test, or modify safely. Any change risks breaking unrelated functionality. The file mixes concerns: HTTP handlers, business logic, SQL queries, stream management, and in-memory state.
- Fix approach: Extract route groups into separate router modules (Express Router). Several router files already exist (`visitorRoutes.ts`, `reviewRoutes.ts`, `detectionRoutes.ts`, `batchDetection.ts`, etc.) but most define 0 `app.get/post` routes — they use `router.get/post` instead, meaning `index.ts` should delegate to them rather than duplicating. The TODO at line 4078 acknowledges this: `// TODO: Move to separate router file to apply rate limiting properly`.

### Excessive `any` Type Usage (50+ occurrences)
- Issue: The codebase uses `any` extensively across detection, routing, and configuration code. Critical areas include `motionTriggeredDetection.ts` (15+ `any`), `optimizedMotionDetection.ts` (10+), and `routes/index.ts` (10+). All global state accessors return `any`.
- Files: `server/src/detection/motionTriggeredDetection.ts`, `server/src/detection/optimizedMotionDetection.ts`, `server/src/routes/index.ts`, `server/src/config/index.ts`
- Impact: Type safety is effectively disabled for large portions of the codebase. Refactoring is unsafe because the compiler cannot catch type mismatches.
- Fix approach: Define proper interfaces for detection results, camera objects, and event data. Replace `(global as any).xxx` with a typed service registry or dependency injection container.

### Global State via `(global as any)` (35+ references)
- Issue: Core services are stored on Node.js `global` object with `any` type: `streamManager`, `motionDetector`, `objectDetectionService`, `facialRecognitionService`, `AppDataSource`, `timelineService`, `reviewService`, `detectionConfigService`, `notificationService`, `storageStatsService`, `retentionPolicyService`, `automatedCleanupService`, `optimizedMotionDetector`.
- Files: `server/src/index.ts` (sets 15+ globals), `server/src/routes/index.ts` (reads 5+ globals), `server/src/detection/optimizedMotionDetection.ts`, `server/src/utils/cronJobs.ts`
- Impact: No compile-time verification that services exist when accessed. Services could be `undefined` at runtime if initialization order changes. Impossible to test in isolation without mocking the global object.
- Fix approach: Create a typed `ServiceRegistry` or use dependency injection. Initialize all services in a controlled order and pass references explicitly to route handlers and detection services.

### 907 `console.log`/`console.error` Calls in Server
- Issue: The server codebase has 907 instances of `console.log`/`console.error`/`console.warn` alongside a proper `logger` utility. The `logger` is imported and used in some places, but most routes use raw `console` calls.
- Files: `server/src/routes/index.ts` (80+), all detection files, all services
- Impact: Log messages bypass the structured logging system, making log aggregation, filtering, and level-based routing impossible. In production, `console.log` output cannot be disabled or redirected.
- Fix approach: Replace all `console.*` calls with the existing `logger` utility from `server/src/utils/logger.ts`. Add an ESLint rule to prevent `console.*` usage.

### Deprecated `String.prototype.substr()` (10+ occurrences)
- Issue: Multiple files use `.substr()` which is deprecated and may be removed in future JS/TS versions.
- Files: `server/src/routes/index.ts` (lines 274, 4105), `server/src/routes/batchDetection.ts`, `server/src/services/batchProcessingService.ts`, `server/src/services/visitorDatabasePostgres.ts`, `server/src/events/eventBus.ts`
- Impact: Future breaking change when `substr` is removed from the spec.
- Fix approach: Replace all `.substr(start, length)` with `.substring(start, start + length)` or `.slice(start, start + length)`.

### Backup/Disabled Files Committed
- Issue: A `.backup-migration` file exists in routes: `server/src/routes/index.ts.backup-migration`. A disabled route file also exists: `server/src/routes/logRoutes.ts.disabled`.
- Files: `server/src/routes/index.ts.backup-migration`, `server/src/routes/logRoutes.ts.disabled`
- Impact: Repository clutter. Creates confusion about which file is canonical.
- Fix approach: Remove backup files. If migration history is needed, rely on git history.

## Known Bugs

### SQL Injection in Batch Annotated Image Endpoint
- Symptoms: The `/api/batch/annotated/:filename` endpoint interpolates user input directly into SQL without parameterization.
- Files: `server/src/routes/index.ts:4804`
- Trigger: `SELECT file_path FROM events WHERE file_path LIKE '%${filename}' LIMIT 1` — the `filename` comes from `req.params.filename` with no parameterization.
- Workaround: The `filename` parameter has no validation in this specific endpoint (unlike other endpoints that check for `..`, `/`, `\`). A crafted filename like `'; DROP TABLE events;--` could modify data.

### Duplicate Route Definitions
- Symptoms: Two route handlers are defined for `GET /api/motion/:cameraId/events` — one at line 1914 (synchronous, in-memory) and another at line 2183 (async, database-backed). Express will only execute the first match.
- Files: `server/src/routes/index.ts:1914` and `server/src/routes/index.ts:2183`
- Trigger: The database-backed version at line 2183 is unreachable because the synchronous version at line 1914 always matches first.
- Workaround: None — the database query route is dead code.

### Analytics Endpoints Use In-Memory Data Only (100-event cap)
- Symptoms: Analytics endpoints (`/api/analytics/hourly`, `/api/analytics/weekly`, `/api/analytics/monthly`) all query the `recentEvents` array, which is capped at 100 entries and stored in memory. This does not reflect actual system data.
- Files: `server/src/routes/index.ts:3307-3404`
- Trigger: Any analytics request returns data from the last 100 events since server restart. All historical data (1,050+ events) in the database is ignored.
- Workaround: None — analytics data is unreliable.

### Response Time Analytics Returns Fake Data
- Symptoms: `/api/analytics/response-time` endpoint fabricates response times using memory heuristics and `Math.random()`. Not based on actual request timing.
- Files: `server/src/routes/index.ts:3406-3433`
- Trigger: Every request returns simulated data: `responseTime + (Math.random() - 0.5) * 0.5`.
- Workaround: None.

## Security Considerations

### Missing Authentication on Most Endpoints
- Risk: Out of 91 route definitions in `index.ts`, only 9 use auth middleware (`requireUser`, `requireAdmin`, or `optionalAuth`). Camera streams, snapshots, events, detection, analytics, system health, system logs, and batch processing endpoints are all publicly accessible.
- Files: `server/src/routes/index.ts`
- Current mitigation: The system appears to be designed for local/trusted network use.
- Recommendations: Apply `requireUser` at minimum to sensitive endpoints: `/api/system/logs`, `/api/system/storage`, `/api/system/overview`, `/api/events/*`, `/api/detection/*`, `/api/cameras/*` (modify), `/api/settings`, and all batch processing endpoints.

### Hardcoded Default Secrets
- Risk: JWT secrets fall back to `fallback-secret-change-in-production` in code (`server/src/config/index.ts:245`). The `.env` file contains `dev-jwt-access-secret-change-in-production` and DB password `sentryvision123`.
- Files: `server/src/config/index.ts:245`, `server/.env:11-12,20`, `server/src/services/batchProcessingWorker.ts:198`
- Current mitigation: Warning logged when default secret detected (line 387).
- Recommendations: Remove default fallback. Fail fast if secrets are not configured. Rotate all secrets that were committed to version control.

### SQL String Interpolation Vulnerability
- Risk: `/api/batch/annotated/:filename` uses `'%${filename}'` directly in SQL.
- Files: `server/src/routes/index.ts:4804`
- Current mitigation: None — this endpoint has no input validation and no parameterized query.
- Recommendations: Use parameterized query: `WHERE file_path LIKE '%' || $1 LIMIT 1` with `[filename]` as parameter.

### Error Stack Traces Leaked in API Responses
- Risk: Several endpoints include error details, messages, and stack traces in HTTP responses.
- Files: `server/src/routes/index.ts:2525` (`error.stack`), `server/src/routes/index.ts:3033-3042` (`details: errorMessage, stack: errorStack`)
- Current mitigation: Some endpoints return generic messages; others expose full details.
- Recommendations: Never include `error.stack` in production responses. Use a generic error message in production and log the details server-side only.

### Wildcard CORS on Stream Endpoints
- Risk: Six MJPEG stream and snapshot endpoints set `Access-Control-Allow-Origin: *` in individual response headers.
- Files: `server/src/routes/index.ts:574, 595, 1017, 1233, 1323, 1400`
- Current mitigation: Helmet.js provides global CORS configuration, but per-endpoint overrides bypass it.
- Recommendations: Remove per-endpoint CORS headers and rely on the global CORS configuration.

### Path Traversal Protection Incomplete
- Risk: The `/api/events/image/:filename` endpoint validates against `..`, `/`, `\` in filenames. However, the `/api/batch/annotated/:filename` endpoint has no such validation, and file paths from the database are served directly via `res.sendFile()` with an allowlist that includes hardcoded developer paths (`/home/barun/Documents/home-security-non-docker/data/detections`).
- Files: `server/src/routes/index.ts:2678-2686`
- Current mitigation: Allowlist of paths exists but includes developer-specific absolute path.
- Recommendations: Remove developer-specific paths from allowlist. Centralize file serving with a single validated path resolution function.

## Performance Bottlenecks

### In-Memory Event Storage (100-event cap, lost on restart)
- Problem: Alerts and recent events are stored in module-level arrays (`alerts[]`, `recentEvents[]`) in `routes/index.ts`. Data is lost on server restart and capped at 100 events. All analytics and health endpoints query this in-memory data.
- Files: `server/src/routes/index.ts:92-95` (`recentEvents`, `alerts`)
- Cause: Historical design — these were initial implementations before database integration.
- Improvement path: Replace with database-backed queries. The database already has 1,050+ events. The migration is partially done (some endpoints query the DB), but the in-memory arrays are still the primary data source for analytics, system overview, and health checks.

### 16GB Detection Data with No Cleanup Automation
- Problem: `data/detections/` contains 104,967 JPEG images and 21 JSON files totaling 16GB. Cleanup is manual (admin-triggered only via `/api/maintenance/cleanup-images`).
- Files: `data/detections/` (entire directory)
- Cause: Detection runs continuously, saving every motion event image.
- Improvement path: The `AutomatedCleanupService` exists at `server/src/services/automatedCleanupService.ts` but appears to be triggered manually. Implement scheduled cleanup (cron) based on retention policies already defined in the `retention_policies` table.

### LEFT JOIN in Every Event Query (13 occurrences)
- Problem: Every event query in `routes/index.ts` uses `LEFT JOIN detection_files df ON e.file_path = df.storage_path OR e.file_path LIKE '%' || df.original_filename`. This OR condition with LIKE prevents index usage and is executed for every paginated query.
- Files: `server/src/routes/index.ts` (13 queries with this pattern)
- Cause: Dual table storage — events exist in both `events` and `detection_files` tables.
- Improvement path: Consolidate to a single authoritative events table. If both tables must exist, add a proper foreign key relationship and indexed join condition instead of string matching.

### Synchronous File System Calls in Request Handlers
- Problem: Multiple endpoints use `fs.existsSync()`, `fs.readdirSync()`, `fs.statSync()`, and `fs.readFileSync()` within Express request handlers.
- Files: `server/src/routes/index.ts:2997-3013` (storage calculation), `server/src/routes/index.ts:2642-2730` (image serving)
- Cause: Convenience — synchronous API is simpler than async callbacks.
- Improvement path: Replace with `fs.promises` equivalents (`fs.promises.stat`, `fs.promises.readdir`, etc.).

## Fragile Areas

### Motion Detection System (3 Implementations)
- Files: `server/src/detection/optimizedMotionDetection.ts` (1,069 lines), `server/src/detection/simpleMotionDetection.ts` (48 lines, stub), `server/src/detection/motionTriggeredDetection.ts` (664 lines)
- Why fragile: Three overlapping motion detection implementations exist. `SimpleMotionDetection` is explicitly a stub (line 21: `STUB VERSION`). `OptimizedMotionDetection` is the main one (1,069 lines). `MotionTriggeredDetection` adds object/face detection on top. The relationship between them is unclear — which is active depends on initialization order and global state.
- Safe modification: Changes to motion detection should verify which implementation is actually active by checking `server/src/index.ts` initialization. The `setupOptimizedMotionDetection` function at line 1,055 of `optimizedMotionDetection.ts` sets `(global as any).optimizedMotionDetector`.
- Test coverage: No unit tests found for any of the three motion detection files.

### OpenCV Service Integration
- Files: `opencv-service/app.py` (1,903 lines), `server/src/services/opencvMicroserviceClient.ts`, `server/src/detection/consolidatedDetectionService.ts`
- Why fragile: The Python Flask service is a monolithic 1,903-line file handling motion detection, face recognition, object detection, health checks, batch processing, and annotation. Communication with the Node.js backend is over raw HTTP with no retry logic in some paths.
- Safe modification: Any changes to the OpenCV service API surface must be coordinated with both `opencvMicroserviceClient.ts` and `consolidatedDetectionService.ts`.
- Test coverage: No integration tests found for the OpenCV service bridge.

### Advanced Face Recognition Service (Placeholder)
- Files: `server/src/services/advancedFaceRecognitionService.ts` (223 lines)
- Why fragile: The entire service is a placeholder. `extractFaceEmbeddings()` returns `[]` (line 68). `registerPerson()` stores embeddings in a local array (not persisted). The face matcher (`this.faceMatcher`) is typed as `any` and never initialized.
- Safe modification: This file is effectively dead code but is imported. Do not remove without checking the import chain.
- Test coverage: None.

## Scaling Limits

### Single-Process Architecture
- Current capacity: Designed for 2 RTSP cameras at 4 FPS stream / 3 FPS detection
- Limit: All stream processing, motion detection, and detection run in a single Node.js process. Adding more cameras linearly increases CPU and memory usage.
- Scaling path: Offload detection to worker threads (already partially done in `optimizedMotionDetection.ts` with `Worker` imports). Consider a message queue (Redis pub/sub already available) for distributing detection tasks.

### Batch Processing Blocks Event Loop
- Current capacity: Batch detection processes images sequentially with 100ms delay between each.
- Limit: Large batches (1000+ images) block the event loop for minutes. The `for` loop at line 4,128 of `routes/index.ts` processes events synchronously within the request handler.
- Scaling path: Move batch processing to a background job queue. The `batchProcessingService.ts` already exists but the route-level batch endpoint bypasses it.

## Dependencies at Risk

### `@techstark/opencv-js` (Imported but Unused in Production)
- Risk: `advancedFaceRecognitionService.ts` imports `@techstark/opencv-js` but the actual OpenCV work is done by the Python Flask service. This dependency adds bundle size without production value.
- Impact: If this package has breaking changes or vulnerabilities, it could affect builds.
- Migration plan: Remove the import and dependency if `AdvancedFaceRecognitionService` is confirmed as unused placeholder code.

### Multer Memory Storage for File Uploads
- Risk: Face registration uses `multer.memoryStorage()` with a 10MB limit. Multiple concurrent uploads could exhaust memory.
- Impact: Server OOM under concurrent uploads.
- Migration plan: Use disk storage with temporary files, or implement streaming upload with size quotas.

## Missing Critical Features

### No Automated Data Retention
- Problem: 16GB of detection data accumulates with only manual cleanup. The `retention_policies` and `storage_stats` tables exist, and `AutomatedCleanupService` is implemented, but no scheduled job triggers it automatically.
- Blocks: Long-term unattended operation — disk will eventually fill up.

### No Overlay Rendering on Detection Images
- Problem: The `/detections/image/:imageId` endpoint acknowledges overlay rendering is not implemented (line 3283: `TODO: Implement overlay rendering using canvas or OpenCV if overlays=true`).
- Blocks: Users cannot see bounding boxes on detection images through this endpoint.

### Storage Usage Always Returns 0
- Problem: `/api/system/overview` hardcodes `storageUsed: 0` with a TODO comment (line 2966).
- Blocks: Accurate monitoring of storage consumption.

## Test Coverage Gaps

### Routes (91 endpoints, ~4 tested)
- What's not tested: `server/src/routes/index.ts` has 91 endpoints with zero direct tests. Only `auth.ts`, `batchDetection.ts`, `reviewRoutes.ts`, `visitorRoutes.ts`, and `storageRoutes.ts` have test files.
- Files: `server/src/routes/index.ts`
- Risk: Any route change in the 5,133-line file could break camera management, streaming, events, analytics, detection, or system endpoints without detection.
- Priority: High — the monolithic routes file is the highest-risk untested area.

### Motion Detection (3 implementations, 0 tests)
- What's not tested: Motion detection algorithms, threshold sensitivity, night mode adaptation, zone-based detection, cooldown logic.
- Files: `server/src/detection/optimizedMotionDetection.ts`, `server/src/detection/motionTriggeredDetection.ts`, `server/src/detection/simpleMotionDetection.ts`
- Risk: Changes to detection sensitivity or algorithm could cause false positives/negatives in a security system.
- Priority: High — this is the core security functionality.

### OpenCV Integration (0 tests)
- What's not tested: Communication between Node.js backend and Python OpenCV service, error handling when OpenCV is down, retry logic.
- Files: `server/src/services/opencvMicroserviceClient.ts`, `server/src/detection/consolidatedDetectionService.ts`
- Risk: OpenCV service failures could silently disable detection.
- Priority: Medium.

### Frontend API Service (0 tests)
- What's not tested: `frontend/src/services/ApiService.ts` (3,162 lines) has no test coverage.
- Files: `frontend/src/services/ApiService.ts`
- Risk: API contract changes between frontend and backend go undetected.
- Priority: Medium.

### Event Search Service
- What's not tested: `server/src/services/eventSearchService.ts` handles complex filtering, pagination, and search queries.
- Files: `server/src/services/eventSearchService.ts`
- Risk: Search filter changes could break event retrieval.
- Priority: Medium.

---

*Concerns audit: 2026-05-06*
