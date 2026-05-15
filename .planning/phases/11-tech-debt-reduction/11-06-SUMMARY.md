---
phase: 11-tech-debt-reduction
plan: 06
subsystem: frontend-architecture
tags: [api-service, refactoring, modularization, typescript, fetch]

# Dependency graph
requires:
  - phase: 10-navigation-and-ui-ux-consistency
    provides: existing ApiService.ts monolith to refactor
provides:
  - 8 domain-specific API service modules with clear ownership
  - Shared base client eliminating duplicate HTTP configuration
  - Backward-compatible barrel re-export from ApiService.ts
  - Tree-shaking enabled (unused service methods not bundled)
affects: [all future frontend plans that add API methods]

# Tech tracking
tech-stack:
  added: []
  patterns: [domain-specific service modules, shared base client with fetch, barrel re-exports for backward compatibility]

key-files:
  created:
    - frontend/src/services/api/baseClient.ts
    - frontend/src/services/api/cameraService.ts
    - frontend/src/services/api/eventService.ts
    - frontend/src/services/api/visitorService.ts
    - frontend/src/services/api/settingsService.ts
    - frontend/src/services/api/authService.ts
    - frontend/src/services/api/detectionService.ts
    - frontend/src/services/api/reviewService.ts
    - frontend/src/services/api/systemService.ts
  modified:
    - frontend/src/services/ApiService.ts
    - frontend/src/contexts/AuthContext.tsx
    - frontend/src/contexts/CameraContext.tsx
    - frontend/src/pages/EventsPage.tsx
    - frontend/src/pages/DayHighlights.tsx

key-decisions:
  - "Used native fetch instead of adding axios dependency (avoided unnecessary new dependency)"
  - "ApiService.ts reduced to barrel re-export for backward compatibility rather than full deletion"
  - "Batch processing methods placed in eventService (logical grouping with event-related operations)"
  - "Alerts and logs placed in settingsService (system administration grouping)"
  - "Face recognition methods placed in detectionService (computer vision grouping)"

patterns-established:
  - "Domain service pattern: each module exports a singleton object with domain-specific methods"
  - "Base client pattern: shared fetchWithRetry with auth interceptor, timeout, and retry logic"
  - "Error class pattern: ApiError, NetworkError, TimeoutError exported from baseClient"
  - "Barrel re-export pattern: ApiService.ts re-exports all domain services for backward compatibility"

requirements-completed:
  - TD-01

# Metrics
duration: 12min
completed: 2026-05-15
---

# Phase 11 Plan 06: Split ApiService.ts Monolith Summary

**Split 3,208-line monolithic ApiService.ts into 8 domain-specific service modules with shared base client, reducing ApiService.ts to 15-line barrel re-export**

## Performance

- **Duration:** 12 min
- **Started:** 2026-05-15T22:45:00Z
- **Completed:** 2026-05-15T22:57:00Z
- **Tasks:** 3
- **Files modified:** 14 (9 created, 5 modified)

## Accomplishments

- Created shared baseClient.ts with fetch-based HTTP client, auth interceptor, retry logic, and error classes
- Created 8 domain-specific service modules (camera, event, visitor, settings, auth, detection, review, system)
- Updated all 4 consumer files (AuthContext, CameraContext, EventsPage, DayHighlights) to use new domain services
- Reduced ApiService.ts from 3,208 lines to 15-line barrel re-export for backward compatibility
- Frontend builds successfully with tree-shaking enabled

## Task Commits

Each task was committed atomically:

1. **Task 1: Create shared base client** - `c04419e` (feat)
2. **Task 2: Create domain-specific service modules** - `7311caf` (feat)
3. **Task 3: Update consumers and reduce ApiService.ts** - `1197cc2` (feat)

**Plan metadata:** committed with Task 3

## Files Created/Modified

- `frontend/src/services/api/baseClient.ts` - Shared HTTP client with fetchWithRetry, auth interceptor, error classes
- `frontend/src/services/api/cameraService.ts` - Camera CRUD, streams, zones, filters, motion settings (20 methods)
- `frontend/src/services/api/eventService.ts` - Events, archival, enhanced listing, detection history, batch processing (20 methods)
- `frontend/src/services/api/visitorService.ts` - Visitor CRUD, timeline, schedules, reports (11 methods)
- `frontend/src/services/api/settingsService.ts` - System settings, detection config, logs, alerts (9 methods)
- `frontend/src/services/api/authService.ts` - Login, register, logout, profile, MFA, token refresh (8 methods)
- `frontend/src/services/api/detectionService.ts` - Person/face detection, known persons, face recognition, redo/batch (18 methods)
- `frontend/src/services/api/reviewService.ts` - Review segments CRUD, timeline (5 methods)
- `frontend/src/services/api/systemService.ts` - Health, stats, analytics, OpenCV status, highlights (12 methods)
- `frontend/src/services/ApiService.ts` - Reduced from 3,208 to 15 lines (barrel re-export)
- `frontend/src/contexts/AuthContext.tsx` - Updated to import authService and setAuthToken
- `frontend/src/contexts/CameraContext.tsx` - Updated to import cameraService
- `frontend/src/pages/EventsPage.tsx` - Updated to import eventService and detectionService
- `frontend/src/pages/DayHighlights.tsx` - Updated to import systemService

## Decisions Made

- **Fetch over axios:** Plan mentioned axios but codebase uses native fetch. Avoided adding new dependency — used fetch-based base client instead (Rule 2: avoid unnecessary architectural change)
- **Barrel re-export:** Instead of deleting ApiService.ts entirely, kept it as a barrel re-export for backward compatibility with any future imports
- **Method grouping:** Some methods didn't fit the 8 planned domains perfectly — batch processing went to eventService, alerts/logs to settingsService, face recognition to detectionService

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Fixed analyzeEvent return type mismatch**
- **Found during:** Task 3 (consumer update)
- **Issue:** detectionService.analyzeEvent had wrong return type compared to original ApiService — EventsPage expected `analysis.overall_summary` and `analysis.persons`/`analysis.vehicles` arrays
- **Fix:** Updated detectionService.analyzeEvent to match original API response shape (`/nvidia/analyze-event` endpoint), fixed EventsPage to use correct property names with type casting
- **Files modified:** frontend/src/services/api/detectionService.ts, frontend/src/pages/EventsPage.tsx
- **Verification:** TypeScript typecheck passes, build succeeds
- **Committed in:** `1197cc2` (part of Task 3 commit)

---

**Total deviations:** 1 auto-fixed (1 missing critical)
**Impact on plan:** Fix necessary for type correctness. No scope creep.

## Issues Encountered

- TypeScript type mismatch in EventsPage when adapting analyzeEvent response — resolved by matching original API shape and adding type casts for state compatibility

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- API service layer fully modularized and tree-shakeable
- Adding new API methods now requires editing only the relevant domain service file
- Backward compatibility maintained via ApiService.ts barrel re-export
- Ready for next tech debt plan

---
*Phase: 11-tech-debt-reduction*
*Completed: 2026-05-15*
