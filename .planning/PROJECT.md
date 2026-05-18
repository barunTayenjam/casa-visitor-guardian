# SentryVision Home Security System

## What This Is

SentryVision is a production-ready home security system with real-time RTSP camera streaming, motion detection with adaptive thresholds, face recognition with visitor management, push notifications, storage management with retention policies, and a polished dark-mode UI with sidebar navigation. The system consists of a React/TypeScript frontend (Vite + TailwindCSS + Radix UI), Node.js/Express backend, PostgreSQL database, and Python OpenCV service.

## Core Value

Provide reliable, automated home surveillance that detects motion and visitors, sends real-time alerts, and stores events for later review — with minimal false positives.

## Requirements

### Validated

- ✓ Multi-frame motion validation with adaptive thresholds — v1.1
- ✓ Gaussian blur preprocessing and contour filtering — v1.1
- ✓ Time-of-day adaptive sensitivity with night mode — v1.1
- ✓ Web Push notifications with VAPID subscription — v1.1
- ✓ Notification preferences with per-type toggles and quiet hours — v1.1
- ✓ Event search with date/camera/type/confidence/face filters — v1.1
- ✓ Face embeddings with quality metadata and cosine similarity — v1.1
- ✓ Visitor management CRUD with unknown face tracking — v1.1
- ✓ Configurable retention policies with automated cleanup — v1.1
- ✓ Storage dashboard with usage statistics — v1.1
- ✓ 47% memory reduction via FFmpeg optimization — v1.1
- ✓ AES-256-GCM RTSP credential encryption — v1.1
- ✓ Global rate limiting and auth-protected routes — v1.1
- ✓ Dark mode with system preference detection — v1.1
- ✓ WCAG AA accessibility across 15+ files — v1.1
- ✓ Sidebar navigation with responsive design — v1.1
- ✓ ServiceRegistry replacing (global as any) pattern — v1.1
- ✓ Route/API monolith splits (6 + 8 domain modules) — v1.1
- ✓ 110 unit tests across 4 test files — v1.1

### Active

- [ ] Video recording for motion events (30s clips)
- [ ] Smart alerts (importance classification, daily/weekly summaries)
- [ ] Additional camera support (3rd camera, per-camera sensitivity)
- [ ] Gallery page for event image browsing
- [ ] Resource Monitor dashboard UI (RO-05 deferred)
- [ ] Nyquist validation files for all phases

### Out of Scope

- Cloud storage integration — local storage only, privacy-first
- Mobile native app — responsive web-only
- Smart home integrations (Home Assistant, etc.) — future consideration
- Subscription/billing features — not applicable
- Multi-property support — single residence only
- Continuous 24/7 recording — event-based detection only

## Context

**Shipped:** v1.1 Full System Overhaul on 2026-05-18 (11 phases, 48 plans, 61 days)
**Tech Stack:** React 18 + TypeScript + Vite + TailwindCSS + Radix UI | Node.js + Express + TypeORM | Python Flask + OpenCV | PostgreSQL 15+ | Redis
**Codebase:** ~50,800 LOC (TypeScript/Python), 261 files modified in v1.1
**System:** 2 RTSP cameras, 1,050+ events, 17 database tables
**Test Coverage:** 110 unit tests across 4 test files
**Architecture:** Split monolith into 6 domain route modules + 8 API service modules

**Known Tech Debt:**
- Orphaned shared components (PageHeader, StatCard, PageLoading not imported by pages)
- detectionService frontend (245 lines, unused by any page)
- ConsolidatedDetectionService registered but never called
- Duplicate event search endpoints (/search vs /list-enhanced)
- Zod validation only on 2 of 22 route files
- Face embedding/config API endpoints with no frontend consumers
- No Nyquist VALIDATION.md files for any phase

## Constraints

- **Tech Stack**: React/Node.js/Python — must maintain existing stack
- **Timezone**: Asia/Kolkata (IST, UTC+5:30) — used throughout system
- **Camera Protocol**: RTSP only — no other protocols supported
- **Storage**: Local filesystem — no cloud storage

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| MOG2 for motion detection | Fast, reliable for stationary cameras | ✓ Good |
| 3-second detection interval | Balance between responsiveness and CPU | ✓ Good |
| Zone-based detection | Reduce false positives from street | ✓ Good |
| JWT + TOTP MFA | Security without complexity | ✓ Good |
| TypeORM for database | Type safety with existing TypeScript | ✓ Good |
| Adaptive sensitivity (90/100 max) | Avoid over-sensitive detection | ✓ Good |
| ServiceRegistry pattern | Replace (global as any) anti-pattern | ✓ Good |
| Domain route splitting | Reduce 4,095-line god file to 6 modules | ✓ Good |
| Dark mode via CSS variables | System preference detection, future-proof | ✓ Good |
| VAPID for push notifications | Standard web push, no third-party service | ✓ Good |
| AES-256-GCM for RTSP creds | Strong encryption, native Node.js crypto | ✓ Good |
| Sidebar navigation | Persistent access, responsive collapse | ✓ Good |

---
*Last updated: 2026-05-18 after v1.1 milestone*
