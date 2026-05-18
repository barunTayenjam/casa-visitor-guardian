---
status: needs-changes
files_reviewed:
  - server/src/services/notificationService.ts
  - server/src/services/eventSearchService.ts
  - server/src/routes/notificationRoutes.ts
  - server/src/models/NotificationSubscription.ts
  - server/src/models/NotificationLog.ts
  - server/src/models/NotificationPreferences.ts
  - frontend/src/components/events/SmartFilters.tsx
  - frontend/src/components/events/EventPagination.tsx
  - frontend/src/components/events/EventDetailPanel.tsx

findings:
  critical: 2
  warning: 7
  info: 7
  total: 16
---

# Phase 02 Review: Notifications & Events

## Critical

### C-01: Missing source file — EventPagination.tsx does not exist
- **File**: `frontend/src/components/events/EventPagination.tsx`
- **Line**: N/A
- **Description**: The file referenced in the review manifest does not exist in the codebase. The directory `frontend/src/components/events/` contains only `SmartFilters.tsx`, `RelatedEvents.tsx`, `EventDetailPanel.tsx`, and `EventTimeline.tsx`. This component is either not yet implemented or was planned but never created.
- **Recommendation**: Create the missing `EventPagination.tsx` component or remove it from the review scope. If pagination logic exists elsewhere (e.g., in `EventTimeline.tsx`), consolidate or alias the component.

### C-02: No try-catch around `JSON.parse` on untrusted metadata
- **File**: `server/src/services/eventSearchService.ts`
- **Line**: 110
- **Description**: `event.metadata ? JSON.parse(event.metadata) : null` will throw an uncaught exception if a database record contains invalid JSON. A corrupted or manually edited `metadata` column would crash the entire search endpoint with a 500 error.
- **Recommendation**: Wrap `JSON.parse` in a try-catch block. On parse failure, return `null` or a default object and log the error for investigation.

---

## Warning

### W-01: String-based time comparison in quiet hours is fragile
- **File**: `server/src/services/notificationService.ts`
- **Line**: 175–185
- **Description**: `isTimeInQuietHours` compares time strings lexicographically (e.g., `"22:00" < "06:00"`). This works for zero-padded 24-hour `HH:MM` format but breaks silently if the format ever changes (e.g., non-padded hours, 12-hour with AM/PM, or seconds included). No validation is performed on the stored time values.
- **Recommendation**: Parse times into `Date` objects or total-minutes integers for reliable comparison, and validate `quietHoursStart`/`quietHoursEnd` format at write time.

### W-02: `orWhere` in cleanup query can cause bulk deletion
- **File**: `server/src/services/notificationService.ts`
- **Line**: 355–360
- **Description**: The `cleanupExpiredSubscriptions` method chains `.orWhere('is_active = :isActive', { isActive: false })` after `.where()`. This generates `DELETE ... WHERE last_used < :date OR is_active = false`, which deletes **all** inactive subscriptions regardless of age — not just those older than 30 days. A subscription marked inactive 1 minute ago will be removed immediately.
- **Recommendation**: Use `andWhere` with grouped parentheses (`.where('last_used < :date').andWhere('is_active = :isActive')`) to require both conditions, or add a separate `AND last_used < :date` clause within the `is_active` condition.

### W-03: Empty objects array produces garbled notification title
- **File**: `server/src/services/notificationService.ts`
- **Line**: 294
- **Description**: The title `objects[0]?.charAt(0).toUpperCase() + objects[0]?.slice(1)` evaluates to `"undefinedundefined Detected"` when `objects` is an empty array, because optional chaining returns `undefined` and string concatenation coerces it to the string `"undefined"`.
- **Recommendation**: Guard with `if (!objects || objects.length === 0) return;` before constructing the payload.

### W-04: Dynamic import inside hot notification path
- **File**: `server/src/services/notificationService.ts`
- **Line**: 336
- **Description**: `await import('../models/index.js')` is executed every time `sendNotificationToAllUsers` is called (i.e., for every notification sent to every user). Dynamic imports are asynchronous and incur module-resolution overhead. This adds unnecessary latency to every notification delivery.
- **Recommendation**: Import `User` statically at the top of the file alongside the other model imports: `import { User } from '../models/User.js';`. If the circular dependency concern exists, restructure the module graph rather than deferring the import.

### W-05: No input validation on notification subscription endpoint
- **File**: `server/src/routes/notificationRoutes.ts`
- **Line**: 13–37
- **Description**: The POST `/subscribe` route checks only for the existence of `endpoint`, `keys`, `keys.p256h`, and `keys.auth`. There is no format validation, length limiting, or schema enforcement. An attacker could store arbitrarily large or malformed strings in the database. This is inconsistent with other routes that use Zod validation (per AGENTS.md).
- **Recommendation**: Add Zod schema validation for subscription payloads. Validate the `endpoint` URL format, enforce reasonable string length limits (< 2048 bytes), and verify `keys` are valid base64-encoded strings.

### W-06: `updatedAt` column does not auto-update on modification
- **File**: `server/src/models/NotificationPreferences.ts`
- **Line**: 41–42
- **Description**: The `updatedAt` column uses `default: () => 'NOW()'` but has no `onUpdate` strategy. The timestamp will be set on creation but never updated when the entity is saved. The column silently stays at its original value after preference changes.
- **Recommendation**: Replace with `@UpdateDateColumn({ name: 'updated_at' })` decorator which TypeORM supports natively and handles both insert and update timestamps.

### W-07: Derived state stored in `useState` can desynchronize
- **File**: `frontend/src/components/events/SmartFilters.tsx`
- **Line**: 50
- **Description**: `activeFilterCount` is managed as independent `useState` and manually recalculated in `updateFilter` and `clearAllFilters`. A direct setState call on `filters` (via `setFilters`) that bypasses `updateFilter` would leave the count permanently out of sync. Only the first path is exercised today, but the architecture is fragile.
- **Recommendation**: Replace with `const activeFilterCount = useMemo(...)` derived from `filters`.

---

## Info

### I-01: User ID written to application logs
- **File**: `server/src/services/notificationService.ts`
- **Line**: 71, 85, 131, 163, 227
- **Description**: User IDs are logged at info level in multiple places (subscribe, unsubscribe, subscription expiry, quiet hours suppression, delivery summary). User IDs, while not secrets, are PII. In production with centralized log aggregation, these could be exposed in log streams accessible to operators without a direct need.
- **Recommendation**: Consider logging an anonymized hash (e.g., `userId.substring(0,8)`) or removing user IDs from production log output. Use structured logging with PII-tagging for log redaction.

### I-02: Missing bulk-create handling for duplicate subscriptions
- **File**: `server/src/models/NotificationSubscription.ts`
- **Line**: 1–35
- **Description**: No unique constraint exists on `(userId, endpoint)`. The `subscribe` method in `NotificationService` inserts a new row every time without checking for an existing subscription. A client that calls subscribe twice will create two identical subscriptions, and the user will receive duplicate push notifications.
- **Recommendation**: Add a unique constraint on `userId + endpoint` (either in TypeORM with `@Index({ unique: true })` or via a migration). In `subscribe`, use "upsert" logic: find-existing-first or `INSERT ... ON CONFLICT DO UPDATE`.

### I-03: `eventId` in `NotificationLog` uses `SET NULL` but column is typed as nullable
- **File**: `server/src/models/NotificationLog.ts`
- **Line**: 24
- **Description**: The `@ManyToOne(() => Event, { onDelete: 'SET NULL' })` relationship means deleting an Event sets `event_id` to null in notification logs. The column declaration at line 21 (`eventId!: string | null`) does allow nulls, so the schema is consistent. However, existing notifications lose their event association silently — a user viewing a notification log entry won't know which Event it referred to.
- **Recommendation**: This may be intentional (retain logs after event cleanup). Consider documenting the cascade behavior or, if event association must be preserved, switch to `onDelete: 'CASCADE'`.

### I-04: Date range picker only captures single date
- **File**: `frontend/src/components/events/SmartFilters.tsx`
- **Line**: 199–207
- **Description**: The calendar popover uses `mode="single"` and only updates `filters.dateRange.start`. The `end` date is never set via the UI. The `FilterState.dateRange` interface defines both `start` and `end`, but the visual date picker does not allow selecting a range, making the end-date feature dead code.
- **Recommendation**: Switch to `mode="range"` on the Calendar component to allow start/end date selection, or remove `end` from the `dateRange` type if only single-date filtering is intended.

### I-05: Download uses programmatic click which can cause page navigation
- **File**: `frontend/src/components/events/EventDetailPanel.tsx`
- **Line**: 58–65
- **Description**: The `handleDownload` function creates an `<a>` element, sets its `href` to `event.imageUrl`, and triggers `.click()`. If the URL points to the same origin (e.g., `/api/events/image/...`), the browser may navigate the current page instead of downloading, depending on the Content-Disposition header. There is no `target="_blank"` or `download` attribute that works cross-origin for same-origin URLs (it does set `.download` but with a hardcoded filename).
- **Recommendation**: Use `fetch()` + `URL.createObjectURL()` to download the image blob, or ensure the server sets `Content-Disposition: attachment` header. Add error handling for failed downloads.

### I-06: Bounding box pixel values used without coordinate system normalization
- **File**: `frontend/src/components/events/EventDetailPanel.tsx`
- **Line**: 180–183
- **Description**: Detection bounding box coordinates (`x`, `y`, `width`, `height`) are applied directly as CSS pixel values. ML model outputs often use normalized coordinates (0–1 range) or coordinates relative to the original image dimensions, which may differ from the rendered `<img>` dimensions. If the image is displayed at a different aspect ratio or size, overlays will be misaligned.
- **Recommendation**: Document the coordinate system convention in the `MotionEvent` type. If coordinates are relative, compute pixel values as `(coord / originalDimension) * renderedDimension`. If absolute, ensure the rendered image dimensions match the source.

### I-07: Emoji characters used in rendered UI labels
- **File**: `frontend/src/components/events/EventDetailPanel.tsx`
- **Line**: 204, 209, 214
- **Description**: The AI detection overlay labels use Unicode emoji characters (👤 `person`, 🚗 `vehicle`, 🐾 `animal`) concatenated with text strings in `<div>` elements. Emoji rendering varies across OS/browser combinations and can cause accessibility issues for screen reader users.
- **Recommendation**: Replace emoji with SVG icons or CSS-based indicators (e.g., colored dots or icon components) for consistent rendering and better accessibility.
