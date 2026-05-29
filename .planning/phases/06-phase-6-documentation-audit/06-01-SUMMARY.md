---
phase: 06-phase-6-documentation-audit
plan: 01
subsystem: testing
tags: e2e, frame-relay, python-ws, socket-io, rtsp, integration-test

requires:
  - phase: 05-pipeline-cleanup
    provides: rtspManager.wirePythonWsFrames() as sole frame relay path
provides:
  - Single-emit frame relay path (removed redundant index.ts handler)
  - E2E integration test for Python WS -> Node.js -> Socket.io frame relay
affects: []

tech-stack:
  added: []
  patterns:
    - "E2E mock integration test pattern using WebSocketServer + PythonWsClient + Socket.io mock chain"

key-files:
  created: []
  modified:
    - server/src/index.ts (removed redundant pythonWsClient.on('frame') handler)
    - server/src/streams/rtspManager.test.ts (added Frame Relay E2E test suite)
    - server/jest.config.js (fixed ts-jest ESM __dirname compatibility)

key-decisions:
  - "Removed redundant frame handler from index.ts (lines 352-360) — rtspManager.wirePythonWsFrames() is now the sole frame relay path"
  - "E2E tests use mock WebSocketServer + real PythonWsClient + mock Socket.io chain for realistic relay verification"
  - "Replaced import.meta.url with process.cwd()-based path due to ts-jest ESM module wrapper incompatibility"

requirements-completed:
  - DOC-01
  - DOC-08

duration: 12 min
completed: 2026-05-29
---

# Phase 6 Plan 01: Fix Double Frame Emission + Add E2E Frame Relay Integration Test

**Fixed double frame emission bug (DOC-01) and added comprehensive E2E integration test for the Python WS → Node.js → Socket.io frame relay path (DOC-08)**

## Performance

- **Duration:** 12 min
- **Started:** 2026-05-29T10:06:02Z
- **Completed:** 2026-05-29T10:18:11Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- **DOC-01 fixed**: Removed redundant `pythonWsClient.on('frame')` handler from index.ts (lines 352-360). This handler was left behind when Phase 5 plan 05-03 moved frame relay into `rtspManager.wirePythonWsFrames()` — causing every frame to be emitted twice to each connected frontend. The removed handler also omitted the `role` field, creating a silent contract mismatch.
- **DOC-08 delivered**: Added `Frame Relay E2E (DOC-08)` integration test suite with 3 tests verifying:
  1. Frame emitted to Socket.io rooms exactly once per camera (live + detect)
  2. No emission for unknown camera IDs
  3. Detect room receives frames regardless of viewer count
- **Fixed pre-existing test infrastructure issue**: Replaced `import.meta.url` with `process.cwd()`-based path resolution to resolve ts-jest ESM module wrapper conflict that prevented all rtspManager tests from running.

## Task Commits

Each task was committed atomically:

1. **Task 1: Remove redundant frame handler from index.ts** - `b9127ec` (fix)
2. **Task 2: Add E2E integration test for frame relay path** - `6bde214` (test)
3. **Cleanup: Add PythonWsClient teardown in afterEach** - `3614602` (refactor)

**Plan metadata:** _(committed after this summary)_

_Note: TDD tasks may have multiple commits (test → feat → refactor)_

## Files Created/Modified

- `server/src/index.ts` - Removed 10-line redundant `pythonWsClient.on('frame')` handler. The `serviceRegistry.setPythonWsClient()` call and `trackingEvent` handler remain unchanged.
- `server/src/streams/rtspManager.test.ts` - Added 200+ lines: new imports (`WebSocketServer`, `AddressInfo`, `PythonWsClient`, `serviceRegistry`), `createMockWsServer()` helper, and `Frame Relay E2E (DOC-08)` describe block with 3 integration tests. Replaced `import.meta.url` with `process.cwd()`-based path for ts-jest compatibility.
- `server/jest.config.js` - No functional changes (reverted to original after investigation).

## Decisions Made

- **Removed the redundant frame handler** — The index.ts handler was a copy of the same logic now owned by `rtspManager.wirePythonWsFrames()`. The rtspManager handler is the correct one because it checks camera existence, includes `role: 'live'`, records health metrics, and applies adaptive FPS throttling.
- **E2E test uses real WebSocket connections** — Tests create an actual `WebSocketServer` (on random port) and connect a real `PythonWsClient`, providing realistic end-to-end verification of the frame relay path.
- **`process.cwd()` path resolution** — The test now uses `path.resolve(process.cwd(), 'src', 'streams')` instead of `import.meta.url` because ts-jest's ESM module wrapper is incompatible with `import.meta.url` at module scope. This affects test infrastructure only (pre-existing issue).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed pre-existing ts-jest/ESM incompatibility**
- **Found during:** Task 2 (E2E integration test)
- **Issue:** The existing test file used `import.meta.url` at module scope, which is incompatible with ts-jest's ESM module wrapper when running without `--experimental-vm-modules`. This blocked the existing 22 tests alongside our 3 new tests.
- **Fix:** Replaced `import.meta.url` with `process.cwd()`-based path resolution using `path.resolve(process.cwd(), 'src', 'streams')`. Also renamed `__filename`/`__dirname` to `testFilename`/`testDirname` to avoid conflict with ts-jest's injected module scope variables.
- **Files modified:** `server/src/streams/rtspManager.test.ts`
- **Verification:** All 25 tests pass (both static analysis and dynamic E2E tests)
- **Committed in:** `6bde214` (part of Task 2 commit)

**2. [Rule 2 - Missing Critical] Added PythonWsClient cleanup in test afterEach**
- **Found during:** Task 2 (after first test run showed "Jest did not exit" warning)
- **Issue:** PythonWsClient WebSocket connections and reconnect timers were left open after tests completed, preventing clean Jest exit.
- **Fix:** Added `currentClient` tracking variable and `client.disconnect()` call in `afterEach` for all 3 E2E tests.
- **Files modified:** `server/src/streams/rtspManager.test.ts`
- **Verification:** Test suite exits cleanly without open handle warnings
- **Committed in:** `3614602`

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 missing critical)
**Impact on plan:** Both fixes were necessary for tests to run and exit cleanly. No scope creep.

## Issues Encountered

- **Pre-existing ts-jest ESM incompatibility:** The `rtspManager.test.ts` file used `import.meta.url` which caused `TS1343` and `SyntaxError: Cannot use 'import.meta' outside a module` errors. Root cause: ts-jest 29.4.6 with TypeScript 5.9.3 on Node.js v26 has a compatibility gap where `import.meta.url` at module scope is not properly handled by ts-jest's ESM module wrapper. Fixed by using `process.cwd()`-based path resolution.
- **First test run timed out:** Initial run without `--experimental-vm-modules` flag failed (Node.js v26 requires this for ESM VM module support). Proper fix: use `npm run test:server` which includes the flag.

## User Setup Required

None - no external service configuration required. Tests use in-process `WebSocketServer` on random ports.

## Next Phase Readiness

- Frame relay double-emit bug fixed and regression-tested
- Ready for next plan in Phase 6 (Documentation Audit & Fix)
- Next: plans 02, 03, 04 (E2E timeline push test, Nyquist validation, frontend documentation fix)

---

*Phase: 06-phase-6-documentation-audit*
*Completed: 2026-05-29*
