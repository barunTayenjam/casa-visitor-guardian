---
phase: 11-tech-debt-reduction
plan: 01
subsystem: cleanup
tags: [naming-conventions, dead-code, logging, debug-endpoints]

# Dependency graph
requires: []
provides:
  - Clean page file naming without .new suffix
  - Removed dead .disabled model artifacts
  - Removed accidentally committed Python venv
  - Removed unauthenticated debug endpoints
  - Re-enabled database logging
affects: [11-02, 11-03, 11-04]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Standard .tsx extension for all page components
    - No .disabled model files — dead code removed outright
    - Python venv patterns in .gitignore

key-files:
  created: []
  modified:
    - frontend/src/pages/StreamDashboard.tsx
    - frontend/src/pages/EventsPage.tsx
    - frontend/src/pages/Settings.tsx
    - frontend/src/pages/Analytics.tsx
    - frontend/src/pages/DayHighlights.tsx
    - frontend/src/App.tsx
    - server/src/models/Session.ts.disabled (deleted)
    - server/src/models/AuditLog.ts.disabled (deleted)
    - server/src/models/AuditLog.test.ts (deleted)
    - .gitignore
    - server/src/index.ts
    - server/src/routes/index.ts
    - server/src/utils/logger.ts

key-decisions:
  - "Used git mv for renames to preserve git history"
  - "Removed orphaned AuditLog.test.ts since it tested the disabled model"
  - "Did not use git rm -r --cached for node-env/ since it was not git-tracked"

patterns-established:
  - "File naming: no .new suffix — if a file is the canonical version, it uses the standard extension"
  - "Dead code: remove .disabled files outright rather than keeping them as reference"

requirements-completed:
  - TD-05

# Metrics
duration: 5 min
completed: 2026-05-15
---

# Phase 11 Plan 01: Naming Cleanup, Dead Code Removal, and Logging Re-enable

**Renamed 5 .new.tsx page files, removed 2 .disabled models + orphaned test, deleted committed Python venv, removed 2 unauthenticated debug endpoints, re-enabled database logging**

## Performance

- **Duration:** 5 min
- **Started:** 2026-05-15T17:05:00Z
- **Completed:** 2026-05-15T17:10:34Z
- **Tasks:** 4
- **Files modified:** 13

## Accomplishments

- All 5 page files renamed from .new.tsx to .tsx with git mv (history preserved)
- App.tsx lazy imports updated to reference standard filenames
- Two dead .disabled model files removed (Session.ts.disabled, AuditLog.ts.disabled)
- Orphaned AuditLog.test.ts removed (tested disabled model)
- server/node-env/ Python virtual environment directory deleted
- node-env patterns added to root .gitignore
- /test debug endpoint removed from server/src/index.ts
- /api/cameras/debug endpoint removed from server/src/routes/index.ts
- Database logging re-enabled in server/src/utils/logger.ts
- Frontend typecheck passes, backend build passes

## Task Commits

Each task was committed atomically:

1. **Task 1: Rename .new.tsx page files and update App.tsx imports** - `a6f2773` (refactor)
2. **Task 2: Remove .disabled model files and clean up related test** - `fdae046` (chore)
3. **Task 3: Remove server/node-env/ directory and add to .gitignore** - `6ed1638` (chore)
4. **Task 4: Remove debug endpoints and re-enable database logging** - `4fbe42c` (fix)

**Plan metadata:** pending (docs: complete plan)

## Files Created/Modified

- `frontend/src/pages/StreamDashboard.tsx` - Renamed from .new.tsx
- `frontend/src/pages/EventsPage.tsx` - Renamed from .new.tsx
- `frontend/src/pages/Settings.tsx` - Renamed from .new.tsx
- `frontend/src/pages/Analytics.tsx` - Renamed from .new.tsx
- `frontend/src/pages/DayHighlights.tsx` - Renamed from .new.tsx
- `frontend/src/App.tsx` - Updated lazy imports to remove .new suffix
- `server/src/models/Session.ts.disabled` - Deleted (dead code)
- `server/src/models/AuditLog.ts.disabled` - Deleted (redundant)
- `server/src/models/AuditLog.test.ts` - Deleted (orphaned test)
- `.gitignore` - Added node-env/ and venv patterns
- `server/src/index.ts` - Removed /test debug endpoint
- `server/src/routes/index.ts` - Removed /api/cameras/debug endpoint
- `server/src/utils/logger.ts` - Re-enabled enableDatabaseLogging

## Decisions Made

None - followed plan as specified. All tasks executed exactly as planned with no deviations.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## Authentication Gates

None

## Known Stubs

None — no stubs introduced by this plan. Pre-existing TODOs and placeholder patterns in the codebase are unchanged.

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| threat_flag: reduced attack surface | server/src/index.ts | Removed unauthenticated /test endpoint (T-11-01 mitigated) |
| threat_flag: reduced attack surface | server/src/routes/index.ts | Removed unauthenticated /api/cameras/debug endpoint (T-11-02 mitigated) |

## Next Phase Readiness

- All .new.tsx files cleaned up — ready for any plan that references these page files
- Dead model artifacts removed — models/index.ts is clean
- Debug endpoints removed — attack surface reduced
- Database logging re-enabled — monitoring restored
- Ready for 11-02 (next tech debt plan)

---
*Phase: 11-tech-debt-reduction*
*Completed: 2026-05-15*

## Self-Check: PASSED

- [x] frontend/src/pages/StreamDashboard.tsx exists
- [x] frontend/src/pages/EventsPage.tsx exists
- [x] frontend/src/pages/Settings.tsx exists
- [x] frontend/src/pages/Analytics.tsx exists
- [x] frontend/src/pages/DayHighlights.tsx exists
- [x] No .new.tsx files in frontend/src/pages/
- [x] No .disabled files in server/src/models/
- [x] server/node-env/ does not exist
- [x] .gitignore contains node-env pattern
- [x] No /test endpoint in server/src/index.ts
- [x] No cameras/debug in server/src/routes/index.ts
- [x] enableDatabaseLogging set to true in logger.ts
- [x] Frontend typecheck passes
- [x] Backend build passes
