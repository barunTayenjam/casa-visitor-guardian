---
phase: 06-phase-6-documentation-audit
plan: 02
subsystem: docs
tags: architecture, adr, c4, diagrams, documentation, streaming, pipeline

# Dependency graph
requires:
  - phase: 06-phase-6-documentation-audit
    provides: Architecture audit findings identifying stale documentation
  - phase: 05-phase-5-pipeline-cleanup
    provides: Legacy pipeline module removals (05-02, 05-03) that invalidated existing ADRs
  - phase: 02-phase-2-streaming-performance
    provides: Binary frame delivery (PERF-04) that superseded base64 encoding

provides:
  - Six corrected ADRs (ADR-001 through ADR-006) matching current implementation
  - Two regenerated C4 streaming pipeline diagrams matching simplified architecture
  - Dated revision notes in each ADR documenting what changed and why
  - Historical sections preserved as collapsible `<details>` blocks for reference

affects:
  - Future documentation maintenance (drift prevention T-06-05 accepted as-is)
  - Developer onboarding — documentation now accurately describes live code

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "ADR revision notes: dated change tracking at top of document"
    - "Historical code preserved as `<details>` collapsible sections"
    - "Both C4 diagram formats (.mmd dark theme, .md variant) kept in sync"

key-files:
  created: []
  modified:
    - docs/architecture/ADR-001-dual-pipeline-architecture.md
    - docs/architecture/ADR-002-base64-frame-encoding-over-socket-io.md
    - docs/architecture/ADR-004-ffmpeg-subprocess-for-rtsp-ingestion.md
    - docs/architecture/ADR-005-motion-gated-detection-pipeline.md
    - docs/architecture/ADR-006-adaptive-fps-throttling-based-on-viewer-count.md
    - docs/c4-streaming-pipeline.mmd
    - docs/c4-streaming-pipeline.md

key-decisions:
  - "ADR-001 default mode corrected from 'legacy' to 'python-only' matching config/index.ts:339"
  - "ADR-002 fully rewritten for Socket.io binary mode (no more base64 documentation)"
  - "ADR-004/005 preserve obsolete Node.js sections as <details> historical blocks"
  - "C4 diagrams stripped of OptimizedMotionDetector, ConsolidatedDetectionService, Redis cache"
  - "StreamManager description simplified: no FFmpeg spawn, no MJPEG parsing"

requirements-completed:
  - DOC-02
  - DOC-03
  - DOC-04
  - DOC-05
  - DOC-07

# Metrics
duration: 6min
completed: 2026-05-29
---

# Phase 6 Plan 2: Refresh Stale Architecture Documentation Summary

**Six corrected ADRs and two regenerated C4 diagrams matching current code — default mode fixed, binary frame delivery documented, stale sections flagged, deleted components stripped from diagrams**

## Performance

- **Duration:** 6 min
- **Started:** 2026-05-29T10:20:26Z
- **Completed:** 2026-05-29T10:26:10Z
- **Tasks:** 3
- **Files modified:** 7

## Accomplishments

- **ADR-001**: Fixed default mode from `|| 'legacy'` to `|| 'python-only'` (matches code at config/index.ts:339). Stripped all Node.js FFmpeg subprocess spawning references. Wrapped legacy pipeline diagram in historical blockquote. Removed stale negative consequences (doubled frame relay, reconnection logic, detection flows, state divergence risk).

- **ADR-002**: Complete rewrite from "Base64 Frame Encoding" to "Binary Frame Delivery over Socket.io" with correct data path diagram, actual `wirePythonWsFrames()` code blocks, binary-mode consequences (33% bandwidth reduction, no encoding CPU cost, Blob URL lifecycle), and updated alternatives section reflecting the original base64 approach as rejected.

- **ADR-004/005**: Added dated revision notes at the top. Wrapped obsolete Node.js sections in `<details>` collapsible blocks with historical summaries. Updated tables, consequences, and references to reflect removed code.

- **ADR-006**: All line references updated to match current `rtspManager.ts` (activeViewers at lines 22-23, getOptimalFps at 161, frame emission at 54-91/69-81, viewer tracking at 93-160). Bandwidth numbers corrected for binary frames (no base64 overhead).

- **C4 diagrams (both .mmd and .md)**: Removed Redis external system, Detection Pipeline boundary (OptimizedMotionDetector, ConsolidatedDetectionService), StreamManager → FFmpeg CLI and → Socket.io relationships. Updated StreamManager description (no FFmpeg spawn/MJPEG parsing). Updated Socket.io Server description. Updated py_ws → sio relationship for trackingEvent forwarding.

## Task Commits

Each task was committed atomically:

1. **Task 1: Fix ADR-001 default mode + strip FFmpeg subprocess refs** - `2da34a0` (docs)
2. **Task 2: Rewrite ADR-002 for binary frame delivery** - `354bc91` (docs)
3. **Task 3: Flag stale ADR-004/005 + fix ADR-006 lines + regenerate C4 diagrams** - `7226f02` (docs)

**Plan metadata:** (committed below with state updates)

## Files Created/Modified

- `docs/architecture/ADR-001-dual-pipeline-architecture.md` - Corrected default mode, stripped FFmpeg spawn refs, added revision note
- `docs/architecture/ADR-002-base64-frame-encoding-over-socket-io.md` - Complete rewrite for binary frame delivery via Socket.io Buffer
- `docs/architecture/ADR-004-ffmpeg-subprocess-for-rtsp-ingestion.md` - Added revision note, wrapped stale Node.js sections in `<details>`
- `docs/architecture/ADR-005-motion-gated-detection-pipeline.md` - Added revision note, wrapped stale legacy pipeline in `<details>`
- `docs/architecture/ADR-006-adaptive-fps-throttling-based-on-viewer-count.md` - Fixed all line references, updated bandwidth numbers
- `docs/c4-streaming-pipeline.mmd` - Removed deleted components (OptimizedMotionDetector, ConsolidatedDetectionService, Redis), updated StreamManager
- `docs/c4-streaming-pipeline.md` - Same structural changes as .mmd with appropriate theming

## Decisions Made

- **Historical sections preserved as collapsible `<details>` blocks** in ADR-004/005 rather than deleted entirely. This maintains the architectural rationale trail while clearly marking which code no longer exists.
- **C4 diagrams kept separate** (.mmd and .md) with identical logical structure but different theming, matching existing convention.
- **Ambiguous stream_mgr → sio relationship removed** from C4 diagrams because the frame relay path is already covered by py_ws → sio, and stream_mgr's frame emission is an implementation detail of PythonWsClient event handling.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## Next Phase Readiness

- Plan 02 complete (4/6 requirements fulfilled for Phase 6: DOC-02, DOC-03, DOC-04, DOC-05, DOC-07)
- Ready for Plan 03 (DOC-06: API layer consistency, DOC-09: README hygiene, DOC-10: Postman collection)

## Self-Check: PASSED

- All 7 modified files exist on disk
- All 3 task commits found in git log
- All acceptance criteria verified:
  - ADR-001: No `|| 'legacy'` default, `python-only` present
  - ADR-002: No `Buffer.toString('base64')` as implementation claim, binary mode documented
  - ADR-004/005: Revision notes present with "Revision" keyword
  - ADR-006: Line refs match source (activeViewers:22, getOptimalFps:161, StreamController:13)
  - C4 .mmd: No OptimizedMotionDetector, ConsolidatedDetectionService, or Redis
  - C4 .md: Same as .mmd - clean

---
*Phase: 06-phase-6-documentation-audit*
*Completed: 2026-05-29*
