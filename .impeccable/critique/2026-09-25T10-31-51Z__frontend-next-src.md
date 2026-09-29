---
target: frontend-next/src
total_score: 27
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 2
timestamp: 2026-09-25T10-31-51Z
slug: frontend-next-src
---
## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Live/offline pill, camera grid status — solid. Loading spinners are generic lucide circles, not skeleton loaders. |
| 2 | Match System / Real World | 3 | Good for technical hobbyists. "YOLO ≥ 0.90" / "MOG2" jargon unexplained. |
| 3 | User Control and Freedom | 4 | Back buttons everywhere, URL-param state, two-click destructive confirmations. |
| 4 | Consistency and Standards | 2 | Hard-coded hex across 7 files duplicates tokens; backdrop-blur used despite "solid surfaces" rule; 2 competing radius scales. |
| 5 | Error Prevention | 3 | Zod validation, password confirm, MFA verify-then-enable flow. |
| 6 | Recognition Rather Than Recall | 3 | Labeled nav, Ask suggestion chips, Events filters. Good. |
| 7 | Flexibility and Efficiency | 2 | No keyboard shortcuts, no bulk actions, no customizable layout. Settings is a single massive scroll. |
| 8 | Aesthetic and Minimalist Design | 3 | Cohesive dark system, purposeful accent. Settings page is the one place hierarchy collapses. |
| 9 | Error Recovery | 3 | Inline validation, state preserved through URL params. No undo for archive/delete. |
| 10 | Help and Documentation | 1 | Zero contextual help. No tooltips on detection settings, no MFA explanation, no "what is quiet hours" inline. |

**Total: 27/40 — Acceptable.**

## Design Specificity Verdict

Partly authored, partly category-interchangeable. The Night Watchman concept — OLED black, tonal surface layering, Geist type, bottom dock with sliding indicator — is genuinely distinctive. The concentric bezel pattern, the pill-button signature, the border-scale depth language: none of that is generic. But Settings is a stock form page, Ask is a standard chat UI, EventsPage is a standard card grid — these pages could ship in any SaaS dashboard.

Deterministic scan: 28 hard-coded hex values across 7 files, 7+ transition-all instances, 15+ backdrop-blur uses, 1 card shadow, ~85 inconsistent radius authorings, 2 icon-only buttons missing aria-label, 1 h-screen, 2 press-scale mismatches.

## Overall Impression

The navigation shell is excellent — the bottom dock with its sliding indicator is genuinely pleasant to use. The dark tonal system works. But the interior pages haven't been elevated to match. Settings is the biggest miss: single scrollable form, 7 sections, equal visual weight everywhere. Token violations create subtle incoherence.

## What's Working

1. The bottom dock — sliding indicator with spring physics, labeled icons, system status pill. Best UI element.
2. Concentric bezel containers — 1px inset highlight creates machined-hardware feel without shadows.
3. Two-click destructive confirmations — button changes to destructive variant on first click. No window.confirm().

## Priority Issues

**P1: StreamDashboard token violations** — 7 hard-coded hexes duplicating existing tokens (bg-[#050505], bg-[#0A0A0B], text-[#6B6B73], bg-[#121215], text-[#A1A1A8], text-[#ECECEC], text-[#AEB7F2]). Fix: replace each with token equivalent. Command: /impeccable polish

**P1: Backdrop-blur contradicts design system** — 15+ uses across dropdown-menu, select, toast, tooltip, badge, outline button despite "solid surfaces only" rule. Fix: remove backdrop-blur from all UI primitives. Command: /impeccable polish

**P2: Settings page no progressive disclosure** — 7 sections stacked vertically, equal weight, no collapsible sections. Fix: tabbed layout using SectionWorkspace pattern. Command: /impeccable layout

**P2: Fragmented radius scale** — rounded-[0.5rem] x25, rounded-[0.75rem] x22, rounded-[4px] x8, rounded-[3px] x3, alongside rounded-lg/rounded-md. Fix: standardize on 4px controls / 8px cards / 12px popovers / full pills. Command: /impeccable polish

**P2: Zero contextual help** — Detection settings, MFA setup, quiet hours, retention policies all unexplained. Fix: tooltips or info icons with 1-line explanations. Command: /impeccable clarify

**P3: 2 icon-only buttons missing aria-label on mobile** — StreamDashboard slideshow/data toggle. Fix: add aria-label. Command: /impeccable audit

**P3: Press-scale mismatch** — StreamDashboard uses active:scale-[0.98], Button uses 0.97. Fix: standardize on 0.97. Command: /impeccable polish

## Persona Red Flags

Alex (Power User): No keyboard shortcuts, Settings scroll marathon, EventsPage lacks keyboard cycling
Sam (Accessibility): StreamDashboard icon-only buttons no aria-label, EventDetailPanel missing ARIA roles, color-only status indicators
Casey (Mobile): Settings 2000px scroll, Ask chips push input below fold, Data panel causes layout reflow

## Minor Observations

1. InsightsPage chart hexes diverge from design system status colors
2. globals.css body min-height: 100vh should be 100dvh
3. LoginPage auth card shadow-lg violates flat-surface rule
4. bezel utility hard-codes #0a0a0b instead of var(--card)

## Questions to Consider

1. Does Settings need to be one long page? Tabbed layout matches existing SectionWorkspace pattern.
2. What if backdrop-blur was removed from every shadcn primitive in one pass?
3. What if detection settings had inline explanations?
