# SentryVision — $100M App Plan

**Status:** Session 2 complete (brand + soul + polish). Critique 32/40 (up from 27/40). All 5 issues fixed and deployed.
**Branch:** `feature/frontend-updates`
**App:** `http://192.168.31.99:9753/` (Docker Compose, backend serves static frontend-next)
**Build:** `npm run build` → `docker restart sentryvision-app` (CSP hashes require restart)

---

## What's Done (Session 2)

### Workstream 1: Login Logo ✅
- `LoginPage.tsx`: ShieldCheck pill → `<LogoMark size={36}>` above "Welcome back"
- `public/favicon.svg`: shield-eye mark on dark rounded square
- `layout.tsx`: `icons: { icon: '/favicon.svg' }` in metadata

### Workstream 2: Threat Banner (Hero Moment) ✅
- `src/components/dashboard/ThreatBanner.tsx` replaces SystemPulse (deleted)
- ALL CLEAR: breathing emerald left bar + soft bg pulse + event count
- ALERT: ≥0.8-confidence event < 5min old → amber pulsing border, label + camera + relative time, +N badge, tap → /events
- 4 keyframes in `globals.css`: `breathing-glow`, `pulse-soft`, `breathing-alert`, `alert-border`; all reduced-motion guarded

### Workstream 3: Chat Presence ✅
- `src/components/ui/StreamingText.tsx`: word-by-word reveal (3–6 tokens per 22–58ms tick), click/Enter to skip, reduced-motion → instant
- `AskPage.tsx`: `AssistantBubble` — streams only the fresh response (streamIndex), entrance motion (fade+rise 180ms), images/tables/evidence footer appear after stream completes, instant scroll-on-grow

### Workstream 4: Empty State Art ✅
- `EmptyState.tsx`: LogoMark at 48px in `bg-primary/5` 80px surface (icon prop now optional fallback)
- Call sites updated: EventsPage, LogsPage, InsightsPage, PeoplePage (inline empty → EmptyState)

### Workstream 5: Polish Pass ✅
- Critique run: **32/40** (from 27/40) — snapshot in `.impeccable/critique/2026-09-25T15-45-00Z__frontend-next-src.md`
- All 5 findings fixed + deployed:
  1. ThreatBanner time-awareness: 30s re-render tick, dismissible alert (X → hidden until next high-conf event), all-clear shows "latest Xm ago" not raw event count
  2. Mobile dock labels: `shortLabel` now visible on all viewports (was icon-only below `sm`)
  3. Typing dots: `animate-bounce` → `animate-typing-pulse` (ease-out opacity pulse, no bounce)
  4. Alert border animation: `box-shadow` → `border-color` keyframe (cheap repaint, flat-by-default compliant)
  5. Copy: "No Faces Clustered Yet" → sentence case
- Lint + typecheck + build clean; deployed via `docker restart sentryvision-app`, health 200

### Session 3 candidates (from critique, not yet done)
- ~~Keyboard shortcut cheat-sheet~~ ✅ `ShortcutHelp.tsx` — global `?` overlay in Shell, lists j/k/Esc//?/ + watchman legend, Esc/backdrop closes, bezel dialog
- ~~Alert tap target~~ ✅ banner rows `min-h-11` (44px), dismiss button 44px, "View →" 10px→12px
- ~~In-app help surface~~ ✅ (partially — `?` overlay doubles as help: shortcut list + banner color legend)
- Streaming global disable for fast readers (Settings toggle) — skipped; reduced-motion + click-skip already cover it
- getRelativeTime still local to ThreatBanner (only 1 consumer — fine until a second appears)

**Projected score after session 3 fixes: 35/40** (H7 3→4 shortcuts discoverable, H10 2→3 help surface, H6 3→4 labels/sizes fixed). Deployed, health 200.

---

## What's Already Done (Session 1)

### Design System Foundation
- `DESIGN.md` + `.impeccable/design.json` sidecar — full token extraction, 7 named rules
- North Star: "The Night Watchman" / Accent: "Quiet Authority" / Components: "Precise and tactile"
- `--ease-out: cubic-bezier(0.23,1,0.32,1)` custom easing in CSS variables

### Critique-Driven Fixes (27 → 28/40, ready for 35+)
- **P0** Settings restructured into 4 tabs: Account | Monitoring | Data | System (SectionWorkspace)
- **P1** Keyboard shortcuts: `j`/`k` cycle events, `Esc` closes detail panel, `/` focuses Ask input
- **P1** Token cleanup: all hard-coded hex → design tokens across every file
- **P1** Backdrop-blur purged from all shadcn/ui primitives
- **P2** AI gradient in EventDetailPanel → machined bezel pattern
- **P2** Verification tier jargon → plain language + tooltips
- **P2** Radius unified: 0 raw `rounded-[0.xx]` values remain (all → `rounded-xl`/`rounded-lg`)
- **P3** aria-labels on StreamDashboard mobile icon buttons
- **P3** Press-scale unified to 0.97
- **P3** `h-screen` → `h-[100dvh]`
- **P3** `transition-all` → specific properties everywhere
- **P3** Container: single 1200px max-width on all pages via `PageContainer`
- **P3** SmartFilters padding aligned to `px-4 sm:px-6`

### Quality Improvements
- Emil Kowalski design engineering review — custom easing, exit < enter timing, specific transitions
- Charts palette extracted to `src/lib/chart-tokens.ts` — all InsightsPage charts on design tokens
- SystemPulse component on dashboard — event count + high-alert badge
- Typing indicator — 3 bouncing dots replace spinner in Ask
- Toast: `transition-all` regression fixed

---

## Remaining Workstreams (Session 2+)

### Workstream 1: Login Logo (30 min)
**File:** `src/views/LoginPage.tsx`
- Replace `ShieldCheck` pill with `<Logo size={28} />` + "Night Watchman's Eye" shield mark
- Add `<LogoMark>` above "Welcome back" h1
- Create `public/favicon.svg` — the shield mark as a 32×32 SVG favicon
- Update `next.config.mjs` or `layout.tsx` `<head>` to use the new favicon

### Workstream 2: Threat Banner — The Hero Moment (1–2 hr)
**File:** `src/views/StreamDashboard.tsx`
- "ALL CLEAR" state: breathing green pulse + "System active · all cameras monitoring"
- "ALERT" state (high-confidence event < 5min old): pulsing amber/red border, "Motion detected on Camera 1" with timestamp, tap to view
- Use existing `useEvents` hook + socket connection state
- Framer Motion `animate` with reduced-motion fallback
- This is THE signature moment — the watchman speaking

### Workstream 3: Chat Presence (45 min)
**File:** `src/views/AskPage.tsx`
- Typing dots exist already → make response appear word-by-word (simulate streaming)
- The response container already renders markdown — add a `StreamingText` component that types out the assistant message progressively
- No backend changes needed — fake streaming with setTimeout chunks on the full response
- Add subtle entrance animation on assistant messages

### Workstream 4: Empty State Art (1 hr)
**Files:** `src/components/ui/EmptyState.tsx`, `src/views/PeoplePage.tsx`, `src/views/EventsPage.tsx`
- Replace generic "No events" / "No people" with composed illustrations using the LogoMark + descriptive copy
- Each empty state should: show the LogoMark at 48px, a clear sentence, and a primary CTA
- Color: `bg-primary/5` surface, `text-muted-foreground` copy

### Workstream 5: Polish Pass (30 min)
- Final critique run → target 32+/40
- Verify all fixes against `DESIGN.md` one last time
- Build, deploy, screenshot comparison (before/after)

---

## Technical Notes

### Build & Deploy Cycle
```
npm run lint && npm run typecheck     # verify
npm run build                          # static export to out/
docker restart sentryvision-app        # recompute CSP hashes
curl -s -o /dev/null -w "%{http_code}" http://localhost:9753/health/ready
```
**IMPORTANT:** The backend container must be restarted after every build. The CSP hash collector scans HTML at startup — stale hashes silently block all client JS.

### Key File Locations
- Design tokens: `src/app/globals.css` (`:root` variables)
- Chart palette: `src/lib/chart-tokens.ts`
- Brand mark: `src/components/brand/Logo.tsx` (NEW — just created)
- Layout container: `src/components/layout/PageContainer.tsx` (1200px)
- Page transitions: `src/components/layout/AppFrame.tsx` (180ms in / 120ms out)
- Navigation: `src/components/layout/Shell.tsx` (bottom dock with LogoMark)
- Settings tabs: `src/views/Settings.tsx` (Account | Monitoring | Data | System)
- Keyboard shortcuts: `src/views/EventsPage.tsx` (j/k/Esc), `src/views/AskPage.tsx` (/)

### Docker Services
```
sentryvision-app      :9753   backend + static frontend
sentryvision-postgres  :5432  database
sentryvision-opencv    :8084  detection pipeline
sentryvision-go2rtc    :1984  RTSP→WebRTC bridge (requires CAM*_RTSP_URL in .env)
```

### Credentials (bootstrap.ts)
- Admin: `barun` / `$SEED_ADMIN_PASSWORD` (in .env)
- User: `user` / `$SEED_USER_PASSWORD` (in .env)

### Impeccable Skills Installed
- `/impeccable` — design skill suite (critique, polish, document, audit, etc.)
- `/redesign-existing-projects` — audit methodology
- `/emil-design-eng` — Kowalski philosophy (transitions, motion, states)
- `/apple-design` — fluid motion principles

### Impeccable Artifacts
- `PRODUCT.md` — product context (auto-generated)
- `DESIGN.md` — visual system spec (created this session)
- `.impeccable/design.json` — sidecar with tonal ramps, components, narrative
- `.impeccable/critique/` — 2 snapshots (27, then 28/40)
