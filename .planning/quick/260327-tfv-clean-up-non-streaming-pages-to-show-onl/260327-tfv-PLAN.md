# Quick Task 260327-tfv: Clean up non-streaming pages to show only real and relevant data

## Task 1: Fix Analytics page - remove hardcoded/fake data

**Files:** `frontend/src/pages/Analytics.new.tsx`

**Action:**
1. Remove fake change percentages from all 4 StatCards (`+12%`, `+8%`, `%`, `+0.3%`)
2. Remove hardcoded `systemUptime: '99.2%'` - replace with real data or remove the stat card entirely
3. Fix camera uptime - remove hardcoded `99.2%`, show only real online/offline status without fake percentage
4. Remove fake storage calculation (`avgEventSize = 0.5`, `total: 500` GB, `retentionDays: 30`). Keep "Used Space" and "Total Events" with real data only. Remove "of 500 GB total" and "Retention Days" sections from the storage overview
5. In Storage Overview card, keep only 2 items: Used Space (real) and Total Events (real). Remove the Retention Days card

**Verify:** Page shows only data from API responses, no hardcoded numbers

**Done:** All StatCards show real data only, no fake percentages or hardcoded values

## Task 2: Fix Review page timeline - remove random positioning

**Files:** `frontend/src/pages/Review.new.tsx`

**Action:**
1. Replace `Math.random() * 80 + 10` with a deterministic position based on object data (hash of id or label)

**Verify:** Timeline objects render at consistent positions across refreshes

**Done:** No `Math.random()` in render path

## Task 3: Fix Events page misleading stats

**Files:** `frontend/src/pages/EventsPage.new.tsx`

**Action:**
1. Remove `highConfidence` from stats (only counts current page, misleading)
2. Change "X today" to show total from pagination data instead of filtering current page events

**Verify:** Header stats match actual totals from API

**Done:** Stats show accurate totals from API pagination data
