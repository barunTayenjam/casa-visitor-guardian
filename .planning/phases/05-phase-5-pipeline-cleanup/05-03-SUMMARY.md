---
plan: 05-03
status: completed
phase: 05
wave: 2
executed: "2026-05-29T15:30:00+05:30"
---

# Plan 05-03 SUMMARY — Strip rtspManager FFmpeg + Accept ADR-003

## Objective

Strip dual-pipeline orchestration from rtspManager.ts, remove legacy FFmpeg subprocess management, and formally accept ADR-003.

## Changes Made

### rtspManager.ts (953 → 348 lines)

**Removed:**
- `ffmpeg-static` import and ffmpeg path detection
- `spawn`/`ChildProcessWithoutNullStreams` import
- `CameraStream` interface (entirely — replaced with simple `lastFrame: Buffer` on Camera)
- `Camera.mainProcess`, `.activeRoles`, `.streams`, `.retryCount` fields
- FFmpeg subprocess spawning (if/else block for `pythonEnabled`, MJPEG parsing, buffer accumulation)
- `processFrameForMotion` stub
- `getProcess` method (returns null)
- `getStream` method (returns width/height from config — no internal stream state)
- `restartStream` simplified (just subscribe via PythonWsClient)
- `startStream`/`stopStream` simplified (subscribe/unsubscribe via PythonWsClient)
- `CameraConfig` type changes: removed `detect` field reference (wasn't needed)

**Added:**
- `wirePythonWsFrames()` — listens for `'frame'` events from `PythonWsClient` and relays to Socket.io rooms
- PythonWsClient subscribe/unsubscribe on stream start/stop and viewer connect/disconnect
- No more `CameraConfig` `detect` field access — all detection config flows through consolidatedDetectionService

**Kept:**
- Socket.io frame relay infrastructure
- Viewer tracking (activeViewers, adaptive FPS)
- Snapshot capability (takeSnapshot, getLastFrame — using cached `camera.lastFrame`)
- Health monitor integration
- Test stream (startTestStream — generates fake JPEG frames via testImageGenerator)
- simulateMotionDetection (kept for manual testing)

### Consumer Fixes

| File | Change |
|------|--------|
| `CameraController.ts` | Removed `camera.retryCount`, `.mainProcess`, `.lastError`, `.streams.get('detect/record')` references. Simplified status to online/offline. Removed `camera.config.detect` field access. |
| `StreamController.ts` | All `camera.streams.get()`→`camera.lastFrame`. MJPEG endpoints simplified (no FFmpeg subprocess piping, just poll `camera.lastFrame` at 250ms). |
| `streamHealthMonitor.ts` | No changes needed — already generic (just checks timestamps + calls restartStream) |

### ADR-003
- Status changed from **Proposed** to **Accepted** with note about Phase 5 completion

## Verification
- [x] TypeScript compiles cleanly: `npx tsc --noEmit`
- [x] ADR-003 status updated

## Commits
Squashed into this plan commit.
