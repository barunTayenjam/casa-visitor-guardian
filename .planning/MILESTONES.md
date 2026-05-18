# Milestones

## v1.1 Full System Overhaul (Shipped: 2026-05-18)

**Phases completed:** 11 phases, 48 plans
**Timeline:** 61 days (2026-03-18 → 2026-05-18)
**Commits:** 144
**Requirements:** 58/58 satisfied
**Known tech debt:** 8 items (orphaned components, partial Zod, no Nyquist validation files)
**Known deferred items at close:** 17 (see STATE.md Deferred Items)

**Key accomplishments:**

- **Detection Quality**: Multi-frame validation, Gaussian blur preprocessing, adaptive thresholds, night mode (1.2x sensitivity 22:00-06:00) — false positives reduced by 50%
- **Notifications & Events**: Web Push API with VAPID subscription, notification preferences UI with quiet hours, event search with multi-filter pagination, confidence and face status filters
- **Face Recognition & Visitor Management**: Embedding storage with quality metadata, cosine similarity matching, visitor CRUD management page, unknown face tracking and alerting
- **Resource Optimization**: 47% memory reduction (897MB → 473MB), stream-on-demand with 5-min inactivity timeout, Docker resource limits across 5 containers
- **Security & Codebase Hardening**: AES-256-GCM RTSP credential encryption, global rate limiting, auth-protected 67+ routes, ServiceRegistry replacing `(global as any)`, split 4,095-line routes/index.ts into 6 modules
- **UI/UX**: Dark mode with system detection, WCAG AA accessibility, sidebar navigation, StreamPanel drawer with tap-to-toggle, CSS variable theming, 110 unit tests

---

## v1.0 Resource Optimization Complete (Shipped: 2026-03-23)

**Phases completed:** 6 phases, 25 plans

**Key accomplishments:**

- **Detection Quality**: Multi-frame validation, Gaussian blur preprocessing, adaptive thresholds reduced false positives by 50%
- **Notifications & Events**: Web Push API for browser notifications, notification preferences UI with quiet hours, event search API with date/camera/type filters, pagination
- **Face Recognition**: Enhanced embedding storage with quality metadata, cosine similarity algorithm for face matching, visitor management UI, unknown face handling
- **Storage Management**: Configurable retention policies per data type, automated cleanup service, storage dashboard with usage statistics, database cleanup with referential integrity
- **Frontend Enhancement**: Batch detection with retry logic and progress indicators, day highlights with keyboard shortcuts, events page with bulk selection and export, settings page verified, dashboard streaming fixed
- **Resource Optimization**: Comprehensive resource audit established baseline, FFmpeg optimization reduced memory by 47% (threads 4→2, FPS 4→2), Docker resource limits for all containers (total 2.2GB), stream-on-demand with 5-minute inactivity timeout, low-resource mode for constrained deployments

---
