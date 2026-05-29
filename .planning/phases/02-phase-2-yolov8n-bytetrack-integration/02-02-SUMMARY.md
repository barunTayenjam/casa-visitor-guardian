---
phase: 02-streaming-performance-overhaul
plan: 02
subsystem: streaming
tags: [socket.io, binary, blob-url, websocket, bandwidth]
requires:
  - phase: 01-rtsp-ownership-transfer
    provides: Python WS publisher relay through Node.js Socket.io server
provides:
  - Binary frame delivery over Socket.io eliminating base64 33% overhead
  - Frontend Blob URL rendering with memory-safe lifecycle (revokeObjectURL on replace + unmount)
  - Backward-compatible base64 fallback for long-polling transport
affects: [02-03]
tech-stack:
  added: []
  patterns: ["Socket.io binary frame emission using native Buffer serialization", "Blob URL lifecycle management with cleanup on frame replace and component unmount"]
key-files:
  created: []
  modified:
    - server/src/streams/rtspManager.ts
    - server/src/index.ts
    - frontend/src/components/dashboard/CameraStream.tsx
key-decisions:
  - "Socket.io v4 handles Buffer serialization natively — no special configuration needed beyond removing .toString('base64')"
  - "Blob URL + URL.createObjectURL() for binary frames; URL.revokeObjectURL() before each new frame AND on unmount to prevent memory leaks"
  - "data:image/jpeg;base64, fallback path preserved for long-polling transport where data arrives as string"
  - "Bandwidth calculation splits on type: ArrayBuffer.byteLength for binary, string.length * 0.75 for base64 fallback"
requirements-completed: [PERF-04, PERF-05, PERF-06]
duration: inline
completed: 2026-05-29
---

# Plan 02-02: Binary Frame Delivery Summary

**Socket.io v4 binary frame delivery eliminating 33% base64 overhead with Blob URL rendering and memory-safe cleanup**

## Performance

- **Duration:** inline (executed during interactive development session)
- **Completed:** 2026-05-29
- **Tasks:** 2

## Accomplishments

- Removed `.toString("base64")` from both rtspManager.ts frame emissions (main stream + test stream)
- Removed `data.toString('base64')` from index.ts Python WS relay — passes raw Buffer directly
- Frontend CameraStream accepts `ArrayBuffer | string` union type in handleFrame
- Binary frames rendered via `new Blob([data.data], {type: 'image/jpeg'})` + `URL.createObjectURL()`
- `URL.revokeObjectURL()` called before each new frame and on component unmount
- Base64 fallback path: `'data:image/jpeg;base64,' + data.data` for long-polling clients
- Bandwidth calculation split: `byteLength` for ArrayBuffer, `length * 0.75` for string

## Decisions Made

- Socket.io v4 (already at ^4.7.2) natively serializes Buffer objects as binary frames — no configuration changes needed
- Blob URL lifecycle: revoked eagerly on every frame replace (not deferred) to keep memory pressure low
- Base64 fallback intentionally preserved per ADR-002 — long-polling transport does not support binary

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None

## Next Phase Readiness

Binary frame delivery is transparent to higher-level components. Socket.io event schema unchanged (same `{ cameraId, data, timestamp }` shape). No frontend changes needed beyond CameraStream.
