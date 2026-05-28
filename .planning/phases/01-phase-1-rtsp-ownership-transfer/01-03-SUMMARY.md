---
phase: 01-rtsp-ownership-transfer
plan: 03
subsystem: python-pipeline
tags: [python, ffmpeg, opencv, mog2, frame-pipeline]
requires:
  - phase: 01-rtsp-ownership-transfer
    provides: Bounded queues, config constants, metrics collector, test fixtures
provides:
  - FFmpegReader class with rawvideo pipe, frame parsing, reconnection
  - FramePipeline with per-camera MOG2 motion gate and JPEG encoding
  - MotionGate wrapper around OpenCV MOG2 bg subtractor
affects: [01-04, 01-05]
tech-stack:
  added: [ffmpeg (system dep), websockets]
  patterns: [subprocess FFmpeg pipe, daemon thread per camera, MOG2 per-camera bg subtractor]
key-files:
  created:
    - opencv-service/rtsp_ingestion/ffmpeg_reader.py
    - opencv-service/rtsp_ingestion/frame_pipeline.py
    - opencv-service/tests/test_ffmpeg_reader.py
    - opencv-service/tests/test_motion_gate.py
  modified:
    - opencv-service/Dockerfile
    - opencv-service/requirements.txt
    - opencv-service/tests/conftest.py
key-decisions:
  - "FFmpegReader as callback-based reader (not iterator) for cleaner thread integration with FramePipeline"
  - "MotionGate as separate class from FramePipeline for testability"
  - "MOG2 params replicated from existing app.py (history=200, varThreshold=16)"
  - "JPEG quality=60 matching existing app.py default for consistency"
  - "FFmpeg args replicated from server rtspManager.ts to ensure identical RTSP behavior"
patterns-established:
  - "Per-camera MOG2 instance in FramePipeline (not shared — MOG2 is not thread-safe)"
  - "Frame callback architecture: FFmpegReader thread calls _on_frame which runs MOG2 and encoding"
  - "Frame skip for detection rate decoupling (every N frames to motion queue)"
requirements-completed: [RTSP-01, RTSP-02, RTSP-07]
---

# Phase 01 — Plan 03: Python FFmpeg Ingestion + MOG2 Frame Pipeline Summary

**FFmpeg subprocess with rawvideo pipe feeding per-camera MOG2 motion gate, JPEG encoding, and bounded queues**

## Performance

- **Duration:** 30 min
- **Started:** 2026-05-28T15:40:00+05:30
- **Completed:** 2026-05-28T16:10:00+05:30
- **Tasks:** 2
- **Files created:** 4
- **Files modified:** 3

## Accomplishments
- FFmpegReader with raw BGR24 pipe, frame parsing, reconnection with exponential backoff
- MotionGate wrapping OpenCV MOG2 with warmup period (10 frames)
- FramePipeline tying reader → motion gate → JPEG encode → queues
- 13 passing tests (8 reader + 4 motion gate + 1 pipeline callback)

## Task Commits
1. **Task 1: FFmpegReader + tests** - `96dae8c` (part of overall feat commit)
2. **Task 2: FramePipeline + MotionGate + tests** - `96dae8c` (part of overall feat commit)

## Files Created/Modified
- `opencv-service/rtsp_ingestion/ffmpeg_reader.py` - FFmpeg subprocess with raw BGR24 pipe
- `opencv-service/rtsp_ingestion/frame_pipeline.py` - Frame pipeline with MOG2, JPEG, queues
- `opencv-service/tests/test_ffmpeg_reader.py` - 8 tests for reader
- `opencv-service/tests/test_motion_gate.py` - 4 tests for motion gate
- `opencv-service/Dockerfile` - Added ffmpeg system dependency
- `opencv-service/requirements.txt` - Added websockets
- `opencv-service/tests/conftest.py` - Added pytest_asyncio plugin

## Decisions Made
- Callback-based reader architecture rather than iterator for cleaner threading
- MotionGate as standalone class, not embedded in FramePipeline, for test isolation
- FFmpeg args replicated from rtspManager.ts to ensure identical RTSP behavior

## Deviations from Plan
None — plan executed as specified.

## Issues Encountered
None

## Next Phase Readiness
- FramePipeline ready for WebSocket publisher wiring in Plan 01-04
- Motion gate pipeline ready for YOLO detection integration in Phase 2

---
*Phase: 01-rtsp-ownership-transfer*
*Completed: 2026-05-28*
