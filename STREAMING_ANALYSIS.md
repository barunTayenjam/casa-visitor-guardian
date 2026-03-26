# SentryVision Streaming Architecture Analysis

## Executive Summary

Investigation reveals **MULTIPLE CRITICAL ISSUES** causing the reported 3-connection problem and mobile streaming failures:

1. **React.StrictMode causes double-mounting** in development (2 connections)
2. **Auto-start mechanism** triggers on every mount
3. **Each component registers separate frame listeners**
4. **Mobile browsers** have WebSocket compatibility issues with current configuration

---

## Current Architecture Overview

### Backend Stream Management (server/src/streams/rtspManager.ts)

**Single Shared FFmpeg Process Per Camera:**
```typescript
interface Camera {
  id: string;
  mainProcess: ChildProcessWithoutNullStreams | null;  // ONE FFmpeg process
  activeRoles: Set<'detect' | 'record' | 'live'>;       // Which roles are active
  activeViewers: Set<string>;                            // Socket IDs viewing
  adaptiveFps: number;                                   // Current FPS based on viewers
}
```

**Key Design:**
- Each camera has ONE main FFmpeg process
- Multiple roles (detect, record, live) share the same process
- Frames are emitted to Socket.io rooms: `camera-${cameraId}-${role}`
- Adaptive FPS: 4 FPS (1-3 viewers), 3 FPS (4-10), 2 FPS (11-20), 1 FPS (21+)

### Frontend Streaming Components

**Component Hierarchy:**
```
StreamDashboard (pages/StreamDashboard.new.tsx)
  └─> AdaptiveCameraGrid (components/live/AdaptiveCameraGrid.tsx)
       └─> CameraStream (components/dashboard/CameraStream.tsx) [Multiple instances]
```

**CameraStream Component Lifecycle:**
1. Mounts with `autoStart={true}` (from AdaptiveCameraGrid line 173, 188)
2. Checks if socket connected (line 80)
3. Calls `startCameraStream(camera.id)` (line 113)
4. Registers frame event listener (line 269)
5. On unmount, calls stopStream and removes listener (lines 158-162)

---

## Root Cause Analysis: Why 3 Connections Per Camera?

### 🔴 Issue #1: React.StrictMode Double-Mounting (2 connections)

**Location:** `frontend/src/main.tsx` line 65
```tsx
root.render(
  <StrictMode>  {/* ⚠️ Causes double mounting in dev */}
    <App />
  </StrictMode>
);
```

**Impact:**
- In development, React intentionally mounts, unmounts, and remounts components
- Each CameraStream component goes through lifecycle TWICE
- Each mount triggers `startCameraStream()` → `requestStream()` → joins room
- Backend sees 2 separate socket connections from same browser tab

**Evidence:**
```typescript
// CameraStream.tsx lines 146-164
useEffect(() => {
  if (autoStart && socketConnected && !isStreaming) {
    handleStreamStart();  // Called TWICE due to StrictMode
  }
}, [autoStart, socketConnected, isStreaming, handleStreamStart]);
```

### 🔴 Issue #2: Multiple Component Instances

**Location:** `frontend/src/components/live/AdaptiveCameraGrid.tsx`

**Grid Mode** (line 181-189):
```tsx
{activeCameras.map((camera) => (
  <div key={camera.id} onClick={() => handleCameraClick(camera.id)}>
    <CameraStream camera={camera} autoStart={true} />
  </div>
))}
```

**Focused Mode** (line 173):
```tsx
<CameraStream camera={camera} autoStart={true} />
```

**Problem:**
- When user clicks camera to focus, NEW component mounts
- Old component still mounted in background
- Both request streams → 3rd connection created
- Backend sees same socket ID requesting same camera multiple times

### 🔴 Issue #3: Event Listener Multiplication

**Location:** `frontend/src/components/dashboard/CameraStream.tsx` line 269

```typescript
useEffect(() => {
  const handleFrame = (data: { cameraId: string; data: string }) => {
    if (data.cameraId !== camera.id) return;  // Filter by cameraId
    // Update image
  };
  
  const frameUnsubscribe = socketService.on('frame', handleFrame);
  // ...
}, [camera.id]);
```

**Problem:**
- Each component instance registers its own 'frame' listener
- SocketService stores callbacks in Map (line 6)
- Multiple CameraStream components = multiple callbacks for same event
- ALL callbacks receive EVERY frame (even with cameraId filtering)

**SocketService internals:**
```typescript
private callbacks: Map<string, Set<(...args: unknown[]) => void>> = new Map();

on(event: string, callback: (...args: unknown[]) => void) {
  if (!this.callbacks.has(event)) {
    this.callbacks.set(event, new Set());
  }
  this.callbacks.get(event)?.add(callback);  // Adds to Set
  this.socket?.on(event, callback);          // Registers with socket.io
}
```

### 🔴 Issue #4: Socket Room Management

**Backend** (`server/src/index.ts` lines 558-573):
```typescript
socket.on('requestStream', (data: { cameraId: string; role?: string }) => {
  const streamManager = (global as any).streamManager;
  const success = streamManager.startStream(cameraId, role);
  socket.join(`camera-${cameraId}-${role}`);  // Always joins room
  socket.emit('streamRequested', { cameraId, role, success: true });
});
```

**Problem:**
- NO deduplication - same socket can join room multiple times
- Socket.io adapter doesn't prevent duplicate joins
- Each join adds socket to room's Set
- Room size increases with each request

**Disconnect handling** (server/src/index.ts lines 604-624):
```typescript
socket.on('disconnect', () => {
  const cameras = streamManager.getAllCameras();
  cameras.forEach((camera) => {
    ['live', 'detect', 'record'].forEach((role) => {
      const room = io.sockets.adapter.rooms.get(`camera-${camera.id}-${role}`);
      const clientsInRoom = room ? room.size : 0;
      
      if (clientsInRoom === 0) {
        streamManager.stopStream(camera.id, role);  // Stops FFmpeg
      }
    });
  });
});
```

---

## Mobile Access Failure Analysis

### 🔴 Issue #5: Socket.io Configuration Problem

**Location:** `frontend/src/services/SocketService.ts` lines 56-73

```typescript
const transports = ['websocket', 'polling'];  // Prefer websocket

this.socket = io(socketUrl, {
  transports,
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  reconnectionAttempts: 10,
  path: '/socket.io',
  timeout: 20000,
  forceNew: true,       // ⚠️ Creates new connection on each connect()
  autoConnect: true,
  randomizationFactor: 0.5,
  upgrade: true,
  rememberUpgrade: false
});
```

**Problems for Mobile:**

1. **`forceNew: true`** - Creates new socket instance instead of reusing
   - iOS Safari limits number of WebSocket connections
   - Can cause "Too many connections" errors

2. **`rememberUpgrade: false`** - Doesn't remember successful upgrade
   - Forces WebSocket upgrade attempt every time
   - Some mobile proxies block WebSocket upgrade

3. **Transport ordering** - WebSocket first, then polling
   - WebSocket has higher overhead on mobile
   - Should start with polling, upgrade if supported

4. **Binary frame handling** - Using base64 encoding (rtspManager.ts line 471)
   - Base64 adds 33% size overhead
   - Mobile browsers decode base64 slower than ArrayBuffer

### 🔴 Issue #6: No Mobile-Specific Optimizations

**Missing:**
- No user agent detection for mobile browsers
- No reduced FPS for mobile
- No lower resolution options for mobile
- No bandwidth detection
- No connection quality monitoring

**Current adaptive FPS** (rtspManager.ts lines 209-220):
```typescript
private getOptimalFps(viewerCount: number): number {
  if (viewerCount === 0) return 1;
  if (viewerCount <= 3) return 4;  // Too high for mobile
  if (viewerCount <= 10) return 3;
  if (viewerCount <= 20) return 2;
  return 1;
}
```

---

## Connection Flow Diagram

```
User opens Dashboard page
  ↓
StreamDashboard renders
  ↓
AdaptiveCameraGrid renders (2 cameras)
  ↓
React.StrictMode double-mounts components
  ↓
Mount 1: CameraStream(cam1) → requestStream('cam1') → join room
Mount 2: CameraStream(cam1) → requestStream('cam1') → join room AGAIN
Mount 1: CameraStream(cam2) → requestStream('cam2') → join room
Mount 2: CameraStream(cam2) → requestStream('cam2') → join room AGAIN
  ↓
Backend receives 4 stream requests
  ↓
Backend starts FFmpeg for cam1 (first request)
Backend sees duplicate cam1 request (just joins room)
Backend starts FFmpeg for cam2 (first request)
Backend sees duplicate cam2 request (just joins room)
  ↓
Frames emitted to rooms
  ↓
Frontend receives frames for BOTH components
  ↓
User clicks cam1 to focus
  ↓
NEW CameraStream(cam1) mounts (3rd instance!)
  ↓
requestStream('cam1') → joins room AGAIN
  ↓
Backend sees room has 3 "viewers" (all same socket ID!)
```

---

## Current Connection Count

### Desktop Browser (Development):
- **Camera 1:** 3 connections
  - 2x from grid view (StrictMode double-mount)
  - 1x from focused view (user clicked)
- **Camera 2:** 2 connections
  - 2x from grid view (StrictMode double-mount)

### Production (no StrictMode):
- **Camera 1:** 2 connections
  - 1x from grid view
  - 1x from focused view
- **Camera 2:** 1 connection
  - 1x from grid view

### Mobile Browser:
- **0 connections** - Socket.io configuration incompatible
- Or **1 connection** that frequently drops
- `forceNew: true` causes connection churn

---

## Code Locations Summary

### Backend:
1. **`server/src/streams/rtspManager.ts`** (900 lines)
   - Lines 33-61: Camera interface (mainProcess, activeRoles)
   - Lines 114-206: setupConnectionTracking() - viewer management
   - Lines 317-507: startStream() - FFmpeg process management
   - Lines 449-483: Frame emission to rooms

2. **`server/src/index.ts`** (635 lines)
   - Lines 554-625: Socket.io connection handling
   - Lines 558-573: requestStream handler
   - Lines 576-602: stopStream handler
   - Lines 604-624: disconnect handler

3. **`server/src/streams/streamHealthMonitor.ts`** (247 lines)
   - Lines 68-94: recordFrameEmitted() - health tracking
   - Lines 96-129: performHealthCheck() - stale stream detection

### Frontend:
1. **`frontend/src/main.tsx`** (70 lines)
   - Line 65: `<StrictMode>` wrapper

2. **`frontend/src/services/SocketService.ts`** (236 lines)
   - Lines 56-73: Socket connection config (forceNew: true)
   - Lines 169-177: requestStream() method
   - Lines 188-205: on() event listener registration

3. **`frontend/src/contexts/CameraContext.tsx`** (295 lines)
   - Lines 213-230: startCameraStream() method
   - Lines 233-243: stopCameraStream() method

4. **`frontend/src/components/dashboard/CameraStream.tsx`** (439 lines)
   - Lines 26-27: Component mount log
   - Lines 146-164: Auto-start effect
   - Lines 167-181: Socket connection effect
   - Lines 184-280: Frame event listener effect
   - Line 269: Registers 'frame' listener

5. **`frontend/src/components/live/AdaptiveCameraGrid.tsx`** (196 lines)
   - Line 173: Focused mode CameraStream
   - Line 188: Grid mode CameraStream (multiple instances)

6. **`frontend/src/pages/StreamDashboard.new.tsx`** (352 lines)
   - Line 309-313: Renders AdaptiveCameraGrid

---

## Recommended Solutions

### Immediate Fixes (Critical):

1. **Remove React.StrictMode in production**
   - Already only in dev mode, but document this behavior

2. **Prevent duplicate stream requests**
   - Track requested streams in CameraContext
   - Only request if not already streaming

3. **Fix component lifecycle**
   - Unmount old CameraStream when focusing new one
   - Use key prop to force remount instead of parallel instances

4. **Fix Socket.io mobile compatibility**
   - Remove `forceNew: true`
   - Set `rememberUpgrade: true`
   - Start with polling, upgrade to websocket
   - Use ArrayBuffer instead of base64 for mobile

### Long-term Solutions:

5. **Implement single persistent background stream**
   - Start FFmpeg when camera comes online
   - Keep running regardless of viewers
   - Clients join/leave room as needed

6. **Add mobile detection**
   - Reduce FPS for mobile (1-2 FPS)
   - Lower resolution (640x360)
   - Prefer polling transport

7. **Implement connection pooling**
   - One socket.io connection per tab
   - Multiplex all streams over single connection
   - Use rooms for routing

8. **Add connection monitoring**
   - Track active socket connections
   - Alert on duplicate connections
   - Auto-cleanup stale connections

