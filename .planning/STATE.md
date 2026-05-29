---
gsd_state_version: 1.0
milestone: v1.2
milestone_name: Detection Pipeline Redesign
status: executing
last_updated: "2026-05-28T11:25:37.955Z"
progress:
  total_phases: 4
  completed_phases: 2
  total_plans: 8
  completed_plans: 8
  percent: 50
---

# State: SentryVision Home Security System

## Project Reference

See: .planning/PROJECT.md (updated 2026-05-18)

**Core value:** Provide reliable, automated home surveillance that detects motion and visitors, sends real-time alerts, and stores events for later review

**Current focus:** Phase 02 — Streaming Performance Overhaul

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
| Milestone v1.2 | 🔄 Executing | 1/4 phases, 5/5 plans, 25% |

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
| 3 | InsightFace ArcFace Upgrade | ⬜ Not planned | 0/0 | 0% |
| 4 | Legacy Cleanup | ⬜ Not planned | 0/0 | 0% |

---

## Next Steps

Phase 2 complete! Ready for Phase 3:

1. Plan Phase 3: `/gsd-plan-phase 3`
2. Execute Phase 3: `/gsd-execute-phase 3`

---

## Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 260519-m8h | improve event filters on the events page | 2026-05-19 | - | [260519-m8h-improve-event-filters-on-the-events-page](./quick/260519-m8h-improve-event-filters-on-the-events-page/) |
| 260528-0vo | remove dead files, clean up server legacy | 2026-05-28 | fba185f | [260528-0vo-remove-dead-files-clean-up-server-legacy](./quick/260528-0vo-remove-dead-files-clean-up-server-legacy/) |

---

## Session Context

**Last Session:** 2026-05-29T15:55:00+05:30

- **Status:** Phase 2 complete (3/3 plans, 100%)
- **Next:** Plan Phase 3: `/gsd-plan-phase 3`
- **Reference:** ADR-003 in `docs/architecture/ADR-003-detection-pipeline-redesign.md`

---

*State updated: 2026-05-29 — Phase 2 complete (Streaming Performance Overhaul), ready for Phase 3*
