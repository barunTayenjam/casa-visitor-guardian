# ADR-005: Phased Media Pipeline — WebRTC with SFU

**Status**: Proposed

**Date**: 2026-05-31

**Deciders**: Architect

---

#### Context

The current live video delivery system is a **JPEG slideshow over Socket.io**: Python captures RTSP, JPEG-encodes each frame (1280x720 @ Q80, ~30-50KB), sends over a raw WebSocket to Node.js, which fans out to frontend `<img>` tags via Socket.io `emit("frame", {data: Buffer})`. Each new frame replaces the previous Blob URL.

Problems with this approach:
1. **No video codec** — JPEG is an image format, not a video codec. No inter-frame compression means ~1.2-2 Mbps for what looks like a slideshow with visible flash between frames
2. **No hardware decoding** — `<img src="blob:...">` does not use GPU video decode. Every frame decompresses via JPEG decoder in software
3. **Frame flash** — replacing `img.src` causes a brief blank between frames as the browser decodes the new JPEG
4. **No adaptive bitrate** — same quality to all viewers regardless of network conditions. The `getOptimalFps()` method is dead code — it computes a value but nothing throttles frame emission
5. **Inefficient at scale** — Socket.io binary frames work but lack the optimizations of a real media server (selective forwarding, simulcast, SVC)

The most important quality attributes for this decision are **video quality**, **bandwidth efficiency**, and **viewer experience** (smooth playback, no frame flash).

#### Decision

We adopt a **phased approach** — three incremental phases, each independently shippable, ending with a full WebRTC + SFU pipeline.

---

### Phase 1: Fix the Existing JPEG Pipeline (2-3 days)

Deliverable: Smooth JPEG playback with correctly wired adaptive FPS, no architecture changes.

1. **Wire up adaptive FPS** — actually use the computed `camera.adaptiveFps` value to skip frames in `wirePythonWsFrames()` instead of emitting every Python frame
2. **Use `requestAnimationFrame`** — instead of immediately setting `imgRef.current.src` on every frame arrival, schedule the update via `requestAnimationFrame` with a `performance.now()` based throttle
3. **Double-buffer images** — use two `<img>` elements with CSS opacity transitions instead of one. Fade-in the new frame while the old one is still visible, eliminating the flash
4. **Blob URL lifecycle** — cache the current Blob URL until the next frame is actually painted, not replaced immediately

```typescript
// Double-buffer approach
const buffers = [useRef<HTMLImageElement>(null), useRef<HTMLImageElement>(null)];
const activeBuffer = useRef(0);

requestAnimationFrame(() => {
  const inactive = activeBuffer.current ^ 1;
  buffers[inactive].current.src = newBlobUrl;
  buffers[inactive].current.style.opacity = '1';   // fade in new
  buffers[active].current.style.opacity = '0';      // fade out old
  activeBuffer.current = inactive;
  URL.revokeObjectURL(oldBlobUrl);                   // clean up later
});
```

**No new dependencies. Zero infra changes.**

---

### Phase 2: Add H.264 + MSE (1-2 weeks)

Deliverable: Real video with hardware-accelerated decode in the browser, within the existing Socket.io relay.

1. **Python**: In `FramePipeline._on_live_frame()`, add an H.264 encoding path using FFmpeg subprocess:
   ```
   FFmpeg subprocess: raw BGR24 frames → pipe → libx264 (or NVENC hwaccel) → annexb H.264
   ```
   Input: same raw BGR24 frames from FFmpegReader
   Output: Annex-B H.264 NAL units via stdout pipe, collected into segments

2. **Python WebSocket publisher**: send H.264 segments (instead of JPEG) as binary WebSocket messages to Node.js, with a `"type":"h264segment"` metadata message

3. **Node.js**: Relay H.264 segments to Socket.io rooms (same fan-out as JPEG)

4. **Frontend**: Replace `<img>` with `<video>` using MSE (Media Source Extensions):
   ```typescript
   const mediaSource = new MediaSource();
   videoRef.current.src = URL.createObjectURL(mediaSource);
   const sourceBuffer = mediaSource.addSourceBuffer('video/mp4; codecs="avc1.42E01E"');
   
   // On frame arrival:
   sourceBuffer.appendBuffer(h264Segment);
   ```
   MSE appends H.264 segments to a `<video>` element with proper frame timing — no flash, hardware decode, smooth playback.

5. **Fallback** — If H.264 encoding fails or MSE is unavailable, fall back to Phase 1 JPEG pipeline

**New dependencies**: None in code. Requires `libx264` or NVENC in Python environment (likely already present if FFmpeg is installed).

---

### Phase 3: WebRTC + SFU (2-4 weeks)

Deliverable: Full WebRTC streaming with sub-200ms latency, true video, and SFU-based fan-out.

**SFU Choice**: **LiveKit** (self-hosted)

Rationale over alternatives:
- **mediasoup**: More powerful but requires dedicated Node.js worker processes and deep WebRTC expertise. Overkill for a home system.
- **Janus**: C-based, plugin model adds indirection. Good but LiveKit is simpler to integrate.
- **LiveKit**: One Go binary, Docker image, REST API for room management, client SDKs for JS/TS. Excellent docs. Handles TURN/STUN out of the box. Can run on the same machine for a home system.

**Architecture**:

```
RTSP Camera
    │
    ▼
[Python] FFmpegReader (raw BGR24)
    │
    ├──→ Detection pipeline (MOG2 → YOLO → tracking) ← unchanged
    │
    └──→ H.264 encoding (NVENC or libx264)
              │
              ▼
         [Python] WebRTC Publisher
              │  feeds H.264 RTP into LiveKit room
              ▼
         [LiveKit SFU] (port 7880 for WebRTC, 7881 for TURN)
              │
              ├──→ [Browser 1] WebRTC <video> (hardware decoded)
              ├──→ [Browser 2] WebRTC <video>
              └──→ [Browser N] WebRTC <video>
```

**Python changes**:
- New FFmpeg subprocess: input = raw BGR24 frames from the same `FFmpegReader`, output = H.264 RTP stream to LiveKit
- OR: new Python process using `aiortc` (Python WebRTC library) that encodes H.264 and publishes to LiveKit room
- Keep existing JPEG-based WebSocket for detection events and quick-preview thumbnails

**Node.js changes**:
- Control plane only: create/delete LiveKit rooms when cameras are added/removed
- REST API to LiveKit for room management
- Generate LiveKit access tokens for authenticated users (JWT-based)

**Frontend changes**:
- `CameraStream.tsx` replaced with `<video>` element connected to LiveKit WebRTC track
- Socket.io `requestStream` → emit `requestStream` event → Node.js creates LiveKit room + returns access token
- LiveKit JS SDK handles all WebRTC negotiation, ICE, reconnection
- Audio: add AAC audio from RTSP if cameras support it

**New dependencies**:
- Python: `aiortc` or FFmpeg RTP output → LiveKit ingress
- Docker: `livekit/livekit-server` image
- Frontend: `livekit-client` npm package

#### Alternatives Considered

| Alternative | Description | Pros | Cons | Reason Rejected |
|---|---|---|---|---|
| Phase 1 only (fix JPEG) | Smooth JPEG slideshow with RAF + double-buffer | Zero infra, quick win | Still no codec, still ~1.2-2 Mbps, no hardware decode | Viable short-term, insufficient long-term |
| Skip to WebRTC directly | Full SFU immediately | Best video quality from day 1 | High upfront cost, could stall if too complex | Phased approach reduces risk |
| HLS instead of WebRTC | FFmpeg generates HLS segments, served via HTTP | Works everywhere, simple CDN, no WebRTC complexity | 3-10 second latency, not suitable for live view | Latency too high for security camera use |
| WebTorrent / P2P | Peer-to-peer frame distribution | Zero server cost for fan-out | Unreliable, NAT issues, no browser works out of box | Not production-grade |
| Keep Socket.io, add MSE (Phase 2 only) | H.264 segments over Socket.io to MSE `<video>` | Video codec, hardware decode, no new infra | No sub-second latency, no adaptive bitrate | Viable middle-ground, included as Phase 2 |
| LiveKit vs mediasoup vs Janus | SFU choice | See SFU comparison above | Different trade-offs | LiveKit chosen for simplicity |

#### Consequences

**Positive**:
- True video with hardware-accelerated decode in browsers
- 10-100x bandwidth reduction per frame (H.264 I-frame ~10KB vs JPEG ~40KB, P-frames ~1-3KB)
- Smooth playback with proper frame timing via MSE/WebRTC
- No frame flash — `<video>` has proper buffering
- Each phase is independently shippable and provides value
- Phase 1 alone fixes the visible flash issue with zero new dependencies

**Negative**:
- Phase 2-3 add significant complexity to the Python pipeline
- Phase 3 (LiveKit) adds a new infrastructure dependency (Docker container)
- WebRTC debugging is harder than Socket.io debugging
- Phase 2 requires MSE-compatible browser (all modern browsers support it)
- The detection pipeline (MOG2 → YOLO) still operates on the low-res JPEG stream — this path is unchanged

**Risks**:
- H.264 encoding adds CPU/GPU load on the server. Mitigation: use NVENC hardware encoding if NVIDIA GPU available; otherwise, Phase 1 fallback is always available
- LiveKit adds another port/protocol to the network surface. Mitigation: LiveKit runs on the same machine, uses TLS for all connections
- MSE appendBuffer timing can lead to buffering issues if segments arrive late. Mitigation: adaptive buffer management, fallback to JPEG pipeline

**Follow-up actions**:
- [ ] Phase 1: Wire up adaptive FPS in `wirePythonWsFrames()` to actually skip frames
- [ ] Phase 1: Implement double-buffer rendering in `CameraStream.tsx` using RAF + two `<img>` elements
- [ ] Phase 2: Add H.264 FFmpeg subprocess to Python's `FramePipeline`
- [ ] Phase 2: Create MSE-based `<video>` player in frontend as fallback from JPEG
- [ ] Phase 3: Add LiveKit server to docker-compose.yml
- [ ] Phase 3: Implement Python WebRTC publisher using FFmpeg RTP → LiveKit
- [ ] Phase 3: Implement LiveKit room management in Node.js
- [ ] Phase 3: Migrate frontend from Socket.io frames to LiveKit WebRTC tracks
- [ ] Phase 3: Remove Phase 1/2 JPEG pipeline (keep as fallback only)
