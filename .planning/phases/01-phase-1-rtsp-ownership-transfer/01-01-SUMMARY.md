---
phase: 01-rtsp-ownership-transfer
plan: 01
subsystem: python-core
tags: [python, queues, config, metrics, opencv, pytest]
requires: []
provides:
  - Bounded queue implementations (DropOldestQueue, DropIfFullQueue)
  - Thread-safe metrics collector
  - Module-level configuration constants for all pipeline parameters
  - Shared pytest fixtures (mock_frame, blank_frame, motion_frame, camera_config)
affects: [01-03, 01-04]
tech-stack:
  added: [pytest, opencv-contrib-python-headless]
  patterns: [module-level config constants, thread-safe counters via Lock, bounded queue drop policies]
key-files:
  created:
    - opencv-service/rtsp_ingestion/config.py
    - opencv-service/rtsp_ingestion/queues.py
    - opencv-service/rtsp_ingestion/metrics.py
    - opencv-service/rtsp_ingestion/__init__.py
    - opencv-service/tests/__init__.py
    - opencv-service/tests/conftest.py
    - opencv-service/tests/test_queue.py
    - opencv-service/tests/test_mog2.py
  modified: []
key-decisions:
  - "Module-level constants (not class-based config) for simpler import patterns"
  - "DropOldestQueue for live frames, DropIfFullQueue for motion events — different drop semantics for different pipeline stages"
  - "MOG2 parameters: history=200, varThreshold=16, detectShadows=False (matches existing app.py defaults)"
  - "FFmpeg args replicated from Node.js rtspManager.ts to ensure identical RTSP behavior"
  - "pytest-asyncio NOT added yet — only synchronous tests in this plan"
patterns-established:
  - "Thread safety via queue.Queue internal locks and MetricsCollector Lock"
  - "Fixture-based test setup with shared conftest.py"
  - "Config constants imported from .config in downstream modules"
requirements-completed: [RTSP-03, RTSP-07]
---

# Phase 01 — Plan 01: Python Core Infrastructure Summary

**Bounded queues, module-level config, thread-safe metrics, and pytest infrastructure for the RTSP ingestion pipeline**

## Performance

- **Duration:** 6 min (retrospective)
- **Started:** 2026-05-28T10:00:00+05:30
- **Completed:** 2026-05-28T10:06:00+05:30
- **Tasks:** 3
- **Files created:** 8

## Accomplishments
- DropOldestQueue and DropIfFullQueue with verified drop policies via 6 passing tests
- MetricsCollector with thread-safe counters, gauges, and atomic snapshot
- Config.py with all pipeline parameters (queue sizes, WS port, MOG2, JPEG, FFmpeg args)
- RTSPService stub ready for Plan 01-04 full implementation
- 9 passing pytest tests for queues and MOG2 motion gate

## Task Commits

1. **Task 1: Config, queues, metrics modules** - `b48201a` (feat)
2. **Task 2: Pytest infrastructure** - `329f62c` (test)
3. **Task 3: Dockerfile + requirements** - `b48201a` (part of Task 1)

**Plan metadata:** (retrospective — no separate docs commit)

## Files Created/Modified
- `opencv-service/rtsp_ingestion/config.py` - Module-level constants for all pipeline parameters
- `opencv-service/rtsp_ingestion/queues.py` - Bounded queues with drop policies
- `opencv-service/rtsp_ingestion/metrics.py` - Thread-safe metrics collector
- `opencv-service/rtsp_ingestion/__init__.py` - Package exports + RTSPService stub
- `opencv-service/tests/__init__.py` - Package marker
- `opencv-service/tests/conftest.py` - Shared test fixtures
- `opencv-service/tests/test_queue.py` - 6 queue tests
- `opencv-service/tests/test_mog2.py` - 3 MOG2 motion gate tests

## Decisions Made
- Module-level constants rather than class-based config for simpler import patterns
- DropOldestQueue (live frames) vs DropIfFullQueue (motion events) — different drop semantics for realtime vs detection paths
- MOG2 params replicated from existing app.py to maintain consistent behavior

## Deviations from Plan
None — plan executed exactly as written.

## Issues Encountered
None

## Next Phase Readiness
- Core infrastructure ready for Plan 01-03 (FFmpeg + MOG2 pipeline) and Plan 01-04 (WebSocket publisher + orchestration)

---
*Phase: 01-rtsp-ownership-transfer*
*Completed: 2026-05-28*
