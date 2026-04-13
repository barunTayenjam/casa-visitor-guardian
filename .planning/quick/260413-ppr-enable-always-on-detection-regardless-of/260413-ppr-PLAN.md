---
phase: quick
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - server/src/streams/rtspManager.ts
autonomous: true
requirements: []
must_haves:
  truths:
    - "Detection runs continuously regardless of viewer presence"
    - "Camera detect stream stays active when no clients are watching live view"
  artifacts:
    - path: server/src/streams/rtspManager.ts
      contains: "detect role protection"
  key_links:
    - from: rtspManager.ts stopStream
      to: activeRoles.delete('detect')
      via: viewer count check
---

<objective>
Enable always-on detection regardless of viewers - auto-start detect role on camera init and never stop it when viewers disconnect.

Purpose: Motion detection should run 24/7 independent of whether anyone is viewing the live stream. Currently, when all viewers disconnect, detection stops because streams are auto-stopped.
Output: Modified rtspManager.ts with always-on detect role
</objective>

<execution_context>
@$HOME/.config/opencode/get-shit-done/workflows/execute-plan.md
@$HOME/.config/opencode/get-shit-done/templates/summary.md
</execution_context>

<context>
From server/src/streams/rtspManager.ts (lines 178-183):
```typescript
// Stop stream if no more viewers
if (viewerCount === 0 && camera.activeRoles.has('live')) {
  this.stopStream(cameraId, 'live');
```

Same pattern at lines 198-199. The 'live' role already has viewer-based protection. Need to add similar logic to prevent 'detect' from being stopped when viewers disconnect.

From server/src/index.ts (lines 590-600):
```typescript
// Only stop the stream if no clients are left in the room
if (clientsInRoom === 0) {
  const success = streamManager.stopStream(cameraId, role);
```

This is where detect gets stopped when all viewers leave. The fix should ensure detect role is never auto-stopped.
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add detect role always-on protection in rtspManager.ts</name>
  <files>server/src/streams/rtspManager.ts</files>
  <action>
In rtspManager.ts, modify the viewer-count based stream stopping logic at TWO locations:

1. Lines ~178-183: Change from:
```typescript
if (viewerCount === 0 && camera.activeRoles.has('live')) {
  this.stopStream(cameraId, 'live');
```
To:
```typescript
if (viewerCount === 0 && camera.activeRoles.has('live')) {
  this.stopStream(cameraId, 'live');
}
// CRITICAL: Never stop detect role regardless of viewer count
if (viewerCount === 0 && camera.activeRoles.has('detect')) {
  console.log(`[StreamManager] Keeping detect stream active for camera ${cameraId} (always-on)`);
  camera.activeRoles.add('detect'); // Re-add if somehow removed
}
```

2. Lines ~198-199: Same pattern - add protection for 'detect' role.

The key insight: 'live' role stops when viewers=0, but 'detect' role must ALWAYS remain active regardless of viewer count.
  </action>
  <verify>
    <automated>grep -n "detect.*always-on\|Keeping detect" server/src/streams/rtspManager.ts</automated>
  </verify>
  <done>Detect stream never stops even when viewer count is zero</done>
</task>

</tasks>

<verification>
After making changes, detection should run continuously:
1. Start server - detect stream auto-starts for all cameras
2. Open browser to view live stream - both live and detect running
3. Close browser/close all viewer connections
4. Verify detect stream remains active (motion events still generated)
</verification>

<success_criteria>
- Detect role is explicitly protected from auto-stop
- Camera detect stream stays running when all live viewers disconnect
- No regression: live and record streams still work as before
</success_criteria>

<output>
After completion, create .planning/quick/260413-ppr-enable-always-on-detection-regardless-of/260413-ppr-SUMMARY.md
</output>
