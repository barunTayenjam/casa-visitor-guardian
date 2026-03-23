# Phase 2: Notifications & Events - Context

**Gathered:** 2026-03-19
**Status:** Ready for planning

## Phase Boundary
Implement real-time push notifications and powerful event search/filtering for the SentryVision home security system. This includes Web Push API for browser notifications, notification preferences UI, event search API, and event filters UI.

## Implementation Decisions

### Notification Service Architecture
- Use Web Push API with VAPID keys for browser push notifications
- Store notification subscriptions in database with user association
- Implement notification service with retry logic and error handling
- Integrate with existing motion detection and face detection workflows
- Only notify for unknown faces (when facesDetected = 0 and personsDetected > 0)

### Notification Payload Design
- Include title, body, icon, image (thumbnail), badge, tag, and data fields
- Keep payload under 4KB Web Push limit
- Use tag field for notification coalescing
- Include camera name, event type, and timestamp in notification body

### Event Search & Filtering
- Implement search API with date range, camera, type, confidence filters
- Build UI with search bar, filter dropdowns, and pagination
- Support configurable page size for event listing
- Ensure search returns results in under 1 second

### User Preferences
- Per-type notification toggle (motion, object, face)
- Quiet hours configuration to prevent notifications during set times
- Notification preferences stored per user

## Canonical References
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Roadmap References
- `.planning/ROADMAP.md` — Phase 2: Notifications & Events goal and requirements
- `.planning/REQUIREMENTS.md` — NOTF-01 to NOTF-05, EVNT-01 to EVNT-06 requirements

### Requirements Details
- `.planning/REQUIREMENTS.md` — Notification and event requirements specifications
  - NOTF-01: Browser push notification within 3 seconds of detection
  - NOTF-02: User can enable/disable notifications per event type
  - NOTF-03: Quiet hours prevent notifications during set times
  - NOTF-04: Event search returns results in under 1 second
  - NOTF-05: Filters work correctly: date, camera, type, confidence, face status
  - EVNT-01 to EVNT-06: Event listing, filtering, pagination requirements

### Technical References
- `server/src/detection/optimizedMotionDetection.ts` — Main motion detection to integrate with
- `server/src/detection/motionTriggeredDetection.ts` — Face detection to integrate with
- `server/src/routes/index.ts` — Main routes for endpoint registration

## Code Context
## Existing Code Insights

### Reusable Assets
- Socket.io instance — Already configured for real-time communication, can reuse for notification events
- User authentication system — JWT-based auth middleware exists for protecting routes
- Event creation workflow — Motion detection already creates events in database
- Logging system — Existing logger can be used for notification audit trails

### Established Patterns
- Service layer pattern — Existing services in `server/src/services/` follow consistent structure
- TypeORM models — Database models follow established patterns with UUID primary keys
- Route organization — API routes in `server/src/routes/` follow REST conventions
- Database migrations — Existing migrations in `database/migrations/` follow naming convention

### Integration Points
- Motion detection — Hook into `optimizedMotionDetection.ts` after event creation
- Face detection — Hook into `motionTriggeredDetection.ts` after face detection analysis
- Authentication — Notification routes will use existing JWT middleware
- Database — New tables will use same PostgreSQL connection as existing models
- API gateway — Routes will register in `server/src/routes/index.ts`

## Specific Ideas
## Specific Ideas
- Use VAPID keys stored in environment variables for security
- Include thumbnail URLs in notifications rather than full images to stay within size limits
- Implement exponential backoff (1s, 2s, 4s) for failed notification retries
- Use database indexes on timestamp and camera_id for fast event queries
- Implement subscription cleanup job to remove expired/inactive subscriptions
- Add notification logging to track delivery success/failure rates

## Deferred Ideas
## Deferred Ideas
- Rich notifications with action buttons — Future phase (advanced UI)
- SMS/email notifications fallback — Future phase (multi-channel)
- Notification analytics dashboard — Future phase (insights)
- Geofencing for location-based notifications — Future phase (context-aware)
- Integration with smart home systems (Alexa/Google Home) — Future phase (ecosystem)

---
*Phase: 02-notifications-events*
*Context gathered: 2026-03-19*