# Plan: Fix Streaming Page - Minimal Design

**Quick ID:** 260323-svj
**Created:** 2026-03-23
**Status:** Planning

## Overview

Simplify the streaming page (`StreamDashboard.new.tsx`) to focus on the core streaming experience. Remove clutter, ensure all elements work properly, and make the stream view the hero of the page.

## Current State Analysis

**File:** `frontend/src/pages/StreamDashboard.new.tsx` (352 lines)

**Features:**
- Wake lock toggle (working)
- Keyboard shortcuts help modal (working)
- Multiple navigation buttons (Analytics, Events, Batch Detection, Highlights)
- Camera grid with focus mode (working via AdaptiveCameraGrid)
- Snapshot functionality (needs verification)
- Settings button (working)
- Complex responsive layout

**Issues to Address:**
1. Too many navigation buttons cluttering the interface
2. Bottom action bar may be redundant
3. Wake lock button placement is awkward
4. Keyboard shortcuts are comprehensive but may be overkill for a simple streaming page
5. No clear indication of stream status/connectivity

## Tasks

### Task 1: Simplify Navigation Bar

**Files:**
- `frontend/src/pages/StreamDashboard.new.tsx`

**Action:**
1. Remove redundant navigation buttons from the top bar:
   - Remove Analytics button
   - Remove Batch Detection button
   - Remove Highlights button
2. Keep only essential navigation:
   - Events button (primary use case alongside streaming)
   - Settings button (for configuration)
3. Simplify camera status display
4. Make the logo/title clickable to return to dashboard

**Implementation:**
```typescript
// Simplified top nav with just:
// - Logo (clickable, shows keyboard help on click)
// - Camera count status
// - Events button
// - Settings button
// - Wake lock toggle (move to right side)
```

**Verify:**
- Navigation bar is visually cleaner
- All remaining buttons work correctly
- Clicking logo shows help (discovery pattern)

**Done:**
- Top navigation shows only 4 elements: logo, camera count, events, settings
- Wake lock moved to a subtle icon button

---

### Task 2: Enhance Stream Grid as Hero Element

**Files:**
- `frontend/src/pages/StreamDashboard.new.tsx`
- `frontend/src/components/live/AdaptiveCameraGrid.tsx` (verify current state)

**Action:**
1. Make the camera grid take up maximum available space
2. Add connection status indicators for each camera
3. Ensure focus mode works smoothly (toggle with click or 'f' key)
4. Add visual feedback for:
   - Connecting state
   - Live indicator
   - Frame drops/connection issues
5. Remove bottom action bar (move snapshot to individual camera controls)

**Implementation:**
```typescript
// Full-height grid without bottom bar
// Add status overlays to camera feeds
// Snapshot action moves to per-camera controls or context menu
```

**Verify:**
- Camera grid fills entire viewport
- Connection status is visible for each camera
- Clicking a camera toggles fullscreen focus mode
- No redundant bottom bar

**Done:**
- Stream grid is the clear focal point
- Status indicators are visible but not obtrusive
- Focus mode works intuitively

---

### Task 3: Verify and Clean Up Core Functionality

**Files:**
- `frontend/src/pages/StreamDashboard.new.tsx`
- Test snapshot endpoint

**Action:**
1. Test snapshot API endpoint: `POST /api/cameras/:id/snapshot`
2. Verify wake lock works on mobile devices
3. Test keyboard shortcuts and remove any that don't work
4. Remove help modal (use tooltip or simpler discovery pattern)
5. Add loading states for camera connections
6. Ensure proper cleanup on unmount

**Implementation:**
```typescript
// Verify all APIs work
// Remove non-functional keyboard shortcuts
// Add proper error handling for snapshot
// Add connection status polling
```

**Verify:**
- Snapshot API works and shows toast notification
- Wake lock toggles correctly
- Keyboard shortcuts that work: 'f' (fullscreen), '1' (streams), '2' (events), 's' (settings)
- Remove non-working shortcuts: 'l', 'b', 'h', 'r'
- Page cleans up properly when navigating away

**Done:**
- All features either work or are removed
- Page is stable and doesn't leak resources
- User has clear feedback for all actions

---

## Success Criteria

1. **Minimal Interface:** Top bar has ≤4 buttons, bottom bar removed
2. **Hero Streaming:** Camera grid takes 90%+ of viewport
3. **Everything Works:** No broken features or dead clicks
4. **Clear Status:** User can see connection state for each camera
5. **Responsive:** Works well on desktop and mobile

## Notes

- Keep keyboard shortcuts simple (only essential ones)
- Make the stream view the primary focus
- Use visual hierarchy: streams > minimal controls > chrome
- Test with both 1 camera and 2 cameras
