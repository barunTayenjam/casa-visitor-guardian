# SentryVision Improvement Plan

**Generated:** 2026-07-16
**Based on:** Codebase map `.planning/codebase/` (7 documents, 1,752 lines)
**Context:** Home security system — React/TypeScript frontend, Express 5 backend, PostgreSQL, Python OpenCV service

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Tier 0: Reliability & Correctness](#2-tier-0-reliability--correctness)
3. [Tier 1: Test Coverage](#3-tier-1-test-coverage)
4. [Tier 2: Code Quality & Architecture](#4-tier-2-code-quality--architecture)
5. [Tier 3: Security & Observability](#5-tier-3-security--observability)
6. [Tier 4: Performance](#6-tier-4-performance)
7. [Dependency Graph & Ordering](#7-dependency-graph--ordering)
8. [Effort Summary](#8-effort-summary)

---

## 1. Executive Summary

SentryVision is functional in production but carries significant technical debt from iterative development. The codebase suffers from:

- **Silent failures**: ~13 empty `.catch(() => {})` handlers, 50+ generic catch blocks
- **No test foundation**: ~0% frontend component coverage, 9/15 backend services untested, critical Python pipeline untested
- **Type erosion**: 100+ `any` coercions, Express v5 with v4 type defs providing false safety
- **Monolithic files**: Several 600–1000+ line files mixing multiple responsibilities
- **No CI pipeline**: Everything runs manually, no automated gates
- **Security gaps**: Weak CSP, no HSTS, PII in git, inconsistent credential encryption

**Total estimated effort: ~32 person-days**

**Recommended execution order:**
1. Tier 0 (reliability — silent bugs are actively causing issues)
2. Tier 2 lint/formatter/any purge (makes remaining work safer)
3. Tier 3 security (quick wins with high impact)
4. Tier 1 tests (protected by the lint/type gates from step 2)
5. Tier 4 performance (lowest risk, can be deferred)

---

## 2. Tier 0: Reliability & Correctness

### 2.1 Fire-and-Forget Promise Handlers

**Severity:** High — errors are silently swallowed

**Current state:** 13+ occurrences of `.catch(() => {})` across:
- `server/src/bootstrap.ts` — notification initialization
- `server/src/services/timelapseService.ts` — timelapse generation failures
- `server/src/config/index.ts` — security event logging
- Various controllers and services

**Plan:**

| Step | Task | File(s) | Effort |
|------|------|---------|--------|
| 2.1.1 | Audit all `.catch(() => {})` and `.catch(console.error)` patterns | Full repo grep | 0.5h |
| 2.1.2 | Replace each with structured error logging via `logger.error()` | All affected files | 4h |
| 2.1.3 | For safety-critical paths (credential encryption, event persistence), add proper error propagation | `config/index.ts`, `bootstrap.ts` | 2h |

**Acceptance criteria:**
- Zero `.catch(() => {})` remaining in `server/src/`
- Every async fire-and-forget has either `logger.error()` with context or explicit `// intentionally swallowed` with justification
- No regressions in startup sequence

---

### 2.2 Circuit Breaker Implementation

**Severity:** High — external failures cascade

**Current state:** `server/src/services/circuitBreaker.ts` is an empty stub (0 lines). The NVIDIA API client has retry logic but no circuit breaker. OpenCV HTTP client has no protection against cascading failures.

**Plan:**

| Step | Task | File(s) | Effort |
|------|------|---------|--------|
| 2.2.1 | Implement `CircuitBreaker` class: closed/open/half-open states, failure threshold (5 failures in 60s), cooldown (30s), success counting for recovery | `server/src/services/circuitBreaker.ts` | 4h |
| 2.2.2 | Wire into `opencvMicroserviceClient.ts` — wrap Axios calls, trip breaker on 5xx/network errors | `server/src/services/opencvMicroserviceClient.ts` | 2h |
| 2.2.3 | Wire into NVIDIA client — trip breaker on API timeout/429/5xx | `server/src/services/nvidia/nvidiaClient.ts` | 1h |
| 2.2.4 | Add health endpoint to expose breaker state per service | `server/src/routes/system.ts` | 1h |
| 2.2.5 | Add logging on state transitions (open→half→closed) | `circuitBreaker.ts` | 0.5h |

**Acceptance criteria:**
- CircuitBreaker passes unit tests for all 3 states
- After 5 consecutive failures to OpenCV/NVIDIA, further calls return fallback immediately without hitting the network
- After 30s cooldown, a single probe request is allowed
- Health endpoint shows `{ opencv: "closed"|"open"|"half-open", nvidia: "..." }`

---

### 2.3 WebSocket Reconnection Ceiling

**Severity:** Medium — infinite retry can mask real failures

**Current state:** `pythonWsClient.ts` uses exponential backoff (1s → 30s max delay) but has no maximum retry count. It can spin indefinitely, consuming memory and logs.

**Plan:**

| Step | Task | File(s) | Effort |
|------|------|---------|--------|
| 2.3.1 | Add `maxRetries = 50` constant to `PythonWsClient` | `server/src/services/pythonWsClient.ts` | 1h |
| 2.3.2 | After max retries, emit `websocket:dead` event to `ServiceRegistry` for alerting | `server/src/services/pythonWsClient.ts` | 0.5h |
| 2.3.3 | Add `silenceThreshold` config (default 60s) with grace period for known-idle cameras | `server/src/services/pythonWsClient.ts` | 1h |

**Acceptance criteria:**
- After 50 consecutive reconnect failures, client stops and emits dead event
- Admin dashboard or alerting mechanism receives the dead event
- Silence monitor doesn't fire for cameras with zero viewers (known-idle)

---

### 2.4 In-Memory State Synchronization

**Severity:** Medium — stale data served after process restart

**Current state:** `InMemoryStateService` loads alerts from DB only on `loadAlertsFromDb()` call during bootstrap. No periodic refresh. If another process or direct DB write modifies alerts, the in-memory cache serves stale data until restart.

**Plan:**

| Step | Task | File(s) | Effort |
|------|------|---------|--------|
| 2.4.1 | Add configurable refresh interval (default 60s) to `InMemoryStateService` | `server/src/services/inMemoryStateService.ts` | 2h |
| 2.4.2 | Implement `startPeriodicRefresh()` / `stopPeriodicRefresh()` lifecycle methods | `server/src/services/inMemoryStateService.ts` | 1h |
| 2.4.3 | Wire refresh start into `bootstrap.ts` after initial load | `server/src/bootstrap.ts` | 0.5h |
| 2.4.4 | Add stale-while-revalidate pattern: serve cached data, refresh in background | `server/src/services/inMemoryStateService.ts` | 2h |

**Acceptance criteria:**
- In-memory alerts/events refresh from DB every 60s
- No read delay — served from cache, refreshed asynchronously
- Refresh interval configurable via `IN_MEMORY_REFRESH_INTERVAL` env var (default 60000)

---

## 3. Tier 1: Test Coverage

### 3.1 Frontend Component Tests

**Current state:** 2 test files exist (`baseClient.test.ts`, `importTest.test.ts`). Zero component, page, context, or hook tests.

**Strategy:** Start with critical paths, then expand. Use React Testing Library + Jest (already configured).

**Plan:**

| Step | Task | File(s) | Effort |
|------|------|---------|--------|
| 3.1.1 | Test `AuthContext` — login/logout/MFA flows with mocked API | `frontend/src/__tests__/AuthContext.test.tsx` | 4h |
| 3.1.2 | Test `SocketService` — connect/disconnect/reconnect/event emission | `frontend/src/__tests__/SocketService.test.ts` | 3h |
| 3.1.3 | Test `Login` page — form validation, error states, token storage | `frontend/src/__tests__/Login.test.tsx` | 3h |
| 3.1.4 | Test `EventsPage` — filter rendering, pagination, empty state | `frontend/src/__tests__/EventsPage.test.tsx` | 4h |
| 3.1.5 | Test `ProtectedRoute` — redirect on unauthenticated, pass-through on authenticated | `frontend/src/__tests__/ProtectedRoute.test.tsx` | 1h |
| 3.1.6 | Add coverage threshold (50% branches, 60% lines) to `frontend/jest.config.ts` | `frontend/jest.config.ts` | 0.5h |

**Acceptance criteria:**
- AuthContext: login dispatch, logout dispatch, token refresh, error state
- SocketService: connection lifecycle, stream subscribe/unsubscribe, reconnection
- Login: renders form, validates required fields, shows errors on API failure, redirects on success
- EventsPage: renders empty state, renders filter controls, renders event list
- Frontend coverage ≥ 50% branches, ≥ 60% lines

---

### 3.2 Backend Service Tests

**Current state:** 9/15 services have zero test files. Only `authenticationService.ts` has meaningful coverage (533-line test file).

**Plan:**

| Step | Task | File(s) | Effort |
|------|------|---------|--------|
| 3.2.1 | Test `notificationService` — subscribe/unsubscribe/send/push notification dispatch | `server/src/__tests__/notificationService.test.ts` | 4h |
| 3.2.2 | Test `retentionPolicyService` — policy evaluation, file cleanup triggers | `server/src/__tests__/retentionPolicyService.test.ts` | 3h |
| 3.2.3 | Test `eventSearchService` — full-text search, filters, pagination | `server/src/__tests__/eventSearchService.test.ts` | 3h |
| 3.2.4 | Test `opencvMicroserviceClient` — health check, detection calls, circuit breaker integration | `server/src/__tests__/opencvMicroserviceClient.test.ts` | 3h |
| 3.2.5 | Test `batchProcessingWorker` — job lifecycle, retry, completion | `server/src/__tests__/batchProcessingWorker.test.ts` | 4h |
| 3.2.6 | Add coverage threshold (80% branches, 80% lines) to `server/jest.config.js` | `server/jest.config.js` (verify existing) | 0.5h |

**Acceptance criteria:**
- Each service has ≥ 1 test file covering: success path, error path, edge cases
- Server coverage consistently ≥ 80% (threshold exists, needs enforcement)
- All tests use mocked external dependencies (OpenCV HTTP, DB, push API)

---

### 3.3 Python Pipeline Tests

**Current state:** 6/23 Python modules have tests. Critical modules untested: `pipeline.py` (994 lines), `frame_pipeline.py` (774 lines), `byte_tracker.py`, `arcface_recognizer.py`, `threat_detector.py`.

**Plan:**

| Step | Task | File(s) | Effort |
|------|------|---------|--------|
| 3.3.1 | Test `byte_tracker.py` — track creation/update/deletion, Kalman filter prediction | `opencv-service/tests/test_byte_tracker.py` | 4h |
| 3.3.2 | Test `arcface_recognizer.py` — face detection, embedding extraction, identity matching | `opencv-service/tests/test_arcface_recognizer.py` | 3h |
| 3.3.3 | Test `threat_detector.py` — threat scoring, thresholds, known-vs-unknown faces | `opencv-service/tests/test_threat_detector.py` | 2h |
| 3.3.4 | Test `scene_analyzer.py` — scene classification, object counting, zone logic | `opencv-service/tests/test_scene_analyzer.py` | 2h |
| 3.3.5 | Test `frame_pipeline.py` — pipeline chain execution, per-camera lifecycle | `opencv-service/tests/test_frame_pipeline.py` | 4h |

**Acceptance criteria:**
- All 5 modules have ≥ 80% line coverage
- Tests use synthetic frame data (no live camera required)
- Integration test validates full pipeline chain with mock components

---

### 3.4 E2E Tests

**Current state:** Zero E2E tests. No Playwright, Cypress, or Puppeteer setup.

**Plan:**

| Step | Task | File(s) | Effort |
|------|------|---------|--------|
| 3.4.1 | Install Playwright, configure for frontend testing | `frontend/`, root level | 2h |
| 3.4.2 | Test: Login flow — valid credentials, invalid credentials, MFA prompt | E2E spec | 2h |
| 3.4.3 | Test: Stream dashboard — camera listing loads, stream panel renders | E2E spec | 2h |
| 3.4.4 | Test: Events page — filters apply, pagination works, event detail opens | E2E spec | 2h |
| 3.4.5 | Test: Settings — read current settings, toggle a setting, verify persistence | E2E spec | 2h |

**Acceptance criteria:**
- Playwright installed with Chromium browser
- 5 E2E specs passing against a running dev environment
- `npm run test:e2e` command available

---

## 4. Tier 2: Code Quality & Architecture

### 4.1 Systematic `any` Type Purge

**Severity:** High — 100+ `any` coercions disable TypeScript safety

**Current state:** `as any`, `Record<string, any>`, `(error: any)` patterns throughout `server/src/`. Earlier effort (`bfc74a8`) partially addressed this but many remain.

**Plan:**

| Step | Task | File(s) | Effort |
|------|------|---------|--------|
| 4.1.1 | Enable `@typescript-eslint/no-explicit-any` as warning, produce error report | `server/eslint.config.js` (create) | 0.5h |
| 4.1.2 | Fix `controllers/` — type request/response params, remove `as any` in response helpers | `server/src/controllers/*.ts` | 4h |
| 4.1.3 | Fix `services/` — type function parameters and return values, replace `Record<string, any>` with proper interfaces | `server/src/services/*.ts` | 6h |
| 4.1.4 | Fix `streams/rtspManager.ts` — type event payloads, camera configs, viewer tracking | `server/src/streams/rtspManager.ts` | 3h |
| 4.1.5 | Fix `routes/` — type `req.params`, `req.query`, `req.body` via Zod inference | `server/src/routes/*.ts` | 3h |
| 4.1.6 | Fix `config/index.ts` — type the config object instead of `as any` casts | `server/src/config/index.ts` | 1h |
| 4.1.7 | Enable `@typescript-eslint/no-explicit-any` as error, fix remaining violations | `server/eslint.config.js` | 2h |

**Acceptance criteria:**
- Zero `any` types in `server/src/` (excluding test files and `node_modules`)
- `@typescript-eslint/no-explicit-any` set to `error`
- No regressions — `npm run build:server` passes

---

### 4.2 God File Decomposition

**Current state:** Multiple 600–1000+ line files mixing concerns.

**Target files:**

| File | Lines | Strategy |
|------|-------|----------|
| `server/src/streams/rtspManager.ts` | 664 | Split into 3 modules |
| `server/src/controllers/CameraController.ts` | 610 | Split into focused route handlers |
| `server/src/controllers/NvidiaController.ts` | 551 | Separate scene/threat/person endpoints |
| `opencv-service/pipeline.py` | 994 | Split pipeline orchestration from individual detectors |
| `frontend/src/components/dashboard/CameraStream.tsx` | 1004 | Split into sub-components |
| `frontend/src/pages/EventsPage.tsx` | 1000 | Split filters, list, detail into separate components |

**Plan:**

| Step | Task | File(s) | Effort |
|------|------|---------|--------|
| 4.2.1 | **rtspManager**: Extract frame relay → `frameRelay.ts`, camera lifecycle → `cameraLifecycle.ts`, health → `streamHealth.ts`, keep only orchestration in `rtspManager.ts` | `server/src/streams/` | 4h |
| 4.2.2 | **pipeline.py**: Extract MOG2 gate, YOLO detection, face recognition, tracking into separate orchestrated modules | `opencv-service/` | 4h |
| 4.2.3 | **CameraStream.tsx**: Split into `StreamPlayer`, `StreamControls`, `StreamOverlay`, `StreamInfo` | `frontend/src/components/live/` | 3h |
| 4.2.4 | **EventsPage.tsx**: Split into `EventFilters`, `EventList`, `EventDetailPanel` as separate page-level components | `frontend/src/pages/` | 3h |

**Acceptance criteria:**
- No file exceeds 400 lines after split
- Existing imports continue to work (re-export from index files)
- All existing tests pass (where they exist)

---

### 4.3 Bootstrap Decomposition

**Current state:** `bootstrap.ts` (448 lines) handles DB init, camera loading, Python WS wiring, service construction, cron jobs — all in one function.

**Plan:**

| Step | Task | File(s) | Effort |
|------|------|---------|--------|
| 4.3.1 | Create `DatabaseInitializer` — connection pool, migration check, entity sync | `server/src/init/databaseInitializer.ts` | 2h |
| 4.3.2 | Create `CameraInitializer` — load cameras.json, validate, register with RTSP manager | `server/src/init/cameraInitializer.ts` | 1.5h |
| 4.3.3 | Create `StreamInitializer` — start Python WS client, wire frame relay, health monitor | `server/src/init/streamInitializer.ts` | 1.5h |
| 4.3.4 | Create `SchedulerInitializer` — register all cron jobs with proper error handling | `server/src/init/schedulerInitializer.ts` | 1h |
| 4.3.5 | Refactor `bootstrap.ts` to call initializers in sequence with dependency injection | `server/src/bootstrap.ts` | 2h |

**Acceptance criteria:**
- `bootstrap.ts` ≤ 100 lines, acting as an orchestrator only
- Each initializer has its own test file
- Initialization order is explicit and documented
- Failure in one initializer doesn't cascade (each has independent try/catch)

---

### 4.4 Lint & Formatter Setup

**Current state:** No Prettier, no `.editorconfig`, server has no ESLint config, two key rules disabled on frontend.

**Plan:**

| Step | Task | File(s) | Effort |
|------|------|---------|--------|
| 4.4.1 | Add Prettier config (`.prettierrc`): single quotes, trailing commas, 2-space indent, 100 width | Root | 0.5h |
| 4.4.2 | Add `.editorconfig`: 2-space indent, UTF-8, LF line endings | Root | 0.25h |
| 4.4.3 | Create `server/eslint.config.js` with TypeScript rules, `no-explicit-any: error`, `no-unused-vars: error` | `server/` | 1h |
| 4.4.4 | Re-enable `@typescript-eslint/no-unused-vars` on frontend, fix all violations | `frontend/eslint.config.js` | 2h |
| 4.4.5 | Add `npm run format` (Prettier) and `npm run lint:server` scripts to root | Root `package.json` | 0.5h |
| 4.4.6 | Run Prettier across entire codebase (separate commit) | Full repo | 1h |

**Acceptance criteria:**
- `npm run format` formats both frontend and server
- `npm run lint` checks frontend, `npm run lint:server` checks server
- `no-unused-vars` catches violations in both projects
- `.editorconfig` is recognized by VS Code and other editors

---

### 4.5 EventBus Implementation

**Current state:** `server/src/events/eventBus.ts` is an empty stub (0 lines). Real-time events flow through ad-hoc Socket.io emit + EventEmitter. No centralized event registry.

**Plan:**

| Step | Task | File(s) | Effort |
|------|------|---------|--------|
| 4.5.1 | Design event types: `TrackingEvent`, `SystemEvent`, `AlertEvent`, `DetectionEvent` | `server/src/types/events.ts` | 1h |
| 4.5.2 | Implement typed EventBus: `emit<T>(event, payload)`, `on<T>(event, handler)`, `off()` with cleanup | `server/src/events/eventBus.ts` | 2h |
| 4.5.3 | Migrate ad-hoc EventEmitter usage in PythonWsClient/rtspManager to EventBus | `server/src/services/pythonWsClient.ts`, `server/src/streams/rtspManager.ts` | 2h |

**Acceptance criteria:**
- EventBus is typed — cannot emit unknown event types
- All handlers are automatically cleaned up on service stop
- Event flow: Python WS → EventBus → Socket.io + persistence (decoupled)

---

## 5. Tier 3: Security & Observability

### 5.1 CSP/HSTS Hardening

**Current state:** CSP allows `unsafe-inline` + `unsafe-eval`. HSTS explicitly disabled.

**Plan:**

| Step | Task | File(s) | Effort |
|------|------|---------|--------|
| 5.1.1 | Remove `unsafe-eval` from CSP, test if any code relies on `eval()` | `server/src/index.ts` | 1h |
| 5.1.2 | Replace `unsafe-inline` with nonce-based approach for inline scripts | `server/src/index.ts` | 2h |
| 5.1.3 | Enable HSTS with `maxAge=31536000; includeSubDomains` | `server/src/index.ts` | 0.5h |
| 5.1.4 | Fix `upgradeInsecureRequests: null` — remove or set to `[]` | `server/src/index.ts` | 0.25h |

**Acceptance criteria:**
- CSP score A+ on Mozilla Observatory check
- HSTS header present on all responses
- No runtime errors from tightened CSP

---

### 5.2 Face Images: Remove from Git

**Current state:** 15 PII images (~1MB) in `opencv-service/known_faces/TestPerson/` tracked in git history.

**Plan:**

| Step | Task | File(s) | Effort |
|------|------|---------|--------|
| 5.2.1 | Add `opencv-service/known_faces/` to `.gitignore` | Root `.gitignore` | 0.25h |
| 5.2.2 | Remove tracked files with `git rm --cached` (preserve local copies) | Git command | 0.5h |
| 5.2.3 | Rewrite git history with `git filter-repo` to purge from all commits | Git command | 2h |
| 5.2.4 | Add note in AGENTS.md about known_faces being excluded | `AGENTS.md` | 0.25h |

**Acceptance criteria:**
- `known_faces/` no longer tracked by git
- `git log --all --diff-filter=A -- opencv-service/known_faces/TestPerson/` returns empty
- Local files preserved in working directory
- `git filter-repo` documented in AGENTS.md for future PII removal

---

### 5.3 RTSP Credential Encryption

**Current state:** `credentialEncryption.ts` exists but is inconsistently used. Config loader warns about plaintext RTSP credentials.

**Plan:**

| Step | Task | File(s) | Effort |
|------|------|---------|--------|
| 5.3.1 | Audit all code paths that read RTSP URLs from cameras.json | `server/src/config/index.ts`, `server/src/streams/rtspManager.ts` | 1h |
| 5.3.2 | Add mandatory encryption step in camera config loading — decrypt on read, fail if plaintext and `REQUIRE_ENCRYPTED_CREDENTIALS=true` | `server/src/config/index.ts` | 2h |
| 5.3.3 | Create `scripts/encrypt-camera-credentials.ts` utility to batch-encrypt cameras.json | `scripts/` | 1h |
| 5.3.4 | Add migration guide in AGENTS.md | `AGENTS.md` | 0.5h |

**Acceptance criteria:**
- `REQUIRE_ENCRYPTED_CREDENTIALS=true` prevents startup if any credentials are plaintext
- All RTSP URL reads go through `credentialEncryption.decrypt()`
- Batch encryption script works for all cameras in cameras.json
- README documents the encryption workflow

---

### 5.4 CI Pipeline

**Current state:** No CI. No automated testing, linting, or typechecking on push/PR.

**Plan:**

| Step | Task | File(s) | Effort |
|------|------|---------|--------|
| 5.4.1 | Create `.github/workflows/ci.yml` — trigger on push/PR to main | `.github/workflows/` | 2h |
| 5.4.2 | Job 1: Lint (frontend + server ESLint) | CI config | 0.5h |
| 5.4.3 | Job 2: TypeCheck (frontend + server tsc --noEmit) | CI config | 0.5h |
| 5.4.4 | Job 3: Test (frontend + server Jest, Python pytest) | CI config | 0.5h |
| 5.4.5 | Job 4: Build (frontend Vite build, server tsc build) | CI config | 0.5h |
| 5.4.6 | Add status badge to root README | `README.md` | 0.25h |

**Acceptance criteria:**
- CI runs all 4 jobs in parallel
- PR cannot merge if any job fails
- Total CI run time < 5 minutes
- Badge shows current main branch status

---

### 5.5 Memory Monitoring

**Current state:** Node.js heap capped at 512MB (`--max-old-space-size=512`), no alerting on OOM risk.

**Plan:**

| Step | Task | File(s) | Effort |
|------|------|---------|--------|
| 5.5.1 | Add memory usage metric to `/api/system/health` endpoint | `server/src/controllers/SystemController.ts` | 1h |
| 5.5.2 | Add threshold warning (heap > 80% of max) with logged alert | `server/src/utils/healthMonitor.ts` (new) | 1h |
| 5.5.3 | Add database for system health metrics, store periodic snapshots | `server/src/models/SystemHealth.ts` | 1h |
| 5.5.4 | Create frontend health widget for admin dashboard (optional) | `frontend/src/components/dashboard/` | 2h |

**Acceptance criteria:**
- `/api/system/health` returns `{ memory: { heapUsed, heapTotal, heapMax, usagePercent, rss } }`
- Warning logged when heap exceeds 80% of max
- Historical health data queryable for trend analysis

---

## 6. Tier 4: Performance

### 6.1 Redis Evaluation

**Current state:** Redis is optional (disabled by default via `REDIS_DISABLED=true`). In-memory fallback works but has no eviction tied to system memory.

**Plan:**

| Step | Task | File(s) | Effort |
|------|------|---------|--------|
| 6.1.1 | Benchmark current in-memory cache under load: measure hit rate, memory usage, latency at 50/100/200 concurrent cameras | Performance test | 4h |
| 6.1.2 | Compare against Redis: same metrics with Redis enabled | Performance test | 2h |
| 6.1.3 | Decision: enable Redis by default or add bounded LRU eviction to in-memory cache | Based on results | 1h |
| 6.1.4 | If keeping in-memory: implement `maxEntries` (default 10000) with LRU eviction | `server/src/services/cacheService.ts` | 2h |

**Acceptance criteria:**
- Data-driven decision documented in `IMPROVEMENTS.md` or ADR
- If Redis: enabled by default in Docker Compose with proper config
- If in-memory: bounded LRU cache prevents unbounded memory growth

---

### 6.2 Component Code-Splitting

**Current state:** `CameraStream.tsx` (1004 lines) is a monolithic component mixing stream rendering, controls, overlays, and state.

**Plan:**

| Step | Task | File(s) | Effort |
|------|------|---------|--------|
| 6.2.1 | Extract `StreamPlayer` (video element, adaptive FPS, connection state) | `frontend/src/components/live/StreamPlayer.tsx` | 2h |
| 6.2.2 | Extract `StreamControls` (fullscreen, snapshot, recording toggle) | `frontend/src/components/live/StreamControls.tsx` | 1h |
| 6.2.3 | Extract `StreamOverlay` (detection boxes, labels, confidence scores) | `frontend/src/components/live/StreamOverlay.tsx` | 1.5h |
| 6.2.4 | Extract `StreamInfo` (camera name, FPS, resolution, viewer count) | `frontend/src/components/live/StreamInfo.tsx` | 1h |
| 6.2.5 | Add `React.lazy()` for above components in `StreamDashboard.tsx` | `frontend/src/pages/StreamDashboard.tsx` | 0.5h |

**Acceptance criteria:**
- `CameraStream.tsx` ≤ 200 lines (importing sub-components)
- Each sub-component has a single responsibility
- Lazy-loaded, not blocking initial render

---

### 6.3 Dead Config Cleanup

**Current state:** Webhook env vars (`WEBHOOK_URL`, `SLACK_WEBHOOK`, `DISCORD_WEBHOOK`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`) are in `.env.example` but not implemented in code. `.env.example` is 378 lines with many undocumented vars.

**Plan:**

| Step | Task | File(s) | Effort |
|------|------|---------|--------|
| 6.3.1 | Audit `.env.example` against `server/src/config/index.ts` — remove vars not consumed anywhere | `.env.example`, full repo grep | 2h |
| 6.3.2 | Remove dead webhook env vars from `.env.example` | `.env.example` | 0.5h |
| 6.3.3 | Add comments for each remaining var (purpose, required/optional, default) | `.env.example` | 1h |
| 6.3.4 | Trim `.env.example` to ≤ 100 lines (from 378) | `.env.example` | 1h |

**Acceptance criteria:**
- Every var in `.env.example` is consumed by code (grep-verified)
- Dead config vars removed
- `.env.example` ≤ 100 lines with documented purpose per var

---

### 6.4 Dependency Cleanup

**Current state:** Duplicated dependencies (`redis` + `ioredis`, `speakeasy` in frontend), mismatched types.

**Plan:**

| Step | Task | File(s) | Effort |
|------|------|---------|--------|
| 6.4.1 | Remove `speakeasy` + `@types/speakeasy` from `frontend/package.json` | `frontend/package.json` | 0.25h |
| 6.4.2 | Consolidate Redis: choose `ioredis` (more feature-rich), remove `redis` | `server/package.json`, `cacheService.ts` | 2h |
| 6.4.3 | Remove `@types/express` (Express v5 ships own types) | `server/package.json` | 0.25h |
| 6.4.4 | Remove `@types/socket.io` (Socket.io v4 ships own types) | `server/package.json` | 0.25h |
| 6.4.5 | Replace `node-fetch` with built-in `fetch` (Node 18+) | `server/src/services/nvidia/nvidiaClient.ts` | 1h |

**Acceptance criteria:**
- `npm ls speakeasy` in frontend shows "(deduped from)" or not present
- Only one Redis client in `server/package.json`
- `npm ls @types/express` shows no v4 types (Express v5 built-in only)
- `node-fetch` removed from dependencies

---

## 7. Dependency Graph & Ordering

```
Phase A (Tier 0 — Reliability)
  ┣━ 2.1 Fire-and-forget fixes        ← no deps, start here
  ┣━ 2.2 Circuit breaker              ← 2.1 (same files)
  ┣━ 2.3 WS reconnection ceiling       ← 2.1 (same patterns)
  ┗━ 2.4 In-memory state sync          ← 2.1 (same patterns)

Phase B (Tier 2 — Quality foundation)
  ┣━ 4.4 Lint + formatter             ← no deps, can run in parallel with Phase A
  ┣━ 4.1 any type purge               ← 4.4 (needs lint rules)
  ┣━ 4.5 EventBus                     ← 4.1 (needs types)
  ┗━ 4.3 Bootstrap decomposition       ← 4.1 (needs typed services)

Phase C (Tier 3 — Security & CI)
  ┣━ 5.1 CSP/HSTS                     ← 4.4 (needs formatter pass)
  ┣━ 5.2 Face images from git         ← no deps
  ┣━ 5.3 RTSP encryption              ← 4.1 (needs typed config)
  ┣━ 5.4 CI pipeline                  ← 4.4 (needs lint working)
  ┗━ 5.5 Memory monitoring            ← 4.1 (needs typed controller)

Phase D (Tier 1 — Tests)
  ┣━ 3.1 Frontend tests               ← 4.4 (needs lint clean)
  ┣━ 3.2 Backend service tests         ← 2.1, 2.2, 4.1 (needs stable code)
  ┣━ 3.3 Python tests                  ← no deps
  ┗━ 3.4 E2E tests                    ← 3.1 (same patterns)
     ┗━ runs only after Phase A+B+C

Phase E (Tier 4 — Performance)
  ┣━ 6.1 Redis evaluation             ← 4.4 (needs clean code for perf testing)
  ┣━ 6.2 Component code-splitting     ← 3.1 (test before refactor)
  ┣━ 6.3 Dead config cleanup          ← no deps
  ┗━ 6.4 Dependency cleanup           ← no deps

Phase F (Tier 2 — God files, post-debt)
  ┣━ 4.2 God file split               ← 4.1 (needs types), 3.1/3.2 (tests before refactor)
  ┗━ 4.2 runs LAST — highest risk, most files changed
```

**Recommended execution: Phase A → B → C → D → E → F**

---

## 8. Effort Summary

| Tier | Area | Steps | Total Effort |
|------|------|-------|-------------|
| 0 | Fire-and-forget promises | 3 | 6.5h |
| 0 | Circuit breaker | 5 | 8.5h |
| 0 | WS reconnection ceiling | 3 | 2.5h |
| 0 | In-memory state sync | 4 | 5.5h |
| **Tier 0 total** | **15** | **~23h (3 days)** |
| 1 | Frontend tests | 6 | 15.5h |
| 1 | Backend service tests | 6 | 17.5h |
| 1 | Python pipeline tests | 5 | 15h |
| 1 | E2E tests | 5 | 10h |
| **Tier 1 total** | **22** | **~58h (8 days)** |
| 2 | any type purge | 7 | 19.5h |
| 2 | God file split | 4 | 14h |
| 2 | Bootstrap decomposition | 5 | 8h |
| 2 | Lint & formatter | 6 | 5.25h |
| 2 | EventBus | 3 | 5h |
| **Tier 2 total** | **25** | **~52h (7 days)** |
| 3 | CSP/HSTS | 4 | 3.75h |
| 3 | Face images from git | 4 | 3h |
| 3 | RTSP credential encryption | 4 | 4.5h |
| 3 | CI pipeline | 6 | 4.25h |
| 3 | Memory monitoring | 4 | 5h |
| **Tier 3 total** | **22** | **~20h (2.5 days)** |
| 4 | Redis eval | 4 | 9h |
| 4 | Component code-splitting | 5 | 6h |
| 4 | Dead config cleanup | 4 | 4.5h |
| 4 | Dependency cleanup | 5 | 3.75h |
| **Tier 4 total** | **18** | **~23h (3 days)** |
| **Grand total** | **102** | **~176h (24 days)** |

---

## Appendix: Quick Wins (< 4 hours each)

These can be done independently while larger phases are planned:

| Task | Est. | Deps |
|------|------|------|
| Enable HSTS | 0.5h | None |
| Remove `@types/express` | 0.25h | None |
| Remove `@types/socket.io` | 0.25h | None |
| Remove `speakeasy` from frontend | 0.25h | None |
| Add `.editorconfig` | 0.25h | None |
| Remove `simulateMotionDetection` or add `NODE_ENV` guard | 0.5h | None |
| Remove dead webhook config from `.env.example` | 0.5h | None |
| Clean up stale empty directories in `data/detections/` | 0.25h | None |
| Rename `health:check` script (doesn't check health) | 0.25h | None |

---
