# SentryVision Streaming Improvements

## Executive Summary

**Current State:** Inefficient mixed streaming architecture
**Goal:** Near real-time, low-resource, multi-viewer streaming
**Expected Impact:** 70% reduction in server load, support for 50+ concurrent viewers

---

## Critical Issues Found

### 1. 🚨 **Dual Streaming Implementation** (BUG)
Your codebase has TWO different streaming methods:

**CameraStream.tsx (NEW - Socket.io)** ✅
```typescript
// Uses WebSocket rooms efficiently
socketService.on('frame', handleFrame)
```

**CameraFeed.tsx (OLD - HTTP Polling)** ❌
```typescript
// Direct HTTP polling - VERY INEFFICIENT!
<img src={camera.streamUrl} />
```

**Impact:** `CameraFeed.tsx` is causing:
- Separate HTTP requests per viewer
- MJPEG encoding per request
- Server overload
- Camera connection exhaustion

**Fix:** Replace all `CameraFeed` usage with `CameraStream`

---

## Proposed Improvements

### Phase 1: Quick Wins (1-2 hours)

#### 1.1 Unify Streaming to Socket.io
**Priority:** 🔴 CRITICAL

**Changes:**
```typescript
// REPLACE CameraFeed.tsx with this:
import { CameraStream } from './CameraStream';

export const CameraFeed: React.FC<CameraFeedProps> = ({ camera, isFocused, onFocus }) => {
  return <CameraStream camera={camera} autoStart={true} />;
};
```

**Impact:**
- ✅ Eliminates HTTP polling
- ✅ Single WebSocket per viewer
- ✅ 70% reduction in server connections
- ✅ No per-request MJPEG encoding

---

#### 1.2 Use Binary Frames (Not Base64)
**Priority:** 🟡 HIGH

**Current (Inefficient):**
```typescript
this.io.to(roomName).emit("frame", {
  data: frameBuffer.toString("base64"), // +33% size!
});
```

**Improved:**
```typescript
this.io.to(roomName).emit("frame", frameBuffer, {
  binary: true // Direct binary transfer
});
```

**Frontend:**
```typescript
socket.on('frame', (arrayBuffer: ArrayBuffer) => {
  const blob = new Blob([arrayBuffer], { type: 'image/jpeg' });
  const url = URL.createObjectURL(blob);
  imgRef.current.src = url;
});
```

**Impact:**
- ✅ 33% reduction in bandwidth
- ✅ Faster frame delivery
- ✅ Lower CPU (no base64 encoding)

---

#### 1.3 Add Connection Tracking
**Priority:** 🟡 HIGH

**Backend:**
```typescript
// Track active viewers per camera
const activeViewers = new Map<string, Set<string>>();

socket.on('requestStream', (cameraId) => {
  const socketId = socket.id;

  if (!activeViewers.has(cameraId)) {
    activeViewers.set(cameraId, new Set());
  }
  activeViewers.get(cameraId)!.add(socketId);

  // Join room
  socket.join(`camera-${cameraId}-live`);

  // Log viewer count
  console.log(`Camera ${cameraId}: ${activeViewers.get(cameraId)!.size} viewers`);
});

socket.on('disconnect', () => {
  activeViewers.forEach((viewers, cameraId) => {
    if (viewers.has(socket.id)) {
      viewers.delete(socket.id);

      if (viewers.size === 0) {
        // Optional: Reduce FPS when no viewers
        reduceCameraFps(cameraId);
      }
    }
  });
});
```

**Impact:**
- ✅ Track viewer count per camera
- ✅ Enable adaptive streaming
- ✅ Prevent camera overload

---

### Phase 2: Adaptive Streaming (3-4 hours)

#### 2.1 Dynamic FPS Adjustment
**Priority:** 🟢 MEDIUM

```typescript
// Adjust FPS based on viewer count
const getOptimalFps = (viewerCount: number): number => {
  if (viewerCount === 0) return 1; // Minimal
  if (viewerCount <= 3) return 4;   // High quality
  if (viewerCount <= 10) return 3;  // Medium
  return 2;                        // Low (many viewers)
};

// In frame emission:
const viewerCount = activeViewers.get(cameraId)?.size || 0;
const optimalFps = getOptimalFps(viewerCount);
const frameInterval = 1000 / optimalFps;
```

**Impact:**
- ✅ Auto-scale based on load
- ✅ Prevent server overload
- ✅ Maintain quality when few viewers

---

#### 2.2 Resolution Tiers
**Priority:** 🟢 MEDIUM

```typescript
// Multiple FFmpeg outputs with different resolutions
const STREAM_TIER = {
  HIGH: { width: 1920, height: 1080, fps: 4 },
  MEDIUM: { width: 1280, height: 720, fps: 3 },
  LOW: { width: 640, height: 360, fps: 2 }
};

// Client requests tier
socket.on('requestStream', (cameraId, tier = 'MEDIUM') => {
  const config = STREAM_TIER[tier];
  // Join appropriate room
  socket.join(`camera-${cameraId}-live-${tier}`);
});
```

**Frontend:**
```typescript
// Auto-select based on device/network
const getOptimalTier = (): 'HIGH' | 'MEDIUM' | 'LOW' => {
  const isMobile = /mobile/i.test(navigator.userAgent);
  const isSlowConnection = navigator.connection?.effectiveType === '2g';

  if (isMobile || isSlowConnection) return 'LOW';
  return 'HIGH';
};
```

**Impact:**
- ✅ Mobile-friendly (low bandwidth)
- ✅ Desktop gets high quality
- ✅ 50% reduction for mobile clients

---

#### 2.3 Request Throttling
**Priority:** 🟢 MEDIUM

```typescript
// Prevent rapid stream start/stop
const requestThrottle = new Map<string, number>();

socket.on('requestStream', (cameraId) => {
  const now = Date.now();
  const lastRequest = requestThrottle.get(socket.id);

  if (lastRequest && now - lastRequest < 2000) {
    // Ignore request (too soon)
    return;
  }

  requestThrottle.set(socket.id, now);
  // ... start stream
});
```

**Impact:**
- ✅ Prevent connection spam
- ✅ Reduce camera reconnection rate
- ✅ Stabilize server load

---

### Phase 3: Advanced Optimizations (4-6 hours)

#### 3.1 WebRTC Integration (Optional)
**Priority:** 🔵 OPTIONAL (Future)

Consider WebRTC for:
- Sub-second latency
- P2P connections (reduces server load)
- Adaptive bitrate

**Tradeoff:** More complex, may not need for home security

---

#### 3.2 Frame Buffer Optimization
**Priority:** 🟢 MEDIUM

```typescript
// Reuse buffer instead of creating new ones
class FrameBuffer {
  private buffer: Buffer;
  private size: number;

  constructor(size: number) {
    this.buffer = Buffer.allocUnsafe(size);
    this.size = 0;
  }

  write(data: Buffer): void {
    data.copy(this.buffer, 0, 0, data.length);
    this.size = data.length;
  }

  getBuffer(): Buffer {
    return this.buffer.subarray(0, this.size);
  }
}

// Use in stream manager
const frameBuffer = new FrameBuffer(500_000); // 500KB max
frameBuffer.write(frameBuffer);
emit(frameBuffer.getBuffer());
```

**Impact:**
- ✅ Reduce memory allocations
- ✅ Less GC pressure
- ✅ Better performance

---

#### 3.3 HTTP Caching Headers
**Priority:** 🟢 MEDIUM

For any HTTP endpoints:
```typescript
app.get('/stream/:cameraId/snapshot', (req, res) => {
  res.set({
    'Cache-Control': 'private, max-age=1', // 1 second cache
    'Pragma': 'no-cache',
  });
  // ... send frame
});
```

**Impact:**
- ✅ Allow browser caching
- ✅ Reduce redundant requests
- ✅ Better UX

---

### Phase 4: Monitoring & Alerts (2-3 hours)

#### 4.1 Stream Metrics Dashboard
**Track per-camera:**
- Active viewer count
- Current FPS
- Bandwidth usage
- Error rate
- Camera connection health

```typescript
// Metrics endpoint
app.get('/api/streaming/metrics', (req, res) => {
  const metrics = Array.from(activeViewers.entries()).map(([cameraId, viewers]) => ({
    cameraId,
    viewerCount: viewers.size,
    fps: getCurrentFps(cameraId),
    bandwidth: getBandwidthUsage(cameraId),
    errors: getErrorCount(cameraId)
  }));

  res.json(metrics);
});
```

---

#### 4.2 Alerts
**Alert on:**
- Viewer count > threshold
- FPS drops below minimum
- Camera connection failures
- High error rate

```typescript
// Alert system
if (viewerCount > 50) {
  sendAlert(`Camera ${cameraId} has ${viewerCount} viewers`);
}

if (fps < 1) {
  sendAlert(`Camera ${cameraId} FPS dropped to ${fps}`);
}
```

---

## Implementation Priority

### Immediate (Do Today)
1. ✅ Replace CameraFeed with CameraStream
2. ✅ Use binary frames (not base64)
3. ✅ Add connection tracking

**Expected Impact:** 70% improvement

---

### Short-term (This Week)
4. ✅ Dynamic FPS adjustment
5. ✅ Resolution tiers
6. ✅ Request throttling

**Expected Impact:** Support 50+ concurrent viewers

---

### Medium-term (Next Sprint)
7. ✅ Frame buffer optimization
8. ✅ HTTP caching
9. ✅ Metrics dashboard

**Expected Impact:** Production-ready streaming

---

### Long-term (Future)
10. ⚪ WebRTC integration (if needed)

---

## Testing Plan

### Load Testing
```bash
# Simulate 100 concurrent viewers
k6 run --vus 100 --duration 5m streaming-test.js
```

### Metrics to Track
- Server CPU usage
- Memory usage
- Bandwidth per viewer
- Frame delivery latency
- Camera connection count

### Success Criteria
- ✅ Support 50+ concurrent viewers
- ✅ <500ms frame latency
- ✅ <30% CPU usage at 50 viewers
- ✅ No camera connection exhaustion

---

## Estimated Effort

| Phase | Tasks | Time | Impact |
|-------|-------|------|--------|
| Phase 1 | Critical fixes | 1-2 hours | 🔴 HIGH |
| Phase 2 | Adaptive streaming | 3-4 hours | 🟡 MEDIUM |
| Phase 3 | Advanced opt | 4-6 hours | 🟢 LOW |
| Phase 4 | Monitoring | 2-3 hours | 🟡 MEDIUM |

**Total:** 10-15 hours for full implementation

---

## Rollout Plan

1. **Test in dev environment** (2 hours)
2. **Deploy to staging** (1 hour)
3. **Load test** (1 hour)
4. **Production rollout** (1 hour)
5. **Monitor for 24 hours**

---

## Files to Modify

### Frontend
- `frontend/src/components/live/CameraFeed.tsx` - Replace with CameraStream
- `frontend/src/components/dashboard/CameraStream.tsx` - Add binary support
- `frontend/src/contexts/SocketContext.tsx` - Add viewer count tracking

### Backend
- `server/src/streams/rtspManager.ts` - Binary frames, connection tracking
- `server/src/routes/index.ts` - Add metrics endpoint
- `server/src/middleware/rateLimit.ts` - Add stream request throttling

---

## Conclusion

**Current Issues:**
- ❌ Mixed streaming architecture (bug!)
- ❌ Base64 encoding overhead
- ❌ No adaptive streaming
- ❌ No connection tracking

**After Improvements:**
- ✅ Unified Socket.io streaming
- ✅ Binary frame transfer
- ✅ Adaptive FPS (1-4 FPS based on load)
- ✅ Resolution tiers (360p/720p/1080p)
- ✅ Connection tracking & throttling
- ✅ Metrics & monitoring

**Expected Results:**
- 🚀 70% reduction in server load
- 🚀 Support 50+ concurrent viewers
- 🚀 Near real-time (<500ms latency)
- 🚀 No camera overload
- 🚀 Mobile-friendly streaming

---

**Recommendation:** Start with Phase 1 (critical fixes) for immediate 70% improvement.
