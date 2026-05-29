# ADR-002: Base64 Frame Encoding over Socket.io

**Status**: Accepted
**Date**: 2026-05-29
**Deciders**: Engineering team

---

## Context

SentryVision delivers live camera frames from the backend to the React frontend in real time. The data path is:

```text
FFmpeg subprocess (JPEG output, stdout pipe)
    ↓ JPEG Buffer (~15-40 KB per frame)
Frame boundary detection (0xFF 0xD8 ... 0xFF 0xD9)
    ↓ Buffer.toString('base64')
Socket.io emit (text event, ~20-55 KB base64 string)
    ↓ WebSocket transport
Frontend Socket.io client
    ↓ "data:image/jpeg;base64,..." data URL
React <img src={dataUrl} />
```

### Current Implementation

In the **legacy pipeline** (`server/src/streams/rtspManager.ts:490-495`), frames are JPEG-decoded from the FFmpeg stdout pipe, then base64-encoded for Socket.io transmission:

```typescript
this.io.to(roomName).emit("frame", {
    cameraId,
    role: activeRole,
    timestamp: new Date().toISOString(),
    data: frameBuffer.toString("base64")
});
```

In the **Python pipeline** (`server/src/index.ts:358-366`), the same pattern applies — frames arrive as binary over WebSocket from Python, are converted to base64, then re-emitted over Socket.io:

```typescript
pythonWsClient.on('frame', (payload: { cameraId: string | null; data: Buffer; timestamp: number }) => {
    const frameData = data.toString('base64');
    io.to(`camera-${cameraId}-live`).emit('frame', {
        cameraId,
        data: frameData,
        timestamp: new Date(timestamp).toISOString(),
    });
});
```

The frontend constructs a data URL and sets it as an `<img>` element's `src` attribute.

### Why Not Binary WebSocket?

The code explicitly documents the rationale (`rtspManager.ts:490`):

> Using base64 for compatibility (binary in object can have Socket.io serialization issues)

Socket.io's default transport uses a custom protocol on top of WebSocket. When emitting objects containing `Buffer` or `ArrayBuffer`, Socket.io may serialize them unpredictably across its engine.io layer, especially when mixed with string fields in the same payload.

### Frame Size Characteristics

| Metric | Value |
|--------|-------|
| JPEG frame (640x360, quality 5) | ~15-25 KB |
| JPEG frame (640x360, quality 8, low-resource) | ~10-15 KB |
| Base64-encoded JPEG | ~20-35 KB |
| Frames per second (3 viewers) | 4 FPS |
| Per-client bandwidth | ~80-140 KB/s |
| Socket.io event overhead | ~200-500 bytes (metadata + framing) |

At 4 FPS with 3 viewers on the same camera, the server emits ~120-210 KB/s of Socket.io traffic per camera.

---

## Decision

Use base64-encoded JPEG frames carried as `string` fields in Socket.io text events. The frontend reconstructs `data:image/jpeg;base64,...` data URLs for display.

---

## Consequences

### Positive

- **Simplicity**: The frontend renders frames with a single `<img src={dataUrl} />` — no custom binary deserialization, no blob URL management, no `MediaSource` API complexity.
- **Socket.io compatibility**: Avoids engine.io binary serialization edge cases. String payloads are always reliably encoded/decoded across all Socket.io transports (WebSocket, HTTP long-polling).
- **Automatic reconnection**: Socket.io handles transport-level reconnection transparently. Frames resume when the connection recovers.
- **Debugging**: Base64 frame data is inspectable in browser DevTools network tab and Socket.io debug logs. Each frame is a self-contained string.
- **Consistent protocol**: Both legacy and Python pipeline frames use the identical `{ cameraId, data, timestamp }` schema. The frontend cannot distinguish the source.

### Negative

- **33% size overhead**: Base64 encoding expands binary data by a factor of 4/3. A 20 KB JPEG becomes a ~27 KB string. This overhead is incurred on every frame, for every viewer.
- **GC pressure**: Each frame creates a ~30 KB JavaScript string in the Node.js heap, which is then serialized and transmitted. At 4 FPS × N cameras × M viewers, this creates sustained allocation pressure on both server and client heaps.
- **No per-client quality adaptation**: The same base64 string is broadcast to all clients in the Socket.io room. A mobile client on cellular receives the same frame size as a desktop on Ethernet. See ADR-005 for viewer-count-based FPS throttling (which reduces quantity, not per-frame size).
- **Double encoding in Python pipeline**: Python JPEG-encodes the frame, sends it as binary over WebSocket to Node.js, which then base64-encodes it for Socket.io. The Python→Node.js leg uses binary efficiently, but the Node.js→Frontend leg pays the base64 tax.
- **Memory copies**: `Buffer.toString('base64')` creates a new string allocation. The Socket.io serialization creates another copy. The network stack creates another. Each frame involves 3-4 copies of ~30 KB.

### Risks

- **Scalability ceiling**: At 10 cameras × 4 FPS × 5 viewers, the server transmits ~600-1050 KB/s of Socket.io traffic. This is manageable for a home security system but would not scale to hundreds of cameras without protocol changes.
- **Latency floor**: Base64 encoding/decoding adds ~0.5-1ms per frame on the server and ~0.2-0.5ms on the client. At 4 FPS this is negligible, but at higher frame rates it becomes material.

---

## Alternatives Considered

### 1. Binary WebSocket Frames

Send JPEG buffers as native binary WebSocket frames, without base64 encoding.

**Pros**: 33% bandwidth reduction, no encoding/decoding CPU cost, single memory copy.

**Cons**: Socket.io binary support requires careful handling. Mixed string/binary payloads in a single emit can cause deserialization issues across Socket.io versions. Would require either:
  - Separate binary channel alongside Socket.io (adds connection management complexity).
  - Socket.io v4 binary mode with custom packet structure.
  - Dropping Socket.io entirely for raw WebSocket (losing automatic reconnection, rooms, fallback transport).

**Rejected because**: The compatibility risk and implementation complexity outweigh the bandwidth savings for a system with ≤10 cameras and ≤20 concurrent viewers.

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
3. **Socket.io v4 binary mode**: Re-evaluate Socket.io's binary handling now that v4 is stable.
4. **HLS/DASH transcoding**: For historical footage playback (not live streaming).

---

## References

- `server/src/streams/rtspManager.ts:444-513` — FFmpeg stdout parsing, frame boundary detection, base64 emission
- `server/src/streams/rtspManager.ts:488-496` — Base64 encoding and Socket.io emit
- `server/src/index.ts:358-366` — Python pipeline frame relay with base64
- `opencv-service/rtsp_ingestion/websocket_publisher.py` — Python-side WebSocket frame publishing (uses binary JPEG directly)
- `frontend/src/contexts/SocketContext.tsx` — Frontend Socket.io client
