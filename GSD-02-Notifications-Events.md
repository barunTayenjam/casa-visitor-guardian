# GSD Discussion: 02-Notifications-Events End-to-End

**Date**: March 18, 2026
**Project**: SentryVision Home Security System
**Phase**: Requirements & Design Analysis

---

## 1. GOALS

### Primary Objectives
1. **Real-time Event Notification**: Deliver instant, reliable notifications for security events (motion, face, object detection, system alerts)
2. **User-Controlled Experience**: Allow users to customize notification preferences by type, severity, and time
3. **Multi-Channel Delivery**: Support in-app toasts, browser notifications, and future channels (mobile, email)
4. **Notification Persistence**: Maintain notification history with acknowledgment and dismissal tracking
5. **Smart Aggregation**: Reduce noise by grouping similar events and preventing notification spam
6. **Reliability**: Ensure notification delivery even during brief network interruptions

### Success Metrics
- **Latency**: < 500ms from event detection to notification delivery
- **Reliability**: 99.9% notification delivery rate
- **User Engagement**: < 5% false positive rate, > 90% acknowledgment rate
- **Performance**: Support 100+ concurrent users with 10+ events/second each

---

## 2. SCOPE

### In Scope

#### Phase 1: Core Notification System (MVP)
- **Backend Components**:
  - Unified notification service integrating with existing EventBus
  - Notification preferences per user (stored in database)
  - Notification queue with retry logic
  - WebSocket-based real-time delivery
  - In-app notification persistence (7-day retention)
  - Event-to-notification mapping and enrichment
  - Severity-based routing (low, medium, high, critical)

- **Frontend Components**:
  - Notification center component with history
  - Real-time toast notifications for immediate alerts
  - Notification preferences UI
  - Browser notification integration (with permission handling)
  - Notification acknowledgment/dismiss actions
  - Unread count badge
  - Sound effects (optional, user-controlled)

- **Event Types**:
  - Motion detection (all cameras)
  - Face recognition (known/unknown)
  - Object detection (person, car, dog, cat, package)
  - System alerts (camera offline, storage warning, error)
  - Visitor events (unauthorized visitor detected)

#### Phase 2: Enhanced Features
- Smart event aggregation (grouping similar events within time windows)
- Quiet hours / do-not-disturb schedules
- Per-camera notification preferences
- Notification sound customization
- Escalation rules (e.g., repeated motion triggers higher severity)
- Notification digest emails
- Advanced filtering and search in notification center

#### Phase 3: Advanced Features (Future)
- Mobile push notifications (React Native app)
- SMS notifications for critical events
- Integration with third-party services (Slack, Discord, IFTTT)
- ML-based noise reduction and anomaly detection
- Geofencing-aware notifications
- Multi-user notification delegation

### Out of Scope
- SMS gateway integration (deferred to Phase 3)
- Mobile app development (separate project)
- Voice call notifications
- Social media sharing
- Third-party API webhooks (deferred)
- Historical notification analytics (deferred)

---

## 3. DESIGN

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         Event Sources                            │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │ Motion Det.  │  │ Face Recog.  │  │ System Mon.  │          │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘          │
└─────────┼──────────────────┼──────────────────┼─────────────────┘
          │                  │                  │
          └──────────────────┼──────────────────┘
                             ▼
                  ┌────────────────────┐
                  │    EventBus        │
                  │  (Existing)        │
                  └─────────┬──────────┘
                            │
         ┌──────────────────┼──────────────────┐
         │                  │                  │
         ▼                  ▼                  ▼
┌─────────────────┐  ┌──────────────┐  ┌──────────────┐
│ Notification    │  │ Event Queue  │  │  Database    │
│ Service (NEW)   │  │ (Existing)   │  │  (Existing)  │
└────────┬────────┘  └──────────────┘  └──────────────┘
         │
         ├──────► NotificationQueue (Redis/DB)
         │
         ├──────► UserPrefs (Database)
         │
         ├──────► NotificationHistory (Database)
         │
         ▼
┌─────────────────────────────────────────┐
│         Socket.io Server                 │
│      (Enhanced with Notification Emitter)│
└───────────────────┬─────────────────────┘
                    │
                    ▼
         ┌──────────────────────┐
         │   Frontend Clients   │
         │  (Browser/Mobile)    │
         └──────────────────────┘
                    │
         ┌──────────┼──────────┐
         │          │          │
         ▼          ▼          ▼
    ┌────────┐ ┌────────┐ ┌──────────┐
    │ Toasts │ │ Notif  │ │ Browser  │
    │        │ │ Center │ │ Notif    │
    └────────┘ └────────┘ └──────────┘
```

### Database Schema

```sql
-- Notification Preferences (per user)
CREATE TABLE notification_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    event_type VARCHAR(50) NOT NULL, -- 'motion', 'face', 'object', 'system'
    enabled BOOLEAN NOT NULL DEFAULT true,
    severity_threshold VARCHAR(20) DEFAULT 'low', -- 'low', 'medium', 'high', 'critical'
    channels JSONB NOT NULL DEFAULT '{"in_app": true, "browser": false, "email": false}',
    camera_id VARCHAR(50), -- NULL means all cameras
    quiet_hours JSONB, -- {"enabled": false, "start": "22:00", "end": "06:00", "timezone": "Asia/Kolkata"}
    sound_enabled BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id, event_type, camera_id)
);

-- Notification History
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    event_id UUID, -- References events table or event queue
    event_type VARCHAR(50) NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    severity VARCHAR(20) NOT NULL,
    metadata JSONB, -- {camera_id, confidence, objects, image_url, etc.}
    status VARCHAR(20) DEFAULT 'sent', -- 'sent', 'delivered', 'read', 'dismissed', 'failed'
    delivery_channels JSONB, -- {"in_app": true, "browser": true, "email": false}
    read_at TIMESTAMP,
    dismissed_at TIMESTAMP,
    expires_at TIMESTAMP, -- Auto-delete after 7 days
    created_at TIMESTAMP DEFAULT NOW(),
    INDEX idx_user_created (user_id, created_at DESC),
    INDEX idx_status (status),
    INDEX idx_event_type (event_type)
);

-- Notification Aggregation Rules
CREATE TABLE notification_aggregation_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    event_type VARCHAR(50) NOT NULL,
    time_window_seconds INTEGER DEFAULT 60, -- Aggregate events within this window
    max_count INTEGER DEFAULT 5, -- Maximum events before aggregating
    aggregation_message TEXT, -- "5 motion events detected in the last minute"
    enabled BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

### Backend API Design

#### NotificationService
```typescript
interface NotificationService {
  // Core notification methods
  sendNotification(userId: string, notification: NotificationPayload): Promise<Notification>;
  sendBulkNotifications(userIds: string[], notification: NotificationPayload): Promise<Notification[]>;
  
  // Preferences
  getUserPreferences(userId: string): Promise<NotificationPreferences[]>;
  updateUserPreferences(userId: string, prefs: NotificationPreferences[]): Promise<void>;
  
  // History
  getUserNotifications(userId: string, filters: NotificationFilters): Promise<Notification[]>;
  markAsRead(notificationId: string, userId: string): Promise<void>;
  markAllAsRead(userId: string): Promise<void>;
  dismissNotification(notificationId: string, userId: string): Promise<void>;
  clearOldNotifications(userId: string, olderThanDays: number): Promise<number>;
  
  // Aggregation
  checkAndAggregate(event: SecurityEvent): Promise<AggregatedNotification | null>;
}

interface NotificationPayload {
  eventType: 'motion' | 'face' | 'object' | 'system' | 'visitor';
  title: string;
  message: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  metadata?: Record<string, any>;
  eventId?: string;
  imageUrl?: string;
  actionUrl?: string;
}
```

#### Socket Events
```typescript
// Server -> Client events
interface NotificationEvents {
  'notification:new': (notification: Notification) => void;
  'notification:bulk': (notifications: Notification[]) => void;
  'notification:updated': (notification: Notification) => void;
  'notification:deleted': (notificationId: string) => void;
  'notification:unread_count': (count: number) => void;
}

// Client -> Server events
interface NotificationAckEvents {
  'notification:read': (notificationId: string) => void;
  'notification:dismiss': (notificationId: string) => void;
  'notification:mark_all_read': () => void;
}
```

#### REST API Endpoints
```
GET    /api/notifications                      - List user notifications
GET    /api/notifications/:id                  - Get single notification
PATCH  /api/notifications/:id/read             - Mark as read
PATCH  /api/notifications/read-all             - Mark all as read
DELETE /api/notifications/:id                  - Dismiss/delete notification
DELETE /api/notifications/clear-old            - Clear old notifications

GET    /api/notifications/preferences          - Get user preferences
PUT    /api/notifications/preferences          - Update preferences
GET    /api/notifications/unread-count         - Get unread count

POST   /api/notifications/test                 - Send test notification
```

### Frontend Design

#### Components
```
frontend/src/components/notifications/
├── NotificationCenter.tsx           # Main notification center panel
├── NotificationItem.tsx             # Single notification card
├── NotificationPreferences.tsx      # Settings page for notifications
├── NotificationToast.tsx            # Toast notification wrapper
├── NotificationBadge.tsx            # Unread count badge
├── BrowserNotificationPermission.tsx # Permission request handler
└── useNotifications.ts              # Custom hook for notification logic

frontend/src/contexts/
└── NotificationContext.tsx          # Global notification state
```

#### Notification Context
```typescript
interface NotificationContextType {
  notifications: Notification[];
  unreadCount: number;
  isLoading: boolean;
  
  // Actions
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  dismiss: (id: string) => Promise<void>;
  clearOld: () => Promise<void>;
  
  // Preferences
  preferences: NotificationPreference[];
  updatePreferences: (prefs: NotificationPreference[]) => Promise<void>;
  
  // Browser notifications
  browserPermission: NotificationPermission;
  requestBrowserPermission: () => Promise<boolean>;
}

interface Notification {
  id: string;
  userId: string;
  eventType: string;
  title: string;
  message: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  metadata?: Record<string, any>;
  status: 'sent' | 'delivered' | 'read' | 'dismissed';
  readAt?: Date;
  dismissedAt?: Date;
  createdAt: Date;
  imageUrl?: string;
  actionUrl?: string;
}
```

#### UI/UX Specifications

**Toast Notifications**:
- Position: Bottom-right corner
- Duration: 5 seconds (auto-dismiss), 10s for high severity
- Max visible: 3 toasts (queue others)
- Severity colors:
  - Low: Blue/Info
  - Medium: Yellow/Warning
  - High: Orange/Alert
  - Critical: Red/Danger
- Actions: "View", "Dismiss" buttons

**Notification Center**:
- Position: Slide-in panel from right (30% width)
- Sections: "Unread" (pinned top), "Earlier" (grouped by date)
- Filtering: By type, severity, camera
- Search: Full-text search in title/message
- Empty state: Helpful illustration + "No notifications yet"
- Load more: Infinite scroll (50 per page)

**Notification Preferences**:
- Grouped by event type (accordion sections)
- Per-type toggles: Enable/disable, severity threshold, channels
- Per-camera overrides: "All cameras" or specific cameras
- Quiet hours: Time range picker with timezone
- Sound: Volume slider + preview button
- Reset to defaults button

---

## 4. IMPLEMENTATION DECISIONS

### Technology Choices

1. **Real-time Communication**: Socket.io (already implemented, extends existing setup)
2. **Queue Backend**: Redis (fast in-memory queue) + PostgreSQL fallback (persistence)
3. **Browser Notifications**: standard Notification API + service worker for offline support
4. **Toast Library**: Sonner (already in dependencies, lightweight)
5. **Sound Effects**: HTML5 Audio with bundled MP3 files
6. **Time Handling**: date-fns (already in dependencies) + Luxon for timezone support

### Key Design Decisions

#### 1. Notification Delivery Flow
```
Event Detection → EventBus → NotificationService
                              ↓
                    Check User Preferences
                              ↓
                    Check Quiet Hours
                              ↓
                    Apply Aggregation Rules
                              ↓
                    Create Notification Record
                              ↓
                    Emit via Socket.io
                              ↓
                    Frontend: Toast + Center Update
                              ↓
                    Browser Notification (if permitted)
```

**Decision**: **Event-driven architecture** over polling
- Rationale: Real-time, low latency, efficient
- Trade-off: Requires persistent Socket.io connection

#### 2. Notification Persistence Duration
**Decision**: **7 days** retention for notification history
- Rationale: Balance between utility and storage costs
- Trade-off: Users lose historical notifications after 7 days
- Mitigation: Important events stored in `events` table permanently

#### 3. Aggregation Strategy
**Decision**: **Time-window based aggregation** with configurable windows
- Rules:
  - Default: 60-second window, max 5 events
  - Example: 5 motion events in 60s → "5 motion events detected"
  - Per-camera aggregation to avoid confusion
- Rationale: Reduces notification spam during high activity
- Trade-off: Individual event details less visible
- Mitigation: Link aggregated notification to event list view

#### 4. Offline Notification Handling
**Decision**: **Service worker + Background sync API**
- Strategy:
  - Register service worker on app load
  - Cache notification payloads in IndexedDB
  - Show browser notifications when offline
  - Sync acknowledgment when back online
- Rationale: Best practice for PWA, works in background
- Trade-off: Increased complexity
- Mitigation: Keep service worker minimal, test thoroughly

#### 5. Notification Sound
**Decision**: **Optional opt-in sounds** with 3 distinct tones
- Tones:
  - Low/Medium: Soft chime (non-intrusive)
  - High: Two-tone alert (attention-grabbing)
  - Critical: Urgent alarm pattern (requires dismissal)
- Rationale: Accessibility + user preference
- Trade-off: Annoyance if overused
- Mitigation: Respect quiet hours, easy mute toggle

#### 6. Multi-Device Sync
**Decision**: **Cross-device acknowledgment via server**
- Strategy:
  - Read/dismiss status synced to database
  - Server pushes status updates to all user's devices
  - Each device maintains local cache
- Rationale: Consistent experience across devices
- Trade-off: Network dependency
- Mitigation: Optimistic updates + server reconciliation

#### 7. Privacy & Data Minimization
**Decision**: **Store minimal notification data**
- Stored:
  - Event type, title, message, timestamp
  - Severity, metadata (camera_id, confidence)
  - Image URL (reference only, not base64)
- Not stored:
  - Full event payload (reference via event_id)
  - PII in notification message
- Rationale: GDPR compliance, reduced storage
- Trade-off: Less context in notification history
- Mitigation: Link to full event details

---

## 5. PHASE 1 IMPLEMENTATION PLAN (4-6 weeks)

### Week 1-2: Backend Foundation
- [ ] Create database migrations (notifications, preferences, aggregation_rules)
- [ ] Implement NotificationService with preference checking
- [ ] Integrate with existing EventBus
- [ ] Create notification queue with retry logic
- [ ] Add notification API endpoints (REST)
- [ ] Write unit tests for service layer

### Week 3: Socket.io Integration
- [ ] Extend Socket.io server with notification emitters
- [ ] Implement acknowledgment event handlers
- [ ] Add unread count broadcasting
- [ ] Test real-time delivery with multiple clients
- [ ] Add error handling and reconnection logic

### Week 4: Frontend Core
- [ ] Create NotificationContext with state management
- [ ] Implement NotificationCenter component with infinite scroll
- [ ] Create NotificationItem with actions (read, dismiss, view)
- [ ] Add NotificationBadge with unread count
- [ ] Integrate Sonner toast library with custom styling
- [ ] Implement browser notification permission handler

### Week 5: Preferences & Settings
- [ ] Create NotificationPreferences component
- [ ] Implement per-event-type preference controls
- [ ] Add quiet hours scheduler with timezone support
- [ ] Create sound customization UI
- [ ] Add per-camera notification overrides
- [ ] Implement preference persistence API calls

### Week 6: Polish & Testing
- [ ] Add notification aggregation logic
- [ ] Implement sound effects with browser audio
- [ ] Add loading states and error handling
- [ ] Test with 100+ simultaneous events
- [ ] Verify browser notifications across browsers (Chrome, Firefox, Safari)
- [ ] Performance testing (memory leaks, re-renders)
- [ ] Write integration tests
- [ ] Documentation and code review

---

## 6. TESTING STRATEGY

### Unit Tests
- NotificationService: preference matching, aggregation, queue management
- API endpoints: CRUD operations, filtering, pagination
- NotificationContext: state updates, action handlers

### Integration Tests
- End-to-end flow: Event → Notification → Toast → Center
- Socket.io delivery with multiple clients
- Browser notification API integration
- Preferences enforcement

### E2E Tests (Playwright)
- User changes preferences → verify notification behavior
- Quiet hours active → verify no toasts
- Aggregation active → verify grouped notifications
- Cross-device sync → verify read status propagation

### Load Tests
- 1000 users, 10 events/sec each
- Measure notification delivery latency
- Verify no dropped events under load

---

## 7. MONITORING & OBSERVABILITY

### Metrics to Track
- **Latency**: Event time → Notification delivery time
- **Delivery Rate**: % of notifications successfully delivered
- **Read Rate**: % of notifications marked as read
- **Dismiss Rate**: % of notifications dismissed vs read
- **Error Rate**: Failed notifications by reason
- **Aggregation Effectiveness**: % reduction in notification count

### Logging
- NotificationService: INFO for sent notifications, ERROR for failures
- Socket.io: Connection events, delivery confirmations
- API: Request/response logs for preference changes

### Alerts
- Notification delivery failure rate > 1%
- Queue depth > 1000 (backlog warning)
- Average delivery latency > 2 seconds

---

## 8. SECURITY & PRIVACY

### Security Measures
- User-specific notification queries (auth required)
- Rate limiting on notification endpoints (100/sec per user)
- Input sanitization on notification messages
- CSRF protection on state-changing endpoints

### Privacy Considerations
- No sensitive data in notification titles/messages
- Automatic deletion after 7 days (GDPR compliance)
- User-controlled data export (all notifications JSON)
- Opt-in for browser notifications (no force-enable)

---

## 9. DEPENDENCIES & BLOCKERS

### Internal Dependencies
- ✅ EventBus (existing)
- ✅ Socket.io server (existing)
- ✅ User authentication (existing)
- ✅ Database migrations system (existing)
- ❌ NotificationPreferences model (NEW)
- ❌ Notification model (NEW)

### External Dependencies
- None for Phase 1 (all in-house)
- Phase 3: SMS gateway (Twilio/Amazon SNS), email service

### Potential Blockers
- Browser notification permission denial (mitigation: graceful degradation)
- Socket.io connection instability (mitigation: retry logic + polling fallback)
- Database performance at scale (mitigation: indexing, partitioning)

---

## 10. RISKS & MITIGATION

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| User notification fatigue | High | Medium | Smart aggregation, quiet hours, per-prefs |
| Browser notification blocked | Medium | High | Clear UI, in-app fallback |
| Socket.io disconnects | High | Medium | Auto-reconnect, polling fallback |
| Database performance issues | High | Low | Proper indexing, archiving, Redis queue |
| Notification spam during testing | Low | Medium | Test mode flag, separate test DB |
| Cross-browser compatibility issues | Medium | Low | Test on Chrome/Firefox/Safari, polyfills |

---

## 11. OPEN QUESTIONS

1. **Notification Sound Volume**: Should it be relative to system volume or fixed? → **DECIDED**: User-controlled slider, defaults to 50%

2. **Maximum Notification Queue Size**: What's the limit before we drop events? → **DECIDED**: 1000 per user, alert monitoring if exceeded

3. **Browser Notification Service Worker Scope**: Root or subdirectory? → **DECIDED**: Root (`/`) for consistency

4. **Aggregation Time Window**: Fixed or configurable per user? → **DECIDED**: Default 60s, user-adjustable 30-300s

5. **Critical Event Escalation**: Should we escalate after N unacknowledged critical notifications? → **DEFERRED**: Phase 2 feature

6. **Mobile Push Notifications**: Do we need Firebase Cloud Messaging or can we use Service Worker Push API? → **DEFERRED**: Phase 3 research needed

---

## 12. ACCEPTANCE CRITERIA

### Phase 1 MVP
- ✅ User receives in-app toast for motion detection
- ✅ User can view notification history in center panel
- ✅ User can mark notifications as read/dismissed
- ✅ Unread count badge updates in real-time
- ✅ User can disable specific event types
- ✅ Quiet hours prevent toast notifications
- ✅ Browser notifications work (with permission)
- ✅ Notifications aggregate during high activity (5 events/60s)
- ✅ Cross-device acknowledgment sync works
- ✅ Delivery latency < 500ms for 99% of notifications
- ✅ No memory leaks after 1000+ notifications
- ✅ All new code has unit tests (>80% coverage)
- ✅ Integration tests pass for critical flows

---

## 13. NEXT STEPS

1. **Review this document** with stakeholders for approval
2. **Create detailed task breakdown** in project tracker (GitHub Issues/Jira)
3. **Set up development environment** for notification service
4. **Implement database migrations** (Week 1, Day 1)
5. **Schedule weekly syncs** to track progress
6. **Assign developers** to backend/frontend tracks

---

**Document Status**: ✅ Draft Complete
**Next Review**: With engineering team
**Timeline**: 4-6 weeks for Phase 1
**Priority**: HIGH (User-facing feature)

---

## APPENDIX: Event Type Mapping

| Event Type | Default Severity | Toast Duration | Sound | Browser Notification |
|------------|------------------|----------------|-------|---------------------|
| Motion (low confidence) | Low | 5s | Soft chime | Optional |
| Motion (high confidence) | Medium | 5s | Soft chime | Yes |
| Face (known) | Medium | 5s | Soft chime | Yes |
| Face (unknown) | High | 10s | Two-tone alert | Yes |
| Object (person) | High | 10s | Two-tone alert | Yes |
| Object (package) | Medium | 5s | Soft chime | Yes |
| Camera offline | Critical | Until dismissed | Urgent alarm | Yes |
| Storage warning (80%) | High | 10s | Two-tone alert | Yes |
| System error | Critical | Until dismissed | Urgent alarm | Yes |
| Visitor (unauthorized) | High | 10s | Two-tone alert | Yes |

