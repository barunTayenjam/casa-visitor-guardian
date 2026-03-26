# SentryVision Streaming Fixes - Quick Reference

## Priority 1: Critical Fixes (Implement Immediately)

### Fix #1: Prevent Duplicate Stream Requests
**File:** `frontend/src/services/SocketService.ts`
**Lines:** 169-177

```typescript
// BEFORE:
requestStream(cameraId: string, role: 'detect' | 'record' | 'live' = 'live') {
  console.log(`📡 SocketService: Requesting stream for camera ${cameraId} role ${role}, socket connected: ${this.socket?.connected}`);
  if (!this.socket?.connected) {
    console.warn('❌ Socket not connected, cannot request stream');
    return;
  }
  this.socket.emit('requestStream', { cameraId, role });
  console.log(`✅ SocketService: Stream request emitted for camera ${cameraId} role ${role}`);
}

// AFTER:
private requestedStreams: Set<string> = new Set();  // Add this property

requestStream(cameraId: string, role: 'detect' | 'record' | 'live' = 'live') {
  const streamKey = `${cameraId}-${role}`;
  
  // ✅ Deduplication check
  if (this.requestedStreams.has(streamKey)) {
    console.log(`⚠️ SocketService: Stream already requested for ${streamKey}, skipping`);
    return;
  }
  
  console.log(`📡 SocketService: Requesting stream for camera ${cameraId} role ${role}, socket connected: ${this.socket?.connected}`);
  if (!this.socket?.connected) {
    console.warn('❌ Socket not connected, cannot request stream');
    return;
  }
  
  this.requestedStreams.add(streamKey);
  this.socket.emit('requestStream', { cameraId, role });
  console.log(`✅ SocketService: Stream request emitted for camera ${cameraId} role ${role}`);
}

stopStream(cameraId: string, role: 'detect' | 'record' | 'live' = 'live') {
  const streamKey = `${cameraId}-${role}`;
  this.requestedStreams.delete(streamKey);  // ✅ Cleanup
  
  if (!this.socket?.connected) {
    return;
  }
  this.socket.emit('stopStream', { cameraId, role });
}
```

### Fix #2: Fix Socket.io Mobile Configuration
**File:** `frontend/src/services/SocketService.ts`
**Lines:** 56-73

```typescript
// BEFORE:
this.socket = io(socketUrl, {
  transports: ['websocket', 'polling'],
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  reconnectionAttempts: 10,
  path: '/socket.io',
  timeout: 20000,
  forceNew: true,        // ❌ PROBLEM: Creates new connection
  autoConnect: true,
  randomizationFactor: 0.5,
  upgrade: true,
  rememberUpgrade: false // ❌ PROBLEM: Forces re-upgrade
});

// AFTER:
const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

this.socket = io(socketUrl, {
  transports: isMobile ? ['polling', 'websocket'] : ['websocket', 'polling'], // ✅ Mobile-first for mobile
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  reconnectionAttempts: 10,
  path: '/socket.io',
  timeout: isMobile ? 30000 : 20000,  // ✅ Longer timeout for mobile
  forceNew: false,                      // ✅ Reuse connection
  autoConnect: true,
  randomizationFactor: 0.5,
  upgrade: true,
  rememberUpgrade: true                 // ✅ Remember successful upgrade
});
```

### Fix #3: Context-Level Stream Tracking
**File:** `frontend/src/contexts/CameraContext.tsx`
**Lines:** 44, 213-230

```typescript
// Add this state at line 44:
const [streamingCameras, setStreamingCameras] = useState<Set<string>>(new Set());

// Modify startCameraStream:
const startCameraStream = useCallback(async (id: string) => {
  try {
    // ✅ Check if already streaming
    if (streamingCameras.has(id)) {
      console.log(`⚠️ CameraContext: Camera ${id} already streaming, skipping`);
      return;
    }
    
    console.log(`🎬 CameraContext: Requesting stream for camera ${id}`);

    // Ensure socket is connected before requesting stream
    if (!socketService.isConnected()) {
      console.log(`Socket not connected, attempting to connect...`);
      await socketService.connect();
    }

    socketService.requestStream(id);
    setStreamingCameras(prev => new Set(prev).add(id));  // ✅ Track
    updateCamera(id, { status: 'online' });
    console.log(`✅ CameraContext: Stream request sent for camera ${id}`);
  } catch (err) {
    console.error(`Failed to start stream for camera ${id}:`, err);
    throw err;
  }
}, [socketService, updateCamera, streamingCameras]);

// Modify stopCameraStream:
const stopCameraStream = useCallback(async (id: string) => {
  try {
    console.log(`🛑 CameraContext: Stopping stream for camera ${id}`);
    socketService.socket?.emit('stopStream', { cameraId: id });
    setStreamingCameras(prev => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });  // ✅ Cleanup
    console.log(`✅ CameraContext: Stop request sent for camera ${id}`);
  } catch (err) {
    console.error(`Failed to stop stream for camera ${id}:`, err);
    throw err;
  }
}, [socketService]);
```

### Fix #4: Component Lifecycle Fix
**File:** `frontend/src/components/live/AdaptiveCameraGrid.tsx`
**Lines:** 156-177

```typescript
// BEFORE:
{focusedCameraId ? (
  <div className="w-full h-full flex items-center justify-center">
    {(() => {
      const camera = activeCameras.find(c => c.id === focusedCameraId);
      if (!camera) return null;
      return (
        <div className="relative w-full h-full bg-black max-h-screen">
          {/* Exit Focus Button */}
          <button onClick={() => handleCameraClick(camera.id)}>...</button>
          {/* Camera Stream */}
          <CameraStream camera={camera} autoStart={true} />
        </div>
      );
    })()}
  </div>
) : (
  // Grid mode with old components still mounted!
  <div className={getGridClasses()}>
    {activeCameras.map((camera) => (
      <div key={camera.id} onClick={() => handleCameraClick(camera.id)}>
        <CameraStream camera={camera} autoStart={true} />
      </div>
    ))}
  </div>
)}

// AFTER:
{focusedCameraId ? (
  // ✅ Focused mode: ONLY focused component mounted
  <div className="w-full h-full flex items-center justify-center">
    {(() => {
      const camera = activeCameras.find(c => c.id === focusedCameraId);
      if (!camera) return null;
      return (
        <div className="relative w-full h-full bg-black max-h-screen">
          <button onClick={() => handleCameraClick(camera.id)}>...</button>
          {/* ✅ Use key to force remount on change */}
          <CameraStream key={`focused-${camera.id}`} camera={camera} autoStart={true} />
        </div>
      );
    })()}
  </div>
) : (
  // ✅ Grid mode: Only grid components mounted
  <div className={getGridClasses()}>
    {activeCameras.map((camera) => (
      <div key={camera.id} onClick={() => handleCameraClick(camera.id)}>
        <CameraStream key={`grid-${camera.id}`} camera={camera} autoStart={true} />
      </div>
    ))}
  </div>
)}
```

### Fix #5: Backend Room Deduplication
**File:** `server/src/index.ts`
**Lines:** 558-573

```typescript
// BEFORE:
socket.on('requestStream', (data: { cameraId: string; role?: 'detect' | 'record' | 'live' }) => {
  const { cameraId, role = 'live' } = data;
  console.log(`Stream requested for camera: ${cameraId} role: ${role} by client: ${socket.id}`);
  const streamManager = (global as any).streamManager;
  if (streamManager) {
    const success = streamManager.startStream(cameraId, role);
    socket.join(`camera-${cameraId}-${role}`);  // ❌ NO DEDUPE CHECK
    socket.emit('streamRequested', { cameraId, role, success: true });
    console.log(`Client ${socket.id} joined room camera-${cameraId}-${role}`);
  } else {
    socket.emit('streamError', { cameraId, role, error: 'Stream manager not available' });
  }
});

// AFTER:
socket.on('requestStream', (data: { cameraId: string; role?: 'detect' | 'record' | 'live' }) => {
  const { cameraId, role = 'live' } = data;
  console.log(`Stream requested for camera: ${cameraId} role: ${role} by client: ${socket.id}`);
  const streamManager = (global as any).streamManager;
  if (streamManager) {
    const camera = streamManager.getCamera(cameraId);
    
    // ✅ Check if socket already in room
    const roomName = `camera-${cameraId}-${role}`;
    const socketRooms = socket.rooms;
    if (socketRooms.has(roomName)) {
      console.log(`⚠️ Socket ${socket.id} already in room ${roomName}, skipping join`);
      socket.emit('streamRequested', { cameraId, role, success: true, alreadyInRoom: true });
      return;
    }
    
    const success = streamManager.startStream(cameraId, role);
    socket.join(roomName);
    
    // ✅ Track in camera's activeViewers
    if (camera && !camera.activeViewers.has(socket.id)) {
      camera.activeViewers.add(socket.id);
    }
    
    socket.emit('streamRequested', { cameraId, role, success: true });
    console.log(`Client ${socket.id} joined room ${roomName} (stream was ${success ? 'started' : 'already active'})`);
  } else {
    socket.emit('streamError', { cameraId, role, error: 'Stream manager not available' });
  }
});

// Also update disconnect handler to cleanup activeViewers:
socket.on('disconnect', () => {
  console.log(`Client disconnected: ${socket.id}`);
  const streamManager = (global as any).streamManager;
  if (streamManager) {
    const cameras = streamManager.getAllCameras();
    cameras.forEach((camera: any) => {
      ['live', 'detect', 'record'].forEach((role) => {
        // ✅ Remove from activeViewers
        if (camera.activeViewers.has(socket.id)) {
          camera.activeViewers.delete(socket.id);
          const viewerCount = camera.activeViewers.size;
          console.log(`Camera ${camera.id} ${role}: ${viewerCount} viewers remaining`);
          
          // Check if we should stop the stream
          const room = io.sockets.adapter.rooms.get(`camera-${camera.id}-${role}`);
          const clientsInRoom = room ? room.size : 0;
          
          if (clientsInRoom === 0 && camera.activeRoles.has(role as 'live' | 'detect' | 'record')) {
            console.log(`Auto-stopping ${camera.id} ${role} stream (no clients after disconnect)`);
            streamManager.stopStream(camera.id, role as 'live' | 'detect' | 'record');
          }
        }
      });
    });
  }
});
```

---

## Priority 2: Important Improvements

### Fix #6: Mobile-Specific Optimizations
**File:** `frontend/src/components/dashboard/CameraStream.tsx`
**Lines:** 184-280

```typescript
useEffect(() => {
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  console.log(`[CameraStream] 🎧 Registering WebSocket listeners for ${camera.id}, mobile: ${isMobile}`);

  let lastFrameUpdate = 0;
  // ✅ Lower FPS for mobile
  const FRAME_UPDATE_INTERVAL = isMobile ? 500 : 66;  // 2 FPS mobile, 15 FPS desktop

  const handleFrame = (data: {
    cameraId: string;
    role: string;
    timestamp: string;
    data: string; // Base64 encoded JPEG
  }) => {
    if (data.cameraId !== camera.id) return;

    const now = Date.now();
    if (now - lastFrameUpdate >= FRAME_UPDATE_INTERVAL) {
      lastFrameUpdate = now;
      if (imgRef.current) {
        imgRef.current.src = `data:image/jpeg;base64,${data.data}`;
        // ... rest of frame handling
      }
    }
  };
  
  const frameUnsubscribe = socketService.on('frame', handleFrame);
  return () => {
    frameUnsubscribe();
  };
}, [camera.id]);
```

### Fix #7: Prevent StrictMode Issues in Production
**File:** `frontend/src/main.tsx`
**Lines:** 64-68

```typescript
// BEFORE:
root.render(
  <StrictMode>
    <App />
  </StrictMode>
);

// AFTER (Option 1 - Remove StrictMode):
root.render(
  <App />
);

// OR (Option 2 - Conditional StrictMode):
root.render(
  import.meta.env.DEV ? <StrictMode><App /></StrictMode> : <App />
);

// NOTE: Document that StrictMode causes double-mounting in development
// and that this is expected React behavior, not a bug.
```

---

## Testing Checklist

After implementing fixes, verify:

- [ ] Open browser DevTools → Network → WS tab
- [ ] Only ONE WebSocket connection per tab
- [ ] Request stream for camera 1
- [ ] Check Network tab: Only ONE `requestStream` message
- [ ] Switch to focused view
- [ ] Check Network tab: No additional `requestStream` for same camera
- [ ] Open mobile browser (iOS Simulator or Android)
- [ ] Verify connection uses polling first, then upgrades
- [ ] Verify streams load successfully on mobile
- [ ] Check console: No "Socket not connected" warnings
- [ ] Check console: No duplicate stream request logs

---

## Expected Results After Fixes

### Development (with StrictMode):
- Camera 1: 1 connection (deduplicated)
- Camera 2: 1 connection (deduplicated)
- Total: 2 connections (one per camera)

### Production (no StrictMode):
- Camera 1: 1 connection
- Camera 2: 1 connection
- Total: 2 connections (one per camera)

### Mobile Browser:
- 1 WebSocket connection (polling first, then upgrade)
- Streams load successfully
- Lower FPS (2 FPS instead of 4)
- No "too many connections" errors

---

## Long-Term Architecture Changes

### 1. Single Persistent Background Stream (Recommended)

Change architecture so FFmpeg runs continuously:

**Backend changes:**
- Start all camera streams on server startup
- Keep FFmpeg running even with no viewers
- Clients join/leave rooms as needed
- Send last cached frame immediately on join (no lag)

**Benefits:**
- Instant stream start (no FFmpeg startup delay)
- No connection storms when users open dashboard
- Predictable resource usage
- Better mobile experience

### 2. Connection Pooling

Implement true connection pooling:

- One Socket.io connection per browser tab
- Share across all components
- Use rooms for routing
- Proper cleanup on component unmount

**Benefits:**
- Reduced resource usage
- Better mobile performance
- Simplified debugging

### 3. Adaptive Quality

Implement quality adaptation based on:

- Device type (mobile/desktop)
- Network bandwidth
- Viewer count
- Battery level (mobile)

**Benefits:**
- Better mobile experience
- Reduced bandwidth usage
- Longer battery life on mobile

