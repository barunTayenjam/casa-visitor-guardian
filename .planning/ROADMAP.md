# Roadmap: SentryVision Home Security System

**Created:** 2026-03-18
**Updated:** 2026-04-18
**Granularity:** Coarse

## Milestones

- ✅ **v1.0 Resource Optimization** — Phases 1-6 (shipped 2026-03-23)

---

## Phase Summary

| # | Phase | Goal | Requirements | Success Criteria |
|---|-------|------|--------------|------------------|
| 1 | Detection Quality | Reduce false positives, improve motion detection accuracy | DET-01 to DET-05 | 5 |
| 2 | Notifications & Events | Add push notifications and event search/filtering | NOTF-01 to NOTF-05, EVNT-01 to EVNT-06 | 11 |
| 3 | Face Recognition | Improve face matching accuracy and management | FACE-01 to FACE-05 | 5 |
| 4 | Storage Management | Implement retention policies and cleanup | STOR-01 to STOR-05 | 5 |
| 5 | Frontend Enhancement | Review and fix all frontend pages | FE-01 to FE-06 | 6 |
| 6 | Resource Optimization | Optimize system resource usage | RO-01 to RO-05 | 5 |
| 7 | Security Improvements | Fix critical vulnerabilities | SEC-01 to SEC-03 | 3 |
| 8 | UI/UX Improvements | User experience enhancement | UX-01 to UX-06 | 6 |
| 9 | Streaming UI Simplification | Reduce overlay clutter | SUI-01 to SUI-03 | 3 |
| 10 | Navigation & UI/UX Consistency | Unified app-wide experience | NAV-01 to NAV-04 | 4 |
| 11 | Tech Debt Reduction | 5/7 | In Progress|  |

---

## Phase 1: Detection Quality ✅ Complete (2026-03-18)

**Goal:** Reduce false positives from motion detection, improve accuracy

**Requirements:** DET-01, DET-02, DET-03, DET-04, DET-05

**Success Criteria:**
1. Motion events reduce by >50% without missing real detections
2. Shadows and small movements (insects, leaves) no longer trigger events
3. Night mode sensitivity works correctly (22:00-06:00)
4. Detection latency remains under 1 second
5. Multi-frame validation confirmed working in production

**Plans:**
- **Plan 1.1:** Implement multi-frame validation — require 2-3 consecutive motion frames before triggering event
- **Plan 1.2:** Add preprocessing pipeline — Gaussian blur, morphological operations, contour filtering
- **Plan 1.3:** Implement adaptive thresholds — time-of-day sensitivity, minimum contour area

---

## Phase 2: Notifications & Events ✅ Complete (2026-03-19)

**Goal:** Real-time push notifications and powerful event search/filtering

**Requirements:** NOTF-01, NOTF-02, NOTF-03, NOTF-04, NOTF-05, EVNT-01, EVNT-02, EVNT-03, EVNT-04, EVNT-05, EVNT-06

**Success Criteria:**
1. Browser push notification received within 3 seconds of detection
2. User can enable/disable notifications per event type
3. Quiet hours prevent notifications during set times
4. Event search returns results in under 1 second
5. Filters work correctly: date, camera, type, confidence, face status
6. Pagination works correctly with configurable page size

**Plans:**
- **Plan 2.1:** Implement Web Push API — browser notification service in backend
- **Plan 2.2:** Build notification preferences UI — per-type toggle, quiet hours
- **Plan 2.3:** Add event search API — date range, camera, type, confidence filters
- **Plan 2.4:** Build event filters UI — search bar, filter dropdowns, pagination

---

## Phase 3: Face Recognition ✅ Complete (2026-03-19)

**Goal:** Improve face matching accuracy and management UX

**Requirements:** FACE-01, FACE-02, FACE-03, FACE-04, FACE-05

**Success Criteria:**
1. Known visitors recognized correctly >90% of the time
2. Face embeddings stored with quality metadata
3. User can add visitor from event image with one click
4. Unknown faces correctly identified when no match above threshold
5. Face comparison uses cosine similarity with configurable threshold

**Plans:**
- **Plan 3.1:** Enhance embedding storage — add quality metadata, indexing
- **Plan 3.2:** Improve comparison algorithm — cosine similarity, configurable threshold
- **Plan 3.3:** Add visitor management UI — add from event, update name/photo
- **Plan 3.4:** Implement unknown face handling — proper marking and alerts

---

## Phase 4: Storage Management ✅ Complete (2026-03-18)

**Goal:** Implement retention policies and automated cleanup

**Requirements:** STOR-01, STOR-02, STOR-03, STOR-04, STOR-05

**Success Criteria:**
1. Retention policy configurable per data type (events, images, videos)
2. Old data automatically deleted without affecting detection
3. Storage dashboard shows current usage per type
4. Cleanup runs on schedule (daily at 3 AM)
5. Database records cleaned up when files deleted (referential integrity)

**Plans:**
- **Plan 4.1:** Define retention policy schema — configurable periods per type
- **Plan 4.2:** Build cleanup service — scheduled deletion, respects policy
- **Plan 4.3:** Create storage dashboard — usage stats, cleanup history
- **Plan 4.4:** Database cleanup — foreign key cleanup, vacuum schedule

---

## Phase 5: Frontend Enhancement ✅ Complete (2026-03-19)

**Goal:** Review and fix all frontend pages and their functionality

**Requirements:** FE-01, FE-02, FE-03, FE-04, FE-05, FE-06

---

## Phase 6: Resource Optimization ✅ Complete (2026-03-19)

**Goal:** Optimize system resource usage for constrained deployments

**Requirements:** RO-01, RO-02, RO-03, RO-04, RO-05

**Success Criteria:**
1. Resource baseline documented with current usage metrics
2. FFmpeg optimization reduces CPU/memory consumption by ~50%
3. Docker resource limits prevent system overload
4. Stream-on-demand reduces idle resource usage
5. Low-resource mode enables deployment on 1 CPU, 2GB systems

**Plans:**
- **Plan 6.1:** Resource Audit & Analysis — Document current resource usage and establish optimization baseline
- **Plan 6.2:** FFmpeg Process Optimization — Reduce threads, FPS, and resolution
- **Plan 6.3:** Docker Resource Limits — Add CPU/memory limits to all containers
- **Plan 6.4:** Stream-on-Demand — Implement inactivity timeout for idle streams
- **Plan 6.5:** Configuration & UI — Add LOW_RESOURCE_MODE configuration options

**Success Criteria:**
1. ✅ Batch Detection page works correctly with proper API integration
2. ✅ Day Highlights feature displays accurate event summaries
3. ✅ Events page has proper filtering, pagination, and performance
4. ⏭️ Gallery page - Deferred (feature not implemented)
5. ✅ Settings page saves and loads preferences correctly
6. ✅ Dashboard displays real-time data without freezing

**Plans:**
- **Plan 5.1:** ✅ Batch Detection Review & Fixes — retry logic, progress indicators, cancel button
- **Plan 5.2:** ✅ Day Highlights Review & Fixes — keyboard shortcuts, category filters
- **Plan 5.3:** ✅ Events Page Review & Fixes — bulk selection, export, keyboard nav
- **Plan 5.4:** ⏭️ Gallery Page — Deferred (feature not currently implemented)
- **Plan 5.5:** ✅ Settings Page — Verified existing implementation
- **Plan 5.6:** ✅ Dashboard Review & Fixes — Socket.io transport fix

---

## Requirement Coverage

| Phase | Requirements | Count |
|-------|-------------|-------|
| Phase 1 | DET-01, DET-02, DET-03, DET-04, DET-05 | 5 |
| Phase 2 | NOTF-01, NOTF-02, NOTF-03, NOTF-04, NOTF-05, EVNT-01, EVNT-02, EVNT-03, EVNT-04, EVNT-05, EVNT-06 | 11 |
| Phase 3 | FACE-01, FACE-02, FACE-03, FACE-04, FACE-05 | 5 |
| Phase 4 | STOR-01, STOR-02, STOR-03, STOR-04, STOR-05 | 5 |
| Phase 5 | FE-01, FE-02, FE-03, FE-04, FE-05, FE-06 | 6 |
| **Total** | | **31** |

**Coverage:** 31/31 requirements mapped ✓

### Phase 7: Security Improvements — Fix critical vulnerabilities ✅ Complete (2026-03-26)

**Goal:** Fix RTSP credential exposure, rate limiting, and input validation issues

**Success Criteria:**
1. RTSP credentials encrypted at rest
2. Rate limiting prevents abuse
3. All API inputs validated

**Plans:** 1/1 complete

### Phase 8: UI/UX Improvements — User experience enhancement ✅ Complete (2026-03-26)

**Goal:** Enhance user experience to match industry standards

**Requirements:**
- UX-01: Severity-based motion alerts
- UX-02: Stream quality indicators
- UX-03: Mobile touch optimization ✅
- UX-04: Progressive loading states
- UX-05: Dark mode support
- UX-06: WCAG AA accessibility

**Success Criteria:**
1. Users assess system status in < 3 seconds
2. Mobile task completion > 90%
3. Accessibility score > 95%
4. Dark mode respects system preference

**Plans:** 6/6 complete

- **Plan 8.1:** ✅ Severity-Based Motion Alerts — Progressive disclosure by threat level
- **Plan 8.2:** ✅ Stream Quality Indicators — Real-time health metrics
- **Plan 8.3:** ✅ Mobile Touch Target Optimization — 44x44px minimum, thumb zone controls, swipe gestures
- **Plan 8.4:** ✅ Progressive Loading States — Skeleton screens, thumbnails
- **Plan 8.5:** ✅ Dark Mode Implementation — System-aware with manual override
- **Plan 8.6:** ✅ WCAG AA Accessibility — ARIA labels, keyboard nav, focus indicators

### Phase 9: Streaming UI Simplification — Reduce overlay clutter ✅ Complete (2026-03-27)

**Goal:** Simplify streaming interface to just camera name + status, all info in tap-to-toggle panel

**Requirements:**
- SUI-01: Reduce visible overlays to camera name + connection status dot only
- SUI-02: Tap-to-toggle slide-up panel for all hidden info (alerts, quality, controls)
- SUI-03: Swipe left/right camera switching with smooth transitions

**Success Criteria:**
1. Stream view shows only video + camera name + status dot by default
2. Single tap reveals slide-up panel with all info and controls
3. Swipe gestures switch cameras with smooth transition
4. No visual clutter or competing overlays

**Plans:** 4/4 complete

### Phase 10: App-Wide Navigation and UI/UX Consistency — Unified experience 📋 Planning (2026-03-27)

**Goal:** Ensure consistent navigation patterns, visual design language, and UX patterns across all pages — not just the streaming interface.

**Why:** Phase 9 simplified the streaming view, but the rest of the app (Dashboard, Events, Visitors, Analytics, Settings) may have inconsistent navigation, layout patterns, and visual hierarchy. This phase audits and unifies the experience.

**Requirements:**
- NAV-01: Consistent page navigation (sidebar/header/bottom bar — one pattern)
- NAV-02: Consistent layout structure across all pages (header, content, actions)
- NAV-03: Consistent component styling (buttons, cards, forms, lists)
- NAV-04: Smooth page transitions and loading states

**Success Criteria:**
1. All pages follow the same navigation pattern
2. Visual language is consistent (spacing, typography, colors)
3. Page transitions feel smooth and predictable
4. No jarring layout shifts between pages

**Depends on:** Phase 9
**Plans:** 4/1 plans complete

Plans:
- [x] TBD (run /gsd:plan-phase 10 to break down) (completed 2026-03-27)

### Phase 11: Tech Debt Reduction — Codebase hardening and maintainability

**Goal:** Reduce technical debt by breaking up god files, fixing known bugs, improving security posture, and establishing test coverage for critical paths.

**Success Criteria:**
1. God files split into domain-specific modules
2. All known bugs resolved (storage usage, cache cleanup, SQL syntax)
3. Authentication added to all sensitive API routes
4. Core detection pipeline has unit test coverage
5. Codebase cleanup complete (renamed files, removed artifacts)

**Depends on:** Phase 10
**Requirements:** TD-01, TD-02, TD-03, TD-04, TD-05
**Plans:** 5/7 plans executed

Plans:
- [x] 11-01 — Quick Wins & Cleanup — Rename .new.tsx files, remove .disabled models, remove node-env/, remove debug endpoints, re-enable DB logging
- [x] 11-02 — Known Bug Fixes — Fix storage usage calculation, SQL cache syntax, re-enable cache cleanup, implement detection overlays
- [x] 11-03 — Security Hardening — Add auth to unauthenticated routes, fix path traversal, remove hardcoded secrets and IPs
- [x] 11-04 — Service Registry — Replace (global as any) with typed ServiceRegistry class
- [x] 11-05 — Backend God File Split — Extract routes from index.ts into domain-specific modules, move inline routes
- [x] 11-06 — Frontend ApiService Split — Split 3,208-line ApiService into domain-specific service modules
- [x] 11-07 — Test Coverage Foundation — Unit tests for detection utilities, config loading, state service, logger

---
*Roadmap created: 2026-03-18*
*Last updated: 2026-05-15 - Phase 11 added (tech debt reduction)*
