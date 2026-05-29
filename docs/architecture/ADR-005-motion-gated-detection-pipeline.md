# ADR-005: Motion-Gated Detection Pipeline

**Status**: Accepted
**Date**: 2026-05-29
**Deciders**: Engineering team

---

## Context

SentryVision runs object detection (YOLO) and face recognition on camera feeds. Full YOLO inference is expensive — on CPU, a single YOLOv8n forward pass takes **50-200ms** depending on input resolution and hardware. At a continuous 5 FPS stream, this would consume 250-1000ms of CPU time per second per camera — exceeding available compute for multi-camera deployments.

The system serves a home/edge security deployment with:
- ≤10 cameras
- CPU-only inference (GPU optional)
- Continuous 24/7 operation
- Limited hardware (often a single ARM SBC or low-power x86 machine)

### The Problem

Running full YOLO inference on every frame is not viable:

| Cameras | FPS | YOLO Time/Frame | Total YOLO Load | Feasibility |
|---------|-----|-----------------|-----------------|-------------|
| 4 | 5 | 100ms | 2,000ms/s | Impossible on single core |
| 4 | 5 | 50ms | 1,000ms/s | Saturates one core |
| 10 | 5 | 100ms | 5,000ms/s | Requires 5+ cores |

Meanwhile, most security camera footage is static — no motion for minutes at a time. Processing static frames wastes CPU and generates no useful events.

### Motion Detection as a Filter

Background subtraction is a cheap pixel-level operation that estimates which pixels have changed between frames. MOG2 (Mixture of Gaussians) is OpenCV's adaptive background subtractor, processing a frame in **1-5ms** — roughly 20-100× faster than YOLO.

The insight: only run expensive inference when cheap motion detection confirms something has changed.

---

## Decision

Use MOG2 background subtraction as a lightweight motion gate. YOLO object detection and face recognition execute only when motion exceeds a configurable pixel threshold. The system operates in two distinct implementations across the legacy and Python pipelines, but follows the same gated design.

### Legacy Pipeline (Node.js)

The `OptimizedMotionDetector` (`server/src/detection/optimizedMotionDetection.ts`) is a comprehensive motion detection system with:

- **Adaptive sensitivity**: Per-camera configurable `sensitivity` (0-100), with automatic day/night sensitivity multipliers via `timeZones` configuration.
- **Night mode**: Enhanced sensitivity during nighttime (22:00-06:00) to handle IR camera noise.
- **Multi-frame validation**: Requires `requiredConsecutiveFrames` (default: 3) consecutive frames of motion before triggering detection, reducing false positives from momentary lighting changes.
- **Cooldown period**: `cooldownPeriod` (configurable) prevents repeated detections of the same ongoing motion.
- **Zone-based detection**: Cameras define detection zones (`zones` in config) to ignore motion in irrelevant areas (trees, roads).
- **Gaussian blur preprocessing**: Optional `useGaussianBlur` (default: true) with configurable kernel size to reduce noise.
- **Contour filtering**: `minContourArea` (default: 500px²) ignores small motion regions (insects, sensor noise).
- **Rate limiting**: `maxEventsPerHour` prevents detection storms from overwhelming the system.

When motion is validated, the detector calls the `consolidatedDetectionService` for YOLO inference + face recognition via HTTP to the Python Flask service.

### Python Pipeline (Native)

The `MotionGate` class (`opencv-service/rtsp_ingestion/frame_pipeline.py:44-78`) is a leaner implementation:

```python
class MotionGate:
    def __init__(self, camera_id, history=200, var_threshold=16, pixel_threshold=500):
        self._bg_subtractor = cv2.createBackgroundSubtractorMOG2(
            history=history,
            varThreshold=var_threshold,
            detectShadows=False,
        )
        self._pixel_threshold = pixel_threshold
        self._warmup_frames = 10

    def detect(self, frame: np.ndarray) -> dict:
        self._frame_count += 1
        fg_mask = self._bg_subtractor.apply(frame)
        _, fg_mask = cv2.threshold(fg_mask, 250, 255, cv2.THRESH_BINARY)
        kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))
        fg_mask = cv2.morphologyEx(fg_mask, cv2.MORPH_OPEN, kernel, iterations=1)
        fg_mask = cv2.morphologyEx(fg_mask, cv2.MORPH_CLOSE, kernel, iterations=1)
        motion_pixels = cv2.countNonZero(fg_mask)
        total_pixels = fg_mask.shape[0] * fg_mask.shape[1]
        motion_percentage = (motion_pixels / total_pixels) * 100
        if self._frame_count < self._warmup_frames:
            return {"motion_detected": False, "motion_pixels": motion_pixels, "confidence": 0.0}
        motion_detected = motion_pixels > self._pixel_threshold
        return {"motion_detected": motion_detected, "motion_pixels": motion_pixels, "confidence": ...}
```

Key parameters (from `opencv-service/rtsp_ingestion/config.py`):

| Parameter | Value | Purpose |
|-----------|-------|---------|
| `MOG2_HISTORY` | 200 | Number of frames for background model |
| `MOG2_VAR_THRESHOLD` | 16 | Mahalanobis distance threshold for pixel classification |
| `MOTION_PIXEL_THRESHOLD` | 500 | Minimum changed pixels to trigger detection |
| Warmup frames | 10 | Frames skipped before motion detection begins |

The processing pipeline is (`frame_pipeline.py:1-17`):

```text
FFmpegReader thread
      │  raw BGR24 frame
      ▼
MotionGate (MOG2) ─── no motion ──→ live queue (always, for preview)
      │  motion detected
      ▼
YOLO Detection (InProcessYOLO, cv2.dnn)
      ▼
ByteTrack Tracking
      ▼
Face Recognition (new tracks only, identity cache TTL=30s)
      ▼
WebSocket Publisher (frames + track-lifecycle events)
```

### Critical Design Principle

**MOG2 is NOT authoritative detection. It is a computational filter.**

Final events depend on YOLO detections, not raw motion triggers. This prevents false alerts from:
- Rain
- Lighting flicker
- IR illumination changes
- Sensor noise
- Shadows

---

## Consequences

### Positive

- **Dramatic CPU reduction**: Motion detection costs 1-5ms per frame. YOLO costs 50-200ms. If only 10% of frames contain motion, CPU usage drops by ~95%.
- **Scalability**: With motion gating, 10 cameras running at 5 FPS require YOLO inference only during actual events. A system that would need 5+ cores without gating can run on 1-2 cores.
- **Adaptive sensitivity**: Both implementations adapt to environmental conditions. The legacy pipeline has explicit day/night sensitivity multipliers and quiet hours. The Python pipeline relies on MOG2's inherent adaptivity (the Gaussian mixture model learns the background over time).
- **Warmup period**: The 10-frame warmup (`_warmup_frames = 10`) prevents false detections during initial background model learning.
- **Event quality**: By requiring YOLO confirmation after motion detection, the system avoids motion-only false positives (rain, wind). Events always represent actual detected objects.

### Negative

- **Detection latency**: Motion must be detected first, then YOLO runs. This adds the motion detection time (~2ms) plus queue wait time to the detection pipeline. For fast-moving objects that enter and leave the frame within one detection cycle, the system may miss the event entirely.
- **Static scene blindness**: If an object is present when the system starts (or during warmup), it becomes part of the background model. A person standing still for ~40 seconds (200 history frames ÷ 5 FPS) will be absorbed into the background. This is a fundamental limitation of background subtraction.
- **MOG2 sensitivity tuning**: The `var_threshold` and `pixel_threshold` parameters require per-environment tuning. Indoor cameras need different settings than outdoor cameras. Night vision (IR) cameras generate more noise and need lower thresholds, risking more false positives.
- **Warmup gap**: During the first 10 frames (~2 seconds at 5 FPS), no motion detection occurs. Events during this window are missed.
- **Dual implementation drift**: The Node.js and Python motion gate implementations have different features (multi-frame validation, night mode, zone detection in Node.js vs simpler MOG2 in Python). This means cameras running on different pipelines will have different false positive/negative profiles.

### Risks

- **Background model poisoning**: A slow, gradual change (e.g., a person walking very slowly) may be absorbed into the background model without triggering detection. The `history` parameter (200 frames) controls this — lower values detect faster changes but are more sensitive to noise.
- **Lighting transition false positives**: Sudden lighting changes (lights on/off, car headlights) trigger massive motion regions. The `requiredConsecutiveFrames` (legacy) and `pixel_threshold` (Python) provide some protection, but rapid light changes can still overwhelm the gate.
- **CPU spike on motion storms**: When multiple cameras detect motion simultaneously, the system attempts YOLO inference on all of them. Without inference queue depth limits, this can cause transient CPU saturation. The Python pipeline's `DropIfFullQueue` (maxsize=5 for motion queue) provides backpressure.

---

## Alternatives Considered

### 1. Run YOLO on Every Frame (No Motion Gate)

Execute YOLO inference on every captured frame at full FPS.

**Pros**: Maximum detection sensitivity. No missed events. Simpler pipeline (no motion detection stage).

**Cons**: 10-40× higher CPU usage. Not viable for multi-camera CPU-only deployments. Would require GPU inference for any deployment with >3 cameras.

**Rejected because**: The target hardware (edge devices, ≤10 cameras) cannot sustain full-rate YOLO inference.

### 2. Fixed-Interval Detection (Skip Frames)

Run YOLO on every Nth frame regardless of motion.

```python
if frame_count % skip_interval == 0:
    run_yolo(frame)
```

**Pros**: Simplest implementation. Predictable CPU usage. No background model to maintain.

**Cons**: Wastes CPU on static scenes. Misses fast events between detection frames. No adaptivity — can't increase detection rate during active periods.

**Rejected because**: Motion gating provides strictly better CPU efficiency (only runs when needed) with equivalent or better detection quality.

### 3. Optical Flow-Based Detection

Use dense optical flow (e.g., Farneback) instead of background subtraction.

**Pros**: Detects movement direction and speed. More information per frame. Can distinguish approaching vs receding objects.

**Cons**: 10-50× more expensive than background subtraction (~50ms per frame vs ~2ms). Comparable cost to YOLO itself. Defeats the purpose of a cheap pre-filter.

**Rejected because**: The computational cost is too high for a motion gate. If we're spending 50ms on motion detection, we might as well run YOLO.

### 4. Temporal Difference (Frame Differencing)

Compare consecutive frames using absolute difference instead of background subtraction.

```python
diff = cv2.absdiff(prev_frame, current_frame)
thresholded = cv2.threshold(diff, 25, 255, cv2.THRESH_BINARY)
```

**Pros**: Simpler than MOG2. No background model to train. No warmup period. Lower memory footprint.

**Cons**: No adaptivity to gradual lighting changes. Highly sensitive to camera vibration. Cannot distinguish moving objects from moving camera. No concept of "background" — only detects frame-to-frame delta.

**Rejected because**: MOG2's adaptive background model is essential for outdoor cameras with lighting changes and long-term operation.

### 5. Hardware Motion Detection (Camera-Side)

Use IP camera built-in motion detection (ONVIF motion events, camera-side analytics).

**Pros**: Zero server CPU cost. Camera hardware is purpose-built for motion detection. Can trigger server-side processing only when needed.

**Cons**: Not all cameras support ONVIF motion events. Camera-side detection quality varies widely. Requires ONVIF protocol integration. Detection configuration is camera-specific. Cannot apply custom zones or sensitivity from the server.

**Status**: Considered as a future enhancement. Could supplement server-side motion gating for supported cameras, allowing the server to skip frame processing entirely until the camera signals motion.

---

## References

- `server/src/detection/optimizedMotionDetection.ts` — Legacy motion detection (1103 lines)
- `server/src/detection/optimizedMotionDetection.ts:28-54` — Motion settings interface
- `opencv-service/rtsp_ingestion/frame_pipeline.py:44-78` — Python MotionGate class
- `opencv-service/rtsp_ingestion/config.py:24-27` — MOG2 configuration constants
- `server/src/detection/consolidatedDetectionService.ts` — Detection service that YOLO results flow through
- `server/src/config/detectionConfig.ts` — Default detection configuration
- `docs/architecture/ADR-003-detection-pipeline-redesign.md` — Pipeline redesign that formalized the motion gate architecture
