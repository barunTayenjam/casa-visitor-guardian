# Phase 8: Reliability & Type Safety - Research

**Researched:** 2026-05-30
**Domain:** Server reliability, async I/O patterns, TypeScript strict mode migration
**Confidence:** HIGH

## Summary

Phase 8 addresses 6 reliability issues and 3 type safety concerns across the Express/TypeScript backend. The reliability issues range from a critical partial-startup bug (REL-01) where `initializeServices` catches and logs errors but allows the server to continue running in a broken state, to event-loop-blocking synchronous `fs` calls (REL-03/REL-04) in request handlers. The type safety issues center on 260 explicit `any` usages across 30+ server files, `strict: false` in both tsconfig.json files, and an EventBus `emitError` → `emitEvent` infinite-loop risk (TYP-03).

**Primary recommendation:** Tackle in 3 plans as suggested — (1) startup reliability + health, (2) async I/O + Socket.io consolidation, (3) type safety. The `noImplicitAny` migration is smaller than feared (only 9 errors), making it feasible within this phase.

<phase_requirements>

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| REL-01 | Server starts in partially-initialized state; service init failure logged but not fatal | `initializeServices()` catch block at index.ts:477-479 swallows all errors. Critical services identified: DB, auth, StreamManager. Non-critical: notification, cleanup, review. |
| REL-02 | Dual Socket.io event handling (requestStream/stopStream handled twice) | index.ts:495-536 AND rtspManager.ts:102-168 both register `requestStream`/`stopStream` handlers on `io.on('connection')`. rtspManager has viewer tracking; index.ts has room management. Both run. |
| REL-03 | Synchronous fs.existsSync/writeFileSync in request handlers blocks event loop | 8 sync fs calls in index.ts request handlers (lines 95,106,120,128,182,193,207,215). 3 sync fs calls in rtspManager.ts:317-321 (snapshot save). |
| REL-04 | File scanning fallback does up to 60 sync fs calls per image request | index.ts:88-99 and 176-184 loop 5 years × 12 months = 60 `fs.existsSync()` calls when DB lookup fails. |
| REL-05 | Dual service access (direct import vs serviceRegistry) for streamManager | motion.ts:3 and detection-operations.ts:3 import `streamManager` directly from rtspManager.js. Should use `serviceRegistry.getStreamManager()` instead. |
| REL-06 | Python service health not checked before frame relay starts | rtspManager.ts:54-63 `wirePythonWsFrames()` gets PythonWsClient but doesn't check if Python service is reachable. Connection state not surfaced to frontend. |
| TYP-01 | 285+ `any` type usages across server; Event JSONB columns untyped | 260 explicit `any` across 30 files. Top offenders: eventSearchService (24), batchProcessingWorker (23), NvidiaController (23). Event.ts JSONB columns typed as `any` at lines 93,101. |
| TYP-02 | strict: false in both tsconfig.json despite AGENTS.md claiming strict mode | Server tsconfig has `strict: false`. Enabling `noImplicitAny` produces only 9 errors. Full `strict` produces 15 errors — both manageable. |
| TYP-03 | EventBus data: any + potential infinite loop in emitError → emitEvent | eventBus.ts:212-223 `emitError` calls `emitEvent` with `type: 'error'`. If `processEvent` for `error` type throws, `emitError` is called again → infinite recursion. No re-entrancy guard. |

</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Service initialization & health checks | API / Backend | — | Server startup is entirely backend-controlled |
| Socket.io event routing | API / Backend | Browser / Client (receives events) | Both handler sites live in backend; frontend is consumer |
| Async file I/O | API / Backend | — | All sync fs calls are in backend request handlers |
| Directory caching | API / Backend | — | Cache lives in server process memory |
| TypeScript strict mode | Build / Compile | — | tsconfig.json change; no runtime impact |
| Type definitions (JSONB) | API / Backend | Database / Storage (schema owner) | Types describe PostgreSQL JSONB columns |
| EventBus typing & safety | API / Backend | — | Pure backend event system |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Node.js | v26.2.0 | Runtime | Already in use [VERIFIED: runtime] |
| TypeScript | current | Type system | Already in use [VERIFIED: server/package.json] |
| ts-jest | current | Test runner | Already configured with ESM preset [VERIFIED: jest.config.mjs] |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `fs.promises` | built-in | Async file operations | Replace all sync `fs.*` calls in request handlers |
| `@types/web-push` | 3.6.4 | Type declarations for web-push | Fixes TS7016 error when enabling noImplicitAny [VERIFIED: npm registry, slopcheck OK] |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| In-memory directory cache | Redis cache | Redis adds infrastructure dependency; in-memory sufficient for single-server deployment |
| Full `strict: true` | `noImplicitAny` only | Full strict adds `strictNullChecks`, `strictPropertyInitialization` etc. — 15 errors vs 9. Incremental approach safer |

**Installation:**
```bash
cd server && npm install --save-dev @types/web-push
```

**Version verification:**
```
@types/web-push: 3.6.4 (npm registry, slopcheck OK)
Node.js: v26.2.0
TypeScript: already installed in server
```

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| @types/web-push | npm | ~7 yrs | ~400K/wk | github.com/DefinitelyTyped | OK | Approved |

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

This phase has minimal new package dependencies. The primary work is refactoring existing code.

## Architecture Patterns

### System Architecture Diagram

```
┌──────────────────────────────────────────────────────────────────┐
│                     Server Startup (index.ts)                     │
│                                                                    │
│  initializeServices()                                             │
│    ├─► DB init (CRITICAL) ─── fail → process.exit(1)             │
│    ├─► Auth seed (CRITICAL) ── fail → process.exit(1)            │
│    ├─► PythonWsClient.connect()                                   │
│    ├─► StreamManager (CRITICAL) ── fail → process.exit(1)        │
│    ├─► Review/Timeline/Detection services                        │
│    ├─► NotificationService                                        │
│    └─► Cleanup services                                           │
│                                                                    │
│  /health/ready endpoint ──► 503 if critical services not init    │
│  /health endpoint ──► always returns ok (liveness)               │
└──────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│                    Request Handler Flow                            │
│                                                                    │
│  GET /events/:filename                                            │
│    ├─► DB query for storage_path (async)                          │
│    │     └─► on success → fs.promises.access() → sendFile()      │
│    │                                                               │
│    └─► DB miss/fail → in-memory dir cache lookup                  │
│          └─► cache hit → sendFile()                               │
│          └─► cache miss → async scan → cache update → sendFile() │
│                                                                    │
│  POST /snapshot (rtspManager.takeSnapshot)                        │
│    └─► fs.promises.mkdir() + fs.promises.writeFile()              │
└──────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│                Socket.io Handler Consolidation                     │
│                                                                    │
│  rtspManager.ts ONLY:                                             │
│    ├─► requestStream → join room, track viewer, subscribe Python  │
│    ├─► stopStream → leave room, untrack, unsubscribe Python       │
│    └─► disconnect → cleanup all viewer entries                    │
│                                                                    │
│  index.ts: REMOVED (all Socket.io handlers)                       │
└──────────────────────────────────────────────────────────────────┘
```

### Recommended Project Structure
```
server/src/
├── types/
│   ├── event.ts           # (exists) — add ObjectDetection[], FaceDetection[] types
│   ├── api.ts
│   ├── detection.ts
│   └── security.ts        # EventBus typed event data
├── services/
│   ├── serviceRegistry.ts # (exists) — canonical service access
│   └── ...
├── streams/
│   ├── rtspManager.ts     # consolidated Socket.io handlers
│   └── ...
└── events/
    └── eventBus.ts        # typed data, re-entrancy guard
```

### Pattern 1: Service Initialization with Fail-Fast
**What:** Critical services abort startup; non-critical services degrade gracefully
**When to use:** `initializeServices()` in index.ts
**Example:**
```typescript
// CRITICAL: DB failure must abort
try {
  await initializeDatabase();
} catch (error) {
  console.error('FATAL: Database initialization failed:', error);
  process.exit(1);
}

// NON-CRITICAL: notification failure degrades gracefully
try {
  NotificationService.initialize();
  serviceRegistry.setNotificationService(NotificationService);
} catch (error) {
  console.error('WARNING: Notification service failed (non-critical):', error);
}
```

### Pattern 2: Async File I/O with Caching
**What:** Replace sync `fs.existsSync` loops with async `fs.promises.access` + in-memory cache
**When to use:** Image serving fallback in `/events/:filename` and `/snapshots/:filename`
**Example:**
```typescript
import { promises as fsp } from 'node:fs';

// Cache: Map<filename, absolutePath | null>
const imageCache = new Map<string, string | null>();
const CACHE_TTL = 60_000; // 1 minute

async function findImagePath(filename: string): Promise<string | null> {
  const cached = imageCache.get(filename);
  if (cached !== undefined) return cached;

  // Try current month first (most likely)
  const yearMonth = formatYearMonth(new Date());
  const likelyPath = buildPath(yearMonth, filename);
  try {
    await fsp.access(likelyPath);
    imageCache.set(filename, likelyPath);
    return likelyPath;
  } catch { /* not found */ }

  // Broader search only if current month miss
  // ... async scan with fsp.access
  imageCache.set(filename, null); // negative cache
  return null;
}
```

### Pattern 3: Typed JSONB Columns in TypeORM
**What:** Replace `any` with typed interfaces for PostgreSQL JSONB columns
**When to use:** Event.ts `object_detections` and `face_detections` columns
**Example:**
```typescript
// Use existing types from detectionDataNormalizer.ts
import { NormalizedDetection, NormalizedFaceDetection } from '../utils/detectionDataNormalizer.js';

@Column({
  type: 'jsonb',
  nullable: true,
  default: () => "'[]'",
})
object_detections!: NormalizedDetection[];

@Column({
  type: 'jsonb',
  nullable: true,
  default: () => "'[]'",
})
face_detections!: NormalizedFaceDetection[];
```

### Anti-Patterns to Avoid
- **Swallowing startup errors:** The current `catch` at index.ts:477-479 logs but continues. This leaves the server accepting requests it can't handle.
- **Dual event handler registration:** Both index.ts and rtspManager.ts register `io.on('connection')` handlers for the same events. Both execute, causing duplicate room joins and potential race conditions.
- **Sync fs in request handlers:** `fs.existsSync` blocks the event loop. Under load with 60 iterations per request, this causes latency spikes for ALL concurrent requests.
- **Direct module imports for services:** `import { streamManager } from '../streams/rtspManager.js'` bypasses the service registry and may get the instance before it's initialized.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| File existence checks | `fs.existsSync` in loops | `fs.promises.access` + cache | Sync I/O blocks event loop; cache eliminates repeated scans |
| Directory creation | `fs.mkdirSync` | `fs.promises.mkdir({ recursive: true })` | Identical semantics, non-blocking |
| Snapshot file writes | `fs.writeFileSync` | `fs.promises.writeFile` | Identical semantics, non-blocking |
| Service access pattern | Direct imports | `serviceRegistry.getX()` | Registry provides fail-fast if uninitialized; direct import may be undefined at module load |
| Event bus re-entrancy | Recursive `emitError` calls | Re-entrancy guard flag | Prevents infinite loop when error handling itself fails |

**Key insight:** All the sync fs replacements have direct async equivalents in `fs.promises` — this is a drop-in replacement with no library dependencies.

## Common Pitfalls

### Pitfall 1: Socket.io Handler Duplication Race
**What goes wrong:** Both index.ts and rtspManager.ts handle `requestStream`. When a client connects, both handlers fire. index.ts joins the room and starts the stream; rtspManager.ts also joins the room and tracks the viewer. On `stopStream`, index.ts checks room size before stopping; rtspManager doesn't check rooms. This creates inconsistency.
**Why it happens:** rtspManager was written to own streaming but index.ts was never cleaned up after Phase 5 simplified rtspManager.
**How to avoid:** Remove ALL Socket.io handlers from index.ts. rtspManager.ts handles everything via its `setupConnectionTracking()` method. Need to merge the room-size check logic from index.ts into rtspManager.
**Warning signs:** Clients receiving duplicate frames, streams not stopping when expected, viewer counts off by 1.

### Pitfall 2: Startup Race with PythonWsClient
**What goes wrong:** `initializeServices` creates `PythonWsClient` and calls `connect()` (async WebSocket handshake). Then `setupRTSPStreams` creates `StreamManager` which calls `wirePythonWsFrames()`. If Python WS isn't connected yet, `wirePythonWsFrames` gets `pythonWs` but it hasn't connected. The `connected` event listener IS set up (line 58-63 of rtspManager.ts), so it eventually works, but there's no health status for the frontend.
**Why it happens:** Python WS connection is fire-and-forget with auto-reconnect. No readiness signal.
**How to avoid:** Add a `GET /health/ready` endpoint that checks Python WS connection state + DB + StreamManager. Frontend can poll this and show "connecting..." until ready.
**Warning signs:** Frontend shows camera feeds but no frames arrive for the first few seconds after server restart.

### Pitfall 3: noImplicitAny Breaking Web-Push
**What goes wrong:** Enabling `noImplicitAny` causes `TS7016` for `web-push` module which lacks type declarations.
**Why it happens:** `web-push@3.6.7` doesn't ship types and `@types/web-push` isn't installed.
**How to avoid:** Install `@types/web-push` as devDependency before enabling `noImplicitAny`.
**Warning signs:** Build fails with "Could not find a declaration file for module 'web-push'."

### Pitfall 4: EventBus Infinite Recursion
**What goes wrong:** `emitEvent` catches errors and calls `emitError`. `emitError` calls `emitEvent` with `type: 'error'`. If `processEvent` for error events throws (e.g., accessing `event.data.confidence` on undefined data), `emitError` is called again → stack overflow.
**Why it happens:** No re-entrancy guard. The error path re-enters the normal path.
**How to avoid:** Add `private emitting = false` flag. If `emitEvent` is called while `emitting` is true, just `console.error` and return.
**Warning signs:** `RangeError: Maximum call stack size exceeded` in EventBus.

### Pitfall 5: Directory Cache Staleness
**What goes wrong:** Caching file lookups with a long TTL means newly saved images aren't found.
**Why it happens:** If the cache stores negative results (file not found), a newly saved image won't appear until the cache entry expires.
**How to avoid:** Use short TTL (60s) for negative cache. Invalidate positive cache entries on file write events. Consider: when Python saves a new detection image, clear the cache entry for that filename.
**Warning signs:** New detection images return 404 for up to 60 seconds after being saved.

## Code Examples

### Async File Serving with Cache (index.ts replacement)
```typescript
// Source: Node.js fs.promises API + existing index.ts pattern
import { promises as fsp } from 'node:fs';

const imageCache = new Map<string, { path: string; expires: number } | null>();

function buildEventPath(yearMonth: string, filename: string): string {
  return path.join(process.cwd(), 'data', 'detections', yearMonth, 'events', 'motion', filename);
}

async function findEventImage(filename: string): Promise<string | null> {
  const cached = imageCache.get(filename);
  if (cached && cached.expires > Date.now()) return cached.path;

  // Current month first (most likely hit)
  const now = new Date();
  const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const currentPath = buildEventPath(ym, filename);
  try {
    await fsp.access(currentPath);
    imageCache.set(filename, { path: currentPath, expires: Date.now() + 300_000 });
    return currentPath;
  } catch { /* continue */ }

  // Broader year-month scan (async)
  for (let y = now.getFullYear(); y >= now.getFullYear() - 4; y--) {
    for (let m = 12; m >= 1; m--) {
      const candidate = buildEventPath(`${y}-${String(m).padStart(2, '0')}`, filename);
      try {
        await fsp.access(candidate);
        imageCache.set(filename, { path: candidate, expires: Date.now() + 300_000 });
        return candidate;
      } catch { continue; }
    }
  }

  imageCache.set(filename, null); // negative cache
  return null;
}
```

### Consolidated Socket.io Handlers (rtspManager.ts pattern)
```typescript
// Source: Existing rtspManager.ts setupConnectionTracking + index.ts room logic
private setupConnectionTracking(): void {
  this.io.on('connection', (socket) => {
    socket.on('requestStream', (data: { cameraId: string }) => {
      const camera = this.cameras.get(data.cameraId);
      if (!camera) {
        socket.emit('streamError', { cameraId: data.cameraId, error: 'Camera not found' });
        return;
      }
      camera.activeViewers.add(socket.id);
      socket.join(`camera-${data.cameraId}-live`);
      camera.isActive = true;

      // Subscribe to Python WS
      const pythonWs = serviceRegistry.getPythonWsClient();
      if (pythonWs?.connected) pythonWs.subscribe(data.cameraId);

      socket.emit('streamStarted', { cameraId: data.cameraId });
    });

    socket.on('stopStream', (data: { cameraId: string }) => {
      const camera = this.cameras.get(data.cameraId);
      if (!camera) return;
      camera.activeViewers.delete(socket.id);
      socket.leave(`camera-${data.cameraId}-live`);

      if (camera.activeViewers.size === 0) {
        const pythonWs = serviceRegistry.getPythonWsClient();
        if (pythonWs?.connected) pythonWs.unsubscribe(data.cameraId);
      }
    });

    socket.on('disconnect', () => {
      this.cameras.forEach((camera, cameraId) => {
        if (camera.activeViewers.has(socket.id)) {
          camera.activeViewers.delete(socket.id);
          if (camera.activeViewers.size === 0) {
            const pythonWs = serviceRegistry.getPythonWsClient();
            if (pythonWs?.connected) pythonWs.unsubscribe(cameraId);
          }
        }
      });
    });
  });
}
```

### EventBus Re-entrancy Guard
```typescript
// Source: eventBus.ts existing code + guard pattern
async emitEvent(event: SecurityEvent): Promise<void> {
  try {
    const enrichedEvent: SecurityEvent = {
      ...event,
      id: event.id || this.generateEventId(),
      timestamp: event.timestamp || new Date(),
    };
    this.eventQueue.push(enrichedEvent);
    this.emit(event.type, enrichedEvent);
    this.processQueue();
  } catch (error) {
    console.error('Failed to emit event:', error);
    this.emitError('Event emission failed', error);
  }
}

private _isEmittingError = false;

private emitError(message: string, error: any): void {
  if (this._isEmittingError) {
    // Re-entrancy guard: just log, don't recurse
    console.error('EventBus: error during error emission (suppressed):', message, error);
    return;
  }
  this._isEmittingError = true;
  try {
    this.emitEvent({
      type: 'error',
      data: { message, error: error instanceof Error ? error.message : String(error) },
      source: 'EventBus',
      severity: 'medium',
    });
  } finally {
    this._isEmittingError = false;
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `fs.*Sync` in request handlers | `fs.promises.*` + caching | Node.js 10+ (2018) | Required for non-blocking I/O in Express handlers |
| `(global as any).service` | ServiceRegistry singleton | Phase 7 (2026-05-30) | Type-safe service access with fail-fast |
| Direct module imports for services | serviceRegistry.getX() | Phase 7 (2026-05-30) | Consistent pattern; fails clearly if uninitialized |
| `strict: false` | `noImplicitAny` → `strict: true` (incremental) | This phase | Catches type errors at compile time |

**Deprecated/outdated:**
- `streamManager` direct export from rtspManager.ts: Line 469 `export { streamManager }` creates a module-level variable that may be undefined before `setupRTSPStreams` runs. This should be replaced with `serviceRegistry.getStreamManager()` in consumers.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Python WS reconnection handles transient disconnections — no frontend notification needed beyond health endpoint | REL-06 | Frontend may need explicit reconnect UI |
| A2 | In-memory directory cache is sufficient (no Redis needed) — single-server deployment | REL-04 | If multi-instance, cache misses across instances |
| A3 | The 6 additional strict mode errors (beyond noImplicitAny's 9) are also straightforward fixes | TYP-02 | Could be complex type refactorings |
| A4 | Consolidating Socket.io handlers into rtspManager.ts only won't break frontend — the frontend listens to the same Socket.io events | REL-02 | Frontend may depend on subtle timing of dual handlers |

## Open Questions

1. **Should the `/health` endpoint be split into liveness vs readiness?**
   - What we know: Currently `/health` always returns `ok`. REQS.md asks for `/health/ready` returning 503.
   - What's unclear: Should `/health` (liveness) remain as-is, or should it also check services?
   - Recommendation: Keep `/health` as liveness (always 200). Add `/health/ready` that checks DB + StreamManager + PythonWs connection state. Kubernetes-style pattern.

2. **How aggressively to enable strict mode?**
   - What we know: `noImplicitAny` → 9 errors. Full `strict` → 15 errors.
   - What's unclear: Whether the 6 additional strict errors (strictNullChecks, etc.) are safe to fix in this phase.
   - Recommendation: Enable `noImplicitAny` now. Leave full `strict` for Phase 9 after code decomposition reduces file complexity.

3. **Should the `streamManager` module export be removed?**
   - What we know: motion.ts and detection-operations.ts import it directly. serviceRegistry has `getStreamManager()`.
   - What's unclear: Whether other files also import directly.
   - Recommendation: Files importing directly: CameraController.ts, SystemController.ts, motion.ts, detection-operations.ts, index.ts. Convert motion.ts and detection-operations.ts to use registry. Leave CameraController.ts and SystemController.ts for Phase 9 decomposition.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Server runtime | ✓ | v26.2.0 | — |
| TypeScript | Build | ✓ | current (server) | — |
| PostgreSQL | Database | ✗ | — | Not needed for code changes |
| Redis | Cache | ✗ | — | In-memory cache (already fallback) |
| Server (running) | Integration testing | ✓ | port 9753 | — |
| Jest | Tests | ✓ | configured | — |
| ts-jest | Test runner | ✓ | configured | — |

**Missing dependencies with no fallback:**
- None for this phase — all work is code-level refactoring

**Missing dependencies with fallback:**
- PostgreSQL/Redis not needed for code changes; server is running for smoke tests

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Jest + ts-jest (ESM) |
| Config file | server/jest.config.mjs |
| Quick run command | `cd server && npm run test:server -- --testPathPattern="<pattern>" --no-coverage` |
| Full suite command | `cd server && npm run test:server` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| REL-01 | Server exits if DB init fails | unit | `npm run test:server -- --testPathPattern="index"` | ✅ index.test.ts |
| REL-02 | Socket.io handlers only in rtspManager | unit | `npm run test:server -- --testPathPattern="rtspManager"` | ✅ rtspManager.test.ts |
| REL-03 | No sync fs in request handlers | lint/static | `rg "fs\\.existsSync" server/src/index.ts` | ❌ Wave 0 (custom check) |
| REL-04 | Directory cache hit/miss | unit | `npm run test:server -- --testPathPattern="imageCache"` | ❌ Wave 0 |
| REL-05 | Routes use serviceRegistry | lint/static | `rg "from.*rtspManager" server/src/routes/` | ❌ Wave 0 (custom check) |
| REL-06 | Health ready endpoint returns 503 when not init | unit | `npm run test:server -- --testPathPattern="health"` | ❌ Wave 0 |
| TYP-01 | Event.ts JSONB columns typed | compile | `cd server && npx tsc --noEmit` | ✅ (compile check) |
| TYP-02 | noImplicitAny enabled, 0 errors | compile | `cd server && npx tsc --noEmit --noImplicitAny` | ❌ Wave 0 (enable flag) |
| TYP-03 | EventBus re-entrancy guard | unit | `npm run test:server -- --testPathPattern="eventBus"` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `cd server && npm run test:server -- --testPathPattern="<changed-file>" --no-coverage`
- **Per wave merge:** `cd server && npm run test:server`
- **Phase gate:** `cd server && npx tsc --noEmit --noImplicitAny && npm run test:server`

### Wave 0 Gaps
- [ ] `server/src/events/eventBus.test.ts` — covers TYP-03 (re-entrancy guard)
- [ ] `server/src/utils/imageCache.test.ts` — covers REL-04 (directory caching)
- [ ] `server/src/routes/health.test.ts` — covers REL-01/REL-06 (readiness endpoint)
- [ ] Update `server/src/index.test.ts` — covers REL-01 (startup fail-fast)

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | No auth changes in this phase |
| V3 Session Management | no | No session changes |
| V4 Access Control | no | No access control changes |
| V5 Input Validation | no | No new inputs; existing validation preserved |
| V6 Cryptography | no | No crypto changes |

**Note:** This phase is purely reliability and type-safety refactoring. No new attack surfaces are introduced. Security-relevant changes are limited to fail-fast behavior (REL-01) which improves security by preventing partially-initialized servers from accepting requests.

### Known Threat Patterns for Server Reliability

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Partial startup serving requests without auth | Denial of Service | REL-01: process.exit(1) on critical service failure + /health/ready 503 |
| Event loop blocking causes request timeout | Denial of Service | REL-03/REL-04: async fs operations prevent event loop blocking |

## Sources

### Primary (HIGH confidence)
- Direct code inspection: `server/src/index.ts` (634 lines), `server/src/streams/rtspManager.ts` (469 lines), `server/src/events/eventBus.ts` (285 lines), `server/src/models/Event.ts` (105 lines)
- TypeScript compiler output: `npx tsc --noEmit --noImplicitAny` (9 errors), `npx tsc --noEmit --strict` (15 errors)
- Existing test infrastructure: server/jest.config.mjs + 21 test files

### Secondary (MEDIUM confidence)
- Node.js fs.promises documentation patterns for async file I/O
- TypeORM JSONB column typing patterns

### Tertiary (LOW confidence)
- None — all findings verified via code inspection

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - all tools already in use; no new libraries needed except @types/web-push
- Architecture: HIGH - direct code inspection of all affected files; error counts from compiler
- Pitfalls: HIGH - identified from actual code patterns, not theoretical

**Research date:** 2026-05-30
**Valid until:** 2026-06-30 (stable codebase; no fast-moving dependencies)
