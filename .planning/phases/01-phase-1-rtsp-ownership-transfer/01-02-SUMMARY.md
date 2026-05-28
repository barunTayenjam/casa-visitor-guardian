---
phase: 01-rtsp-ownership-transfer
plan: 02
subsystem: backend
tags: websocket, config, jest, nodejs, python-ipc

requires: []
provides:
  - PipelineConfig interface with mode (legacy/dual/python-only) and pythonWsUrl
  - PythonWsClient class for WebSocket IPC with Python service
  - ServiceRegistry registration for lifecycle management
  - 7 passing Jest unit tests
affects: phase 01 plan 03 (WS client integration), plan 04 (WS publishing)

tech-stack:
  added: []
  patterns:
    - EventEmitter-based WebSocket client with exponential backoff
    - Service registry getter/setter for IPC services
    - Jest WebSocket testing with ephemeral mock server (port 0)

key-files:
  created:
    - server/src/services/pythonWsClient.ts (95 lines)
    - server/src/services/pythonWsClient.test.ts (133 lines, 7 tests)
  modified:
    - server/src/config/index.ts (+11 lines)
    - server/src/services/serviceRegistry.ts (+12 lines)

key-decisions:
  - "PipelineConfig uses env vars (PIPELINE_MODE, PYTHON_WS_URL) with sensible defaults (legacy, ws://opencv:9090)"
  - "PythonWsClient receives URL from caller, not from config directly — keeps class testable without config mocking"
  - "Frame events include timestamp field for observability, cameraId initially null until subscription wiring in Plan 04"
  - "Reconnect delay doubled after emission of 'disconnected' event so tests can observe the updated value"

patterns-established:
  - "New IPC services follow PythonWsClient pattern: EventEmitter base, caller-provided URL, disconnect-while-reconnecting guard"
  - "ServiceRegistry extends with typed getters/setters following existing pattern"

requirements-completed: [RTSP-05, RTSP-06, RTSP-07, RTSP-08]

duration: 7 min
completed: 2026-05-28
---

# Phase 01 Plan 02: Node.js WebSocket Client Foundation Summary

**Pipeline config with mode/URL, PythonWsClient class with reconnection and subscription, ServiceRegistry registration, and 7 Jest tests**

## Performance

- **Duration:** 7 min
- **Started:** 2026-05-28T09:58:34Z
- **Completed:** 2026-05-28T10:04:44Z
- **Tasks:** 3
- **Files modified:** 4

## Accomplishments

- PipelineConfig interface added to config system with mode (`legacy` | `dual` | `python-only`) and `pythonWsUrl` from env vars (defaults: `legacy`, `ws://opencv:9090`)
- `CameraConfig` extended with optional `pythonEnabled` per-camera override field
- PythonWsClient class: EventEmitter-based WebSocket client with connect/disconnect/reconnect (exponential backoff 1s → 30s max), send/subscribe/unsubscribe, and frame event emission with cameraId + data + timestamp
- ServiceRegistry extended with `setPythonWsClient`/`getPythonWsClient` typed getter/setter
- 7 Jest tests covering connect, binary frame emission, disconnect, exponential backoff reconnection, subscribe JSON message, unsubscribe JSON message, and clean teardown without pending timers

## Task Commits

Each task was committed atomically:

1. **Task 1: Add PipelineConfig to server config system** - `2fc822c` (feat)
2. **Task 2: Create PythonWsClient class** - `6bfa5b8` (feat)
3. **Task 3: Register PythonWsClient in ServiceRegistry and write Jest tests** - `05aad7e` (feat)

## Files Created/Modified

- `server/src/config/index.ts` - Added PipelineConfig interface (mode + pythonWsUrl), wired to PIPELINE_MODE and PYTHON_WS_URL env vars with defaults, added pythonEnabled to CameraConfig
- `server/src/services/pythonWsClient.ts` - New PythonWsClient class: EventEmitter-based, exponential backoff reconnect, subscribe/unsubscribe JSON protocol, disconnect-while-reconnecting guard, clean teardown
- `server/src/services/pythonWsClient.test.ts` - 7 Jest tests using ephemeral WebSocketServer on random port (port 0)
- `server/src/services/serviceRegistry.ts` - Added setPythonWsClient/getPythonWsClient following existing typed getter/setter pattern

## Decisions Made

- **PIPELINE_MODE and PYTHON_WS_URL as env vars** — follows existing pattern (OPENCV_SERVICE_URL, etc.). Defaults to `legacy` mode (no behavioral change) and `ws://opencv:9090` for Docker compose compatibility.
- **PythonWsClient receives URL from caller** — keeps the class unit-testable without requiring config mocking. Caller (index.ts) reads the URL from config and injects it.
- **Frame event shape** — `{ cameraId: string | null, data: Buffer, timestamp: number }`. CameraId defaults to `null` until subscription wiring is finalized in Plan 01-04.
- **Reconnect delay doubled before 'disconnected' emission** — ensures listeners can observe the updated delay value (required by reconnection test).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Reconnect delay doubled after disconnected emission**
- **Found during:** Task 3 (Jest test for exponential backoff)
- **Issue:** `reconnectDelay` was doubled after emitting `'disconnected'`, so the event handler couldn't observe the updated value — test expected 2000 but received 1000
- **Fix:** Swapped order — double delay first, then emit `'disconnected'`
- **Files modified:** `server/src/services/pythonWsClient.ts`
- **Verification:** Reconnection test passes (delay correctly observed as 2000 in disconnect handler)
- **Committed in:** `05aad7e` (Task 3 commit)

**2. [Rule 1 - Bug] WebSocketServer import and async initialization in tests**
- **Found during:** Task 3 (Jest tests wouldn't compile or run)
- **Issue:** `WebSocket.Server` is not a constructor in ws v8 (requires named import `WebSocketServer`); also `address()` returns `null` for `port: 0` if called before server is listening (async binding)
- **Fix:** Changed import to `{ WebSocketServer } from 'ws'`, added async `createMockServer()` helper that resolves after `'listening'` event
- **Files modified:** `server/src/services/pythonWsClient.test.ts`
- **Verification:** All 7 tests pass
- **Committed in:** `05aad7e` (Task 3 commit)

---

**Total deviations:** 2 auto-fixed (2 bug fixes)
**Impact on plan:** Both fixes were necessary for correctness — the reconnect delay ordering was a behavioral bug, and the test structure needed proper async WebSocket setup. No scope creep.

## Issues Encountered

- WebSocket Server in ws v8 uses `WebSocketServer` named export instead of `WebSocket.Server` — test import had to be updated
- `WebSocketServer({ port: 0 }).address()` returns `null` before the `'listening'` event fires — required async test setup with `createMockServer()` promise helper
- Jest 30 uses `--testPathPatterns` (plural) instead of `--testPathPattern` (singular)
- 5 seconds of warnings from pre-existing plaintext RTSP credential detection and deprecation notices — not related to this plan

## User Setup Required

None — no external service configuration required. Add `PIPELINE_MODE` and `PYTHON_WS_URL` to `.env` when Python WebSocket service is running.

## Next Phase Readiness

- Node.js side of WebSocket IPC channel is ready (config + client + tests)
- PythonWsClient compiled and passing tests — ready for integration in Plan 03 (WS client initialization in index.ts)
- Planned for wave 1 parallel execution alongside Plan 01-01 (Python core)

---

## Self-Check: PASSED

- ✅ `server/src/services/pythonWsClient.ts` — exists (95 lines)
- ✅ `server/src/services/pythonWsClient.test.ts` — exists (133 lines, 7 tests)
- ✅ `2fc822c` — Task 1 commit verified
- ✅ `6bfa5b8` — Task 2 commit verified
- ✅ `05aad7e` — Task 3 commit verified

---

*Phase: 01-rtsp-ownership-transfer*
*Completed: 2026-05-28*
