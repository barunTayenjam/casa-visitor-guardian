# Phase 10: Critical Bug Fixes - Research

**Researched:** 2026-05-31
**Domain:** Backend bug fixes (Express/TypeORM auth, camera config, event deletion, SQL injection)
**Confidence:** HIGH

## Summary

This phase addresses 7 P0 critical bugs identified in a comprehensive audit of the SentryVision codebase. All bugs are confirmed by direct code inspection — every root cause was traced to a specific file, line, and function. No speculation required.

**Primary recommendation:** Fix in dependency order: SQL injection first (independent, zero-risk), then camera persistence (needed by camera create), then camera create (needs persistence), then lockout → MFA setup → MFA verify (auth chain has ordering dependency), then event deletion (independent).

All 7 bugs are straightforward implementation gaps — schemas/models exist, columns exist, frontend expectations are known. No new migrations needed. No new packages needed. Each fix is surgical: add the missing code to existing functions.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- FIX-001: Event deletion must remove from DB (`DELETE FROM events WHERE id = $1`), delete image file from disk (`fs.unlink`), and remove from in-memory state
- Both single and bulk delete must work
- Deletion must be transactional: if DB delete succeeds but file delete fails, log error but don't roll back DB delete
- FIX-002: Implement `persistCameras()` method in `rtspManager.ts` that writes current camera config to `cameras.json`
- Call `persistCameras()` after any create/update/delete/zone/filter operation
- Must handle concurrent writes safely (write to temp file, then rename)
- FIX-003: Generate proper camera ID (`cam${Date.now()}` or UUID) instead of empty string
- Return `{ success: true, camera: { id, ... } }` matching frontend expectation in `cameraService.ts`
- Write new camera to `cameras.json` via `persistCameras()`
- FIX-004: Before password check, verify `user.lockedUntil` is not in the future
- On bad password: increment `failedLoginAttempts`, set `lockedUntil` if threshold (5) reached
- On success: reset `failedLoginAttempts` to 0, clear `lockedUntil`
- Use existing `User` columns `failedLoginAttempts` and `lockedUntil`
- FIX-005: After generating TOTP secret, persist to `user.mfaSecret` in database
- Implement two-step enrollment: setup returns secret → user verifies code → only then set `mfaEnabled = true`
- FIX-006: Backend loads secret from `user.mfaSecret` instead of requiring client to send it
- Frontend sends `{ code }` only (already the case)
- Requires FIX-005 to be done first (secret must be in DB)
- FIX-007: Parameterize `days` parameter in batch processing history/cleanup queries
- Replace `INTERVAL '${days} days'` with parameterized `INTERVAL '$1 days'`

### Agent's Discretion
- Exact error messages for lockout
- Lockout duration formatting
- Camera ID format (timestamp-based vs UUID)
- MFA enrollment flow UX details
- Error handling for cameras.json write failures

### Deferred Ideas (OUT OF SCOPE)
- P1-P3 bugs deferred to Phases 11-13
- Token invalidation on logout (P1, Phase 11)
- Password history enforcement (P1, Phase 11)
- Dead schema cleanup (P3, Phase 13)
- Bounding box rendering fix (P1, Phase 11)
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| FIX-001 | Event deletion — currently a no-op, must delete from DB + disk + in-memory | Handler at `event-search.ts:191-206`. Uses `inMemoryState.getRecentEvents()`, finds event, returns success but never deletes. `Event` model has `file_path` column. `AppDataSource.query('DELETE FROM events WHERE id = $1')` is the pattern. `inMemoryState` has no `removeEvent()` method — must add one. |
| FIX-002 | Camera config persistence — changes lost on restart | `config/index.ts:287-296` loads `cameras.json` once at startup. No write-back path exists anywhere. `rtspManager.ts` has no `persistCameras()` method. Write to temp + rename pattern needed. |
| FIX-003 | Camera create broken end-to-end | `CameraController.ts:75-102` passes `id: ''` to `addCamera()`. Returns `{ cameraId }` but frontend expects `{ camera: { id } }` per `cameraService.ts:147`. No `persistCameras()` call after create. |
| FIX-004 | Account lockout unimplemented | `auth/index.ts:240-298` login handler never reads/writes `failedLoginAttempts` or `lockedUntil`. Config has `maxLoginAttempts: 5` and `lockoutDuration: 900000` (15 min). User model has both columns. SQL migration 001 confirms both columns exist in DB. |
| FIX-005 | MFA setup secret never persisted | `AuthController.ts:212-234` generates secret via `speakeasy.generateSecret()`, returns it, but never writes to DB. `users.mfa_secret` column exists (VARCHAR 32). Need `AppDataSource.query('UPDATE users SET mfa_secret = $1 WHERE id = $2')`. |
| FIX-006 | MFA verify protocol mismatch | `AuthController.ts:236-269` expects `{ code, secret }` from body. Frontend `authService.ts:63` sends `{ code }` only. Fix: load secret from `user.mfaSecret` in DB instead of req.body. Requires FIX-005 done first. |
| FIX-007 | SQL injection in batch processing | `batchProcessingDatabasePostgres.ts:488` uses `INTERVAL '${days} days'` (string interpolation). Same pattern at line 502 in `cleanupOldJobs`. Fix: parameterize as `INTERVAL '$1 days'` with `[days]` params. |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Event deletion | API / Backend | Database / Storage | Backend handles DELETE query + file unlink + in-memory state removal |
| Camera config persistence | API / Backend | CDN / Static | Backend writes `cameras.json` to local filesystem |
| Camera create | API / Backend | Database / Storage | Backend generates ID, persists config, returns to frontend |
| Account lockout | API / Backend | Database / Storage | Backend checks/increments lockout columns in `users` table |
| MFA setup/verify | API / Backend | — | Backend generates TOTP secret, persists, verifies codes |
| SQL injection fix | API / Backend | — | Backend parameterizes SQL queries in batch processing |

## Standard Stack

### Core (Already Installed — No New Packages)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| TypeORM | existing | DB access via `AppDataSource.query()` | Project convention — all SQL queries use `AppDataSource.query()` with parameterized `$1, $2` syntax |
| speakeasy | existing | TOTP generation + verification | Already imported in `AuthController.ts` |
| QRCode | existing | QR code data URL generation | Already imported in `AuthController.ts` |
| bcrypt | existing | Password hashing + comparison | Already used in `auth/index.ts` |
| `node:fs` / `node:fs/promises` | built-in | File I/O for image deletion + config persistence | Node.js standard library |
| `node:path` | built-in | Path resolution | Already used throughout codebase |

### No Alternatives Considered
All fixes use existing dependencies. No new packages needed.

**Installation:**
```bash
# No new packages required — all fixes use existing dependencies
```

**Version verification:**
```
All packages already in package.json — verified by import analysis in source files.
```

## Package Legitimacy Audit

> No new packages installed in this phase. All fixes use existing project dependencies.

| Package | Status |
|---------|--------|
| (none new) | N/A — all fixes use existing code and dependencies |

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Architecture Patterns

### System Architecture Diagram

```
Frontend                  Backend API              Database + Storage
┌──────────┐             ┌──────────────┐          ┌──────────────┐
│ Events   │──DELETE──→  │ event-search │──SQL───→ │ events table │
│ Page     │             │   route      │──fs───→  │ image files  │
│          │             │              │──→       │ inMemoryState│
└──────────┘             └──────────────┘          └──────────────┘

┌──────────┐             ┌──────────────┐          ┌──────────────┐
│ Camera   │──POST───→   │ CameraCtrl   │──→       │ rtspManager  │
│ Settings │──PUT────→   │              │          │  (in-memory  │
│          │             │              │──write─→ │ cameras.json │
└──────────┘             └──────────────┘          └──────────────┘

┌──────────┐             ┌──────────────┐          ┌──────────────┐
│ Login    │──POST───→   │ AuthCtrl     │──SQL───→ │ users table  │
│ MFA      │──GET────→   │ AuthService  │          │ (lockedUntil,│
│ Setup    │──POST───→   │              │          │  mfaSecret)  │
└──────────┘             └──────────────┘          └──────────────┘

                         ┌──────────────────────┐
                         │ BatchProcessingDB    │──SQL───→ batch_jobs
                         │ (SQL injection fix)  │
                         └──────────────────────┘
```

### Recommended Project Structure (No new files needed)

All fixes modify existing files in-place:
```
server/src/
├── routes/event-search.ts          # FIX-001: add deletion logic to archive handler
├── streams/rtspManager.ts          # FIX-002: add persistCameras() method
├── controllers/CameraController.ts # FIX-003: fix create() response + ID generation
├── auth/index.ts                   # FIX-004: add lockout logic to login()
├── controllers/AuthController.ts   # FIX-005, FIX-006: persist secret + load from DB
├── services/
│   ├── inMemoryStateService.ts     # FIX-001: add removeEvent() method
│   └── batchProcessingDatabasePostgres.ts  # FIX-007: parameterize SQL
```

### Pattern 1: AppDataSource.query() Parameterized SQL
**What:** All database operations in this codebase use `AppDataSource.query(sql, params)` with `$1, $2` parameterized placeholders.
**When to use:** For every SQL query that accepts user input.
**Example:**
```typescript
// Source: [VERIFIED: codebase pattern, used in auth/index.ts, eventSearchService.ts, etc.]
const result = await AppDataSource.query(
  'DELETE FROM events WHERE id = $1',
  [eventId]
);
```

### Pattern 2: BaseController Response Helpers
**What:** `BaseController` provides `ok()`, `created()`, `badRequest()`, `notFound()`, `serverError()` — all wrap `{ success: true/false, ...data }`.
**When to use:** All controller responses.
**Example:**
```typescript
// Source: [VERIFIED: server/src/controllers/BaseController.ts]
this.ok(res, { camera: { id: newCamera.id, name } });  // Returns { success: true, camera: { id, name } }
this.created(res, { cameraId });  // Returns 201 { success: true, cameraId }
```

### Pattern 3: Atomic File Write (temp + rename)
**What:** Write to a `.tmp` file, then `fs.rename()` for atomic replacement on POSIX filesystems.
**When to use:** Persisting `cameras.json` to prevent corruption from concurrent writes.
**Example:**
```typescript
// Source: [CITED: CONTEXT.md specifics section + POSIX atomic rename guarantee]
const tmpPath = camerasPath + '.tmp';
await fsp.writeFile(tmpPath, JSON.stringify(cameras, null, 2), 'utf8');
await fsp.rename(tmpPath, camerasPath);
```

### Anti-Patterns to Avoid
- **Never use `fs.unlinkSync` in Express handlers:** Use async `fsp.unlink()` to avoid blocking the event loop. The CONTEXT.md example uses `fs.unlinkSync` but the planner should use async version.
- **Never read `req.body.secret` for MFA verify:** The whole point of FIX-005/006 is that the secret is stored server-side. Loading it from the request body would reintroduce the vulnerability.
- **Never use string interpolation in SQL:** `INTERVAL '${days} days'` is exactly the SQL injection bug (FIX-007). Always use `$1` parameterized queries.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| TOTP verification | Custom time-based code logic | `speakeasy.totp.verify()` | Already imported, handles window tolerance, clock skew |
| Password hashing | Custom hash function | `bcrypt.compare()` / `bcrypt.hash()` | Already used in `auth/index.ts`, handles salting internally |
| SQL parameterization | Custom escaping/sanitization | `AppDataSource.query(sql, [params])` | TypeORM/Postgres driver handles escaping natively |
| Camera ID generation | Custom UUID or manual increment | `cam${Date.now()}` or `crypto.randomUUID()` | Simple, collision-resistant, matches existing `cam1`, `cam2` pattern |

**Key insight:** Every fix in this phase is "add the missing lines to existing functions" — no new architecture, no new patterns, no new dependencies.

## Runtime State Inventory

> Not a rename/refactor phase — this section is omitted.

## Common Pitfalls

### Pitfall 1: Event Deletion — inMemoryState Has No removeEvent()
**What goes wrong:** The planner might assume `inMemoryState.removeEvent()` exists. It doesn't. Only `addRecentEvent()`, `getRecentEvents()`, and `clearRecentEvents()` exist.
**Why it happens:** The `InMemoryStateService` class was built for adding/viewing events, never for removing them.
**How to avoid:** Add a `removeEvent(eventId: string): boolean` method to `InMemoryStateService`. Simple `filter` or `findIndex` + `splice` on the `recentEvents` array.
**Warning signs:** If the plan calls `inMemoryState.removeEvent()` without first adding the method.

### Pitfall 2: Event Deletion — Event May Not Be in inMemoryState
**What goes wrong:** `inMemoryState` only holds the last 100 events (`MAX_ENTRIES = 100`). The event being deleted may have already been pushed out of memory.
**Why it happens:** Busy systems generate > 100 events, and older ones are silently dropped from the in-memory array.
**How to avoid:** Deletion should NOT depend on finding the event in `inMemoryState`. Delete from DB first, then attempt in-memory removal (ignore if not found). For file path, query DB `SELECT file_path FROM events WHERE id = $1` BEFORE deleting the DB row.
**Warning signs:** If the plan checks `inMemoryState.getRecentEvents()` first and returns 404 if not found.

### Pitfall 3: Camera Persistence — cameras.json Path Resolution
**What goes wrong:** The `cameras.json` path is resolved relative to `config/index.ts` via `path.join(__dirname, '../../cameras.json')`. Since config is in `server/src/config/`, this resolves to `server/cameras.json`. The `rtspManager.ts` must use the same path.
**Why it happens:** `__dirname` in ESM is `server/src/config/` — going up 2 levels gives `server/`.
**How to avoid:** Use `path.join(process.cwd(), 'cameras.json')` from rtspManager, or import a shared path constant from config. Better yet, add a `getCamerasConfigPath()` export to `config/index.ts`.
**Warning signs:** If `persistCameras()` hardcodes a path that doesn't match where the config loader reads from.

### Pitfall 4: Camera Create — Frontend Expects Nested Response
**What goes wrong:** Backend returns `{ success: true, cameraId }` but frontend checks `data.camera?.id` (cameraService.ts:147). The `?.id` means if `data.camera` is undefined, the condition fails.
**Why it happens:** `BaseController.created()` wraps data as `{ success: true, ...data }`, so `{ cameraId }` becomes `{ success: true, cameraId }` — no `camera` object.
**How to avoid:** Return `{ camera: { id: newCameraId, name, ... } }` from the create handler.
**Warning signs:** If the plan only changes the ID generation but not the response shape.

### Pitfall 5: MFA Secret Column Length
**What goes wrong:** `users.mfa_secret` is `VARCHAR(32)`. A Base32-encoded TOTP secret from `speakeasy.generateSecret({ length: 20 })` produces a 32-character string. If `length` is increased, the secret could exceed column width.
**Why it happens:** The column was designed for exactly this use case — 20 bytes → 32 Base32 chars.
**How to avoid:** Keep `speakeasy.generateSecret({ length: 20 })` (or omit `length` — default is 20). Don't increase the secret length.
**Warning signs:** If the plan changes `length: 20` to something larger.

### Pitfall 6: Lockout — Login Query Doesn't Select lockout Columns
**What goes wrong:** The login query at `auth/index.ts:250` only selects `id, username, email, password_hash, status, role_name, created_at, updated_at`. It does NOT select `failed_login_attempts` or `locked_until`.
**Why it happens:** The lockout feature was never implemented, so the columns were never added to the SELECT.
**How to avoid:** Add `u.failed_login_attempts, u.locked_until` to the login query SELECT clause.
**Warning signs:** If the plan checks `dbUser.lockedUntil` without first adding it to the query.

### Pitfall 7: SQL Injection Fix — INTERVAL Parameterization Syntax
**What goes wrong:** PostgreSQL `INTERVAL` with parameterized queries requires specific syntax. `INTERVAL '$1 days'` won't work as a string — the `$1` must be a proper query parameter.
**Why it happens:** PostgreSQL type casting with INTERVAL is picky about how parameters are interpolated.
**How to avoid:** Use `NOW() - INTERVAL '1 day' * $1` or `NOW() - ($1 || ' days')::interval` with `[days]`. The safest pattern: `created_at >= NOW() - INTERVAL '1 day' * $1` with parameter `[days]`.
**Warning signs:** If the plan uses `INTERVAL '$1 days'` as a string literal — this won't parameterize correctly.

## Code Examples

Verified patterns from source code:

### Event Deletion (FIX-001)
```typescript
// Source: [VERIFIED: codebase pattern from eventSearchService.ts + inMemoryStateService.ts]
// In event-search.ts archive handler:

// 1. Get file_path from DB before deleting
const [eventRow] = await AppDataSource.query(
  'SELECT file_path FROM events WHERE id = $1',
  [eventId]
);

if (!eventRow) {
  return res.status(404).json({ success: false, error: 'Event not found' });
}

// 2. Delete from database
await AppDataSource.query('DELETE FROM events WHERE id = $1', [eventId]);

// 3. Delete image file (best-effort, don't fail if file missing)
try {
  const imagePath = path.join(process.cwd(), eventRow.file_path);
  await fsp.unlink(imagePath);
} catch (err) {
  logger.warn(`Failed to delete event image: ${(err as Error).message}`, 'EventSearch');
}

// 4. Remove from in-memory state (best-effort)
inMemoryState.removeEvent(eventId);

res.json({ success: true, message: 'Event deleted successfully' });
```

### inMemoryStateService removeEvent (FIX-001 prerequisite)
```typescript
// Source: [VERIFIED: inMemoryStateService.ts existing patterns]
removeEvent(eventId: string): boolean {
  const index = this.recentEvents.findIndex(e => e.id === eventId);
  if (index === -1) return false;
  this.recentEvents.splice(index, 1);
  return true;
}
```

### Camera Config Persistence (FIX-002)
```typescript
// Source: [VERIFIED: config/index.ts camerasPath resolution + rtspManager.ts patterns]
// In rtspManager.ts:

import { promises as fsp } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CAMERAS_CONFIG_PATH = path.join(__dirname, '../../cameras.json');

async persistCameras(): Promise<void> {
  try {
    const cameras = Array.from(this.cameras.values()).map(camera => camera.config);
    const tmpPath = CAMERAS_CONFIG_PATH + '.tmp';
    await fsp.writeFile(tmpPath, JSON.stringify(cameras, null, 2), 'utf8');
    await fsp.rename(tmpPath, CAMERAS_CONFIG_PATH);
    logger.info(`Camera config persisted to cameras.json`, 'StreamManager');
  } catch (error) {
    logger.error(`Failed to persist camera config: ${error}`, 'StreamManager');
  }
}
```

### Camera Create Fix (FIX-003)
```typescript
// Source: [VERIFIED: CameraController.ts:75-102 + cameraService.ts:147]
// In CameraController.ts create():

create(req: Request, res: Response): void {
  try {
    const streamManager = serviceRegistry.getStreamManager();
    const { name, rtspUrl, username, password, frameRate, resolution, nightMode } = req.body;

    const cameraId = `cam${Date.now()}`;

    streamManager.addCamera({
      id: cameraId,  // Was: id: ''
      name,
      enabled: true,
      streams: [
        {
          path: rtspUrl,
          roles: ['detect', 'record', 'live'],
          width: parseInt(resolution?.split('x')[0]) || 1920,
          height: parseInt(resolution?.split('x')[1]) || 1080,
          fps: frameRate || 5
        }
      ],
      detect: { width: 640, height: 360, fps: 5 },
      record: { enabled: true },
      nightMode: nightMode || false
    } as CameraConfig);

    // Persist to cameras.json
    streamManager.persistCameras().catch((err) => {
      logger.error(`Failed to persist new camera: ${err}`, 'CameraController');
    });

    // Was: this.created(res, { cameraId });
    // Frontend expects: data.camera.id (cameraService.ts:147)
    this.created(res, { camera: { id: cameraId, name } });
  } catch (error) {
    this.serverError(res, error, 'createCamera');
  }
}
```

### Account Lockout (FIX-004)
```typescript
// Source: [VERIFIED: auth/index.ts:240-298 login method + config/index.ts:321-322 security config]

// In auth/index.ts login(), after fetching user and checking status:

// Add to the SELECT query: u.failed_login_attempts, u.locked_until
const result = await AppDataSource.query(
  `SELECT u.id, u.username, u.email, u.password_hash, u.status,
          u.failed_login_attempts, u.locked_until,
          r.name as role_name, u.created_at, u.updated_at
   FROM users u
   LEFT JOIN roles r ON u.role_id = r.id
   WHERE u.username = $1`,
  [credentials.username]
);

// After status check, before password check:
if (dbUser.locked_until && new Date(dbUser.locked_until) > new Date()) {
  return { success: false, error: 'Account is temporarily locked. Try again later.' };
}

// On bad password:
if (!isPasswordValid) {
  const attempts = (dbUser.failed_login_attempts || 0) + 1;
  const lockUntil = attempts >= config.security.maxLoginAttempts
    ? new Date(Date.now() + config.security.lockoutDuration)
    : null;

  await AppDataSource.query(
    'UPDATE users SET failed_login_attempts = $1, locked_until = $2, updated_at = NOW() WHERE id = $3',
    [attempts, lockUntil, dbUser.id]
  );
  return { success: false, error: 'Invalid username or password' };
}

// On success (after password check passes):
await AppDataSource.query(
  'UPDATE users SET failed_login_attempts = 0, locked_until = NULL, updated_at = NOW() WHERE id = $1',
  [dbUser.id]
);
```

### MFA Setup — Persist Secret (FIX-005)
```typescript
// Source: [VERIFIED: AuthController.ts:212-234]
async setupMfa(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ success: false, error: 'Not authenticated' });
      return;
    }

    const secret = speakeasy.generateSecret({
      name: `SentryVision:${req.user?.username || userId}`,
      length: 20,
    });

    // FIX: Persist secret to database
    await AppDataSource.query(
      'UPDATE users SET mfa_secret = $1, updated_at = NOW() WHERE id = $2',
      [secret.base32, userId]
    );

    const qrCode = await QRCode.toDataURL(secret.otpauth_url || '');

    this.ok(res, {
      secret: secret.base32,
      qrCode,
    });
  } catch (error) {
    this.serverError(res, error, 'setupMfa');
  }
}
```

### MFA Verify — Load Secret from DB (FIX-006)
```typescript
// Source: [VERIFIED: AuthController.ts:236-269 + authService.ts:61-63]
async verifyMfa(req: Request, res: Response): Promise<void> {
  try {
    const { code } = req.body;  // Only extract code, NOT secret
    if (!code) {
      this.badRequest(res, 'MFA code is required');
      return;
    }

    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ success: false, error: 'Not authenticated' });
      return;
    }

    // Load secret from database
    const [user] = await AppDataSource.query(
      'SELECT mfa_secret, mfa_enabled FROM users WHERE id = $1',
      [userId]
    );

    if (!user || !user.mfa_secret) {
      this.badRequest(res, 'MFA not set up. Call setup first.');
      return;
    }

    const verified = speakeasy.totp.verify({
      secret: user.mfa_secret,  // Use DB secret, not req.body
      encoding: 'base32',
      token: code,
      window: 2,
    });

    if (verified) {
      // Enable MFA if this is the enrollment verification
      if (!user.mfa_enabled) {
        await AppDataSource.query(
          'UPDATE users SET mfa_enabled = true, updated_at = NOW() WHERE id = $1',
          [userId]
        );
      }
      // ... audit log ...
      this.ok(res, { message: 'MFA verified successfully' });
    } else {
      this.badRequest(res, 'Invalid MFA code');
    }
  } catch (error) {
    this.serverError(res, error, 'verifyMfa');
  }
}
```

### SQL Injection Fix (FIX-007)
```typescript
// Source: [VERIFIED: batchProcessingDatabasePostgres.ts:478-493, 500-507]

// getProcessingHistory — line 478:
// BEFORE:
const query = `... WHERE status = 'completed' AND created_at >= NOW() - INTERVAL '${days} days' ...`;

// AFTER:
const query = `... WHERE status = 'completed' AND created_at >= NOW() - INTERVAL '1 day' * $1 ...`;
return await this.dataSource.query(query, [days]);

// cleanupOldJobs — line 500:
// BEFORE:
const query = `DELETE FROM batch_jobs WHERE created_at < NOW() - INTERVAL '${daysToKeep} days' ...`;

// AFTER:
const query = `DELETE FROM batch_jobs WHERE created_at < NOW() - INTERVAL '1 day' * $1 AND status IN ('completed', 'failed', 'cancelled')`;
const result = await this.dataSource.query(query, [daysToKeep]);
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| String interpolation in SQL | Parameterized queries ($1, $2) | Industry standard since 2000s | SQL injection eliminated |
| Client-sent MFA secrets | Server-stored TOTP secrets | RFC 6238 / TOTP standard | Security best practice |
| In-memory-only config | Atomic file persistence | Standard for JSON config files | Durability on restart |

**Deprecated/outdated:**
- `fs.unlinkSync` in request handlers: blocks the event loop. Use `fsp.unlink()` (async) instead. [CITED: Node.js docs]

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | PostgreSQL `INTERVAL '1 day' * $1` syntax works with TypeORM's `dataSource.query()` | SQL Injection Fix | Query would fail at runtime — need to verify with `SELECT NOW() - INTERVAL '1 day' * 5` |
| A2 | `cam${Date.now()}` produces unique-enough IDs for cameras (no collision within 1ms) | Camera Create | Duplicate camera ID if two cameras created simultaneously — extremely unlikely for home security |

**If this table is empty:** All claims in this research were verified or cited — no user confirmation needed.

## Open Questions

1. **PostgreSQL INTERVAL parameterization syntax**
   - What we know: `INTERVAL '${days} days'` is SQL injection. Need parameterized equivalent.
   - What's unclear: Whether `INTERVAL '1 day' * $1` works in all PostgreSQL versions, or if `($1::text || ' days')::interval` is safer.
   - Recommendation: Use `INTERVAL '1 day' * $1` — this is the standard PostgreSQL pattern for parameterized INTERVAL multiplication. If it fails, fallback to `($1::text || ' days')::interval`.

2. **Bulk event deletion endpoint**
   - What we know: The audit report mentions "both single and bulk delete must work." The current route only has `POST /:id/archive` for single events.
   - What's unclear: Whether a bulk delete endpoint exists elsewhere or needs to be created.
   - Recommendation: The CONTEXT.md locked decision says "both single and bulk delete must work." The current `POST /:id/archive` handles single. Need to add a bulk delete route (e.g., `POST /bulk/archive` accepting `{ eventIds: string[] }`).

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Backend runtime | ✓ | v22+ | — |
| PostgreSQL | Database | ✓ (per AGENTS.md) | 15+ | — |
| TypeScript | Build | ✓ | strict mode | — |
| speakeasy | MFA (FIX-005/006) | ✓ (installed) | — | — |
| QRCode | MFA QR generation | ✓ (installed) | — | — |
| bcrypt | Password hashing | ✓ (installed) | — | — |

**Missing dependencies with no fallback:** none
**Missing dependencies with fallback:** none

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Jest (ts-jest ESM preset) |
| Config file | `server/jest.config.js` |
| Quick run command | `cd server && npm run test:server -- --testPathPattern="<pattern>"` |
| Full suite command | `cd server && npm run test:server` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| FIX-001 | Event deletion removes from DB + disk + memory | unit | `cd server && npm run test:server -- --testPathPattern="event"` | ❌ Wave 0 |
| FIX-002 | Camera config persists to cameras.json | unit | `cd server && npm run test:server -- --testPathPattern="rtspManager"` | ✅ exists |
| FIX-003 | Camera create generates ID + returns correct shape | unit | `cd server && npm run test:server -- --testPathPattern="CameraController"` | ✅ exists |
| FIX-004 | Account lockout blocks login after 5 failures | unit | `cd server && npm run test:server -- --testPathPattern="AuthController"` | ✅ exists |
| FIX-005 | MFA setup persists secret to DB | unit | `cd server && npm run test:server -- --testPathPattern="AuthController"` | ✅ exists |
| FIX-006 | MFA verify loads secret from DB | unit | `cd server && npm run test:server -- --testPathPattern="AuthController"` | ✅ exists |
| FIX-007 | SQL injection parameterized | unit | `cd server && npm run test:server -- --testPathPattern="batch"` | ✅ exists |

### Sampling Rate
- **Per task commit:** `cd server && npm run test:server -- --testPathPattern="<relevant-file>"`
- **Per wave merge:** `cd server && npm run test:server`
- **Phase gate:** Full server test suite green + `npm run lint && npm run typecheck` (frontend) + `cd server && npx tsc --noEmit` (backend)

### Wave 0 Gaps
- [ ] `server/src/routes/__tests__/event-search.test.ts` — covers FIX-001 (event deletion tests)
- [ ] Existing test files need new test cases added for the fixes (AuthController.test.ts, CameraController.test.ts, etc.)

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Account lockout after N failures (FIX-004) |
| V3 Session Management | no | — |
| V4 Access Control | yes | MFA enrollment + verify (FIX-005/006) |
| V5 Input Validation | yes | SQL parameterization (FIX-007) |
| V6 Cryptography | no | — |

### Known Threat Patterns for Express/TypeORM Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| SQL injection via string interpolation | Tampering | Parameterized queries with `$1` placeholders |
| Brute-force login | Denial of Service | Account lockout after N failed attempts |
| MFA bypass via client-sent secrets | Spoofing | Server-side secret storage + verification |
| Race condition on config file write | Tampering | Atomic temp file + rename |

## Dependency Order

The planner MUST respect these ordering constraints:

```
FIX-007 (SQL injection) — independent, can go first

FIX-002 (camera persistence) — independent, but needed by FIX-003
  └── FIX-003 (camera create) — depends on FIX-002 for persistCameras()

FIX-004 (lockout) — independent
FIX-005 (MFA setup persist) — independent
  └── FIX-006 (MFA verify) — depends on FIX-005 (secret must be in DB)

FIX-001 (event deletion) — independent
```

**Recommended wave structure:**
- Wave 1: FIX-007 + FIX-002 + FIX-004 + FIX-001 (all independent)
- Wave 2: FIX-003 (depends on FIX-002) + FIX-005 (independent but grouped with auth)
- Wave 3: FIX-006 (depends on FIX-005)

Or simplified into fewer waves since all fixes are small.

## Detailed Bug Analysis

### FIX-001: Event Deletion No-Op

**Current code** (`event-search.ts:191-206`):
```typescript
router.post('/:id/archive', requireUser, validate({...}), (req, res) => {
  const eventId = req.params.id;
  const events = inMemoryState.getRecentEvents();
  const eventIndex = events.findIndex(event => event.id === eventId);
  if (eventIndex === -1) return res.status(404).json({...});
  res.json({ success: true, message: 'Event archived successfully' });
  // NEVER: deletes from DB, deletes file, removes from memory
});
```

**Root cause:** Handler finds the event in memory but returns success without performing any destructive action.

**What needs to change:**
1. Query DB for `file_path` before deleting (need the path for file deletion)
2. Delete from DB: `DELETE FROM events WHERE id = $1`
3. Delete image file: `fsp.unlink(imagePath)` (best-effort)
4. Remove from inMemoryState: needs new `removeEvent()` method
5. Add bulk delete endpoint: `POST /bulk/archive` accepting `{ eventIds: string[] }`

**Files touched:**
- `server/src/routes/event-search.ts` — rewrite archive handler + add bulk handler
- `server/src/services/inMemoryStateService.ts` — add `removeEvent()` method

**Risk:** LOW — adding deletion logic to a no-op handler. The only risk is deleting the wrong file if `file_path` is malformed, but the path comes from the DB which was written by the detection pipeline.

### FIX-002: Camera Config Persistence

**Current code:** `rtspManager.ts` has `addCamera()`, `updateCamera()`, `removeCamera()`, zone/filter mutation methods. None call any persistence. `cameras.json` is loaded once at startup by `config/index.ts:287-296` via `fs.readFileSync()`.

**Root cause:** The entire rtspManager was built with in-memory-only mutations. No one added a write-back path.

**What needs to change:**
1. Add `persistCameras()` method to `StreamManager` class
2. Call it after: `addCamera()`, `updateCamera()`, `removeCamera()`, zone CRUD, filter CRUD, track list update, night mode toggle
3. Use atomic write (temp file + rename)

**Files touched:**
- `server/src/streams/rtspManager.ts` — add `persistCameras()`, call from mutation methods
- `server/src/controllers/CameraController.ts` — call `persistCameras()` after zone/filter mutations (or delegate to rtspManager)

**Risk:** HIGH — `cameras.json` contains RTSP URLs with credentials. The config loading pipeline at `config/index.ts:300-306` **decrypts credentials on load**:
```typescript
cameras = cameras.map(camera => ({
  ...camera,
  streams: camera.streams.map(stream => ({
    ...stream,
    path: decryptStreamPath(stream.path)  // DECRYPTED in memory
  }))
}));
```
This means `camera.config.streams[0].path` in the `StreamManager` Map holds the **DECRYPTED** RTSP URL. If `persistCameras()` naively writes `camera.config` to `cameras.json`, it will **write plaintext credentials to disk** — a security regression.

**Solution:** The `persistCameras()` method must either:
1. Re-encrypt paths using `encryptCredential()` before writing, OR
2. Keep a reference to the original (encrypted) config alongside the decrypted in-memory version, OR
3. Accept that the persisted file has plaintext URLs and document it (the current `cameras.json` format supports both plaintext and encrypted)

The `credentialEncryption.ts` service already provides `encryptCredential()` and `isEncryptedCredential()` functions. The safest approach: check if the original config had encrypted paths, and if so, re-encrypt before persisting.

### FIX-003: Camera Create Broken

**Current code** (`CameraController.ts:75-102`):
```typescript
const cameraId = streamManager.addCamera({
  id: '',  // BUG 1: empty string
  name,
  ...
});
this.created(res, { cameraId });  // BUG 2: { cameraId } not { camera: { id } }
// BUG 3: no persistCameras() call
```

**Frontend expectation** (`cameraService.ts:146-150`):
```typescript
const data = await response.json();
if (!data.success || !data.camera?.id) {
  throw new ApiError(data.error || 'Failed to add camera', ...);
}
return data.camera.id;
```

**Three bugs in one function:**
1. `id: ''` → camera stored in Map with key `''`
2. Response is `{ success: true, cameraId }` but frontend checks `data.camera?.id`
3. No persistence call

**Files touched:**
- `server/src/controllers/CameraController.ts` — fix create() method

**Risk:** LOW — straightforward three-line fix.

### FIX-004: Account Lockout Unimplemented

**Current code** (`auth/index.ts:240-298`): The `login()` method:
1. Fetches user by username — does NOT select `failed_login_attempts` or `locked_until`
2. Checks `status !== 'active'` — but never checks `locked_until`
3. Compares password — but never increments `failed_login_attempts` on failure
4. Returns success — but never resets `failed_login_attempts` to 0

**Config values** (`config/index.ts:321-322`):
- `maxLoginAttempts: parseInt(process.env.MAX_LOGIN_ATTEMPTS || '5', 10)`
- `lockoutDuration: parseInt(process.env.LOCKOUT_DURATION || '900000', 10)` (15 min in ms)

**DB columns** (migration 001):
- `failed_login_attempts INTEGER DEFAULT 0`
- `locked_until TIMESTAMP`

**What needs to change:**
1. Add `u.failed_login_attempts, u.locked_until` to the login SELECT query
2. After status check, add lockout check
3. On bad password, increment attempts + conditionally set `locked_until`
4. On success, reset `failed_login_attempts = 0` and `locked_until = NULL`

**Files touched:**
- `server/src/auth/index.ts` — modify login() method

**Risk:** LOW — adding logic to existing flow. The lockout columns already exist in DB.

### FIX-005: MFA Setup Secret Never Persisted

**Current code** (`AuthController.ts:212-234`):
```typescript
const secret = speakeasy.generateSecret({ name: `SentryVision:...`, length: 20 });
const qrCode = await QRCode.toDataURL(secret.otpauth_url || '');
this.ok(res, { secret: secret.base32, qrCode });
// NEVER: writes secret to DB
```

**DB column:** `mfa_secret VARCHAR(32)` — exactly fits a Base32-encoded 20-byte secret (32 chars).

**What needs to change:**
1. After generating secret, persist `secret.base32` to `users.mfa_secret`
2. Don't set `mfa_enabled = true` yet — that happens on verify (two-step enrollment)

**Files touched:**
- `server/src/controllers/AuthController.ts` — add DB update in setupMfa()

**Risk:** LOW — one `AppDataSource.query()` call added.

### FIX-006: MFA Verify Protocol Mismatch

**Current code** (`AuthController.ts:236-241`):
```typescript
const { code, secret } = req.body;
if (!code || !secret) {
  this.badRequest(res, 'Code and secret are required');  // Always fails — frontend only sends { code }
  return;
}
```

**Frontend** (`authService.ts:63`):
```typescript
const response = await apiClient.post('/auth/mfa/verify', { code });  // Only sends code
```

**What needs to change:**
1. Only extract `code` from `req.body`
2. Load `mfa_secret` from DB using `req.user.userId`
3. Verify TOTP code against DB secret
4. If this is the enrollment verification (mfa_enabled was false), set `mfa_enabled = true`

**Dependency:** FIX-005 must be done first (secret must be in DB for verify to load it).

**Files touched:**
- `server/src/controllers/AuthController.ts` — rewrite verifyMfa()

**Risk:** LOW — straightforward fix. The tricky part is the two-step enrollment flow: setup persists secret → verify enables MFA.

### FIX-007: SQL Injection in Batch Processing

**Current code** (`batchProcessingDatabasePostgres.ts`):

Line 488:
```typescript
AND created_at >= NOW() - INTERVAL '${days} days'
```

Line 502:
```typescript
WHERE created_at < NOW() - INTERVAL '${daysToKeep} days'
```

**Root cause:** The `days`/`daysToKeep` parameters are function arguments typed as `number` with defaults (7 and 30), but TypeScript types don't protect against SQL injection at runtime. If these functions are ever called with untrusted input, injection is possible.

**What needs to change:**
1. Replace string interpolation with parameterized queries
2. Use PostgreSQL's `INTERVAL '1 day' * $1` pattern (multiply interval by parameter)

**Files touched:**
- `server/src/services/batchProcessingDatabasePostgres.ts` — parameterize two queries

**Risk:** LOW — changing from string interpolation to parameters. The function signatures don't change.

## Sources

### Primary (HIGH confidence)
- `server/src/routes/event-search.ts` — event deletion handler (lines 191-206) [VERIFIED by code read]
- `server/src/streams/rtspManager.ts` — full file, no persistCameras() method [VERIFIED by code read]
- `server/src/controllers/CameraController.ts` — create handler with id: '' (line 81) [VERIFIED by code read]
- `server/src/auth/index.ts` — login() method (lines 240-298), no lockout logic [VERIFIED by code read]
- `server/src/controllers/AuthController.ts` — setupMfa (lines 212-234) and verifyMfa (lines 236-269) [VERIFIED by code read]
- `server/src/services/batchProcessingDatabasePostgres.ts` — lines 488, 502 SQL interpolation [VERIFIED by code read]
- `server/src/models/User.ts` — full entity with lockout + MFA columns [VERIFIED by code read]
- `server/src/services/inMemoryStateService.ts` — no removeEvent() method [VERIFIED by code read]
- `server/src/config/index.ts` — cameras.json loading (lines 287-296), security config (lines 319-324) [VERIFIED by code read]
- `database/migrations/001_create_user_management.sql` — failed_login_attempts, locked_until, mfa_secret columns [VERIFIED by code read]
- `database/migrations/003_create_events_table.sql` — events table schema with file_path [VERIFIED by code read]
- `frontend/src/services/api/cameraService.ts` — frontend expects data.camera.id (line 147) [VERIFIED by code read]
- `frontend/src/services/api/authService.ts` — frontend sends { code } only (line 63) [VERIFIED by code read]
- `docs/AUDIT-REPORT.md` — comprehensive audit with root causes and fix instructions [VERIFIED by code read]

### Secondary (MEDIUM confidence)
- `server/src/controllers/BaseController.ts` — response helper patterns [VERIFIED by code read]

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new packages, all fixes use existing codebase patterns
- Architecture: HIGH — all bugs are confirmed by direct source code inspection
- Pitfalls: HIGH — identified from reading actual code, not theoretical

**Research date:** 2026-05-31
**Valid until:** 2026-06-30 (stable — all findings are about existing code, not fast-moving dependencies)
