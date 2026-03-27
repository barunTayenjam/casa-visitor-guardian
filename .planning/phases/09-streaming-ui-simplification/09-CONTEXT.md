# Phase 9: Streaming UI Simplification - Context

**Gathered:** 2026-03-27
**Status:** Ready for planning

<domain>
## Phase Boundary

Simplify the streaming interface to feel seamless and immersive. The current view has 8 overlay components competing for attention on a single video feed. This phase reduces visual clutter to just camera name + connection status, with all other information accessible via a tap-to-toggle slide-up panel.

</domain>

<decisions>
## Implementation Decisions

### Overlay Reduction
- **Always visible:** Camera name + connection status dot only (green/red)
- **Hidden by default:** QualityWarning, StreamQualityIndicator, MotionAlertOverlay, AlertGroup, DetectionOverlay, ConnectionStateOverlay (connecting/reconnecting states), RecentDetectionsCarousel
- **Reveal mechanism:** Single tap on video feed toggles a slide-up panel
- **Tap again to dismiss** — familiar mobile pattern

### Control Layout
- Camera controls (screenshot, fullscreen, mute) live in a **bottom row inside the slide-up panel**
- Controls displayed as icon buttons in a horizontal row
- Consistent with mobile app patterns (iOS/Android bottom sheets)

### Navigation Flow
- **Swipe left/right** to switch between cameras (carousel pattern)
- Camera name updates to show which camera is active
- Swipe gestures work on mobile; desktop can use keyboard arrows

### Visual Hierarchy
- **First impression:** Clean video feed with only camera name + status dot
- No metrics, no alerts, no controls visible by default
- Maximum immersion — video is the hero element
- User taps to see everything else

### Transitions
- Slide-up panel should animate smoothly (200-300ms ease-out)
- Camera switching should have a subtle horizontal slide transition
- No jarring pop-ins or instant appearances

### Claude's Discretion
- Exact panel height, animation timing, and icon choices left to implementation
- Whether to persist panel state across camera switches (open panel stays open vs auto-close)

</decisions>

<canonical_refs>
## Canonical References

### Existing Components (to refactor/simplify)
- `frontend/src/components/live/MotionAlertOverlay.tsx` — Move to panel
- `frontend/src/components/live/AlertGroup.tsx` — Move to panel
- `frontend/src/components/dashboard/QualityWarning.tsx` — Move to panel
- `frontend/src/components/dashboard/StreamQualityIndicator.tsx` — Move to panel
- `frontend/src/components/live/ConnectionStateOverlay.tsx` — Keep connecting/error states minimal, move details to panel
- `frontend/src/components/dashboard/DetectionOverlay.tsx` — Move to panel or toggle
- `frontend/src/components/live/CameraFeedControls.tsx` — Move to panel bottom row
- `frontend/src/components/live/RecentDetectionsCarousel.tsx` — Move to panel

### Key Files
- `frontend/src/components/dashboard/CameraStream.tsx` — Main stream component, needs simplification
- `frontend/src/components/live/AdaptiveCameraGrid.tsx` — Grid layout, needs swipe support
- `frontend/src/components/live/CameraFeed.tsx` — Individual feed wrapper

No external specs — requirements fully captured in decisions above.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `MotionAlertOverlay` — Already has severity-based styling (Phase 8.1), can be moved into panel as-is
- `StreamQualityIndicator` — Compact display ready (Phase 8.2), fits in panel
- `CameraFeedControls` — Has screenshot/fullscreen buttons, can be restyled for panel bottom row
- `useSwipeable` pattern — Already implemented in AdaptiveCameraGrid (Phase 8.3), can be reused for camera switching

### Established Patterns
- shadcn/ui components (Sheet, Drawer) — Can use for slide-up panel implementation
- Tailwind CSS with dark mode support — Styling will use existing tokens
- Socket.io for real-time data — No changes needed to data layer

### Integration Points
- `CameraStream.tsx` — Primary file to refactor (remove overlays, add panel toggle)
- `AdaptiveCameraGrid.tsx` — Add swipe camera switching
- New component needed: `StreamPanel.tsx` — Slide-up panel containing all hidden overlays

</code_context>

<specifics>
## Specific Ideas

- Slide-up panel similar to iOS bottom sheets or Android bottom drawers
- Connection status dot: green (connected), yellow (connecting), red (error)
- Camera name in top-left corner, small and unobtrusive
- Panel should show: motion alerts, quality metrics, detection info, recent events, controls
- Swipe gestures already partially implemented in AdaptiveCameraGrid — extend to full camera switching

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 09-streaming-ui-simplification*
*Context gathered: 2026-03-27*
