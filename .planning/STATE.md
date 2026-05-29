---
gsd_state_version: 1.0
milestone: v1.3
milestone_name: Pipeline Cleanup
status: completed
last_updated: "2026-05-29T10:19:08.602Z"
progress:
  total_phases: 2
  completed_phases: 1
  total_plans: 6
  completed_plans: 4
  percent: 50
---

# State: SentryVision Home Security System

## Project Reference

See: .planning/PROJECT.md (updated 2026-05-18)

**Core value:** Provide reliable, automated home surveillance that detects motion and visitors, sends real-time alerts, and stores events for later review

**Current focus:** Phase 05 — Pipeline Cleanup & Default Switch (✅ Complete)

---

## Project Status

| Aspect | Status | Notes |
|--------|--------|-------|
| Project | ✓ Initialized | 2026-03-18 |
| Config | ✓ Created | yolo mode, coarse granularity |
| Research | ✓ Complete | 4 dimensions researched |
| Requirements | ✓ Defined | 58 total requirements (all mapped) |
| Roadmap | ✓ Created | 11+4 phases |
| Milestone v1.0 | ✅ Shipped | 6/6 phases complete, 2026-03-23 |
| Milestone v1.1 | ✅ Shipped | 11/11 phases, 58/58 reqs, 2026-05-18 |
| Milestone v1.2 | ✅ Complete | 4/4 phases, 11/11 plans, 100% |
| Milestone v1.3 | ✅ Complete | 1/1 phases, 3/3 plans, 100% |

## Accumulated Context

### Phase 1 Complete — RTSP Ownership Transfer

Phase 1 moved RTSP stream ingestion from Node.js FFmpeg to the Python OpenCV service. Key outcomes:

- **Python owns RTSP ingestion**: `FFmpegReader` spawns FFmpeg subprocess with raw BGR24 pipe, handles reconnection with exponential backoff
- **Python owns motion gating**: `MotionGate` wraps MOG2 background subtraction, runs inline per camera
- **WebSocket IPC**: Python `WebSocketPublisher` (async server) streams JPEG frames to Node.js; Node.js `PythonWsClient` receives and forwards to Socket.io
- **RTSPService orchestrator**: Starts per-camera pipelines + publisher, embeddable in Flask via `start_non_blocking()`
- **Dual-run mode**: `config.pipeline.mode` supports `legacy | dual | python-only` with per-camera override

### Phase 2 Complete — Streaming Performance Overhaul

Phase 2 delivered three targeted streaming optimizations:

- **GPU-accelerated YOLO inference** (02-01): CUDA runtime detection with graceful CPU fallback in both InProcessYOLO (frame_pipeline.py) and YOLOObjectDetector (app.py). Inference latency logged every 100 detections and exposed via metrics endpoint. Config-driven backend selection via `INFERENCE_BACKEND` and `INFERENCE_TARGET` env vars.

- **Binary frame delivery** (02-02): Eliminated the 33% base64 overhead on Socket.io by emitting raw Buffer objects (Socket.io v4 serializes natively). Frontend renders via Blob URLs with proper memory lifecycle (revokeObjectURL on replace + unmount). Base64 fallback preserved for long-polling transport.

- **Viewport-based camera loading** (02-03): New `useViewportStream` hook with IntersectionObserver (300ms debounce, 100px preload margin). `StreamSlotManager` semaphore limits concurrent streams to 4 with async queuing. Focused camera streams unconditionally. Grid cameras only stream when visible in viewport and a slot is acquired.

#### Roadmap Evolution

- Phase 1 added: RTSP Ownership Transfer
- Phase 2 added: YOLOv8n + ByteTrack Integration
- Phase 3 added: InsightFace ArcFace Upgrade
- Phase 4 added: Legacy Cleanup
- Phase 1 planned: 5 plans (03-WS-client, 04-WS-publisher, 01-core, 02-ffmpeg-mog2, 05-integration) in 3 waves

### Phase 3 Complete — InsightFace ArcFace Upgrade

Phase 3 upgraded face recognition from dlib-based face_recognition to InsightFace ArcFace:

- **ArcFaceRecognizer** (`arcface_recognizer.py`): New Python class using RetinaFace detection + ArcFace 512-dim embeddings. GPU/CPU auto-detect. Dual-mode: 128-dim legacy + 512-dim ArcFace embeddings stored separately.
- **Fallback chain**: ArcFace → ImprovedFaceRecognition → legacy FaceRecognition (graceful degradation)
- **Dependency management**: insightface, onnxruntime added to requirements.txt and Dockerfile
- **Redundant DNN detector removed**: YOLOObjectDetector no longer loads Caffe face detector (saves ~10MB)
- **CRITICAL-01 fixed**: Config reset SQL query now uses proper VALUES syntax with config_key column
- **CRITICAL-02 fixed**: Dimension check replaces cv2.resize crash on 1D embedding vectors
- **FaceEmbedding model**: Added `embeddingVersion` field (default '128') for dual-mode tracking
- **Version-aware routes**: POST accepts 128/512 dims, GET supports `?version=128|512` filter

### Deferred Items (acknowledged at v1.1 close)

| Category | Item | Status |
|----------|------|--------|
| quick_task | 260323-s9k-fix-streaming-architecture | historical |
| quick_task | 260323-svj-fix-streaming-page-minimal | historical |
| quick_task | 260326-spw-cant-login | historical |
| quick_task | 260327-tda-fix-warnings | historical |
| quick_task | 260327-tfv-cleanup-non-streaming-pages | historical |
| quick_task | 260328-e3h-batch-detection-results | historical |
| quick_task | 260328-gqb-batch-detection-never-ends | historical |
| quick_task | 260413-lfy-optimize-minimal | historical |
| quick_task | 260413-m82-analyze-dead-code | historical |
| quick_task | 260413-mrs-full-dead-code-audit | historical |
| quick_task | 260413-nuy-stream-reconnect | historical |
| quick_task | 260413-ogr-verify-detection-pipeline | historical |
| quick_task | 260413-ppr-always-on-detection | historical |
| quick_task | 260413-pwo-regression-check | historical |
| quick_task | 260418-stream-freeze-reconnect | historical |
| quick_task | 260518-js0-fix-all-one-by-one-e2e | resolved |
| context_question | Phase 08 CSS variables vs Tailwind | resolved |

---

## Phase Progress

### v1.1 (Archived)

See `.planning/milestones/v1.1-ROADMAP.md` for details. 48/48 plans complete (100%).

### v1.2 Detection Pipeline Redesign

| Phase | Name | Status | Plans | Completion |
|-------|------|--------|-------|------------|
| 1 | RTSP Ownership Transfer | ✅ Complete | 5/5 | 100% |
| 2 | Streaming Performance Overhaul | ✅ Complete | 3/3 | 100% |
| 3 | InsightFace ArcFace Upgrade | ✅ Complete | 2/2 | 100% |
| 4 | Legacy Cleanup | ✅ Complete | 1/1 | 100% |
| 5 | Pipeline Cleanup & Default Switch | ✅ Complete | 3/3 | 100% |

---

## Decisions Made

- **Removed redundant frame handler from index.ts** — The index.ts `pythonWsClient.on('frame')` handler was a duplicate of `rtspManager.wirePythonWsFrames()`. Only the rtspManager handler remained because it includes `role: 'live'`, health monitoring, and adaptive FPS throttling.
- **E2E test uses real WebSocket connections** — Tests create an actual `WebSocketServer` (on random port) and connect a real `PythonWsClient`, providing realistic end-to-end verification of the frame relay path.
- **Replaced `import.meta.url` with `process.cwd()`-based path resolution** — Ts-jest ESM module wrapper is incompatible with `import.meta.url` at module scope on Node.js v26. Used `path.resolve(process.cwd(), 'src', 'streams')` instead.

## Next Steps

Phase 4 complete — Milestone v1.2 fully delivered.

Phase 5 (Pipeline Cleanup & Default Switch) complete: 3/3 plans in 2 waves.

Phase 6 (Documentation Audit & Fix): 1/3 plans complete.

## Milestone v1.3 Summary

- **PIPELINE_MODE** defaults to `python-only` (05-01)
- Legacy Node.js detection modules removed (05-02): `optimizedMotionDetection.ts`, `motionTriggeredDetection.ts`, `objectDetection.ts`
- `consolidatedDetectionService.ts` stripped to settings/types stubs
- `rtspManager.ts` simplified to Socket.io frame relay via PythonWsClient (05-03): FFmpeg subprocess spawning, MJPEG parsing, dual-pipeline orchestration removed
- All motion detector registry entries and routes cleaned up
- ADR-003 accepted

---

## Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 260519-m8h | improve event filters on the events page | 2026-05-19 | - | [260519-m8h-improve-event-filters-on-the-events-page](./quick/260519-m8h-improve-event-filters-on-the-events-page/) |
| 260528-0vo | remove dead files, clean up server legacy | 2026-05-28 | fba185f | [260528-0vo-remove-dead-files-clean-up-server-legacy](./quick/260528-0vo-remove-dead-files-clean-up-server-legacy/) |

---

## Session Context

**Last Session:** 2026-05-29T15:48:00+05:30

- **Status:** Phase 6 (Documentation Audit & Fix) — 1/3 plans complete
- **Completed:** Plan 01 — Fix double frame emission (DOC-01) + E2E integration test (DOC-08)
- **Next:** Proceed to remaining Phase 6 plans (02, 03)
- **Reference:** ADR-003 accepted in `docs/architecture/ADR-003-detection-pipeline-redesign.md`

---

*State updated: 2026-05-29 — Phase 6 plan 01 complete. 1/3 plans in Phase 6 done.*
