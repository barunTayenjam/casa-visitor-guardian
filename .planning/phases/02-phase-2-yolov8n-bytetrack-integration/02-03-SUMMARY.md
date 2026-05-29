---
phase: 02-streaming-performance-overhaul
plan: 03
subsystem: ui
tags: [intersectionobserver, viewport, streaming, react-hooks]
requires:
  - phase: 01-rtsp-ownership-transfer
    provides: Grid view with CameraStream components
  - phase: 02-02
    provides: Binary frame delivery with Blob URL rendering
provides:
  - Viewport-based camera loading using IntersectionObserver
  - Stream concurrency control (max 4 concurrent) with slot-based queuing
  - Focused camera bypasses viewport observer (autoStart always true)
affects: []
tech-stack:
  added: []
  patterns: ["IntersectionObserver with 300ms debounce and 100px rootMargin for viewport detection", "StreamSlotManager: async semaphore with pending queue for max-concurrent-stream enforcement"]
key-files:
  created:
    - frontend/src/hooks/useViewportStream.ts
  modified:
    - frontend/src/components/live/AdaptiveCameraGrid.tsx
key-decisions:
  - "StreamSlotManager uses async acquire/promise pattern so cards queue naturally when all slots are occupied"
  - "Slot acquisition is gated on isVisible — offscreen cameras release their slot immediately"
  - "Focused camera intentionally NOT observed — it lives outside the grid scroll container and must always stream"
  - "ViewportCameraCard child component avoids hook-in-loop anti-pattern by wrapping per-camera state in a component"
  - "100px rootMargin preloads streams before cards enter viewport, reducing perceived latency"
requirements-completed: [PERF-07, PERF-08, PERF-09]
duration: inline
completed: 2026-05-29
---

# Plan 02-03: Viewport-Based Camera Loading Summary

**IntersectionObserver-driven viewport-aware camera loading with StreamSlotManager concurrency control (max 4 concurrent, focused camera always streaming)**

## Performance

- **Duration:** inline (executed during interactive development session)
- **Completed:** 2026-05-29
- **Tasks:** 2

## Accomplishments

- New `useViewportStream.ts` hook: IntersectionObserver with 300ms debounce and configurable rootMargin/threshold
- `StreamSlotManager` class: async semaphore limiting concurrent streams to configurable max (default 4)
- `ViewportCameraCard` component combining viewport detection + slot acquisition per camera card
- Grid cameras only stream when both visible in viewport AND a slot is acquired
- Focused camera remains unconditional (`autoStart={true}`) — always streams regardless of viewport
- Slot release on visibility loss, releaseAll on unmount
- Frontend lint: 0 errors

## Decisions Made

- Slot acquired/released reactively based on `isVisible` — offscreen cameras release slots immediately so queued cameras can start
- Slot acquisition async: cameras wait in pending queue until a slot opens (another camera scrolls offscreen)
- 3 parameters exposed on `useViewportStream` config: debounceMs (default 300), rootMargin (default '100px'), threshold (default 0.1)

## Deviations from Plan

### Auto-fixed Issues

**1. [Slot gating on visibility] Fixed eager mount-time slot acquisition**
- **Issue:** Original implementation acquired slot eagerly on component mount regardless of viewport visibility — offscreen cameras held slots indefinitely
- **Fix:** Added `isVisible` to useEffect dependency array; slot acquired when `isVisible` becomes true, released when false
- **Files modified:** frontend/src/components/live/AdaptiveCameraGrid.tsx (ViewportCameraCard useEffect)
- **Verification:** Frontend lint 0 errors

## Issues Encountered

- None

## Next Phase Readiness

Viewport loading is transparent to downstream consumers. Grid renders identically — same layout, same focused camera UX — but now with bandwidth savings for multi-camera deployments.
