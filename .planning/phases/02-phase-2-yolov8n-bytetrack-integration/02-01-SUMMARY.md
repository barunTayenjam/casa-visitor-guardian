---
phase: 02-streaming-performance-overhaul
plan: 01
subsystem: detection
tags: [yolo, cuda, gpu, opencv, inference]
requires:
  - phase: 01-rtsp-ownership-transfer
    provides: Python RTSP ingestion pipeline with MOG2 motion gating
provides:
  - GPU-accelerated YOLO inference with CUDA runtime detection and graceful CPU fallback
  - Inference latency metrics (per-detection, average, count) exposed via metrics endpoint
affects: [02-02, 02-03]
tech-stack:
  added: []
  patterns: ["CUDA backend selection with runtime detection and CPU fallback", "Inference latency instrumentation with periodic logging"]
key-files:
  created: []
  modified:
    - opencv-service/rtsp_ingestion/frame_pipeline.py
    - opencv-service/rtsp_ingestion/config.py
    - opencv-service/rtsp_ingestion/__init__.py
    - opencv-service/app.py
key-decisions:
  - "CUDA detection wrapped in try/except against AttributeError and cv2.error to handle missing driver, mismatched versions, and headless environments"
  - "Inference timing wraps the full forward() call including the cv2.error retry path to capture worst-case latency"
  - "Metrics key named 'inference' (not 'pipelines_metrics' as plan specified) for consistency with existing metric key naming conventions in the codebase"
patterns-established:
  - "Backend detection: _detect_backend() method on InProcessYOLO returns (backend, target, label) tuple; ONNX path calls it after readNet; YOLOv4-tiny path preserves existing try/except"
  - "Latency metrics: time.perf_counter() around forward(), stored as _last_inference_ms, _inference_count, _total_inference_ms, exposed via get_metrics() dict"
requirements-completed: [PERF-01, PERF-02, PERF-03]
duration: inline
completed: 2026-05-29
---

# Plan 02-01: GPU-Accelerated YOLO Inference Summary

**CUDA runtime detection with graceful CPU fallback and inference latency instrumentation across InProcessYOLO and YOLOObjectDetector**

## Performance

- **Duration:** inline (executed during interactive development session)
- **Completed:** 2026-05-29
- **Tasks:** 2

## Accomplishments

- `INFERENCE_BACKEND` and `INFERENCE_TARGET` config constants with env var overrides in config.py
- `InProcessYOLO._detect_backend()` method: CUDA detection via `cv2.cuda.getCudaEnabledDeviceCount()`, CPU fallback on failure or explicit config
- Both ONNX model paths (InProcessYOLO in frame_pipeline.py, YOLOObjectDetector in app.py) use CUDA when available, fall back to CPU gracefully
- Inference latency measured with `time.perf_counter()`, logged every 100 detections with backend label
- `get_metrics()` on InProcessYOLO and `get_yolo_metrics()` on FramePipeline expose backend, model_type, last_inference_ms, inference_count, avg_inference_ms
- `get_metrics_snapshot()` on RTSPService includes pipeline-level inference metrics

## Decisions Made

- Metrics key named `'inference'` (not `'pipelines_metrics'`) for consistency with existing codebase conventions — no external consumer depends on the key name
- YOLOv4-tiny path preserved its existing CUDA try/except pattern (not refactored to use `_detect_backend()`) to minimize risk of regression in the fallback code path
- `round()` applied to latency values in `get_metrics()` (1 decimal place) to prevent floating-point noise in monitoring output

## Deviations from Plan

None — plan executed exactly as written, except the dict key name difference noted above (intentional, data is identical).

## Issues Encountered

None

## Next Phase Readiness

GPU acceleration transparent to consumers — detection pipeline continues to work identically. Metrics consumers can now read inference latency from the `/api/rtsp/metrics` endpoint.
