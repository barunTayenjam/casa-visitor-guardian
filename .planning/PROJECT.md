# SentryVision Home Security System

## What This Is

SentryVision is a comprehensive home security system with real-time camera streaming, motion detection, facial recognition, and visitor analytics. The system consists of a React/TypeScript frontend, Node.js/Express backend, PostgreSQL database, and Python OpenCV service for computer vision processing.

## Core Value

Provide reliable, automated home surveillance that detects motion and visitors, sends real-time alerts, and stores events for later review — with minimal false positives.

## Requirements

### Validated

- ✓ Real-time RTSP camera streaming to web interface — production
- ✓ Motion detection with MOG2 background subtraction — production
- ✓ Face recognition with custom embedding system — production
- ✓ Object detection (person, car, dog, cat, package) — production
- ✓ Event recording with image capture — production (1,050+ events)
- ✓ JWT authentication with TOTP MFA — production
- ✓ Role-based access control (admin, user, viewer) — production
- ✓ Visitor timeline tracking — production
- ✓ Review segments for bundled detection review — production
- ✓ Batch processing for re-detection — production
- ✓ Two-camera configuration (Front Door, Back Door) — production
- ✓ Zone-based detection regions — production

### Active

- [ ] Improve motion detection accuracy (reduce false positives)
- [ ] Enhance face recognition matching
- [ ] Add additional camera support
- [ ] Optimize detection performance
- [ ] Improve UI/UX for event review
- [ ] Add notification system (push notifications)
- [ ] Add video recording for events
- [ ] Implement storage management and retention policies

### Out of Scope

- Cloud storage integration — local storage only
- Mobile native app — web-only for now
- Smart home integrations (Home Assistant, etc.) — future consideration
- Subscription/billing features — not applicable
- Multi-property support — single residence only

## Context

**Current Status** (as of Feb 2, 2026):
- 2 RTSP cameras configured and streaming
- 1,050+ events recorded
- 17 database tables
- 8 migrations executed
- 3 motion detection implementations (optimized, simple, motion-triggered)
- 3,528 lines of detection code

**Architecture:**
- Frontend (5173): React 18 + TypeScript + Vite + TailwindCSS + Radix UI
- Backend (9753): Node.js + Express + TypeScript + TypeORM
- OpenCV Service (8084): Python Flask + OpenCV
- Database (5432): PostgreSQL 15+
- Cache (6379): Redis

**Key Files:**
- `server/src/detection/` — 3 motion detection implementations
- `server/src/streams/` — RTSP stream management
- `opencv-service/app.py` — Flask service with face/object detection
- `server/cameras.json` — Camera configuration

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

---
*Last updated: 2026-03-18 after project initialization*
