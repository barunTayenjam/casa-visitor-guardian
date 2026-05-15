---
phase: 11-tech-debt-reduction
plan: 04
subsystem: architecture
tags: [typescript, singleton, service-registry, type-safety, refactoring]

# Dependency graph
requires:
  - phase: 11-tech-debt-reduction
    provides: "Prior plans established codebase concerns and architecture context"
provides:
  - Typed ServiceRegistry class replacing unsafe (global as any) singleton pattern
  - Type-safe getter/setter pairs for all 12 backend services
  - Fail-fast error behavior for uninitialized service access
  - Zero (global as any) references in production server code
affects: [11-05, 11-06, 11-07, future-testing-plans]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Service Registry pattern — typed singleton container replacing global assignments"
    - "Fail-fast getters — throw descriptive errors instead of returning undefined"
    - "Interface extraction — DetectionServiceInterface replaces any-typed field"

key-files:
  created:
    - server/src/services/serviceRegistry.ts
  modified:
    - server/src/index.ts
    - server/src/routes/index.ts
    - server/src/detection/optimizedMotionDetection.ts
    - server/src/utils/cronJobs.ts

key-decisions:
  - "Used Map<string, unknown> backing store with typed getters instead of individual private fields — keeps class maintainable as services grow"
  - "NotificationService stored as typeof class (static methods) rather than instance — matches existing usage pattern"
  - "Route handlers wrap ServiceRegistry getters in try-catch to return graceful fallbacks during startup window before services initialize"
  - "Removed (global as any).optimizedMotionDetector assignment from factory function — ServiceRegistry is now the single source of truth"

requirements-completed:
  - TD-01

# Metrics
duration: 12 min
completed: 2026-05-15
---

# Phase 11 Plan 04: Replace (global as any) with Typed ServiceRegistry

**Replaced unsafe `(global as any)` service singleton pattern with typed ServiceRegistry class providing type-safe access to all 12 backend services, eliminating type errors, enabling testability, and removing race condition risks**

## Performance

- **Duration:** 12 min
- **Started:** 2026-05-15T17:18:00Z
- **Completed:** 2026-05-15T17:30:39Z
- **Tasks:** 3
- **Files modified:** 5

## Accomplishments

- Created ServiceRegistry class with typed getter/setter pairs for 12 services (AppDataSource, StreamManager, OptimizedMotionDetector, ConsolidatedDetectionService, ReviewService, TimelineService, DetectionService, NotificationService, StorageStatsService, RetentionPolicyService, AutomatedCleanupService, PreviewService)
- Migrated all 40+ `(global as any)` references across 5 files to use ServiceRegistry
- Zero `(global as any)` references remaining in production server code
- Properly typed `detectionService` field in OptimizedMotionDetector (was `any`)
- Backend builds successfully with no type errors

## Task Commits

Each task was committed atomically:

1. **Task 1: Create typed ServiceRegistry class** - `bbcfbec` (feat)
2. **Task 2: Migrate service initialization from (global as any) to ServiceRegistry** - `86f231c` (feat)
3. **Task 3: Update service consumers to use ServiceRegistry** - `8b4c4b7` (feat)

## Files Created/Modified

- `server/src/services/serviceRegistry.ts` — New typed ServiceRegistry class with 12 service getter/setter pairs and fail-fast getRequired() core method
- `server/src/index.ts` — Replaced 12 setter assignments and 16 getter reads; updated Socket.io handlers and graceful shutdown
- `server/src/routes/index.ts` — Replaced 7 `(global as any)` reads in helper functions and route handlers
- `server/src/detection/optimizedMotionDetection.ts` — Replaced 4 `(global as any)` references; typed detectionService field as DetectionServiceInterface
- `server/src/utils/cronJobs.ts` — Replaced 2 `(global as any)` references (deviation Rule 2)

## Decisions Made

- **Map-backed storage over individual fields:** Using `Map<string, unknown>` with typed getters keeps the class maintainable as services are added/removed, versus having 12+ individual private fields
- **Graceful fallbacks in routes:** Route handlers that previously returned empty data when services were unavailable now catch the "not been initialized" error from ServiceRegistry getters and return the same fallback responses
- **NotificationService as typeof class:** Since NotificationService uses static methods (not instantiated), the registry stores `typeof NotificationService` rather than an instance

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] cronJobs.ts also had (global as any) references**
- **Found during:** Task 3 verification scan
- **Issue:** Plan success criteria required zero (global as any) in production code, but cronJobs.ts had 2 remaining references
- **Fix:** Added serviceRegistry import and replaced both references with serviceRegistry.getStreamManager()
- **Files modified:** server/src/utils/cronJobs.ts
- **Verification:** grep confirms zero (global as any) in production code
- **Committed in:** 8b4c4b7 (amended into Task 3 commit)

---

**Total deviations:** 1 auto-fixed (1 missing critical)
**Impact on plan:** All auto-fixes necessary to meet plan success criteria. No scope creep.

## Issues Encountered

None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- ServiceRegistry is now the single source of truth for all backend service access
- Future plans can import `serviceRegistry` from `../services/serviceRegistry.js` instead of using `(global as any)`
- Testing plans can now mock ServiceRegistry for isolated unit tests
- cronJobs.ts still uses imported `streamManager` from rtspManager.ts (module-level singleton) — not a (global as any) pattern but could be unified with ServiceRegistry in a future cleanup

---
*Phase: 11-tech-debt-reduction*
*Completed: 2026-05-15*

## Self-Check: PASSED

- [x] server/src/services/serviceRegistry.ts exists on disk
- [x] class ServiceRegistry definition present
- [x] serviceRegistry singleton exported
- [x] 12 typed getter methods for all services
- [x] Zero (global as any) references in production code
- [x] Backend builds successfully
- [x] All 3 commits exist in git log (bbcfbec, 86f231c, 8b4c4b7)
