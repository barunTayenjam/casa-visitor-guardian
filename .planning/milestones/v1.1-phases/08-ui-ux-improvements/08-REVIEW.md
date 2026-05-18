---
status: needs-fixes
files_reviewed: 16
files_not_found:
  - frontend/src/components/live/RecentDetectionsCarousel.tsx
  - frontend/src/pages/BatchResultsPage.tsx
  - frontend/src/pages/BatchDetectionPage.tsx
findings:
  critical: 3
  warning: 7
  info: 6
total: 16
---

# Phase 08 — UI/UX Improvements: Code Review

## Critical

### C-01 | Analytics date grouping collapses multiple weeks into weekday names

**File:** `frontend/src/pages/Analytics.tsx:123,130,145`  
**Severity:** Critical  
**Description:** The `eventsOverTime` chart groups events by weekday name (e.g. "Mon") using `toLocaleDateString('en-US', { weekday: 'short' })`. For 30-day and 90-day ranges, events from different dates falling on the same weekday are **merged into a single bar**, rendering the chart meaningless.  
**Recommendation:** Use `toISOString().split('T')[0]` or `toLocaleDateString('en-CA')` to group by full date (yyyy-MM-dd) instead of weekday abbreviation.

### C-02 | EventTimeline tooltip never shows — missing `group` class

**File:** `frontend/src/components/events/EventTimeline.tsx:147`  
**Severity:** Critical  
**Description:** The tooltip `<div>` uses `group-hover:block` but its parent element (line 116) lacks the `group` class. The tooltip is **invisible** under any interaction.  
**Recommendation:** Add `group` to the parent `<div>` (line 116: `className="relative h-full flex items-center justify-center group"`).

### C-03 | DayHighlights currentIndex out of sync when category filter is active

**File:** `frontend/src/pages/DayHighlights.tsx:79,156,183,187,195`  
**Severity:** Critical  
**Description:** `currentHighlight` is computed from `highlights[currentIndex]` (unfiltered array), while the displayed event and navigation buttons operate on `filteredHighlights`. When a category filter is applied: (a) `currentIndex` may exceed `filteredHighlights.length`, causing an out-of-bounds access, (b) the slideshow interval at line 156 cycles through `highlights.length` and can land on an event that the filter has excluded.  
**Recommendation:** Derive `currentIndex` and `currentHighlight` from `filteredHighlights`. Reset `currentIndex` to `0` whenever `categoryFilter` changes.

---

## Warning

### W-01 | Analytics light-mode theming broken by hardcoded dark tokens

**Files:**
- `frontend/src/components/events/EventDetailPanel.tsx:7,91-92,97,246-248,256-258,266-268,462`
- `frontend/src/styles/design-tokens.ts:67`

**Severity:** Warning  
**Description:** `EventDetailPanel` imports `colors` from `design-tokens.ts`, which spreads `darkColors` as the base object (line 67). The `colors` export is **never** swapped for the light token set, so every inline style reference (`backgroundColor: colors.background.secondary`, `borderColor: colors.border.subtle`, etc.) uses dark-mode values regardless of the active theme. When the user switches to light mode (Settings → Appearance → Light), the panel renders with dark backgrounds on a light page — a hard-to-read mismatch.  
**Recommendation:** Replace inline references to `colors.*` with Tailwind/CSS-variable equivalents (e.g. `bg-card`, `border-border`) that respect the theme. If `colors` is kept, implement a runtime resolver that returns the correct token set based on the `data-theme` attribute.

### W-02 | `maxStorageGB` / `eventRetentionDays` semantic mapping error

**File:** `frontend/src/pages/Settings.tsx:119-122,174`  
**Severity:** Warning  
**Description:** On load (lines 119–122), the code maps `sysSettings.storage.maxStorageGB` (a storage limit in gigabytes) into `eventRetentionDays` (a time period in days). On save (line 174), the reverse happens — `maxStorageGB` is set to the event-retention-days value. This means the **storage limit is always overridden by whatever retention period the user picks**, and the UI displays gigabytes as if they were days.  
**Recommendation:** The API response/request likely has separate fields: `eventRetentionDays` and `maxStorageGB`. Map them to the correct state fields.

### W-03 | EventTimeline current-time indicator has no `left` position

**File:** `frontend/src/components/events/EventTimeline.tsx:156`  
**Severity:** Warning  
**Description:** The red "current time" indicator (`<div className="absolute top-0 bottom-0 w-px bg-red-500/50">`) is absolutely positioned but has no `left` property. It will always render at the far **left edge** of the timeline container, not at the position representing the current time.  
**Recommendation:** Calculate the correct `left` percentage based on the time range and current time, e.g. `style={{ left: \`${positionPercent}%\` }}`.

### W-04 | `URL.createObjectURL` not revoked (memory leak)

**File:** `frontend/src/pages/EventsPage.tsx:305`  
**Severity:** Warning  
**Description:** `URL.createObjectURL(blob)` is called during bulk export but the resulting object URL is never released with `URL.revokeObjectURL`. Each export leaks a blob URL until the document is unloaded.  
**Recommendation:** After `link.click()`, call `URL.revokeObjectURL(link.href)` to release the URL.

### W-05 | `onCameraFocus` called with `undefined as unknown as string`

**File:** `frontend/src/components/live/AdaptiveCameraGrid.tsx:126,134,197`  
**Severity:** Warning  
**Description:** The `onCameraFocus` prop is typed as `(cameraId: string) => void`. To signal "unfocus", the code passes `undefined as unknown as string`. This type-escapes the contract and the downstream receiver may crash if it does not guard against undefined (e.g. calling `cameraId.toString()`).  
**Recommendation:** Change the callback signature to `onCameraFocus?: (cameraId?: string) => void` and remove the unsafe cast.

### W-06 | Debug `!important` border rule left in index.css

**File:** `frontend/src/index.css:223-225`  
**Severity:** Warning  
**Description:** `.debug-border { border: 2px solid red !important; }` is a debugging utility that remains in the production stylesheet. While not directly harmful, it signals incomplete cleanup and could accidentally be applied by a stray class name.  
**Recommendation:** Remove the rule or gate it behind a `@media` / build flag that only activates in development.

### W-07 | Dead cleanup return inside `useCallback`

**File:** `frontend/src/components/live/AdaptiveCameraGrid.tsx:55`  
**Severity:** Warning  
**Description:** `switchCameraWithAnimation` returns `() => clearTimeout(timeout)` from inside `useCallback`, but `useCallback`'s return value is never consumed by a React effect or other cleanup mechanism. The returned function is dead code and the timeout will fire even after the callback completes.  
**Recommendation:** Remove the `return` statement and instead call `clearTimeout(timeout)` before setting a new timeout, or manage the timeout in a `useRef` that is cleaned on unmount.

---

## Info

### I-01 | `pageSize` ternary with identical branches

**File:** `frontend/src/pages/EventsPage.tsx:147`  
**Severity:** Info  
**Description:** `const pageSize = viewMode === 'grid' ? 100 : 100;` — both branches return 100, making the conditional pointless. Likely intended to have different sizes (e.g. 50 for list, 100 for grid).  
**Recommendation:** Either collapse to `const pageSize = 100;` or implement the intended differentiation.

### I-02 | `getDetectionColor` recreated on every render

**File:** `frontend/src/components/events/EventDetailPanel.tsx:74-85`  
**Severity:** Info  
**Description:** `getDetectionColor` is defined inside the component body and recreated on every render. It is a pure function with no dependencies.  
**Recommendation:** Move it outside the component or wrap with `useCallback`.

### I-03 | `canRestartStream` mutates ref during render path

**File:** `frontend/src/components/dashboard/CameraStream.tsx:109`  
**Severity:** Info  
**Description:** `connectionAttemptsRef.current++` runs inside `canRestartStream`, which is called from event handlers and effects, not during render. Not a bug, but the mutating-ref pattern can be surprising.  
**Recommendation:** No action required, but consider documenting the invariant to prevent future refactors from calling this during render.

### I-04 | Native `<select>` used instead of project `<Select>` component

**File:** `frontend/src/pages/Settings.tsx:364,378`  
**Severity:** Info  
**Description:** Timezone and language pickers use a native `<select>` with inline Tailwind classes rather than the project's `<Select>` (shadcn/ui) component used everywhere else in the same file. This creates visual inconsistency.  
**Recommendation:** Replace native `<select>` elements with `<Select>` / `<SelectTrigger>` / `<SelectContent>` / `<SelectItem>`.

### I-05 | `handleReset` uses full page reload instead of API re-fetch

**File:** `frontend/src/pages/Settings.tsx:220`  
**Severity:** Info  
**Description:** `handleReset` calls `window.location.reload()` to revert settings. This causes a full page reload, losing any in-memory application state.  
**Recommendation:** Re-run the settings-loading logic from the API instead of reloading the page.

### I-06 | `watchSystemPreference` wraps callback unnecessarily

**File:** `frontend/src/lib/theme.ts:44`  
**Severity:** Info  
**Description:** `const handler = () => callback();` is an extra closure indirection. `callback` can be passed directly to `addEventListener`.  
**Recommendation:** Change to `mql.addEventListener('change', callback);`
