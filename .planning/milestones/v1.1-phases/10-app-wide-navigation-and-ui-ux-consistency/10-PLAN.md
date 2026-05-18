# Phase 10: App-Wide Navigation and UI/UX Consistency - Implementation Plan

**Created:** 2026-03-27
**Status:** Ready for implementation
**Context:** `.planning/phases/10-app-wide-navigation-and-ui-ux-consistency/10-CONTEXT.md`

---

## Phase Boundary

Create shared UI components and migrate all pages to consistent patterns. 12 issues identified across 10+ pages — 3 color systems, 8 duplicate headers, 4 back button patterns, 5 stat card variants, 4 spinner variants, 4 empty state variants.

---

## Plan 10.1: Create Shared UI Components

**Goal:** Build the 4 shared components that eliminate duplication across all pages.

**User Value:** Consistent look and feel, less code to maintain, faster page development.

### Tasks

#### 10.1.1 Create PageHeader Component
**Files:** `frontend/src/components/ui/PageHeader.tsx` (new)
**Effort:** 3 hours

Shared header replacing 8 duplicate implementations:
```tsx
interface PageHeaderProps {
  title: string;
  subtitle?: string;
  icon?: LucideIcon;
  backTo?: string;           // Route path, or omit for no back button
  onBack?: () => void;       // Custom back handler (alternative to backTo)
  actions?: React.ReactNode; // Right-side action buttons
  size?: 'default' | 'large'; // default: text-lg, large: text-2xl
}
```

Layout:
- Left: ChevronLeft + "Back" (if backTo/onBack provided)
- Center-left: Icon + Title + Subtitle
- Right: Actions slot

Styling: CSS variables (`bg-background`, `text-foreground`, `border-border`), `cn()` from `@/lib/utils`.

**Acceptance:**
- [ ] Renders correctly with all prop combinations
- [ ] Back button uses ChevronLeft + "Back" text
- [ ] Title size matches context decision (text-lg default, text-2xl large)
- [ ] Theme-aware (CSS variables)
- [ ] Accessible (aria-label on back button, proper heading level)

#### 10.1.2 Create StatCard Component
**Files:** `frontend/src/components/ui/StatCard.tsx` (new)
**Effort:** 2 hours

Replace 5 inline stat card implementations:
```tsx
interface StatCardProps {
  icon?: LucideIcon;
  iconColor?: string;
  label: string;
  value: string | number;
  change?: { value: number; label?: string }; // +5.2% badge
  className?: string;
}
```

Layout: Icon circle + large value + small label + optional change badge (green/red).

**Acceptance:**
- [ ] Renders with and without icon, with and without change badge
- [ ] Change badge colors: green for positive, red for negative
- [ ] Theme-aware styling
- [ ] Responsive (flexible width)

#### 10.1.3 Create PageLoading Component
**Files:** `frontend/src/components/ui/PageLoading.tsx` (new)
**Effort:** 1 hour

Replace 4 spinner variants with one consistent component:
```tsx
interface PageLoadingProps {
  message?: string;
  fullScreen?: boolean; // true: h-screen, false: h-64
}
```

Spinner: `animate-spin rounded-full border-4 border-primary border-t-transparent w-12 h-12` — uses CSS var `border-primary`, not hardcoded colors.

**Acceptance:**
- [ ] Centered spinner with optional message
- [ ] Uses `border-primary` (CSS variable), works in light/dark
- [ ] Full-screen or inline mode

#### 10.1.4 Create EmptyState Component
**Files:** `frontend/src/components/ui/EmptyState.tsx` (new)
**Effort:** 1 hour

Replace 4 empty state variants:
```tsx
interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
}
```

Layout: Centered icon in muted circle + title + description + optional CTA button.

**Acceptance:**
- [ ] Renders with all prop combinations
- [ ] Icon container uses muted background
- [ ] Theme-aware styling
- [ ] Action button uses primary variant

---

## Plan 10.2: High-Priority Page Migrations

**Goal:** Migrate the worst offenders — DayHighlights, Events, Analytics — to shared components and CSS variables.

**User Value:** The most-used pages get consistent navigation and theming first.

### Tasks

#### 10.2.1 Migrate DayHighlights.new.tsx
**Files:** `frontend/src/pages/DayHighlights.new.tsx`
**Effort:** 3 hours

Fixes:
- Replace hardcoded `bg-slate-900`/`text-slate-400`/`text-white` with CSS variables
- Add PageHeader with back button (currently missing)
- Replace `text-3xl md:text-4xl font-bold` title with PageHeader `size="large"`
- Use StatCard for stat grid (currently 5 inline Card components)
- Use PageLoading for spinner (currently hardcoded `border-blue-600`)
- Use EmptyState for empty state (currently inline)
- Fix `cn()` import to `@/lib/utils` (already correct)

**Acceptance:**
- [ ] No hardcoded slate colors remain
- [ ] PageHeader renders with back button
- [ ] StatCard replaces inline stat cards
- [ ] Theme toggle works (light/dark)
- [ ] Build passes

#### 10.2.2 Migrate EventsPage.new.tsx
**Files:** `frontend/src/pages/EventsPage.new.tsx`
**Effort:** 3 hours

Fixes:
- Replace `colors.background.primary` inline style with CSS variables
- Replace inline header with PageHeader
- Replace 5 inline stat card divs with StatCard
- Use EmptyState for empty state
- Fix Select styling to use theme-aware classes
- Ensure `cn()` import is from `@/lib/utils`

**Acceptance:**
- [ ] No design token inline styles remain
- [ ] PageHeader replaces inline header
- [ ] StatCard replaces inline stat cards
- [ ] Theme toggle works
- [ ] Build passes

#### 10.2.3 Migrate Analytics.new.tsx
**Files:** `frontend/src/pages/Analytics.new.tsx`
**Effort:** 3 hours

Fixes:
- Remove broken local `cn` definition (line 61) — import from `@/lib/utils`
- Replace `colors.background.primary` inline style with CSS variables
- Replace inline header with PageHeader
- Replace inline StatCard divs with shared StatCard component
- Use PageLoading for spinner (currently hardcoded white)
- Use EmptyState for empty state

**Acceptance:**
- [ ] Local `cn` definition removed, imports `@/lib/utils`
- [ ] No design token inline styles remain
- [ ] PageHeader replaces inline header
- [ ] StatCard replaces inline stat cards
- [ ] Theme toggle works
- [ ] Build passes

---

## Plan 10.3: Medium-Priority Page Migrations

**Goal:** Migrate VisitorTimeline, Review, StreamDashboard to consistent patterns.

**User Value:** Navigation consistency across the remaining main pages.

### Tasks

#### 10.3.1 Migrate VisitorTimeline.tsx
**Files:** `frontend/src/pages/VisitorTimeline.tsx` (or VisitorTimeline.new.tsx)
**Effort:** 2 hours

Fixes:
- Replace `ArrowLeft` icon-only back button with PageHeader (ChevronLeft + text)
- Replace `text-xl md:text-2xl font-semibold` title with PageHeader
- Replace `colors.background.primary` inline style with CSS variables
- Use StatCard for stat grid
- Use EmptyState for empty state
- Use PageLoading for spinner

**Acceptance:**
- [ ] PageHeader replaces ArrowLeft icon-only back
- [ ] Theme-aware styling
- [ ] Build passes

#### 10.3.2 Migrate Review.new.tsx
**Files:** `frontend/src/pages/Review.new.tsx`
**Effort:** 2 hours

Fixes:
- Replace `ArrowLeft` icon-only back button with PageHeader
- Fix relative `cn` import (`../lib/utils` → `@/lib/utils`)
- Replace `colors.background.primary` inline style with CSS variables
- Use StatCard for stat grid (3-col)
- Use EmptyState for empty state

**Acceptance:**
- [ ] PageHeader replaces ArrowLeft icon-only back
- [ ] cn import uses `@/lib/utils` alias
- [ ] Theme-aware styling
- [ ] Build passes

#### 10.3.3 Migrate StreamDashboard.new.tsx
**Files:** `frontend/src/pages/StreamDashboard.new.tsx`
**Effort:** 2 hours

Fixes:
- Replace `colors.background.primary` inline style with CSS variables
- Replace custom absolute-positioned header with PageHeader (or minimal variant for full-screen stream)
- Use zIndex tokens or CSS variables instead of hardcoded z-30/z-40

Note: StreamDashboard is a special full-screen page. PageHeader may need a `minimal` variant that just shows logo + actions without the standard back/title layout.

**Acceptance:**
- [ ] CSS variables replace design token inline styles
- [ ] z-index uses consistent values
- [ ] Theme-aware styling
- [ ] Build passes

---

## Plan 10.4: Low-Priority Page Migrations and Cleanup

**Goal:** Complete remaining pages and clean up isolated styling.

**User Value:** Full app consistency — no page left behind.

### Tasks

#### 10.4.1 Migrate BatchDetectionPage.tsx
**Files:** `frontend/src/pages/BatchDetectionPage.tsx`
**Effort:** 1 hour

Fixes:
- Replace `Button variant="outline"` back button with PageHeader
- Replace `text-3xl font-bold` title with PageHeader `size="large"`
- Standardize container to `max-w-7xl`

**Acceptance:**
- [ ] PageHeader replaces custom header
- [ ] Build passes

#### 10.4.2 Migrate BatchResultsPage.tsx
**Files:** `frontend/src/pages/BatchResultsPage.tsx`
**Effort:** 1 hour

Fixes:
- Add PageHeader with back button (currently missing)
- Replace `text-3xl font-bold` title with PageHeader
- Use StatCard for stat grid
- Standardize container to `max-w-7xl`

**Acceptance:**
- [ ] PageHeader added with back button
- [ ] Build passes

#### 10.4.3 Clean Up Settings Isolated CSS Classes
**Files:** `frontend/src/index.css`, `frontend/src/pages/Settings.new.tsx`
**Effort:** 1 hour

Fixes:
- Audit `btn-ghost`, `card-surface`, `input-theme` custom classes
- Either promote to shared utilities or replace with standard Tailwind + CSS variables
- Ensure Settings still looks correct after migration

**Acceptance:**
- [ ] No orphaned CSS classes
- [ ] Settings styling consistent with other pages
- [ ] Build passes

---

## Success Metrics

**User Experience:**
- All pages respect dark/light theme toggle
- Back button is consistent across all sub-pages
- Page titles follow 2-size scale (default/large)
- Stat cards, loading spinners, empty states look identical everywhere

**Technical:**
- 4 shared components created (PageHeader, StatCard, PageLoading, EmptyState)
- 10 pages migrated to shared components
- 0 hardcoded color values in page files
- 0 duplicate header implementations
- Single `cn()` import pattern across all files

---

## Dependencies

### Required
- ✅ Phase 8 (UI/UX) — CSS variables and theme infrastructure
- ✅ Phase 9 (Streaming UI) — StreamPanel, clean CameraStream
- ✅ shadcn/ui components — Card, Button available

### Components to Create
- PageHeader.tsx — Shared navigation header
- StatCard.tsx — Reusable stat display
- PageLoading.tsx — Consistent loading spinner
- EmptyState.tsx — Consistent empty state

### Pages to Migrate (10)
- DayHighlights.new.tsx (high priority — hardcoded colors)
- EventsPage.new.tsx (high priority — design tokens)
- Analytics.new.tsx (high priority — broken cn)
- VisitorTimeline.tsx (medium)
- Review.new.tsx (medium)
- StreamDashboard.new.tsx (medium — special full-screen page)
- BatchDetectionPage.tsx (low)
- BatchResultsPage.tsx (low)
- Settings.new.tsx (low — CSS class cleanup)
- Login.tsx (skip — already consistent)

---

*Plan created: 2026-03-27*
*Phase: 10-app-wide-navigation-and-ui-ux-consistency*
