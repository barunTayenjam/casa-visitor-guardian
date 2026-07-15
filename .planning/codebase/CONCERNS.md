# Codebase Concerns

**Last updated:** 2026-07-16
**Focus:** Technical debt, issues, and risks

## Technical Debt

### Area: Widespread `any` Type Usage
- **Location:** Throughout `server/src/`, especially in `controllers/`, `routes/`, `services/`, `streams/rtspManager.ts`
- **Issue:** Extensive use of `as any`, `Record<string, any>`, `(c: any)`, `(error: any)`, and untyped function parameters. Over 100+ `any` type coercions found. The commit `bfc74a8` attempted to eliminate `catch (error: any)` + `Record<string, any>` patterns but many remain — especially in controllers, routes, and test files.
- **Impact:** Disables TypeScript type-checking benefits; runtime errors that could be caught at compile time go undetected; makes refactoring dangerous.
- **Priority:** High
- **Estimated effort:** 2-3 days (systematic audit and typing across server/src)

### Area: Express 5 with Express 4 Type Definitions
- **Location:** `server/package.json`
- **Issue:** Express v5 (`^5.2.1`) is used but `@types/express` is pinned to `^4.17.25`. Express 5 has different API signatures (e.g., `req.query` is immutable, route param types changed). Type safety is entirely illusory.
- **Impact:** No compile-time type checking for Express APIs; potential runtime mismatches; `@types/express` v4 types may report false positives.
- **Priority:** Medium
- **Estimated effort:** 1-2 hours (use built-in Express 5 types or remove @types/express)

### Area: Fire-and-Forget Promise Handling
- **Location:** Multiple files across `server/src/`
- **Issue:** Pattern `somePromise.catch(() => {})` appears 13+ times (e.g., `bootstrap.ts`, `timelapseService.ts`, `config/index.ts`). Errors are silently swallowed with empty catch handlers.
- **Impact:** Failures in notifications, file cleanup, credential security events, and persistence operations go completely undetected. Makes debugging production issues nearly impossible.
- **Priority:** Medium
- **Estimated effort:** 1 day (add proper error logging to each fire-and-forget handler)

### Area: In-Memory State as Global Singleton
- **Location:** `server/src/services/inMemoryStateService.ts` (229 lines)
- **Issue:** `InMemoryStateService` is exported as a module-level singleton (`export const inMemoryState = new InMemoryStateService()`). State (alerts, events, system settings) lives in-memory with no persistence guarantees. On restart, all state is lost until `loadAlertsFromDb()` runs.
- **Impact:** Alerts are lost on process restart; race condition during initialization where state isn't loaded yet but consumers may access it.
- **Priority:** Medium
- **Estimated effort:** 1 day (implement proper persistence layer or DB-backed state)

### Area: Large God Files
- **Location:**
  - `server/src/streams/rtspManager.ts` — 664 lines
  - `server/src/controllers/CameraController.ts` — 610 lines
  - `server/src/controllers/NvidiaController.ts` — 551 lines
  - `server/src/services/batchProcessingDatabasePostgres.ts` — 545 lines
  - `opencv-service/pipeline.py` — 994 lines
  - `frontend/src/components/dashboard/CameraStream.tsx` — 1004 lines
  - `frontend/src/pages/EventsPage.tsx` — 1000 lines
- **Issue:** These files are excessively large, mixing multiple responsibilities. Low cohesion, high coupling.
- **Impact:** Hard to test, hard to change without side effects, merge conflicts, cognitive overload.
- **Priority:** Medium
- **Estimated effort:** 2-3 days (extract focused modules from each god file)

### Area: No Code Formatter Enforced
- **Location:** Root `package.json`, `server/`, `frontend/`
- **Issue:** No Prettier config detected anywhere. Code formatting is inconsistent — some files use 2-space indentation, others use tabs. No `format` script exists in any `package.json`.
- **Impact:** Diff noise from formatting changes; inconsistent readability; no automated formatting gate in CI.
- **Priority:** Low
- **Estimated effort:** 1 hour (add Prettier config, run once across codebase)

### Area: Disabled ESLint Rules
- **Location:** `frontend/eslint.config.js`
- **Issue:** Two key rules are explicitly disabled: `@typescript-eslint/no-unused-vars` is **off** and `react-refresh/only-export-components` is **off**. Server has no ESLint config at all.
- **Impact:** Dead code and unused imports go undetected; components may be mis-exported without warning.
- **Priority:** Medium
- **Estimated effort:** 1 day (reenable and fix violations)

### Area: Empty Stub Files
- **Location:** `server/src/services/circuitBreaker.ts` (0 lines), `server/src/events/eventBus.ts` (0 lines)
- **Issue:** Two zero-byte stub files exist with no implementation. INTEGRATIONS.md and ARCHITECTURE.md previously misreported their state.
- **Impact:** Misleading directory navigation; future developers may be unaware these are unimplemented.
- **Priority:** Low
- **Estimated effort:** 1 hour (implement or remove)

### Area: `simulateMotionDetection` in Production Routes
- **Location:** `server/src/routes/motion.ts` (line 49), `server/src/streams/rtspManager.ts` (line 529)
- **Issue:** A test/mock endpoint remains wired into production route definitions. `POST /:cameraId/simulate` triggers `simulateMotionDetection()` which generates synthetic events. Guarded by `requireAdmin` but still exposes a debug path.
- **Impact:** Admin could inadvertently pollute detection data with simulated events. Indicates test scaffolding mixed with production code.
- **Priority:** Low
- **Estimated effort:** 1 hour (remove route or guard behind NODE_ENV check)

### Area: Commented-Out Console Logs
- **Location:** `server/src/utils/cronJobs.ts` (lines 32, 104, 110, 122, 128, 159, 173, 274, 278, 280, 282, 296)
- **Issue:** 12 instances of commented-out `console.log` statements left as dead code, all following the pattern `// Daily report log disabled - console.log(...)`.
- **Impact:** Code clutter; indicates logging was deliberately suppressed rather than removed — suggests missing observability for cron job health.
- **Priority:** Low
- **Estimated effort:** 30 minutes (remove dead comments or implement proper logging)

## Known Bugs

### Bug: Silently Swallowed Errors in Empty Catch Blocks
- **Location:** Throughout `server/src/`, especially `bootstrap.ts`, `cronJobs.ts`, controllers
- **Symptoms:** Many `catch` blocks (50+) that either log generically (`logger.error(...)`) or do nothing. This means backend operations silently fail. The persistent `catches` without `(error: unknown)` typing (many use plain `catch (error)`) lose type information.
- **Root cause:** Legacy coding patterns; the `bfc74a8` fix only partially addressed the issue.
- **Severity:** Major

### Bug: RTSP Credentials in Plaintext Warning
- **Location:** `server/src/config/index.ts` (line 54)
- **Symptoms:** The config loader explicitly warns when it detects plaintext RTSP credentials: `'Detected plaintext RTSP credential in configuration'`. This means encrypted credentials are supported but the common case is plaintext.
- **Root cause:** `cameras.json` stores RTSP URLs with inline credentials (e.g., `rtsp://user:pass@camera-ip`). The `credentialEncryption.ts` service exists but isn't consistently used.
- **Severity:** Major

### Bug: In-Memory State May Serve Stale Data
- **Location:** `server/src/services/inMemoryStateService.ts`
- **Symptoms:** The in-memory singleton does not update from DB on a timer; it only loads on startup via `loadAlertsFromDb()`. If another process or direct DB change modifies alerts/events, the in-memory state is stale.
- **Root cause:** No invalidation/pubsub mechanism between in-memory cache and database.
- **Severity:** Minor

### Bug: WebSocket Reconnection Loops
- **Location:** `server/src/services/pythonWsClient.ts`, `server/src/streams/rtspManager.ts`
- **Symptoms:** The Python WS client has reconnection logic with exponential backoff (1s→30s), but there is no maximum retry cap enforced by count (only by delay). The silence check (30s interval, 60s timeout) could restart a stream that is legitimately idle.
- **Root cause:** Reconnection strategy can spin indefinitely; silence heuristic is too coarse.
- **Severity:** Minor

## Security Concerns

| Concern | Location | Risk | Mitigation |
|---------|----------|------|------------|
| CSP allows `unsafe-inline` + `unsafe-eval` | `server/src/index.ts:43-44` | Weak CSP allows XSS attacks via inline scripts and `eval()` | Remove `unsafe-eval` if not needed; use nonces or hashes for inline scripts |
| No HSTS enabled | `server/src/index.ts:55` — `strictTransportSecurity: false` | No forced HTTPS — users can be downgraded to HTTP | Enable HSTS with `maxAge=31536000; includeSubDomains` |
| Face images in git-tracked directory | `opencv-service/known_faces/TestPerson/` (15 image files, ~1MB) | PII (facial images) stored in version control; any git clone exposes them only to users with repo access | Exclude from git, store in `data/` dir, reference by path only |
| `.env` files on disk (gitignored but present) | `server/.env`, `frontend/.env`, `frontend/.env.local` | Production secrets (DB password, JWT secrets) on filesystem | Ensure `.gitignore` patterns are correct; verify no accidental commits via `git diff --cached` check hook |
| RTSP plaintext credentials | `server/cameras.json` (gitignored) | Camera credentials stored in plaintext; any process with file read access gets camera passwords | Fully adopt `credentialEncryption.ts` for all RTSP paths |
| CORS origin reveals domain | `docker-compose.yml:78` — `CORS_ORIGIN=https://argus.tayenjam.qzz.io` | Hardcoded production domain in docker-compose; leaked via config | Move to env var with secure default |
| `helmet` contentSecurityPolicy has `upgradeInsecureRequests: null` | `server/src/index.ts:51` | Explicit null disables upgrade-insecure-requests directive | Remove the null key or set to `[]` to inherit default |
| `POST /:cameraId/simulate` route exposed | `server/src/routes/motion.ts:49` | Admin could flood detection database with synthetic events | Guard behind `NODE_ENV !== 'production'` or remove entirely |

## Performance Issues

| Issue | Location | Impact | Current state |
|-------|----------|--------|---------------|
| Redis disabled by default | `docker-compose.yml:77` — `REDIS_DISABLED=true` | Cache falls back to in-memory LRU map; no shared cache across instances; memory grows unbounded | `cacheService.ts` handles both but in-memory has no eviction tied to actual system memory |
| FFmpeg subprocess management | `opencv-service/rtsp_ingestion/ffmpeg_reader.py` (subprocess.Popen) | RTSP stream reading is I/O bound; subprocess restarts on disconnect cause frame gaps | 5 FPS default at 640×360; CPU usage already optimized in recent commits (449%→49%) |
| Large React component bundles | `frontend/src/components/dashboard/CameraStream.tsx` (1004 lines), `EventsPage.tsx` (1000 lines) | Large components = slower React rendering, larger bundle splits, harder memo-ization | No code splitting at the component level |
| Memory-limited Node.js process | `server/package.json:8` — `--max-old-space-size=512` | Heap limited to 512MB; if detection events or socket connections spike, process OOMs | Mitigated by LOW_RESOURCE_MODE but no memory monitoring/alerting |
| In-memory cache TTL variability | `server/src/services/cacheService.ts:25` — TTL hardcoded per environment | Cache TTL set to 1800s in code but configurable; defaults may be wrong for different data types | No per-key TTL strategy |

## Fragile Areas

| Area | Reason | Risk | Mitigation Strategy |
|------|--------|------|---------------------|
| `server/src/streams/rtspManager.ts` (664 lines) | Central streaming orchestration; manages cameras, WebSocket frames, Python WS bridge, health monitoring, persistence | Any change here affects every streaming path; 25+ methods; tightly coupled to Socket.io, Python WS, and DB | Extract: frame relay → separate module, camera lifecycle → separate module, persistence → separate module |
| `opencv-service/pipeline.py` (994 lines) | Core detection pipeline (MOG2, YOLO, tracking, face recognition) in single file | Detection pipeline logic is monolithic; adding new detectors or altering pipeline order is high-risk | Split into pipeline orchestration + individual detector modules |
| `server/src/bootstrap.ts` (448 lines) | Wires up every service in correct order; starts cron jobs, streaming, Python WS | Wrong initialization order causes cascade failures; hard to reason about dependency graph | Implement explicit lifecycle stages with health checks |
| `server/src/controllers/NvidiaController.ts` (551 lines) | Depends on external NVIDIA API availability; has fallback to OpenCV local detection | External API timeouts/downtime cascade into detection pipeline; rate limits may block | Already has fallback; add circuit breaker metrics and quotas |
| Python WebSocket connection chain | Python → `ws://localhost:9090` → Node.js `PythonWsClient` → Socket.io → frontend | Every link in this chain can fail independently; reconnection logic is distributed across Python and Node | Centralize reconnection state machine; add end-to-end health monitoring |
| `server/src/auth/index.ts` (411 lines) | Authentication logic (JWT, bcrypt, sessions, MFA) all in one class | Security-critical logic in large monolithic class; any vulnerability is catastrophic | Split into focused modules (authn, authz, session, MFA) |
| `server/src/services/batchProcessingDatabasePostgres.ts` (545 lines) | Batch detection SQL operations | Complex SQL + TypeScript mix; direct DB queries bypass TypeORM abstraction | Consider using query builder patterns or TypeORM repository |

## Dependency Risks

| Dependency | Risk | Version | Alternative |
|------------|------|---------|------------|
| `@types/express` v4 with Express v5 | Type mismatch — Express 5 has different signatures | `^4.17.25` (Express `^5.2.1`) | Remove `@types/express` — Express 5 ships its own types, or pin to compatible types |
| `insightface` | Pinned `<0.8` — may miss security updates or bug fixes | `>=0.7.3,<0.8` | Regularly test with latest; remove upper bound if compatible |
| `node-fetch` v3 | ESM-only; may cause issues with some tooling | `^3.3.2` | Use built-in `fetch` (Node 18+) or `axios` (already installed) |
| `redis` + `ioredis` | Both Redis client packages installed (redundant) | `redis ^5.10.0` + `ioredis ^5.10.1` | Consolidate to one Redis client; `ioredis` is unused if `redis` is used |
| `ffmpeg-static` | Platform-specific; may fail on non-standard architectures | `^5.3.0` | Document platform requirements; add fallback detection |
| `speakeasy` | Duplicate in `frontend` and `server` package.json | `^2.0.0` | TOTP should only be needed server-side; move to devDependencies or remove from frontend |
| `@types/socket.io` v3 | Type defs for Socket.io v3, but `socket.io` is v4.7.2 | `^3.0.1` | Remove `@types/socket.io` — Socket.io v4 has built-in types |
| `nodemon` | Listed as devDependency but also used by root `dev:server` script | `^3.1.10` | No issue per se, but the root package.json doesn't have it — relies on server/node_modules |

## Test Gaps

| Area | Gap | Risk |
|------|-----|------|
| **Frontend tests** | Only 2 test files exist for the entire frontend (`baseClient.test.ts`, `importTest.test.ts`) out of 74 source files. Components, pages, contexts, hooks, and services are entirely untested. | UI regressions are caught only manually; refactoring frontend code is high-risk |
| **Backend service tests** | 9 of 15 backend services lack test files: `automatedCleanupService`, `batchProcessingDatabasePostgres`, `batchProcessingWorker`, `credentialEncryption`, `eventSearchService`, `notificationService`, `nvidia`, `opencvMicroserviceClient`, `retentionPolicyService`, `visitorService` | Core business logic (NVIDIA AI, notifications, retention, batch processing) has zero test coverage |
| **OpenCV Python tests** | Only 6 of 23 Python modules have test files (`ffmpeg_reader`, `websocket_publisher`, `mog2`, `motion_gate`, `queue`). Critical modules untested: `pipeline.py` (994 lines), `frame_pipeline.py` (774 lines), `byte_tracker.py`, `arcface_recognizer.py`, `threat_detector.py`, `scene_analyzer.py`, all route handlers | Detection pipeline failures go undetected; ML model integration and face recognition have no automated tests |
| **Integration tests** | No end-to-end tests that validate the full pipeline (RTSP → Python → WebSocket → Node.js → DB → API → Frontend) | Service orchestration bugs (like the pipeline hang fixed in `75bf2ce`) can only be caught manually |
| **E2E tests** | Zero E2E tests | Complete user workflows (login → view streams → see events → review) never validated as a whole |
| **Test quality** | Existing tests use heavy `any` mocking (`createMockRes(): any`, `const mockLogin: any = jest.fn()`). Mock-heavy tests don't validate real integration behavior. | Tests pass even when production code is wrong; false confidence in test suite |

## Maintenance Issues

| Issue | Location | Impact |
|-------|----------|--------|
| `.env.example` is 378 lines | `/home/barun/Documents/sentryvision/.env.example` | Extremely verbose; most variables are undocumented or have default placeholders. Hard to maintain and easy to drift from actual config used in `config/index.ts` |
| Duplicate `speakeasy` dependency | `frontend/package.json` and `server/package.json` both list `speakeasy` | TOTP library installed in frontend where it's never used (MFA is server-side). Bloating bundle. |
| CSV/SQL fixture files in `data/` | `data/detections/batch_jobs_import.sql`, `data/detections/batch_result_items.csv` | Stale import files mixed with runtime data directory; unclear if these are still needed |
| Root `package.json` script: `test` runs frontend tests only | `/home/barun/Documents/sentryvision/package.json:21` | `npm test` only runs Jest in frontend; backend and Python tests must be run separately. No single `test:all` command. |
| Multiple `package.json` test commands (`test`, `test:watch`, `test:coverage`, `test:all`) | `package.json` lines 21-27 | Fragmented test commands; `test:all` and `test:coverage` do the same thing (both run jest --coverage) |
| `console.log` monkey-patching | `server/src/utils/logger.ts:197-209` | Logger replaces `console.log`/`console.error`/`console.warn`/`console.debug` globally. This is a side effect on module import — any other module relying on original console behavior may break. |
| `data/detections` has stale empty directories | `data/detections/2026-02`, `2026-03`, `2026-06`, `2026-07` | Monthly directories from 4-5 months ago with no files or minimal stale files. |
| Known `Face images in git` — `TestPerson` directory in git | `opencv-service/known_faces/TestPerson/` (17 files, 15 tracked by git) | PII stored in git history; `git filter-repo` would be needed to fully remove. |
| `backup/.env.test` in git history | Git history shows `backup/.env.test` was committed and later removed via `46c33cd` | Test secrets may still be recoverable from git history. |
| `health:check` script in root `package.json` | `package.json:20` — `npm run build && npm run lint` | Misnamed — does not actually perform a health check against running services, just builds and lints. |

---

*Concerns audit: 2026-07-16*
