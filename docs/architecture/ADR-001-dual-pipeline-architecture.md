# ADR-001: Dual-Pipeline Architecture (Legacy + Python-Native)

**Status**: Accepted
**Date**: 2026-05-29
**Deciders**: Engineering team

---

## Context

SentryVision evolved through two distinct architectural eras:

### Legacy Pipeline (Node.js-Driven)

```text
RTSP Camera
    ↓
Node.js FFmpeg subprocess (rtspManager.ts)
    ↓ JPEG stdout pipe
JPEG boundary detection in Node.js
    ↓ Buffer
OptimizedMotionDetector (Node.js)
    ↓ motion-gated frames via HTTP POST
Python Flask service (port 8084)
    ↓ YOLO + face_recognition
HTTP response → Node.js persistence
```

Node.js owned RTSP ingestion, frame timing, and detection orchestration. Python was a stateless inference endpoint called over HTTP.

### Python-Native Pipeline

```text
RTSP Camera
    ↓
Python FFmpegReader (dedicated thread, raw BGR24 pipe)
    ↓ numpy ndarray
MotionGate (MOG2, in-process)
    ↓ motion frames only
InProcessYOLO (cv2.dnn, YOLOv8n > YOLOv5n > YOLOv4-tiny)
    ↓ detections
ByteTracker (temporal tracking)
    ↓ track lifecycle events
Face Recognition (new tracks only, identity cache TTL=30s)
    ↓
WebSocket Publisher → Node.js gateway (port 9090)
```

Python now owns the entire pixel pipeline — ingestion, motion gating, inference, tracking, and recognition. Node.js receives structured events and frames over WebSocket, handling persistence, frontend relay, and alerting.

### The Coexistence Problem

Both pipelines are production-tested but have different reliability profiles. The legacy pipeline has months of runtime; the Python pipeline is newer and still maturing. Operators need the ability to:

1. Run either pipeline per-camera.
2. Gradually migrate cameras without a big-bang cutover.
3. Fall back to legacy if the Python pipeline has issues.

### Configuration Surface

The system supports three pipeline modes via `config.pipeline.mode` (`server/src/config/index.ts:209-212`):

| Mode | Behavior |
|------|----------|
| `legacy` | Node.js owns all RTSP, Python is HTTP inference only |
| `dual` | Default — both pipelines available, per-camera selection |
| `python-only` | Python owns all RTSP, Node.js never spawns FFmpeg |

Per-camera override via `pythonEnabled` flag (`server/src/config/index.ts:188`):

```typescript
const pythonEnabled = cameraConfig?.pythonEnabled ?? (config.pipeline.mode === 'python-only');
```

When `pythonEnabled` is true, `startStream()` in `rtspManager.ts:341-344` skips FFmpeg spawn entirely:

```typescript
if (pythonEnabled) {
    console.log(`[StreamManager] ${cameraId}: Python manages RTSP (pipeline=${config.pipeline.mode})`);
    camera.isActive = true;
    return true;
}
```

The Node.js gateway connects to Python via `PythonWsClient` (`server/src/index.ts:354-356`), subscribing to cameras based on the same `pythonEnabled` filter:

```typescript
const cameras = config.cameras.filter(c => {
    const perCamera = c.pythonEnabled;
    return perCamera === true || (perCamera === undefined && config.pipeline.mode !== 'legacy');
});
cameras.forEach(cam => pythonWsClient.subscribe(cam.id));
```

---

## Decision

Support both pipelines simultaneously with a three-mode configuration system and per-camera overrides. The `PipelineConfig` interface (`server/src/config/index.ts:209-212`) defines:

```typescript
interface PipelineConfig {
    mode: 'legacy' | 'dual' | 'python-only';
    pythonWsUrl: string;
}
```

Mode is determined by `PIPELINE_MODE` environment variable, defaulting to `legacy`:

```typescript
mode: (process.env.PIPELINE_MODE as PipelineConfig['mode']) || 'legacy',
```

---

## Consequences

### Positive

- **Zero-downtime migration**: Cameras can be migrated one at a time by flipping `pythonEnabled` in `cameras.json` without restarting other cameras.
- **Risk isolation**: A failure in the Python pipeline does not affect legacy cameras, and vice versa.
- **A/B validation**: Operators can run the same camera through both pipelines and compare detection quality.
- **Backward compatibility**: Existing deployments that don't set `PIPELINE_MODE` continue operating in legacy mode.

### Negative

- **Doubled frame relay paths**: Node.js receives frames from two sources — its own FFmpeg stdout pipe and the Python WebSocket client. Both converge on the same Socket.io emission path (`io.to(room).emit('frame', ...)`) but through different code paths (`rtspManager.ts:491` vs `index.ts:362`).
- **Duplicated reconnection logic**: FFmpeg reconnection in Node.js (`rtspManager.ts:429-437`, exponential backoff, max 5 retries) is separate from Python's FFmpegReader (`ffmpeg_reader.py:157-163`, exponential backoff 1s→30s, infinite retries). Operators must monitor and tune both.
- **Doubled detection flows**: The legacy pipeline uses `OptimizedMotionDetector` + HTTP calls to Python Flask. The Python pipeline uses `MotionGate` + `InProcessYOLO` + `ByteTracker` entirely in-process. Event schemas are similar but not identical.
- **Configuration complexity**: Operators must understand the `mode` / `pythonEnabled` matrix and ensure consistency. A camera with `pythonEnabled: true` in `legacy` mode creates ambiguity (resolved by the `??` operator, but not obvious).
- **Testing burden**: Changes to streaming, detection, or frame relay must be validated against both pipelines.

### Risks

- **State divergence**: If both pipelines run for the same camera simultaneously (misconfiguration), duplicate detection events and frames could be emitted. The current code does not explicitly prevent this.
- **Monitoring complexity**: Health checks, metrics, and alerting must cover two different process models (Node.js child processes vs Python threads).

---

## Alternatives Considered

### 1. Big-Bang Migration to Python-Only

Remove the legacy pipeline entirely and force all cameras onto the Python-native pipeline.

**Rejected because**: Insufficient production validation of the Python pipeline. A phased migration with fallback is operationally safer.

### 2. Feature Flag Service

Use a dedicated feature flag service (e.g., LaunchDarkly, Unleash) to control pipeline selection at runtime.

**Rejected because**: Adds infrastructure dependency for a decision that changes infrequently (per deployment, not per request). The `cameras.json` + env var approach is sufficient.

### 3. Node.js Remains Pixel Owner

Keep Node.js as the RTSP owner and have Python only handle inference (current legacy model), but optimize the HTTP communication.

**Rejected because**: The Python-native pipeline eliminates the JPEG encode/decode round-trip between Node.js and Python, which is the single largest CPU waste in the legacy architecture (documented in ADR-003).

---

## References

- `server/src/streams/rtspManager.ts` — Legacy FFmpeg management and pipeline mode check
- `server/src/config/index.ts:188-212` — `PipelineConfig`, `pythonEnabled`, mode resolution
- `server/src/index.ts:352-446` — `PythonWsClient` initialization and event relay
- `opencv-service/rtsp_ingestion/frame_pipeline.py` — Python-native pipeline
- `docs/architecture/ADR-003-detection-pipeline-redesign.md` — Detection pipeline redesign rationale
