---
target: frontend-next/src
total_score: 28
max_score: 40
na_heuristics: 
p0_count: 1
p1_count: 1
timestamp: 2026-09-25T10-50-52Z
slug: frontend-next-src
---
## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|:-----:|-----------|
| 1 | Visibility of System Status | 3 | Live/Offline badge clear; the 1px dock status dot is too small to notice during an outage. |
| 2 | Match System / Real World | 3 | Plain language mostly; "YOLO ≥ 0.90", "Pose skeleton" jargon exposed at 2am moments. |
| 3 | User Control and Freedom | 4 | Back, close, reset, confirm-to-delete. Excellent. |
| 4 | Consistency and Standards | 3 | Component library consistent — token cleanup landed. Switch vs Button toggles mixed in Settings; native select on register form. |
| 5 | Error Prevention | 4 | Zod everywhere, MFA confirm-with-timeout. Excellent. |
| 6 | Recognition Rather Than Recall | 3 | Dock nav recognizable; no "N new events since you last checked" badge. |
| 7 | Flexibility and Efficiency | 1 | Zero keyboard shortcuts. No j/k, no Esc-close, no /-focus, no dock numbers. |
| 8 | Aesthetic and Minimalist Design | 2 | Components beautiful; Settings (~1100 lines, 7 sections, 15+ toggles) and EventDetailPanel AI card visually loud. |
| 9 | Error Recovery | 4 | Toasts with detail, inline errors, state preserved. Excellent. |
| 10 | Help and Documentation | 1 | Zero tooltips, zero inline help, zero shortcut hints. |

**Total: 28/40 — Acceptable (was 27).** +1 from the token cleanup pass.

## Design Specificity Verdict

7/10 — Mostly authored. Strong identity in chrome and interaction model; goes generic in content pages. Authored: bottom dock with sliding indigo indicator, machined p-[1px] + inset-highlight vocabulary, uniform active:scale-[0.97], border-scale depth language. Generic: EventDetailPanel blue-purple AI gradient ("most AI-SaaS element in the codebase"), Settings rainbow notification icons, standard AI-chat empty state on Ask.

Deterministic scan (B): All fix claims verified landed — hex→tokens in all 6 named files, backdrop-blur zeroed in ui/, h-screen gone. One regression: toast.tsx:27 still carries transition-all duration-500 ease-spring. Remaining cluster: 20 raw rounded-[0.5rem]/[0.75rem] values, 3 glow shadows + 1 blue-purple gradient in EventDetailPanel, 1 dead backdrop-blur-none in SectionWorkspace. Detector CLI confirmed dead tooling.

## Overall Impression

The cleanup pass worked — the codebase now follows its own design system almost everywhere. What remains is structural: Settings' information architecture is the single ceiling on both the aesthetic score and cognitive load. The complete absence of keyboard support is the loudest gap for this audience. The EventDetailPanel AI gradient is the last major identity leak.

## What's Working

1. The machined component vocabulary — p-[1px] shells + inset highlights + uniform press scale. Strongest asset.
2. Error recovery and destructive-action safety — Zod validation, confirm-with-4s-timeout on MFA disable, descriptive toasts.
3. Motion calibration — 180ms enter / 120ms exit, spring dock indicator, useReducedMotion respected throughout.

## Priority Issues

**P0: Settings page information architecture** — 7 sections, ~1100 lines, one scroll; Security buried at bottom. Fix: restructure into SectionWorkspace tabs (Account | Monitoring | Data | System). Command: /impeccable layout

**P1: Zero keyboard shortcuts** — no j/k, no Esc-close, no /-focus, no dock numbers. Target audience is keyboard-first; competitors all have shortcuts. Fix: Esc-close + j/k + / via raw useEffect keydown handlers.

**P2: EventDetailPanel AI gradient + glow** — line 559 blue-purple gradient + glow shadow; Analyze button blue glow; hard-coded off-token. Fix: standard machined pattern; button → bg-primary/30 with token glow. Command: /impeccable polish

**P3: Verification tier jargon** — "YOLO ≥ 0.90" badges expose ML internals. Fix: map to user language with tooltip detail. Command: /impeccable clarify

**P3: Residual token debt** — toast.tsx:27 transition-all regression; 20 raw radius values; dead backdrop-blur-none. Fix: mechanical swaps. Command: /impeccable polish

## Persona Red Flags

Alex (power user): Tab through 48 event cards to reach one; no arrow-key nav; no faster path than mouse.
Sam (accessibility): Hears "YOLO ≥ 0.90" unexplained; bounding boxes have no programmatic relation to image for screen readers.
Casey (mobile): EventDetailPanel close button top-right thumb-stretch, prev/next adjacent to close; Settings scroll marathon; Ask transcript/clear buttons mis-tap risk.

## Minor Observations

- Native select on register form breaks machined styling (LoginPage:219)
- Clock hidden below xl for a security dashboard (Shell:68)
- "3 persons" should be "3 people" (EventsPage:395)
- Settings mixes immediate-apply and manual-save controls
- Ask auto-scroll smooth behavior fights reading earlier messages

## Questions to Consider

1. If the AI Analysis section removed its gradient and glow, would you still know it's the premium feature? The Night Watchman doesn't wear a cape.
2. At 2am, should the Analyze button exist, or should high-confidence detections auto-analyze?
3. Is the 6-item dock forcing Settings to be a mega-page?
