---
phase: 10-critical-bug-fixes
plan: 02
subsystem: api
tags: [camera, persistence, credential-encryption, atomic-write, rtsp]

requires:
  - phase: 10-critical-bug-fixes
    provides: credentialEncryption.ts with encryptCredential/isEncryptedCredential
provides:
  - persistCameras() method on StreamManager with atomic write and credential re-encryption
  - Camera create endpoint with proper ID generation and correct response shape
  - All camera mutation operations persist to cameras.json
affects: [camera-management, streaming, settings]

tech-stack:
  added: []
  patterns: [atomic-file-write, credential-re-encryption-on-persist, fire-and-forget-persistence]

key-files:
  created: []
  modified:
    - server/src/streams/rtspManager.ts
    - server/src/controllers/CameraController.ts

key-decisions:
  - "Re-encrypt all stream paths unconditionally via encryptCredential() since in-memory paths are always decrypted after config loading"
  - "Fire-and-forget persistence pattern — mutations succeed in memory first, persistence is async with error logging"
  - "cam${Date.now()} ID format for camera creation — simple, collision-resistant for home security use case"

patterns-established:
  - "Atomic file write: write to .tmp then fsp.rename() for POSIX atomic replacement"
  - "Credential re-encryption: always encrypt stream paths before persisting since config loading decrypts them"

requirements-completed: [FIX-002, FIX-003]

duration: 4min
completed: 2026-05-31
---

# Phase 10 Plan 02: Camera Config Persistence & Create Fix Summary

**Atomic camera config persistence with credential re-encryption and fixed create endpoint**

## Performance

- **Duration:** 4 min
- **Started:** 2026-05-31T03:55:18Z
- **Completed:** 2026-05-31T03:59:48Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Added `persistCameras()` async method to `StreamManager` with atomic write (temp file + rename) and credential re-encryption
- Fixed camera create to generate `cam${Date.now()}` ID instead of empty string
- Fixed camera create response to return `{ camera: { id, name } }` matching frontend expectation
- Added `persistCameras()` calls to all 14 mutation points (4 in rtspManager, 10 in CameraController)

## Task Commits

Each task was committed atomically:

1. **Task 1: Add persistCameras() to StreamManager with credential re-encryption** - `85fb4fd` (feat)
2. **Task 2: Fix camera create + add persistence calls to all CameraController mutations** - `f33d576` (feat)

## Files Created/Modified
- `server/src/streams/rtspManager.ts` - Added persistCameras() method with atomic write and credential re-encryption; CAMERAS_CONFIG_PATH constant; fire-and-forget persist calls in addCamera, updateCamera, removeCamera, toggleNightMode
- `server/src/controllers/CameraController.ts` - Fixed create() ID generation and response shape; added persistCameras() calls to all 10 mutation methods

## Decisions Made
- Re-encrypt all stream paths unconditionally — the config loading pipeline decrypts all paths at startup, so in-memory `stream.path` is always plaintext. Writing back without encryption would leak RTSP credentials to disk.
- Fire-and-forget persistence pattern — the mutation succeeds in memory immediately, persistence is async. This avoids blocking HTTP responses on disk I/O while ensuring durability.
- `cam${Date.now()}` ID format — simple, collision-resistant for a single-user home security system. Matches existing `cam1`, `cam2` pattern.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Camera config persistence and create are now functional
- All camera mutations (create, update, remove, zone CRUD, filter CRUD, track list, night mode) persist to cameras.json
- RTSP credentials remain encrypted at rest in cameras.json
- Ready for next plan in phase 10

## Self-Check: PASSED

- All modified files verified on disk
- Both task commits verified in git log
- TypeScript compilation clean (`npx tsc --noEmit` — zero errors)
- persistCameras count: 5 in rtspManager.ts, 10 in CameraController.ts
- encryptCredential count: 2 in rtspManager.ts
- No `id: ''` remaining in CameraController.ts
- `camera: { id:` response shape present in CameraController.ts

---
*Phase: 10-critical-bug-fixes*
*Completed: 2026-05-31*
