---
description: analyse and fix events page at /app/events
status: complete
created: 2026-05-19
quick_id: 260519-nzz
slug: analyse-and-fix-events-page-at-app-event
completed: 2026-05-19
---

# Quick Summary: 260519-nzz

## Task: analyse and fix events page at /app/events

## Completed Work

### Bug 1: Camera filter broken (HIGH)
SmartFilters passed camera display names ("Front Door") as `camera_id` to API, but backend expects IDs ("cam1"). Filter always returned 0 results.

**Fix:** SmartFilters now accepts `Array<{ id: string; name: string }>` instead of `string[]`. EventsPage passes camera objects. Badge shows resolved name via lookup.

### Bug 2: Sort by confidence not working (HIGH)
Backend `list-enhanced` only handled `newest`/`oldest`. Confidence sort silently fell through to timestamp DESC.

**Fix:** Added `sortBy === 'confidence'` branch with `ORDER BY confidence DESC, timestamp DESC`.

### Bug 3: Camera names not displayed (MEDIUM)
API response lacks `cameraName` field. Frontend showed "Camera cam1" instead of "Front Door".

**Fix:** Frontend resolves names from cameras context during event transformation.

### Bug 4: Confidence percentage wrong (HIGH)
Backend stores 0-100 range (e.g. 5.37, 100). Frontend did `Math.round(confidence * 100)` showing "537%" or "10000%".

**Fix:** Changed to `Math.round(confidence)` in EventsPage and EventDetailPanel.

### Bug 5: Calendar date click does nothing (HIGH)
`handleCalendarDayClick` made two consecutive `updateFilter` calls — the second (`quickRange='all'`) used stale closure state and reset `dateRange` back to undefined.

**Fix:** Refactored `updateFilter` to use functional `setFilters(prev => ...)` eliminating stale closures. Calendar click now uses single atomic `setFilters` call that sets both `dateRange` and `quickRange` simultaneously.

### Bug 6: Today/Yesterday/Last7/Last30 filters return 0 results (HIGH)
`quickRangeOptions.getDates()` used `new Date()` for both start and end — same millisecond. Backend `timestamp >= start AND timestamp <= end` with identical timestamps = zero matches.

**Fix:** Uses `startOfDay()`/`endOfDay()` from date-fns. Today = midnight-to-midnight. Yesterday = yesterday midnight-to-midnight. Last 7 = 6 days ago midnight to today EOD.

### Bug 7: Vehicle filter option does nothing (MEDIUM)
Frontend sent `event_type=vehicle` but backend had no handler — fell through, returned ALL events.

**Fix:** Removed "Vehicle" from detection type filter options (no vehicle event_type in database).

### Bug 8: RelatedEvents layout broken (MEDIUM)
EventDetailPanel is `position: fixed` (overlay) but RelatedEvents was in flex flow as sibling — took 500-600px pushing event grid under the overlay.

**Fix:** Moved RelatedEvents rendering into EventDetailPanel's scrollable content area. Removed from EventsPage flex container.

### Bug 9: Date badge dismiss leaves stale quickRange (LOW)
Clicking date range badge cleared `dateRange` but `quickRange` stayed set, showing inconsistent badge state.

**Fix:** Badge onClick now atomically clears both `dateRange` and `quickRange`.

## Files Modified
- `frontend/src/components/events/SmartFilters.tsx` — Functional setState, proper date boundaries, removed vehicle, fixed calendar click, fixed badge dismiss
- `frontend/src/pages/EventsPage.tsx` — Camera objects, name resolution, confidence display, removed RelatedEvents from flex flow
- `frontend/src/components/events/EventDetailPanel.tsx` — Confidence display, added RelatedEvents rendering inside panel
- `server/src/routes/index.ts` — Confidence sort order

## Verification
- TypeScript: 0 errors
- ESLint: 0 errors, 1 pre-existing warning (DayHighlights.tsx)
- Backend build: Clean
