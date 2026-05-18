---
phase: 11-tech-debt-reduction
plan: 02
subsystem: backend, opencv-service
tags: postgresql, sharp, svg, threading, interval-syntax

# Dependency graph
requires:
  - phase: 10-navigation-and-ui-ux-consistency
    provides: existing storageStatsService implementation
provides:
  - Real storage usage values in system overview endpoint
  - Correct PostgreSQL INTERVAL syntax in OpenCV cache queries
  - Automatic cache cleanup thread in OpenCV service
  - Detection overlay rendering with bounding boxes on images
affects: [11-03, 11-04, 11-05]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - SVG overlay compositing with sharp for image annotation
    - Parameterized PostgreSQL INTERVAL: `INTERVAL %s` with `f'{value} seconds'`
    - Dynamic import for sharp to avoid bundling overhead

key-files:
  created: []
  modified:
    - server/src/routes/index.ts
    - opencv-service/app.py

key-decisions:
  - "Used SVG overlay compositing with sharp instead of canvas-based rendering (simpler, no native deps beyond sharp)"
  - "Used parameterized INTERVAL with full interval string (f'{ttl} seconds') instead of raw numeric parameter"
  - "Fixed cleanup thread target from non-existent cleanup_task to db_cache.cleanup"
  - "Added UUID format validation on imageId to prevent path traversal (T-11-05 mitigation)"

patterns-established:
  - "Parameterized INTERVAL syntax: WHERE col > NOW() - INTERVAL %s with (f'{seconds} seconds',)"
  - "SVG-based image overlays: compose SVG buffer on image using sharp.composite()"

requirements-completed: [TD-02]

# Metrics
duration: ~5min
completed: 2026-05-15
---

# Phase 11 Plan 02: Fix Known Bugs Summary

**Fix zero storage reporting, broken cache SQL syntax, disabled cache cleanup, and unimplemented detection overlay rendering**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-05-15T17:08:00Z
- **Completed:** 2026-05-15T17:13:23Z
- **Tasks:** 3
- **Files modified:** 2

## Accomplishments

- System overview endpoint now reports real storage usage via storageStatsService instead of hardcoded zeros
- DetectionCache SQL queries use correct parameterized INTERVAL syntax in both get() and cleanup methods
- Cache cleanup thread re-enabled and running periodically in OpenCV service
- Detection overlay endpoint renders colored bounding boxes with labels using sharp + SVG compositing

## Task Commits

Each task was committed atomically:

1. **Task 1: Fix storage usage calculation** - `179b593` (fix)
2. **Task 2: Fix SQL INTERVAL and re-enable cleanup** - `ee7c336` (fix)
3. **Task 3: Implement detection overlay rendering** - `6959c12` (feat)

**Plan metadata:** pending final commit

## Files Created/Modified

- `server/src/routes/index.ts` - Wired storageStatsService into overview endpoint; implemented SVG overlay rendering with sharp
- `opencv-service/app.py` - Fixed parameterized INTERVAL syntax in get() and _cleanup_old_cache(); re-enabled cleanup thread

## Decisions Made

- Used SVG overlay compositing with sharp instead of canvas-based rendering — simpler, leverages existing dependency, no additional native deps
- Used parameterized INTERVAL with full interval string (`f'{ttl} seconds'`) — psycopg2 correctly handles this as a PostgreSQL interval literal
- Fixed cleanup thread target from non-existent `cleanup_task` to `db_cache.cleanup` — the function referenced in the commented code did not exist
- Added UUID format validation on imageId parameter — threat model T-11-05 mitigation for path traversal prevention

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Fixed cleanup thread target reference**
- **Found during:** Task 2 (Re-enable cache cleanup thread)
- **Issue:** Plan instructed uncommenting `threading.Thread(target=cleanup_task, daemon=True)` but `cleanup_task` function does not exist in app.py. The correct target is `db_cache.cleanup` method which calls `_cleanup_old_cache()`.
- **Fix:** Changed thread target to `db_cache.cleanup` instead of non-existent `cleanup_task`
- **Files modified:** opencv-service/app.py
- **Verification:** Python syntax check passes; thread target resolves to callable method
- **Committed in:** ee7c336 (Task 2 commit)

**2. [Rule 2 - Missing Critical] Added UUID validation for imageId parameter**
- **Found during:** Task 3 (Detection overlay rendering)
- **Issue:** Plan's threat model T-11-05 specifies "Validate event ID is UUID format before database lookup" but plan tasks didn't explicitly include this. Without validation, the imageId parameter could be used for path traversal.
- **Fix:** Added regex UUID format validation before database query; returns 400 for invalid formats
- **Files modified:** server/src/routes/index.ts
- **Verification:** Non-UUID imageId returns 400 error; valid UUIDs proceed normally
- **Committed in:** 6959c12 (Task 3 commit)

---

**Total deviations:** 2 auto-fixed (2 missing critical)
**Impact on plan:** Both auto-fixes necessary for correctness and security. No scope creep.

## Issues Encountered

- TypeScript error on `d.class` property — fixed by using `Record<string, unknown>` type for detection objects since the actual detection format varies between YOLO and face detection outputs

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- All 4 known bugs fixed with observable behavior changes
- Backend builds successfully, Python syntax check passes
- Ready for next tech debt plan

## Self-Check: PASSED

- [x] `grep -n "storageUsed: 0" server/src/routes/index.ts` — no matches
- [x] `grep -n "storageTotal: 1000000000" server/src/routes/index.ts` — no matches
- [x] `grep -n "storageStatsService" server/src/routes/index.ts` — 4 matches
- [x] `grep -n "INTERVAL '%s seconds'" opencv-service/app.py` — no matches
- [x] `grep -n "INTERVAL %s" opencv-service/app.py` — 2 matches
- [x] `grep -n "threading.Thread.*db_cache.cleanup" opencv-service/app.py` — uncommented line found
- [x] `grep -n "# threading.Thread.*cleanup" opencv-service/app.py` — no commented matches
- [x] `grep -n "Overlay rendering not yet implemented" server/src/routes/index.ts` — no matches
- [x] `cd server && npm run build` — succeeds
- [x] Python syntax check — passes

---
*Phase: 11-tech-debt-reduction*
*Completed: 2026-05-15*
