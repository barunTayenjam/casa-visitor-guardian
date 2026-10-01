# API Contract Hygiene — Design Spec

**Date:** 2026-10-01
**Sub-project:** Gap #4 (Code hygiene) from the $1B gap analysis
**Status:** Approved for planning (approach confirmed by operator: static-extraction drift test, no new deps)

## Background

SentryVision's frontend and backend have no enforced API contract. Two historical
failure modes exist in the repo record:

1. Frontend called URLs the backend did not have (4 broken calls, fixed 2026-09-24).
2. ~20 backend endpoints accumulated that no frontend service calls.

`API-SOURCE-OF-TRUTH.md` is maintained by hand and has already drifted (it lists
`GET /api/events/search/legacy`, which no longer exists in code).

## Goal

Make frontend↔backend API drift impossible to merge silently:

- Every HTTP call made by `frontend-next/src/services/api/*` resolves to a
  registered Express route (method + path).
- Every registered route is either called by the frontend or explicitly
  allowlisted as internal/admin with a written reason.
- Documentation reflects reality, generated from the same source of truth.

## Non-goals

- CI config fixes (`ci.yml` references a nonexistent `frontend/` dir) — explicitly
  deferred by operator decision.
- OpenAPI generation, client codegen, or any new dependency.
- Refactoring `consolidatedDetectionService` into a new module (only dead-method
  removal and honest documentation).
- Wiring unused admin endpoints to the frontend.

## Scope decisions (operator-confirmed)

| Decision | Choice |
|---|---|
| Dead endpoints | Delete superseded legacy, keep admin/debug utilities |
| Contract enforcement | Static-extraction Jest drift test, zero new dependencies |
| In scope | Legacy purge + drift test + stub honesty + docs sync |
| Out of scope | CI config fix |

## Design

### 1. Legacy endpoint purge (delete)

Superseded and/or permanently broken routes with zero frontend callers:

| Endpoint | Evidence | Deletion chain |
|---|---|---|
| `GET /api/events/history` | Superseded by `GET /api/events/list-enhanced`; zero references in frontend or scripts | `routes/events.ts:8` route → `EventController.getHistory` → `eventSearch/eventSearchService.ts:330` method → `HistoryFilters` in `eventSearch/types.ts:40` → re-export in `services/eventSearchService.ts:6` |
| `POST /api/detection/filter` | Zero frontend callers; never wired to any frontend service (unwired feature, not an admin utility) | Route block in `routes/detectionRoutes.ts:86-108` (handler uses `detectionService.filterDetections` in try/catch) |
| `server/src/controllers/DetectionController.ts` | Wholly dead — zero importers; no route file references it (verified by grep during design) | Delete file |

Verification gate before each deletion: `rg` for every symbol across `server/src`,
`frontend-next/src`, `scripts/` must return only the deletion chain itself.

### 2. Internal endpoint allowlist (keep, but make explicit)

Endpoints that stay but are not called by the frontend. Stored in
`server/src/contract/internalEndpoints.json` — an array of
`{ "method", "path", "reason" }`. The drift test fails any route that is neither
frontend-called nor in this file, so the allowlist is the authoritative inventory
replacing the hand-maintained table in `API-SOURCE-OF-TRUTH.md`.

Seed contents (verified during implementation; expected members):

- `POST /api/detection/person/:cameraId/trigger` — admin re-trigger; returns graceful 501 (HTTP detection disabled, pipeline is Python WS)
- `POST /api/detection/face/:cameraId/trigger` — same
- `POST /api/motion/:cameraId/simulate` — test/debug utility
- `POST /api/motion/:cameraId/analyze` — only if frontend does not call it (verify; it is absent from the stale unused list)
- Maintenance/cleanup endpoints (`/api/maintenance/*`) — admin ops
- `PUT /api/nvidia/config`, `GET /api/nvidia/models`, `GET /api/nvidia/results` — admin/config
- `GET /api/notifications/logs`, `POST /api/notifications/resubscribe` — ops tooling
- Any other route the extraction shows as uncalled at implementation time

Each entry requires a non-empty `reason`. The test prints the full unused list on
failure so docs can be refreshed from test output.

### 3. Drift test (static extraction, no new deps)

New directory `server/src/contract/`:

```
server/src/contract/
├── extractRoutes.ts          # route table extraction (pure function)
├── extractFrontendCalls.ts   # frontend call extraction (pure function)
├── internalEndpoints.json    # allowlist with reasons
├── __tests__/
│   └── apiContract.test.ts   # the drift test
```

**`extractRoutes.ts`** — reads source with `fs`, regex extraction:

1. Parse `server/src/routes/index.ts` for `app.use('<prefix>', <var>)` mounts into
   a `{ variable → prefix }` map.
2. For each route file referenced by a mount, match
   `router.<method>('<path>'` with a multi-line-tolerant regex (several route defs
   put the path on the following line, e.g. `router.get(\n  '/search',`).
3. Compose `prefix + path`, normalize Express params `:id` → `*` segment wildcard,
   strip query strings.

**`extractFrontendCalls.ts`** — reads `frontend-next/src/services/api/*.ts`:

1. First-argument string literals of `apiGet/apiPost/apiPut/apiDelete/apiClient.*`.
2. Raw `` fetch(`${API_URL}/...`) `` calls (covers `auth/refresh` in `baseClient.ts`).
3. Template-literal URL builders returning `/api/...` paths (covers
   `eventService.ts` image URL builder).
4. Normalize `${...}` interpolations → `*` wildcard, strip query strings.

**`apiContract.test.ts`** — assertions:

- **A (drift, historical bug class):** every extracted frontend call matches at
  least one route by method + wildcard-normalized path. Failure message lists the
  unmatched calls with their source file.
- **B (dead endpoint accumulation):** every extracted route is either matched by ≥1
  frontend call or present in `internalEndpoints.json`. Failure message tells the
  developer to wire it, allowlist it with a reason, or delete it.
- **C (allowlist hygiene):** every allowlist entry matches a real route (no stale
  allowlist entries); every entry has a non-empty `reason`.

Wildcard matching rules: `*` in a path segment matches exactly one segment.
Trailing `/*` (if any) matches remaining segments. Method must match exactly
(Express HEAD-implies-GET is out of scope; no route relies on it).

**Placement:** server Jest (`npm run test:server`). Extraction helpers are pure
functions taking file paths — unit-testable with fixture strings. Frontend files
are read via `fs` relative to repo root (`path.resolve(__dirname, '../../../..')`),
no cross-package TS import, so `server/tsconfig.json` is untouched.

### 4. Stub honesty

`server/src/detection/consolidatedDetectionService.ts` is documented as
"type definitions and settings stubs" (AGENTS.md) — inaccurate. Actual contents:

- **Live:** `DetectionSettingsStore` settings CRUD + config push to Python
  (`writeSettings`) — imported by 11 files. Keep unchanged.
- **Load-bearing guards:** `detectObjects` / `detectFaces` always throw a
  "disabled" error; callers rely on this (try/catch in `motion.ts`, explicit 501
  in `detection-operations.ts`). Keep.
- **Dead:** `getServiceStatus()` — zero callers, returns dishonest
  `{ available: true }`. **Remove.**

### 5. Documentation sync

- `API-SOURCE-OF-TRUTH.md`: delete the stale `search/legacy` row; replace the
  hand-maintained "Backend endpoints NOT called by any frontend service" table
  with a pointer to `server/src/contract/internalEndpoints.json` as the
  authoritative inventory; note the drift test as the enforcement mechanism.
  Refresh the "Broken Calls" section to historical-only.
- `AGENTS.md`: correct the `consolidatedDetectionService` description
  ("settings store + disabled-HTTP guards", not "stubs").

## Error handling

The drift test is the error handler: it fails CI/local runs with actionable
messages (which call, which file, which route, what to do). No runtime behavior
changes except the two deletions, whose removal is safe because zero callers were
verified by grep before deletion.

## Testing

1. Unit tests for both extractors using inline fixture strings (multi-line route
   defs, template literals, query strings, param paths).
2. The contract test itself (assertions A/B/C) — runs against the real repo.
3. Existing gates: `npm run lint:server`, `npm run typecheck` (frontend),
   `cd server && npm run build`, `npm run test:server` — all must pass.

## Success criteria

- `npm run test:server` includes the contract test; deleting any frontend-called
  route or adding an un-allowlisted route makes it fail.
- `GET /api/events/history` and `POST /api/detection/filter` no longer exist.
- `getServiceStatus` removed; zero references remain.
- `API-SOURCE-OF-TRUTH.md` contains no endpoint that fails the contract test.
- All existing tests, lint, typecheck, and build pass.
