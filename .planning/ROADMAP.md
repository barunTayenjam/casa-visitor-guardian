# Roadmap: SentryVision Home Security System

**Created:** 2026-03-18
**Updated:** 2026-05-29
**Granularity:** Coarse

## Milestones

- ✅ **v1.0 Resource Optimization** — Phases 1-6 (shipped 2026-03-23)
- ✅ **v1.1 Full System Overhaul** — Phases 1-11 (shipped 2026-05-18)
- ✅ **v1.2 Detection Pipeline Redesign** — Phases 1-4 (complete)
- ✅ **v1.3 Pipeline Cleanup** — Phase 5 (complete)
- 🔶 **v1.x Documentation Audit** — Phase 6 (in progress — 2/3 plans)

---

## Completed Milestones

v1.2 Detection Pipeline Redesign — 4 phases (complete)
v1.3 Pipeline Cleanup — Phase 5 (complete)

*Last updated: 2026-05-29 - v1.3 fully delivered*

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
- [x] 02-01-PLAN.md — GPU-Accelerated YOLO Inference (CUDA detection, CPU fallback, latency metrics) — Wave 1
- [x] 02-02-PLAN.md — Binary Frame Delivery (Socket.io binary, Blob URLs, base64 fallback) — Wave 1
- [x] 02-03-PLAN.md — Viewport-Based Camera Loading (IntersectionObserver, debounce, max concurrent) — Wave 1

### Phase 3: InsightFace ArcFace Upgrade

**Goal:** Replace dlib-based face_recognition with InsightFace ArcFace for improved accuracy and GPU support.
**Requirements**: FACE-01 – FACE-05
**Depends on:** Phase 2
**Plans:** 2 plans

Plans:
- [x] 03-01-PLAN.md — ArcFaceRecognizer class in Python (RetinaFace detection + ArcFace 512-dim embeddings, GPU/CPU auto-detect, dual-mode 128/512 storage) — Wave 1
- [x] 03-02-PLAN.md — Backend integration (YOLOObjectDetector cleanup, fallback chain, CRITICAL fixes, FaceEmbedding model) — Wave 1

### Phase 4: Legacy Cleanup

**Goal:** Remove legacy FaceRecognition class and simplify fallback chain to 2-tier.
**Requirements**: TBD
**Depends on:** Phase 3
**Plans:** 1 plan

Plans:
- [x] 04-01-PLAN.md — Remove legacy FaceRecognition class from app.py, simplify fallback chain, add None-safety guards — Wave 1

---

## v1.3 Pipeline Cleanup

### Phase 5: Pipeline Cleanup & Default Switch

**Goal:** Make the Python detection pipeline the default operational mode, remove legacy Node.js detection modules, simplify rtspManager, and formally accept ADR-003.

**Requirements**: CLN-01, CLN-02, CLN-03, CLN-04, CLN-05
**Depends on:** Phase 4
**Plans:** 3 plans in 2 waves

Plans:
- [x] 05-01-PLAN.md — Default pipeline switch + config cleanup — Wave 1
- [x] 05-02-PLAN.md — Remove legacy Node.js detection modules — Wave 1
- [x] 05-03-PLAN.md — Simplify rtspManager + accept ADR-003 — Wave 2

---

### Phase 6: Documentation Audit & Fix

**Goal:** Fix all architecture documentation drift identified in the Phase 5 Nyquist architecture audit. 8 bugs found: 4 critical (double frame emission, stale C4 diagrams, ADR-001/ADR-002 out of date), 2 high (ADR-004/ADR-005 reference deleted code, AGENTS.md stale), 2 medium (ADR-006 stale line refs, no E2E frame relay test).

**Requirements**: DOC-01, DOC-02, DOC-03, DOC-04, DOC-05, DOC-06, DOC-07, DOC-08
**Depends on:** Phase 5
**Plans:** 2/3 plans executed

Plans:
- [x] 06-01-PLAN.md — Fix double frame emission + add E2E frame relay test — Wave 1
- [x] 06-02-PLAN.md — Refresh architecture docs (ADRs 1-6, C4 diagrams) — Wave 2
- [ ] 06-03-PLAN.md — Update AGENTS.md + fix stale references — Wave 2

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
| **v1.3 Phase 5** | **CLN-01 – CLN-05** | **5** | **✅ Complete** |
| **v1.x Phase 6** | **DOC-01 – DOC-08** | **8** | **🔶 In Progress** |

**Coverage:** 58 v1.1 requirements ✓ | **v1.2 Phase 1**: RTSP-01 – RTSP-08 (8 requirements) | **v1.2 Phase 2**: PERF-01 – PERF-09 (9 requirements) | **v1.3 Phase 5**: CLN-01 – CLN-05 (5 requirements, ✅ Complete) | **v1.x Phase 6**: DOC-01 – DOC-08 (8 requirements, 🔶 In Progress) — 5/8 complete

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
*Last updated: 2026-05-29 — Phase 6 plan 02 complete*

## v1.3 Phase 5 Requirements

| ID | Description | Plans |
|----|-------------|-------|
| CLN-01 | Python pipeline becomes default operational mode | 05-01 |
| CLN-02 | Legacy Node.js detection modules removed | 05-02 |
| CLN-03 | rtspManager simplified to frontend relay only | 05-03 |
| CLN-04 | HTTP polling and retry logic removed | 05-01 |
| CLN-05 | ADR-003 formally accepted | 05-03 |
