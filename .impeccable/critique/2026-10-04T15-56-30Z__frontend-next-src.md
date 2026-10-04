---
target: frontend-next/src
total_score: 25
max_score: 40
na_heuristics: 
p0_count: 3
p1_count: 2
timestamp: 2026-10-04T15-56-30Z
slug: frontend-next-src
---
Method: dual-agent (Assessment A: isolated design review · Assessment B: isolated detector/browser evidence)

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of system status | 2 | Hero ALL CLEAR/ALERT banner coded but never mounted; VerificationTimeline/ActiveVisitors silent-fail; ThreatMatrix hardcodes animal/motion to 0 |
| 2 | Match system / real world | 3 | Watchman voice strong; raw tier names (yolo_high/Score floor) leak; IST timezone hardcoded |
| 3 | User control and freedom | 2 | Delete = window.confirm, no undo; Ask clear uses proper two-click |
| 4 | Consistency and standards | 2 | Radius/shadow/motion token drift; duration-500 vs spec 150ms; native select on register vs Select component |
| 5 | Error prevention | 3 | URL-persisted filters; honest empty copy; failed→null not 0 |
| 6 | Recognition over recall | 3 | ? overlay, title attrs, Ask suggestions, shaped skeletons |
| 7 | Flexibility and efficiency | 3 | j/k/Esc// wired, slideshow, URL state; no bulk actions; data panel xl-only |
| 8 | Aesthetic and minimalist | 2 | AI panel gradient/glow/emoji + glass badges break Night Watchman restraint |
| 9 | Error recovery | 3 | RouteError try-again + "data unchanged"; undercut by silent live-panel fails |
| 10 | Help and documentation | 2 | ShortcutHelp documents a banner that does not render |
| **Total** | | **25/40** | **Acceptable** |

## Design Specificity Verdict

**LLM assessment**: Domain language is product-specific — verification tiers (yolo_high/face/pose), ThreatMatrix, ALL CLEAR/ALERT watchman voice. Not category-interchangeable. But specificity is undermined by: undefined motion tokens, stock shadcn overlay styling, and a maximalist AI-analysis panel that ignores the committed world.

**Deterministic scan**: CLI static scan 0 findings (exit 0). Live runtime scan on :5174 (5 pages, injection verified): 1 rule — `pulsing-dot` (animate-pulse on tiny rounded-full element), 2 instances per page, nearest source `EventDetailPanel.tsx:837` (`w-1 h-1 animate-pulse-soft` — which is also an undefined animation class). Skeleton-scale animate-pulse blocks are intentional and not flagged. 404 resource errors on every page = unauthenticated API calls, expected without a session.

## Overall Impression

The fix pass landed (keyboard contract real, blur/transition/100vh drift stripped, skeletons in place — score 21→25). What remains is a different class of problem: the design system's own plumbing. Motion tokens are referenced but never defined, the product's hero reassurance moment (ThreatBanner) is coded but never mounted, and the peak surface (AI analysis) is the most off-brand screen in the app. Biggest opportunity: make the Night Watchman actually speak — mount the banner, define the motion system, bring the AI panel through the rules.

## What's Working

1. **Security-honest status language**: ThreatMatrix failed→null→"--" + "live data unavailable"; "This is not the same as no events" empty copy. Rare honesty in this category.
2. **Verification inspectability**: event detail panel exposes method, pose keypoints, face flag, check latency in Geist Mono tabular-nums — exactly the Frigate/HA persona's trust need.
3. **Skeletons + reduced motion**: route skeletons shaped to content; reduced-motion respected across AppFrame/Shell/SectionWorkspace; ? overlay well-written.

## Priority Issues

### [P0] Undefined motion system
- **What**: `ease-spring`, `ease-smooth`, `animate-pulse-soft`, `animate-breathing-glow`, `animate-alert-border`, `relatedFadeIn` used across button/input/badge/alert/toast/ThreatBanner/ShortcutHelp but never defined in tailwind.config.ts or globals.css. Controls fall back to 500ms default easing, not DESIGN.md's 150ms machined ease-out.
- **Why**: The "immediate response" feel is silently absent; ThreatBanner's breathing/alert pulses are no-ops.
- **Fix**: Define `transitionTimingFunction` + keyframes in tailwind.config.ts; controls to `duration-150 ease-[cubic-bezier(0.23,1,0.32,1)]`.
- **Evidence**: button.tsx:9, input.tsx:12, badge.tsx:8, alert.tsx:8, toast.tsx:27, ThreatBanner.tsx:62-105, ShortcutHelp.tsx:52.
- **Suggested command**: /impeccable polish

### [P0] ThreatBanner never mounted + help copy lies
- **What**: `components/dashboard/ThreatBanner.tsx` (ALL CLEAR/ALERT hero) has zero imports; ShortcutHelp.tsx:77-79 tells users to look for a banner that doesn't render.
- **Why**: The product's stated emotional identity at rest is missing; help actively misleads.
- **Fix**: Mount ThreatBanner above the camera grid, or delete it and rewrite the help copy.
- **Evidence**: ThreatBanner.tsx (unimported), StreamDashboard.tsx:44-53, ShortcutHelp.tsx:77-79.
- **Suggested command**: /impeccable polish

### [P0] ThreatMatrix fake zeros
- **What**: animals/motion counts hardcoded 0 (ThreatMatrix.tsx:38) while persons/vehicles implement failed→null→"--".
- **Why**: Security dashboard showing "ANIMAL 0" when the data was never fetched is the silent-success class the earlier audit flagged.
- **Fix**: Render "--"/"not tracked" for unimplemented types, or fetch them.
- **Suggested command**: /impeccable harden

### [P1] Token drift on shape/depth
- **What**: Card `rounded-[4px]`+bezel vs 8px spec; `rounded-[1.25rem]`/`[0.875rem]` off-scale on StatCard/EventDetail/Related/overlays; popovers/dropdowns/toasts `bg-black/90 backdrop-blur-3xl shadow-lg` vs solid #121215 no-shadow; login card shadow-lg.
- **Fix**: Single radius scale (4/8/12/16/pill); solid popover surface #121215; shadows only focus-glow + modal backdrop.
- **Evidence**: card.tsx:11, StatCard.tsx:26, popover.tsx:20, dropdown-menu.tsx:41/58, tooltip.tsx:19, select.tsx:68, toast.tsx:27, LoginPage.tsx:138.
- **Suggested command**: /impeccable polish

### [P1] AI analysis panel breaks the world
- **What**: Gradient bezel, colored glow shadows, emoji entity chips, blue/purple fills; three disagreeing detection color maps (panel/related/chart-tokens), none matching design-tokens.ts.
- **Fix**: Map detection colors through design-tokens.ts; hairline bezel replaces gradient+glow; lucide icons replace emoji; accent confined to interactive/status.
- **Evidence**: EventDetailPanel.tsx:233-244, 349, 368-388, 444-473, 586-805; RelatedEvents.tsx:10-19; chart-tokens.ts:45-51.
- **Suggested command**: /impeccable polish

## Persona Red Flags

**Alex (power)**: No bulk select/delete on events; calendar silently overrides quickRange while Select still reads "All Time" (SmartFilters.tsx:126-141); data panel gated by xl viewport, not preference.
**Sam (keyboard/SR)**: SystemStatus pill is an empty span — color dot only, no accessible text (Shell.tsx:42-56); EventDetailPanel dialog lacks focus trap/scrim; RelatedEvents are div onClick — no tabIndex, no keyboard (RelatedEvents.tsx:90-96); help copy promises nonexistent banner; toast close is hover-reveal opacity-0.
**Priya (self-hoster, phone over LAN)**: Live data panel (ThreatMatrix/VerificationTimeline/ActiveVisitors) is `xl:block` only — on phone she can never see it (StreamDashboard.tsx:103); ThreatMatrix fake zeros undermine the one glance metric; VerificationTimeline/ActiveVisitors silent-fail empty; IST-hardcoded boundaries break non-IST hosts (SmartFilters.tsx:49-58).

## Minor Observations

- Dock: 6 equal items vs spec "5 + gear"; labels 9px below sm.
- active:scale-[0.98] on StreamDashboard vs 0.97 spec; dock lacks press scale.
- SmartFilters Select triggers override input spec (bg 0.04/border 0.10 vs 0.06/0.16).
- formatConfidence `value < 0.5 → '< 1%'` misleading for 0.5-0.99 inputs.
- LoginPage register TabsList grid-cols-2 with conditional second tab → layout shift.
- Clock hidden below xl — status time invisible on most laptops.
- Badge `glass` variant is a first-class token despite zero-glassmorphism rule.
- lightTokens alias dark tokens — light theme token set is single-theme.
- RouteError rounded-lg + rounded button vs pill rule; RelatedEvents badges text-[8px] below 9px floor.
- AskPage pending Loader2 spinner (chat typing indicator — borderline acceptable).

## Questions to Consider

- What is SentryVision's emotional identity on the 90% of days nothing happens — the Watchman never speaks?
- Is duration-500 + default easing an intentional "calm" choice, or did the motion system get deleted while class names stayed?
- For "your data, your rules" users: why IST-hardcoded boundaries and an xl-gated data panel?
- Is a partially-honest metric (ANIMAL 0) better than no metric in a security product?
- Should the AI panel bend the system to the content (new tokens) or be forced through the Watchman rules?
