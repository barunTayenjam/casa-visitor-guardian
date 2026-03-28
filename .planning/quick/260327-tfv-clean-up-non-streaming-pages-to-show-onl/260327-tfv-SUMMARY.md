# Quick Task 260327-tfv Summary

## Task
Clean up non-streaming pages to show only real and relevant data

## Changes Made

### 1. Analytics Page (Analytics.new.tsx)
- Removed fake change percentages from all StatCards (`+12%`, `+8%`, `+0.3%`)
- Removed hardcoded `systemUptime: '99.2%'` - replaced with real "Cameras Online" count
- Removed hardcoded camera uptime `99.2%` percentage bar - now shows only real online/offline status
- Removed fake storage total (`500 GB`) and hardcoded `retentionDays: 30`
- Removed `avgEventSize = 0.5 MB/event` estimation from storage calculation
- Removed "Retention Days" card from Storage Overview (was hardcoded 30)
- Removed "of 500 GB total" subtitle from Used Space card
- Removed unused `TrendingUp` import and `parseChange` function

### 2. Review Page (Review.new.tsx)
- Replaced `Math.random() * 80 + 10` with deterministic `hashCode`-based positioning in TimelineView
- Added `hashCode()` utility function for consistent object positioning across renders

### 3. Events Page (EventsPage.new.tsx)
- Removed misleading `highConfidence` stat (counted only current page events, not total)

## Files Modified
- `frontend/src/pages/Analytics.new.tsx`
- `frontend/src/pages/Review.new.tsx`
- `frontend/src/pages/EventsPage.new.tsx`
