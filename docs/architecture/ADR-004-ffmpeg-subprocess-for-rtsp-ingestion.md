# ADR-004: FFmpeg Subprocess for RTSP Ingestion

**Status**: Accepted
**Date**: 2026-05-29
**Deciders**: Engineering team

---

## Context

Both the Node.js backend and the Python OpenCV service capture RTSP streams by spawning FFmpeg as a child process and reading video frames from its stdout pipe. This is a foundational architectural choice — every frame in the system passes through an FFmpeg subprocess.

### Node.js Side (Legacy Pipeline)

The `StreamManager` in `server/src/streams/rtspManager.ts` spawns one FFmpeg process per camera, shared across all roles (detect, live, record):

```typescript
const ffmpegArgs = [
    "-loglevel", "error",
    "-rtsp_transport", "tcp",
    "-timeout", "5000000",
    "-err_detect", "ignore_err",
    "-fflags", "+discardcorrupt+genpts",
    "-max_delay", "1000000",
    "-probesize", "1000000",
    "-analyzeduration", "2000000",
    "-i", mainStreamUrl,
    "-f", "mjpeg",
    "-vcodec", "mjpeg",
    "-q:v", isLowResource ? "8" : "5",
    "-huffman", "optimal",
    "-threads", String(threads),
    "-r", String(fps),
    "-vf", camera.nightMode
        ? `scale=${resWidth}:${resHeight},format=yuv420p,eq=gamma=1.5:contrast=1.2:brightness=0.2`
        : `scale=${resWidth}:${resHeight},format=yuv420p`,
    "pipe:1",
];

const process = spawn(ffmpegPath, ffmpegArgs, {
    stdio: ["pipe", "pipe", "pipe"],
});
```

**Output format**: MJPEG over stdout. Node.js parses JPEG frame boundaries (`0xFF 0xD8` start, `0xFF 0xD9` end) from the byte stream.

**FFmpeg path resolution** (`rtspManager.ts:18-26`): Prefers system `ffmpeg` (for Docker/Alpine), falls back to `ffmpeg-static` npm package:

```typescript
let ffmpegPath = ffmpegStatic as unknown as string;
try {
    execSync("which ffmpeg", { stdio: "ignore" });
    ffmpegPath = "ffmpeg";
} catch (e) {
    console.log("Using ffmpeg-static: " + ffmpegPath);
}
```

### Python Side (Native Pipeline)

The `FFmpegReader` class in `opencv-service/rtsp_ingestion/ffmpeg_reader.py` takes a different approach — outputting raw BGR24 instead of JPEG:

```python
def _build_command(self) -> list[str]:
    return [
        "ffmpeg",
        *FFMPEG_DEFAULT_ARGS,        # -rtsp_transport tcp, -timeout 5000000, -loglevel error
        "-i", self.rtsp_url,
        "-vf", f"scale={self.width}:{self.height}",
        "-r", str(self.fps),
        "-f", "rawvideo",
        "-pix_fmt", "bgr24",
        "-an",
        "pipe:1",
    ]
```

**Output format**: Raw video bytes. Each frame is exactly `width × height × 3` bytes (BGR24). Reading is deterministic:

```python
self._frame_size = width * height * 3  # e.g., 640 × 360 × 3 = 691,200 bytes

raw_bytes = self._process.stdout.read(self._frame_size)
if not raw_bytes or len(raw_bytes) < self._frame_size:
    break  # Short read / EOF — reconnect

frame = np.frombuffer(raw_bytes, dtype=np.uint8).reshape(
    (self.height, self.width, 3)
)
```

### Key Differences Between Implementations

| Aspect | Node.js (Legacy) | Python (Native) |
|--------|------------------|-----------------|
| Output format | MJPEG (JPEG frames) | Raw BGR24 |
| Frame parsing | JPEG boundary markers | Fixed-size reads |
| Night mode | FFmpeg `eq` filter (gamma=1.5) | Not in FFmpeg args |
| Reconnection | Fixed retries (max 5, linear backoff) | Infinite retries, exponential backoff (1s→30s) |
| Error tolerance | `ignore_err`, `discardcorrupt` | None (fails on error) |
| Frame size | Variable (~15-40 KB JPEG) | Fixed (691 KB BGR24 at 640×360) |
| CPU cost | FFmpeg does JPEG encoding | No encoding (raw bytes) |

### Subprocess Lifecycle Management

**Node.js** (`rtspManager.ts:412-438`):
- Single shared FFmpeg process per camera across all roles (detect, live, record).
- On unexpected exit: retry up to 5 times with linear backoff (5s × retryCount).
- Inactivity timeout: kills FFmpeg after configurable period with no viewers.
- Safety valve: resets stdout buffer if it exceeds 4 MB without a complete JPEG frame.

**Python** (`ffmpeg_reader.py:101-113`):
- Dedicated thread per camera reads frames in a tight loop.
- On process exit/error: exponential backoff reconnection (1s → 30s max), infinite retries.
- Clean shutdown via `stop()` → `_kill_process()` → `process.kill()` + `wait(timeout=5)`.
- Interruptible sleep so `stop()` is responsive during backoff.

---

## Decision

Use FFmpeg as a child process with `stdout=PIPE` for RTSP ingestion in both Node.js and Python. Each camera gets a dedicated FFmpeg subprocess. The two implementations differ in output format (MJPEG vs raw BGR24) and reconnection strategy, but share the same fundamental approach: FFmpeg handles RTSP negotiation and decoding, the host process reads frames from stdout.

---

## Consequences

### Positive

- **Robust RTSP handling**: FFmpeg has battle-tested RTSP/RTP/TCP stack with configurable transport (`-rtsp_transport tcp`), timeout handling (`-timeout 5000000`), error recovery (`-err_detect ignore_err`), and corrupt packet handling (`-fflags +discardcorrupt+genpts`). This is far more reliable than OpenCV's `VideoCapture` for RTSP.
- **Hardware decode support**: FFmpeg supports hardware-accelerated decoding (VA-API, NVDEC, VideoToolbox) via `-hwaccel` flags. The Python pipeline can leverage GPU decoding for cameras that support it, reducing CPU load.
- **Night mode processing**: Node.js uses FFmpeg's `eq` filter for brightness/gamma correction (`rtspManager.ts:377-379`), offloading image processing from application code.
- **Format flexibility**: FFmpeg handles codec negotiation, container parsing, and color space conversion. The application only sees the desired output format.
- **Process isolation**: FFmpeg runs in a separate process. A segfault or hang in FFmpeg does not crash the host application. The host can detect the crash via exit codes and restart the subprocess.
- **Deterministic reads (Python)**: Raw BGR24 output means fixed-size reads — no frame boundary detection needed. The `read(frame_size)` call is simple and reliable.

### Negative

- **Subprocess lifecycle management**: Both implementations must handle spawning, health monitoring, error handling, and graceful shutdown. This is non-trivial:
  - Node.js: ~100 lines for FFmpeg spawn, error handling, retry logic, inactivity timeout (`rtspManager.ts:347-438`).
  - Python: ~90 lines for thread management, reconnection, clean shutdown (`ffmpeg_reader.py:101-171`).
- **JPEG boundary parsing (Node.js)**: MJPEG output requires scanning the byte stream for `0xFF 0xD8` / `0xFF 0xD9` markers (`rtspManager.ts:454-464`). This is a source of subtle bugs:
  - Buffer overflows (mitigated by 4 MB safety valve at line 442).
  - Split markers across `data` chunks (handled by accumulating in a buffer).
  - Nested JPEG markers in malformed streams.
- **Memory pressure (Python)**: Raw BGR24 at 640×360 = 691 KB per frame. At 5 FPS, that's 3.5 MB/s of frame data allocated and freed per camera. NumPy array creation adds GC overhead.
- **Binary dependency**: Requires FFmpeg installed on the system or bundled via `ffmpeg-static`. Docker images must include FFmpeg. The npm `ffmpeg-static` package adds ~50 MB to `node_modules`.
- **Process overhead**: Each FFmpeg subprocess consumes a PID, file descriptors, and memory. With 10 cameras, that's 10 FFmpeg processes (or 20 in dual-pipeline mode).

### Risks

- **Zombie processes**: If the host crashes without clean shutdown, FFmpeg subprocesses may become orphaned. The Python implementation uses `daemon=True` threads, but the process itself is not a daemon. Node.js relies on `process.on('exit')` cleanup.
- **FD exhaustion**: Each subprocess opens file descriptors for stdin, stdout, stderr pipes, plus network sockets for RTSP connections. With many cameras, this can approach system limits.
- **FFmpeg version sensitivity**: RTSP behavior varies across FFmpeg versions. The Node.js implementation uses `ffmpeg-static` for consistency, but the Python implementation relies on the system FFmpeg.

---

## Alternatives Considered

### 1. OpenCV VideoCapture (`cv2.VideoCapture`)

```python
cap = cv2.VideoCapture("rtsp://camera-ip/stream")
ret, frame = cap.read()
```

**Pros**: Simplest API. Single function call. No subprocess management. Native numpy array output.

**Cons**: OpenCV's FFmpeg backend has known RTSP reliability issues:
  - Hangs indefinitely on RTSP timeout (no configurable timeout in many builds).
  - No TCP transport option (uses UDP by default, which drops packets on noisy networks).
  - Poor reconnection behavior — often requires destroying and recreating the `VideoCapture` object.
  - Thread-unsafe in multi-camera scenarios.
  - Limited hardware decode control.

**Rejected because**: Production RTSP streams require the robustness features (TCP transport, timeout, error recovery) that only the FFmpeg command-line tool provides reliably.

### 2. GStreamer Pipeline

```python
import gi
gi.require_version('Gst', '1.0')
from gi.require_version import Gst
Gst.init(None)
pipeline = Gst.parse_launch("rtspsrc location=... ! decodebin ! videoconvert ! appsink")
```

**Pros**: Powerful pipeline graph. Hardware-accelerated decode. Fine-grained control over buffering and latency. Plugin ecosystem.

**Cons**: Heavy dependency (gstreamer + plugins = hundreds of MB). Complex API (GObject introspection, pipeline state management). Python bindings are fragile. Significantly steeper learning curve than FFmpeg. Overkill for the current use case.

**Rejected because**: The dependency cost and complexity are disproportionate to the benefit. FFmpeg provides sufficient RTSP handling.

### 3. PyAV (Python AV Bindings)

```python
import av
container = av.open("rtsp://camera-ip/stream", options={"rtsp_transport": "tcp"})
for frame in container.decode(video=0):
    img = frame.to_ndarray(format='bgr24')
```

**Pros**: Native Python API. No subprocess management. Direct numpy array output. Built on FFmpeg's `libavformat`/`libavcodec`, so same RTSP robustness. Thread-safe. Handles reconnection.

**Cons**: C extension dependency (requires FFmpeg development headers). Less widely deployed than subprocess FFmpeg. Fewer examples and community support for edge cases. Debugging requires understanding both Python and C layers.

**Status**: Identified as a potential future migration path for the Python pipeline. The existing ADR-003 (detection pipeline redesign) mentions PyAV as an option. Not adopted yet due to the subprocess approach already being implemented and validated.

### 4. Shared Memory / DMA Pipeline

Read decoded frames directly from GPU memory or a shared memory segment, avoiding the stdout pipe entirely.

**Rejected because**: Requires hardware-specific setup (GPU vendor, driver version). Not portable across the target deployment environments (x86, ARM, Docker). The stdout pipe approach is portable and debuggable.

---

## References

- `server/src/streams/rtspManager.ts:14-26` — FFmpeg path resolution
- `server/src/streams/rtspManager.ts:360-387` — FFmpeg spawn with argument construction
- `server/src/streams/rtspManager.ts:442-513` — Frame boundary detection and parsing
- `server/src/streams/rtspManager.ts:412-438` — Process exit handling and reconnection
- `opencv-service/rtsp_ingestion/ffmpeg_reader.py` — Python FFmpegReader implementation
- `opencv-service/rtsp_ingestion/config.py:35-39` — Default FFmpeg arguments
- `docs/architecture/ADR-003-detection-pipeline-redesign.md` — Detection pipeline redesign (references FFmpeg vs OpenCV decision)
