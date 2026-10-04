---
target: frontend-next/src
total_score: 21
max_score: 40
na_heuristics: 
p0_count: 1
p1_count: 2
timestamp: 2026-10-04T13-52-05Z
slug: frontend-next-src
---
Method: dual-agent (Assessment A: isolated design review · Assessment B: isolated detector/browser evidence)

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Live/Offline badges, threat stats, fetch fallbacks solid; route spinners hide content where skeletons should show shape |
| 2 | Match System / Real World | 3 | "Night Watchman" metaphor + domain language (YOLO/pose/confidence) fits self-hoster audience |
| 3 | User Control and Freedom | 2 | Esc works only in camera grid, missing from EventDetailPanel; j/k shortcuts promised but unwired; no undo visible |
| 4 | Consistency and Standards | 2 | transition-all + backdrop-blur spec violations across ~15 files undercut otherwise aligned pills/colors/type |
| 5 | Error Prevention | 2 | Inline validation present; destructive two-click pattern not fully verifiable in code read |
| 6 | Recognition Rather Than Recall | 2 | Status color+labels good, filter state URL-synced; documented shortcuts broken |
| 7 | Flexibility and Efficiency | 1 | No wired j/k/Esc on events, no bulk ops, `/` for Ask unimplemented |
| 8 | Aesthetic and Minimalist Design | 3 | OLED black, hairlines, flat surfaces clean; blur/transition bloat contradicts it |
| 9 | Error Recovery | 3 | Stream retry, fetch fallback text; no undo/redo (dashboard-normal) |
| 10 | Help and Documentation | 2 | ShortcutHelp overlay exists but unmounted/unwired; no tooltips or tour |
| **Total** | | **21/40** | **Acceptable** |

## Design Specificity Verdict

**LLM assessment**: Grounded in this product, not interchangeable. OLED-black "Night Watchman" world, Quiet Indigo restraint, dense threat/verification data (ThreatMatrix, VerificationTimeline, YOLO/face/pose tiers) speak to self-hosted security monitoring. Transparent verification is the product character and it lands. Violations are execution drift (transition-all, backdrop-blur, 100vh, spinners, unwired shortcuts), not identity failure.

**Deterministic scan**: CLI static scan returned 0 findings across frontend-next/src (115 files) — it did not catch the transition-all/backdrop-blur/100vh/spinner patterns the source review found, so treat the CLI pass as a coverage gap, not a clean bill. Live runtime overlay on the running dev server (port 5174) flagged 1 anti-pattern on `dashboard/` only; events, security, analytics, settings clean. Overlays were injected in headless Chrome (title-mutation verified); no user-visible overlay persists in your browser.

## Overall Impression

Strong identity, leaky execution. The world is right and the trust-building verification UI is genuinely good; the single biggest opportunity is making the keyboard contract real — ShortcutHelp promises j/k/Esc that do nothing, which reads as broken, not missing.

## What's Working

1. **Spec fidelity on the big moves**: pill buttons, Quiet Indigo ≤15%, bottom dock, OLED tonal layering, Geist + Geist Mono, hairline border scale. Disciplined language.
2. **Transparent verification**: ThreatMatrix, VerificationTimeline, EventDetailPanel badge tiers (YOLO/face/pose/score_floor) expose AI reasoning — exactly what self-hosters need to trust the system.
3. **Power-user scaffolding (partial)**: Esc in AdaptiveCameraGrid, URL-synced filter/tab state for bookmarking/sharing, ShortcutHelp structure right — needs wiring.

## Priority Issues

### [P0] Keyboard shortcuts promised but unwired
- **What**: ShortcutHelp lists j/k/Esc//; only Esc in camera grid works. Zero j/k// handlers in event/ask flows.
- **Why it matters**: User presses `?`, reads "j = next event", presses j, nothing happens. Feels buggy; breaks power-user trust.
- **Fix**: Wire EventDetailPanel j/k/Esc via useEffect keydown; wire `/` on AskPage; mount ShortcutHelp in Shell; verify in browser.
- **Evidence**: ShortcutHelp.tsx:7-12; AdaptiveCameraGrid.tsx:171 (only Esc); globals.css:38 context.
- **Suggested command**: /impeccable harden

### [P1] Pervasive `transition-all` spec violation
- **What**: ~15 files use `transition-all duration-500` instead of explicit properties.
- **Why it matters**: Banned by DESIGN.md; animates properties that should never move, adds motion overhead, dilutes the machined press-scale feel.
- **Fix**: Replace with `transition-[transform,background-color]` / `transition-[transform,border-color]` per element; button.tsx:9 first (highest blast radius).
- **Evidence**: button.tsx:9, input.tsx, select.tsx, badge.tsx, alert.tsx, card.tsx, toast.tsx, EventDetailPanel.tsx:393/433/668, RelatedEvents.tsx:92, SmartFilters.tsx:346.
- **Suggested command**: /impeccable polish

### [P1] `backdrop-blur` on cards/inputs/dropdowns
- **What**: blur on scrollable content surfaces; spec reserves it for fixed overlays only.
- **Why it matters**: Mobile perf cost, contradicts flat-by-default + tonal-layering depth language.
- **Fix**: Strip blur from card/input/select/badge/dropdown/popover/toast/tooltip; keep only on true modal backdrops.
- **Evidence**: card.tsx:11, input.tsx:12, badge.tsx:13, dropdown-menu.tsx:41/58, popover.tsx:20, select.tsx:68, toast.tsx:31, tooltip.tsx:19, EventDetailPanel.tsx:230/398.
- **Suggested command**: /impeccable polish

### [P2] Route spinners instead of skeletons
- **What**: LoadingRoute/AppFrame/PageLoading use animate-spin Loader2; LoadingSkeleton exists but unused at route level.
- **Why it matters**: Spec bans generic spinners; skeletons preserve layout context during loads.
- **Fix**: Route-context skeletons (event-list, camera-grid shapes) with animate-pulse.
- **Evidence**: LoadingRoute.tsx:8, AppFrame.tsx:14 vs LoadingSkeleton.tsx.
- **Suggested command**: /impeccable polish

### [P2] `100vh` on body (iOS viewport bug)
- **What**: globals.css:38 `min-height: 100vh`; spec requires 100dvh.
- **Why it matters**: iOS Safari keyboard/viewport changes break layout.
- **Fix**: `min-height: 100dvh`.
- **Evidence**: globals.css:38.
- **Suggested command**: /impeccable adapt

## Persona Red Flags

**Alex (impatient power user)**: j/k dead in Events; EventDetailPanel ignores Esc (camera grid honors it — inconsistent); no bulk select/delete on events (EventsPage.tsx).
**Sam (keyboard/screen-reader)**: EventDetailPanel is a div, not role="dialog" aria-modal (EventDetailPanel.tsx:227); spinners lack aria-busy while LoadingSkeleton has role="status" (LoadingRoute.tsx:8 vs LoadingSkeleton.tsx:8-9); focus ring not uniformly applied (globals.css:57-60).
**Priya (self-hoster, phone over LAN, inspectability)**: no bulk export by date range (EventsPage.tsx); camera tiles show live/recording but no bitrate/resolution/lag telemetry (AdaptiveCameraGrid.tsx:84-85); no live perf surface — API latency/frame drops/stream health (LogsPage has logs, no perf UI).

## Minor Observations

- Shell.tsx:27-34 — 6 dock items, borderline vs ≤4-option guidance; acceptable, watch it.
- SmartFilters calendar popover quality high; VerificationTimeline/ThreatMatrix poll (15s/30s) with no update flash.
- ShortcutHelp unmounted — wire or remove; dual app/(app) + app/app route groups need a verdict (LegacyRedirect vs cleanup).
- Degraded-network behavior unverified beyond ThreatMatrix fetch catch; worth one pass.

## Questions to Consider

- Why is ShortcutHelp unmounted — planned or forgotten?
- Are j/k shortcuts discoverable hints or power-user easter eggs?
- Is card blur intentional "float" or drift — if intentional, DESIGN.md needs the amendment?
- Do the legacy app/app/* routes still serve bookmarks/SEO or is it cleanup time?
- Does the dashboard survive connection drops beyond ThreatMatrix's fallback?
