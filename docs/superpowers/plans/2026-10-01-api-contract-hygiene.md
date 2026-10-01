# API Contract Hygiene Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make frontend↔backend API drift impossible to merge silently: purge dead endpoints, enforce both directions with a static-extraction Jest contract test, and sync docs to reality.

**Architecture:** Three pure parse functions read route sources and frontend sources with regex, normalize paths (`:param`/`${...}` → `*`, `${API_URL}` → `/api`, query strings stripped), and a Jest test asserts (A) every frontend `/api/` call matches a route, (B) every route is frontend-called or allowlisted, (C) allowlist entries are non-stale with reasons. Dead endpoints are deleted before the allowlist is seeded so the allowlist reflects post-purge reality.

**Tech Stack:** TypeScript (ESM, NodeNext), Jest 30 + ts-jest ESM (existing server setup), zero new dependencies.

**Spec:** `docs/superpowers/specs/2026-10-01-api-contract-hygiene-design.md`

## Global Constraints

- Zero new npm dependencies (spec non-goal).
- Server code is ESM (`"type": "module"`): imports need `.js` suffixes; `__dirname` unavailable — use `const __filename = fileURLToPath(import.meta.url)` (pattern used in `server/src/routes/index.ts:34-35`).
- No comments in code unless asked (repo convention).
- Jest runs with coverage enforced globally (branches/functions/lines/statements ≥ 80 in `server/jest.config.js`) — every new branch in extractors needs a unit-test fixture exercising it.
- Frontend files are read via `fs` from the monorepo root; never import frontend TS into server code.
- Scope of contract: only URLs starting `/api/` (after `${API_URL}` expansion). Static/asset URLs (`/snapshots/...`, `/events/...`, `/public/...`) are out of scope.
- Repo commands: `npm run test:server` (root or `server/`), `npm run lint:server`, `npm run typecheck`, `cd server && npm run build`.

## Review Focus

1. **Frontend URLs built in a variable, not inline** (e.g. `const url = \`${API_URL}/x\`; fetchWithRetry(url)`) — extractor would miss the call; a route called only that way looks "unused" (false B failure) or a deleted route still has a live caller (false A pass). Pin: Task 4 Step 3 — before allowlisting any "unused" route, `rg` the repo for its path; any real caller found means extending the extractor, not allowlisting. Pin: Task 4 Step 4 — before accepting any A failure as drift, `rg` for how the frontend actually builds that URL.
2. **Multi-line route definitions** (`router.get(\n  '/path',`) or route path from a variable — extractor misses routes → frontend calls look unmatched (false A failure). Pin: Task 3 unit fixture `MULTILINE_ROUTE` must pass; Task 4 Step 2 sanity check: extracted route count must equal `rg -c`-style manual count of `router.verb(`/`app.verb('/api` occurrences across route files.
3. **Method inference** (`fetchWithRetry(url, { method: 'DELETE' })` vs default GET) — wrong method → false A/B failures. Pin: Task 3 unit fixtures `METHOD_OPTION` (explicit) and `DEFAULT_GET` (absent); matching rule: exact method match required when both sides known.
4. **Purge breaking an undiscovered consumer** (dynamic imports, string route references in scripts/tests/public HTML — `server/src/public/event-classifier.html` fetches API paths). Pin: Task 1 Step 1/6/9 — `rg` each deletion target across the whole repo including `scripts/` and `server/src/public/` before deleting; Task 6 full suite green.
5. **`/api/events/image/:filename` style routes shared by server-internal builders** (notificationService, chat queryTools) — the contract test covers frontend only; a route deleted for "frontend-unused" status could still be called server-side. Pin: Task 1 Step 6 requires repo-wide `rg` for the path string (not just frontend) before any deletion; Task 4 assertion B failure message instructs the same.

---

### Task 1: Legacy endpoint purge

**Files:**
- Modify: `server/src/routes/events.ts` (remove line 8 `router.get('/history', ...)`)
- Modify: `server/src/controllers/EventController.ts` (remove `getHistory`, currently lines 19-29)
- Modify: `server/src/services/eventSearch/eventSearchService.ts` (remove `getHistory` method, currently lines 330-~420)
- Modify: `server/src/services/eventSearch/types.ts` (remove `HistoryFilters`, currently lines 40-50)
- Modify: `server/src/services/eventSearchService.ts` (remove `HistoryFilters` from re-export list, line 6)
- Modify: `server/src/routes/detectionRoutes.ts` (remove `router.post('/filter', ...)` block, currently lines 86-108)
- Delete: `server/src/controllers/DetectionController.ts` (zero importers, verified)
- Test: existing suite (`npm run test:server`) + build

**Interfaces:**
- Consumes: nothing
- Produces: route table without `/api/events/history` and `/api/detection/filter` — Tasks 3/4 build the extractor against this post-purge tree

- [ ] **Step 1: Verify `history` deletion chain has no external consumers**

Run:
```bash
rg -n "events/history|getHistory|HistoryFilters" server/src frontend-next/src scripts server/src/public
```
Expected: only the deletion-chain files themselves (`routes/events.ts`, `EventController.ts`, `eventSearch/eventSearchService.ts`, `eventSearch/types.ts`, `eventSearchService.ts`). Any hit in `scripts/`, `frontend-next/`, or `public/` → stop, report, reassess.

- [ ] **Step 2: Delete the history chain**

Remove in order: route line in `routes/events.ts`; `getHistory` method in `EventController.ts`; `getHistory` method in `eventSearch/eventSearchService.ts` (through the closing brace before the next method/class member); `HistoryFilters` interface in `types.ts`; `HistoryFilters` from the barrel re-export in `services/eventSearchService.ts`.

- [ ] **Step 3: Verify compile after history purge**

Run: `cd server && npx tsc --noEmit`
Expected: PASS — no unresolved `HistoryFilters`/`getHistory` references.

- [ ] **Step 4: Verify `/api/detection/filter` has no consumers**

Run:
```bash
rg -n "detection/filter|filterDetections" server/src frontend-next/src scripts server/src/public
```
Expected: hits only in `routes/detectionRoutes.ts` (the block being deleted) and `services/detection/detectionService.ts` (`filterDetections` definition). If `detectionService.filterDetections` has no remaining caller after deletion, note it for Step 8.

- [ ] **Step 5: Delete the `/filter` route block and `DetectionController.ts`**

Remove the `router.post('/filter', ...)` block in `routes/detectionRoutes.ts` (keep the surrounding routes and the comment structure intact). Then:
```bash
rg -ln "DetectionController" server/src
```
Expected: only `server/src/controllers/DetectionController.ts` itself → `rm server/src/controllers/DetectionController.ts`.

- [ ] **Step 6: Verify no other consumers of deleted controller**

Run: `rg -n "triggerPersonDetection|detectionController" server/src frontend-next/src scripts`
Expected: no hits (the controller was never mounted on any route — verified during design).

- [ ] **Step 7: Handle orphaned `filterDetections` (conditional)**

If Step 4 showed `filterDetections` now has zero callers: remove the method from `services/detection/detectionService.ts` (verify by `rg -n "filterDetections" server/src` showing only the definition). If it still has callers, leave it.

- [ ] **Step 8: Run server tests + build**

Run: `npm run test:server` and `cd server && npm run build`
Expected: both PASS.

- [ ] **Step 9: Commit**

```bash
git add -A server/src
git commit -m "refactor: purge dead endpoints (events history, detection filter) and dead DetectionController"
```

---

### Task 2: Remove dead `getServiceStatus()`

**Files:**
- Modify: `server/src/detection/consolidatedDetectionService.ts` (remove `getServiceStatus`, currently lines 78-85)
- Test: existing suite + build

**Interfaces:**
- Consumes: nothing
- Produces: unchanged exports otherwise — 11 importers of this module keep working (class, singleton, `getConsolidatedDetectionService`, types)

- [ ] **Step 1: Verify zero callers**

Run: `rg -n "getServiceStatus" server/src frontend-next/src scripts`
Expected: only `consolidatedDetectionService.ts` itself.

- [ ] **Step 2: Delete the method and run tests + build**

Remove `getServiceStatus` (including its `logger.warn` body). Run: `npm run test:server` and `cd server && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add server/src/detection/consolidatedDetectionService.ts
git commit -m "refactor: remove dead getServiceStatus from consolidated detection service"
```

---

### Task 3: Path normalizer + source extractors with unit tests

**Files:**
- Create: `server/src/contract/extractors.ts`
- Create: `server/src/contract/__tests__/extractors.test.ts`

**Interfaces:**
- Consumes: nothing (pure functions over strings)
- Produces (exactly these names — Tasks 4 relies on them):

```ts
export interface RouteEntry { method: string; path: string; file: string; }
export interface CallEntry { method: string; path: string; file: string; }
export interface MountEntry { prefix: string; routerVariable: string; routeFile: string; }

export function normalizePath(raw: string): string;
export function matchPath(pattern: string, actual: string): boolean;
export function parseMounts(source: string): MountEntry[];
export function parseRouteSource(source: string, fileLabel: string): RouteEntry[];
export function parseConfigureSource(source: string, fileLabel: string): RouteEntry[];
export function parseFrontendSource(source: string, fileLabel: string): CallEntry[];
```

**Semantics (pinned):**
- `normalizePath`: replace `` `${API_URL}` `` (and `API_URL` template form) with `/api`; strip `?query` and `#hash`; replace `:name` segments and `${...}` interpolations with `*`; collapse duplicate slashes; ensure leading `/`.
- `matchPath(pattern, actual)`: segment-wise equality after normalization; `*` matches exactly one non-empty segment; lengths must be equal.
- `parseMounts`: matches `app.use('<prefix>', <var>)` AND maps `<var>` to its route file via `import <var> from './<file>.js'` in the same source; only entries whose prefix starts `/api`.
- `parseRouteSource`: matches `router.<verb>( '<path>'` allowing whitespace/newlines between `(` and the quote; verbs: get/post/put/delete/patch.
- `parseConfigureSource`: matches direct `app.<verb>( '<path>'` where path starts `/api` (skips `app.use`, skips non-`/api` paths like `/stream/:cameraId`).
- `parseFrontendSource`: first-arg literals of `fetchWithRetry(`, `fetch(`, `apiGet|apiPost|apiPut|apiDelete(`, and `return \`/api/...\`` builders; captures method from `method: '<VERB>'` within the same call's paren depth, default `get`; only keeps paths normalizing to start `/api/`.

- [ ] **Step 1: Write failing unit tests**

Create `extractors.test.ts` with one `describe` per exported function. Required fixtures (each its own `it`):

- `normalizePath`: API_URL template → `/api`; strips `?limit=${limit}`; `:cameraId` → `*`; `${date}` → `*`; duplicate slash collapse.
- `matchPath`: exact match; `*` single-segment wildcard; length mismatch false; `*` does not match empty.
- `parseMounts`: fixture source containing `import authRoutes from './auth.js';` + `app.use('/api/auth', authRoutes);` + `app.use('/api', somethingElse)` (unmapped var ignored if no import) → one `MountEntry { prefix: '/api/auth', routerVariable: 'authRoutes', routeFile: 'auth' }`.
- `parseRouteSource` `MULTILINE_ROUTE`: `router.get(\n  '/search',\n optionalAuth,` → `{ method: 'get', path: '/search' }`.
- `parseRouteSource` params: `router.post('/:cameraId/simulate', ...)` → path `/:cameraId/simulate`.
- `parseConfigureSource`: `app.get('/api/health', ...)` included; `app.get('/stream/:cameraId', ...)` excluded; `app.use('/api/auth', x)` excluded.
- `parseFrontendSource` `DEFAULT_GET`: `fetchWithRetry(\`${API_URL}/cameras\`)` → `{ method: 'get', path: '/api/cameras' }`.
- `parseFrontendSource` `METHOD_OPTION`: `fetchWithRetry(\`${API_URL}/cameras/${id}\`, { method: 'DELETE' })` → `{ method: 'delete', path: '/api/cameras/${id}' }`.
- `parseFrontendSource` query string: `` `${API_URL}/motion/events?limit=${limit}` `` → path `/api/motion/events` (query stripped before wildcarding).
- `parseFrontendSource` apiGet: `apiGet<InsightsEnvelope>(\`/analytics/daily/${date}\`)` → path `/analytics/daily/${date}` (API_URL prefix applied via normalize: `apiGet` endpoint is relative to `/api`, so extractor prefixes `/api` before normalize — pin: `parseFrontendSource` treats `apiGet/apiPost/apiPut/apiDelete` first args as `/api`-rooted).
- `parseFrontendSource` skips non-API: `getSnapshotImageUrl` builder returning `` `/snapshots/${filename}` `` → no entry.

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd server && npm run test:server -- src/contract/__tests__/extractors.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement `server/src/contract/extractors.ts`**

Implement exactly the six functions with the pinned semantics. Approach notes: for method extraction, scan from the call site through matching close-paren with a depth counter (ignore parens inside the string literal); regex on strings uses `` ([`'"])(.*?)\1 `` per-line won't span lines — prefer capturing up to the closing backtick/quote with a multiline-capable pattern (`[^`]*` for templates, `[^']*` for quotes).

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd server && npm run test:server -- src/contract/__tests__/extractors.test.ts`
Expected: PASS, all fixtures green.

- [ ] **Step 5: Commit**

```bash
git add server/src/contract
git commit -m "feat: add static API source extractors with unit tests"
```

---

### Task 4: Contract test + seeded allowlist

**Files:**
- Create: `server/src/contract/__tests__/apiContract.test.ts`
- Create: `server/src/contract/internalEndpoints.json`

**Interfaces:**
- Consumes: Task 3 exports (`parseMounts`, `parseRouteSource`, `parseConfigureSource`, `parseFrontendSource`, `matchPath`, `normalizePath`); `MountEntry.routeFile` → `server/src/routes/<routeFile>.ts`
- Produces: passing contract test; `internalEndpoints.json` as `Array<{ "method": string; "path": string; "reason": string }>` (raw Express paths with `:params`, e.g. `/api/detection/person/:cameraId/trigger`)

**Repo root resolution:** `path.resolve(__dirname, '../../../..')` from `server/src/contract/__tests__/` (use `fileURLToPath(import.meta.url)` for `__dirname`).

- [ ] **Step 1: Write the failing contract test**

`apiContract.test.ts` structure:

- `loadRoutes()`: read `server/src/routes/index.ts` → `parseConfigureSource` (direct `/api` app routes) + `parseMounts` → for each mount, read `server/src/routes/<routeFile>.ts` → `parseRouteSource` → prefix-mount each path with `MountEntry.prefix` (join with `/`, no duplicate slash), normalize each to `path`, collect `RouteEntry[]`.
- `loadCalls()`: for each `*.ts` file in `frontend-next/src/services/api/`, `parseFrontendSource`, collect `CallEntry[]`.
- `loadAllowlist()`: `JSON.parse(fs.readFileSync(...internalEndpoints.json))`, validate shape (method/path/reason strings, non-empty reason) — invalid shape fails assertion C.
- **Assertion A:** `it('every frontend /api call resolves to a registered route')` — for each call, pass if some route has equal `method` (case-insensitive) and `matchPath(route.path, call.path)`. Failure message: `Unmatched frontend calls:\n` + each `\`${call.method.toUpperCase()} ${call.path}\` from ${call.file}` + hint: `route missing → add route or fix frontend URL`.
- **Assertion B:** `it('every route is frontend-called or allowlisted')` — route is covered if some call matches it (same method, `matchPath(route.path, call.path)` — note direction: pattern is route, actual is call) OR some allowlist entry has equal normalized method+path (compare `normalizePath(entry.path)` to `normalizePath(route.path)` with `matchPath` both directions — pin: use `matchPath(allowlistNorm, routeNorm) || matchPath(routeNorm, allowlistNorm)` so `:param` forms align). Failure message: `Unclassified routes:\n` + each `\`${route.method.toUpperCase()} ${route.path}\` from ${route.file}` + hint: `wire it, allowlist it in internalEndpoints.json with a reason, or delete it` + instruction: `before allowlisting, rg the repo for this path to find non-frontend consumers`.
- **Assertion C:** `it('allowlist entries are non-stale and reasoned')` — every entry has non-empty `reason` and matches ≥1 real route (same matching rule as B).

- [ ] **Step 2: Sanity-check extraction counts before trusting failures**

Run a temporary one-off (or `console.log` in the test run): count `RouteEntry[]` and compare with `rg -c "router\.(get|post|put|delete)\(" server/src/routes/*.ts | awk -F: '{s+=$2} END {print s}'` plus direct `/api` `app.verb` count (`rg -c "app\.(get|post|put|delete)\('/api" server/src/routes/index.ts`).
Expected: extracted ≥ that count (mount duplicates excluded — compare per-file). If extracted count is materially lower, fix `extractors.ts` (multi-line/variable path forms) before proceeding.

- [ ] **Step 3: Run the test; triage assertion A failures**

Run: `cd server && npm run test:server -- src/contract/__tests__/apiContract.test.ts`
For each unmatched frontend call: `rg -n "<path>" server/src/routes server/src/index.ts`. If a real route exists that extraction missed → fix extractor + add unit fixture (Task 3 style). If no route exists → it is genuine drift: fix the frontend call to the correct path (preferred) or, if the backend route was intentionally removed, update the frontend caller. Never make assertion A pass by allowlisting.

- [ ] **Step 4: Triage assertion B failures into the allowlist**

For each uncalled route: `rg -n "<path>" frontend-next/src` (confirm no caller missed) AND `rg -n "<path>" server/src scripts server/src/public` (find non-frontend consumers — record in `reason` if present). Then add `{ method, path, reason }` entries to `internalEndpoints.json`. Expected seed members include the `person/face/trigger` pair, `motion/simulate`, `motion/analyze` (if uncalled), `maintenance/*`, `nvidia/config|models|results`, `notifications/logs|resubscribe`, `detection/stats`, `detection-data/*`, `events/search` stats variants, `system/*` admin routes not called by the frontend — the exact set is whatever the extractor reports; every entry gets a specific reason (e.g. `"admin re-trigger; HTTP detection disabled, returns 501"`).

- [ ] **Step 5: Run until green**

Run: `cd server && npm run test:server -- src/contract/__tests__/apiContract.test.ts`
Expected: PASS (all three assertions).

- [ ] **Step 6: Negative proof — verify the test actually fails on drift**

Temporarily change one frontend call path (e.g. in `cameraService.ts` `/api/cameras` → `/api/camerasX`), run the test, expect assertion A FAIL with that call named; revert; temporarily delete one allowlist entry, run, expect assertion B FAIL; restore; commit only after both negative checks pass and final run is green.

- [ ] **Step 7: Commit**

```bash
git add server/src/contract
git commit -m "feat: add frontend/backend API contract drift test with internal endpoint allowlist"
```

---

### Task 5: Documentation sync

**Files:**
- Modify: `API-SOURCE-OF-TRUTH.md` — "⚠️ Broken Calls" section (mark purely historical, remove fixed-items table or collapse to a dated note); "Backend endpoints NOT called by any frontend service" table → replace with pointer to `server/src/contract/internalEndpoints.json` + one-line description of the contract test; remove stale `search/legacy` reference
- Modify: `AGENTS.md` — `consolidatedDetectionService.ts` line ("Type definitions + settings stubs" → "Settings store + disabled-HTTP guards; detection runs in Python") and the Detection Pipeline section entry if it mentions stubs
- Modify: spec's stale claims are NOT edited (spec is a dated artifact); plan/AGENTS only

**Interfaces:**
- Consumes: Task 4's `internalEndpoints.json` (the new source of truth)
- Produces: docs that match contract-test reality

- [ ] **Step 1: Rewrite the two stale sections in API-SOURCE-OF-TRUTH.md**

Broken Calls section: keep a one-paragraph historical note (2026-09-24 drift incident, now prevented by contract test) + remove the "Fixed"/"Removed dead code" tables or convert to `<details>` historical archive. Unused endpoints section: replace table with: authoritative list = `server/src/contract/internalEndpoints.json`; enforcement = `server/src/contract/__tests__/apiContract.test.ts` (assertions A/B/C); how to run = `cd server && npm run test:server -- src/contract/__tests__/apiContract.test.ts`.

- [ ] **Step 2: Fix AGENTS.md wording**

Locate `consolidatedDetectionService.ts` mentions (Backend Structure tree line + Detection Pipeline step 12) and reword to: provides detection settings store + config push to Python; `detectObjects`/`detectFaces` are disabled guards that throw (HTTP detection off); actual detection runs in Python.

- [ ] **Step 3: Verify no doc endpoint lists contradict the contract**

Run: `rg -n "search/legacy|events/history|detection/filter" *.md docs AGENTS.md`
Expected: no hits outside git history / dated spec (spec may mention them as deletions — fine).

- [ ] **Step 4: Commit**

```bash
git add API-SOURCE-OF-TRUTH.md AGENTS.md
git commit -m "docs: sync API source of truth and AGENTS with contract test as enforcement"
```

---

### Task 6: Full verification

**Files:** none (verification only)

- [ ] **Step 1: Full quality gate**

Run (from repo root, in order):
```bash
npm run lint
npm run typecheck
npm run lint:server
cd server && npm run build
cd .. && npm run test:server
```
Expected: ALL PASS. Any coverage-threshold failure means a new extractor branch lacks a fixture → return to Task 3 Step 1 and add it.

- [ ] **Step 2: Contract test is in the suite**

Run: `npm run test:server -- --listTests | rg contract`
Expected: both contract test files listed (`extractors.test.ts`, `apiContract.test.ts`).

- [ ] **Step 3: Final report**

Summarize: endpoints deleted, allowlist size, contract assertions green, docs updated. Link spec + plan.
