---
target: frontend-next/src
total_score: 32
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 0
timestamp: 2026-09-25T15-45-00Z
slug: frontend-next-src
---
# Critique — SentryVision frontend (session 2: ThreatBanner, login brand moment, streaming chat, empty-state art)

⚠️ DEGRADED: single-context (Assessment A ran inline — subagent spawn failed on a classifier outage; Assessment B ran isolated as a subagent)

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | ThreatBanner "3m ago" freezes between renders |
| 2 | Match System / Real World | 4 | Watchman voice lands |
| 3 | User Control and Freedom | 3 | Alert banner can't be acknowledged |
| 4 | Consistency and Standards | 4 | One Title-Case outlier in empty-state copy |
| 5 | Error Prevention | 3 | Two-click destructive confirms |
| 6 | Recognition Rather Than Recall | 3 | Mobile dock icon-only below sm |
| 7 | Flexibility and Efficiency | 3 | j/k/Esc// exist but undiscoverable |
| 8 | Aesthetic and Minimalist Design | 4 | Restraint holds; accent budget respected |
| 9 | Error Recovery | 3 | Plain-language errors, retry CTAs |
| 10 | Help and Documentation | 2 | Tooltips + empty-state copy only |
| **Total** | | **32/40** | **Good** |

na_heuristics: none (all 10 scored)

## Design Specificity Verdict

Authored, not category-interchangeable. ThreatBanner strongest proof: breathing 3px emerald left bar + hairline border extends existing border vocabulary; "ALL CLEAR / System active" is the watchman speaking. LogoMark closes favicon → login → empty states. Streaming chat is engineered delight with an exit ramp. Weakest: empty states reuse the mark verbatim in error states too.

Deterministic scan: 1 finding — bounce-easing AskPage.tsx:433-435 (animate-bounce typing dots). True positive, low severity, one-class swap. Browser: /login renders clean, zero console errors, CSP does not block DOM injection.

## Overall Impression

Session 2 bought real soul: face (mark), voice (banner), pulse (streaming). Biggest gap: time-awareness — a dashboard whose "45s ago" lies between renders undermines watchman trust.

## What's Working

1. ThreatBanner anatomy — one component, two states, shared skeleton; +N badge and tap-to-events make alerts actionable.
2. Streaming with consent — randomized cadence, evidence deferred until stream completes, click/Enter skip, reduced-motion instant.
3. Brand closure — shield-eye mark at 48px in bg-primary/5; favicon matches; login is a brand moment.

## Priority Issues

1. [P2] ThreatBanner time freezes — Date.now() per render; stale "45s ago", alert lingers past 5-min window. Fix: 15-30s interval tick. → /impeccable polish
2. [P2] Mobile dock icon-only — shortLabel defined but not rendered below sm. Fix: render shortLabel at 9-10px. → /impeccable polish
3. [P2] Typing dots bounce — animate-bounce contradicts custom-easing system. Fix: ease-out pulse keyframe. → /impeccable polish
4. [P3] Empty-state copy drift — Title Case vs sentence case; error state shares celebratory mark. → /impeccable clarify
5. [P3] Alert banner no acknowledge — pulsing until window expires; no silence. Fix: dismiss-to-dot or auto-downgrade. → /impeccable shape

## Persona Red Flags

Alex (Power User): shortcuts invisible — no cheat-sheet; streaming not globally disableable.
Sam (Accessibility): strong aria/reduced-motion; "View →" is 10px; title-only skip hint invisible to SR mid-stream.
Casey (Mobile): dock thumb-zone good; banner top-of-screen reach; ~40px tap target under 44px ideal; history interruption-safe.

## Minor Observations

- animate-alert-border animates box-shadow — use border-color/opacity.
- All-clear "N events logged" meaningless at scale; keep "latest Xm ago" only.
- getRelativeTime duplicated (ThreatBanner + old SystemPulse pattern) — extract lib/relative-time.ts.

## Questions to Consider

- ALL CLEAR as ambient canvas temperature instead of a strip?
- Proactive anomaly banners (3 alerts/hour) instead of static threshold?
- Pupil-tracks-scroll wink on empty states?
