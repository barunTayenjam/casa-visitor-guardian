# Phase 10: App-Wide Navigation and UI/UX Consistency - Context

**Gathered:** 2026-03-27
**Status:** Ready for planning

<domain>
## Phase Boundary

Unify navigation patterns, shared components, and visual consistency across all 10+ pages in the SentryVision app. The streaming interface (Phase 9) is simplified, but the rest of the app has 12 critical consistency issues including 3 different color systems, 8 duplicate headers, and no shared UI components.

</domain>

<decisions>
## Implementation Decisions

### Color System
- **Approach:** Fix incrementally, page by page
- **Target:** CSS variables (`bg-background`, `text-foreground`) — same as Settings
- **Priority pages:** DayHighlights (hardcoded slate), Events, Analytics, VisitorTimeline, Review, StreamDashboard (design tokens inline)
- Each page migration is a separate task — don't block on full unification

### Navigation
- **Create shared `PageHeader` component**
- Props: `title`, `subtitle`, `icon`, `backTo` (route or onClick), `actions` (ReactNode)
- Back button pattern: `ChevronLeft` + "Back" text (matches Events, Analytics, Settings)
- Title size: `text-lg font-semibold` for sub-pages, `text-2xl font-bold` for top-level pages
- All pages migrate to use PageHeader — eliminates 8 duplicate implementations

### Shared Components
- **StatCard** — icon, value, label, optional change badge. Replace 5 inline implementations.
- **PageLoading** — consistent spinner (size, color via CSS vars). Replace 4 spinner variants.
- **EmptyState** — icon, title, description, optional action button. Replace 4 empty state variants.
- **Container widths** — standardize to `max-w-7xl mx-auto px-4 md:px-6` for content pages

### Back Button Standardization
- Pattern: `ChevronLeft` icon + "Back" text button
- Pages to fix: VisitorTimeline (ArrowLeft icon-only), Review (ArrowLeft icon-only), BatchDetection (outline button), DayHighlights (missing), BatchResults (missing)

### cn() Utility
- All pages import from `@/lib/utils` (alias, not relative)
- Fix Analytics.local `cn` definition — it doesn't merge Tailwind classes

### Claude's Discretion
- Exact component API design left to implementation
- Migration order (which pages first) left to implementation
- Whether to create a `PageLayout` wrapper or just `PageHeader`

</decisions>

<canonical_refs>
## Canonical References

### Audit Findings (12 issues)
Full audit in agent output — key files:
- `frontend/src/pages/DayHighlights.new.tsx` — hardcoded slate colors, no back button, oversized titles
- `frontend/src/pages/Analytics.new.tsx` — broken local `cn()`, design token colors
- `frontend/src/pages/EventsPage.new.tsx` — design token colors, 5 inline stat cards
- `frontend/src/pages/VisitorTimeline.tsx` — ArrowLeft back button, different title size
- `frontend/src/pages/Review.new.tsx` — ArrowLeft back button, relative `cn` import
- `frontend/src/pages/StreamDashboard.new.tsx` — design token colors, hardcoded z-index
- `frontend/src/pages/BatchDetectionPage.tsx` — outline button back, different container
- `frontend/src/pages/BatchResultsPage.tsx` — no back button, different container
- `frontend/src/pages/Settings.new.tsx` — uses isolated custom CSS classes (btn-ghost, card-surface, input-theme)
- `frontend/src/pages/Login.tsx` — already uses CSS variables (reference implementation)

### Key Files
- `frontend/src/lib/utils.ts` — contains `cn()` utility (clsx + twMerge)
- `frontend/src/lib/design-tokens.ts` — defines colors, zIndex tokens (unused)
- `frontend/src/index.css` — CSS variables for theme, custom utility classes
- `frontend/src/App.tsx` — routing, shared loading spinner

No external specs — requirements fully captured in decisions above.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `cn()` from `@/lib/utils` — clsx + twMerge, already imported by some pages
- shadcn Card, Button, Select components — available but inconsistently styled
- `design-tokens.ts` — has zIndex tokens (never used), color definitions
- CSS variables in `index.css` — theme-aware, used by Settings/Login

### Established Patterns
- shadcn/ui component library — Card, Button, Select, Dialog, Sheet, Drawer
- Tailwind CSS with `darkMode: ["class"]` — class-based theming
- React Router v6 — routing with `<Outlet />`
- CSS custom properties for theme colors

### Integration Points
- Every page in `frontend/src/pages/` needs migration
- New shared components go in `frontend/src/components/ui/`
- `App.tsx` routing — may need layout wrapper
- `index.css` — CSS variable definitions for all theme colors

</code_context>

<specifics>
## Specific Ideas

- PageHeader component similar to iOS navigation bars: back button left, title center/left, actions right
- StatCard: compact card with icon in colored circle, large value, small label, optional green/red change badge
- PageLoading: centered spinner using `border-primary` (CSS var), not hardcoded colors
- EmptyState: centered icon + title + description + optional CTA button, using muted colors
- Container: `max-w-7xl mx-auto px-4 md:px-6 py-6` as the standard content wrapper
- Migration approach: create shared components first, then migrate pages one by one

</specifics>

<deferred>
## Deferred Ideas

- Full AppShell with sidebar navigation — user chose PageHeader only for now
- Design token unification — user chose incremental CSS variable migration
- Select component standardization — can be addressed during page migrations

</deferred>

---

*Phase: 10-app-wide-navigation-and-ui-ux-consistency*
*Context gathered: 2026-03-27*
