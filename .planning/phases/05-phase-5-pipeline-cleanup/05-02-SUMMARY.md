---
plan: 05-02
status: completed
phase: 05
wave: 1
executed: "2026-05-29T15:15:00+05:30"
---

# Plan 05-02 SUMMARY — Remove Legacy Detection Modules

## Objective

Remove legacy Node.js detection modules that are redundant after the Python pipeline took over.

## Changes Made

### Files Deleted
| File | Lines | Reason |
|------|-------|--------|
| `server/src/detection/optimizedMotionDetection.ts` | 1103 | Node.js MOG2 background subtraction — Python MOG2 handles this |
| `server/src/detection/optimizedMotionDetection.test.ts` | — | Test for deleted module |
| `server/src/detection/motionTriggeredDetection.ts` | 659 | Triggered YOLO+face on motion events — pipeline now inline |
| `server/src/detection/objectDetection.ts` | 86 | HTTP wrapper client — redundant with WebSocket pipeline |

### Files Refactored

| File | Change |
|------|--------|
| `consolidatedDetectionService.ts` | Removed HTTP detection methods (detectObjects, detectFaces), Redis cache, circuit breaker, retry service. Kept settings management, types, cleanup. Methods now return empty stubs. |
| `index.ts` | Removed `setupOptimizedMotionDetection` import and call. Simplified detection service init. |
| `rtspManager.ts` | Removed unused `OptimizedMotionDetector` import |
| `serviceRegistry.ts` | Removed `OptimizedMotionDetector` type + motionDetector getter/setter |
| `cleanupService.ts` | Removed `cleanupOptimizedMotionDetection` call |
| `DetectionController.ts` | Removed `getMotionSettings`/`updateMotionSettings` methods |
| `CameraController.ts` | Removed `getMotionSettings`/`updateMotionSettings` methods |
| `routes/cameras.ts` | Removed motion settings route bindings |
| `routes/detection-operations.ts` | Removed motion settings routes (get/put) |
| `routes/motion.ts` | Removed motion settings routes (get/put per-camera) |
| `routes/detectionRedoRoutes.ts` | Inlined `validateDetections` function (was in deleted `motionTriggeredDetection.ts`) |
| `enhancedDetectionService.ts` | Updated import: `objectDetection.js` → `consolidatedDetectionService.js` |

### Verification
- [x] TypeScript compiles cleanly: `npx tsc --noEmit`
- [x] No remaining imports to deleted modules
- [x] Detection endpoints unchanged (return empty results via stubs — realtime pipeline delivers results)

## Commits
Squashed into this plan commit.
