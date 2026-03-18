# Roadmap: SentryVision Home Security System

**Created:** 2026-03-18
**Granularity:** Coarse
**Total Phases:** 4
**Total Requirements:** 25 (all mapped)

## Phase Summary

| # | Phase | Goal | Requirements | Success Criteria |
|---|-------|------|--------------|------------------|
| 1 | Detection Quality | Reduce false positives, improve motion detection accuracy | DET-01 to DET-05 | 5 |
| 2 | Notifications & Events | Add push notifications and event search/filtering | NOTF-01 to NOTF-05, EVNT-01 to EVNT-06 | 11 |
| 3 | Face Recognition | Improve face matching accuracy and management | FACE-01 to FACE-05 | 5 |
| 4 | Storage Management | Implement retention policies and cleanup | STOR-01 to STOR-05 | 5 |

---

## Phase 1: Detection Quality

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

## Phase 2: Notifications & Events

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

## Phase 3: Face Recognition

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

## Phase 4: Storage Management

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

## Requirement Coverage

| Phase | Requirements | Count |
|-------|-------------|-------|
| Phase 1 | DET-01, DET-02, DET-03, DET-04, DET-05 | 5 |
| Phase 2 | NOTF-01, NOTF-02, NOTF-03, NOTF-04, NOTF-05, EVNT-01, EVNT-02, EVNT-03, EVNT-04, EVNT-05, EVNT-06 | 11 |
| Phase 3 | FACE-01, FACE-02, FACE-03, FACE-04, FACE-05 | 5 |
| Phase 4 | STOR-01, STOR-02, STOR-03, STOR-04, STOR-05 | 5 |
| **Total** | | **25** |

**Coverage:** 25/25 requirements mapped ✓

---

## Future Phases (v2)

**Phase 5:** Video Recording — Record video clips on events
**Phase 6:** Smart Alerts — AI-powered alert prioritization
**Phase 7:** Additional Cameras — Support for 3rd+ cameras

---
*Roadmap created: 2026-03-18*
*Last updated: 2026-03-18 after initial creation*
