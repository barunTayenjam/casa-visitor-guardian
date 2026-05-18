---
status: complete
files_reviewed:
  - server/src/services/retentionPolicyService.ts
  - server/src/services/storageStatsService.ts
  - server/src/services/automatedCleanupService.ts
  - server/src/routes/storageRoutes.ts
  - server/src/models/StorageStats.ts
  - server/src/models/RetentionPolicy.ts
  - frontend/src/services/api/storageService.ts
  - frontend/src/pages/StorageDashboard.tsx
findings:
  critical: 2
  warning: 13
  info: 11
total: 26
---

# Phase 04 — Storage Management Code Review

## Critical

### CRITICAL-1 — Infinite recursion when global retention policy is missing (stack overflow)
- **File**: `server/src/services/retentionPolicyService.ts:90-96`
- **Description**: `getPolicy()` calls `createCameraPolicy()` when no policy is found. `createCameraPolicy()` (line 121) calls `this.getPolicy()` to fetch the global policy as a template. If the global policy does not exist (e.g., `initialize()` failed or the DB row was manually deleted), this creates mutual recursion: `getPolicy(camera) → createCameraPolicy(camera) → getPolicy(global) → createCameraPolicy(undefined) → getPolicy(global) → ...` until stack overflow. The only protection is the 60-second cache, which is insufficient if the DB row is removed after cache expiry.
- **Recommendation**: Guard `createCameraPolicy()` against circular recursion by checking `if (!camera)` before calling `getPolicy()`, or by querying the DB directly with a `findOne` fallback on the global row without routing through `createCameraPolicy`. Add a maximum recursion depth check or a sentinel flag.

### CRITICAL-2 — Storage projection double-counts growth rates
- **File**: `server/src/services/storageStatsService.ts:389-393`
- **Description**: `getStorageProjection()` sums `growth_rate_mb_per_day` from every row where `category !== 'global'`. The `storage_stats` table contains both global-category rows (e.g., `camera=''`, `category='alerts'`) and per-camera rows (e.g., `camera='cam1'`, `category='alerts'`). The global-category rows already aggregate all cameras, so adding per-camera growth rates on top triple-counts. This makes `projectedBytes`, `daysUntilFull`, and `willExceedCapacity` wildly inaccurate.
- **Recommendation**: Sum growth rates only from per-camera rows (`camera != ''` and `camera IS NOT NULL`), or only from global-category rows (`camera = ''` and `category != 'global'`). Do not mix both levels.

---

## Warnings

### WARN-1 — Redundant dynamic import inside cleanupCategory loop
- **File**: `server/src/services/automatedCleanupService.ts:211`
- **Description**: Inside the `cleanupCategory()` loop, `const { promises: fs } = await import('fs');` shadows the top-level `import { promises as fs } from 'fs'` on line 7. This dynamic import runs on every iteration, adding unnecessary async overhead.
- **Recommendation**: Remove the dynamic import; use the top-level `fs` import directly.

### WARN-2 — Redundant dynamic imports shadow module-level imports
- **File**: `server/src/services/automatedCleanupService.ts:326-327`
- **Description**: `cleanupOldestFiles()` dynamically imports `fs` and `path`, shadowing the top-level imports from lines 7-8. The `await import('path')` returns the module namespace object, not the `default` export that `path.join` relies on. While Node.js CJS interop makes this work incidentally, it is fragile and wasteful.
- **Recommendation**: Remove the dynamic imports; use the top-level `fs` and `path` bindings.

### WARN-3 — Dead code: `cleanupExpiredEvents()` never called
- **File**: `server/src/services/automatedCleanupService.ts:240-276`
- **Description**: `cleanupExpiredEvents()` is defined as a private method but is never invoked anywhere in the service. It only logs what it "would delete" but takes no action. This misleads developers into thinking event records are being pruned.
- **Recommendation**: Remove the dead code, or wire it into `runAutomaticCleanup()` if cleanup of event records is desired.

### WARN-4 — Hardcoded camera list in automated cleanup
- **File**: `server/src/services/automatedCleanupService.ts:183`
- **Description**: `const cameras = ['cam1', 'cam2']` is hardcoded. Adding a third camera requires a code change.
- **Recommendation**: Read cameras from `cameras.json` or the database at runtime.

### WARN-5 — Hardcoded max storage (100 GB) in health endpoint
- **File**: `server/src/routes/storageRoutes.ts:424`
- **Description**: The `/storage/health` endpoint uses `const maxStorageGB = 100;` while the service layer reads `maxstoragegb` from the `system_settings` table. These will diverge if the database value is updated.
- **Recommendation**: Call `storageStatsService.getMaxStorageGB()` instead of hardcoding.

### WARN-6 — No rate limiting or role-based access on cleanup/policy endpoints
- **File**: `server/src/routes/storageRoutes.ts:304,381,123,141,171,201,243,270`
- **Description**: Endpoints that delete files, modify policies, and recalculate statistics are protected only by `requireUser`. Any authenticated user (including read-only `viewer` role) can trigger destructive operations. No rate limiting prevents abuse.
- **Recommendation**: Add role-based guards (e.g., `requireRole('admin')`) on destructive endpoints. Apply rate limiting to `POST` cleanup/apply/recalculate routes.

### WARN-7 — Service-level `deletePolicy()` does not protect global policy
- **File**: `server/src/services/retentionPolicyService.ts:162-175`
- **Description**: The route handler correctly rejects deletion of the global policy (line 247), but `retentionPolicyService.deletePolicy()` itself has no guard. If called from another service or script, it could delete the global policy, triggering the infinite recursion described in CRITICAL-1.
- **Recommendation**: Add a guard at the service level: `if (!camera) throw new Error('Cannot delete global policy')`.

### WARN-8 — `bigint` / `number` type mismatch in StorageStats model
- **File**: `server/src/models/StorageStats.ts:17`
- **Description**: `total_bytes` is typed as `@Column({ type: 'bigint' })` in the database but declared as `number` in TypeScript. PostgreSQL `bigint` maps to JavaScript `BigInt`, not `number`. Values beyond 2^53 (≈9 PB) will lose precision. While unlikely for a home security system, this is a latent type safety bug.
- **Recommendation**: Change the TypeScript type to `number | bigint` or ensure application-level values stay well below 2^53.

### WARN-9 — Default retention values conflict between model and service
- **File**: `server/src/models/RetentionPolicy.ts:11-24` vs `server/src/services/retentionPolicyService.ts:22-28`
- **Description**: The entity decorator defaults and the service `DEFAULT_RETENTION_DAYS` disagree on every category. Model: `alerts=30, detections=7, previews=7, snapshots=30, events=30`. Service: `alerts=7, detections=30, previews=14, snapshots=7, events=7`. If a new policy is created via `Repository.create()` without explicit values (e.g., via a migration or TypeORM subscriber), model defaults apply. The service always passes explicit values, so this is silent but divergent.
- **Recommendation**: Unify defaults into one source of truth. Remove column-level defaults and handle only in the service, or vice versa.

### WARN-10 — `fileCount` vs `count` type mismatch in breakdown API contract
- **File**: `frontend/src/services/api/storageService.ts:9` / `frontend/src/pages/StorageDashboard.tsx:39` vs `server/src/services/storageStatsService.ts:351-352`
- **Description**: The frontend `StorageOverview.breakdown` type expects `{ bytes: number; fileCount: number }` but the backend sends `{ bytes: number; count: number; percentage: number }`. The `breakdown` is not rendered on screen so this is silent, but consuming `stat.fileCount` on a `breakdown` entry gives `undefined`.
- **Recommendation**: Align the frontend type with the backend shape: `{ bytes: number; count: number; percentage: number }`.

### WARN-11 — Array index as React key in table
- **File**: `frontend/src/pages/StorageDashboard.tsx:364`
- **Description**: `<tr key={i}>` uses the array index as the React key. This causes unnecessary re-renders and incorrect DOM reconciliation if the data ever changes order.
- **Recommendation**: Use a stable unique identifier (e.g., `${stat.camera}-${stat.category}`) as the key.

### WARN-12 — Potential `NaN` from `parseInt(null)` on empty aggregate
- **File**: `server/src/services/storageStatsService.ts:229-241`
- **Description**: `calculateGlobalStats()` queries `WHERE ss.camera != ''`. When no camera-specific rows exist, `result.totalBytes` is `null`, and `parseInt(null)` returns `NaN`. The `|| 0` fallback coerces `NaN || 0` to `0`, so the math works, but only by accident.
- **Recommendation**: Use `parseInt(result.totalBytes ?? '0')` or a COALESCE in the SQL query.

### WARN-13 — No symlink handling in directory scanner
- **File**: `server/src/services/retentionPolicyService.ts:286-315` (also storageStatsService.ts:171-201, automatedCleanupService.ts:397-429)
- **Description**: `readdir` with `withFileTypes` does not follow symlinks. `isFile()` and `isDirectory()` return `false` for symbolic links, so symlinked files or directories are silently ignored. This is a correctness issue if detections are stored on a symlinked mount or if archived files are accessed via symlinks.
- **Recommendation**: Add `entry.isSymbolicLink()` handling with `fs.realpath()` to resolve symlinks before reading or deleting.

---

## Info

### INFO-1 — Sequential category file scans could be parallelized
- **File**: `server/src/services/retentionPolicyService.ts:191-209`
- **Description**: `getExpiredFiles()` runs five `findExpiredFiles()` calls sequentially. Each call scans a potentially large directory. For systems with many files, this adds latency.
- **Recommendation**: Use `Promise.all()` to run category scans concurrently.

### INFO-2 — Unnecessary `setParameters({})` call
- **File**: `server/src/services/storageStatsService.ts:230`
- **Description**: `.setParameters({})` is a no-op since all parameters are already supplied inline via `.where(...)`.
- **Recommendation**: Remove the redundant call.

### INFO-3 — Timezone default (UTC) may cause cleanup at wrong hour
- **File**: `server/src/services/automatedCleanupService.ts:139`
- **Description**: Cleanup cron schedule uses `process.env.TZ || 'UTC'`. The system timezone is IST (UTC+5:30), so a cron expression `'0 2 * * *'` runs at 2:00 UTC (7:30 AM IST), not 2:00 AM IST as the code comment in `retentionPolicyService.ts:317` suggests.
- **Recommendation**: Set `TZ=Asia/Kolkata` in the environment or change the fallback to match the deployment locale.

### INFO-4 — Magic number 7 for image retention
- **File**: `server/src/services/automatedCleanupService.ts:161`
- **Description**: `cleanupOldImages(7)` hard-codes a 7-day retention for images. This should be configurable or derived from the retention policy.
- **Recommendation**: Read the retention value from `retentionPolicyService` or environment variable `IMAGE_RETENTION_DAYS`.

### INFO-5 — Cleanup history stored only in memory
- **File**: `server/src/services/automatedCleanupService.ts:34-35`
- **Description**: `cleanupHistory` is an in-memory array. History is lost on server restart.
- **Recommendation**: Persist cleanup history to the database if retention of this data is important.

### INFO-6 — Duplicate directory scanner implementations
- **File**: `server/src/services/automatedCleanupService.ts:397-429` (also retentionPolicyService.ts:286-315, storageStatsService.ts:171-201)
- **Description**: All three services implement nearly identical recursive directory scanners with `readdir` + `stat`. This is ~130 lines of duplicated logic.
- **Recommendation**: Extract a shared `DirectoryScanner` utility service.

### INFO-7 — Empty catch block swallows retention summary errors
- **File**: `frontend/src/pages/StorageDashboard.tsx:87-89`
- **Description**: The `try/catch {}` around `getRetentionSummary()` silently swallows errors. If the retention endpoint fails, the user sees a partial dashboard with no indication of failure.
- **Recommendation**: Log the error to console in development, or show an inline error state for the retention section.

### INFO-8 — `useEffect` without cleanup on async fetch
- **File**: `frontend/src/pages/StorageDashboard.tsx:101-103`
- **Description**: The `useEffect` calls `fetchData()` but provides no cleanup function. If the component unmounts before the async operations resolve, `set*` calls on unmounted state will still fire.
- **Recommendation**: Use an `AbortController` or a mounted flag to prevent state updates after unmount.

### INFO-9 — Zod schema allows 0 days (immediate deletion)
- **File**: `server/src/routes/storageRoutes.ts:13-17`
- **Description**: `z.number().int().min(0)` permits 0 days for every retention category. Setting a category to 0 would delete all files in that category on the next cleanup run.
- **Recommendation**: Consider raising the minimum to 1 unless immediate deletion is an intentional feature documented in the UI.

### INFO-10 — Service startup waits for full stats recalculation
- **File**: `server/src/services/storageStatsService.ts:52-55`
- **Description**: `initialize()` calls `await this.calculateAllStats()` which syncs the entire filesystem. For directories with many files, this delays service readiness significantly.
- **Recommendation**: Kick off `calculateAllStats()` as a fire-and-forget promise rather than awaiting it during initialization.

### INFO-11 — Growth rate calculation may include zero-value windows
- **File**: `server/src/services/storageStatsService.ts:276-293`
- **Description**: `calculateGrowthRates()` uses any two records with `records.length >= 2`. If stats were calculated multiple times within a short window (e.g., rapid recalculations), the time diff could be minutes, giving a near-zero denominator and inflated growth rates.
- **Recommendation**: Skip pairs where `daysDiff < 1` to ensure growth rates are computed over at least one full day.
