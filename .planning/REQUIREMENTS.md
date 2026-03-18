# Requirements: SentryVision Home Security System

**Defined:** 2026-03-18
**Core Value:** Provide reliable, automated home surveillance that detects motion and visitors, sends real-time alerts, and stores events for later review

## v1 Requirements

### Detection Quality

- [ ] **DET-01**: Motion detection filters noise using multi-frame validation (require 2-3 consecutive frames)
- [ ] **DET-02**: Motion detection uses Gaussian blur preprocessing to reduce false positives
- [ ] **DET-03**: Motion detection has adaptive threshold based on time of day
- [ ] **DET-04**: Minimum contour area threshold implemented to ignore small movements
- [ ] **DET-05**: Shadow and lighting variations handled to reduce false triggers

### Notifications

- [ ] **NOTF-01**: User receives browser push notification on motion detection
- [ ] **NOTF-02**: User receives browser push notification on unknown face detected
- [ ] **NOTF-03**: User can configure notification preferences (enable/disable by event type)
- [ ] **NOTF-04**: User can set notification quiet hours (do not disturb)
- [ ] **NOTF-05**: Notification includes camera name, event type, and thumbnail preview

### Event Management

- [ ] **EVNT-01**: User can search events by date range
- [ ] **EVNT-02**: User can filter events by camera (cam1, cam2)
- [ ] **EVNT-03**: User can filter events by event type (motion, face, object)
- [ ] **EVNT-04**: User can filter events by detection confidence level
- [ ] **EVNT-05**: User can filter events by recognized/unknown face
- [ ] **EVNT-06**: Event list uses pagination with configurable page size

### Face Recognition

- [ ] **FACE-01**: Face embeddings stored with quality metadata
- [ ] **FACE-02**: Face comparison uses cosine similarity with configurable threshold
- [ ] **FACE-03**: User can manually add known visitor from event image
- [ ] **FACE-04**: User can update known visitor name/photo from event
- [ ] **FACE-05**: System marks face as "unknown" when no match above threshold

### Storage Management

- [ ] **STOR-01**: Retention policy configurable per data type (events, images, videos)
- [ ] **STOR-02**: System automatically deletes data older than retention period
- [ ] **STOR-03**: User can view storage usage statistics in dashboard
- [ ] **STOR-04**: Cleanup runs on schedule without affecting detection performance
- [ ] **STOR-05**: Database records cleaned up when files deleted

## v2 Requirements

### Video Recording

- **VID-01**: System records short video clips (30 seconds) on motion events
- **VID-02**: User can configure clip length (15s, 30s, 60s, 5min)
- **VID-03**: User can play back recorded clips in web interface
- **VID-04**: Video files stored locally with proper codec (H.264)
- **VID-05**: Video integrity validated after recording

### Smart Alerts

- **SMART-01**: Events classified as "important" or "normal" based on detection
- **SMART-02**: Unknown face detected marked as "important"
- **SMART-03**: User receives daily summary notification of events
- **SMART-04**: User receives weekly report of visitor activity

### Additional Cameras

- **CAM-01**: Support for 3rd camera configuration
- **CAM-02**: User can enable/disable cameras individually
- **CAM-03**: Per-camera detection sensitivity settings

## Out of Scope

| Feature | Reason |
|---------|--------|
| Cloud storage (S3, GCS) | Goes against local-first philosophy |
| Mobile native app | Web-only for now |
| Smart home integration | Future consideration (Home Assistant, etc.) |
| Subscription/billing | Not applicable |
| Multi-property support | Single residence only |
| Facial recognition for pets | Privacy concerns, not useful |
| Continuous 24/7 recording | Storage prohibitive, event-based only |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| DET-01 | Phase 1 | Pending |
| DET-02 | Phase 1 | Pending |
| DET-03 | Phase 1 | Pending |
| DET-04 | Phase 1 | Pending |
| DET-05 | Phase 1 | Pending |
| NOTF-01 | Phase 2 | Pending |
| NOTF-02 | Phase 2 | Pending |
| NOTF-03 | Phase 2 | Pending |
| NOTF-04 | Phase 2 | Pending |
| NOTF-05 | Phase 2 | Pending |
| EVNT-01 | Phase 2 | Pending |
| EVNT-02 | Phase 2 | Pending |
| EVNT-03 | Phase 2 | Pending |
| EVNT-04 | Phase 2 | Pending |
| EVNT-05 | Phase 2 | Pending |
| EVNT-06 | Phase 2 | Pending |
| FACE-01 | Phase 3 | Pending |
| FACE-02 | Phase 3 | Pending |
| FACE-03 | Phase 3 | Pending |
| FACE-04 | Phase 3 | Pending |
| FACE-05 | Phase 3 | Pending |
| STOR-01 | Phase 4 | Pending |
| STOR-02 | Phase 4 | Pending |
| STOR-03 | Phase 4 | Pending |
| STOR-04 | Phase 4 | Pending |
| STOR-05 | Phase 4 | Pending |

**Coverage:**
- v1 requirements: 25 total
- Mapped to phases: 25
- Unmapped: 0 ✓

---
*Requirements defined: 2026-03-18*
*Last updated: 2026-03-18 after research synthesis*
