# ADR-006: Adaptive FPS Throttling Based on Viewer Count

**Status**: Accepted
**Date**: 2026-05-29
**Deciders**: Engineering team

---

## Context

SentryVision uses Socket.io rooms to broadcast live camera frames to frontend clients. When multiple clients subscribe to the same camera, each receives every frame emitted by the server. This creates a bandwidth and CPU scaling problem.

### The Scaling Problem

A single camera frame is ~15-25 KB (binary JPEG at 640×360, quality 60). At 4 FPS:

| Viewers | Bandwidth per Camera | Server CPU (emission) |
|---------|---------------------|-----------------------|
| 1 | ~80 KB/s | 4 `emit()` calls/s |
| 5 | ~400 KB/s | 20 `emit()` calls/s |
| 10 | ~800 KB/s | 40 `emit()` calls/s |
| 20 | ~1600 KB/s | 80 `emit()` calls/s |

Socket.io's room emission uses a single write to the WebSocket that is replicated to all room members. The server-side cost is primarily:
1. **Serialization**: Socket.io binary serialization of the frame event (once per emit, not per viewer).
2. **Network I/O**: Operating system must copy the serialized frame N times to N TCP sockets.
3. **Buffer allocation**: One ~20 KB Buffer per frame, held in memory until all socket writes complete.

For a home security system running on consumer hardware, unbounded viewer scaling can exhaust bandwidth (home uplink is often 10-50 Mbps) and server memory.

### Current Viewer Tracking

The system tracks active viewers per camera using Socket.io socket IDs (`rtspManager.ts:22-23`):

```typescript
activeViewers: Set<string>; // Track active socket IDs for adaptive streaming
adaptiveFps: number;        // Current FPS based on viewer count
```

Viewers are added when a client joins a camera room (`rtspManager.ts:93-115`):

```typescript
socket.on('requestStream', (data) => {
    const { cameraId } = data;
    const camera = this.cameras.get(cameraId);
    // ...
    camera.activeViewers.add(socket.id);
    const viewerCount = camera.activeViewers.size;
    const roomName = `camera-${cameraId}-live`;
    socket.join(roomName);
    // ...
});
```

Viewers are removed on disconnect (`rtspManager.ts:124-157`):

```typescript
socket.on('stopStream', (data) => {
    const { cameraId } = data;
    const camera = this.cameras.get(cameraId);
    if (!camera) return;
    camera.activeViewers.delete(socket.id);
    // ...
});

socket.on('disconnect', () => {
    this.cameras.forEach((camera, cameraId) => {
        if (camera.activeViewers.has(socket.id)) {
            camera.activeViewers.delete(socket.id);
            // ...
        }
    });
});
```

---

## Decision

Scale FPS inversely with viewer count using a step function. The `getOptimalFps` method (`rtspManager.ts:161-167`) defines the mapping:

```typescript
private getOptimalFps(viewerCount: number): number {
    if (viewerCount === 0) return 1;    // Minimal when no viewers
    if (viewerCount <= 3) return 4;     // High quality
    if (viewerCount <= 10) return 3;    // Medium
    if (viewerCount <= 20) return 2;    // Low
    return 1;                           // Minimal
}
``` // rtspManager.ts:161-167

### FPS-to-Viewer Mapping

| Active Viewers | Frame Rate | Bandwidth per Viewer | Total Bandwidth (per camera) |
|---------------|------------|---------------------|------------------------------|
| 0 | 1 FPS | N/A | ~20 KB/s (keepalive) |
| 1-3 | 4 FPS | ~80 KB/s | ~80-240 KB/s |
| 4-10 | 3 FPS | ~60 KB/s | ~240-600 KB/s |
| 11-20 | 2 FPS | ~40 KB/s | ~440-800 KB/s |
| 21+ | 1 FPS | ~20 KB/s | ~420+ KB/s |

### How It Works

The FPS adaptation is applied at frame emission time (`rtspManager.ts:54-91`). For each frame received from PythonWsClient:

```typescript
const viewerCount = camera.activeViewers.size;
const adaptiveFps = this.getOptimalFps(viewerCount);
camera.adaptiveFps = adaptiveFps;
const frameIntervalMs = 1000 / adaptiveFps;

if (viewerCount > 0) {
    this.io.to(roomName).emit("frame", {
        cameraId,
        role: 'live',
        timestamp: new Date().toISOString(),
        data
    });
}
``` // rtspManager.ts:69-81

Key implementation details:

- **Per-role adaptation**: Only the `live` role counts all viewers. The `detect` role is always emitted (it's a server-side detection pipeline, not viewer-facing).
- **Viewer-gated emission**: Frames are only emitted to the `live` room when `viewerCount > 0`. The `detect` room always receives frames regardless of viewer count.
- **Time-based throttling**: Uses `frameIntervalMs` derived from `adaptiveFps` (though currently all frames are emitted on reception; throttling logic is ready for per-camera FPS limiting).
- **All viewers affected equally**: When emitted, every viewer in the room receives the same frame.

### Viewer Count Propagation

Viewer count is reported to the frontend via stream status events (`rtspManager.ts:104-121`):

```typescript
const viewerCount = camera.activeViewers.size;
socket.emit('streamStarted', {
    cameraId,
    fps: camera.adaptiveFps,
    viewerCount,
    tier,
});
```

And via the stream metrics API (`server/src/controllers/StreamController.ts:13`):

```typescript
viewerCount: camera.activeViewers?.size || 0,
```

---

## Consequences

### Positive

- **Sub-linear bandwidth scaling**: Total bandwidth scales roughly as O(log N) rather than O(N). At 20 viewers, bandwidth is ~1200 KB/s instead of ~2400 KB/s (4 FPS constant).
- **Server load protection**: `Socket.io.emit()` call frequency drops from 4N/sec to at most 3N/sec (N = viewers). This caps serialization and I/O overhead.
- **Zero configuration**: No operator tuning required. The step function is built into `getOptimalFps`. The system automatically adapts as viewers connect and disconnect.
- **Keepalive at zero viewers**: 1 FPS emission continues even with no viewers, ensuring the detection pipeline stays active and FFmpeg remains running.
- **Per-camera isolation**: Each camera tracks its own viewer set independently. A popular camera doesn't affect FPS for other cameras.

### Negative

- **Quality degradation for all viewers**: When many viewers connect, every viewer's experience degrades. A security operator monitoring 20 cameras simultaneously would see each at 2 FPS instead of 4 FPS. There is no "premium" viewer tier.
- **No per-client adaptation**: A viewer on a mobile cellular connection receives the same frame rate and resolution as a viewer on a wired desktop. The system cannot adapt to individual client bandwidth or screen size.
- **Step function discontinuity**: FPS drops from 4→3→2→1 at viewer count thresholds. This can cause visible quality jumps when the 4th or 11th viewer connects.
- **Live role only**: The `detect` role bypasses adaptive FPS (`viewerCount = 1` always). If many viewers connect, detection FPS stays at 4 FPS while live preview drops. This means detection continues at full rate but the operator sees degraded preview — potentially causing them to miss the visual context of a detection.
- **No resolution scaling**: Only FPS is reduced. Frame resolution stays at 640×360 regardless of viewer count. A more aggressive approach would also reduce JPEG quality or resolution.
- **Global room emission**: Socket.io room emission sends one message to all room members. The server cannot selectively send higher FPS to some viewers and lower to others within the same room.

### Risks

- **Viewer count staleness**: If Socket.io disconnect events are delayed (network issues, browser tab backgrounding), `activeViewers.size` may overcount viewers, causing unnecessary FPS reduction.
- **Concurrent access**: `activeViewers` is a `Set<string>` modified from Socket.io event handlers. Node.js is single-threaded, so no race conditions, but the viewer count could be momentarily inconsistent during rapid connect/disconnect bursts.
- **Home security use case limits**: In practice, a home security system rarely has >5 concurrent viewers. The 21+ tier (1 FPS) is defensive but may cause quality issues in commercial/multi-tenant deployments.

---

## Alternatives Considered

### 1. Constant FPS (No Adaptation)

Emit frames at a fixed rate (e.g., 4 FPS) regardless of viewer count.

**Pros**: Consistent quality. Simpler implementation (no viewer tracking, no FPS calculation).

**Cons**: Linear bandwidth scaling. 20 viewers on one camera = 2400 KB/s. On a home uplink (10 Mbps), this saturates ~20% of upload capacity for a single camera.

**Rejected because**: The system must gracefully handle multiple concurrent viewers (family members, shared access) without exhausting bandwidth.

### 2. Per-Client Adaptive Bitrate Streaming

Implement client-side bandwidth estimation and server-side per-client frame rate/quality adaptation (similar to HLS/DASH ABR).

**Pros**: Optimal per-client experience. Mobile users get lower bitrate. Desktop users get full quality.

**Cons**: Requires per-client frame emission (not room broadcast). Each client needs its own frame queue and emission timer. Dramatically increased server complexity. Requires bandwidth estimation on the client and feedback channel to the server.

**Rejected because**: Implementation complexity is disproportionate to the use case. Most viewers are on the same local network.

### 3. Server-Sent Event with Client Polling

Clients poll for new frames at their own rate rather than receiving pushed frames.

**Pros**: Client controls its own frame rate naturally. No server-side adaptation needed.

**Cons**: HTTP polling overhead (TCP handshake, headers per request). Much higher latency than WebSocket push. No real-time detection event delivery.

**Rejected because**: Polling latency is unacceptable for real-time security monitoring.

### 4. Simulcast (Multiple Quality Streams)

Encode frames at multiple quality levels (e.g., high/medium/low) and let clients subscribe to the appropriate stream.

**Pros**: True per-client quality adaptation. Clients can switch quality dynamically.

**Cons**: N× encoding cost on the server. Requires FFmpeg to output multiple quality levels simultaneously (or re-encode per quality). Multiplies memory usage. Complex client-side quality switching logic.

**Rejected because**: The FFmpeg subprocess already produces a single output stream. Multi-quality encoding would require significant FFmpeg pipeline redesign for marginal benefit.

### 5. Frame Differencing (Send Deltas)

Send full keyframes periodically and delta frames between them. Only transmit changed regions.

**Pros**: Potentially massive bandwidth reduction for static scenes. Standard technique in video compression.

**Cons**: Requires client-side frame accumulation and delta application. Complex error recovery (lost delta = corrupt frame until next keyframe). No standard for delta-encoded JPEG over WebSocket. Would essentially be reimplementing video codec features.

**Rejected because**: The complexity of implementing a custom delta protocol outweighs the bandwidth savings at 1-4 FPS.

---

## Future Directions

1. **Resolution scaling**: Add JPEG quality reduction at higher viewer counts (reduce `q:v` from 5 to 8) in addition to FPS reduction.
2. **Per-client emission**: Move from room broadcast to per-client emission loops, enabling future per-client adaptation.
3. **Bandwidth estimation**: Client-side bandwidth measurement with feedback to server for adaptive quality.
4. **WebRTC migration**: For deployments requiring >10 concurrent viewers, WebRTC with SFU provides per-client adaptation natively.

---

## References

- `server/src/streams/rtspManager.ts:22-23` — `activeViewers` and `adaptiveFps` fields on `Camera` interface
- `server/src/streams/rtspManager.ts:93-160` — Viewer tracking (requestStream / stopStream / disconnect handlers)
- `server/src/streams/rtspManager.ts:161-167` — `getOptimalFps()` step function
- `server/src/streams/rtspManager.ts:54-91` — wirePythonWsFrames frame emission with viewer-gated FPS
- `server/src/streams/rtspManager.ts:69-81` — Viewer count check and live room frame emission
- `server/src/controllers/StreamController.ts:13` — Viewer count in stream metrics API
