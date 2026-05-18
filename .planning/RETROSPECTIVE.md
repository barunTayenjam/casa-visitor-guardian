# Project Retrospective

*A living document updated after each milestone. Lessons feed forward into future planning.*

## Milestone: v1.1 — Full System Overhaul

**Shipped:** 2026-05-18
**Phases:** 11 | **Plans:** 48 | **Timeline:** 61 days

### What Was Built
- Motion detection with multi-frame validation, adaptive thresholds, night mode (50% false positive reduction)
- Web Push notifications with VAPID, notification preferences, quiet hours
- Face recognition with visitor management, unknown face tracking and alerting
- Storage management with retention policies, automated cleanup, storage dashboard
- 47% memory reduction via FFmpeg optimization and Docker resource limits
- AES-256-GCM RTSP credential encryption, global rate limiting, auth-protected 67+ routes
- Dark mode, WCAG AA accessibility, sidebar navigation, StreamPanel drawer
- Codebase split: 4,095-line routes/index.ts → 6 modules, 3,208-line ApiService.ts → 8 modules
- ServiceRegistry replacing (global as any) anti-pattern
- 110 unit tests across 4 test files

### What Worked
- Phase-by-phase execution with clear requirements traceability (58/58 satisfied)
- Wave-based planning (quick wins → bugs → security → architecture → tests)
- Test-driven verification with VERIFICATION.md per phase
- ServiceRegistry pattern for clean dependency injection without global state
- Domain-specific route/API module splits dramatically improved maintainability

### What Was Inefficient
- Phase 10 created shared components (PageHeader, StatCard, PageLoading) that no page imports — wasted effort
- detectionService frontend (245 lines) built but never consumed by any page
- VERIFICATION_REPORT.md files went stale (Phase 01 written mid-milestone, Phase 03 incorrectly scored 3.3/3.4 at 0%)
- Duplicate event search endpoints (/search vs /list-enhanced) with inconsistent params
- ConsolidatedDetectionService registered but never called — dead code from planning overhead

### Patterns Established
- Domain-specific module splitting (routes/ and services/api/) for maintainable monolith
- ServiceRegistry for typed dependency injection
- Dark mode via CSS custom properties with system preference detection
- Shared UI component library pattern (even if adoption was partial)
- Web Push with VAPID for browser-native notifications

### Key Lessons
1. **Verify component adoption immediately** — creating shared components without wiring them into consumers wastes effort and creates orphaned code
2. **Update VERIFICATION reports in real-time** — stale verification files create false audit findings and rework
3. **Test the full E2E flow, not just the API** — NOTF-01 was marked PASS but the subscription flow was broken until integration testing caught it
4. **Split god files proactively** — the 4,095-line routes/index.ts should have been split before adding features; every addition made it harder
5. **Tech debt phases pay dividends** — Phase 11 eliminated dead code, fixed 4 bugs, and added 110 tests in one focused pass

### Cost Observations
- Milestone spanned 61 days with significant gaps (April had minimal activity)
- Heavy on code generation and refactoring tasks
- Notable: Route split (11-05) and API service split (11-06) were high-impact, low-effort plans

---

## Cross-Milestone Trends

### Process Evolution

| Milestone | Duration | Phases | Key Change |
|-----------|----------|--------|------------|
| v1.0 | 5 days | 6 | Initial feature implementation, resource optimization |
| v1.1 | 61 days | 11 (5 new) | Full system overhaul, codebase hardening, test coverage |

### Cumulative Quality

| Milestone | Tests | Files | LOC | Tech Debt Items |
|-----------|-------|-------|-----|-----------------|
| v1.0 | 0 | ~150 | ~40,000 | Moderate (god files, no tests) |
| v1.1 | 110 | ~260 | ~50,800 | 7 known items (documented) |

### Top Lessons (Verified Across Milestones)

1. **Split large files early** — god files accumulate features faster than expected; domain module splits are always worth doing
2. **Integration testing beats unit verification** — requirements can appear satisfied in isolation but broken in the full flow
3. **Document tech debt explicitly** — orphaned code and deferred features should be tracked, not hidden
