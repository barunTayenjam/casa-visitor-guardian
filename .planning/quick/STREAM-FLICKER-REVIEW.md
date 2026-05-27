---
phase: quick-STREAM-FLICKER
reviewed: 2026-05-19T12:00:00Z
depth: standard
files_reviewed: 5
files_reviewed_list:
  - frontend/src/components/dashboard/CameraStream.tsx
  - frontend/src/services/SocketService.ts
  - frontend/src/App.tsx
  - frontend/src/components/live/AdaptiveCameraGrid.tsx
  - frontend/src/pages/StreamDashboard.tsx
findings:
  critical: 3
  warning: 4
  info: 4
  total: 11
status: issues_found
---

# Phase: Code Review Report — Stream Flicker Fix

**Reviewed:** 2026-05-19
**Depth:** standard
**Files Reviewed:** 5
**Status:** issues_found

## Summary

Reviewed 5 files modified for the stream flicker and old-stream-replay bug fix. While the `hasAutoStartedRef` guard addresses one symptom (infinite start/stop loop from `isStreaming` in deps), **the primary root cause of stream flicker is still present**: the freeze detection mixes `performance.now()` (time-since-page-load) with `Date.now()` (Unix epoch), causing every freeze check to be a false positive and triggering constant restarts of healthy streams. Additionally, the `SocketService` never clears its `requestedStreams` set on disconnect, making stream recovery after socket reconnection impossible.

Three critical bugs, four warnings, and four info items found.

---

## Critical Issues

### CR-01: Freeze detection mixes `performance.now()` and `Date.now()` — always triggers false positive restarts

**File:** `frontend/src/components/dashboard/CameraStream.tsx:246,354,458-465`
**Issue:** `lastFrameTimeRef.current` is set using `performance.now()` (line 246, line 465) but compared against `Date.now()` (line 354). `performance.now()` returns milliseconds since page navigation start (e.g., `50000`), while `Date.now()` returns Unix epoch milliseconds (e.g., `1747600000000`). The computed `timeSinceLastFrame = Date.now() - performance.now()` is always on the order of **1.7 trillion milliseconds**, which is always greater than both `MIN_TIME_BEFORE_CHECK` (10000) and `STREAM_FREEZE_TIMEOUT` (8000).

This means the freeze detection fires every interval tick (~3s), restarting a perfectly healthy stream every `RESTART_COOLDOWN_MS` (5s) until `MAX_FAILURE_COUNT` (3) is hit, then entering exponential backoff before repeating. This is the **primary cause of the flicker** — the fix was incomplete.

**Fix:**
```tsx
// Line 354: Use performance.now() consistently
// BEFORE (broken):
const timeSinceLastFrame = Date.now() - lastFrameTimeRef.current;

// AFTER (fixed):
const timeSinceLastFrame = performance.now() - lastFrameTimeRef.current;
```

---

### CR-02: `SocketService.requestedStreams` never cleared on disconnect — stream cannot recover after socket reconnect

**File:** `frontend/src/services/SocketService.ts:8,172-181,184-197`
**Issue:** The `requestedStreams` set tracks which camera streams have been requested to prevent duplicate `requestStream` emissions. When the socket disconnects (`disconnect()` at line 172-181), this set is **never cleared**. When `CameraStream` detects the socket reconnect (line 411-413) and calls `handleStreamStart` → `startCameraStream` → `socketService.requestStream(id)`, the `requestStream` method (line 187-188) finds the key still in `requestedStreams` and returns early **without emitting the request**. The stream never recovers.

The `disconnect()` method clears the socket and callbacks but omits `requestedStreams`. The `stopStream` method is the only place that removes entries, but it is never called during a socket disconnect cycle in `CameraStream` — the disconnect handler (line 336-339) only changes state to `'reconnecting'` and resets `hasAutoStartedRef`.

**Fix:**
```tsx
// In SocketService.disconnect(), add:
disconnect() {
  if (!this.socket) {
    return;
  }
  this.socket.removeAllListeners();
  this.socket.disconnect();
  this.socket = null;
  this.isConnecting = false;
  this.requestedStreams.clear(); // <-- ADD THIS LINE
}
```

Additionally, clearing on reconnect in the `connect` handler is a belt-and-suspenders improvement:
```tsx
// In SocketService connect() 'connect' event handler, before re-registering callbacks:
this.requestedStreams.clear();
```

---

### CR-03: Connection timeout handler does not reset `hasAutoStartedRef` — stream stuck in error state after timeout

**File:** `frontend/src/components/dashboard/CameraStream.tsx:251-256`
**Issue:** When the 10-second connection timeout fires (line 251-256), it sets `isStreaming(false)` and `connectionState('error')` but does **not** set `hasAutoStartedRef.current = false`. The auto-start useEffect (line 312) requires `!hasAutoStartedRef.current` to be true before attempting a restart. Since it remains `true`, the auto-start guard blocks recovery. The stream is permanently stuck in error state with no automatic retry path (only manual user interaction or a socket disconnect/reconnect cycle can clear it).

**Fix:**
```tsx
// Line 251-256: Add hasAutoStartedRef reset
connectionTimeoutRef.current = setTimeout(() => {
  streamActionRef.current = null;
  setConnectionState('error');
  setError('Connection timeout. Please try again.');
  setIsStreaming(false);
  hasAutoStartedRef.current = false; // <-- ADD THIS LINE
}, 10000);
```

---

## Warnings

### WR-01: Exponential backoff in `handleStreamRestart` races with auto-start useEffect

**File:** `frontend/src/components/dashboard/CameraStream.tsx:128-139`
**Issue:** The exponential backoff path (lines 128-139) sets `hasAutoStartedRef.current = false` and calls `handleStreamStopRef.current()`, which sets `isStreaming(false)`. This immediately triggers the auto-start useEffect (line 311-318) since all conditions are met: `autoStart && socketConnected && !isStreaming && !hasAutoStartedRef.current`. The stream restarts immediately via the useEffect, defeating the backoff delay. The backoff timeout then fires after `backoffMs` and attempts yet another restart (which may be blocked by `streamActionRef`, but the first restart already happened).

**Fix:** During backoff, either:
1. Use a separate `isBackingOffRef` flag that the auto-start useEffect checks, or
2. Don't reset `hasAutoStartedRef` until the backoff timeout fires.

```tsx
// Option 1: Add a backing-off guard
const isBackingOffRef = useRef(false);

// In handleStreamRestart backoff path:
isBackingOffRef.current = true;
// ... after backoff timeout fires:
isBackingOffRef.current = false;

// In auto-start useEffect:
if (autoStart && socketConnected && !isStreaming && !hasAutoStartedRef.current && !isBackingOffRef.current) {
```

---

### WR-02: `switchCameraWithAnimation` timeout never cleaned up

**File:** `frontend/src/components/live/AdaptiveCameraGrid.tsx:37-56`
**Issue:** `switchCameraWithAnimation` creates a `setTimeout` (line 50-53) and returns `() => clearTimeout(timeout)`, but none of its callers (lines 165, 356) use the return value. If the component unmounts during the 300ms animation, the timeout fires and updates state on an unmounted component. Rapid successive calls also accumulate orphaned timeouts.

**Fix:** Use a ref to track the timeout and clean it up on unmount:
```tsx
const animationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

const switchCameraWithAnimation = useCallback((direction: 'left' | 'right', targetCameraId: string) => {
  if (isTransitioningRef.current) return;
  // Clear any previous animation timeout
  if (animationTimeoutRef.current) clearTimeout(animationTimeoutRef.current);
  // ...
  animationTimeoutRef.current = setTimeout(() => {
    setIsAnimating(false);
    isTransitioningRef.current = false;
  }, 300);
  // Remove the return statement
}, []);

// In component cleanup useEffect:
useEffect(() => {
  return () => {
    if (animationTimeoutRef.current) clearTimeout(animationTimeoutRef.current);
  };
}, []);
```

---

### WR-03: Mouse drag event listeners leak on unmount

**File:** `frontend/src/components/live/AdaptiveCameraGrid.tsx:206-246`
**Issue:** `handleMouseDown` adds `mousemove` and `mouseup` listeners directly to `document` (lines 244-245). These are only removed in the `handleMouseUp` callback. If the component unmounts while a drag is in progress, the listeners are never removed, causing a memory leak and potential errors from updating unmounted component state.

**Fix:** Store the cleanup function and call it on unmount, or use a ref to track active listeners:
```tsx
const dragCleanupRef = useRef<(() => void) | null>(null);

// In handleMouseDown:
dragCleanupRef.current = () => {
  document.removeEventListener('mousemove', handleMouseMove);
  document.removeEventListener('mouseup', handleMouseUp);
};

// In handleMouseUp:
dragCleanupRef.current = null;

// In cleanup useEffect:
useEffect(() => {
  return () => {
    dragCleanupRef.current?.();
  };
}, []);
```

---

### WR-04: Uncleaned `setTimeout` inside `canRestartStream` rate-limit reset

**File:** `frontend/src/components/dashboard/CameraStream.tsx:114-117`
**Issue:** The `setTimeout` that resets `connectionAttemptsRef` after 60 seconds (line 114-117) is never tracked or cleaned up on unmount. While updating a ref on an unmounted component is harmless, it's a resource leak and inconsistent with the cleanup pattern used for other timers.

**Fix:** Store the timeout ref and clear it in a cleanup effect, or move the counter reset into the freeze detection interval callback.

---

## Info

### IN-01: Unused refs — `isMountedRef` and `lastFrameTimeForDisplayRef`

**File:** `frontend/src/components/dashboard/CameraStream.tsx:44,301`
**Issue:** `lastFrameTimeForDisplayRef` (line 44) and `isMountedRef` (line 301) are declared but never read. Dead code.

**Fix:** Remove both declarations.

---

### IN-02: Dead variable `activeCameras` in `StreamDashboard`

**File:** `frontend/src/pages/StreamDashboard.tsx:26`
**Issue:** `activeCameras` is computed on line 26 but never used. The `cameras` array (unfiltered) is passed directly to `AdaptiveCameraGrid` on line 33. The filtering logic is duplicated inside `AdaptiveCameraGrid` itself (line 60-63).

**Fix:** Remove line 26 (`const activeCameras = cameras.filter(...)`).

---

### IN-03: `console.log` in production code — `CameraStream.tsx`

**File:** `frontend/src/components/dashboard/CameraStream.tsx:99,105,112,130,142,360,390`
**Issue:** Multiple `console.log` debug statements with emoji prefixes remain in production code. These are visible in the browser console for end users.

**Fix:** Replace with the project's `logger` utility (imported in `CameraContext.tsx`) or remove.

---

### IN-04: `console.log` in production code — `AdaptiveCameraGrid.tsx`

**File:** `frontend/src/components/live/AdaptiveCameraGrid.tsx:122,131`
**Issue:** `console.log('Layout changed to:', newLayout)` and `console.log('Camera clicked:', cameraId)` remain in production code.

**Fix:** Remove or replace with the project's `logger` utility.

---

_Reviewed: 2026-05-19_
_Reviewer: the agent (gsd-code-reviewer)_
_Depth: standard_
