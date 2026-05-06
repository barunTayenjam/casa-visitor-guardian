---
phase: quick-stream-reconnect
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - frontend/src/components/dashboard/CameraStream.tsx
autonomous: true
requirements: []
---

<objective>
Fix live stream not auto-loading after tablet screen freezes and returns. The stream freezes and doesn't reconnect when the screen comes back.

Purpose: Ensure stream auto-reconnects after device wake/screen unfreeze
Output: Updated CameraStream.tsx with stream freeze detection and reconnection
</objective>

<context>
@frontend/src/components/dashboard/CameraStream.tsx

## Issue Analysis

**Current behavior (lines 245-260):**
- Visibility handler only restarts stream if `connectionState === 'idle'`
- Doesn't handle case where stream was actively streaming before freeze

**Problem:**
1. On tablet screen freeze (sleep), the stream freezes but connectionState may remain 'connected'
2. When screen returns, visibility handler checks `connectionState === 'idle'` - fails
3. Stream stays frozen with old frames, no new frames arriving

**Root causes:**
1. Stream freeze not detected (no frame timeout monitoring)
2. Visibility handler only works for 'idle' state, not 'connected' but frozen
3. No forced stream restart when frames stop arriving after device wake

**Related (commit f61f441):**
- Previous fix for device wake but didn't cover all tablet scenarios
</context>

<tasks>

<task type="auto">
  <name>Add stream freeze detection with frame timeout</name>
  <files>frontend/src/components/dashboard/CameraStream.tsx</files>
  <action>
    1. Add a ref to track last frame timestamp: `lastFrameTimeRef`
    2. Add a constant for STREAM_FREEZE_TIMEOUT = 5000ms (5 seconds)
    3. In the useEffect that handles frames (line 275+), update lastFrameTimeRef.current = Date.now() each time a frame arrives
    4. Add a useEffect that monitors frame freshness:
       - Use setInterval (every 1 second) to check if (Date.now() - lastFrameTimeRef.current) > STREAM_FREEZE_TIMEOUT
       - When frozen detected AND socket is connected AND autoStart is true, trigger stream restart
       - This ensures stream restarts even if connectionState still shows 'connected'
  </action>
  <verify>
    Stream freezes after 5 seconds of no frames, auto-restarts when frames resume
  </verify>
  <done>
    Stream automatically reconnects after tablet wake even if socket stayed connected
  </done>
</task>

<task type="auto">
  <name>Fix visibility handler to handle frozen stream states</name>
  <files>frontend/src/components/dashboard/CameraStream.tsx</files>
  <action>
    1. Modify the visibility handler (lines 245-260) to also check:
       - Add condition: `|| (connectionState === 'connected' && isStreaming)` to restart stream when page becomes visible
    2. When restarting after visibility change, force a complete stream restart:
       - Call stopCameraStream() first, then handleStreamStart()
       - This ensures clean reconnection rather than trying to reuse stale transport
  </action>
  <verify>
    Manual test: freeze stream, minimize browser, restore - stream restarts
  </verify>
  <done>
    Visibility handler now handles both idle and connected-but-frozen states
  </done>
</task>

<task type="auto">
  <name>Add visibility change handler to SocketService for transport recovery</name>
  <files>frontend/src/services/SocketService.ts</files>
  <action>
    In SocketService, add a visibility change listener that:
    1. When page becomes visible, check if socket is connected but might have stale transport
    2. If transport might be stale (e.g., using polling on mobile), trigger a quick reconnection check
    3. Use socket.io's 'force close' on transport if needed: `this.socket?.io.engine.close()`
    This ensures the transport layer recovers properly after tablet wake, not just the stream
  </action>
  <verify>
    Socket transport properly reconnects on tablet wake
  </verify>
  <done>
    Socket transport recovers in addition to stream restart
  </done>
</task>

</tasks>

<verification>
- [ ] Stream auto-reconnects within 5 seconds after tablet screen returns
- [ ] No manual refresh required when returning to app after sleep
- [ ] Socket connection remains stable through multiple wake/sleep cycles
</verification>

<success_criteria>
Live stream auto-loads within 5 seconds after tablet screen unfreezes. User does not need to manually refresh the page.
</success_criteria>

<output>
After completion, create .planning/quick/260418-stream-freeze-reconnect-tablet/quick-01-SUMMARY.md
</output>