---
status: open
files_reviewed:
  - server/src/streams/rtspManager.ts (958 lines)
  - server/src/config/index.ts (393 lines)
  - docker-compose.yml (234 lines)
findings:
  critical: 6
  warning: 13
  info: 7
total: 26
reviewed_by: opencode
date: 2026-05-18
---

# Phase 06 – Resource Optimization: Code Review

## Critical

### C1 – Client-injected motion detection events (Security / Spoofing)
**File:** `server/src/streams/rtspManager.ts:110-112`

The server listens for `motionDetected` events emitted by any connected Socket.IO client and broadcasts them to all viewers via `emitDetectionEvent`. Any unauthenticated or low-privilege client can inject fake motion alerts:
```ts
this.io.on('motionDetected', (event: any) => {
  this.emitDetectionEvent(event);
});
```
**Recommendation:** Validate the source by requiring an authenticated socket or server-side token. Remove the client-emit path and use only internal EventEmitter events from `motionTriggeredDetection`.

---

### C2 – Untyped `pendingInactivityTimeout` stored via `as any` (Type Safety / Leak)
**File:** `server/src/streams/rtspManager.ts:134,137,537,540,559,572,894,897`

The `Camera` interface lacks a `pendingInactivityTimeout` property, so it is stored and accessed entirely through `(camera as any)` casts. This defeats TypeScript strict-mode checking and makes it easy to introduce dangling timer references.
**Recommendation:** Add `pendingInactivityTimeout?: NodeJS.Timeout` to the `Camera` interface and remove all `as any` casts.

---

### C3 – Background & foreground processes share one container (Reliability / PID 1)
**File:** `docker-compose.yml:92`

The backend container command runs `npx tsx watch` in the background (`&`) and a shell health-monitor script in the foreground. Docker tracks only the foreground PID; if `tsx watch` crashes, the container keeps running without the actual backend. Conversely, if the health-monitor script exits (or the shell closes), the container stops, killing the backend.
```yaml
command: ["sh", "-c", "npx tsx watch ... & sh /app/health-monitor.sh"]
```
**Recommendation:** Run a single process per container. Use a process manager (supervisord, s6, or tini) if multiple processes are truly required. Better: move the health check to the container healthcheck field and run only `npx tsx watch` in the foreground.

---

### C4 – `NET_RAW` capability on backend API container (Security)
**File:** `docker-compose.yml:93-94`

The backend container is granted `NET_RAW`, which permits raw socket access and packet crafting. An Express API server has no legitimate need for raw sockets.
```yaml
cap_add:
  - NET_RAW
```
**Recommendation:** Remove `cap_add: [NET_RAW]`. If RTSP stream handling requires raw sockets, restrict this capability to a dedicated stream-processing container with a minimal base image.

---

### C5 – Redis exposed without authentication (Security)
**File:** `docker-compose.yml:146-159`

Redis binds to the Docker host port `6379` with no password (`--requirepass` is absent). Anyone who can reach the host can read/write Redis data, including cached sessions, detection results, and potentially JWT tokens if they are stored in the cache.
**Recommendation:** Bind Redis only to the internal Docker network (remove the `ports` block), or add `--requirepass` with a non-default password and configure `REDIS_PASSWORD` on consuming services.

---

### C6 – Silent failure returns empty camera list (Reliability / Observability)
**File:** `server/src/config/index.ts:302-304`

When camera config fails to load (malformed JSON in env var or file), the catch block returns an empty array. The server starts with zero cameras and no alert is surfaced to the operator.
```ts
} catch (error) {
  console.error('Failed to load camera configuration:', error);
  return [];
}
```
**Recommendation:** Fail the startup explicitly (`process.exit(1)` after logging) in `NODE_ENV=production`, or at minimum emit a `CRITICAL`-level alert so the operator is immediately aware.

---

## Warnings

### W1 – Unbounded buffer growth on corrupted frame data (Stability)
**File:** `server/src/streams/rtspManager.ts:449-512`

When a start-of-frame marker (`0xFFD8`) is found but the end marker (`0xFFD9`) is not, the loop breaks and residual data accumulates in `buffer`. Repeated corrupted chunks cause the buffer to grow without bound until OOM.
**Recommendation:** Impose a maximum buffer size (e.g., 5 MB). When exceeded, discard data up to the next `0xFFD8` marker or reset the buffer.

---

### W2 – Repeated `Buffer.slice` allocations causing GC pressure (Performance)
**File:** `server/src/streams/rtspManager.ts:463`

Each frame extraction creates two new `Buffer` objects (one for the frame, one for the remaining buffer). At 2–4 FPS per camera with minimal allocation:
```ts
buffer = buffer.slice(endMarkerPos + 2);
```
Over time this creates significant GC churn.
**Recommendation:** Use an offset-based approach that tracks position without re-slicing, or pool buffers for reuse.

---

### W3 – Base64 encoding of video frames (Performance / Bandwidth)
**File:** `server/src/streams/rtspManager.ts:493`

Frames are converted to base64 for Socket.IO transmission, increasing payload size by ~33%. Socket.IO supports `Buffer` and `ArrayBuffer` natively for binary data.
```ts
data: frameBuffer.toString("base64")
```
**Recommendation:** Send binary frames directly. If using Socket.IO, set `maxHttpBufferSize` appropriately and send `Buffer` data. For binary-only connections, consider WebSocket with binary framing.

---

### W4 – Unreachable dead code in `stopStream`
**File:** `server/src/streams/rtspManager.ts:604`

Every branch in `stopStream` returns `true`; line 604 is never reached.
```ts
return false; // Dead code
```
**Recommendation:** Remove the unreachable line.

---

### W5 – Misleading "SIMULATION MODE DISABLED" comment (Maintainability)
**File:** `server/src/streams/rtspManager.ts:950-952`

The comment claims simulation is disabled but `simulateMotionDetection()` (lines 808–886) is still fully implemented and callable. The code and comment are contradictory.
**Recommendation:** Either remove `simulateMotionDetection` and its callers, or update/remove the comment.

---

### W6 – Synchronous filesystem calls in async function (Performance)
**File:** `server/src/streams/rtspManager.ts:756-765`

`takeSnapshot` is `async` but uses `fs.existsSync`, `fs.mkdirSync`, and `fs.writeFileSync`, blocking the event loop for disk I/O.
**Recommendation:** Use `fs.promises` equivalents (`mkdir`, `writeFile`) and `await` them.

---

### W7 – Two competing FFmpeg restart mechanisms (Stability)
**File:** `server/src/streams/rtspManager.ts:430-445`

When FFmpeg exits, two independent restart paths may fire:
1. Lines 433–437: Restarts `detect` after 5s (if signal was not SIGTERM).
2. Lines 441–445: Restarts the original `role` after `5000 * retryCount` ms (if code was non-zero).

These can race or cause duplicate FFmpeg processes.
**Recommendation:** Unify into a single retry path with exponential backoff and a single responsibility for restart logic.

---

### W8 – PostgreSQL port exposed to Docker host (Security)
**File:** `docker-compose.yml:8-9`

```yaml
ports:
  - "5432:5432"
```
The database is directly reachable from the host network. In production this should not be accessible outside the Docker internal network.
**Recommendation:** Remove the host port mapping for `postgres` unless external DB tooling requires it. Services communicate over the internal `sentryvision_network`.

---

### W9 – Hardcoded weak credentials in compose file (Security)
**File:** `docker-compose.yml:15-16,60-62,191-193`

Postgres username and password (`sentryvision` / `sentryvision123`) are hardcoded and reused across the database, backend, and OpenCV service. These values also appear in `DATABASE_URL` (line 72).
**Recommendation:** Use environment variable overrides (`${DB_PASSWORD}`) with secure defaults for production. Remove `DATABASE_URL` to avoid duplicating credentials.

---

### W10 – Silently swallowed security audit errors (Observability)
**File:** `server/src/config/index.ts:47-50,55-57`

Security events (`CREDENTIAL_DECRYPTION_FAILED`, `PLAINTEXT_CREDENTIALS_DETECTED`) are logged with `.catch(() => {})`. Failures in security auditing are invisible.
```ts
logSecurityEventDeferred(...).catch(() => {});
```
**Recommendation:** At minimum log the audit failure itself with `console.error`. Use a fallback like appending to a separate audit file when the database is unavailable.

---

### W11 – Empty `validateConfig` function (Dead Code)
**File:** `server/src/config/index.ts:390-392`

```ts
export const validateConfig = (): void => {
  // JWT secret is now enforced at config load time (fail-fast).
  // This function is kept for future validation needs.
};
```
This function exists only for a comment. It is never called and does nothing.
**Recommendation:** Either implement validation logic or remove the function.

---

### W12 – Fake process object type-cast (Type Safety)
**File:** `server/src/streams/rtspManager.ts:691-693`

`startTestStream` creates a fake process object and casts it:
```ts
stream.process = {
  kill: () => clearInterval(interval)
} as unknown as ChildProcessWithoutNullStreams;
```
This bypasses the type system and could break code that expects a real `ChildProcess`.
**Recommendation:** Define a minimal `StreamProcessHandle` interface with a `kill()` method and use it in `CameraStream` instead of the full `ChildProcessWithoutNullStreams` type.

---

### W13 – Host node_modules mounted in container (Compatibility)
**File:** `docker-compose.yml:86`

```yaml
- ./server/node_modules:/app/node_modules
```
If the host OS differs from the container OS (e.g., macOS host, Linux container), native Node.js addons (e.g., `bcrypt`, `ffmpeg-static`) will fail to load.
**Recommendation:** Install dependencies inside the Dockerfile instead of bind-mounting host `node_modules`. Use a Docker volume for cache if needed.

---

## Info

### I1 – Inconsistent logging (console vs. logger utility)
**File:** `server/src/streams/rtspManager.ts:5-6,24,26,121,144,339,345,385,...`

The file imports `logger` (line 7) and uses `console.log`/`console.error` throughout for operational messages. Only `toggleNightMode` (line 792) uses `logger.info`. This bypasses the logger's filtering, rotation, and structured metadata.
**Recommendation:** Replace `console.log`/`console.error` with `logger.info`/`logger.error` throughout, using the `'STREAM'` source tag.

---

### I2 – Long anonymous callback in stdout handler
**File:** `server/src/streams/rtspManager.ts:449-512`

The `process.stdout.on("data", ...)` callback spans ~60 lines of inline logic. It handles frame extraction, adaptive FPS, emission, health monitoring, and motion detection.
**Recommendation:** Extract into a named method like `handleFrameData(buffer)` for readability and unit-testability.

---

### I3 – Hardcoded camera-specific debug logging
**File:** `server/src/streams/rtspManager.ts:500-503`

```ts
if (cameraId === 'cam2') {
  console.log(`[StreamManager] Emitted frame to ${roomName}, size: ${frameBuffer.length}`);
}
```
The hardcoded `cam2` string means debug output silently stops if the camera is renamed.
**Recommendation:** Use a config-based debug camera list or a runtime flag (e.g., `DEBUG_CAMERA` env var).

---

### I4 – Fail-fast JWT secret crash (Resilience)
**File:** `server/src/config/index.ts:246-248`

```ts
if (!jwtSecret) throw new Error('JWT_ACCESS_SECRET or JWT_SECRET must be configured');
```
The entire server crashes at import time if the secret is missing. While this is arguably correct (fail-fast), it prevents any graceful startup sequence that could serve a health-check or configuration page.
**Recommendation:** Consider deferring JWT validation to a startup phase that logs a clear, actionable error before initiating `process.exit(1)`.

---

### I5 – node_modules bind mount on Python service
**File:** `docker-compose.yml:199`

```yaml
- ./opencv-service/node_modules:/app/node_modules
```
The OpenCV Python service has a `/app/node_modules` mount, which is meaningless for a Python application. The directory likely does not exist on the host.
**Recommendation:** Remove this mount from the `opencv` service definition.

---

### I6 – Unsafe type assertion for MQTT QoS
**File:** `server/src/config/index.ts:265`

```ts
qos: parseInt(process.env.MQTT_QOS || '0', 10) as 0 | 1 | 2
```
If `MQTT_QOS` is set to an invalid value (e.g., `"5"`), the cast silently lies to TypeScript while the runtime receives an unsupported QoS value.
**Recommendation:** Add a validation step that clamps or rejects invalid QoS values at configuration load time.

---

### I7 – No resolution format validation
**File:** `server/src/config/index.ts:329`

```ts
defaultResolution: process.env.DEFAULT_RESOLUTION || '640x360'
```
There is no validation that the string matches the `WIDTHxHEIGHT` format. A misconfigured value (e.g., `"abc"`) would produce `NaN` dimensions at `rtspManager.ts:360`.
**Recommendation:** Validate the format with a regex or `split`-and-parse check during config loading, with a fallback to the default.
