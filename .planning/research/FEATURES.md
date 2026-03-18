# Features Research: SentryVision Enhancements

## Existing Features (Validated)

| Feature | Status | Notes |
|---------|--------|-------|
| Camera streaming | Production | 2 cameras, RTSP |
| Motion detection | Production | MOG2, 3 implementations |
| Face recognition | Production | Custom embeddings |
| Object detection | Production | person, car, dog, cat, package |
| Visitor timeline | Production | Tracking faces over time |
| Review segments | Production | Bundled review periods |
| JWT + TOTP auth | Production | Secure authentication |
| Role-based access | Production | admin, user, viewer |

## Table Stakes Features

(Must have or users will be frustrated)

### 1. Improved Detection Accuracy
- Reduce false positives from trees, shadows, animals
- Multi-frame validation before triggering event
- Adaptive threshold based on time of day
- **Complexity:** Medium
- **Dependencies:** None (standalone)

### 2. Better Face Matching
- Improve recognition accuracy for known visitors
- Handle variations in lighting, angle
- Faster embedding comparison
- **Complexity:** High
- **Dependencies:** May need new model

### 3. Event Notifications
- Real-time browser push notifications
- Configurable notification preferences per event type
- Sound alerts option
- **Complexity:** Low-Medium
- **Dependencies:** None

### 4. Event Search & Filters
- Search events by date range, camera, event type
- Filter by detection confidence
- Filter by person/face recognized
- **Complexity:** Low
- **Dependencies:** None

## Differentiators

(Competitive advantage - nice to have)

### 5. Video Clip Recording
- Record short video clips (30s-5min) on events
- Continuous recording option
- Playback in web interface
- **Complexity:** High
- **Dependencies:** Storage management

### 6. Smart Alerts
- AI-powered alert prioritization
- "Important" vs "Normal" classification
- Daily/weekly summary notifications
- **Complexity:** High
- **Dependencies:** Improved detection

### 7. Unknown Face Alerts
- Immediate notification when unknown face detected
- Option to add to known faces from event
- **Complexity:** Medium
- **Dependencies:** Better face matching

## Anti-Features

(Deliberately NOT building)

| Feature | Reason for Exclusion |
|---------|---------------------|
| Cloud storage | Goes against local-first philosophy |
| Mobile app | Not in scope, web-only |
| Smart home integration | Future consideration |
| Subscription/billing | Not applicable |
| Multi-property | Single residence only |
| Facial recognition for pets | Privacy concerns, not useful |

## Feature Dependencies

```
[Improved Detection] ──┬──> [Smart Alerts]
                      │
[Better Face Match] ──┴──> [Unknown Face Alerts]
                              │
[Storage Management] <────────┴──> [Video Recording]
```

## Recommended Priority

1. **P0 (Critical):** Improved detection accuracy
2. **P1 (Important):** Event notifications, Event search/filters
3. **P2 (Nice):** Unknown face alerts, Better face matching
4. **P3 (Future):** Video clip recording, Smart alerts

---
*Research completed: 2026-03-18*
