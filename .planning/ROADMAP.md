# Roadmap: SentryVision Home Security System

**Created:** 2026-03-18
**Updated:** 2026-05-29
**Granularity:** Coarse

## Milestones

- ✅ **v1.0 Resource Optimization** — Phases 1-6 (shipped 2026-03-23)
- ✅ **v1.1 Full System Overhaul** — Phases 1-11 (shipped 2026-05-18)
- ⬜ **v1.2 Detection Pipeline Redesign** — Phases 1-4 (in planning)

---

## Active / Future Phases

v1.2 Detection Pipeline Redesign — 4 phases (in planning)

### Phase 1: RTSP Ownership Transfer

**Goal:** Move RTSP stream ingestion from Node.js FFmpeg to the Python OpenCV service. Python reads RTSP via FFmpeg subprocess pipes, runs MOG2 motion gating inline, and pushes JPEG-encoded live frames to Node.js via WebSocket for Socket.io relay to the frontend (frontend contract unchanged).

**Requirements**: RTSP-01, RTSP-02, RTSP-03, RTSP-04, RTSP-05, RTSP-06, RTSP-07, RTSP-08
**Plans:** 5 plans in 3 waves

Plans:
- [ ] 01-01-PLAN.md — Python Core Infrastructure (queues, config, metrics, tests, Docker) — Wave 1
- [ ] 01-02-PLAN.md — Node.js WebSocket Client Foundation (config, PythonWsClient class, ServiceRegistry, tests) — Wave 1
- [ ] 01-03-PLAN.md — Python FFmpeg + MOG2 Pipeline (FFmpegReader, FramePipeline, tests) — Wave 2
- [ ] 01-04-PLAN.md — Python WebSocket Publisher + Orchestration (WebSocketPublisher, RTSPService, app.py wiring) — Wave 3
- [ ] 01-05-PLAN.md — Node.js Integration (index.ts wiring, Socket.io relay, rtspManager dual-run) — Wave 2

### Phase 2: Streaming Performance Overhaul

**Goal:** Three targeted optimizations to the streaming pipeline: (1) GPU-accelerated YOLO inference with CUDA fallback to CPU, reducing detection latency from 50-200ms to 5-20ms on GPU hardware; (2) Binary frame delivery over Socket.io eliminating the 33% base64 bandwidth overhead; (3) Viewport-based camera loading using IntersectionObserver to stream only visible cameras. Frontend rendering contract and Socket.io event schema remain backward-compatible.

**Requirements**: PERF-01, PERF-02, PERF-03, PERF-04, PERF-05, PERF-06, PERF-07, PERF-08, PERF-09
**Depends on:** Phase 1
**Plans:** 3 plans in 1 wave

Plans:
- [ ] 02-01-PLAN.md — GPU-Accelerated YOLO Inference (CUDA detection, CPU fallback, latency metrics) — Wave 1
- [ ] 02-02-PLAN.md — Binary Frame Delivery (Socket.io binary, Blob URLs, base64 fallback) — Wave 1
- [ ] 02-03-PLAN.md — Viewport-Based Camera Loading (IntersectionObserver, debounce, max concurrent) — Wave 1

### Phase 3: InsightFace ArcFace Upgrade

**Goal:** [To be planned]
**Requirements**: TBD
**Depends on:** Phase 2
**Plans:** 0 plans

Plans:
- [ ] TBD (run /gsd-plan-phase 3 to break down)

### Phase 4: Legacy Cleanup

**Goal:** [To be planned]
**Requirements**: TBD
**Depends on:** Phase 3
**Plans:** 0 plans

Plans:
- [ ] TBD (run /gsd-plan-phase 4 to break down)

---

## Archived Phases

For full phase details of v1.0, see `.planning/milestones/v1.0-ROADMAP.md`.
For full phase details of v1.1, see `.planning/milestones/v1.1-ROADMAP.md`.

---

## Requirement Coverage

| Phase | Requirements | Count | Status |
|-------|-------------|-------|--------|
| Phase 1 | DET-01 – DET-05 | 5 | ✅ Complete |
| Phase 2 | NOTF-01 – NOTF-05, EVNT-01 – EVNT-06 | 11 | ✅ Complete |
| Phase 3 | FACE-01 – FACE-05 | 5 | ✅ Complete |
| Phase 4 | STOR-01 – STOR-05 | 5 | ✅ Complete |
| Phase 5 | FE-01 – FE-06 | 6 | ✅ Complete |
| Phase 6 | RO-01 – RO-05 | 5 | ✅ Complete |
| Phase 7 | SEC-01 – SEC-03 | 3 | ✅ Complete |
| Phase 8 | UX-01 – UX-06 | 6 | ✅ Complete |
| Phase 9 | SUI-01 – SUI-03 | 3 | ✅ Complete |
| Phase 10 | NAV-01 – NAV-04 | 4 | ✅ Complete |
| Phase 11 | TD-01 – TD-05 | 5 | ✅ Complete |
| **v1.1 Total** | | **58** | **✅ 58/58** |
| **v1.2 Phase 1** | **RTSP-01 – RTSP-08** | **8** | **📋 Planned** |
| **v1.2 Phase 2** | **PERF-01 – PERF-09** | **9** | **📋 Planned** |

**Coverage:** 58 v1.1 requirements ✓ | **v1.2 Phase 1**: RTSP-01 – RTSP-08 (8 requirements, planned) | **v1.2 Phase 2**: PERF-01 – PERF-09 (9 requirements, planned)

---

## v1.2 Phase 1 Requirements

| ID | Description | Plans |
|----|-------------|-------|
| RTSP-01 | RTSP ingestion via FFmpeg subprocess pipes in Python | 01-03 |
| RTSP-02 | Inline MOG2 motion gating (gate only, not authoritative) | 01-03 |
| RTSP-03 | Bounded queues with drop policies prevent memory growth | 01-01 |
| RTSP-04 | Python WebSocket server publishes JPEG frames + JSON events | 01-04 |
| RTSP-05 | Node.js WebSocket client receives frames and forwards via Socket.io | 01-02 |
| RTSP-06 | Dual-run config flag switches per-camera between legacy and Python | 01-02, 01-04, 01-05 |
| RTSP-07 | Observability metrics (reconnect count, FPS, dropped frames, queue depth, WS latency) | 01-01, 01-03, 01-04 |
| RTSP-08 | WebSocket reconnection works on Node.js restart | 01-02, 01-04 |

## v1.2 Phase 2 Requirements

| ID | Description | Category | Plans |
|----|-------------|----------|-------|
| PERF-01 | CUDA-accelerated YOLO inference via OpenCV DNN backend when GPU detected | GPU Inference | 02-01 |
| PERF-02 | Graceful CPU fallback when no CUDA-capable GPU available (current behavior preserved) | GPU Inference | 02-01 |
| PERF-03 | Inference latency metrics exposed via `/api/rtsp/metrics` and logging | GPU Inference | 02-01 |
| PERF-04 | Socket.io binary mode for frame transmission (Buffer instead of base64 string) | Binary Frames | 02-02 |
| PERF-05 | Frontend Blob URL rendering with proper memory cleanup (revokeObjectURL on frame replace) | Binary Frames | 02-02 |
| PERF-06 | Base64 fallback for HTTP long-polling transport clients | Binary Frames | 02-02 |
| PERF-07 | IntersectionObserver detects visible cameras in AdaptiveCameraGrid | Viewport Loading | 02-03 |
| PERF-08 | Auto start/stop streams based on viewport visibility with configurable debounce | Viewport Loading | 02-03 |
| PERF-09 | Configurable max concurrent streams limit (default: 4) | Viewport Loading | 02-03 |

*Roadmap created: 2026-03-18*
*Last updated: 2026-05-29 - v1.2 Phase 2 planned: 3 plans in 1 wave*
