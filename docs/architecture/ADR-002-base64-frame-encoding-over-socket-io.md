# ADR-002: Binary Frame Delivery over Socket.io (Socket.io Binary Mode)

**Status**: Accepted
**Date**: 2026-05-29
**Deciders**: Engineering team

> **Revision (2026-05-29):** ADR rewritten to reflect binary frame delivery implemented in Phase 2 (PERF-04). The original base64 encoding approach was fully replaced.

---

## Context

SentryVision delivers live camera frames from the backend to the React frontend in real time. The current data path uses Socket.io binary mode:

```text
Python WebSocket Publisher (asyncio WS server :9090)
    ↓ Binary JPEG (no base64)
PythonWsClient (Node.js, binary WS message handler)
    ↓ Buffer (raw JPEG bytes)
rtspManager.wirePythonWsFrames()
    ↓
Socket.io emit ('frame', { cameraId, role, timestamp, data: Buffer })
    ↓ WebSocket transport (binary)
Frontend Socket.io client
    ↓ Blob URL via URL.createObjectURL(blob)
React <img /> element
```

### Current Implementation

Frame relay is handled by `rtspManager.wirePythonWsFrames()` (`server/src/streams/rtspManager.ts:54-91`). Frames arrive from Python as raw JPEG bytes over WebSocket (binary), and are emitted as native Buffer objects through Socket.io's binary mode:

```typescript
private wirePythonWsFrames(): void {
    const pythonWs = serviceRegistry.getPythonWsClient();
    if (!pythonWs) return;

    pythonWs.on('frame', (message: { cameraId: string | null; data: Buffer; timestamp: number }) => {
        const { cameraId, data } = message;
        if (!cameraId) return;

        const camera = this.cameras.get(cameraId);
        if (!camera) return;

        camera.lastFrame = data;
        this.healthMonitor.recordFrameEmitted(cameraId, 'live');

        const roomName = `camera-${cameraId}-live`;
        const viewerCount = camera.activeViewers.size;
        const adaptiveFps = this.getOptimalFps(viewerCount);
        camera.adaptiveFps = adaptiveFps;
        const frameIntervalMs = 1000 / adaptiveFps;

        if (viewerCount > 0) {
            this.io.to(roomName).emit("frame", {
                cameraId,
                role: 'live',
                timestamp: new Date().toISOString(),
                data        // ← raw Buffer, no base64 encoding
            });
        }

        const detectRoom = `camera-${cameraId}-detect`;
        this.io.to(detectRoom).emit("frame", {
            cameraId,
            role: 'detect',
            timestamp: new Date().toISOString(),
            data
        });
    });
}
```

The frontend constructs a Blob URL and sets it as an `<img>` element's `src` attribute, properly revoking the previous Blob URL on each frame update and on unmount.

### Frame Size Characteristics

| Metric | Value |
|--------|-------|
| JPEG frame (640x360, quality 60) | ~15-25 KB |
| Frames per second (3 viewers) | 4 FPS |
| Per-client bandwidth | ~60-100 KB/s |
| Socket.io event overhead | ~200-500 bytes (metadata + framing) |

At 4 FPS with 3 viewers on the same camera, the server emits ~180-300 KB/s of Socket.io traffic per camera (no base64 overhead).

---

## Decision

Use Socket.io binary mode to deliver JPEG frames as native Buffer objects. The frontend constructs Blob URLs with proper memory lifecycle management (revokeObjectURL on replace + unmount). A base64 fallback is preserved for HTTP long-polling transport clients.

---

## Consequences

### Positive

- **33% bandwidth reduction**: Eliminating base64 encoding removes the 4/3 size overhead. A 20 KB JPEG frame is transmitted as 20 KB, not ~27 KB.
- **No encoding/decoding CPU cost**: The server no longer calls `Buffer.toString('base64')` per frame (~0.5-1ms), and the client no longer parses base64 data URLs (~0.2-0.5ms). These savings compound across cameras and viewers.
- **Single memory copy**: Frames travel from PythonWsClient receive buffer directly to Socket.io emit as the same Buffer object — no string allocation, no intermediate copy.
- **Blob URL rendering**: The frontend renders frames via `URL.createObjectURL(blob)` which is more memory-efficient than inline data URLs in the DOM. Blob URLs reference binary data in the browser's Blob store rather than embedding it as string content in the element.
- **Consistent protocol**: Both `live` and `detect` role frames use the identical `{ cameraId, role, timestamp, data: Buffer }` schema.

### Negative

- **Blob URL memory lifecycle**: Each frame creates a new Blob URL that must be explicitly revoked via `URL.revokeObjectURL()`. Failure to do so leaks Blob objects in the browser's Blob store. The frontend handles this by revoking the previous frame's Blob URL on each frame update and on component unmount.
- **Socket.io binary mode requirements**: Socket.io's binary mode requires the `Buffer` or `ArrayBuffer` to be a top-level property of the emitted object. Nested binary in complex object trees may still be serialized unpredictably across engine.io layers. The current schema keeps `data` as a direct property at the emit payload level.
- **Base64 fallback required**: HTTP long-polling transport (Socket.io fallback) does not support binary mode. The frontend must detect the transport type and fall back to base64-encoded frames if the connection drops to long-polling.
- **Debugging overhead**: Binary frames are not directly inspectable in browser DevTools network tab or Socket.io debug logs. Frame inspection requires either a `console.log` of the Buffer or a Blob URL with `URL.createObjectURL`.
- **No per-client quality adaptation**: The same Buffer is broadcast to all clients in the Socket.io room. A mobile client on cellular receives the same frame size as a desktop on Ethernet. See ADR-006 for viewer-count-based FPS throttling (which reduces quantity, not per-frame size).

### Risks

- **Socket.io binary compatibility**: Older Socket.io client versions may not handle Binary payloads correctly. The system pins Socket.io v4+ which has stable binary handling.
- **Blob lifecycle bugs**: If `URL.revokeObjectURL()` is called while the `<img>` element is still loading the Blob, the image may fail to render. The frontend must ensure the Blob URL remains valid until the new frame's Blob has loaded.

---

## Alternatives Considered

### 1. Base64 String Encoding (Rejected)

Encode JPEG frames as base64 strings and carry them as string fields in Socket.io text events. This was the original implementation used before the binary mode migration.

**Pros** (of the original approach): Simple frontend rendering (`data:image/jpeg;base64,...` data URLs). Reliable across all Socket.io transports (WebSocket, HTTP long-polling). Debuggable in DevTools.

**Cons**: 33% bandwidth overhead. CPU cost for encoding/decoding (~0.5-1ms server-side). Double encoding in the Python pipeline (binary → base64 → string). GC pressure from large string allocations.

**Rejected because**: Phase 2 (PERF-04) demonstrated that Socket.io v4 binary mode is stable and reliable. The 33% bandwidth savings and CPU reduction outweigh the long-polling fallback complexity. A base64 fallback is preserved for HTTP long-polling transport.

### 2. MJPEG over HTTP

Serve a continuous MJPEG stream over HTTP (`multipart/x-mixed-replace`) and use an `<img>` tag pointed at the stream URL.

**Pros**: Zero JavaScript for frame rendering. Browser-native MJPEG decoding. No Socket.io dependency for streaming.

**Cons**: Unidirectional (HTTP response). Cannot carry detection events, viewer count signals, or control messages on the same connection. No per-viewer frame dropping or FPS adaptation. Each viewer opens a separate HTTP connection to the FFmpeg output — N viewers means N× bandwidth on the server. No automatic reconnection standard.

**Rejected because**: The system needs bidirectional communication (stream start/stop, detection overlays, viewer tracking) on the same channel. MJPEG would require a parallel Socket.io connection for events, defeating the simplification goal.

### 3. Server-Sent Events (SSE)

Use `EventSource` API for unidirectional server→client streaming of frame data.

**Pros**: Simpler than WebSocket. Automatic reconnection built into the spec. HTTP/2 multiplexing.

**Cons**: Unidirectional only — cannot send stream control messages (requestStream, stopStream) from client to server. Would still need WebSocket for upstream communication. Binary data support requires base64 encoding anyway (SSE is text-only).

**Rejected because**: Unidirectional nature requires maintaining a separate upstream channel.

### 4. WebRTC

Use WebRTC data channels or media streams for low-latency frame delivery.

**Pros**: Sub-100ms latency. Native video decoding in browser. Adaptive bitrate. Per-client quality adaptation.

**Cons**: Significant implementation complexity (STUN/TURN servers, ICE negotiation, SDP exchange). Designed for peer-to-peer, not server-to-many-clients. SFU (Selective Forwarding Unit) needed for multi-viewer scaling — an entirely new infrastructure component. Overkill for a 4 FPS security camera stream.

**Rejected because**: Architectural complexity is disproportionate to the use case.

### 5. JPEG over WebSocket with Custom Binary Framing

Design a simple binary protocol: `[4-byte length][JPEG bytes]` over raw WebSocket.

**Pros**: Binary efficiency without Socket.io overhead. Simple to implement.

**Cons**: Must reimplement reconnection, room membership, and fallback transport that Socket.io provides. Detection events and frame data would need separate connections or a multiplexing layer.

**Rejected because**: Reimplementing Socket.io features is not worth the bandwidth savings.

---

## Future Directions

If bandwidth becomes a bottleneck at scale, consider:

1. **Simulcast**: Encode frames at multiple quality levels and let clients select based on bandwidth.
2. **Delta encoding**: Send full keyframes periodically and JPEG-delta frames between them.
3. **HLS/DASH transcoding**: For historical footage playback (not live streaming).

---

## References

- `server/src/streams/rtspManager.ts:54-91` — wirePythonWsFrames binary frame relay (Socket.io binary mode)
- `server/src/streams/rtspManager.ts:75-80` — Live role frame emission with raw Buffer
- `opencv-service/rtsp_ingestion/websocket_publisher.py` — Python-side WebSocket frame publishing (binary JPEG, no base64)
- `frontend/src/contexts/SocketContext.tsx` — Frontend Socket.io client with Blob URL rendering
- `frontend/src/components/live/StreamPanel.tsx` — Stream panel with Blob URL lifecycle management
