---
phase: quick
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - frontend/src/contexts/SocketContext.tsx
  - frontend/src/components/dashboard/CameraStream.tsx
autonomous: true
must_haves:
  truths:
    - "Stream automatically reconnects when device wakes from sleep"
    - "Frontend requests stream after socket reconnection completes"
  artifacts:
    - path: "frontend/src/contexts/SocketContext.tsx"
      provides: "Socket connection state and reconnection handling"
    - path: "frontend/src/components/dashboard/CameraStream.tsx"
      provides: "Stream lifecycle management with visibility handling"
  key_links:
    - from: "SocketContext.tsx"
      to: "CameraStream.tsx"
      via: "socketConnected state change triggers stream re-request"
---

<objective>
Fix stream not reconnecting when device wakes from sleep. The frontend has visibilitychange handler but fails to reconnect when socket itself reconnects after network re-establishment.
</objective>

<context>
@frontend/src/services/SocketService.ts
@frontend/src/contexts/SocketContext.tsx
@frontend/src/components/dashboard/CameraStream.tsx
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add socket reconnection listener in CameraStream</name>
  <files>frontend/src/components/dashboard/CameraStream.tsx</files>
  <action>
Add a socket event listener for 'connect' that triggers stream re-request when:
- socket was previously disconnected (wasn't streaming but should have been)
- autoStart is enabled
- camera is configured for this stream

The issue: When device sleeps, socket disconnects. When device wakes, socket reconnects BUT the component doesn't know to re-request the stream. Add a useEffect that listens to socket 'connect' event and re-requests stream if conditions are met.
  </action>
  <verify>
    <automated>Typescript compiles without error: cd frontend && npm run typecheck 2>&1 | head -20</automated>
  </verify>
  <done>CameraStream emits requestStream after socket reconnect event when autoStart is enabled</done>
</task>

</tasks>

<verification>
1. Device sleeps (close laptop lid or let timeout occur)
2. Device wakes - socket reconnects
3. Stream automatically starts within 5 seconds
4. No manual intervention required
</verification>

<success_criteria>
- Stream auto-reconnects within 5 seconds of device wake
- No duplicate stream requests (handled by connection state)
- Works for both page visibility change and socket-level reconnection
</success_criteria>

<output>
After completion, create .planning/quick/260413-nuy-fix-stream-not-reconnecting-on-device-wa/260413-nuy-SUMMARY.md
</output>
