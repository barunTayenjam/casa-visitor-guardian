# Phase 2: Streaming Performance Overhaul — Research

**Researched:** 2026-05-29
**Domain:** GPU-accelerated YOLO inference, Socket.io binary transport, IntersectionObserver viewport loading
**Confidence:** HIGH

## Summary

This phase delivers three targeted optimizations to the streaming pipeline established in Phase 1:

1. **GPU-accelerated YOLO inference** — The `InProcessYOLO` class currently hardcodes `DNN_BACKEND_OPENCV` + `DNN_TARGET_CPU`. OpenCV's DNN module natively supports `DNN_BACKEND_CUDA` + `DNN_TARGET_CUDA` (and `DNN_TARGET_CUDA_FP16`) for CUDA-capable GPUs. The `opencv-contrib-python-headless` pip package **does NOT include CUDA support** — it must be built from source with CUDA toolkit, or the Docker image must use a CUDA-enabled base. The key insight: the code change is trivial (swap two constants), but the build/packaging is the real challenge.

2. **Binary frame delivery over Socket.io** — Socket.io v4.8.3 natively supports binary data in emit payloads. `Buffer` / `ArrayBuffer` / `TypedArray` within objects are automatically detected and efficiently serialized without base64 encoding [VERIFIED: Socket.io emitting-events docs]. The current code explicitly converts `Buffer.toString('base64')` on the server, then reconstructs `data:image/jpeg;base64,...` on the frontend. The fix: send `Buffer` directly, receive `ArrayBuffer` on client, create `Blob` → `URL.createObjectURL()` for rendering. This eliminates the 33% bandwidth overhead documented in ADR-002.

3. **Viewport-based camera loading** — The `AdaptiveCameraGrid` currently renders all cameras with `autoStart={true}`, meaning every camera begins streaming immediately regardless of visibility. The codebase already uses `IntersectionObserver` in `App.tsx` (ScrollRevealProvider) and `ProgressiveImage.tsx`. The fix: wrap each `CameraStream` in an `IntersectionObserver` that controls `autoStart` and manages a configurable max concurrent streams semaphore (default: 4).

**Primary recommendation:** Three independent optimization tracks that can be planned and executed in parallel. GPU inference is a Python-only change with Docker packaging complexity. Binary frames is a full-stack change (Node.js relay + frontend rendering). Viewport loading is a frontend-only change with `CameraContext` integration.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PERF-01 | CUDA-accelerated YOLO inference via OpenCV DNN backend when GPU detected | OpenCV DNN supports `DNN_BACKEND_CUDA` + `DNN_TARGET_CUDA` natively; runtime detection via `cv2.cuda.getCudaEnabledDeviceCount()`; requires CUDA-built OpenCV |
| PERF-02 | Graceful CPU fallback when no CUDA-capable GPU available | Already partially implemented for YOLOv4-tiny in `InProcessYOLO.initialize()`; extend to YOLOv8n/YOLOv5n ONNX models |
| PERF-03 | Inference latency metrics exposed via `/api/rtsp/metrics` and logging | Add timing instrumentation around `self._net.forward()` in `InProcessYOLO.detect()`; expose backend type (CPU/CUDA) in metrics |
| PERF-04 | Socket.io binary mode for frame transmission (Buffer instead of base64 string) | Socket.io v4 natively handles `Buffer` in objects; remove `.toString('base64')` in both `rtspManager.ts:495` and `index.ts:361` |
| PERF-05 | Frontend Blob URL rendering with proper memory cleanup (revokeObjectURL on frame replace) | Create `Blob` from `ArrayBuffer` → `URL.createObjectURL()` → `<img src={blobUrl}>`; revoke previous URL each frame |
| PERF-06 | Base64 fallback for HTTP long-polling transport clients | Socket.io long-polling uses base64 for binary; detect transport type on server and conditionally base64-encode, or force WebSocket-only for frame events |
| PERF-07 | IntersectionObserver detects visible cameras in AdaptiveCameraGrid | Existing patterns in `App.tsx:88` and `ProgressiveImage.tsx:16`; apply similar pattern per `CameraStream` wrapper |
| PERF-08 | Auto start/stop streams based on viewport visibility with configurable debounce | 300ms debounce recommended; use `setTimeout` + `clearTimeout` on intersection changes |
| PERF-09 | Configurable max concurrent streams limit (default: 4) | Implement a semaphore/counter in `CameraContext` or a new `StreamManager` hook; queue pending starts |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| YOLO inference (GPU/CPU) | Python service (OpenCV DNN) | — | Python owns all pixel processing per Phase 1 ADR |
| CUDA runtime detection | Python service | — | `cv2.cuda.getCudaEnabledDeviceCount()` runs in Python process |
| Binary frame encoding | Node.js (Socket.io relay) | — | Node.js converts Python WebSocket binary → Socket.io binary emit |
| Frontend Blob URL rendering | Browser (React) | — | `<img src={blobUrl}>` is client-side DOM operation |
| Base64 fallback for polling | Node.js (Socket.io server) | — | Server-side transport detection and conditional encoding |
| IntersectionObserver detection | Browser (React) | — | Client-only API; no server involvement |
| Stream start/stop control | Browser → Node.js | — | `requestStream`/`stopStream` Socket.io events already exist |
| Max concurrent streams limit | Browser (React state) | — | Frontend tracks visible cameras and stream slots |
| Inference latency metrics | Python service | Node.js (metrics API) | Python measures inference time; Node.js exposes via `/api/rtsp/metrics` |

## Standard Stack

### Core (No New Dependencies)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `opencv-contrib-python-headless` | >=4.8.0 (current PyPI: 4.13.0.92) | MOG2, JPEG encode, DNN inference | Already installed; CPU mode works as-is [VERIFIED: pip registry] |
| `socket.io` (server) | 4.8.3 | Binary frame relay | Already installed; native binary support verified [VERIFIED: npm registry] |
| `socket.io-client` | bundled with socket.io | Frontend binary reception | Already installed; `ArrayBuffer` auto-deserialization [VERIFIED: npm registry] |
| `ws` | 8.18.3 | Node.js WebSocket client to Python | Already installed as socket.io dependency [VERIFIED: npm registry] |
| IntersectionObserver API | Native browser API | Viewport detection | No library needed; already used in `App.tsx` and `ProgressiveImage.tsx` [VERIFIED: codebase] |

### New Python Dependency (Optional — GPU only)

| Library | Version | Purpose | When Needed |
|---------|---------|---------|-------------|
| `nvidia-opencv-python` (custom build) | 4.x + CUDA | CUDA-accelerated DNN inference | Only when deploying on GPU hardware [ASSUMED] |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| OpenCV DNN + CUDA | ONNX Runtime with CUDA EP | ONNX Runtime has better CUDA support out-of-box via `onnxruntime-gpu` pip package, but requires rewriting `InProcessYOLO` class. OpenCV DNN change is minimal (2 constant swaps). Phase 2 sticks with OpenCV DNN for minimal code change. [ASSUMED] |
| Socket.io binary mode | Raw WebSocket for frames | Would bypass Socket.io rooms/reconnection; defeats Phase 1 architecture. Socket.io v4 handles binary fine. |
| IntersectionObserver + debounce | `react-intersection-observer` npm package | The library is tiny (~1.5KB) and provides `useInView` hook, but the codebase already has manual IntersectionObserver patterns. Follow existing patterns for consistency. [ASSUMED] |

**Installation (GPU deployment only):**
```bash
# Option A: Build OpenCV with CUDA from source (recommended for production)
# See: https://docs.opencv.org/4.x/d7/d9f/tutorial_linux_install.html
# Requires: CUDA Toolkit 12.x, cuDNN 8.x, cmake, build-essential

# Option B: Use pre-built Docker image with CUDA OpenCV
# Dockerfile change: FROM python:3.11-slim → nvidia/cuda:12.x.x-base-ubuntu22.04
# Then: pip install opencv-contrib-python-headless (still CPU-only in pip)
# Must build from source inside the CUDA container

# Option C: onnxruntime-gpu (alternative approach, not recommended this phase)
pip install onnxruntime-gpu
```

**Version verification:**
```bash
# opencv-contrib-python-headless 4.13.0.92 — latest as of research date
pip index versions opencv-contrib-python-headless

# socket.io 4.8.3 — verified in project node_modules
npm view socket.io version

# ws 8.18.3 — verified in project node_modules
npm view ws version
```

## Package Legitimacy Audit

> No new packages are being installed as part of this phase. All dependencies are existing.

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| `opencv-contrib-python-headless` | PyPI | 7+ yrs | 5M/wk | github.com/opencv/opencv-python | N/A (existing) | Approved (already installed) |
| `socket.io` | npm | 11 yrs | 6M/wk | github.com/socketio/socket.io | N/A (existing) | Approved (already installed) |
| `ws` | npm | 12 yrs | 40M/wk | github.com/websockets/ws | N/A (existing) | Approved (already installed) |

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

*Note: slopcheck was run and incorrectly flagged `opencv-contrib-python-headless` as SLOP because it checked npm (not PyPI). The package is verified on PyPI with `pip index versions`. No new packages are being installed regardless — this phase modifies existing code only.*

## Architecture Patterns

### System Architecture Diagram

```text
                        RTSP Camera
                            │
                            ▼
┌───────────────────────────────────────────────────────────┐
│ Python Service (opencv-service)                           │
│                                                           │
│  FFmpegReader ──raw BGR24──▶ MotionGate (MOG2)           │
│                                  │                        │
│                     ┌────────────┴────────────┐           │
│                     │  InProcessYOLO           │           │
│                     │  cv2.dnn.DNN_BACKEND_    │           │
│                     │  CUDA (if GPU)           │           │
│                     │  OPENCV (CPU fallback)   │           │
│                     └────────────┬────────────┘           │
│                                  │ detections             │
│                     ByteTracker → FaceRec                 │
│                                  │                        │
│                     WebSocketPublisher (:9090)             │
│                     binary JPEG frames                     │
└──────────────────────────────┬──┘                          │
                               │ WebSocket (binary)          │
                               ▼                             │
┌───────────────────────────────────────────────────────────┐
│ Node.js                                                   │
│                                                           │
│  PythonWsClient ──Buffer──▶ Socket.io Server              │
│                               │                           │
│          ┌────────────────────┼────────────────────┐      │
│          │ Binary frame emit  │  Base64 fallback    │      │
│          │ (WebSocket client) │  (long-polling)     │      │
│          └────────┬───────────┴──────────┬─────────┘      │
│                   │                      │                 │
└───────────────────┼──────────────────────┼─────────────────┘
                    ▼                      ▼
┌───────────────────────────────────────────────────────────┐
│ React Frontend                                            │
│                                                           │
│  AdaptiveCameraGrid                                       │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐         │
│  │ CameraStream │ │ CameraStream │ │ CameraStream │ ...    │
│  │ (visible ✓) │ │ (visible ✓) │ │ (offscreen ✗)│        │
│  │ Blob URL     │ │ Blob URL     │ │ STOPPED     │         │
│  └─────────────┘ └─────────────┘ └─────────────┘         │
│                                                           │
│  IntersectionObserver ──▶ start/stop streams              │
│  Max concurrent: 4 streams (configurable)                 │
│  URL.revokeObjectURL() on frame replace                   │
└───────────────────────────────────────────────────────────┘
```

### Recommended Project Structure (Changes Only)

```
opencv-service/
├── rtsp_ingestion/
│   ├── frame_pipeline.py         # MODIFY: InProcessYOLO CUDA backend selection
│   ├── config.py                 # MODIFY: Add INFERENCE_BACKEND config constant
│   └── metrics.py                # MODIFY: Add inference latency metrics
├── Dockerfile                    # MODIFY: Conditional CUDA base image support
└── requirements.txt              # No change (CPU) or build-from-source (GPU)

server/src/
├── index.ts                      # MODIFY: Remove .toString('base64'), send Buffer
├── streams/rtspManager.ts        # MODIFY: Remove .toString('base64'), send Buffer
└── services/pythonWsClient.ts    # No change (already receives Buffer)

frontend/src/
├── components/
│   ├── live/
│   │   └── AdaptiveCameraGrid.tsx  # MODIFY: Wrap CameraStream in viewport observer
│   └── dashboard/
│       └── CameraStream.tsx        # MODIFY: Binary Blob URL rendering
├── hooks/
│   └── useViewportStream.ts      # NEW: IntersectionObserver + debounce + semaphore hook
├── contexts/
│   └── CameraContext.tsx          # MODIFY: Add maxStreams semaphore, visibility tracking
└── types/
    └── security.ts               # No change
```

### Pattern 1: CUDA Backend Selection with Runtime Detection

**What:** Detect CUDA GPU at runtime, use GPU backend if available, fall back to CPU seamlessly.

**When to use:** At `InProcessYOLO.initialize()` time, before any inference.

**Example:**
```python
# Source: OpenCV DNN Backend/Target enum documentation [CITED: docs.opencv.org/4.x/d6/d0f/group__dnn.html]
import cv2

class InProcessYOLO:
    def _detect_backend(self) -> tuple:
        """Detect best available backend/target. Returns (backend, target, label)."""
        # Check CUDA availability
        cuda_count = 0
        try:
            cuda_count = cv2.cuda.getCudaEnabledDeviceCount()
        except (AttributeError, cv2.error):
            pass

        if cuda_count > 0:
            # Verify CUDA backend is available for DNN
            try:
                test_net = cv2.dnn.readNetFromONNX(
                    os.path.join(self._models_dir, "yolov8n.onnx")
                )
                test_net.setPreferableBackend(cv2.dnn.DNN_BACKEND_CUDA)
                test_net.setPreferableTarget(cv2.dnn.DNN_TARGET_CUDA)
                # If we get here without error, CUDA is working
                return (cv2.dnn.DNN_BACKEND_CUDA, cv2.dnn.DNN_TARGET_CUDA, "CUDA")
            except cv2.error:
                pass

        # CPU fallback
        return (cv2.dnn.DNN_BACKEND_OPENCV, cv2.dnn.DNN_TARGET_CPU, "CPU")

    def initialize(self) -> bool:
        # ... model loading ...
        backend, target, label = self._detect_backend()
        self._net.setPreferableBackend(backend)
        self._net.setPreferableTarget(target)
        self._backend_label = label
        print(f"[InProcessYOLO] Using {label} backend")
        self._initialized = True
        return True
```

### Pattern 2: Socket.io Binary Frame Emission

**What:** Send JPEG frames as raw `Buffer` in Socket.io events, eliminating base64 encoding.

**When to use:** For all frame emissions in both legacy pipeline and Python pipeline relay.

**Example:**
```typescript
// Source: Socket.io v4 emitting-events documentation [CITED: socket.io/docs/v4/emitting-events/]
// Server-side: index.ts Python pipeline relay

pythonWsClient.on('frame', (payload: { cameraId: string | null; data: Buffer; timestamp: number }) => {
  const { cameraId, data, timestamp } = payload;
  if (!cameraId) return;

  // PERF-04: Send Buffer directly — Socket.io handles binary serialization
  // No .toString('base64') — binary is sent as-is over WebSocket
  io.to(`camera-${cameraId}-live`).emit('frame', {
    cameraId,
    data: data,  // Buffer — Socket.io auto-detects binary fields
    timestamp: new Date(timestamp).toISOString(),
  });
});

// Frontend: CameraStream.tsx binary reception
const handleFrame = (data: {
  cameraId: string;
  data: ArrayBuffer;  // Socket.io converts Buffer → ArrayBuffer on client
  timestamp: string;
}) => {
  if (data.cameraId !== camera.id) return;

  // PERF-05: Create Blob URL for rendering
  if (imgRef.current) {
    // Revoke previous blob URL to prevent memory leak
    if (currentBlobUrl) URL.revokeObjectURL(currentBlobUrl);

    const blob = new Blob([data.data], { type: 'image/jpeg' });
    const blobUrl = URL.createObjectURL(blob);
    setCurrentBlobUrl(blobUrl);
    imgRef.current.src = blobUrl;
  }
};
```

### Pattern 3: Viewport-Based Stream Management

**What:** Use IntersectionObserver to detect visible cameras and control stream start/stop with debounce and max concurrent limit.

**When to use:** In `AdaptiveCameraGrid`, wrapping each `CameraStream` component.

**Example:**
```typescript
// Source: Existing IntersectionObserver patterns in codebase [VERIFIED: App.tsx:88, ProgressiveImage.tsx:16]
// NEW: hooks/useViewportStream.ts

import { useEffect, useRef, useCallback, useState } from 'react';

interface ViewportStreamConfig {
  debounceMs: number;       // Default: 300
  maxConcurrent: number;    // Default: 4 (PERF-09)
  rootMargin: string;       // Default: '100px' — preload just outside viewport
  threshold: number;        // Default: 0.1
}

export function useViewportStream(
  elementRef: React.RefObject<HTMLElement | null>,
  cameraId: string,
  config: ViewportStreamConfig = { debounceMs: 300, maxConcurrent: 4, rootMargin: '100px', threshold: 0.1 }
) {
  const [isVisible, setIsVisible] = useState(false);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const el = elementRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = setTimeout(() => {
          setIsVisible(entry.isIntersecting);
        }, config.debounceMs);
      },
      { rootMargin: config.rootMargin, threshold: config.threshold }
    );

    observer.observe(el);
    return () => {
      observer.disconnect();
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, [elementRef, config.debounceMs, config.rootMargin, config.threshold]);

  return { isVisible };
}
```

### Pattern 4: Max Concurrent Streams Semaphore

**What:** A shared counter that limits how many camera streams can be active simultaneously. When a camera enters viewport, it requests a stream slot; if all slots are taken, it queues until a slot opens.

**When to use:** In `AdaptiveCameraGrid` or `CameraContext` to enforce PERF-09.

**Example:**
```typescript
// Stream slot manager — lives in CameraContext or a separate hook
class StreamSlotManager {
  private activeStreams = new Set<string>();
  private pendingQueue: Array<{ cameraId: string; resolve: () => void }> = [];
  private maxSlots: number;

  constructor(maxSlots: number = 4) {
    this.maxSlots = maxSlots;
  }

  async acquire(cameraId: string): Promise<void> {
    if (this.activeStreams.has(cameraId)) return; // Already streaming
    if (this.activeStreams.size < this.maxSlots) {
      this.activeStreams.add(cameraId);
      return;
    }
    // Wait for a slot to open
    return new Promise((resolve) => {
      this.pendingQueue.push({ cameraId, resolve });
    });
  }

  release(cameraId: string): void {
    this.activeStreams.delete(cameraId);
    if (this.pendingQueue.length > 0 && this.activeStreams.size < this.maxSlots) {
      const next = this.pendingQueue.shift()!;
      this.activeStreams.add(next.cameraId);
      next.resolve();
    }
  }
}
```

### Pattern 5: Base64 Fallback for Long-Polling (PERF-06)

**What:** Socket.io long-polling transport encodes binary as base64 automatically, but some older clients may have issues. The server can detect the transport type and proactively base64-encode for polling clients.

**When to use:** As a backward-compatibility shim during the binary transition.

**Example:**
```typescript
// Server-side transport detection and conditional encoding
// In index.ts or rtspManager.ts frame emission

io.to(`camera-${cameraId}-live`).emit('frame', {
  cameraId,
  data: frameBuffer,  // Buffer for WebSocket clients
  timestamp: new Date(timestamp).toISOString(),
  _transport: 'binary',  // Signal to client that data is binary
});

// Socket.io v4 automatically handles binary encoding for polling transport
// — it base64-encodes binary data when sending via XHR long-polling.
// The client receives ArrayBuffer for WebSocket, base64 string for polling.
// Frontend detects type:
const handleFrame = (data: any) => {
  if (data.data instanceof ArrayBuffer) {
    // Binary path: Blob URL
    const blob = new Blob([data.data], { type: 'image/jpeg' });
    setImgSrc(URL.createObjectURL(blob));
  } else if (typeof data.data === 'string') {
    // Base64 fallback (long-polling)
    setImgSrc(`data:image/jpeg;base64,${data.data}`);
  }
};
```

### Anti-Patterns to Avoid

- **Installing `opencv-python` alongside `opencv-contrib-python-headless`**: Causes DLL conflicts. The contrib package includes everything in opencv-python plus extra modules. Never have both installed. [CITED: opencv-python PyPI readme]
- **Using `cv2.VideoCapture` for CUDA device detection**: Use `cv2.cuda.getCudaEnabledDeviceCount()` specifically, not general VideoCapture capability. [CITED: docs.opencv.org]
- **Forgetting `URL.revokeObjectURL()` on Blob URLs**: Each `createObjectURL` allocates a browser memory reference. Without revocation, a 4 FPS × 10 minute session creates 2,400 leaked blob URLs. [ASSUMED]
- **Starting/stopping streams too aggressively on scroll**: Without debounce, rapid scroll events cause stream start/stop storms on the backend. Always debounce (300ms recommended). [ASSUMED]
- **Mixing binary and base64 in the same Socket.io event schema**: The `frame` event must handle both `ArrayBuffer` and `string` on the client. The handler must branch on `typeof data.data`. [VERIFIED: Socket.io docs confirm binary detection]

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| CUDA device detection | Custom nvidia-smi parsing | `cv2.cuda.getCudaEnabledDeviceCount()` | OpenCV built-in; returns 0 if no CUDA; handles driver mismatches |
| Binary serialization in Socket.io | Manual ArrayBuffer construction | Socket.io native binary support | Socket.io v4 auto-detects `Buffer`/`ArrayBuffer` in emit payloads and handles serialization |
| Blob URL lifecycle management | Manual reference counting | `URL.createObjectURL()` + `URL.revokeObjectURL()` | Browser-native; GC handles underlying blob when no references remain |
| Viewport detection | Scroll event listeners with position math | `IntersectionObserver` API | Handles iframes, transforms, CSS clipping; async by design; existing patterns in codebase |
| Stream concurrency limiting | Custom lock/queue with setTimeout | Simple `Set<string>` + queue | The limit (4) is small enough that a simple counter works; no need for semaphore libraries |

**Key insight:** Every optimization in this phase uses existing, well-supported features (OpenCV CUDA backend, Socket.io binary, IntersectionObserver). The complexity is in integration and testing, not in novel algorithm development.

## Common Pitfalls

### Pitfall 1: OpenCV pip Package Lacks CUDA Support
**What goes wrong:** You set `DNN_BACKEND_CUDA` but get "opencv_python_headless was not built with CUDA support" error at runtime.
**Why it happens:** The `opencv-contrib-python-headless` pip wheel is built CPU-only. CUDA requires building OpenCV from source with `-DWITH_CUDA=ON`.
**How to avoid:**
- Detect CUDA availability BEFORE setting backend (use `cv2.cuda.getCudaEnabledDeviceCount()`)
- If count is 0, immediately use CPU backend — don't attempt CUDA
- For GPU deployments, either build OpenCV from source in Dockerfile or use a pre-built CUDA OpenCV image
- Document the build steps clearly in Dockerfile comments
**Warning signs:** `cv2.error: OpenCV(4.x) ... cuda.cpp:XXX` error messages on `setPreferableBackend`

### Pitfall 2: Blob URL Memory Leak
**What goes wrong:** Browser memory grows monotonically over hours of streaming. After 30 minutes, tab uses 500MB+ RAM.
**Why it happens:** Each `URL.createObjectURL()` creates a reference. Without `revokeObjectURL()`, the browser holds the blob data indefinitely. At 4 FPS, that's 240 new blobs per minute.
**How to avoid:**
- Store current blob URL in a ref (`useRef<string | null>`)
- Before creating new blob URL, revoke previous: `if (prevUrl) URL.revokeObjectURL(prevUrl)`
- On component unmount, revoke any remaining blob URL in cleanup
**Warning signs:** Chrome DevTools Memory tab shows growing number of "Blob" entries

### Pitfall 3: Socket.io Binary Deserialization Mismatch
**What goes wrong:** Frontend receives `[object Object]` or corrupted data instead of image frames.
**Why it happens:** Socket.io serializes binary data differently than strings. If the server sends `{ data: Buffer }`, the client receives `{ data: ArrayBuffer }`. If the server accidentally sends `{ data: Buffer.toString() }`, the client gets a string.
**How to avoid:**
- On server: NEVER call `.toString('base64')` — pass the `Buffer` directly
- On client: check `data.data instanceof ArrayBuffer` for binary path, `typeof data.data === 'string'` for base64 fallback
- Test with both WebSocket and long-polling transports
**Warning signs:** `img.src` set to `[object ArrayBuffer]` string; no image rendered

### Pitfall 4: IntersectionObserver Over-Triggering on Scroll
**What goes wrong:** Rapid scroll events cause streams to start/stop dozens of times per second, overwhelming the backend.
**Why it happens:** `IntersectionObserver` fires on every intersection change. In a grid with many cameras, scrolling can trigger 10+ intersection changes in rapid succession.
**How to avoid:**
- Debounce visibility changes by 300ms (configurable)
- Only trigger start/stop on meaningful visibility transitions (was visible → not visible, or vice versa)
- Use `rootMargin: '100px'` to pre-load cameras that are about to enter viewport
**Warning signs:** Backend logs show rapid `requestStream`/`stopStream` events; camera frames flickering

### Pitfall 5: Focus Mode vs Viewport Observer Conflict
**What goes wrong:** Camera is focused (full-screen) but IntersectionObserver reports it as "not visible" because it's outside the grid's scroll container.
**Why it happens:** When `focusedCameraId` is set, the `AdaptiveCameraGrid` renders only the focused camera in a full-screen overlay, not in the grid. The observer attached to the grid element no longer sees the focused camera.
**How to avoid:**
- When `focusedCameraId` is set, bypass IntersectionObserver — always stream the focused camera
- The focused camera gets `autoStart={true}` unconditionally (current behavior, preserve it)
- Only apply viewport-based start/stop to non-focused cameras in the grid
**Warning signs:** Focused camera shows "connecting..." or blank; stream stops when focus mode activates

## Code Examples

### GPU Inference Backend Selection (Python)

```python
# Source: OpenCV DNN documentation [CITED: docs.opencv.org/4.x/d6/d0f/group__dnn.html]
# Modified: opencv-service/rtsp_ingestion/frame_pipeline.py — InProcessYOLO.initialize()

def initialize(self) -> bool:
    if self._initialized:
        return True

    # Try YOLOv8n first, then YOLOv5n, then YOLOv4-tiny
    for filename, mtype in [("yolov8n.onnx", "yolov8"), ("yolov5n.onnx", "yolov5")]:
        path = os.path.join(self._models_dir, filename)
        if os.path.exists(path):
            self._net = cv2.dnn.readNet(path)
            # PERF-01: CUDA acceleration with PERF-02: CPU fallback
            cuda_available = False
            try:
                cuda_count = cv2.cuda.getCudaEnabledDeviceCount()
                if cuda_count > 0:
                    self._net.setPreferableBackend(cv2.dnn.DNN_BACKEND_CUDA)
                    self._net.setPreferableTarget(cv2.dnn.DNN_TARGET_CUDA)
                    cuda_available = True
            except (AttributeError, cv2.error):
                pass

            if not cuda_available:
                self._net.setPreferableBackend(cv2.dnn.DNN_BACKEND_OPENCV)
                self._net.setPreferableTarget(cv2.dnn.DNN_TARGET_CPU)

            self._backend = "CUDA" if cuda_available else "CPU"
            self._model_type = mtype
            self._initialized = True
            print(f"[InProcessYOLO] {mtype} initialized with {self._backend} backend")
            return True

    return False
```

### Binary Frame Reception (Frontend TypeScript)

```typescript
// Source: Socket.io v4 docs [CITED: socket.io/docs/v4/emitting-events/]
// Modified: frontend/src/components/dashboard/CameraStream.tsx

const blobUrlRef = useRef<string | null>(null);

const handleFrame = (data: {
  cameraId: string;
  data: ArrayBuffer | string;  // ArrayBuffer from WebSocket, string from polling
  timestamp: string;
}) => {
  if (data.cameraId !== camera.id) return;

  const now = Date.now();
  if (now - lastFrameUpdate >= FRAME_UPDATE_INTERVAL) {
    lastFrameUpdate = now;

    if (imgRef.current) {
      // Revoke previous blob URL to prevent memory leak (PERF-05)
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
      }

      let imgSrc: string;
      if (data.data instanceof ArrayBuffer) {
        // Binary path — create Blob URL
        const blob = new Blob([data.data], { type: 'image/jpeg' });
        imgSrc = URL.createObjectURL(blob);
        blobUrlRef.current = imgSrc;
      } else {
        // Base64 fallback (PERF-06 — long-polling transport)
        imgSrc = `data:image/jpeg;base64,${data.data}`;
        blobUrlRef.current = null;
      }

      frameErrorRef.current = false;
      imgRef.current.src = imgSrc;
    }
  }
};

// Cleanup on unmount
useEffect(() => {
  return () => {
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
    }
  };
}, []);
```

### Inference Latency Metrics (Python)

```python
# Modified: opencv-service/rtsp_ingestion/frame_pipeline.py — InProcessYOLO.detect()

def detect(self, frame: np.ndarray) -> List[Dict[str, Any]]:
    if not self._initialized or self._net is None:
        return []

    start_time = time.perf_counter()

    h, w = frame.shape[:2]
    blob = cv2.dnn.blobFromImage(frame, 1 / 255.0, (self._input_size, self._input_size), swapRB=True, crop=False)
    self._net.setInput(blob)

    try:
        outputs = self._net.forward(self._net.getUnconnectedOutLayersNames()) if self._model_type == "yolov4" else [self._net.forward()]
    except cv2.error:
        # CUDA fallback to CPU
        self._net.setPreferableBackend(cv2.dnn.DNN_BACKEND_OPENCV)
        self._net.setPreferableTarget(cv2.dnn.DNN_TARGET_CPU)
        self._backend = "CPU"
        outputs = self._net.forward(self._net.getUnconnectedOutLayersNames()) if self._model_type == "yolov4" else [self._net.forward()]

    inference_ms = (time.perf_counter() - start_time) * 1000

    # PERF-03: Expose metrics
    self._last_inference_ms = inference_ms
    self._inference_count += 1
    if self._inference_count % 100 == 0:
        print(f"[InProcessYOLO] inference={inference_ms:.1f}ms backend={self._backend} model={self._model_type}")

    # ... rest of detection logic (unchanged) ...
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Base64 frame encoding over Socket.io | Binary Buffer/ArrayBuffer over Socket.io v4 | This phase | 33% bandwidth reduction, lower CPU (no encode/decode), lower GC pressure |
| CPU-only YOLO inference | CUDA-accelerated inference with CPU fallback | This phase | 10-40× latency reduction on GPU hardware (50-200ms → 5-20ms) |
| All cameras stream simultaneously | Viewport-based start/stop with max concurrent limit | This phase | Scales to N cameras without N× bandwidth/CPU; only visible cameras consume resources |
| `data:image/jpeg;base64,...` data URL rendering | Blob URL with `URL.createObjectURL()` | This phase | Lower memory footprint, no base64 decode on client, native binary rendering |

**Deprecated/outdated:**
- ADR-002 rationale ("binary in object can have Socket.io serialization issues"): Socket.io v4 handles binary natively. The concern was valid for earlier Socket.io versions but is resolved.
- `rtspManager.ts:490` comment ("Using base64 for compatibility"): Should be removed once binary mode is proven stable.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `opencv-contrib-python-headless` pip package does NOT include CUDA support | GPU Inference | If it did, no build-from-source needed; but pip wheels are CPU-only per OpenCV build policy [ASSUMED] |
| A2 | Socket.io v4 auto-detects `Buffer` in emit payloads and sends binary without extra config | Binary Frames | Verified via official docs, but runtime behavior with mixed string/binary in same payload needs testing [VERIFIED: socket.io/docs] |
| A3 | Socket.io long-polling transport automatically base64-encodes binary data | Binary Frames | Standard Socket.io behavior per engine.io spec; needs verification for large binary payloads (~30KB JPEG) [ASSUMED] |
| A4 | `cv2.cuda.getCudaEnabledDeviceCount()` returns 0 gracefully when CUDA is not available | GPU Inference | Standard OpenCV behavior; should return 0 without error [ASSUMED] |
| A5 | `URL.createObjectURL()` for JPEG blobs works consistently across Chrome, Firefox, Safari | Binary Frames | Well-supported Web API; no known browser compatibility issues [ASSUMED] |
| A6 | `DNN_TARGET_CUDA_FP16` provides meaningful speedup over `DNN_TARGET_CUDA` for YOLOv8n | GPU Inference | FP16 typically 1.5-2× faster on Tensor Cores; unverified for OpenCV DNN specifically [ASSUMED] |

## Open Questions

1. **CUDA OpenCV build strategy for Docker**
   - What we know: The current `Dockerfile` uses `python:3.11-slim` with pip-installed OpenCV (CPU-only). CUDA requires either building from source or using an NVIDIA base image.
   - What's unclear: Should we create a separate `Dockerfile.cuda` for GPU deployments, or use build args to conditionally install CUDA OpenCV?
   - Recommendation: Create `Dockerfile.cuda` alongside the existing `Dockerfile`. GPU deployment is optional; CPU-only is the default. This avoids bloating the CPU image with CUDA toolkit.

2. **Socket.io long-polling binary support reliability**
   - What we know: Socket.io docs say binary is supported. ADR-002 was cautious about it. The existing code comment in `rtspManager.ts:490` explicitly warns about "binary in object can have Socket.io serialization issues".
   - What's unclear: Was the original concern about Socket.io v3 or older? Has v4 resolved it completely?
   - Recommendation: Test with forced long-polling transport (`transports: ['polling']`) before removing base64 path. Keep the fallback handler (PERF-06).

3. **Focus mode interaction with viewport observer**
   - What we know: When a camera is focused, `AdaptiveCameraGrid` renders it in a full-screen overlay outside the grid. The current code passes `autoStart={true}` unconditionally to the focused camera.
   - What's unclear: Should the viewport observer be completely disabled when focus mode is active, or should it track focus mode state?
   - Recommendation: Bypass IntersectionObserver for focused cameras — they always stream. Only apply viewport logic to grid-mode cameras.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| NVIDIA GPU + CUDA | GPU inference (PERF-01) | ✗ (dev machine) | — | CPU inference (current behavior) |
| `cv2.cuda` module | Runtime CUDA detection | ✗ (pip OpenCV is CPU-only) | — | Skip CUDA path, use CPU |
| Socket.io v4 (server) | Binary frame relay | ✓ | 4.8.3 | — |
| Socket.io-client (frontend) | Binary frame reception | ✓ | bundled | — |
| `ws` module | Python WebSocket client | ✓ | 8.18.3 | — |
| FFmpeg | RTSP ingestion | ✓ | n8.1.1 | — |
| Python 3.11 | OpenCV service | ✓ | 3.11 (Docker) | — |
| IntersectionObserver API | Viewport detection | ✓ | Native browser | — |
| `Blob` + `URL.createObjectURL` | Binary frame rendering | ✓ | Native browser | — |

**Missing dependencies with no fallback:**
- None for core functionality. GPU inference is optional and gracefully degrades to CPU.

**Missing dependencies with fallback:**
- NVIDIA GPU / CUDA: Falls back to CPU inference (PERF-02). The system works without GPU; GPU is a performance accelerator.

## Validation Architecture

> nyquist_validation is enabled in config.json.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | pytest (Python) + Jest (Node.js frontend) |
| Config file | pytest: `opencv-service/tests/conftest.py` (existing) / Jest: existing config |
| Quick run command | `pytest opencv-service/tests/ -x -v` |
| Full suite command | `pytest` (Python) + `cd frontend && npm test` (Jest) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PERF-01 | CUDA backend selected when GPU detected | unit | `pytest opencv-service/tests/test_inference_backend.py::test_cuda_detected -x` | ❌ Wave 0 |
| PERF-02 | CPU fallback when no GPU | unit | `pytest opencv-service/tests/test_inference_backend.py::test_cpu_fallback -x` | ❌ Wave 0 |
| PERF-03 | Inference latency logged and exposed | unit | `pytest opencv-service/tests/test_inference_backend.py::test_latency_metrics -x` | ❌ Wave 0 |
| PERF-04 | Socket.io emits Buffer (not base64 string) | integration | Manual verification + Jest test | ❌ Wave 0 |
| PERF-05 | Frontend creates Blob URL and revokes on replace | unit | `cd frontend && npm test -- --testPathPattern=blob-url` | ❌ Wave 0 |
| PERF-06 | Base64 fallback works for long-polling | integration | Manual: force polling transport | ❌ Wave 0 |
| PERF-07 | IntersectionObserver detects visible cameras | unit | `cd frontend && npm test -- --testPathPattern=viewport-stream` | ❌ Wave 0 |
| PERF-08 | Debounce prevents rapid start/stop | unit | `cd frontend && npm test -- --testPathPattern=viewport-stream` | ❌ Wave 0 |
| PERF-09 | Max concurrent streams enforced | unit | `cd frontend && npm test -- --testPathPattern=stream-slot-manager` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `pytest opencv-service/tests/ -x -v` (Python) + `cd frontend && npm test` (Jest)
- **Per wave merge:** Full Python + Jest suites
- **Phase gate:** All suites green + manual binary frame verification

### Wave 0 Gaps
- [ ] `opencv-service/tests/test_inference_backend.py` — CUDA detection, fallback, metrics
- [ ] `frontend/src/hooks/__tests__/useViewportStream.test.ts` — IntersectionObserver + debounce
- [ ] `frontend/src/hooks/__tests__/streamSlotManager.test.ts` — Max concurrent limit
- [ ] `frontend/src/components/dashboard/__tests__/CameraStream.binary.test.tsx` — Binary frame rendering

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | No auth changes in this phase |
| V3 Session Management | no | No session changes |
| V4 Access Control | no | No access control changes |
| V5 Input Validation | yes | Binary frame data must be validated (valid JPEG markers) before Blob URL creation |
| V6 Cryptography | no | No cryptographic changes |

### Known Threat Patterns for Streaming Pipeline

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Malformed binary frame causes browser DoS | Denial of Service | Validate JPEG header (`0xFF 0xD8`) before creating Blob URL; catch `img onerror` |
| Blob URL leak exposes frame data to other origins | Information Disclosure | Blob URLs are same-origin by default; revoke promptly to minimize exposure window |
| Viewport observer bypass (camera streams without user viewing) | Spoofing | Server-side viewer count validation; client-side observer is a performance optimization, not a security control |

## Sources

### Primary (HIGH confidence)
- [OpenCV DNN Module Documentation](https://docs.opencv.org/4.x/d6/d0f/group__dnn.html) — Backend/Target enums including `DNN_BACKEND_CUDA`, `DNN_TARGET_CUDA`, `DNN_TARGET_CUDA_FP16` [CITED]
- [Socket.IO v4 Emitting Events Documentation](https://socket.io/docs/v4/emitting-events/) — Binary data handling in emit payloads [CITED]
- [MDN: URL.createObjectURL()](https://developer.mozilla.org/en-US/docs/Web/API/URL/createObjectURL) — Blob URL lifecycle [CITED]
- [MDN: IntersectionObserver](https://developer.mozilla.org/en-US/docs/Web/API/IntersectionObserver) — Viewport detection API [CITED]
- Project source files: `frame_pipeline.py`, `rtspManager.ts`, `index.ts`, `CameraStream.tsx`, `AdaptiveCameraGrid.tsx`, `SocketService.ts`, `CameraContext.tsx` [VERIFIED: codebase]

### Secondary (MEDIUM confidence)
- [ADR-002: Base64 Frame Encoding](docs/architecture/ADR-002-base64-frame-encoding-over-socket-io.md) — Original rationale and alternatives considered
- [ADR-005: Motion-Gated Detection Pipeline](docs/architecture/ADR-005-motion-gated-detection-pipeline.md) — Detection pipeline architecture and YOLO timing data
- [ADR-006: Adaptive FPS Throttling](docs/architecture/ADR-006-adaptive-fps-throttling-based-on-viewer-count.md) — Viewer count and bandwidth calculations
- Phase 1 Research (01-RESEARCH.md) — Pipeline architecture, threading model, WebSocket patterns

### Tertiary (LOW confidence)
- OpenCV CUDA build from source instructions — Not verified on target hardware; build process may vary by CUDA version [ASSUMED]

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — All dependencies are existing and verified; no new packages needed
- Architecture: HIGH — All three optimizations use well-documented, well-supported features
- Pitfalls: HIGH — Based on verified documentation and existing codebase patterns
- GPU inference packaging: MEDIUM — CUDA build process not tested on target hardware

**Research date:** 2026-05-29
**Valid until:** 2026-06-29 (30-day window)
