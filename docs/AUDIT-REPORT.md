# SentryVision Audit Report

**Date**: 2026-05-31
**Version**: 1.4.0
**Auditor**: AI-assisted deep code review (backend + frontend + database + Python pipeline)

---

## Executive Summary

This report updates the original audit with corrections from 5 re-audits. **22 bugs from the original audit were false positives** — the code already handled them correctly and the original analysis was mistaken. **1 bug has been fixed by Phase 11** (ANA-001). **~60+ new bugs** were discovered, including 7 P0-critical and 8 P1-security issues.

The original audit had a 33% false-positive rate in re-audited areas. This replacement report corrects all known errors.

### Bug Count by Area

| Area | Original Count | False Positives | Fixed | Remaining Original | New Bugs | **Total Real** |
|------|---------------|-----------------|-------|-------------------|----------|---------------|
| Authentication | 11 | 6 | 0 | 5 | 10 | **15** |
| Camera Management | 9 | 4 | 0 | 5 | 11 | **16** |
| Events & Search | 6 | 3 | 0 | 3 | 21 | **24** |
| Analytics | 5 | 0 | 1 | 4 | 5 | **9** |
| Settings | 7 | 1 | 0 | 6 | 7 | **13** |
| Day Highlights | 4 | 3 | 0 | 1 | 1 | **2** |
| Notifications | 5 | 2 | 0 | 3 | 3 | **6** |
| System Health | 4 | 0 | 0 | 4 | 0 | **4** |
| Batch Processing | 2 | 2 | 0 | 0 | 2 | **2** |
| Live Streaming | 0 | 0 | 0 | 0 | 0 | **0** |
| Detection Pipeline | 4 | 0 | 0 | 4 | 0 | **4** |
| Visitor Tracking | 3 | 0 | 0 | 3 | 0 | **3** |
| NVIDIA AI | 0 | 0 | 0 | 0 | 0 | **0** |
| Face Config | 0 | 0 | 0 | 0 | 0 | **0** |
| Alerts | 1 | 1 | 0 | 0 | 0 | **0** |
| Review Workflow | 0 | 0 | 0 | 0 | 1 | **1** |
| DB / Migrations | 0 | 0 | 0 | 0 | 4 | **4** |
| Python OpenCV | 0 | 0 | 0 | 0 | 5 | **5** |
| **Total** | **61** | **22** | **1** | **38** | **70** | **108** |

---

## Priority Classification

- **P0 — Critical**: Broken functionality, data loss, security vulnerabilities.
- **P1 — High**: Significant bugs affecting UX or data integrity.
- **P2 — Medium**: Cosmetic issues, minor bugs, dead code.
- **P3 — Low**: Code quality, naming, nice-to-haves.

---

## 1. Authentication

### 1.1 What Works

| Feature | Endpoint | Status |
|---------|----------|--------|
| User Login | `POST /api/auth/login` | WORKING |
| User Registration | `POST /api/auth/register` | WORKING (admin-only) |
| JWT Token Verification | middleware `auth.ts` | WORKING |
| Token Refresh | `POST /api/auth/refresh` | WORKING (no auth middleware — AUTH-013) |
| Logout | `POST /api/auth/logout` | WORKING |
| Password Change | `POST /api/auth/change-password` | WORKING |
| User Profile | `GET /api/auth/profile` | WORKING |
| Frontend Auth Context | `AuthContext.tsx` | WORKING |
| Route Guards | `ProtectedRoute.tsx` | WORKING |
| Role-Based Access | admin > user > viewer | WORKING |
| Dev User Seeding | default admin/user on empty DB | WORKING |
| MFA Setup | `GET /api/auth/mfa/setup` | WORKING |
| MFA Verify | `POST /api/auth/mfa/verify` | WORKING |
| Account Lockout | login handler | WORKING |
| Token Invalidation | logout deletes user_sessions | WORKING |
| Password History | changePassword checks last 5 | WORKING |
| UserSession usage | created/checked/deleted | WORKING |

### 1.2 False Positives (code works correctly)

**~~AUTH-001 — MFA Secret Never Persisted [P0]~~** — AuthController persists `user.mfaSecret` after setup. The secret IS saved to the database.

**~~AUTH-002 — MFA Verify Protocol Mismatch [P0]~~** — Backend reads the secret from `user.mfaSecret` in the database, not from the request body. MFA verify works end-to-end.

**~~AUTH-003 — Account Lockout Unimplemented [P0]~~** — Login handler checks `lockedUntil` before allowing login, increments `failedLoginAttempts` on bad password, and resets both on success. Lockout is fully implemented.

**~~AUTH-004 — No Token Invalidation on Logout [P1]~~** — `AuthController.logout()` calls `userSessionRepo.delete()` which removes the session. Middleware's `requireAuth` checks for a valid `UserSession` record. Tokens ARE invalidated.

**~~AUTH-006 — Password History Not Enforced [P1]~~** — `changePassword()` queries `PasswordHistory` for the last 5 entries, compares each using `bcrypt.compare`, and rejects on match.

**~~AUTH-008 — UserSession Model Never Used [P2]~~** — Sessions are created on login, looked up by middleware, and deleted on logout. The model is fully wired.

### 1.3 Remaining Original Bugs

**AUTH-005 — lastLogin Never Updated [P2]**
`server/src/auth/index.ts` — `login()` never writes `NOW()` to `user.lastLogin`. Stays `null` forever.

**Fix**: `await userRepo.update(user.id, { lastLogin: new Date() })` on login success.

---

**AUTH-007 — Password Complexity Not Enforced [P2]**
`server/src/routes/auth.ts:17` — Route validation only checks `minLength: 8, maxLength: 128`. A stricter `validateUserRegistration` schema exists in `validation.ts:448` but is unused.

**Fix**: Wire the existing schema to the register route middleware.

---

**AUTH-009 — Auth Middleware Logs Every Request at INFO [P2]**
`server/src/middleware/auth.ts:65` — `logger.info(...)` on every authenticated request.

**Fix**: Change to `logger.debug(...)`.

---

**AUTH-010 — Salt Column Dead [P3]**
`server/src/auth/index.ts:205` — `salt: 'salt'` hardcoded. Never read during login. Column is dead schema.

**Fix**: Remove `salt` column in a future migration.

---

**AUTH-011 — Register Tab Visible to Non-Admins [P2]**
`frontend/src/pages/Login.tsx:220-233` — Register tab shown to all users. Backend requires admin role, so non-admin users get 401 errors.

**Fix**: Conditionally render the register tab only for authenticated admin users.

### 1.4 New Bugs

**AUTH-013 — /auth/refresh Has No Auth Middleware [P1 SECURITY]**
`server/src/routes/auth.ts` — The refresh endpoint has no `requireAuth` middleware. A stolen refresh token (stored in localStorage) can be used indefinitely to obtain new access tokens.

**Fix**: Add `requireAuth` middleware. Also validate that the refresh token matches the stored hash.

---

**AUTH-014 — JWT Stored in Plaintext in user_sessions [P1 SECURITY]**
`server/src/models/UserSession.ts` — Contains both `accessTokenHash` (misleading name — stores plaintext) and `refreshToken` (plaintext). If the DB is compromised, all sessions are compromised.

**Fix**: Hash both tokens before storage. Rename `accessTokenHash` to `accessToken` for clarity, or actually store a hash.

---

**AUTH-015 — No MFA UI in Frontend [P2]**
Backend MFA endpoints exist and work, but there is no frontend UI to enroll, verify, or manage MFA. Settings page has no MFA section.

**Fix**: Build frontend MFA enrollment flow (setup QR code → verify code → enable).

---

**AUTH-016 — AuthController Uses `user as any` Type Bypass [P2]**
`server/src/controllers/AuthController.ts` — Multiple type casts bypass TypeScript strict mode, masking potential type errors.

**Fix**: Replace `as any` with proper typed assertions or refactor to avoid the need.

---

**AUTH-017 — Login Timing-Based Username Enumeration [P2]**
`server/src/auth/index.ts` — When user is not found, returns immediately. When user is found but password is wrong, performs bcrypt comparison (taking ~100ms). Timing difference reveals valid usernames.

**Fix**: Always perform a dummy bcrypt compare when user is not found, to normalize response timing.

---

**AUTH-018 — Session ip_address INET Rejects Empty String [P2]**
`server/src/auth/index.ts` — Attempts to insert `ip_address: ''` into an `INET` column, which PostgreSQL rejects. Login crashes when `req.ip` is empty (e.g., some proxy configurations).

**Fix**: Default `ip_address` to `'0.0.0.0'` or make the column nullable with a fallback.

---

**AUTH-019 — Email Verification / Password Reset Columns Are Dead Schema [P2]**
`User` model has `emailVerified`, `emailVerificationToken`, `emailVerificationExpires`, `passwordResetToken`, `passwordResetExpires` — none are ever written or checked.

**Fix**: Implement the flows or remove the columns in a migration.

---

**AUTH-020 — Register Endpoint Has No Rate Limiting [P2]**
`POST /api/auth/register` — No rate limit. An attacker can create unlimited accounts, filling the users table.

**Fix**: Add enhanced rate limiting to the register route.

---

**AUTH-021 — deleteUser / updateUser Methods Unreachable [P3]**
`server/src/controllers/AuthController.ts` — Two methods exist but no routes call them.

**Fix**: Add routes or remove the dead methods.

---

**AUTH-022 — setupMFA Returns Raw TOTP Secret in API Response [P2]**
`server/src/auth/index.ts` — Returns `{ secret: { ascii, hex, base32, otpauth_url } }` including the raw `base32` secret in the API response body. If the response is logged or intercepted, MFA is compromised.

**Fix**: Only return the `otpauth_url` (for QR code generation). Never expose raw secrets.

---

## 2. Camera Management

### 2.1 What Works

| Feature | Endpoint | Status |
|---------|----------|--------|
| List All Cameras | `GET /api/cameras` | WORKING (leaks credentials — CAM-011) |
| Get Camera by ID | `GET /api/cameras/:id` | PARTIAL (serialization crash risk) |
| Create Camera | `POST /api/cameras/create` | WORKING |
| Update Camera | `PUT /api/cameras/:id` | WORKING |
| Delete Camera | `DELETE /api/cameras/:id` | WORKING |
| Start Stream | `POST /api/cameras/:id/stream/start` | WORKING |
| Stop Stream | `POST /api/cameras/:id/stream/stop` | PARTIAL (kills all viewers — CAM-012) |
| Test Stream | `POST /api/cameras/:id/stream/start-test` | WORKING (no stop endpoint — CAM-014) |
| Config Persistence | `persistCameras()` | WORKING |
| Filter/Zones CRUD | zone/filter endpoints | WORKING |
| Credential Encryption | `credentialEncryption.ts` | WORKING |
| Frontend Camera Context | `CameraContext.tsx` | PARTIAL |
| Snapshot | `POST /api/cameras/:id/snapshot` | PARTIAL |

### 2.2 False Positives (code works correctly)

**~~CAM-001 — Create Camera Broken [P0]~~** — Controller generates a non-empty ID (`cam_${uuid}`), returns `{ camera: { id, ... } }` matching frontend expectations, and calls `persistCameras()`. All three supposed bugs are incorrect.

**~~CAM-002 — Update Camera Ignores Fields [P1]~~** — Controller extracts all 5 fields: `name`, `nightMode`, `rtspUrl`, `frameRate`, `resolution`.

**~~CAM-003 — No Config Persistence [P0]~~** — `persistCameras()` EXISTS and is called after every create, update, delete, zone, and filter operation.

**~~CAM-008 — Update Filter Body Shape Mismatch [P1]~~** — Backend handles both shapes via `req.body.filter || req.body`.

### 2.3 Remaining Original Bugs

**CAM-004 — Get Camera by ID Leaks Internal State [P0]**
`server/src/controllers/CameraController.ts` (getById) — Returns raw `Camera` object including `lastFrame: Buffer | null`, `activeViewers: Set<string>`, `adaptiveFps`. Serializing `Set`/`Buffer` to JSON produces garbage or crashes.

**Fix**: Use the same trimming logic as `listAll` to return a clean API response.

---

**CAM-005 — Snapshot Path Mismatch [P1]**
`server/src/controllers/CameraController.ts` (takeSnapshot), `frontend/src/services/api/cameraService.ts` — Backend saves to `data/detections/YYYY-MM/snapshots/` but frontend constructs URL `/snapshots/filename`. Image is not accessible.

**Fix**: Return a full URL path from the backend, or align the frontend URL construction.

---

**CAM-006 — Night Mode Is a Stub [P2]**
`server/src/streams/rtspManager.ts` (toggleNightMode) — Only sets `camera.config.nightMode = enabled` and logs. No propagation to Python detection pipeline.

**Fix**: Send night mode config to Python, or remove the feature from the UI.

---

**CAM-007 — Zone/Filters Fire-and-Forget to Python [P2]**
`server/src/controllers/CameraController.ts` — Zone/filter config changes are sent to Python but the HTTP call is fire-and-forget with no error handling. `toggleNightMode` doesn't call it at all.

**Fix**: Add error handling to the Python push. Wire `toggleNightMode` to call the same update path.

---

**CAM-009 — Test Stream Interval Leak [P2]**
`server/src/controllers/CameraController.ts` (startTestStream) — Each call creates a new `setInterval` with no guard to clear existing one.

**Fix**: Check for and clear existing interval before creating a new one.

### 2.4 New Bugs

**CAM-011 — listAll Leaks Decrypted RTSP URLs with Credentials [P1 SECURITY]**
`server/src/controllers/CameraController.ts` (listAll) — Returns `rtspUrl` containing plaintext `rtsp://user:password@host:port/...`. Anyone who can call `GET /api/cameras` gets access to camera credentials.

**Fix**: Strip credentials from RTSP URLs in the API response (e.g., `rtsp://****:****@host:port/...`).

---

**CAM-012 — REST stopStream Kills Stream for ALL Socket.io Viewers [P1]**
`server/src/controllers/CameraController.ts` (stopStream) — Calling the REST endpoint stops the camera stream for everyone, not just the requester. Other viewers watching via Socket.io lose their stream.

**Fix**: REST stopStream should only stop test streams or require explicit intent. Socket.io viewer management should be separate.

---

**CAM-013 — Test Stream Interval Not Cleared by stopStream [P2]**
`server/src/controllers/CameraController.ts` — The test interval created by `startTestStream` is not cleared when `stopStream` is called.

**Fix**: Clear the interval in the stop handler.

---

**CAM-014 — No Stop-Test-Stream API Endpoint [P2]**
`server/src/routes/cameras.ts` — There is a `start-test` endpoint but no corresponding `stop-test` endpoint.

**Fix**: Add a `POST /api/cameras/:id/stream/stop-test` endpoint.

---

**CAM-015 — takeSnapshot Doesn't Create detection_files DB Record [P2]**
`server/src/controllers/CameraController.ts` (takeSnapshot) — Saves the image to disk but never inserts a row in the `detection_files` or `events` table. The snapshot is invisible to the events system.

**Fix**: Create a minimal event or detection_files record linking to the snapshot.

---

**CAM-016 — express.static /snapshots Points to Wrong Directory [P2]**
`server/src/index.ts` — `app.use('/snapshots', express.static('public/snapshots'))` but snapshots are saved to `data/detections/YYYY-MM/snapshots/`. All snapshot URLs return 404.

**Fix**: Serve from the correct directory, or use the event image serving endpoint.

---

**CAM-017 — Multiple startStream Calls Cause Duplicate Python Subscriptions [P2]**
`server/src/streams/rtspManager.ts` — Calling `startStream` multiple times for the same camera creates multiple Python WebSocket subscriptions.

**Fix**: Guard against duplicate subscriptions — check if already subscribed before creating a new one.

---

**CAM-018 — Auto-Start on Setup Ignores Camera enabled: false Flag [P1]**
`server/src/streams/rtspManager.ts` — During initialization, all cameras are auto-started regardless of their `enabled` flag.

**Fix**: Check `camera.enabled` before auto-starting.

---

**CAM-019 — persistCameras Written N Times During Init [P2]**
`server/src/streams/rtspManager.ts` — During bootstrap with N cameras, `persistCameras()` is called N times, writing the same file repeatedly.

**Fix**: Batch init calls or suppress persistence during initialization.

---

**CAM-020 — wirePythonWsFrames Overrides Bootstrap's Python Subscription on Reconnect [P2]**
`server/src/streams/rtspManager.ts` — On WebSocket reconnect, `wirePythonWsFrames` creates a new subscription that replaces the filtered subscription set up by `bootstrap.ts`, losing per-camera filtering.

**Fix**: Check for existing subscriptions before replacing.

---

**CAM-021 — persistCameras Silently Fails if CREDENTIAL_ENCRYPTION_KEY Missing [P2]**
`server/src/streams/rtspManager.ts` — `persistCameras()` calls credential encryption without checking if the encryption key is configured. If missing, the write silently fails and config is lost.

**Fix**: Check for encryption key before calling persist; log a clear warning if missing.

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

- Confirmed working with 3 concurrent viewers
- Cameras produce H.264 High/Main profile + PCMA audio
- go2rtc WebUI at port 1984 for direct testing
- Detection pipeline is separate (Python FFmpegReader) and unaffected

---

## 4. Detection Pipeline

### 4.1 What Works

| Feature | Component | Status |
|---------|-----------|--------|
| Python MOG2 background subtraction | `MotionGate` | WORKING |
| YOLO detection (YOLOv8n→YOLOv5n→yolov4-tiny) | `InProcessYOLO` | WORKING (fallback broken — PIP-001) |
| Multi-object tracking (Kalman filter) | `ByteTracker` | WORKING |
| Face recognition (InsightFace ArcFace) | `IdentityEnrichment` | WORKING |
| WebSocket event publishing | `WebSocketPublisher` | WORKING |
| Node.js WebSocket client | `PythonWsClient` | WORKING |
| Enhanced detection metadata | `EnhancedDetectionService` | WORKING |
| Score history / filtering | `EnhancedDetectionService` | WORKING |
| Settings CRUD (DB-backed) | `consolidatedDetectionService.ts` | WORKING |
| Face config CRUD with validation | `faceConfigRoutes.ts` | WORKING |
| Face embedding lifecycle | `faceEmbeddingRoutes.ts` | WORKING |

### 4.2 Bugs

**DET-001 — Node.js Trigger Endpoints Return Empty [P1]**
`server/src/detection/consolidatedDetectionService.ts` — `detectObjects()` and `detectFaces()` return empty arrays (intentional — pipeline runs in Python). Endpoints still exist in routes but return nothing.

**Fix**: Either remove the endpoints from the UI, or proxy to the Python OpenCV service.

---

**DET-002 — detectionService Singleton Has Broken Repository [P1]**
`server/src/services/detection/detectionService.ts:271-272` — Initialized with `{} as Repository<DetectionConfig>`. DB operations will crash. Fallback in routes hides this by returning hardcoded defaults.

**Fix**: Initialize repository properly from TypeORM connection.

---

**DET-003 — Settings Not Propagated to Python [P1]**
`server/src/detection/consolidatedDetectionService.ts` — Settings saved to `camera_settings` DB but never sent to Python. Python maintains its own independent config.

**Fix**: After saving to DB, push config to Python via HTTP or WebSocket.

---

**DET-004 — writeSettingsToDb Called Without await [P2]**
`server/src/detection/consolidatedDetectionService.ts:166,178,196` — Fire-and-forget persistence. Errors silently swallowed.

**Fix**: `await writeSettingsToDb(...)` with error handling.

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
| Event Deletion | `DELETE /api/events/:id` | WORKING |
| Bulk Delete | `POST /api/events/bulk-delete` | PARTIAL (Promise.all — EVT-009) |
| Event File Listing | `GET /api/events/list` | WORKING |
| Smart Filters | `SmartFilters.tsx` | WORKING |
| Grid/List View Toggle | `EventsPage.tsx` | WORKING |
| Pagination | `EventsPage.tsx` | WORKING |
| Keyboard Navigation | `EventsPage.tsx` | WORKING |
| Event Detail Panel | `EventDetailPanel.tsx` | WORKING |
| Related Events | `RelatedEvents.tsx` | WORKING |
| AI Scene Analysis (per-event) | `EventsPage.tsx` | WORKING |
| Motion Filter | `SmartFilters.tsx` | WORKING |
| Bounding Box Rendering | `EventDetailPanel.tsx` | WORKING |

### 5.2 False Positives (code works correctly)

**~~EVT-001 — Event Deletion Is a No-Op [P0]~~** — Handler performs all three steps: 1) `pool.query('DELETE FROM events WHERE id = $1')`, 2) `fs.unlinkSync(imagePath)`, 3) `inMemoryState.removeEvent()`. Deletion works correctly.

**~~EVT-002 — Detection Bounding Boxes Never Render [P1]~~** — `normalizeBoundingBox()` handles all 3 formats (`boundingBox`, `box`, `bounding_box`) with corresponding coordinate systems. Rendering works.

**~~EVT-004 — Motion Filter Does Nothing [P1]~~** — `listEnhanced` has a `case 'motion':` handler that adds `WHERE e.event_type = 'motion'`. Motion filter works.

### 5.3 Remaining Original Bugs

**EVT-003 — Share Button Has No Handler [P2]**
`frontend/src/components/events/EventDetailPanel.tsx:477-478` — Renders but does nothing.

**Fix**: Implement share (copy link, share image) or remove the button.

---

**EVT-005 — Image Serving Performance (Up to 122 fs.exists Calls) [P2]**
`server/src/routes/event-search.ts:170-183` — Fallback directory search iterates up to 5 years of month directories via `fs.existsSync`.

**Fix**: Cache directory structure or use DB lookup to resolve paths.

---

**EVT-006 — Today's Event Count Timezone Bug [P2]**
`server/src/routes/event-search.ts` — `new Date().setHours(0,0,0,0)` uses server local time. PostgreSQL `timestamptz` comparison is UTC. Events between midnight IST and 5:30 AM IST get miscounted.

**Fix**: Use `timezone('Asia/Kolkata', now()::date)` in queries or use `timestamptz` consistently.

### 5.4 New Bugs

**EVT-007 — Calendar Day Range Selection Never Works [P1]**
`server/src/routes/event-search.ts` (calendarStats) — When `startDate` and `endDate` are provided, the handler enters a dead code branch that performs an incorrect query and returns wrong results.

**Fix**: Fix the date-range query path in the calendar stats handler.

---

**EVT-008 — Camera Name Never Returned by API [P1]**
`server/src/routes/event-search.ts` (listEnhanced) — The query joins events with cameras but does not select `camera.name`. The frontend always shows a fallback name.

**Fix**: Add `c.name as camera_name` to the SELECT clause.

---

**EVT-009 — Bulk Delete Uses Promise.all — Partial Failures Reported as Full Success [P1]**
`server/src/routes/event-search.ts` (bulkDelete) — `Promise.all()` resolves/rejects on the first failure. Some deletions may succeed while others fail, but the response always says all succeeded.

**Fix**: Use `Promise.allSettled()` and report per-item results.

---

**EVT-010 — getEventImageUrl Returns Wrong Path [P1]**
`frontend/src/services/api/eventService.ts` — Returns `/events/` instead of `/api/events/image/`. Images fail to load.

**Fix**: Correct the URL path to `/api/events/image/`.

---

**EVT-011 — RelatedEvents Uses Plain img Instead of ProgressiveImage [P2]**
`frontend/src/components/events/RelatedEvents.tsx` — Uses `<img>` directly instead of the `ProgressiveImage` component used elsewhere.

**Fix**: Replace with `ProgressiveImage` for consistent lazy loading.

---

**EVT-012 — EventTimeline "Now" Indicator Always at Left Edge [P2]**
`frontend/src/components/events/EventTimeline.tsx` — The "now" indicator has no CSS `left` position calculated from actual time. Always renders at column 0.

**Fix**: Calculate `left` percentage from current time relative to 24h range.

---

**EVT-013 — EventTimeline Drag-to-Scroll Has No Bounds [P2]**
`frontend/src/components/events/EventTimeline.tsx` — Drag-to-scroll can go past the timeline boundaries, leaving a blank view.

**Fix**: Clamp the scroll position to valid bounds.

---

**EVT-014 — URL Synced with Stale Page Number on Filter Change [P2]**
`frontend/src/pages/EventsPage.tsx` — When a filter is changed, the URL query parameter still reflects the old page number while results reset to page 1.

**Fix**: Reset page to 1 in the URL when any filter changes.

---

**EVT-015 — Image Path LIKE Query with Leading Wildcard [P2]**
`server/src/routes/event-search.ts` — Uses `image_path LIKE '%searchterm'` preventing index usage.

**Fix**: Use a suffix-only pattern or full-text search on image paths.

---

**EVT-016 — End Date ::timestamp Cast Drops Timezone Info [P2]**
`server/src/routes/event-search.ts` — `endDate::timestamp` loses timezone context.

**Fix**: Cast to `timestamptz` or use `AT TIME ZONE` for correct comparison.

---

**EVT-018 — Bounding Box Coordinates Not Scaled to Display Size [P1]**
`frontend/src/components/events/EventDetailPanel.tsx` — Bounding boxes are drawn at absolute pixel coordinates from the 640×360 source, but the display image uses `object-cover` which may crop or scale differently.

**Fix**: Calculate scale factors from natural vs displayed image dimensions and apply them.

---

**EVT-019 — ISO String + ::timestamp = Timezone Incorrect [P2]**
`server/src/routes/event-search.ts` — `WHERE e.timestamp >= $1::timestamp` with ISO string treated as local time by PostgreSQL. Mismatch with DB timestamptz.

**Fix**: Use `$1::timestamptz` or send a timezone-aware literal.

---

**EVT-020 — EventTimeline Hour Zoom Groups May Not Align with 24-Column Grid [P2]**
`frontend/src/components/events/EventTimeline.tsx` — The zoomed hour groups may not cleanly divide the fixed 24-column grid, causing alignment issues.

**Fix**: Round zoom boundaries to the nearest hour boundary.

---

**EVT-021 — "All Time" getDates() Return Value Is Dead Code [P3]**
`server/src/routes/event-search.ts` — The `getDates()` return for `'all'` is never consumed.

**Fix**: Remove or wire up the return value.

---

**EVT-022 — Calendar Nav Uses ChevronDown/Up Instead of ChevronLeft/Right [P3]**
`frontend/src/components/events/EventTimeline.tsx` — Navigation buttons use vertical chevrons for horizontal calendar paging.

**Fix**: Replace with `ChevronLeft`/`ChevronRight`.

---

**EVT-023 — Today Highlight Only Works When quickRange === 'all' [P3]**
`frontend/src/components/events/SmartFilters.tsx` — The "today" visual highlight is only active when no specific filter range is selected.

**Fix**: Show today highlight regardless of quick range selection.

---

**EVT-024 — Confidence Badge Shows "0%" for Very Low Confidence Events [P2]**
`frontend/src/components/events/EventDetailPanel.tsx` — Shows `0%` when confidence rounds to 0.

**Fix**: Show `< 1%` for values between 0 and 0.5%.

---

**EVT-025 — "Showing X of Y" Shows Page Size vs Filtered Count [P2]**
`frontend/src/pages/EventsPage.tsx` — Displays `Showing 1-50 of 50` showing page size instead of total filtered event count.

**Fix**: Display the total count from the API response.

---

**EVT-026 — File Deletion Uses process.cwd() [P2]**
`server/src/routes/event-search.ts` — Image path resolution uses `process.cwd()` which may differ in Docker from the intended data directory.

**Fix**: Use a config-based path or an absolute path from config.

---

**EVT-027 — Brief Empty State Flash During Loading Transition [P3]**
`frontend/src/pages/EventsPage.tsx` — The empty state ("No events found") flashes briefly between loading spinner and results.

**Fix**: Prevent empty state rendering while `isLoading` is true.

---

## 6. Analytics

### 6.1 What Works

| Feature | Component | Status |
|---------|-----------|--------|
| Detection Types Pie Chart | `Analytics.tsx` | WORKING |
| Camera Status Panel | `Analytics.tsx` | WORKING |
| Stat Cards | `Analytics.tsx` | WORKING |
| Events Over Time Chart | `Analytics.tsx` | WORKING (vehicle counting fixed) |

### 6.2 Fixed Bugs

**~~ANA-001 — Vehicles Always Zero in Chart [P1]~~** [FIXED by Phase 11] — Vehicle counting logic added to the `eventsByDay` aggregation loop.

### 6.3 Remaining Original Bugs

**ANA-002 — Storage Is Hardcoded 0.5MB Estimate [P2]**
`frontend/src/pages/Analytics.tsx:188` — Uses `0.5 MB per event` estimate instead of actual filesystem usage.

**Fix**: Query actual disk usage from backend (`du -sh data/detections/`) or aggregate file sizes from DB.

---

**ANA-003 — Hourly Data Capped at 100 In-Memory Events [P1]**
`server/src/controllers/AnalyticsController.ts` (hourly endpoint) — Reads from `inMemoryState.getRecentEvents()` which holds max 100 events.

**Fix**: Query database directly for hourly analytics.

---

**ANA-004 — Response Time Analytics Fabricates Data [P2]**
`server/src/controllers/AnalyticsController.ts` — All data generated with `Math.random()`. Frontend never calls this endpoint (dead code).

**Fix**: Implement real timing or remove the endpoint.

---

**ANA-005 — Weekly/Monthly Endpoints Unused [P3]**
`server/src/controllers/AnalyticsController.ts`, `frontend/src/services/api/systemService.ts` — Service methods exist but no component calls them.

**Fix**: Wire them up in the Analytics page, or remove.

### 6.4 New Bugs

**ANA-006 — Motion Count Inflated in Pie Chart [P2]**
`frontend/src/pages/Analytics.tsx` — Every event increments motion count, even when the event has a specific detection type (person, vehicle, etc.). Motion overcounted.

**Fix**: Only count `event_type === 'motion'` for the motion slice.

---

**ANA-007 — Hourly Chart Ignores Time Range [P2]**
`server/src/controllers/AnalyticsController.ts` — The hourly endpoint always returns today's data regardless of the requested date range.

**Fix**: Honor the `startDate`/`endDate` query parameters.

---

**ANA-008 — Pie Chart Empty State Renders Empty Chart [P2]**
`frontend/src/pages/Analytics.tsx` — When all detection counts are zero, the chart renders an empty space instead of a "no data" message.

**Fix**: Show a placeholder when all values are zero.

---

**ANA-009 — pageSize Hardcoded to 1000 [P3]**
`server/src/controllers/AnalyticsController.ts` — The events query hardcodes `LIMIT 1000`. Analytics are incomplete beyond 1000 events.

**Fix**: Remove the limit or make it configurable/adaptive.

---

**ANA-010 — Fragile Date Key Sorting [P3]**
`frontend/src/pages/Analytics.tsx` — Date keys (strings like "2026-01-01") sorted alphabetically. Works within a single year but breaks at year boundaries (e.g., "2025-12-31" vs "2026-01-01" — alphabetical happens to work, but any sort of "2026-01-01" vs "2026-02-01" would fail lexicographically if padding were inconsistent).

**Fix**: Sort by `new Date(key).getTime()` instead of string comparison.

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
| Night Events Count | highlights API | WORKING |
| Sort Dropdown | `DayHighlights.tsx` | WORKING |
| Keyboard Navigation | `DayHighlights.tsx` | WORKING |

### 7.2 False Positives (code works correctly)

**~~HL-001 — Night Events Count Always Zero [P1]~~** — SQL uses `OR` not `BETWEEN`: `EXTRACT(HOUR FROM e.timestamp) >= 22 OR EXTRACT(HOUR FROM e.timestamp) <= 6`. This correctly matches both late-night (≥22) and early-morning (≤6) hours. Original audit incorrectly read it as `BETWEEN`.

**~~HL-002 — Sort Dropdown Broken [P1]~~** — The chronological re-sort wrapper is conditional on `sortBy === 'recent'`. When other sort options are selected, the API sort order is preserved correctly.

**~~HL-003 — Keyboard Nav Index Overflow With Active Filters [P1]~~** — Handlers use `filteredHighlights.length` (correctly), not `highlights.length`. Original audit misread the variable name.

### 7.3 Remaining Original Bugs

**HL-004 — Fullscreen/Export Keyboard Shortcuts Have No Handler [P2]**
`frontend/src/pages/DayHighlights.tsx` — `KEYBOARD_SHORTCUTS` defines `FULLSCREEN` ('f') and `EXPORT` ('e') but the switch statement has no cases for them.

**Fix**: Implement handlers or remove from shortcuts list.

### 7.4 New Bugs

**HL-005 — Unused KEYBOARD_SHORTCUTS Constants [P3]**
`frontend/src/pages/DayHighlights.tsx` — `FULLSCREEN` and `EXPORT` constants defined but unused (see HL-004). Dead constants.

**Fix**: Remove with HL-004.

---

## 8. Settings

### 8.1 What Works

| Feature | Component | Status |
|---------|-----------|--------|
| System Settings Load/Save | `SettingsController.ts` | WORKING (with caveats) |
| Change Password | `Settings.tsx` | WORKING |
| General Settings UI | `Settings.tsx` | WORKING |
| Settings Upsert on Fresh Install | `SettingsController.ts` | WORKING |

### 8.2 False Positives (code works correctly)

**~~SET-007 — Settings Never Created on Fresh Install [P1]~~** — Controller uses `INSERT INTO system_settings (...) VALUES (...) ON CONFLICT DO UPDATE`. On a fresh install with an empty table, the INSERT succeeds and creates the row. Original audit incorrectly said it uses UPDATE-only.

### 8.3 Remaining Original Bugs

**SET-001 — Theme Selector Only Shows "Dark" [P2]**
`frontend/src/pages/Settings.tsx:684-701` — The `<Select>` for theme only contains a `dark` option. Imports `Sun`, `Moon`, `Monitor` icons but doesn't render `system` or `light`.

**Fix**: Add `light` and `system` options.

---

**SET-002 — Theme Never Persisted to Backend [P2]**
`frontend/src/pages/Settings.tsx:179` — `handleSave` hardcodes `theme: 'system'`.

**Fix**: Use `formData.theme` (the actual selected value) instead of `'system'`.

---

**SET-003 — Storage Retention Maps to Wrong Field [P1]**
`frontend/src/pages/Settings.tsx:124,184` — `eventRetentionDays` mapped to `maxStorageGB`. Different semantics.

**Fix**: Add a `retentionDays` field to backend model, or correct the mapping.

---

**SET-004 — Motion Settings Auto-Save Without Save Button [P2]**
`frontend/src/components/settings/MotionDetectionSettings.tsx:87,109,131` — Every dropdown change triggers immediate API call. Parent "Save Changes" doesn't save these.

**Fix**: Use local state, save only on parent "Save Changes" click.

---

**SET-005 — Motion Settings Hardcoded to cam1/cam2 [P2]**
`frontend/src/components/settings/MotionDetectionSettings.tsx:57` — Always applies to `'cam1'` and `'cam2'`. Dynamic cameras missed.

**Fix**: Iterate over actual camera list from context.

---

**SET-006 — Optimization Settings Backend Ignores Fields [P2]**
`frontend/src/components/settings/OptimizationSettings.tsx`, `server/src/routes/detectionRoutes.ts:23-27` — Frontend sends `lowResourceMode`, `ffmpegThreads`. Zod schema only validates `thresholds`, `labelmap`, `score_history_length`.

**Fix**: Add fields to Zod schema and handle in controller.

### 8.4 New Bugs

**SET-008 — Optimization Changes Silently Lost [P1]**
`server/src/routes/detectionRoutes.ts` — Zod schema uses `.strict()` or unknown-stripping transforms. `lowResourceMode` and `ffmpegThreads` are stripped before they reach the handler.

**Fix**: Add the fields to the schema or use `.passthrough()`.

---

**SET-009 — Settings Load Failure Gives No User Feedback [P2]**
`frontend/src/pages/Settings.tsx` — If loading settings fails, there is no toast or error message.

**Fix**: Add error toast on load failure.

---

**SET-010 — System Preference Always Resolves to Dark [P2]**
`frontend/src/lib/theme.ts` — The `getSystemPreference()` function always returns `'dark'` regardless of `prefers-color-scheme`.

**Fix**: Return `window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'`.

---

**SET-011 — Optimization Slider Triggers API Call on Every Drag [P2]**
`frontend/src/components/settings/OptimizationSettings.tsx` — The slider fires an API call on every `onValueChange` event (every pixel of drag).

**Fix**: Debounce the API call or fire only on `onValueCommit`.

---

**SET-012 — Mixed Native Select vs Radix Select Styling [P3]**
`frontend/src/pages/Settings.tsx` — Some dropdowns use native `<select>`, others use `<Select>` from Radix. Inconsistent appearance.

**Fix**: Standardize on Radix `Select` everywhere.

---

**SET-013 — Back Button Always Navigates to Streams [P3]**
`frontend/src/pages/Settings.tsx` — The back button hardcodes navigation to `/streams` regardless of where the user came from.

**Fix**: Use `router.back()` or pass a `returnTo` parameter.

---

**SET-014 — Theme May Not Reapply on Cold Load [P3]**
`frontend/src/pages/Settings.tsx` — `initTheme()` is called in the component but may not be called at the `App.tsx` root level, causing a flash of wrong theme on cold page load.

**Fix**: Call `initTheme()` at the app root level.

---

## 9. Notifications

### 9.1 What Works

| Feature | Component | Status |
|---------|-----------|--------|
| Web Push Subscription | `POST /notifications/subscribe` | WORKING |
| Unsubscribe | `DELETE /notifications/unsubscribe` | WORKING (frontend sends POST — NOT-007) |
| Resubscribe | `POST /notifications/resubscribe` | WORKING |
| Subscription Status | `GET /notifications/subscription` | WORKING |
| Notification Preferences | `GET/PUT /notifications/preferences` | WORKING |
| Test Notification | `POST /notifications/test` | WORKING |
| Notification Logs | `GET /notifications/logs` | WORKING |
| VAPID Key Persistence | environment → filesystem → DB | WORKING |
| Expired Subscription Cleanup | `cleanupExpiredSubscriptions()` | WORKING (never triggered — NOT-008) |
| Detection Pipeline Wiring | `bootstrap.ts` | WORKING |

### 9.2 False Positives (code works correctly)

**~~NOT-001 — Notifications Not Wired to Detection Pipeline [P1]~~** — `bootstrap.ts` calls `notifyMotionEvent()`, `notifyUnknownFace()`, and `notifyObjectDetected()` in the Python WebSocket client message handler. Notifications ARE wired.

**~~NOT-002 — VAPID Keys Regenerated on Restart [P1]~~** — Keys are persisted to `config/vapid-keys.json` with a 3-tier fallback: env vars → filesystem → DB. On restart, existing keys are loaded, not regenerated.

### 9.3 Remaining Original Bugs

**NOT-003 — Hardcoded Camera Names [P2]**
`server/src/services/notificationService.ts:240,265,294` — `cameraName` always `'Front Door'` for `cam1`, `'Back Door'` for everything else.

**Fix**: Load camera names from camera config.

---

**NOT-004 — p256h vs p256dh Key Name Inconsistency [P0 BROKEN]**
`server/src/routes/notificationRoutes.ts:25,79` — `/subscribe` checks `keys.p256h` (missing `d`). `/resubscribe` checks `keys.p256dh`. Subscribe endpoint never matches, so push subscriptions fail silently.

**Fix**: Use consistent `p256dh` everywhere.

---

**NOT-005 — Quiet Hours Timezone Not Applied [P2]**
`server/src/services/notificationService.ts:158-172` — Uses `new Date().toTimeString()` without converting to user's `quietHoursTimezone`.

**Fix**: Convert to user's timezone before comparing.

### 9.4 New Bugs

**NOT-006 — /vapid-public-key Reads process.env Instead of NotificationService [P0 BROKEN]**
`server/src/routes/notificationRoutes.ts` — Reads `process.env.VAPID_PUBLIC_KEY` directly. When keys are loaded from filesystem (not env vars), this returns undefined, causing a 500 error. Frontend's push subscription fails on every load.

**Fix**: Read from `NotificationService.getVapidPublicKey()` instead of `process.env`.

---

**NOT-007 — Unsubscribe Method Mismatch [P0 BROKEN]**
`frontend/src/services/api/notificationService.ts` — Sends `POST /notifications/unsubscribe`. Backend route expects `DELETE /notifications/unsubscribe`. Every unsubscription attempt returns 404.

**Fix**: Change frontend to use `DELETE` or add a POST handler on the backend.

---

**NOT-008 — Expired Subscription Cleanup Never Called [P2]**
`server/src/services/notificationService.ts` — `cleanupExpiredSubscriptions()` exists and works but is never triggered by cron or bootstrap.

**Fix**: Add a scheduled task (e.g., daily cron) to call cleanup.

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

### 10.2 New Bugs

**REV-001 — ReviewSegment ID May Exceed VARCHAR(30) Column Limit [P1]**
`server/src/models/ReviewSegment.ts` — The `id` column is `VARCHAR(30)` but IDs may exceed 30 characters in certain cases (e.g., combined IDs with separators). INSERTs will fail with truncation/overflow errors.

**Fix**: Widen the column to `VARCHAR(64)` or use `TEXT`/`UUID`.

---

## 11. Visitor Tracking

### 11.1 What Works

| Feature | Endpoint | Status |
|---------|----------|--------|
| List Visitors | `GET /api/visitors/list` | WORKING |
| Visitor Timeline | `GET /api/visitors/timeline` | WORKING |
| Get Visitor by ID | `GET /api/visitors/:id` | WORKING |
| Delete Visitor | `DELETE /api/visitors/:id` | WORKING |

### 11.2 Bugs (unchanged from original audit)

**VIS-001 — PUT Creates Duplicate Instead of Updating [P1]**
`server/src/routes/visitorRoutes.ts:62` — Route receives `:id` and `name`, but calls `visitorService.createPerson(name)` which creates a new person. `:id` parameter ignored.

**Fix**: Implement `visitorService.updatePerson(id, { name })`.

---

**VIS-002 — deleteFace Removes Entire Visitor [P1]**
`server/src/services/visitorService.ts` (deleteFace) — Runs `DELETE FROM visitors WHERE id = $1` which removes the visitor, not just face data.

**Fix**: Delete from `face_embeddings` table only.

---

**VIS-003 — Embedding Count Mapping Broken [P2]**
`server/src/services/visitorService.ts:11` — Maps `r.embedding_count` but SQL aliases it as `image_count`.

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

### 12.2 Bugs (unchanged from original audit)

**SYS-001 — Cleanup Status Returns 501 [P2]**
`server/src/controllers/SystemController.ts:105-107` — Always returns `501 Not Implemented`.

**Fix**: Implement or remove the endpoint.

---

**SYS-002 — Storage Stats Hardcoded to Zero [P2]**
`server/src/controllers/SystemController.ts` — `storageUsed` always `0`, `storageTotal` always `1000000000`.

**Fix**: Use `fs.statfs` or `du` to get actual usage.

---

**SYS-003 — Sync File I/O in Log Handler [P2]**
`server/src/controllers/SystemController.ts` (getLogs) — `fs.readFileSync()` blocks the event loop.

**Fix**: Replace with `fs.promises.readFile()`.

---

**SYS-004 — No Database Health Check [P2]**
`server/src/controllers/SystemController.ts` (health) — No database connectivity check.

**Fix**: Add a `SELECT 1` query to the health check.

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

Requires `NVIDIA_API_KEY` environment variable. No bugs found.

---

## 14. Batch Processing

### 14.1 What Works

| Feature | Component | Status |
|---------|-----------|--------|
| Job CRUD | `batchProcessingDatabasePostgres.ts` | WORKING |
| Worker Thread Processing | `batchProcessingWorker.ts` | PARTIAL (INSERT broken — BAT-004) |
| Processed Images Tracking | `processed_images` table | PARTIAL (INSERT broken — BAT-003) |
| Job Statistics & History | aggregated queries | WORKING |
| Deduplication | file hash + job ID | WORKING |
| Job Cleanup | configurable retention | WORKING |
| Rerun Detection | `POST /api/detection-redo/rerun-detection` | WORKING |
| Rerun Event Detection | `POST /api/detection-redo/rerun-event-detection` | WORKING |

### 14.2 False Positives (code works correctly)

**~~BAT-001 — CSV Output Uses Literal `\\n` [P1]~~** — `csvLines.join('\n')` uses a real newline character. `'\n'` is the correct JavaScript escape sequence. Original audit misread the escape.

**~~BAT-002 — SQL Injection Risk in History/Cleanup [P1]~~** — Uses parameterized `INTERVAL '1 day' * $1`. The `days` value is passed as a bind parameter, not string-interpolated. No injection risk.

### 14.3 New Bugs

**BAT-003 — addProcessedImage INSERT Column Count Mismatch [P0 BROKEN]**
`server/src/services/batchProcessingDatabasePostgres.ts` — The INSERT statement has 17 columns but provides only 16 values. Every call to `addProcessedImage` fails with a PostgreSQL error.

```
INSERT INTO processed_images (id, job_id, image_path, file_hash, file_size, width, height, format, detected_objects, detection_quality, processed_at, created_at, event_id, camera_id, thumbnail_path, metadata, face_detections) VALUES (...16 values...)
```

**Fix**: Add the missing value or remove the extra column from the INSERT.

---

**BAT-004 — batchProcessingWorker INSERT Missing processing_time_ms Column [P0 CRITICAL]**
`server/src/services/batchProcessingWorker.ts` — INSERT into `batch_jobs` does not include the `processing_time_ms` column, but the table schema (from migration 004) requires it. Every batch job fails on insert.

**Fix**: Either add `processing_time_ms` to the INSERT, or alter the migration to add a default.

---

## 15. Face Config & Embeddings

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

No bugs found. Well-implemented with quality scoring, versioning, soft delete, and audit logging.

---

## 16. Alerts

### 16.1 What Works

| Feature | Endpoint | Status |
|---------|----------|--------|
| List Alerts | `GET /api/alerts` | WORKING |
| Acknowledge Alert | `POST /api/alerts/:id/acknowledge` | WORKING |
| Delete Alert | `DELETE /api/alerts/:id` | WORKING |

### 16.2 False Positive

**~~ALR-001 — Alert ID Format May Fail Against UUID PK [P1]~~** — Code uses `crypto.randomUUID()` which generates standard UUIDs. Original audit was incorrect.

---

## 17. DB / Migrations

**MIG-001 — batch_jobs Table Defined Twice (Migration 003 and 004) [P0 CRITICAL]**

`database/migrations/003_*.sql` and `database/migrations/004_*.sql` — Both migrations contain `CREATE TABLE IF NOT EXISTS batch_jobs (...)`. They define different schemas. If 003 runs first (creating schema A), 004's `IF NOT EXISTS` skips creation, leaving schema A in place. If migrations run out of order, the wrong schema wins. Column counts differ — this directly causes BAT-003 and BAT-004.

**Fix**: Consolidate into a single migration. Ensure the schema in one migration is the complete/correct one.

---

**MIG-002 — TypeORM BatchJob Model Doesn't Match Any Migration [P0 CRITICAL]**

`server/src/models/BatchJob.ts` — The TypeORM entity has columns (e.g., `processingTimeMs`) that don't exist in either migration's schema, and vice versa. The model is out of sync with the actual database schema.

**Fix**: Sync the TypeORM entity with the actual migration schema, or vice versa.

---

**MIG-003 — Alert Trigger Calls camera_settings Function [P1]**

`database/migrations/023_*.sql` — A trigger references a function in the `camera_settings` schema/table that may not exist or have a different signature.

**Fix**: Verify the function exists and has the expected parameters.

---

**MIG-004 — SQLite Migration File in PostgreSQL Migrations Directory [P1]**

`database/migrations/` — Contains a `.sql` file written for SQLite syntax (uses `AUTOINCREMENT`, missing PostgreSQL-specific features). This migration will fail when run against PostgreSQL.

**Fix**: Convert to PostgreSQL-compatible DDL or remove the file.

---

## 18. Python OpenCV Service

**PIP-001 — Unreachable YOLOv4-tiny Fallback Code [P1]**

`opencv-service/opencv_service/yolo_detector.py` — The YOLOv4-tiny model initialization code is placed after a `return` statement. When YOLOv8n and YOLOv5n both fail, the fallback is never reached — detection just returns empty results.

**Fix**: Move the v4-tiny init before the preceding return statement.

---

**PIP-002 — No Double-Initialization Guard for Flask Reloader [P1]**

`opencv-service/opencv_service/app.py` — Flask's development reloader spawns a child process that re-runs `init_app()`. Redis connections, database pools, and face recognition models are initialized twice, causing connection leaks and context errors.

**Fix**: Guard with `if os.environ.get('WERKZEUG_RUN_MAIN') != 'true'` or move init outside the reloader scope.

---

**PIP-003 — /detect-objects Route Bypasses Redis Cache [P1]**

`opencv-service/opencv_service/app.py` — The `POST /detect-objects` endpoint calls `_perform_yolo_detection()` directly instead of checking the Redis cache first. Repeated requests with the same image perform redundant inference.

**Fix**: Add Redis cache check before inference; store results after.

---

**PIP-004 — Flask init_app() at Module Level Crashes App on Error [P2]**

`opencv-service/opencv_service/app.py` — `init_app()` is called at module scope. If it fails (e.g., model load error), the entire app crashes at import time with no recovery.

**Fix**: Wrap in a try/except with health endpoint reporting, or defer to first request.

---

**PIP-005 — Hardcoded Developer Home Path in test_websocket.py [P2]**

`opencv-service/tests/test_websocket.py` — Contains `'/home/developer/...'` paths. Will fail on any other system.

**Fix**: Use relative or configurable paths.

---

## Dead Schema / Code Inventory

These database columns and model fields are defined but have zero functional usage:

| Model | Column | Intended Purpose | Status |
|-------|--------|-----------------|--------|
| `User` | `salt` | Password salt (bcrypt handles internally) | DEAD |
| `User` | `failedLoginAttempts` | Account lockout tracking | IN USE |
| `User` | `lockedUntil` | Account lockout timestamp | IN USE |
| `User` | `lastLogin` | Last login timestamp | NEVER WRITTEN |
| `User` | `mfaSecret` | TOTP shared secret | IN USE |
| `User` | `mfaEnabled` | MFA on/off flag | WRITTEN BUT NEVER READ |
| `User` | `backupCodes` | One-time backup codes for MFA | NEVER WRITTEN |
| `User` | `emailVerified` | Email verification flag | NEVER WRITTEN |
| `User` | `emailVerificationToken` | Email verification flow | NEVER WRITTEN |
| `User` | `emailVerificationExpires` | Email verification token expiry | NEVER WRITTEN |
| `User` | `passwordResetToken` | Password reset flow | NEVER WRITTEN |
| `User` | `passwordResetExpires` | Password reset token expiry | NEVER WRITTEN |
| `Role` | `permissions` | Fine-grained permission array | NEVER WRITTEN |
| `Role` | `isSystemRole` | System role protection flag | NEVER WRITTEN |
| `UserSession` | `accessToken` (plaintext) | Session tracking | IN USE (plaintext — AUTH-014) |
| `PasswordHistory` | *(entire table)* | Password reuse prevention | IN USE |
| `ReviewSegment` | `id` VARCHAR(30) | Review segment ID | TOO NARROW (REV-001) |

---

## Recommended Fix Order

### Phase 0 — Regressions from Phase 11 Fixes (IMMEDIATE)

Already fixed, included here for tracking.

| # | Bug ID | Description | Status |
|---|--------|-------------|--------|
| 0a | AUTH-012 | Session INSERT snake_case column name mismatch | FIXED |
| 0b | — | Camera streams cleared by frameRate/resolution without rtspUrl | FIXED |

### Phase 1 — Critical & Security (Do First)

| # | Bug ID | Description | Type | Effort |
|---|--------|-------------|------|--------|
| 1 | BAT-003 | addProcessedImage INSERT column count mismatch (P0 BROKEN) | Data loss | Small |
| 2 | BAT-004 | batchProcessingWorker INSERT missing processing_time_ms (P0 CRITICAL) | Data loss | Small |
| 3 | MIG-001 | batch_jobs defined twice in migrations (P0 CRITICAL) | Schema corruption | Medium |
| 4 | MIG-002 | TypeORM BatchJob model doesn't match any migration (P0 CRITICAL) | Schema mismatch | Medium |
| 5 | NOT-004 | p256h vs p256dh key name — subscribe broken (P0 BROKEN) | Feature broken | Small |
| 6 | NOT-006 | /vapid-public-key reads process.env, always 500 with file keys (P0 BROKEN) | Feature broken | Small |
| 7 | NOT-007 | Unsubscribe method mismatch POST vs DELETE (P0 BROKEN) | Feature broken | Small |
| 8 | AUTH-013 | /auth/refresh has no auth middleware (P1 SECURITY) | Security | Small |
| 9 | AUTH-014 | JWT stored in plaintext in user_sessions (P1 SECURITY) | Security | Small |
| 10 | CAM-011 | listAll leaks decrypted RTSP credentials (P1 SECURITY) | Security | Small |
| 11 | CAM-004 | getById returns raw Camera with Buffer/Set (P0 crash risk) | Crash | Small |
| 12 | CAM-018 | Auto-start ignores camera enabled: false flag (P1) | Config ignored | Small |
| 13 | CAM-012 | REST stopStream kills stream for ALL viewers (P1) | Feature broken | Small |
| 14 | EVT-007 | Calendar day range selection never works (P1) | Feature broken | Medium |
| 15 | EVT-008 | Camera name never returned by API (P1) | UX | Small |
| 16 | EVT-009 | Bulk delete Promise.all partial failures (P1) | Data integrity | Small |
| 17 | EVT-010 | getEventImageUrl returns wrong path (P1) | Feature broken | Small |
| 18 | EVT-018 | Bounding boxes not scaled to display size (P1) | UX | Small |
| 19 | ANA-003 | Hourly data capped at 100 in-memory events (P1) | Analytics broken | Medium |
| 20 | SET-003 | Retention maps to wrong field (P1) | Config broken | Small |
| 21 | SET-008 | Optimization changes silently lost (P1) | Config broken | Small |
| 22 | MIG-003 | Alert trigger calls nonexistent function (P1) | Feature broken | Small |
| 23 | MIG-004 | SQLite migration in PostgreSQL directory (P1) | Schema risk | Small |
| 24 | REV-001 | ReviewSegment ID may exceed VARCHAR(30) (P1) | Data loss risk | Small |
| 25 | PIP-001 | Unreachable YOLOv4-tiny fallback code (P1) | Detection fallback broken | Small |
| 26 | PIP-002 | No Flask reloader double-init guard (P1) | Resource leak | Small |
| 27 | PIP-003 | /detect-objects bypasses Redis cache (P1) | Performance | Small |

### Phase 2 — Medium Priority

| # | Bug ID | Description | Effort |
|---|--------|-------------|--------|
| 28 | AUTH-005 | lastLogin never updated | Small |
| 29 | AUTH-007 | Password complexity not enforced | Small |
| 30 | AUTH-009 | Auth logs every request at INFO | Small |
| 31 | AUTH-011 | Register tab visible to non-admins | Small |
| 32 | AUTH-015 | No MFA UI in frontend | Medium |
| 33 | AUTH-016 | AuthController `as any` type bypass | Small |
| 34 | AUTH-017 | Login timing-based username enumeration | Small |
| 35 | AUTH-018 | Session ip_address INET rejects empty string | Small |
| 36 | AUTH-019 | Email verification / password reset dead columns | Small |
| 37 | AUTH-020 | Register endpoint no rate limiting | Small |
| 38 | AUTH-022 | setupMFA returns raw TOTP secret | Small |
| 39 | CAM-005 | Snapshot path mismatch | Small |
| 40 | CAM-006 | Night mode is a stub | Medium |
| 41 | CAM-007 | Zone/filter fire-and-forget to Python | Small |
| 42 | CAM-009 | Test stream interval leak | Small |
| 43 | CAM-013 | Test interval not cleared by stopStream | Small |
| 44 | CAM-014 | No stop-test-stream endpoint | Small |
| 45 | CAM-015 | takeSnapshot no detection_files DB record | Small |
| 46 | CAM-016 | express.static /snapshots wrong directory | Small |
| 47 | CAM-017 | Multiple startStream duplicate subscriptions | Small |
| 48 | CAM-019 | persistCameras written N times during init | Small |
| 49 | CAM-020 | wirePythonWsFrames overrides bootstrap subscription | Small |
| 50 | CAM-021 | persistCameras fails silently without encryption key | Small |
| 51 | EVT-003 | Share button has no handler | Small |
| 52 | EVT-005 | Image serving up to 122 fs.existsSync calls | Medium |
| 53 | EVT-006 | Today's event count timezone bug | Small |
| 54 | EVT-011 | RelatedEvents uses img instead of ProgressiveImage | Small |
| 55 | EVT-012 | "Now" indicator always at left edge | Small |
| 56 | EVT-013 | Drag-to-scroll no bounds | Small |
| 57 | EVT-014 | URL synced with stale page number | Small |
| 58 | EVT-015 | Image path LIKE leading wildcard | Small |
| 59 | EVT-016 | End date ::timestamp drops timezone | Small |
| 60 | EVT-019 | ISO string + ::timestamp timezone incorrect | Small |
| 61 | EVT-020 | Hour zoom groups grid alignment | Small |
| 62 | EVT-024 | Confidence badge shows "0%" | Small |
| 63 | EVT-025 | "Showing X of Y" shows wrong count | Small |
| 64 | EVT-026 | File deletion uses process.cwd() | Small |
| 65 | ANA-002 | Storage hardcoded 0.5MB estimate | Medium |
| 66 | ANA-004 | Response time fabricates data | Small |
| 67 | ANA-006 | Motion count inflated in pie chart | Small |
| 68 | ANA-007 | Hourly chart ignores time range | Small |
| 69 | ANA-008 | Pie chart empty state renders empty chart | Small |
| 70 | HL-004 | Fullscreen/Export keyboard shortcuts no handler | Small |
| 71 | SET-001 | Theme selector only "Dark" | Small |
| 72 | SET-002 | Theme never persisted | Small |
| 73 | SET-004 | Motion settings auto-save | Small |
| 74 | SET-005 | Motion settings hardcoded cameras | Small |
| 75 | SET-006 | Optimization backend ignores fields | Small |
| 76 | SET-009 | Settings load failure no feedback | Small |
| 77 | SET-010 | System preference always resolves to dark | Small |
| 78 | SET-011 | Optimization slider no debounce | Small |
| 79 | NOT-003 | Hardcoded camera names | Small |
| 80 | NOT-005 | Quiet hours timezone not applied | Small |
| 81 | NOT-008 | Expired subscription cleanup never triggered | Small |
| 82 | SYS-001 | Cleanup status 501 | Small |
| 83 | SYS-002 | Storage stats hardcoded zero | Medium |
| 84 | SYS-003 | Sync file I/O in log handler | Small |
| 85 | SYS-004 | No DB health check | Small |
| 86 | VIS-001 | PUT creates duplicate visitor | Small |
| 87 | VIS-002 | deleteFace removes entire visitor | Small |
| 88 | PIP-004 | Flask init crashes on error | Small |

### Phase 3 — Low Priority

| # | Bug ID | Description | Effort |
|---|--------|-------------|--------|
| 89 | AUTH-010 | Salt column dead | Small |
| 90 | AUTH-021 | deleteUser/updateUser unreachable | Small |
| 91 | EVT-021 | "All Time" getDates() dead code | Small |
| 92 | EVT-022 | Calendar nav uses wrong chevrons | Small |
| 93 | EVT-023 | Today highlight only works with 'all' range | Small |
| 94 | EVT-027 | Empty state flash during loading | Small |
| 95 | HL-005 | Unused KEYBOARD_SHORTCUTS constants | Small |
| 96 | ANA-005 | Weekly/monthly endpoints unused | Small |
| 97 | ANA-009 | pageSize hardcoded 1000 | Small |
| 98 | ANA-010 | Fragile date key sorting | Small |
| 99 | SET-012 | Mixed native vs Radix select styling | Small |
| 100 | SET-013 | Back button always to streams | Small |
| 101 | SET-014 | Theme not reapplied on cold load | Small |
| 102 | VIS-003 | Embedding count mapping broken | Small |
| 103 | PIP-005 | Hardcoded home path in test script | Small |
| 104 | DET-004 | writeSettingsToDb without await | Small |

---

## Testing Checklist

Before marking any bug as fixed, verify:

1. **Lint passes**: `npm run lint --prefix frontend`
2. **Typecheck passes**: `npm run typecheck --prefix frontend`
3. **Backend compiles**: `cd server && npm run build`
4. **No regressions**: Test the specific feature end-to-end in the browser
5. **No side effects**: Verify related features still work
6. **Docker healthy**: All containers report healthy after rebuild

```bash
docker compose ps
curl -s http://localhost:9753/api/health
curl -s http://localhost:8084/health
curl -s http://localhost:1984/api/streams
```
