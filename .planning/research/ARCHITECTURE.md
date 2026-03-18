# Architecture Research: SentryVision Enhancements

## Current Architecture

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Frontend  │────>│   Backend   │────>│   OpenCV    │
│   (5173)    │<────│   (9753)    │<────│   (8084)    │
└─────────────┘     └─────────────┘     └─────────────┘
      │                   │                   │
      │                   ▼                   │
      │            ┌─────────────┐           │
      │            │    Redis    │           │
      │            │   (6379)    │           │
      │            └─────────────┘           │
      │                   │                   │
      │                   ▼                   │
      └──────────────────┴───────────────────┘
                          │
                    ┌─────────────┐
                    │ PostgreSQL  │
                    │   (5432)    │
                    └─────────────┘
```

## Enhanced Architecture

### Component Boundaries

```
┌─────────────────────────────────────────────────────────────────┐
│                         Frontend (5173)                          │
├─────────────────────────────────────────────────────────────────┤
│  React Components │ Socket.io Client │ React Query │ Push API    │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                         Backend (9753)                           │
├─────────────────────────────────────────────────────────────────┤
│  Express Routes │ Auth Middleware │ Notification Service       │
│  Event Service │ Storage Service │ Cleanup Scheduler            │
└─────────────────────────────────────────────────────────────────┘
                    │                       │
                    ▼                       ▼
         ┌──────────────────┐    ┌──────────────────┐
         │   OpenCV (8084)  │    │    Redis (6379) │
         ├──────────────────┤    ├──────────────────┤
         │ Detection Engine │    │ Cache │ Sessions │
         │ Face Recognition │    │ Pub/Sub          │
         │ Video Encoder    │    └──────────────────┘
         └──────────────────┘
                    │
                    ▼
         ┌──────────────────┐
         │  PostgreSQL      │
         ├──────────────────┤
         │ Events │ Users  │
         │ Visitors │ Jobs │
         └──────────────────┘
```

### Data Flow Changes

#### New: Notification Flow
```
Motion Detected → Backend → Notification Service → Web Push API → Browser
                                              → Redis (queue)
```

#### New: Video Recording Flow
```
Event Triggered → Backend → OpenCV → FFmpeg → Record Clip → Store → Event Updated
```

#### New: Storage Management Flow
```
Scheduler (cron) → Cleanup Service → Check Retention → Delete Old Files → Update DB
```

## Build Order

### Phase 1: Detection Improvements
1. Enhance motion detection preprocessing
2. Add multi-frame validation
3. Tune parameters based on feedback
**Boundaries:** Backend detection changes, no new services

### Phase 2: Notifications
1. Add Web Push API support
2. Create notification preferences UI
3. Integrate with existing event system
**Boundaries:** Frontend + Backend, no new services

### Phase 3: Face Recognition
1. Upgrade face matching algorithm
2. Add embedding storage optimization
3. Improve comparison speed
**Boundaries:** OpenCV service changes

### Phase 4: Storage & Video
1. Implement retention policies
2. Add video recording capability
3. Create cleanup scheduler
**Boundaries:** Backend + OpenCV + Filesystem

## Key Integration Points

| Feature | Backend | OpenCV | Frontend | DB |
|---------|---------|--------|----------|-----|
| Better Detection | ✓ | ✓ | - | - |
| Notifications | ✓ | - | ✓ | - |
| Face Matching | ✓ | ✓ | - | ✓ |
| Video Recording | ✓ | ✓ | ✓ | ✓ |
| Storage Mgmt | ✓ | - | ✓ | ✓ |

## Performance Considerations

- **Redis pub/sub** for notification queue (already available)
- **Worker threads** for video encoding (CPU intensive)
- **Lazy loading** for event history
- **WebSocket** for real-time notifications
- **CDN** for static assets (future)

---
*Research completed: 2026-03-18*
