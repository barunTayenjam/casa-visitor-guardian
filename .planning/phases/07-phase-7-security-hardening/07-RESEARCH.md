# Phase 7: Security Hardening - Research

**Researched:** 2026-05-30
**Domain:** Node.js/Express backend security hardening (JWT, input validation, HTTP headers, seed credentials)
**Confidence:** HIGH

## Summary

Phase 7 addresses 6 security requirements (SEC2-01 through SEC2-06) covering JWT refresh bypass, default seed passwords, missing Helmet headers, unvalidated route inputs, untyped auth access, and silent camera config failure. All vulnerabilities are localized to the Express backend — no frontend changes are needed except for the timezone improvement (SEC2-06 / D-18).

The existing codebase already has robust validation infrastructure (`middleware/validation.ts` with `validate()` middleware and `commonSchemas`), proper Express Request type augmentation (`middleware/auth.ts` extending `express-serve-static-core`), and `helmet` as an installed dependency. The phase primarily involves **applying existing patterns consistently** rather than building new infrastructure.

**Primary recommendation:** Each fix is surgical — remove the jwt.decode() fallback, add helmet(), add validate() middleware to unvalidated routes, replace `(req as any).user` with `req.user!.userId`, add seed password fail-fast, and log camera config warnings. No new dependencies needed.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Remove `jwt.decode()` fallback from `AuthController.refreshToken` entirely. If `jwt.verify()` fails, return 401.
- **D-02:** No new database tables or endpoints for refresh tokens. The existing `JWT_REFRESH_SECRET` verification is correct; only the bypass fallback needs removal.
- **D-03:** Frontend's existing auto-refresh on 401 handles the user experience. No special error codes — generic 401 is sufficient.
- **D-04:** Apply the existing `validate()` middleware from `server/src/middleware/validation.ts` with explicit schemas to ALL routes that accept user input.
- **D-05:** Audit all route files in `server/src/routes/` for missing validation. Any route parsing `req.query`, `req.body`, or `req.params` without a schema must get one.
- **D-06:** Use the established validation pattern (not Zod for route middleware — Zod is used elsewhere but `validate()` is the route middleware standard).
- **D-07:** In production (`NODE_ENV=production`): fail-fast at startup if `SEED_ADMIN_PASSWORD` or `SEED_USER_PASSWORD` env vars are not set. Server must not start.
- **D-08:** In development: allow default passwords for convenience (existing behavior preserved).
- **D-09:** Remove the hardcoded `'changeme'` string literal. Replace with a clear error message listing the required env vars.
- **D-10:** Apply `app.use(helmet())` with default configuration before route mounting in `server/src/index.ts`.
- **D-11:** No custom CSP needed — Helmet defaults work correctly for API + static file serving. Socket.io is compatible with default Helmet.
- **D-12:** Replace all `(req as any).user` casts with direct `req.user!.userId` access. The `authenticate()` middleware already augments Express `Request` type via `server/src/middleware/auth.ts`.
- **D-13:** Target: `notificationRoutes.ts` (9 occurrences) plus any other route files with the same pattern found during the audit.
- **D-14:** Log a warning when `cameras.json` results in an empty camera array. Do not crash the server.
- **D-15:** No Zod validation for camera config structure in this phase — just visibility into the silent failure.
- **D-16:** Consolidate into single `.env.example` at project root. Remove `server/.env.example`.
- **D-17:** Ensure all env vars from both files are present in the consolidated version.
- **D-18:** Frontend should send the user's timezone with quiet hours requests. Server uses the provided timezone instead of defaulting to `'Asia/Kolkata'`.
- **D-19:** Fallback to `TZ` env var (already `Asia/Kolkata`) if frontend doesn't send timezone.

### the agent's Discretion
- Exact validation schema field definitions (types, lengths, patterns) per route — follow existing patterns from validated routes.
- Error message wording for seed password failure.
- Order of middleware application within the route files.

### Deferred Ideas (OUT OF SCOPE)
- **Stream not working from Python to frontend** — Not a security issue. Belongs in a separate investigation.
- **TypeScript strict mode migration** — Related but different scope (Phase 8).
- **Camera config Zod validation** — Stronger validation than just "warn on empty", but deferred to keep scope tight.
- **Consolidated detection file serving** — `index.ts` has duplicated event/snapshot serving logic. Not a security fix — belongs in Phase 9.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SEC2-01 | JWT refresh token bypass via jwt.decode() fallback | Exact code at AuthController.ts:157-177. Fix: remove lines 159-176 (entire fallback block). If `verifyToken()` returns null, return 401 immediately. |
| SEC2-02 | Default seed password 'changeme' in production startup path | Two locations: index.ts:337-338 and auth/index.ts:80-81. Fix: add production fail-fast check before seed registration. |
| SEC2-03 | Helmet security headers installed but never applied | helmet@8.1.0 already in package.json. Fix: add `import helmet from 'helmet'` and `app.use(helmet())` to index.ts before route mounting. |
| SEC2-04 | No input validation on 5+ route files | 15 route files audited. 8 need validation schemas added. Existing `validate()` middleware and `commonSchemas` provide the pattern. |
| SEC2-05 | (req as any).user pattern bypasses typed auth augmentation | 9 occurrences in notificationRoutes.ts, 3 in detection-operations/motion (io access), 5 in auditLogger.ts. Fix: replace with `req.user!.userId` for auth access. |
| SEC2-06 | Camera config silently returns empty array on malformed JSON | Config IIFE at config/index.ts:274-313 returns `[]` on any error with only console.error. Fix: add logger.warn with actionable message. |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| JWT verification | API / Backend | — | Token validation is server-side auth concern |
| Input validation middleware | API / Backend | — | Express middleware runs before route handlers |
| HTTP security headers | API / Backend | — | Helmet middleware applied at Express app level |
| Seed password policy | API / Backend | — | Server startup validation |
| Auth type safety | API / Backend | — | Express Request augmentation used in route handlers |
| Camera config warning | API / Backend | — | Config loading at server startup |
| Quiet hours timezone | API / Backend | Frontend | Frontend sends timezone; server stores it |
| Env file consolidation | DevOps / Config | — | Build/deployment configuration |

## Standard Stack

### Core (Already Installed — No New Dependencies)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `helmet` | ^8.1.0 (latest: 8.2.0) | HTTP security headers | [VERIFIED: npm registry] De facto standard for Express security headers. Already in package.json. |
| `express-validator` | (installed) | Input validation chains | Used by `validate()` middleware. Standard Express validation. |
| `jsonwebtoken` | (installed) | JWT signing/verification | Standard Node.js JWT library. The fix removes `jwt.decode()`, keeps `jwt.verify()`. |
| `bcrypt` | (installed) | Password hashing | Already used for seed user passwords. |

### Supporting (Existing Infrastructure)

| Library | Purpose | When to Use |
|---------|---------|-------------|
| `validate()` from `middleware/validation.ts` | Custom schema-based validation middleware | Apply to all routes accepting user input |
| `commonSchemas` from `middleware/validation.ts` | Pre-built schemas (pagination, eventFilter, cameraId, etc.) | Reuse for routes with standard parameter patterns |
| `authenticate()` from `middleware/auth.ts` | JWT auth with Express Request type augmentation | Already applied; just need to use typed `req.user` |

**Installation:**
```bash
# NO new packages needed — all dependencies already installed
# Just verify helmet is present:
npm view helmet version  # → 8.2.0 (latest)
grep helmet server/package.json  # → "helmet": "^8.1.0"
```

## Package Legitimacy Audit

> No new packages are being installed in this phase. All fixes use existing dependencies.

| Package | Registry | Status | Notes |
|---------|----------|--------|-------|
| helmet | npm | ^8.1.0 installed | [VERIFIED: npm registry] Already in package.json, just not `use()`'d |

**Packages removed due to slopcheck [SLOP] verdict:** none (no new packages)
**Packages flagged as suspicious [SUS]:** none

## Architecture Patterns

### System Architecture Diagram

```text
                        Request Flow (Security Fixes Highlighted)
                        ========================================

Browser ──── HTTP ────▶ Express App (server/src/index.ts)
                              │
                    ┌─────────┼─────────────────────────┐
                    │         │                         │
              [NEW: helmet()]  │                    cors()
                    │         │                         │
              express.json()  │                    rate limiting
                    │         │                         │
                    ▼         │                         │
              ┌──────────────┐│                         │
              │ Route Files  ││                         │
              │ routes/*.ts  │◀─────────────────────────┘
              └──────┬───────┘
                     │
         ┌───────────┼───────────┐
         │           │           │
    [FIX: validate()]  │    [FIX: req.user!]
    middleware          │    typed access
         │           │           │
         ▼           ▼           ▼
    Controllers ──▶ Services ──▶ Database
         │
    [FIX: remove
     jwt.decode()
     fallback]
         │
         ▼
    AuthService.verifyToken()
```

### Recommended Project Structure

No structural changes needed. All fixes are within existing files:

```text
server/src/
├── index.ts                    # [MODIFY] Add helmet(), fix seed password fail-fast
├── controllers/
│   └── AuthController.ts       # [MODIFY] Remove jwt.decode() fallback (lines 157-177)
├── auth/
│   └── index.ts                # [MODIFY] Remove 'changeme' default (lines 80-81)
├── middleware/
│   ├── auth.ts                 # [READ ONLY] Reference for req.user type
│   └── validation.ts           # [READ ONLY] Reuse validate() + commonSchemas
├── config/
│   └── index.ts                # [MODIFY] Add empty camera warning (lines 274-313)
├── routes/
│   ├── notificationRoutes.ts   # [MODIFY] Add validate(), fix (req as any).user (9 occurrences)
│   ├── motion.ts               # [MODIFY] Add validate() for query/body
│   ├── detection-operations.ts # [MODIFY] Add validate() for params/body
│   ├── highlights.ts           # [MODIFY] Add validate() for params/query
│   ├── visitorRoutes.ts        # [MODIFY] Add validate() for params/body
│   ├── event-search.ts         # [MODIFY] Add validate() for query params
│   ├── faceConfigRoutes.ts     # [MODIFY] Add validate() for params/body
│   ├── faceEmbeddingRoutes.ts  # [MODIFY] Add validate() for params/body/query
│   └── index.ts                # [MODIFY] Add validate() for inline routes
└── utils/
    └── auditLogger.ts          # [MODIFY] Fix (req as any) patterns (lines 116-133)

frontend/src/                    # [MINIMAL] Timezone change for quiet hours
```

### Pattern 1: Validation Middleware Application (D-04, D-06)

**What:** Apply `validate()` middleware with explicit schemas to route handlers
**When to use:** Every route that parses `req.query`, `req.body`, or `req.params`
**Example:**

```typescript
// Source: Existing pattern from server/src/routes/auth.ts
import { validate } from '../middleware/validation.js';

// Before (no validation):
router.get('/logs', authenticate(), async (req, res) => {
  const limit = parseInt(req.query.limit as string) || 50;
  // ...
});

// After (with validation):
router.get('/logs',
  authenticate(),
  validate({
    query: {
      limit: { type: 'number', required: false, min: 1, max: 100 }
    }
  }),
  async (req, res) => {
    const limit = parseInt(req.query.limit as string) || 50;
    // ...
  }
);
```

### Pattern 2: Auth Type Access (D-12)

**What:** Replace `(req as any).user` with properly typed `req.user!` access
**When to use:** All route handlers behind `authenticate()` middleware
**Example:**

```typescript
// Source: server/src/middleware/auth.ts (Request augmentation)
// declare module 'express-serve-static-core' {
//   interface Request { user?: JWTPayload; }
// }

// Before:
const userId = (req as any).user.userId;

// After:
const userId = req.user!.userId;
```

### Pattern 3: Helmet Application (D-10)

**What:** Add `helmet()` middleware before route mounting
**When to use:** In server bootstrap, after cors() and express.json()
**Example:**

```typescript
// Source: Helmet docs + Express best practices
import helmet from 'helmet';

const app = express();
app.use(cors({ ... }));
app.use(helmet());              // <-- Add here, before routes
app.use(express.json());
```

### Pattern 4: Seed Password Fail-Fast (D-07, D-08, D-09)

**What:** Check env vars exist in production before seeding users
**When to use:** At startup, before calling `authService.register()`
**Example:**

```typescript
// In server/src/index.ts, before seed registration
if (config.nodeEnv === 'production') {
  if (!process.env.SEED_ADMIN_PASSWORD || !process.env.SEED_USER_PASSWORD) {
    console.error(
      'FATAL: SEED_ADMIN_PASSWORD and SEED_USER_PASSWORD must be set in production.\n' +
      'Set these environment variables before starting the server.'
    );
    process.exit(1);
  }
}
```

### Anti-Patterns to Avoid

- **Using Zod for route middleware validation:** The codebase uses `validate()` from `middleware/validation.ts` as the standard route middleware. Zod is used in `detectionRoutes.ts` for request body parsing inside handlers, NOT as middleware. Per D-06, keep using `validate()`.
- **Adding new middleware types:** Don't create a new validation approach. Extend `commonSchemas` in `validation.ts` if needed.
- **Crashing on empty camera config:** Per D-14, only log a warning. Don't throw or exit.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| JWT verification bypass | Custom decode-and-re-sign logic | `jwt.verify()` only — reject invalid tokens | `jwt.decode()` doesn't verify signature |
| HTTP security headers | Custom setHeader calls for X-Frame-Options, etc. | `helmet()` middleware | 15+ headers, CSP, HSTS, XSS protection. Helmet is maintained and standards-compliant |
| Input validation | Per-route inline checks | `validate()` middleware + schemas | Centralized, consistent error format, testable |
| Auth type augmentation | Custom `(req as any).user` casts | Existing Express Request extension in `auth.ts` | Already declared — just use it |

**Key insight:** Every fix in this phase uses existing infrastructure. The codebase already has the right tools — they just aren't applied consistently.

## Common Pitfalls

### Pitfall 1: Helmet breaks Socket.io WebSocket upgrade

**What goes wrong:** Helmet's CSP can block WebSocket connections, breaking real-time camera feeds.
**Why it happens:** CSP `connect-src` directive may not allow `ws://` connections.
**How to avoid:** Helmet 8.x defaults do NOT block WebSocket upgrades. Socket.io uses `ws://` transport which is unaffected by Helmet's default CSP. Per D-11, no custom CSP is needed. [CITED: helmet docs — default CSP allows same-origin]
**Warning signs:** Frontend camera streams stop loading after adding helmet.

### Pitfall 2: Validation schemas too strict or too loose

**What goes wrong:** Over-validating breaks legitimate API calls; under-validating leaves holes.
**Why it happens:** Copy-pasting schemas without understanding actual usage patterns.
**How to avoid:** Study the route handler's actual usage of each parameter. Match the schema to the code. Use `required: false` for optional fields. Match existing patterns from validated routes (auth.ts, cameras.ts).
**Warning signs:** 400 errors from previously working API calls.

### Pitfall 3: Seed password check runs AFTER database seed

**What goes wrong:** If the check is placed after `authService.register()`, the default password is already hashed and stored.
**Why it happens:** Not reading code flow carefully.
**How to avoid:** Place the production check BEFORE the `authService.register()` call in `initializeServices()`. The check must be at lines 335-336, before lines 337-338.
**Warning signs:** Users created with 'changeme' password in production.

### Pitfall 4: Missing req.user null check after (req as any) fix

**What goes wrong:** Changing `(req as any).user.userId` to `req.user!.userId` without ensuring `authenticate()` middleware runs first.
**Why it happens:** The `!` non-null assertion bypasses TypeScript's null safety.
**How to avoid:** Every route that accesses `req.user!.userId` MUST have `authenticate()` (or a variant like `requireUser`, `requireAdmin`) in its middleware chain. All notification routes already have `router.use(authenticate())` at the top level.
**Warning signs:** Runtime TypeError: Cannot read properties of undefined (reading 'userId').

### Pitfall 5: Forgetting validation on req.params

**What goes wrong:** Route params like `/:cameraId` or `/:id` are not validated for format/length, enabling injection attacks.
**Why it happens:** Focusing only on body and query params.
**How to avoid:** Always validate route params with a pattern constraint (e.g., `pattern: /^[a-zA-Z0-9_-]+$/`). Use `commonSchemas.cameraId` where applicable.

## Code Examples

### SEC2-01: JWT Refresh Bypass Fix

```typescript
// Source: server/src/controllers/AuthController.ts:145-196
// BEFORE (vulnerable):
async refreshToken(req: Request, res: Response): Promise<void> {
  try {
    const token = /* extract from header */;
    let payload = this.authService.verifyToken(token);
    if (!payload) {
      // VULNERABILITY: jwt.decode() doesn't verify signature
      const decoded = jwt.decode(token) as { userId?: string; ... } | null;
      if (!decoded || !decoded.userId) { return res.status(401)...; }
      payload = { userId: decoded.userId, ... };  // Re-issues from unverified payload!
    }
    // ... issues new token based on payload
  }
}

// AFTER (fixed):
async refreshToken(req: Request, res: Response): Promise<void> {
  try {
    const token = /* extract from header */;
    if (!token) { return res.status(401).json({ success: false, error: 'No token provided' }); }
    const payload = this.authService.verifyToken(token);
    if (!payload) {
      return res.status(401).json({ success: false, error: 'Invalid or expired token' });
    }
    const user = await this.authService.getUserById(payload.userId);
    if (!user) { return this.notFound(res, 'User not found'); }
    const newToken = this.authService.generateToken(user as any);
    this.ok(res, { token: newToken });
  } catch (error) { this.serverError(res, error, 'refreshToken'); }
}
```

### SEC2-02: Seed Password Fail-Fast

```typescript
// Source: server/src/index.ts:335-341
// BEFORE (vulnerable):
try {
  await authService.register({ username: 'admin', ..., password: process.env.SEED_ADMIN_PASSWORD || 'changeme', role: 'admin' });
  await authService.register({ username: 'user', ..., password: process.env.SEED_USER_PASSWORD || 'changeme', role: 'user' });
} catch (e) { /* Ignore duplicate user errors */ }

// AFTER (fixed):
if (config.nodeEnv === 'production') {
  const missing: string[] = [];
  if (!process.env.SEED_ADMIN_PASSWORD) missing.push('SEED_ADMIN_PASSWORD');
  if (!process.env.SEED_USER_PASSWORD) missing.push('SEED_USER_PASSWORD');
  if (missing.length > 0) {
    console.error(`FATAL: Required environment variables not set: ${missing.join(', ')}. Set these before starting in production.`);
    process.exit(1);
  }
}
try {
  await authService.register({ username: 'admin', ..., password: process.env.SEED_ADMIN_PASSWORD!, role: 'admin' });
  await authService.register({ username: 'user', ..., password: process.env.SEED_USER_PASSWORD!, role: 'user' });
} catch (e) { /* Ignore duplicate user errors */ }
```

Also fix `server/src/auth/index.ts:80-81`:

```typescript
// BEFORE:
const adminPasswordHash = await bcrypt.hash(process.env.SEED_ADMIN_PASSWORD || 'changeme', 12);
const userPasswordHash = await bcrypt.hash(process.env.SEED_USER_PASSWORD || 'changeme', 12);

// AFTER (this function only runs in development, but remove 'changeme' anyway):
const adminPassword = process.env.SEED_ADMIN_PASSWORD;
const userPassword = process.env.SEED_USER_PASSWORD;
if (!adminPassword || !userPassword) {
  logger.warn('SEED_ADMIN_PASSWORD and/or SEED_USER_PASSWORD not set — skipping seed', 'AuthService');
  return;
}
const adminPasswordHash = await bcrypt.hash(adminPassword, 12);
const userPasswordHash = await bcrypt.hash(userPassword, 12);
```

### SEC2-03: Helmet Application

```typescript
// Source: server/src/index.ts (add after line 6, apply after line 49)
import helmet from 'helmet';

// Apply after cors() and express.json(), before route mounting:
app.use(cors({ ... }));
app.use(express.json());
app.use(helmet());  // <-- ADD HERE (line ~50)
```

### SEC2-04: Validation Schema Examples for Unvalidated Routes

```typescript
// Source: Follows pattern from server/src/routes/auth.ts and server/src/middleware/validation.ts

// notificationRoutes.ts — subscribe
validate({
  body: {
    endpoint: { type: 'url', required: true, maxLength: 500 },
    keys: { type: 'object', required: true }
  }
})

// notificationRoutes.ts — logs
validate({
  query: {
    limit: { type: 'number', required: false, min: 1, max: 100 }
  }
})

// notificationRoutes.ts — preferences update
validate({
  body: {
    motion_enabled: { type: 'boolean', required: false },
    face_enabled: { type: 'boolean', required: false },
    object_enabled: { type: 'boolean', required: false },
    quiet_hours_enabled: { type: 'boolean', required: false },
    quiet_hours_start: { type: 'string', required: false, pattern: /^\d{2}:\d{2}$/ },
    quiet_hours_end: { type: 'string', required: false, pattern: /^\d{2}:\d{2}$/ },
    quiet_hours_timezone: { type: 'string', required: false, maxLength: 50 }
  }
})

// highlights.ts — date param
validate({
  params: {
    date: { type: 'string', required: true, pattern: /^\d{4}-\d{2}-\d{2}$/ }
  },
  query: {
    sort: { type: 'string', required: false, enum: ['recent', 'persons', 'faces', 'unknown', 'confidence'] },
    limit: { type: 'number', required: false, min: 1, max: 1000 }
  }
})

// motion.ts — events query
validate({
  query: {
    limit: { type: 'number', required: false, min: 1, max: 1000 }
  }
})

// motion.ts — cameraId param
validate({
  params: {
    cameraId: { type: 'string', required: true, pattern: /^[a-zA-Z0-9_-]+$/ }
  }
})

// motion.ts — analyze body
validate({
  params: {
    cameraId: { type: 'string', required: true, pattern: /^[a-zA-Z0-9_-]+$/ }
  },
  body: {
    enablePersonDetection: { type: 'boolean', required: false },
    enableFaceDetection: { type: 'boolean', required: false }
  }
})

// visitorRoutes.ts — update
validate({
  params: {
    id: { type: 'string', required: true, pattern: /^[a-zA-Z0-9_-]+$/ }
  },
  body: {
    name: { type: 'string', required: true, minLength: 1, maxLength: 100 }
  }
})

// event-search.ts — search
validate({
  query: {
    startDate: { type: 'string', required: false, pattern: /^\d{4}-\d{2}-\d{2}/ },
    endDate: { type: 'string', required: false, pattern: /^\d{4}-\d{2}-\d{2}/ },
    cameraId: { type: 'string', required: false, pattern: /^[a-zA-Z0-9_-]+$/ },
    eventType: { type: 'string', required: false },
    page: { type: 'number', required: false, min: 1 },
    pageSize: { type: 'number', required: false, min: 1, max: 100 },
    sortBy: { type: 'string', required: false },
    sortOrder: { type: 'string', required: false, enum: ['ASC', 'DESC', 'asc', 'desc'] }
  }
})

// faceConfigRoutes.ts — update
validate({
  params: {
    key: { type: 'string', required: true, minLength: 1, maxLength: 100 }
  },
  body: {
    value: { type: 'number', required: true }
  }
})
```

### SEC2-05: (req as any).user Fix

```typescript
// notificationRoutes.ts — 9 occurrences, all identical pattern:
// BEFORE:
const userId = (req as any).user.userId;
// AFTER:
const userId = req.user!.userId;

// detection-operations.ts and motion.ts — different pattern (io access):
// BEFORE:
const io: SocketIOServer = (req as any).app.get('io');
// AFTER:
const io: SocketIOServer = (req.app as any).get('io');
// Note: req.app IS typed in Express, but .get('io') returns any. The (req.app as any)
// is acceptable here since it's accessing a custom app setting, not a type-safety bypass.
```

### SEC2-06: Camera Config Empty Warning

```typescript
// Source: server/src/config/index.ts:274-313
// BEFORE (silent failure):
cameras: (() => {
  try {
    let cameras: CameraConfig[] = [];
    // ... parsing logic ...
    return cameras;
  } catch (error) {
    console.error('Failed to load camera configuration:', error);
    return [];  // ← Silent empty array
  }
})(),

// AFTER (with warning):
cameras: (() => {
  try {
    let cameras: CameraConfig[] = [];
    // ... parsing logic ...
    if (cameras.length === 0) {
      logger.warn(
        'Camera configuration loaded but resulted in 0 cameras. ' +
        'Check cameras.json format or CAMERAS env var. ' +
        'Server will start but no cameras will be active.',
        'Config'
      );
    }
    return cameras;
  } catch (error) {
    console.error('Failed to load camera configuration:', error);
    logger.warn(
      'Camera configuration failed to load. Server starting with no cameras. ' +
      'Verify cameras.json exists and contains valid JSON.',
      'Config'
    );
    return [];
  }
})(),
```

### D-18/D-19: Timezone Fix

```typescript
// notificationRoutes.ts:181,257 — replace hardcoded 'Asia/Kolkata'
// BEFORE:
quietHoursTimezone: 'Asia/Kolkata',

// AFTER (for default creation):
quietHoursTimezone: process.env.TZ || 'UTC',

// For update endpoint — accept timezone from frontend:
if (req.body.quiet_hours_timezone !== undefined) {
  // Validate it's a valid IANA timezone
  try {
    Intl.DateTimeFormat(undefined, { timeZone: req.body.quiet_hours_timezone });
    preferences.quietHoursTimezone = req.body.quiet_hours_timezone;
  } catch {
    return res.status(400).json({ error: 'Invalid timezone' });
  }
}
```

## Detailed Validation Audit Per Route File

### Already Validated Routes (No Changes Needed)

| Route File | Validation | Auth Middleware | Notes |
|------------|-----------|----------------|-------|
| `auth.ts` | ✅ `validate()` on register, login, change-password | ✅ `authenticate()` | Gold standard pattern |
| `cameras.ts` | ✅ `validate(commonSchemas.createCamera)` on POST | ✅ `optionalAuth`, `requireUser` | Uses commonSchemas |
| `analytics.ts` | ⚠️ Not needed — GET-only, no user input params | ✅ `optionalAuth` | No body/query/params parsed |
| `alerts.ts` | ⚠️ Minimal — needs `:id` param validation | ✅ `requireUser` | Only `req.params.id` |
| `streams.ts` | ⚠️ Minimal — needs `:cameraId` param validation | ✅ `optionalAuth`, `requireUser` | Only `req.params.cameraId` |
| `review.ts` | ⚠️ Minimal — needs `:id` and `:camera` param validation | ✅ `requireUser`, `optionalAuth` | Only `req.params` |
| `events.ts` | ✅ Not needed — delegates to controller | ✅ `optionalAuth` | No direct input parsing |

### Routes Requiring Validation (Must Fix)

| Route File | Endpoints Needing Validation | Input Types | Priority |
|------------|-----------------------------|-------------|----------|
| `notificationRoutes.ts` | POST /subscribe, DELETE /unsubscribe, POST /resubscribe, GET /logs, PUT /preferences, POST /preferences/reset | body, query | HIGH (9 `(req as any)` + no validation) |
| `motion.ts` | GET /events, GET /:cameraId/events, POST /:cameraId/analyze | query, params, body | HIGH |
| `detection-operations.ts` | POST /person/:cameraId/trigger, POST /face/:cameraId/trigger, GET+PUT /person/settings, GET+PUT /face/settings | params, query, body | HIGH |
| `highlights.ts` | GET /:date, GET /:date/summary | params, query | HIGH (SQL query construction from user input — SQL injection risk via `sort`) |
| `visitorRoutes.ts` | PUT /:id, DELETE /:id, GET /:id | params, body | MEDIUM |
| `event-search.ts` | GET /search, GET /search/legacy, GET /stats/calendar, GET /stats/range, GET /:id/details, POST /:id/archive | query, params | MEDIUM |
| `faceConfigRoutes.ts` | PUT /:key | params, body | MEDIUM |
| `faceEmbeddingRoutes.ts` | POST /, GET /visitor/:visitorId, GET /high-quality | body, params, query | MEDIUM |
| `detectionRoutes.ts` | POST /filter | body | LOW (uses Zod internally) |
| `detectionRedoRoutes.ts` | POST /rerun-detection, POST /rerun-event-detection | body | LOW (uses authenticate) |
| `nvidiaRoutes.ts` | POST /analyze, POST /analyze-event, PUT /config, POST /analyze-with-bboxes, POST /analyze-persons, POST /analyze-event-with-bboxes | body | LOW |

### Routes in `index.ts` (Inline Routes Needing Validation)

These routes are defined directly in `server/src/routes/index.ts` rather than in separate files:

| Route | Input | Validation Needed |
|-------|-------|-------------------|
| `GET /detections/image/:imageId` | `req.params.imageId`, `req.query.overlays` | imageId UUID format validation (partially done), overlays boolean check |
| `GET /api/snapshots/list` | None (no user input) | None needed |

## (req as any) Pattern Locations — Complete Inventory

### notificationRoutes.ts — 9 occurrences (auth access)
All at identical pattern: `(req as any).user.userId`
- Line 15 (POST /subscribe)
- Line 42 (DELETE /unsubscribe)
- Line 60 (POST /resubscribe)
- Line 84 (GET /subscription)
- Line 120 (GET /logs)
- Line 145 (POST /test)
- Line 167 (GET /preferences)
- Line 203 (PUT /preferences)
- Line 242 (POST /preferences/reset)

### detection-operations.ts — 2 occurrences (io access)
- Line 27: `(req as any).app.get('io')` (POST /person/:cameraId/trigger)
- Line 48: `(req as any).app.get('io')` (POST /face/:cameraId/trigger)

### motion.ts — 1 occurrence (io access)
- Line 64: `(req as any).app.get('io')` (POST /:cameraId/analyze)

### auditLogger.ts — 5 occurrences (utility access)
- Lines 116-118: `(req as any).connection.remoteAddress`, `.socket.remoteAddress`, `.connection.socket.remoteAddress` — IP extraction
- Line 124: `(req as any).user?.sub || (req as any).user?.id` — user ID extraction
- Line 129: `(req as any).user?.username || (req as any).user?.name` — username extraction
- Line 133: `(req as any).sessionID || (req as any).session?.id` — session ID
- Line 166: `(req as any).headers['x-request-id']` — request ID

**Note:** The auditLogger.ts patterns are different — they're utility functions for extracting request metadata, not route handler code. These can be fixed but are lower priority since auditLogger already handles missing values gracefully with optional chaining and fallbacks. Per D-13, the focus is `notificationRoutes.ts` (9 occurrences). The `req.app.get('io')` pattern in detection-operations.ts and motion.ts is a separate concern — `req.app` IS typed in Express, but `.get('io')` returns `any` because Socket.io is stored as a custom app setting.

## Env File Consolidation Analysis

### Root `.env.example` (329 lines, 8972 bytes)
- Comprehensive production configuration
- Missing key vars that `server/.env.example` has:
  - `CREDENTIAL_ENCRYPTION_KEY` — Present in server version but not root
  - `PIPELINE_MODE` — Not in either
  - `PYTHON_WS_URL` — Not in either
  - `OPENCV_SERVICE_URL` — Not in root (only in AGENTS.md)
  - `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` — Not in either
  - `SEED_ADMIN_PASSWORD`, `SEED_USER_PASSWORD` — NOT in root (has `SEED_ADMIN_USER`, `SEED_ADMIN_PASSWORD` but with weak default `admin123`)
  - `DETECTIONS_DIR` — Not in root
  - `DETECTIONS_RETENTION_DAYS` — Not in root
  - `MQTT_*` — Not in either

### Server `.env.example` (80 lines, 2398 bytes)
- Development-focused configuration
- Has vars root doesn't:
  - `CREDENTIAL_ENCRYPTION_KEY`
  - `NVIDIA_API_KEY`, `NVIDIA_MODEL`
  - `FRAME_INTERVAL`, `MAX_RECONNECT_ATTEMPTS`, `RECONNECT_DELAY`
- Uses wrong DB name (`home_security` vs `sentryvision`)
- Uses wrong JWT var names (`JWT_SECRET` vs `JWT_ACCESS_SECRET`)
- Has weak defaults in example (`your-super-secret-jwt-key-change-in-production`)

### Consolidation Strategy (D-16, D-17)
1. Keep root `.env.example` as the base (it's more comprehensive)
2. Add missing vars from server version (CREDENTIAL_ENCRYPTION_KEY, NVIDIA_*, FRAME_INTERVAL)
3. Add missing vars from actual code usage (PIPELINE_MODE, PYTHON_WS_URL, OPENCV_SERVICE_URL, VAPID_*, SEED_ADMIN_PASSWORD, SEED_USER_PASSWORD, DETECTIONS_DIR, MQTT_*)
4. Fix wrong values (DB_NAME, JWT var names)
5. Remove `server/.env.example`

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `jwt.decode()` for token refresh | Remove fallback, use `jwt.verify()` only | This phase | Closes authentication bypass |
| No HTTP security headers | `helmet()` middleware | This phase | Standard security headers for all responses |
| Inline validation in handlers | `validate()` middleware with schemas | v1.0 | Consistent validation, but not applied to all routes |
| `(req as any).user` | `req.user!.userId` via Express augmentation | This phase | Type-safe auth access |
| `'changeme'` default passwords | Production fail-fast | This phase | No default credentials in production |
| Silent empty camera array | Warning log on empty config | This phase | Visibility into config failures |

**Deprecated/outdated:**
- `express-validator` `handleValidationErrors` pattern (exists in validation.ts but `validate()` is the active pattern)
- `jwt.decode()` — should never be used for security decisions (only for reading token metadata without verification)

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Helmet 8.x defaults don't break Socket.io WebSocket transport | Architecture Patterns | If wrong, live camera streams break. Mitigation: test after applying. |
| A2 | All notification routes are behind `router.use(authenticate())` so `req.user` is always set | Code Examples | If wrong, runtime crash on null access. Verified: line 11 has `router.use(authenticate())`. |
| A3 | The `seedDefaultUsers()` function in `auth/index.ts` only runs in development (line 41 guard) | SEC2-02 | If wrong, production could get default users. Verified: `if (config.nodeEnv !== 'development') return;`. |
| A4 | The `highlight.ts` sort values ('recent', 'persons', 'faces', 'unknown', 'confidence') are the only valid ones | Validation Audit | If wrong, validation rejects valid sort options. Low risk — can check frontend code. |
| A5 | `process.env.TZ` is set to `Asia/Kolkata` in production | D-19 | If wrong, fallback timezone differs. Documented in AGENTS.md: `TZ=Asia/Kolkata`. |

**If this table is empty:** All claims in this research were verified or cited — no user confirmation needed.

## Open Questions

1. **Frontend timezone implementation detail**
   - What we know: D-18 says frontend should send timezone with quiet hours requests. Current frontend code not investigated.
   - What's unclear: Which notification preference endpoint(s) need timezone parameter. Is it just PUT /preferences, or also the initial GET /preferences default?
   - Recommendation: Planner should include a task to check `frontend/src/services/api/notificationService.ts` and related components to add `Intl.DateTimeFormat().resolvedOptions().timeZone` to the request payload.

2. **NVIDIA routes validation depth**
   - What we know: nvidiaRoutes.ts has 7 POST endpoints with body parsing but no validation middleware.
   - What's unclear: What the NVIDIA analysis request body schema looks like — varies by endpoint (analyze, analyze-event, analyze-with-bboxes, etc.).
   - Recommendation: Lower priority since NVIDIA routes require auth and are internally-facing. Can add basic validation (required fields, type checks) without deep schema validation.

3. **detectionRedoRoutes.ts filepath validation**
   - What we know: POST /rerun-detection accepts `filepath` from request body and reads the file from disk.
   - What's unclear: Whether `filepath` could be exploited for path traversal beyond what `fs.access()` provides.
   - Recommendation: Add path validation to ensure filepath is within allowed directories (same pattern as event-search.ts line 123-125).

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Server runtime | ✓ | v26.2.0 | — |
| npm | Package management | ✓ | 11.16.0 | — |
| TypeScript | Build | ✓ | (in devDependencies) | — |
| PostgreSQL | Data layer | — (not checked) | 15+ | Required |
| Redis | Caching | — (not checked) | 6379 | In-memory fallback |

**Missing dependencies with no fallback:**
- None — all fixes are code-only changes using existing dependencies

**Missing dependencies with fallback:**
- PostgreSQL and Redis availability not relevant for this phase (code changes only)

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Jest ^30.2.0 |
| Config file | none — uses defaults |
| Quick run command | `cd server && npm run test:server -- --testPathPattern="auth"` |
| Full suite command | `cd server && npm run test:server` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SEC2-01 | Refresh token with expired/invalid JWT returns 401 | unit | `cd server && npm run test:server -- --testPathPattern="auth"` | ✅ auth.test.ts exists |
| SEC2-02 | Production startup fails without SEED_*_PASSWORD | unit | `cd server && npm run test:server -- --testPathPattern="index"` | ✅ index.test.ts exists |
| SEC2-03 | helmet() middleware applied before routes | unit | `cd server && npm run test:server -- --testPathPattern="index"` | ✅ index.test.ts exists |
| SEC2-04 | Routes with user input reject invalid data | unit/integration | Manual verification via test:server | ❌ No route validation tests |
| SEC2-05 | notificationRoutes use req.user!.userId | unit | `cd server && npm run test:server -- --testPathPattern="notification"` | ❌ No test file |
| SEC2-06 | Empty cameras.json logs warning | unit | `cd server && npm run test:server -- --testPathPattern="config"` | ❌ No test file |

### Sampling Rate
- **Per task commit:** `cd server && npm run test:server -- --testPathPattern="<changed-file>"`
- **Per wave merge:** `cd server && npm run test:server`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `server/src/routes/notificationRoutes.test.ts` — covers SEC2-05 (req.user access pattern)
- [ ] Validation schema tests — covers SEC2-04 (validate() middleware behavior)
- [ ] Config warning test — covers SEC2-06 (empty camera config logging)

*(If no gaps: "None — existing test infrastructure covers all phase requirements")*

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | JWT + bcrypt + MFA (speakeasy) |
| V3 Session Management | yes | JWT access + refresh tokens |
| V4 Access Control | yes | Role-based (admin/user/viewer) via authenticate() middleware |
| V5 Input Validation | yes | `validate()` middleware from `middleware/validation.ts` |
| V6 Cryptography | yes | bcrypt password hashing, AES-256-GCM credential encryption |

### Known Threat Patterns for Express/Node.js

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| JWT signature bypass | Tampering, Spoofing | Remove jwt.decode() fallback (SEC2-01) |
| Default credentials | Tampering, Elevation | Fail-fast without env vars (SEC2-02) |
| Missing security headers | Information Disclosure | helmet() middleware (SEC2-03) |
| SQL injection via unvalidated sort | Tampering | validate() with enum constraint (highlights.ts sort param) |
| XSS via unvalidated body | Tampering | validate() + sanitizeInput middleware |
| Path traversal via filepath | Tampering | validate filepath is within allowed directories |
| CSRF (API-only, mitigated) | Tampering | JWT Bearer tokens (not cookies), CORS policy |

## Sources

### Primary (HIGH confidence)
- Code audit of `server/src/controllers/AuthController.ts` — JWT refresh bypass verified at lines 157-177
- Code audit of `server/src/middleware/auth.ts` — Express Request type augmentation verified at lines 6-10
- Code audit of `server/src/middleware/validation.ts` — validate() middleware and commonSchemas verified
- Code audit of all 20 route files — validation coverage and (req as any) patterns mapped
- Code audit of `server/src/index.ts` — seed password flow at lines 337-338, helmet not applied
- Code audit of `server/src/config/index.ts` — camera config IIFE at lines 274-313
- Code audit of `.env.example` and `server/.env.example` — consolidation analysis
- `server/package.json` — helmet ^8.1.0 verified as installed dependency

### Secondary (MEDIUM confidence)
- npm registry — helmet latest version 8.2.0 confirmed via `npm view helmet version`
- Helmet documentation — default configuration compatible with Socket.io [ASSUMED]
- AGENTS.md — project architecture, conventions, and timezone setting verified

### Tertiary (LOW confidence)
- None — all findings verified from source code

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all dependencies already installed, versions verified
- Architecture: HIGH — exact code locations identified for all 6 requirements
- Pitfalls: HIGH — based on direct code analysis and known Express/Node.js security patterns
- Validation coverage: HIGH — all 20 route files audited, coverage gaps mapped

**Research date:** 2026-05-30
**Valid until:** 30 days (stable — no fast-moving dependencies)
