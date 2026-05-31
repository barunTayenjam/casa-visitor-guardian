# Roadmap: SentryVision Home Security System

**Created:** 2026-03-18
**Updated:** 2026-05-31
**Granularity:** Coarse

## Milestones

- ✅ **v1.0 Resource Optimization** — Phases 1-6 (shipped 2026-03-23)
- ✅ **v1.1 Full System Overhaul** — Phases 1-11 (shipped 2026-05-18)
- ✅ **v1.2 Detection Pipeline Redesign** — Phases 1-4 (complete)
- ✅ **v1.3 Pipeline Cleanup** — Phase 5 (complete)
- ✅ **v1.x Documentation Audit** — Phase 6 (complete — 3/3 plans)
- 📋 **v1.4 Security & Quality** — Phases 7-9 (planned)
- 📋 **v1.5 Audit Bug Fixes** — Phases 10-13 (from AUDIT-REPORT.md — 61 bugs)

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
**Plans:** 3/3 plans executed ✅

Plans:
- [x] 06-01-PLAN.md — Fix double frame emission + add E2E frame relay test — Wave 1
- [x] 06-02-PLAN.md — Refresh architecture docs (ADRs 1-6, C4 diagrams) — Wave 2
- [x] 06-03-PLAN.md — Update AGENTS.md + fix stale references — Wave 2

## v1.5 Audit Bug Fixes

### Phase 10: Critical Bug Fixes

**Goal:** Fix all 7 P0 critical bugs from comprehensive audit — event deletion no-op, camera config persistence, camera create broken end-to-end, account lockout unimplemented, MFA setup secret never persisted, MFA verify protocol mismatch, SQL injection in batch processing.

**Requirements**: FIX-001, FIX-002, FIX-003, FIX-004, FIX-005, FIX-006, FIX-007
**Depends on:** Phase 6
**Plans:** 4 plans in 1 wave

Plans:
- [ ] 10-01-PLAN.md — Event deletion implementation (FIX-001) — Wave 1
- [ ] 10-02-PLAN.md — Camera CRUD + config persistence with credential re-encryption (FIX-002, FIX-003) — Wave 1
- [ ] 10-03-PLAN.md — Auth security: lockout + MFA setup/verify fix (FIX-004, FIX-005, FIX-006) — Wave 1
- [ ] 10-04-PLAN.md — SQL injection parameterization (FIX-007) — Wave 1

### Phase 11: High Priority Fixes

**Goal:** Fix 22 P1 high-priority bugs — visitor PUT duplicate, night events SQL, highlights sort/nav, analytics vehicles zero, notifications not wired, VAPID keys, detection trigger endpoints, bounding boxes, motion filter, camera update/filter/zone issues, settings retention/fresh-install, token invalidation, password history, alert UUID, visitor deleteFace, CSV newline.

**Requirements**: FIX-008 through FIX-029
**Depends on:** Phase 10

Plans:
- [ ] 11-01-PLAN.md — Visitor + alerts fixes (FIX-008, FIX-027, FIX-028)
- [ ] 11-02-PLAN.md — Day highlights fixes (FIX-009, FIX-010, FIX-011)
- [ ] 11-03-PLAN.md — Analytics + events fixes (FIX-012, FIX-018, FIX-019)
- [ ] 11-04-PLAN.md — Detection pipeline fixes (FIX-014, FIX-015, FIX-016)
- [ ] 11-05-PLAN.md — Camera management P1 fixes (FIX-020, FIX-021, FIX-022)
- [ ] 11-06-PLAN.md — Settings fixes (FIX-023, FIX-024)
- [ ] 11-07-PLAN.md — Auth P1 fixes: token invalidation + password history (FIX-025, FIX-026)
- [ ] 11-08-PLAN.md — Notifications: wire to pipeline + VAPID persistence (FIX-013, FIX-014)
- [ ] 11-09-PLAN.md — Batch CSV fix (FIX-029)

### Phase 12: Medium Priority Fixes

**Goal:** Fix 23 P2 medium-priority bugs — camera leaks/snapshot/night-mode/test-stream, event share/performance/timezone, analytics storage/hourly/response-time, settings theme/auto-save/hardcoded/optimization, notifications camera-names/key-name/timezone, system cleanup-status/storage-stats/sync-io/db-health, visitor embedding-count.

**Requirements**: FIX-030 through FIX-052
**Depends on:** Phase 11

Plans:
- [ ] 12-01-PLAN.md — Camera P2 fixes (FIX-030, FIX-031, FIX-032, FIX-033)
- [ ] 12-02-PLAN.md — Events P2 fixes (FIX-034, FIX-035, FIX-036)
- [ ] 12-03-PLAN.md — Analytics P2 fixes (FIX-037, FIX-038, FIX-039)
- [ ] 12-04-PLAN.md — Settings P2 fixes (FIX-040, FIX-041, FIX-042, FIX-043, FIX-044)
- [ ] 12-05-PLAN.md — Notifications P2 fixes (FIX-045, FIX-046, FIX-047)
- [ ] 12-06-PLAN.md — System health P2 fixes (FIX-048, FIX-049, FIX-050, FIX-051)
- [ ] 12-07-PLAN.md — Visitor P2 fix (FIX-052)

### Phase 13: Low Priority Cleanup

**Goal:** Fix 9 P3 low-priority items — lastLogin update, password complexity, UserSession implementation, auth log level, salt column removal, register tab visibility, writeSettingsToDb await, unused analytics endpoints, highlights shortcuts.

**Requirements**: FIX-053 through FIX-061
**Depends on:** Phase 12

Plans:
- [ ] 13-01-PLAN.md — Auth P3 cleanup (FIX-053, FIX-054, FIX-055, FIX-056, FIX-057, FIX-058)
- [ ] 13-02-PLAN.md — Detection + analytics + highlights P3 (FIX-059, FIX-060, FIX-061)

---

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
| **v1.x Phase 6** | **DOC-01 – DOC-08** | **8** | **✅ Complete** |
| **v1.5 Phase 10** | **FIX-001 – FIX-007** | **7** | **📋 Planned** |
| **v1.5 Phase 11** | **FIX-008 – FIX-029** | **22** | **📋 Planned** |
| **v1.5 Phase 12** | **FIX-030 – FIX-052** | **23** | **📋 Planned** |
| **v1.5 Phase 13** | **FIX-053 – FIX-061** | **9** | **📋 Planned** |

**Coverage:** 58 v1.1 requirements ✓ | v1.2: RTSP-01–08 + PERF-01–09 | v1.3: CLN-01–05 | v1.x: DOC-01–08 | v1.5: FIX-001–061 (61 audit bugs across Phases 10-13)

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

## v1.4 Security & Quality

### Phase 7: Security Hardening

**Goal:** Fix all critical and high-severity security issues — JWT refresh token bypass, default seed passwords, missing Helmet headers, unvalidated route inputs, untyped auth access. Precondition for all further feature work.

**Requirements**: SEC2-01, SEC2-02, SEC2-03, SEC2-04, SEC2-05, SEC2-06
**Depends on:** Phase 6
**Plans:** 2 plans in 2 waves

Plans:
- [ ] 07-01-PLAN.md — Auth & startup security: JWT refresh bypass fix, seed password fail-fast, Helmet headers (SEC2-01, SEC2-02, SEC2-03) — Wave 1
- [ ] 07-02-PLAN.md — Route validation & code hardening: input validation audit, (req as any) fix, camera config warning, timezone, env consolidation (SEC2-04, SEC2-05, SEC2-06) — Wave 2

### Phase 8: Reliability & Type Safety

**Goal:** Fix partial startup, event loop blocking, dual Socket.io handlers, dual service access. Begin TypeScript strict mode migration. Type detection pipeline contract at Python→Node.js boundary.

**Requirements**: REL-01, REL-02, REL-03, REL-04, REL-05, REL-06, TYP-01, TYP-02, TYP-03
**Depends on:** Phase 7
**Plans:** 3 plans

Plans:
- [ ] 08-01-PLAN.md — Startup reliability + health endpoints (REL-01, REL-06)
- [ ] 08-02-PLAN.md — Async file I/O + Socket.io consolidation (REL-02, REL-03, REL-04, REL-05)
- [ ] 08-03-PLAN.md — Type safety migration phase 1 (TYP-01, TYP-02, TYP-03)

### Phase 9: Code Quality & Test Coverage

**Goal:** Decompose monolithic files (index.ts 623L, app.py 1693L, nvidiaAnalysis 1063L, eventSearchService 673L), standardize logging, add critical-path tests.

**Requirements**: CQ-01–CQ-05, CQ-07, TEST-01–TEST-03 (CQ-06, CQ-08 already done in Phase 7; CI-01 deferred)
**Depends on:** Phase 8
**Plans:** 3 plans in 2 waves

Plans:
- [ ] 09-01-PLAN.md — Backend decomposition: index.ts + nvidiaAnalysisService + eventSearchService + app.py (CQ-01, CQ-02, CQ-03, CQ-04) — Wave 1
- [ ] 09-02-PLAN.md — Code quality cleanup: console→logger migration + hardcoded Docker path fix (CQ-05, CQ-07) — Wave 1
- [ ] 09-03-PLAN.md — Test coverage: frontend jest setup + baseClient/AuthContext tests + AuthController/CameraController/cacheService tests (TEST-01, TEST-02, TEST-03) — Wave 2

---

*Roadmap created: 2026-03-18*
*Last updated: 2026-05-31 — v1.5 Audit Bug Fixes milestone added (Phases 10-13, 61 bugs from AUDIT-REPORT.md)*

## v1.3 Phase 5 Requirements

| ID | Description | Plans |
|----|-------------|-------|
| CLN-01 | Python pipeline becomes default operational mode | 05-01 |
| CLN-02 | Legacy Node.js detection modules removed | 05-02 |
| CLN-03 | rtspManager simplified to frontend relay only | 05-03 |
| CLN-04 | HTTP polling and retry logic removed | 05-01 |
| CLN-05 | ADR-003 formally accepted | 05-03 |
