---
phase: 11-tech-debt-reduction
plan: 05
subsystem: architecture
tags: [express, routes, refactoring, typescript, god-file]

# Dependency graph
requires:
  - phase: 11-04
    provides: serviceRegistry pattern for typed service access
provides:
  - 6 domain-specific route modules extracted from 4,095-line god file
  - InMemoryStateService for typed in-memory state management
  - Significantly reduced routes/index.ts (2,160 lines from 4,095)
  - Clean route registration pattern in server/src/index.ts
affects: [future-route-additions, testing, code-review]

# Tech tracking
tech-stack:
  added: []
  patterns: [configure*Routes(app: Express) pattern, serviceRegistry access, inMemoryState singleton]

key-files:
  created:
    - server/src/services/inMemoryStateService.ts
    - server/src/routes/cameraRoutes.ts
    - server/src/routes/analyticsRoutes.ts
    - server/src/routes/settingsRoutes.ts
    - server/src/routes/streamRoutes.ts
    - server/src/routes/systemRoutes.ts
    - server/src/routes/reviewTimelineRoutes.ts
  modified:
    - server/src/routes/index.ts
    - server/src/index.ts

key-decisions:
  - "Used configure*Routes(app: Express) pattern matching existing auth.ts convention"
  - "InMemoryStateService uses typed interfaces instead of any types"
  - "Alerts and archive routes kept in index.ts (not extracted) as they use in-memory state directly"

patterns-established:
  - "Route extraction: Each module exports configureXxxRoutes(app: Express) function"
  - "Service access: All modules use serviceRegistry.get*() instead of (global as any)"
  - "State management: InMemoryStateService singleton replaces global mutable state"

requirements-completed:
  - TD-01

# Metrics
duration: 20min
completed: 2026-05-15
---

# Phase 11 Plan 05: God File Split Summary

**Split 4,095-line routes/index.ts into 6 domain-specific route modules with InMemoryStateService, reducing god file to 2,160 lines**

## Performance

- **Duration:** 20 min
- **Started:** 2026-05-15T18:07:00Z
- **Completed:** 2026-05-15T18:27:49Z
- **Tasks:** 3
- **Files modified:** 9 (7 created, 2 modified)

## Accomplishments

- Created InMemoryStateService with typed interfaces for recentEvents, alerts, and system settings
- Extracted 6 domain-specific route modules (camera, analytics, settings, stream, system, review/timeline)
- Reduced routes/index.ts from 4,095 to 2,160 lines (47% reduction)
- Removed all inline routes from server/src/index.ts
- All new modules use serviceRegistry and inMemoryState — no (global as any) references
- Backend builds successfully with no TypeScript errors

## Task Commits

Each task was committed atomically:

1. **Task 1: Extract in-memory state into dedicated service** - `5fdeeb8` (feat) — InMemoryStateService created with typed methods
2. **Task 2: Extract route groups into domain-specific modules** - `017f48d` (feat) — 6 route module files created
3. **Task 3: Wire extracted routes and reduce god file** - `15d0bbf` (feat) — Routes wired, god file reduced, inline routes removed

**Plan metadata:** Final commit includes SUMMARY.md

## Files Created/Modified

- `server/src/services/inMemoryStateService.ts` — Typed in-memory state service (169 lines)
- `server/src/routes/cameraRoutes.ts` — Camera listing, control, zones, filters, motion (498 lines)
- `server/src/routes/analyticsRoutes.ts` — Hourly/weekly/monthly analytics (125 lines)
- `server/src/routes/settingsRoutes.ts` — System settings CRUD, detection config (201 lines)
- `server/src/routes/streamRoutes.ts` — MJPEG streams, stream status (328 lines)
- `server/src/routes/systemRoutes.ts` — Health, overview, logs, maintenance (218 lines)
- `server/src/routes/reviewTimelineRoutes.ts` — Review segments, timeline (108 lines)
- `server/src/routes/index.ts` — Reduced from 4,095 to 2,160 lines
- `server/src/index.ts` — Route registrations added, inline routes removed

## Decisions Made

- Used `configure*Routes(app: Express)` pattern matching existing `auth.ts` convention for consistency
- InMemoryStateService uses typed interfaces (MotionEvent, Alert, SystemSettings) — no `any` types
- Alert routes kept in index.ts (not extracted) since they directly manipulate in-memory state
- Camera type imported from `rtspManager.js`, CameraConfig from `config/index.js` (fixed import path deviation)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed Camera/CameraConfig import paths**
- **Found during:** Task 3 (build verification)
- **Issue:** cameraRoutes.ts and systemRoutes.ts imported Camera from '../config/index.js' but it's exported from '../streams/rtspManager.js'
- **Fix:** Updated imports to use correct source modules
- **Files modified:** server/src/routes/cameraRoutes.ts, server/src/routes/systemRoutes.ts
- **Verification:** `cd server && npm run build` succeeds
- **Committed in:** 15d0bbf (part of Task 3 commit)

---

**Total deviations:** 1 auto-fixed (1 bug fix)
**Impact on plan:** Import path fix required for TypeScript compilation. No scope creep.

## Issues Encountered

- None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- God file significantly reduced, ready for future route additions
- Route extraction pattern established for future modules
- Remaining routes in index.ts (event CRUD, detection triggers, face recognition) could be extracted in future plans if needed

---
*Phase: 11-tech-debt-reduction*
*Completed: 2026-05-15*
