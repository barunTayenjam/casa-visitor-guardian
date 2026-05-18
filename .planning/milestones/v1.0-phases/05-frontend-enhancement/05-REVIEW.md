---
status: completed
files_reviewed:
  - frontend/src/pages/DayHighlights.tsx
  - frontend/src/pages/EventsPage.tsx
  - frontend/src/services/SocketService.ts
  - frontend/src/components/dashboard/CameraStream.tsx
  - frontend/vite.config.ts
  - frontend/src/types/security.ts
  - frontend/src/pages/BatchDetectionPage.tsx (missing)
findings:
  critical: 2
  warning: 5
  info: 6
total: 13
---

# Phase 05 Code Review: Frontend Enhancement

## Critical

### CRIT-1: SocketService duplicate callback registration on reconnect

- **File**: `frontend/src/services/SocketService.ts`
- **Line**: 100–105
- **Description**: On socket reconnect, the `connect` handler iterates all callbacks from the `callbacks` map and re-registers them via `this.socket?.on(event, callback)`. Socket.io v4 **preserves event listeners across reconnections**, so this re-registration produces duplicate listeners. Every detection event (e.g. `personDetected`, `faceDetected`, `frame`) will fire each callback **twice** after every reconnection cycle, leading to duplicate state updates, double API calls, and incorrect UI rendering.
- **Recommendation**: Remove the re-registration loop in lines 100–105. Socket.io preserves listeners on reconnect automatically. If using `removeAllListeners` + new socket creation (the `connect` path at line 58), the re-registration is valid—but the `on()` method (line 217) also attaches listeners directly to the socket when connected, creating duplicates on reconnect. Use a flag or track which callbacks are already attached.

### CRIT-2: `canRestartStream` mutates rate-limit counter on every call, including blocked attempts

- **File**: `frontend/src/components/dashboard/CameraStream.tsx`
- **Line**: 109
- **Description**: `connectionAttemptsRef.current++` (line 109) is executed every time `canRestartStream()` is called, even when the function returns `false` early due to cooldown (line 98) or rate-limit (line 104). This means failed/blocked restart attempts count against the max-attempts-per-minute limit (line 110). After enough rapid failed checks (e.g. 10 calls that hit cooldown), genuine restart attempts are incorrectly blocked for a full minute.
- **Recommendation**: Move `connectionAttemptsRef.current++` to after all guard checks pass (i.e., the point where a restart is actually committed). Only increment when `canRestartStream` is about to return `true`.

---

## Warning

### WARN-1: DayHighlights—`currentIndex` indexes into `highlights` but navigation/filter display uses `filteredHighlights`

- **File**: `frontend/src/pages/DayHighlights.tsx`
- **Lines**: 79, 195, 476
- **Description**: `currentHighlight` is derived from `highlights[currentIndex]` (line 79), while the END keyboard shortcut sets `currentIndex = filteredHighlights.length - 1` (line 195), and the display counter shows `${currentIndex + 1} of ${filteredHighlights.length}` (line 476). `filteredHighlights` can be shorter than `highlights`. This causes three bugs:
  1. Pressing `End` navigates to an index that skips past valid filtered content.
  2. The position counter is misleading (e.g., "5 of 3").
  3. The user can arrow-key into events that are filtered out.
- **Recommendation**: Either make `currentIndex` index into `filteredHighlights` and derive `currentHighlight` from it, or eliminate `filteredHighlights` and move filtering to a separate derived state.

### WARN-2: DayHighlights—Inconsistent confidence scale vs. EventsPage

- **File**: `frontend/src/pages/DayHighlights.tsx` (line 490) vs. `frontend/src/pages/EventsPage.tsx` (line 567)
- **Description**: DayHighlights displays `Math.round(currentHighlight?.confidence || 0)%` (treating confidence as 0–100). EventsPage displays `Math.round(event.confidence * 100)%` (treating confidence as 0–1). Both pages receive data from the same API. If the backend returns 0.85, EventsPage shows 85% (correct) and DayHighlights shows 0% (broken). This makes DayHighlights confidence always appear as 0% or 1%.
- **Recommendation**: Normalize the confidence value in one place. Either multiply by 100 in the data-transformation layer, or apply a consistent display helper across both pages. Adding a shared utility like `formatConfidence(val)` would prevent divergence.

### WARN-3: SocketService—duplicate `socketUrl` assignment makes DEV/PROD branches dead code

- **File**: `frontend/src/services/SocketService.ts`
- **Lines**: 62–69
- **Description**: Both the `if (import.meta.env.DEV)` branch and the `else` branch set `socketUrl = window.location.origin`. The entire conditional is a no-op. This suggests an incomplete refactor—the production path was meant to use a different URL (e.g., a hard-coded backend URL or a config variable).
- **Recommendation**: Either remove the conditional and assign `socketUrl = window.location.origin` directly, or implement the intended distinction (e.g., use an env variable `VITE_SOCKET_URL` for non-proxy deployments). Update the Socket.io `path` option if the production nginx routes `/socket.io` to a different path.

### WARN-4: CameraStream—hard-coded metrics URL bypasses API service layer and auth

- **File**: `frontend/src/components/dashboard/CameraStream.tsx`
- **Line**: 209
- **Description**: `fetch('/api/streaming/metrics')` uses a raw `fetch` call instead of the application's typed API service layer (`eventService`, etc.). This bypasses:
  - Auth headers (JWT token from ApiService)
  - Error-handling wrapper (consistent toast/user messaging)
  - Base-URL configuration and proxy settings
  - Request/response typing and serialization
- **Recommendation**: Add a `systemService.getStreamMetrics()` method (or similar) in the API service layer and call it here. At minimum, pass credentials: `fetch('/api/streaming/metrics', { credentials: 'include' })`.

### WARN-5: CameraStream—`useEffect` with `isStreaming` dependency creates subtle circular call chain

- **File**: `frontend/src/components/dashboard/CameraStream.tsx`
- **Lines**: 296–313
- **Description**: The `useEffect` has `isStreaming` in its dependency array. When it calls `handleStreamStart()` (which sets `isStreaming = true`) or `handleStreamStop()` (which sets `isStreaming = false`), the state update triggers a re-render, which re-runs this effect. The cleanup function also calls `stopCameraStream(camera.id)` on every dependency change (not just unmount). While an infinite loop is prevented by the `!isStreaming` guard, the cleanup fires `stopCameraStream` redundantly on intermediate renders.
- **Recommendation**: Split the auto-start/stop logic from the cleanup. Remove `isStreaming` from this effect's dependencies and use a separate effect for cleanup on unmount only. Or use a ref to track whether the effect has already initiated the stream.

---

## Info

### INFO-1: DayHighlights—duplicate icon for known and unknown faces

- **File**: `frontend/src/pages/DayHighlights.tsx`
- **Lines**: 243, 246
- **Description**: Both the "Familiar Face" and "Unknown Face" labels render the same `<UserCheck>` icon. Unknown faces should use a different icon such as `<UserX>` (or `<User>` with a different color) to provide an immediate visual distinction without reading the text label.
- **Recommendation**: Import `<UserX>` from `lucide-react` and use it for the unknown-face case (line 246). Import `<User>` for the person case.

### INFO-2: EventsPage—`pageSize` ternary has identical branches

- **File**: `frontend/src/pages/EventsPage.tsx`
- **Line**: 148
- **Description**: `const pageSize = viewMode === 'grid' ? 100 : 100;` — both branches return 100, making the ternary useless. This is likely a copy-paste error where list view was intended to have a different page size (e.g., 50 or 200).
- **Recommendation**: Either remove the ternary and assign `pageSize = 100` directly, or assign distinct values for each view mode (e.g., grid 50, list 100).

### INFO-3: EventsPage—face count uses hard-coded emoji instead of icon component

- **File**: `frontend/src/pages/EventsPage.tsx`
- **Line**: 581
- **Description**: `<span>👤 {event.faceCount}</span>` uses a raw emoji character. The adjacent person count (line 575) uses a proper `<User className="h-3 w-3" />` Lucide icon. Emoji rendering varies across OS and may differ in size/alignment compared to the SVG icon.
- **Recommendation**: Replace `<span>👤</span>` with `<User className="h-3 w-3" />` for consistent rendering with the person count badge.

### INFO-4: SocketService—empty event handlers are dead code

- **File**: `frontend/src/services/SocketService.ts`
- **Lines**: 111–118, 146–152
- **Description**: Handlers for `connected`, `streamRequested`, `faceDetected`, and `enhancedMotionDetected` are registered with empty or comment-only bodies. They log nothing and produce no side effects. These consume a listener slot on the socket for no benefit and confuse future developers about which events are actually handled.
- **Recommendation**: Remove these empty handlers. If they are intended for debugging or future use, either add a `console.debug` call or leave a `// reserved` comment without registering the listener.

### INFO-5: vite.config.ts—Docker hostname as default proxy target breaks local dev

- **File**: `frontend/vite.config.ts`
- **Line**: 19
- **Description**: The default proxy target `http://sentryvision-backend:9753` is a Docker-internal hostname. When running the frontend via `npm run dev` outside Docker (which the AGENTS.md describes as Option B), the Vite dev server will fail to resolve `sentryvision-backend`, breaking all API calls, socket connections, and proxied routes. The env var `VITE_BACKEND_URL` can override it, but the default should work for the most common local-dev flow.
- **Recommendation**: Change the default to `http://localhost:9753` to match the local-development workflow described in AGENTS.md. Keep the Docker hostname configurable via `VITE_BACKEND_URL` for the Docker compose setup.

### INFO-6: security.ts—`Camera.lastSeen` typed as `Date` but arrives as ISO string from JSON API

- **File**: `frontend/src/types/security.ts`
- **Line**: 15
- **Description**: `lastSeen: Date` is declared as a native `Date` object. JSON-serialized API responses emit ISO 8601 date strings, not `Date` instances. If callers don't explicitly convert (`new Date(json.lastSeen)`), property access like `lastSeen.getTime()` throws a runtime error. `MotionEvent.timestamp` has the same type but is explicitly converted in `EventsPage.tsx:165`.
- **Recommendation**: Add a comment documenting the expected conversion, or use a branded type `Date | string` with a conversion utility. Alternatively, keep the `Date` type but enforce conversion at the deserialization boundary (e.g., a `transformResponse` helper).

---

## Files Not Found

The file `frontend/src/pages/BatchDetectionPage.tsx` listed for review does not exist in the repository. No review was performed for this file.
