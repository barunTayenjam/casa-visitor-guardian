# Phase 9: Streaming UI Simplification - Implementation Plan

**Created:** 2026-03-27
**Status:** Ready for implementation
**Context:** `.planning/phases/09-streaming-ui-simplification/09-CONTEXT.md`

---

## Phase Boundary

Simplify the streaming interface from 7 overlapping overlay layers to a clean video feed with camera name + status dot, and a tap-to-toggle slide-up panel containing all other information.

---

## Implementation Overview

**Current state:** CameraStream.tsx renders 7 overlapping layers (MotionAlertOverlay, QualityWarning, StreamQualityIndicator, ConnectionStateOverlay, inline camera name, inline timestamp, inline controls) — all fighting for screen real estate.

**Target state:** Clean video feed with only camera name + connection status dot. Single tap reveals a slide-up drawer panel with alerts, quality metrics, controls, and recent events.

---

## Plan 9.1: Create StreamPanel Component

**Goal:** Build a reusable slide-up drawer panel that consolidates all overlay information.

**User Value:** Single access point for all stream information — no more visual clutter.

### Tasks

#### 9.1.1 Create StreamPanel Drawer Component
**Files:** `frontend/src/components/live/StreamPanel.tsx` (new)
**Effort:** 4 hours

Build slide-up panel using shadcn Drawer component:

```tsx
interface StreamPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  camera: Camera;
  // Metrics
  displayFps: number;
  bandwidth: number;
  latency: number;
  // Motion
  motionDetected: boolean;
  motionConfidence: number;
  objectCount: number;
  // Actions
  onScreenshot: () => void;
  onFullscreen: () => void;
}
```

Panel sections (top to bottom):
1. **Handle bar** — drag indicator, tap to dismiss
2. **Connection status** — green/yellow/red with text
3. **Quality metrics** — FPS, bandwidth, latency, resolution (reuse StreamQualityIndicator inline)
4. **Motion alerts** — current alert if active (reuse MotionAlertOverlay compact mode)
5. **Recent detections** — last 3 events as small thumbnails
6. **Control buttons** — screenshot, fullscreen, mute in a row

Use `DrawerContent` from shadcn/ui. Animation: 200-300ms slide-up.

**Acceptance:**
- [ ] Panel slides up smoothly on open
- [ ] Panel slides down on dismiss (swipe down or tap outside)
- [ ] All sections render correctly
- [ ] Dark mode compatible
- [ ] Accessible (ARIA labels, keyboard dismiss with Escape)

#### 9.1.2 Create QualitySection Component
**Files:** `frontend/src/components/live/QualitySection.tsx` (new)
**Effort:** 2 hours

Extract quality display into a compact section for the panel:
- FPS with color coding (green > 20, yellow > 10, red < 10)
- Bandwidth in Kbps/Mbps
- Latency in ms
- Resolution from camera config

Reuse logic from StreamQualityIndicator but in a compact horizontal layout.

**Acceptance:**
- [ ] All 4 metrics display correctly
- [ ] Color coding matches StreamQualityIndicator
- [ ] Compact layout fits in panel

#### 9.1.3 Create RecentDetectionsSection Component
**Files:** `frontend/src/components/live/RecentDetectionsSection.tsx` (new)
**Effort:** 2 hours

Show last 3 motion events as small thumbnails in the panel:
- Thumbnail image
- Timestamp (relative: "2m ago")
- Object type + confidence

Fetch from existing events API or cache from socket events.

**Acceptance:**
- [ ] Shows last 3 events
- [ ] Thumbnails load correctly
- [ ] Tapping an event navigates to event detail
- [ ] Empty state when no recent events

---

## Plan 9.2: Simplify CameraStream to Clean Feed

**Goal:** Strip CameraStream down to show only video + camera name + status dot.

**User Value:** Clean, immersive video feed with no visual clutter.

### Tasks

#### 9.2.1 Remove Inline Overlays from CameraStream
**Files:** `frontend/src/components/dashboard/CameraStream.tsx`
**Effort:** 3 hours

Remove from CameraStream's render:
- QualityWarning component
- StreamQualityIndicator component
- MotionAlertOverlay component (move state to panel)
- Inline timestamp display
- Inline screenshot/fullscreen buttons

Keep only:
- Video `<img>` element
- Camera name pill (top-left, compact)
- Connection status dot (next to name: green/yellow/red)
- ConnectionStateOverlay (connecting/error — full screen, temporary)
- Thumbnail placeholder (during reconnect)

**Acceptance:**
- [ ] Only video + name + status dot visible
- [ ] No overlapping overlays
- [ ] Connection state overlay still shows during connecting/error
- [ ] All metrics state still tracked (passed to panel)

#### 9.2.2 Add Tap-to-Toggle Panel to CameraStream
**Files:** `frontend/src/components/dashboard/CameraStream.tsx`
**Effort:** 2 hours

Add panel toggle logic:
```tsx
const [panelOpen, setPanelOpen] = useState(false);

// Toggle panel on tap (but not on swipe — swipe is for camera switching)
const handleTap = (e: React.MouseEvent) => {
  // Only toggle if not a swipe gesture
  if (!swipeInProgress) {
    setPanelOpen(prev => !prev);
  }
};
```

Wire up StreamPanel with all the metrics/motion state that was removed from inline display.

**Acceptance:**
- [ ] Tap on video toggles panel open/closed
- [ ] Swipe doesn't trigger panel (only camera switch)
- [ ] Panel receives all current metrics and motion data
- [ ] Panel dismisses on swipe down or tap outside

#### 9.2.3 Simplify Connection Status Display
**Files:** `frontend/src/components/dashboard/CameraStream.tsx`
**Effort:** 1 hour

Replace complex ConnectionStateOverlay with minimal status dot:
- Connected: small green dot next to camera name
- Connecting: pulsing yellow dot
- Error: red dot + brief error text

Keep full ConnectionStateOverlay only for initial connection (first 5 seconds) or persistent errors.

**Acceptance:**
- [ ] Status dot shows correct color
- [ ] Dot pulses during connecting
- [ ] Error shows brief text
- [ ] Full overlay only for initial connection or errors

---

## Plan 9.3: Implement Swipe Camera Switching

**Goal:** Add smooth swipe left/right to switch between cameras in focused view.

**User Value:** Fast, intuitive camera navigation without buttons.

### Tasks

#### 9.3.1 Add Swipe Camera Switching to AdaptiveCameraGrid
**Files:** `frontend/src/components/live/AdaptiveCameraGrid.tsx`
**Effort:** 3 hours

Extend existing swipe support for full camera switching:
- Swipe left: next camera
- Swipe right: previous camera
- Smooth horizontal slide transition (CSS transform)
- Camera name updates during transition
- Loop from last to first camera

Reuse existing touch event handling from Phase 8.3 swipe gestures.

**Acceptance:**
- [ ] Swipe left switches to next camera
- [ ] Swipe right switches to previous camera
- [ ] Transition is smooth (200-300ms)
- [ ] Camera name updates correctly
- [ ] Works on mobile and desktop (drag)
- [ ] Keyboard: left/right arrow keys switch cameras

#### 9.3.2 Add Camera Position Indicator
**Files:** `frontend/src/components/live/AdaptiveCameraGrid.tsx`
**Effort:** 1 hour

Show which camera is active in focused view:
- Small dots at bottom center of feed
- Active dot is larger/brighter
- Tap a dot to jump to that camera

Reuse existing camera dots from Phase 8.3.

**Acceptance:**
- [ ] Dots show correct count
- [ ] Active camera dot is highlighted
- [ ] Tapping a dot switches to that camera
- [ ] Dots don't obstruct video content

---

## Plan 9.4: Clean Up Dead Code and Z-Index Layering

**Goal:** Remove unused components and simplify CSS layering.

**User Value:** Cleaner codebase, fewer bugs from conflicting overlays.

### Tasks

#### 9.4.1 Remove Dead CameraFeed Component
**Files:** `frontend/src/components/live/CameraFeed.tsx`
**Effort:** 1 hour

CameraFeed duplicates CameraStream's overlay logic with a different data model (`camera.streamUrl` vs socket). It's not imported by any active page.

- Verify no imports reference CameraFeed
- Delete the file
- Remove any related imports/types

**Acceptance:**
- [ ] No broken imports after deletion
- [ ] Build passes

#### 9.4.2 Consolidate Z-Index Layering
**Files:** `frontend/src/components/dashboard/CameraStream.tsx`, `frontend/src/components/live/AdaptiveCameraGrid.tsx`
**Effort:** 1 hour

Simplify z-index to 3 tiers:
- `z-0` — Video feed (background)
- `z-10` — HUD elements (camera name, status dot)
- `z-30` — Modal elements (connection state overlay, stream panel)

Remove conflicting z-20, z-25 values.

**Acceptance:**
- [ ] All overlays use consistent z-index values
- [ ] No visual conflicts between layers
- [ ] Panel appears above everything

#### 9.4.3 Extract Overlay State from CameraStream
**Files:** `frontend/src/components/dashboard/CameraStream.tsx`
**Effort:** 2 hours

CameraStream owns 7+ pieces of overlay state. Consolidate:
- Group metrics into a single `streamMetrics` object
- Pass metrics to StreamPanel as a single prop
- Keep motion state separate (frequently updated)

```tsx
interface StreamMetrics {
  fps: number;
  bandwidth: number;
  latency: number;
  resolution: string;
}
```

**Acceptance:**
- [ ] Metrics grouped into StreamMetrics interface
- [ ] StreamPanel receives consolidated props
- [ ] No loss of real-time update behavior
- [ ] CameraStream line count reduced by ~30%

---

## Success Metrics

**User Experience:**
- Stream view shows only video + name + status by default
- Single tap reveals all info in a smooth slide-up panel
- Camera switching feels instant with swipe gestures
- No visual clutter or competing overlays

**Technical:**
- CameraStream.tsx reduced from ~487 lines to ~300 lines
- New StreamPanel.tsx: ~200 lines
- Z-index conflicts eliminated
- Dead code removed

---

## Dependencies

### Required
- ✅ Phase 8 (UI/UX Improvements) — Complete
- ✅ shadcn/ui Drawer component — Available
- ✅ Tailwind CSS with dark mode — Ready

### Components to Refactor
- CameraStream.tsx — Strip overlays, add panel toggle
- AdaptiveCameraGrid.tsx — Add swipe camera switching

### New Components
- StreamPanel.tsx — Slide-up drawer
- QualitySection.tsx — Compact quality display
- RecentDetectionsSection.tsx — Recent event thumbnails

---

*Plan created: 2026-03-27*
*Phase: 09-streaming-ui-simplification*
