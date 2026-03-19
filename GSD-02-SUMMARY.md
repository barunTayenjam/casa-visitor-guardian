# GSD-02 Summary: Notifications & Events End-to-End

## 📋 Quick Reference

**Status**: ✅ Analysis Complete | Ready for Implementation
**Priority**: HIGH (User-facing, improves security monitoring)
**Timeline**: 4-6 weeks for Phase 1 MVP
**Team**: Backend + Frontend developers

---

## 🎯 Key Goals

1. **Real-time notifications** for security events (< 500ms latency)
2. **User-controlled preferences** (type, severity, time-based)
3. **Multi-channel delivery** (in-app toasts, browser notifications)
4. **Notification history** (7-day retention, read/dismiss tracking)
5. **Smart aggregation** (prevent spam during high activity)
6. **99.9% reliability** (retry logic, queue management)

---

## 📊 Current State Analysis

### ✅ What Exists (Leverage)
- **Backend**: EventBus, Socket.io server, EventQueueService
- **Frontend**: Socket.io client, EventsContext, Toast components (Sonner, Radix UI)
- **Infrastructure**: PostgreSQL, Redis (via docker-compose)

### ❌ What's Missing (Build)
- Unified NotificationService (connects EventBus → Socket.io → Users)
- Notification preferences system (per-user, per-type)
- Notification persistence & history
- Notification center UI
- Browser notification integration
- Event aggregation logic
- Quiet hours / do-not-disturb

---

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────┐
│  Event Sources (Motion, Face, System Alerts)   │
└───────────────────┬─────────────────────────────┘
                    │
                    ▼
            ┌───────────────┐
            │   EventBus    │ (Existing)
            └───────┬───────┘
                    │
                    ▼
        ┌───────────────────────────┐
        │  NotificationService (NEW) │
        │  - Check user preferences  │
        │  - Apply aggregation rules │
        │  - Queue & retry           │
        └─────────┬─────────────────┘
                  │
    ┌─────────────┼─────────────┐
    ▼             ▼             ▼
┌────────┐  ┌──────────┐  ┌──────────┐
│ Socket │  │ Database │  │  Redis   │
│  .io   │  │ (History)│  │  Queue   │
└───┬────┘  └──────────┘  └──────────┘
    │
    ▼
┌───────────────────────────────────────────┐
│         Frontend Clients                  │
│  ┌────────┐  ┌──────────┐  ┌──────────┐  │
│  │ Toasts │  │ Notif C  │  │ Browser  │  │
│  │        │  │  Panel   │  │ Notif    │  │
│  └────────┘  └──────────┘  └──────────┘  │
└───────────────────────────────────────────┘
```

---

## 🗄️ Database Schema

### New Tables

**1. notification_preferences**
```sql
- user_id, event_type, enabled
- severity_threshold (low/medium/high/critical)
- channels (in_app, browser, email)
- camera_id (NULL = all cameras)
- quiet_hours (time range, timezone)
- sound_enabled
```

**2. notifications**
```sql
- user_id, event_id, event_type
- title, message, severity
- metadata (camera_id, confidence, objects, image_url)
- status (sent/delivered/read/dismissed)
- delivery_channels
- read_at, dismissed_at, created_at
- expires_at (7 days)
```

**3. notification_aggregation_rules**
```sql
- user_id, event_type
- time_window_seconds (default: 60)
- max_count (default: 5)
- aggregation_message_template
```

---

## 🚀 Phase 1 Implementation (6 Weeks)

### Week 1-2: Backend Foundation
- [ ] Create database migrations (3 new tables)
- [ ] Implement `NotificationService` class
- [ ] Integrate with existing `EventBus`
- [ ] Build notification queue (Redis + fallback)
- [ ] Add REST API endpoints (CRUD notifications)
- [ ] Unit tests for service layer

### Week 3: Socket.io Integration
- [ ] Extend Socket.io server with notification emitters
- [ ] Implement acknowledgment handlers
- [ ] Add unread count broadcasting
- [ ] Test with multiple concurrent clients
- [ ] Error handling & reconnection logic

### Week 4: Frontend Core
- [ ] Create `NotificationContext` (state management)
- [ ] Build `NotificationCenter` panel (slide-in, infinite scroll)
- [ ] Create `NotificationItem` component (actions, styling)
- [ ] Add `NotificationBadge` (unread count)
- [ ] Integrate Sonner toasts with custom styling
- [ ] Browser notification permission handler

### Week 5: Preferences & Settings
- [ ] Build `NotificationPreferences` UI
- [ ] Per-event-type controls (enable, threshold, channels)
- [ ] Quiet hours scheduler (timezone-aware)
- [ ] Per-camera notification overrides
- [ ] Sound customization (volume, preview)
- [ ] Preference persistence API calls

### Week 6: Polish & Testing
- [ ] Implement aggregation logic (time-window grouping)
- [ ] Add sound effects (3 tones, optional)
- [ ] Loading states & error handling
- [ ] Load testing (1000 users, 10 events/sec)
- [ ] Cross-browser testing (Chrome/Firefox/Safari)
- [ ] Performance optimization (memoization, virtualization)
- [ ] Integration tests & E2E tests
- [ ] Documentation & code review

---

## 📝 API Design

### REST Endpoints
```
GET    /api/notifications              - List user notifications
GET    /api/notifications/:id          - Get single notification
PATCH  /api/notifications/:id/read     - Mark as read
PATCH  /api/notifications/read-all     - Mark all as read
DELETE /api/notifications/:id          - Dismiss notification
DELETE /api/notifications/clear-old    - Clear old notifications

GET    /api/notifications/preferences  - Get user preferences
PUT    /api/notifications/preferences  - Update preferences
GET    /api/notifications/unread-count - Get unread count

POST   /api/notifications/test         - Send test notification
```

### Socket Events (Server → Client)
```
'notification:new'         - Single notification
'notification:bulk'        - Multiple notifications
'notification:updated'     - Status change (read/dismissed)
'notification:unread_count' - Current unread count
```

### Socket Events (Client → Server)
```
'notification:read'        - Mark as read
'notification:dismiss'     - Dismiss notification
'notification:mark_all_read' - Mark all as read
```

---

## 🎨 Frontend Components

### New Components
```
frontend/src/components/notifications/
├── NotificationCenter.tsx          # Main panel (slide-in)
├── NotificationItem.tsx            # Single notification card
├── NotificationPreferences.tsx     # Settings UI
├── NotificationToast.tsx           # Toast wrapper
├── NotificationBadge.tsx           # Unread count badge
└── useNotifications.ts             # Custom hook

frontend/src/contexts/
└── NotificationContext.tsx         # Global state
```

### UI Specifications
- **Toast**: Bottom-right, 5s duration (10s high severity), max 3 visible
- **Notification Center**: Right slide-in (30% width), sections for Unread/Earlier
- **Badge**: Top navigation, real-time count, click to open center
- **Preferences**: Accordion layout, per-type controls, quiet hours picker

---

## ⚙️ Key Design Decisions

| Decision | Rationale | Trade-off |
|----------|-----------|-----------|
| Event-driven (Socket.io) | Real-time, low latency | Requires persistent connection |
| 7-day retention | Balance utility vs storage | Lose history after 7 days |
| Time-window aggregation | Reduces spam | Less individual event visibility |
| Service worker for offline | PWA best practice | Increased complexity |
| Optional opt-in sounds | Accessibility + preference | Annoyance if overused |
| Cross-device sync | Consistent experience | Network dependency |

---

## 🎯 Acceptance Criteria (Phase 1)

### Functional
- [ ] User receives in-app toast for motion detection
- [ ] User can view notification history in center panel
- [ ] User can mark notifications as read/dismissed
- [ ] Unread count badge updates in real-time
- [ ] User can disable specific event types
- [ ] Quiet hours prevent toast notifications
- [ ] Browser notifications work (with permission)
- [ ] Notifications aggregate during high activity
- [ ] Cross-device acknowledgment sync works

### Performance
- [ ] Delivery latency < 500ms for 99% of notifications
- [ ] No memory leaks after 1000+ notifications
- [ ] Supports 1000 concurrent users with 10 events/sec

### Quality
- [ ] Unit tests > 80% coverage for new code
- [ ] Integration tests for critical flows
- [ ] E2E tests for user journeys
- [ ] Cross-browser compatibility verified

---

## 📊 Event Type Mapping

| Event Type | Default Severity | Toast | Sound | Browser |
|------------|------------------|-------|-------|---------|
| Motion (low conf) | Low | 5s | Soft | Optional |
| Motion (high conf) | Medium | 5s | Soft | Yes |
| Face (known) | Medium | 5s | Soft | Yes |
| Face (unknown) | High | 10s | Alert | Yes |
| Object (person) | High | 10s | Alert | Yes |
| Camera offline | Critical | Until dismiss | Urgent | Yes |
| System error | Critical | Until dismiss | Urgent | Yes |

---

## 🚨 Risks & Mitigation

| Risk | Impact | Mitigation |
|------|--------|------------|
| Notification fatigue | High | Smart aggregation, quiet hours, per-prefs |
| Browser permission denied | Medium | Clear UI, in-app fallback |
| Socket.io disconnects | High | Auto-reconnect, polling fallback |
| DB performance issues | High | Indexing, partitioning, Redis queue |

---

## 📦 Dependencies

### External (npm)
- ✅ Existing: socket.io-client, sonner, @radix-ui/react-toast
- ❌ New: None for Phase 1

### Internal Services
- ✅ EventBus (existing)
- ✅ Socket.io server (existing)
- ✅ User auth (existing)
- ❌ NotificationService (new)
- ❌ Notification models (new)

---

## 📚 Next Steps

1. **Review GSD document** with stakeholders
2. **Create GitHub issues** from task breakdown
3. **Setup dev environment** for notification service
4. **Implement migrations** (Week 1, Day 1)
5. **Schedule weekly syncs** for progress tracking

---

## 📄 Documents

- **Full GSD Document**: `GSD-02-Notifications-Events.md`
- **This Summary**: `GSD-02-SUMMARY.md`
- **AGENTS Reference**: `AGENTS.md` (existing)

---

**Last Updated**: March 18, 2026
**Status**: ✅ Ready for Implementation
**Next Milestone**: Week 1 - Backend Foundation

