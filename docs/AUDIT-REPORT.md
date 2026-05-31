# SentryVision Feature Audit Report

**Date**: 2026-05-31
**Version**: 1.4.0
**Auditor**: AI-assisted deep code review across all layers (backend, frontend, database, Python pipeline)

---

## Executive Summary

| Category | Working | Partial | Broken | Stub |
|----------|---------|---------|--------|------|
| Authentication | 4 | 3 | 2 | 0 |
| Camera Management | 5 | 8 | 1 | 1 |
| Live Streaming | 4 | 0 | 0 | 0 |
| Detection Pipeline | 4 | 5 | 3 | 0 |
| Events & Search | 11 | 5 | 1 | 0 |
| Analytics | 3 | 4 | 1 | 2 |
| Day Highlights | 5 | 2 | 0 | 0 |
| Settings | 2 | 5 | 0 | 0 |
| Notifications | 4 | 2 | 0 | 0 |
| Review Workflow | 5 | 0 | 0 | 0 |
| Visitor Tracking | 4 | 1 | 0 | 0 |
| System Health | 4 | 2 | 1 | 0 |
| NVIDIA AI | 8 | 0 | 0 | 0 |
| Batch Processing | 6 | 0 | 0 | 0 |
| Face Config & Embeddings | 9 | 0 | 0 | 0 |
| Alerts | 2 | 1 | 0 | 0 |
| **Total** | **80** | **39** | **9** | **3** |

**Overall**: ~40% fully working, ~45% partially working with bugs, ~15% broken or stubs.

---

## Priority Classification

Fixes are organized into three tiers:

- **P0 — Critical**: Broken functionality, data loss, security vulnerabilities. Must fix before any new features.
- **P1 — High**: Significant bugs affecting UX or data integrity. Should fix soon.
- **P2 — Medium**: Cosmetic issues, minor bugs, dead code. Fix when convenient.
- **P3 — Low**: Code quality, documentation, naming. Nice to have.

---

## 1. Authentication

### 1.1 What Works

| Feature | Endpoint | Status |
|---------|----------|--------|
| User Login | `POST /api/auth/login` | WORKING |
| User Registration | `POST /api/auth/register` | WORKING (admin-only) |
| JWT Token Verification | middleware `auth.ts` | WORKING |
| Token Refresh | `POST /api/auth/refresh` | WORKING |
| Logout | `POST /api/auth/logout` | WORKING (client-side) |
| Password Change | `POST /api/auth/change-password` | WORKING |
| User Profile | `GET /api/auth/profile` | WORKING |
| Frontend Auth Context | `AuthContext.tsx` | WORKING |
| Route Guards | `ProtectedRoute.tsx` | WORKING |
| Role-Based Access | admin > user > viewer hierarchy | WORKING |
| Dev User Seeding | default admin/user on empty DB | WORKING |

### 1.2 Bugs & Issues

#### BUG-AUTH-001 — MFA Setup Secret Never Persisted [P0 BROKEN]

**File**: `server/src/auth/index.ts` (MFA setup handler)
**Severity**: P0 — Security feature is completely non-functional

The `GET /api/auth/mfa/setup` endpoint generates a TOTP secret and returns it to the client with a QR code data URL, but never writes the secret to `user.mfaSecret` in the database. The `User` model has `mfaSecret` (nullable varchar) and `mfaEnabled` (boolean) columns, but they are never updated.

**Fix**: After generating the secret, persist it:
```typescript
await userRepo.update(user.id, { mfaSecret: secret.base32 });
```
Also implement a two-step enrollment: setup returns secret → user verifies code → only then set `mfaEnabled = true`.

---

#### BUG-AUTH-002 — MFA Verify Protocol Mismatch [P0 BROKEN]

**File**: `server/src/controllers/AuthController.ts:238`, `frontend/src/services/api/authService.ts:61-69`
**Severity**: P0 — MFA verify always fails with 400

Frontend sends `{ code }` only. Backend expects `{ code, secret }` from the request body. Since the server never persisted the secret during setup (BUG-AUTH-001), it requires the client to send it back. But the frontend only sends the code.

Response is always: `400 "Code and secret are required"`

**Fix**: Either:
1. Backend loads the secret from `user.mfaSecret` (requires fixing BUG-AUTH-001 first), OR
2. Frontend sends the secret it received during setup

---

#### BUG-AUTH-003 — Account Lockout Unimplemented [P0 SECURITY]

**File**: `server/src/auth/index.ts` (login handler)
**Severity**: P0 — Brute-force attacks not mitigated

The `User` model has `failedLoginAttempts` and `lockedUntil` columns. Config has `maxLoginAttempts: 5` and `lockoutDuration: 900000`. But `authService.login()` never:
- Increments `failedLoginAttempts` on bad password
- Checks `lockedUntil` before allowing login
- Resets the counter on success

**Fix**: In the login handler, before password check:
```typescript
if (user.lockedUntil && new Date(user.lockedUntil) > new Date()) {
  throw new Error('Account locked. Try again later.');
}
```
On bad password: increment `failedLoginAttempts`, set `lockedUntil` if threshold reached.
On success: reset `failedLoginAttempts` to 0, clear `lockedUntil`.

---

#### BUG-AUTH-004 — No Token Invalidation on Logout [P1 SECURITY]

**File**: `server/src/auth/index.ts`, `middleware/auth.ts`
**Severity**: P1

Logout only writes an audit log entry. The JWT remains valid until natural expiry. There is no token blacklist, no session deletion in `user_sessions`, and no `UserSession` cleanup.

**Fix options**:
1. Token blacklist in Redis with TTL matching JWT expiry
2. Track `UserSession` records and check on each request
3. Short-lived access tokens (5 min) + proper refresh token rotation

---

#### BUG-AUTH-005 — lastLogin Never Updated [P2]

**File**: `server/src/auth/index.ts`
**Severity**: P2

The `User` model has a `lastLogin` column that is queried by `getUserById()` but `login()` never writes `NOW()` to it. The value stays `null` forever.

**Fix**: In the login success path:
```typescript
await userRepo.update(user.id, { lastLogin: new Date() });
```

---

#### BUG-AUTH-006 — Password History Not Enforced [P1]

**File**: `server/src/auth/index.ts` (change-password handler)
**Severity**: P1

The `PasswordHistory` model exists with proper `userId` index and `CASCADE` delete, but is never written to or queried. Users can change their password to the same password repeatedly.

**Fix**: Before accepting new password:
1. Query `PasswordHistory` for last N entries
2. Compare new password against each using `bcrypt.compare`
3. Reject if match found
4. After successful change, insert old password hash into `PasswordHistory`

---

#### BUG-AUTH-007 — Password Complexity Not Enforced [P2]

**File**: `server/src/routes/auth.ts:17`
**Severity**: P2

Route validation only checks `minLength: 8, maxLength: 128`. A `validateUserRegistration` schema with uppercase, lowercase, digit, and special character rules exists in `validation.ts:448` but is never wired to the register route.

**Fix**: Use the existing `validateUserRegistration` schema in the register route validation middleware.

---

#### BUG-AUTH-008 — UserSession Model Never Used [P2]

**File**: `server/src/models/UserSession.ts`
**Severity**: P2

The entire `UserSession` model (refreshToken, accessTokenHash, deviceInfo, ipAddress, userAgent) is fully defined but never written to. Session tracking is entirely absent.

**Fix**: Create session records on login, delete on logout, add session listing endpoint.

---

#### BUG-AUTH-009 — Auth Middleware Logs Every Request at INFO [P2]

**File**: `server/src/middleware/auth.ts:65`
**Severity**: P2

`logger.info(...)` on every authenticated request produces extremely high log volume.

**Fix**: Change to `logger.debug(...)`.

---

#### BUG-AUTH-010 — Salt Column Dead [P3]

**File**: `server/src/auth/index.ts:205`
**Severity**: P3

`salt: 'salt'` is a hardcoded constant. The `User.salt` column is never read during login (bcrypt handles salting internally). Dead column with misleading data.

**Fix**: Remove the `salt` column from the `User` model in a future migration.

---

#### BUG-AUTH-011 — Register Tab Visible to Non-Admins [P2]

**File**: `frontend/src/pages/Login.tsx:220-233`
**Severity**: P2

The register tab is shown to all users, but the backend requires admin role. Non-admin users will get 401 errors.

**Fix**: Hide the register tab for non-authenticated users, or show it only if the user is already logged in as admin.

---

## 2. Camera Management

### 2.1 What Works

| Feature | Endpoint | Status |
|---------|----------|--------|
| List All Cameras | `GET /api/cameras` | WORKING |
| Start Stream | `POST /api/cameras/:id/stream/start` | WORKING |
| Stop Stream | `POST /api/cameras/:id/stream/stop` | PARTIAL |
| Test Stream (synthetic) | `POST /api/cameras/:id/stream/start-test` | WORKING |
| RTSP Stream Manager | `rtspManager.ts` | WORKING |
| Config Loading | `cameras.json` + env var | WORKING |
| Credential Decryption | `credentialEncryption.ts` | WORKING |
| Frontend Camera Context | `CameraContext.tsx` | PARTIAL |

### 2.2 Bugs & Issues

#### BUG-CAM-001 — Create Camera Broken End-to-End [P0 BROKEN]

**File**: `server/src/controllers/CameraController.ts` (createCamera)
**Severity**: P0 — Cannot add cameras via UI

Three distinct bugs:
1. **Empty ID**: Controller calls `streamManager.addCamera()` with `id: ''`. Camera stored in Map with key `''`.
2. **Response format mismatch**: Backend returns `{ success: true, cameraId }`. Frontend expects `{ camera: { id } }` (cameraService.ts:147). Frontend always throws `ApiError` on successful creation.
3. **No persistence**: Adding a camera only updates the in-memory `Map`. `cameras.json` is never written.

**Fix**:
1. Generate a proper camera ID (e.g., `cam${Date.now()}` or UUID)
2. Return `{ success: true, camera: { id: newCamera.id, ... } }` matching frontend expectation
3. Write updated camera list to `cameras.json`

---

#### BUG-CAM-002 — Update Camera Ignores Most Fields [P1]

**File**: `server/src/controllers/CameraController.ts:107-110`
**Severity**: P1

Only `name` and `nightMode` are extracted from the request body. The frontend sends `rtspUrl`, `fps`, and `resolution` which are silently ignored.

**Fix**: Extract and apply all fields that the frontend sends.

---

#### BUG-CAM-003 — No Config Persistence [P0]

**File**: `server/src/streams/rtspManager.ts`
**Severity**: P0 — All camera/zone/filter changes lost on restart

Changes to cameras, zones, and object filters are in-memory only. `cameras.json` is read once at startup and never written back.

**Fix**: Implement a `persistCameras()` method that writes the current camera config to `cameras.json`. Call it after any create/update/delete/zone/filter operation.

---

#### BUG-CAM-004 — Get Camera By ID Leaks Internal State [P1]

**File**: `server/src/controllers/CameraController.ts` (getById)
**Severity**: P1

Returns the raw `Camera` object including `lastFrame: Buffer | null`, `activeViewers: Set<string>`, `adaptiveFps`, etc. Serializing a `Set` and `Buffer` to JSON produces garbage.

**Fix**: Use the same trimming logic as `listAll` to return a clean API response.

---

#### BUG-CAM-005 — Snapshot Path Mismatch [P1]

**File**: `server/src/controllers/CameraController.ts` (takeSnapshot), `frontend/src/services/api/cameraService.ts`
**Severity**: P1

Backend saves to `data/detections/YYYY-MM/snapshots/` but frontend constructs URL `/snapshots/filename`. The image is not accessible via the constructed URL.

**Fix**: Align the URL construction. Either:
1. Frontend uses the full path relative to the API base URL, OR
2. Backend returns a URL path instead of a filename

---

#### BUG-CAM-006 — Night Mode Is a Stub [P2]

**File**: `server/src/streams/rtspManager.ts` (toggleNightMode)
**Severity**: P2

Only sets `camera.config.nightMode = enabled` and logs it. No actual image processing change. Python detection pipeline doesn't receive this config change.

**Fix**: Send the night mode config to the Python service, or remove the feature from the UI.

---

#### BUG-CAM-007 — Zone/Filters Not Propagated to Python [P1]

**File**: `server/src/controllers/CameraController.ts` (zone/filter CRUD)
**Severity**: P1

Zone and object filter changes are made on the in-memory camera config but never communicated to the Python detection service. Changes take no effect until pipeline restart.

**Fix**: Send config updates to the Python WebSocket or HTTP endpoint.

---

#### BUG-CAM-008 — Update Filter Body Shape Mismatch [P1]

**File**: `server/src/controllers/CameraController.ts` (updateFilter), `frontend/src/services/api/cameraService.ts`
**Severity**: P1

Frontend sends `{ filter: { minArea, ... } }`. Backend reads top-level fields (`req.body.minArea`). All filter updates from the frontend silently fall back to defaults.

**Fix**: Align the body shape. Either frontend sends flat fields, or backend reads from `req.body.filter`.

---

#### BUG-CAM-009 — Test Stream Interval Leak [P2]

**File**: `server/src/controllers/CameraController.ts` (startTestStream)
**Severity**: P2

Each call creates a new `setInterval` stored in `(camera as any)._testInterval`. No guard to clear existing interval. No stop-test-stream route.

**Fix**: Check for and clear existing interval before creating a new one. Add a stop endpoint.

---

## 3. Live Streaming (WebRTC)

### 3.1 What Works

| Feature | Component | Status |
|---------|-----------|--------|
| RTSP → WebRTC via go2rtc | `go2rtc.yaml` + docker | WORKING |
| H.264 passthrough | go2rtc config | WORKING |
| Multi-viewer fan-out | go2rtc single-pull | WORKING |
| ICE candidates (LAN + STUN) | go2rtc config | WORKING |
| WebRTC signaling proxy | `vite.config.ts` `/go2rtc` | WORKING |
| Browser `<video>` rendering | `CameraStream.tsx` | WORKING |
| Screenshot from video | `ScreenshotButton.tsx` | WORKING |
| Socket.io detection events | `SocketService.ts` | WORKING |
| Connection state overlay | `ConnectionStateOverlay.tsx` | WORKING |
| Mobile support | WebRTC standard | WORKING |

### 3.2 Notes

- Confirmed working with 3 concurrent viewers (2 Mac Chrome, 1 Android Chrome)
- Cameras produce H.264 High/Main profile + PCMA audio
- go2rtc also has built-in WebUI at port 1984 for direct testing
- Detection pipeline is separate (Python FFmpegReader) and unaffected

---

## 4. Detection Pipeline

### 4.1 What Works

| Feature | Component | Status |
|---------|-----------|--------|
| Python MOG2 background subtraction | `MotionGate` | WORKING |
| YOLO object detection (YOLOv8n→YOLOv5n→yolov4-tiny) | `InProcessYOLO` | WORKING |
| Multi-object tracking (Kalman filter) | `ByteTracker` | WORKING |
| Face recognition (InsightFace ArcFace) | `IdentityEnrichment` | WORKING |
| WebSocket event publishing | `WebSocketPublisher` | WORKING |
| Node.js WebSocket client | `PythonWsClient` | WORKING |
| Enhanced detection metadata | `EnhancedDetectionService` | WORKING |
| Score history / filtering | `EnhancedDetectionService` | WORKING |
| Settings CRUD (DB-backed) | `consolidatedDetectionService.ts` | WORKING |
| Face config CRUD with validation | `faceConfigRoutes.ts` | WORKING |
| Face embedding lifecycle | `faceEmbeddingRoutes.ts` | WORKING |

### 4.2 Bugs & Issues

#### BUG-DET-001 — Node.js Trigger Endpoints Return Empty [P1 BROKEN]

**File**: `server/src/detection/consolidatedDetectionService.ts` (detectObjects, detectFaces)
**Severity**: P1

`detectObjects()` and `detectFaces()` return empty arrays with a log: *"HTTP detection path is removed. Detection now runs via the Python WebSocket pipeline."*

Affected endpoints:
- `POST /api/detection-operations/person/:cameraId/trigger`
- `POST /api/detection-operations/face/:cameraId/trigger`
- `POST /api/motion/:cameraId/analyze`

**Fix**: Either remove these endpoints from the UI, or proxy to the Python OpenCV service (`/detect-objects`).

---

#### BUG-DET-002 — detectionService Singleton Has Broken Repository [P1]

**File**: `server/src/services/detection/detectionService.ts:271-272`
**Severity**: P1

Initialized with `{} as Repository<DetectionConfig>`. All DB operations (`getConfig()`, `updateConfig()`) will crash. The fallback in `detectionRoutes.ts` hides this by returning hardcoded defaults.

**Fix**: Initialize the repository properly from the TypeORM connection.

---

#### BUG-DET-003 — Settings Not Propagated to Python [P1]

**File**: `server/src/detection/consolidatedDetectionService.ts`
**Severity**: P1

Settings are saved to `camera_settings` DB table but never pushed to the Python detection pipeline. Python maintains its own config.

**Fix**: After saving settings to DB, send the updated config to the Python service via HTTP or WebSocket message.

---

#### BUG-DET-004 — writeSettingsToDb Called Without await [P2]

**File**: `server/src/detection/consolidatedDetectionService.ts:166,178,196`
**Severity**: P2

Fire-and-forget persistence. Errors are silently swallowed.

**Fix**: `await writeSettingsToDb(...)` and handle errors.

---

## 5. Events & Search

### 5.1 What Works

| Feature | Endpoint | Status |
|---------|----------|--------|
| Enhanced Event Listing | `GET /api/events/list-enhanced` | WORKING |
| Full-Text Search | `GET /api/events/search` | WORKING |
| Calendar Statistics | `GET /api/events/stats/calendar` | WORKING |
| Range Statistics | `GET /api/events/stats/range` | WORKING |
| Event Details | `GET /api/events/:id/details` | WORKING |
| Image Serving | `GET /api/events/image/:filename` | WORKING |
| Event File Listing | `GET /api/events/list` | WORKING |
| Smart Filters | `SmartFilters.tsx` | WORKING |
| Grid/List View Toggle | `EventsPage.tsx` | WORKING |
| Pagination | `EventsPage.tsx` | WORKING |
| Keyboard Navigation | `EventsPage.tsx` | WORKING |
| Event Detail Panel | `EventDetailPanel.tsx` | WORKING |
| Related Events | `RelatedEvents.tsx` | WORKING |
| AI Scene Analysis (per-event) | `EventsPage.tsx` | WORKING |

### 5.2 Bugs & Issues

#### BUG-EVT-001 — Event Deletion Is a No-Op [P0 BROKEN]

**File**: `server/src/routes/event-search.ts` (archive handler)
**Severity**: P0 — Users think they deleted events but nothing happens

The handler searches `inMemoryState.getRecentEvents()` for the event, finds it, but only returns a success message. It never:
1. Removes the event from in-memory state
2. Deletes from the database
3. Deletes the file from disk

Both single and bulk delete are affected.

**Fix**: Implement actual deletion:
```typescript
await pool.query('DELETE FROM events WHERE id = $1', [eventId]);
fs.unlinkSync(imagePath);
inMemoryState.removeEvent(eventId);
```

---

#### BUG-EVT-002 — Detection Bounding Boxes Never Render [P1]

**File**: `frontend/src/components/events/EventDetailPanel.tsx:107-126`
**Severity**: P1

Frontend expects `detection.boundingBox` with `{ x, y, width, height }`. Backend sends `{ box: { x, y, w, h } }` or `{ bounding_box: { xmin, ymin, xmax, ymax } }`. Field name and coordinate format mismatch.

**Fix**: Normalize detection data in the frontend or backend to use a consistent format.

---

#### BUG-EVT-003 — Share Button Has No Handler [P2]

**File**: `frontend/src/components/events/EventDetailPanel.tsx:477-478`
**Severity**: P2

Renders but does nothing when clicked.

**Fix**: Implement share functionality (copy link, share image, etc.) or remove the button.

---

#### BUG-EVT-004 — Motion Filter Does Nothing [P1]

**File**: `frontend/src/components/events/SmartFilters.tsx`, `server/src/services/eventSearchService.ts`
**Severity**: P1

Selecting "Motion" sends `event_type=motion` to the backend. `listEnhanced` has no case for `event_type === 'motion'`, so it falls through without adding a filter condition. Motion filter returns all events unfiltered.

**Fix**: Add a `case 'motion':` handler in `listEnhanced` that filters for motion-type events.

---

#### BUG-EVT-005 — Image Serving Performance (Up to 120 fs.exists Calls) [P2]

**File**: `server/src/routes/event-search.ts:170-183`
**Severity**: P2

The fallback directory search iterates up to 5 years of month directories (up to 120 `fs.existsSync` calls per image request).

**Fix**: Cache the directory structure, or use a database lookup to resolve paths.

---

#### BUG-EVT-006 — Today's Event Count Timezone Bug [P2]

**File**: `server/src/routes/event-search.ts`, `frontend/src/services/api/eventService.ts:83`
**Severity**: P2

Creates `todayStart` with `new Date().setHours(0, 0, 0, 0)` using server local timezone, but PostgreSQL `timestamp` comparison may be UTC. Events between midnight IST and 5:30 AM IST could be counted under the previous day.

**Fix**: Use `timezone('Asia/Kolkata', now()::date)` in the PostgreSQL query, or use `timestamptz` consistently.

---

## 6. Analytics

### 6.1 What Works

| Feature | Component | Status |
|---------|-----------|--------|
| Detection Types Pie Chart | `Analytics.tsx` | WORKING |
| Camera Status Panel | `Analytics.tsx` | WORKING |
| Stat Cards | `Analytics.tsx` | WORKING |

### 6.2 Bugs & Issues

#### BUG-ANA-001 — Vehicles Always Zero in Events Over Time Chart [P1]

**File**: `frontend/src/pages/Analytics.tsx:128-143`
**Severity**: P1

The `eventsByDay` loop increments `events`, `persons`, and `packages` but never increments `vehicles`. The vehicles line in the area chart always reads 0.

**Fix**: Add vehicle counting logic:
```typescript
if (obj.class === 'car' || obj.class === 'truck' || obj.class === 'motorcycle' ||
    obj.class === 'bus' || obj.class === 'vehicle') {
  day.vehicles++;
}
```

---

#### BUG-ANA-002 — Storage Is Hardcoded 0.5MB Estimate [P2]

**File**: `frontend/src/pages/Analytics.tsx:188`
**Severity**: P2

Uses `0.5 MB per event` estimate. Not actual filesystem usage.

**Fix**: Query actual disk usage from the backend (`du -sh data/detections/`) or aggregate file sizes from the database.

---

#### BUG-ANA-003 — Hourly Data Capped at 100 In-Memory Events [P1]

**File**: `server/src/controllers/AnalyticsController.ts` (hourly endpoint)
**Severity**: P1

Reads from `inMemoryState.getRecentEvents()` which holds max 100 events. On busy days, older events are dropped from analytics.

**Fix**: Query the database for hourly analytics instead of relying on in-memory state.

---

#### BUG-ANA-004 — Response Time Analytics Fabricates Data [P2]

**File**: `server/src/controllers/AnalyticsController.ts` (responseTime endpoint)
**Severity**: P2

All data generated using `Math.random()`. No real HTTP request timing captured. Frontend never calls this endpoint (dead code).

**Fix**: Either implement real timing or remove the endpoint.

---

#### BUG-ANA-005 — Weekly/Monthly Endpoints Unused [P3]

**File**: `server/src/controllers/AnalyticsController.ts`, `frontend/src/services/api/systemService.ts`
**Severity**: P3

Service methods exist but no page or component calls them.

**Fix**: Wire them up in the Analytics page, or remove.

---

## 7. Day Highlights

### 7.1 What Works

| Feature | Component | Status |
|---------|-----------|--------|
| Highlights API | `GET /api/highlights/:date` | WORKING |
| Slideshow Player | `DayHighlights.tsx` | WORKING |
| Category Filters | `DayHighlights.tsx` | WORKING |
| Event Detail Panel | `DayHighlights.tsx` | WORKING |
| Timeline Sidebar | `DayHighlights.tsx` | WORKING |

### 7.2 Bugs & Issues

#### BUG-HL-001 — Night Events Count Always Zero [P1]

**File**: `server/src/routes/highlights.ts:64`
**Severity**: P1 — Night Events stat permanently shows 0

SQL uses `BETWEEN 22 AND 6` which means `>= 22 AND <= 6`. No integer satisfies both conditions simultaneously.

**Fix**:
```sql
COUNT(CASE WHEN EXTRACT(HOUR FROM e.timestamp) >= 22 OR EXTRACT(HOUR FROM e.timestamp) <= 6 THEN 1 END)
```

---

#### BUG-HL-002 — Sort Dropdown Broken [P1]

**File**: `frontend/src/pages/DayHighlights.tsx:112`
**Severity**: P1

After receiving sorted data from the API, the frontend unconditionally re-sorts chronologically:
```typescript
sortedHighlights.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
```
Choosing "Most People", "Most Faces", "High Confidence", or "Unknown Faces" has no visible effect.

**Fix**: Only sort chronologically if no sort is selected, or remove this line.

---

#### BUG-HL-003 — Keyboard Nav Index Overflow With Active Filters [P1]

**File**: `frontend/src/pages/DayHighlights.tsx:186,190`
**Severity**: P1

`ArrowLeft`/`ArrowRight` handlers use `highlights.length` (unfiltered total) instead of `filteredHighlights.length`. With active filters, `currentIndex` can exceed the filtered array bounds, causing blank UI.

**Fix**: Replace `highlights.length` with `filteredHighlights.length` in keyboard handlers.

---

#### BUG-HL-004 — Fullscreen/Export Shortcuts Undefined [P2]

**File**: `frontend/src/pages/DayHighlights.tsx`
**Severity**: P2

`FULLSCREEN` ('f') and `EXPORT` ('e') defined in `KEYBOARD_SHORTCUTS` but have no handler in the switch statement.

**Fix**: Implement handlers or remove from shortcuts list.

---

## 8. Settings

### 8.1 What Works

| Feature | Component | Status |
|---------|-----------|--------|
| System Settings Load/Save | `SettingsController.ts` | WORKING (with caveats) |
| Change Password | `Settings.tsx` | WORKING |
| General Settings UI | `Settings.tsx` | WORKING |

### 8.2 Bugs & Issues

#### BUG-SET-001 — Theme Selector Only Shows "Dark" [P2]

**File**: `frontend/src/pages/Settings.tsx:684-701`
**Severity**: P2

The `<Select>` for theme only contains a `dark` option. Imports `Sun`, `Moon`, `Monitor` icons but doesn't render `system` or `light` options.

**Fix**: Add `light` and `system` options to the dropdown.

---

#### BUG-SET-002 — Theme Never Persisted to Backend [P2]

**File**: `frontend/src/pages/Settings.tsx:179`
**Severity**: P2

`handleSave` hardcodes `theme: 'system'` in the payload, overriding whatever the user selected.

**Fix**: Use the actual selected theme value from state.

---

#### BUG-SET-003 — Storage Retention Maps to Wrong Field [P1]

**File**: `frontend/src/pages/Settings.tsx:124,184`
**Severity**: P1

`eventRetentionDays` is mapped to `maxStorageGB` on load and save. "Days to keep event records" actually saves as "30 GB max storage". Completely different semantics.

**Fix**: Add a proper `retentionDays` field to the backend, or correctly map to the existing field.

---

#### BUG-SET-004 — Motion Settings Auto-Save Without Save Button [P2]

**File**: `frontend/src/components/settings/MotionDetectionSettings.tsx:87,109,131`
**Severity**: P2

Every dropdown change triggers an immediate API call. The parent "Save Changes" button does not save these settings.

**Fix**: Use local state and save only when the parent "Save Changes" button is clicked.

---

#### BUG-SET-005 — Motion Settings Hardcoded to cam1/cam2 [P2]

**File**: `frontend/src/components/settings/MotionDetectionSettings.tsx:57`
**Severity**: P2

Always applies settings to `'cam1'` and `'cam2'`. Dynamic cameras are missed.

**Fix**: Iterate over actual camera list from context.

---

#### BUG-SET-006 — Optimization Settings Backend Ignores Fields [P2]

**File**: `frontend/src/components/settings/OptimizationSettings.tsx`, `server/src/routes/detectionRoutes.ts:23-27`
**Severity**: P2

Frontend sends `lowResourceMode` and `ffmpegThreads`. Backend Zod schema only validates `thresholds`, `labelmap`, `score_history_length`. Fields silently ignored.

**Fix**: Add these fields to the Zod schema and handle in the controller.

---

#### BUG-SET-007 — Settings Never Created on Fresh Install [P1]

**File**: `server/src/controllers/SettingsController.ts` (saveSystemSettings)
**Severity**: P1

Uses `UPDATE ... WHERE id = (SELECT id FROM system_settings LIMIT 1)`. If the table is empty (fresh install), UPDATE matches zero rows and silently returns `true` without persisting.

**Fix**: Use `INSERT ... ON CONFLICT DO UPDATE` (upsert).

---

## 9. Notifications

### 9.1 What Works

| Feature | Component | Status |
|---------|-----------|--------|
| Web Push Subscription | `POST /notifications/subscribe` | WORKING |
| Unsubscribe | `DELETE /notifications/unsubscribe` | WORKING |
| Resubscribe | `POST /notifications/resubscribe` | WORKING |
| Subscription Status | `GET /notifications/subscription` | WORKING |
| Notification Preferences | `GET/PUT /notifications/preferences` | WORKING |
| Test Notification | `POST /notifications/test` | WORKING |
| Notification Logs | `GET /notifications/logs` | WORKING |
| Expired Subscription Cleanup | cleanupExpiredSubscriptions() | WORKING |

### 9.2 Bugs & Issues

#### BUG-NOT-001 — Notifications Not Wired to Detection Pipeline [P1]

**File**: `server/src/services/notificationService.ts:239-356`
**Severity**: P1 — Push notifications never fire automatically

`notifyMotionEvent()`, `notifyUnknownFace()`, `notifyObjectDetected()` exist but are never called from the Python WebSocket client or detection pipeline handler.

**Fix**: Call notification methods from `PythonWsClient` when processing detection events.

---

#### BUG-NOT-002 — VAPID Keys Regenerated on Restart [P1]

**File**: `server/src/services/notificationService.ts:41-47`
**Severity**: P1

If `VAPID_PUBLIC_KEY`/`VAPID_PRIVATE_KEY` env vars are not set, new keys are generated at startup. This invalidates all existing push subscriptions.

**Fix**: Persist generated keys to database or file on first generation.

---

#### BUG-NOT-003 — Hardcoded Camera Names [P2]

**File**: `server/src/services/notificationService.ts:240,265,294`
**Severity**: P2

`cameraName` always `'Front Door'` for `cam1` and `'Back Door'` for anything else.

**Fix**: Load camera names from the camera config.

---

#### BUG-NOT-004 — p256h vs p256dh Key Name Inconsistency [P2]

**File**: `server/src/routes/notificationRoutes.ts:25,79`
**Severity**: P2

`/subscribe` checks for `keys.p256h` (missing `d`). `/resubscribe` checks for `keys.p256dh`. Inconsistent.

**Fix**: Use consistent `p256dh` everywhere (the Web Push standard name).

---

#### BUG-NOT-005 — Quiet Hours Timezone Not Applied [P2]

**File**: `server/src/services/notificationService.ts:158-172`
**Severity**: P2

Uses `new Date().toTimeString()` (server local time) but doesn't convert to user's configured `quietHoursTimezone`.

**Fix**: Convert to user's timezone before comparing.

---

## 10. Review Workflow

### 10.1 What Works

| Feature | Endpoint | Status |
|---------|----------|--------|
| Get Segments | `GET /api/review/segments` | WORKING |
| Get Segment by ID | `GET /api/review/segments/:id` | WORKING |
| Acknowledge Segment | `POST /api/review/segments/:id/acknowledge` | WORKING |
| Timeline | `GET /api/review/timeline` | WORKING |
| Active Objects | `GET /api/review/active-objects/:camera` | WORKING |

**No bugs found.** This is the cleanest feature in the codebase.

---

## 11. Visitor Tracking

### 11.1 What Works

| Feature | Endpoint | Status |
|---------|----------|--------|
| List Visitors | `GET /api/visitors/list` | WORKING |
| Visitor Timeline | `GET /api/visitors/timeline` | WORKING |
| Get Visitor by ID | `GET /api/visitors/:id` | WORKING |
| Delete Visitor | `DELETE /api/visitors/:id` | WORKING |

### 11.2 Bugs & Issues

#### BUG-VIS-001 — PUT Creates Duplicate Instead of Updating [P1 BROKEN]

**File**: `server/src/routes/visitorRoutes.ts:62`
**Severity**: P1

The route receives `:id` parameter and `name` body, but calls `visitorService.createPerson(name)` which creates a brand new person with a new ID. The `:id` parameter is completely ignored.

**Fix**:
```typescript
await visitorService.updatePerson(id, { name });
```
Implement `updatePerson()` in `visitorService.ts`:
```typescript
async updatePerson(id: string, data: { name: string }) {
  await pool.query('UPDATE visitors SET name = $1 WHERE id = $2', [data.name, id]);
}
```

---

#### BUG-VIS-002 — deleteFace Removes Entire Visitor [P1]

**File**: `server/src/services/visitorService.ts` (deleteFace)
**Severity**: P1

Runs `DELETE FROM visitors WHERE id = $1` which removes the entire visitor record, not just face data. Also orphans associated `face_embeddings` records.

**Fix**: Only delete from `face_embeddings` table, or cascade properly.

---

#### BUG-VIS-003 — Embedding Count Mapping Broken [P2]

**File**: `server/src/services/visitorService.ts:11`
**Severity**: P2

`getKnownPersons()` result mapping references `r.embedding_count` but the SQL aliases it as `image_count`.

**Fix**: Use consistent alias name.

---

## 12. System Health

### 12.1 What Works

| Feature | Endpoint | Status |
|---------|----------|--------|
| Health Check | `GET /api/health` | WORKING |
| System Overview | `GET /api/system/overview` | WORKING |
| Detailed Health | `GET /api/system/health` | WORKING |
| System Logs | `GET/DELETE /api/system/logs` | WORKING |
| Stats | `GET /api/stats` | WORKING |
| Image Cleanup | `POST /api/maintenance/cleanup-images` | WORKING |

### 12.2 Bugs & Issues

#### BUG-SYS-001 — Cleanup Status Returns 501 [P2 BROKEN]

**File**: `server/src/controllers/SystemController.ts:105-107`
**Severity**: P2

Always returns `501 Not Implemented`.

**Fix**: Implement or remove the endpoint.

---

#### BUG-SYS-002 — Storage Stats Hardcoded to Zero [P2]

**File**: `server/src/controllers/SystemController.ts`
**Severity**: P2

`storageUsed` always `0`, `storageTotal` always `1000000000`. Actual disk usage never calculated.

**Fix**: Use `fs.statfs` or `du` to get actual usage.

---

#### BUG-SYS-003 — Sync File I/O in Log Handler [P2]

**File**: `server/src/controllers/SystemController.ts` (getLogs)
**Severity**: P2

Uses `fs.readFileSync()` which blocks the Node.js event loop.

**Fix**: Replace with `fs.promises.readFile()`.

---

#### BUG-SYS-004 — No Database Health Check [P2]

**File**: `server/src/controllers/SystemController.ts` (health)
**Severity**: P2

Health endpoint checks cameras and process stats but not database connectivity.

**Fix**: Add a simple `SELECT 1` query to the health check.

---

## 13. NVIDIA AI Analysis

### 13.1 What Works

| Feature | Endpoint | Status |
|---------|----------|--------|
| Analyze Image | `POST /api/nvidia/analyze` | WORKING |
| Analyze Event | `POST /api/nvidia/analyze-event` | WORKING |
| Analyze with BBoxes | `POST /api/nvidia/analyze-with-bboxes` | WORKING |
| Analyze Persons | `POST /api/nvidia/analyze-persons` | WORKING |
| Analyze Event with BBoxes | `POST /api/nvidia/analyze-event-with-bboxes` | WORKING |
| Health Check | `GET /api/nvidia/health` | WORKING |
| Results Cache | `GET /api/nvidia/results` | WORKING |
| Model Listing | `GET /api/nvidia/models` | WORKING |
| Config Update | `PUT /api/nvidia/config` | WORKING |
| OpenCV Fallback | on API failure | WORKING |
| Robust JSON Parsing | 5+ fallback strategies | WORKING |

Requires `NVIDIA_API_KEY` environment variable.

### 13.2 Notes

- `updateConfig` is session-only (mutates `process.env`, lost on restart)
- Hardcoded camera names in `analyzeEvent`
- Image resize via `sharp` to 800x800 before API call

---

## 14. Batch Processing

### 14.1 What Works

| Feature | Component | Status |
|---------|-----------|--------|
| Job CRUD | `batchProcessingDatabasePostgres.ts` | WORKING |
| Worker Thread Processing | `batchProcessingWorker.ts` | WORKING |
| Processed Images Tracking | `processed_images` table | WORKING |
| Job Statistics & History | aggregated queries | WORKING |
| Deduplication | file hash + job ID | WORKING |
| Job Cleanup | configurable retention | WORKING |
| Rerun Detection | `POST /api/detection-redo/rerun-detection` | WORKING |
| Rerun Event Detection | `POST /api/detection-redo/rerun-event-detection` | WORKING |

### 14.2 Bugs & Issues

#### BUG-BAT-001 — CSV Output Uses Literal `\\n` [P1]

**File**: `server/src/services/batchProcessingWorker.ts:180`
**Severity**: P1

`csvLines.join('\\n')` joins with literal backslash-n instead of actual newline.

**Fix**: `csvLines.join('\n')`

---

#### BUG-BAT-002 — SQL Injection Risk in History/Cleanup [P1 SECURITY]

**File**: `server/src/services/batchProcessingDatabasePostgres.ts:489,500`
**Severity**: P1

String interpolation for `days` parameter: `INTERVAL '${days} days'`. Not parameterized.

**Fix**: Use parameterized query with `INTERVAL '$1 days'` and pass `[days]`.

---

## 15. Face Config & Embeddings

### 15.1 What Works

| Feature | Endpoint | Status |
|---------|----------|--------|
| Get All Config | `GET /api/face-config` | WORKING |
| Get Config by Key | `GET /api/face-config/:key` | WORKING |
| Update Config by Key | `PUT /api/face-config/:key` | WORKING |
| Reset Config | `POST /api/face-config/reset` | WORKING |
| Store Embedding | `POST /api/face-embeddings` | WORKING |
| Get Visitor Embeddings | `GET /api/face-embeddings/visitor/:visitorId` | WORKING |
| Get High-Quality Embeddings | `GET /api/face-embeddings/high-quality` | WORKING |
| Delete Embedding (soft) | `DELETE /api/face-embeddings/:id` | WORKING |
| Embedding Stats | `GET /api/face-embeddings/stats` | WORKING |

**No critical bugs.** Well-implemented with quality scoring, versioning, soft delete, and audit logging.

---

## 16. Alerts

### 16.1 What Works

| Feature | Endpoint | Status |
|---------|----------|--------|
| List Alerts | `GET /api/alerts` | WORKING |
| Acknowledge Alert | `POST /api/alerts/:id/acknowledge` | WORKING |
| Delete Alert | `DELETE /api/alerts/:id` | WORKING |

### 16.2 Bugs & Issues

#### BUG-ALR-001 — Alert ID Format May Fail Against UUID PK [P1]

**File**: `server/src/services/inMemoryStateService.ts:114`
**Severity**: P1

Generates string IDs like `alert_1234567890_abc123def`. The `alerts` DB table uses `UUID PRIMARY KEY DEFAULT gen_random_uuid()`. PostgreSQL UUID validation may reject non-UUID strings, causing alert persistence to silently fail.

**Fix**: Either change the DB column to `TEXT` or generate UUID-format IDs.

---

## Dead Schema / Code Inventory

These database columns and model fields are defined but have zero functional usage:

| Model | Column | Intended Purpose |
|-------|--------|-----------------|
| `User` | `salt` | Password salt (bcrypt handles internally) |
| `User` | `failedLoginAttempts` | Account lockout tracking |
| `User` | `lockedUntil` | Account lockout timestamp |
| `User` | `lastLogin` | Last login timestamp |
| `User` | `mfaSecret` | TOTP shared secret |
| `User` | `mfaEnabled` | MFA on/off flag |
| `User` | `backupCodes` | One-time backup codes for MFA |
| `User` | `emailVerified` | Email verification flag |
| `User` | `emailVerificationToken` | Email verification flow |
| `User` | `emailVerificationExpires` | Email verification token expiry |
| `User` | `passwordResetToken` | Password reset flow |
| `User` | `passwordResetExpires` | Password reset token expiry |
| `Role` | `permissions` | Fine-grained permission array |
| `Role` | `isSystemRole` | System role protection flag |
| `UserSession` | *(entire table)* | Session tracking |
| `PasswordHistory` | *(entire table)* | Password reuse prevention |

---

## Recommended Fix Order

### Phase 1 — Critical Fixes (Do First)

These are broken or security-critical. Fix before any new features.

| # | Bug ID | Description | Estimated Effort |
|---|--------|-------------|-----------------|
| 1 | BUG-EVT-001 | Event deletion no-op | Small |
| 2 | BUG-CAM-003 | No camera config persistence | Medium |
| 3 | BUG-CAM-001 | Create camera broken | Medium |
| 4 | BUG-AUTH-003 | Account lockout unimplemented | Small |
| 5 | BUG-AUTH-001 | MFA secret never persisted | Small |
| 6 | BUG-AUTH-002 | MFA verify protocol mismatch | Small |
| 7 | BUG-BAT-002 | SQL injection in batch processing | Small |

### Phase 2 — High Priority

Significant UX or data integrity issues.

| # | Bug ID | Description | Estimated Effort |
|---|--------|-------------|-----------------|
| 8 | BUG-VIS-001 | Visitor PUT creates duplicate | Small |
| 9 | BUG-HL-001 | Night events count always zero | Small |
| 10 | BUG-HL-002 | Sort dropdown broken | Small |
| 11 | BUG-HL-003 | Keyboard nav index overflow | Small |
| 12 | BUG-ANA-001 | Vehicles always zero in chart | Small |
| 13 | BUG-NOT-001 | Notifications not wired to pipeline | Medium |
| 14 | BUG-NOT-002 | VAPID keys regenerated on restart | Small |
| 15 | BUG-DET-001 | Node.js trigger endpoints return empty | Small |
| 16 | BUG-DET-002 | detectionService broken repository | Small |
| 17 | BUG-DET-003 | Settings not propagated to Python | Medium |
| 18 | BUG-EVT-002 | Bounding boxes never render | Small |
| 19 | BUG-EVT-004 | Motion filter does nothing | Small |
| 20 | BUG-CAM-002 | Update camera ignores fields | Small |
| 21 | BUG-CAM-007 | Zone/filters not propagated to Python | Medium |
| 22 | BUG-CAM-008 | Filter update body shape mismatch | Small |
| 23 | BUG-SET-003 | Retention maps to wrong field | Small |
| 24 | BUG-SET-007 | Settings never created on fresh install | Small |
| 25 | BUG-AUTH-004 | No token invalidation on logout | Medium |
| 26 | BUG-AUTH-006 | Password history not enforced | Small |
| 27 | BUG-ALR-001 | Alert ID format vs UUID PK | Small |
| 28 | BUG-VIS-002 | deleteFace removes entire visitor | Small |
| 29 | BUG-BAT-001 | CSV output literal `\\n` | Small |

### Phase 3 — Medium Priority

Cosmetic issues, minor bugs, dead code.

| # | Bug ID | Description | Estimated Effort |
|---|--------|-------------|-----------------|
| 30 | BUG-CAM-004 | Get camera leaks internal state | Small |
| 31 | BUG-CAM-005 | Snapshot path mismatch | Small |
| 32 | BUG-CAM-006 | Night mode is a stub | Medium |
| 33 | BUG-CAM-009 | Test stream interval leak | Small |
| 34 | BUG-EVT-003 | Share button no handler | Small |
| 35 | BUG-EVT-005 | Image serving performance | Medium |
| 36 | BUG-EVT-006 | Today's count timezone bug | Small |
| 37 | BUG-ANA-002 | Storage hardcoded estimate | Medium |
| 38 | BUG-ANA-003 | Hourly data capped at 100 | Medium |
| 39 | BUG-ANA-004 | Response time fabricates data | Small |
| 40 | BUG-SET-001 | Theme selector only dark | Small |
| 41 | BUG-SET-002 | Theme never persisted | Small |
| 42 | BUG-SET-004 | Motion settings auto-save | Small |
| 43 | BUG-SET-005 | Motion settings hardcoded cameras | Small |
| 44 | BUG-SET-006 | Optimization fields ignored | Small |
| 45 | BUG-NOT-003 | Hardcoded camera names | Small |
| 46 | BUG-NOT-004 | p256h vs p256dh inconsistency | Small |
| 47 | BUG-NOT-005 | Quiet hours timezone not applied | Small |
| 48 | BUG-SYS-001 | Cleanup status 501 | Small |
| 49 | BUG-SYS-002 | Storage stats hardcoded zero | Medium |
| 50 | BUG-SYS-003 | Sync file I/O in log handler | Small |
| 51 | BUG-SYS-004 | No DB health check | Small |
| 52 | BUG-VIS-003 | Embedding count mapping | Small |

### Phase 4 — Low Priority

Code quality, dead code removal.

| # | Bug ID | Description | Estimated Effort |
|---|--------|-------------|-----------------|
| 53 | BUG-AUTH-005 | lastLogin never updated | Small |
| 54 | BUG-AUTH-007 | Password complexity not enforced | Small |
| 55 | BUG-AUTH-008 | UserSession model never used | Medium |
| 56 | BUG-AUTH-009 | Auth logs every request at INFO | Small |
| 57 | BUG-AUTH-010 | Salt column dead | Small |
| 58 | BUG-AUTH-011 | Register tab visible to non-admins | Small |
| 59 | BUG-DET-004 | writeSettingsToDb without await | Small |
| 60 | BUG-ANA-005 | Weekly/monthly endpoints unused | Small |
| 61 | BUG-HL-004 | Fullscreen/export shortcuts undefined | Small |

---

## Testing Checklist for Each Fix

Before marking any bug as fixed, verify:

1. **Lint passes**: `npm run lint --prefix frontend`
2. **Typecheck passes**: `npm run typecheck --prefix frontend`
3. **No regressions**: Test the specific feature end-to-end in the browser
4. **No side effects**: Verify related features still work
5. **Docker healthy**: All containers report healthy after rebuild

```bash
docker compose ps
curl -s http://localhost:9753/api/health
curl -s http://localhost:8084/health
curl -s http://localhost:1984/api/streams
```
