# Phase 3: Face Recognition - Context

**Gathered:** 2026-03-19
**Status:** Ready for planning

## Phase Boundary
Improve face matching accuracy and management UX for the SentryVision home security system. This includes enhancing embedding storage with quality metadata, implementing cosine similarity with configurable threshold, adding visitor management UI, and implementing unknown face handling.

## Implementation Decisions

### Embedding Storage Enhancement (Plan 3.1)
- Store face embeddings with quality metadata (sharpness, brightness, face size, confidence)
- Support multiple embeddings per visitor (up to 10+)
- Implement soft delete capability for recovery
- Use database indexes for fast lookup (visitor_id, quality_score, camera_id, is_active)
- Export FaceEmbedding TypeORM model and register API routes for storage, retrieval, and stats

### Comparison Algorithm Improvement (Plan 3.2)
- Implement cosine similarity for better accuracy vs. Euclidean distance
- Make similarity threshold configurable via API (default 0.6, range 0.3-0.8)
- Add quality filtering (only use embeddings with quality ≥ 60)
- Persist configuration in database with audit logging
- Provide fallback to Euclidean distance if needed
- Register API routes for getting/setting face recognition configuration

### Visitor Management UI (Plan 3.3)
- Create visitors table with photos, tags, notes, statistics (visit count, first/last seen, cameras seen)
- Create visitor_events mapping table to link visitors to events
- Implement TypeORM models for Visitor and VisitorEvent
- Build REST API endpoints for visitor CRUD operations:
  - GET /api/visitors - List visitors with filtering and pagination
  - GET /api/visitors/:id - Get visitor details with recent events
  - POST /api/visitors - Add new visitor from event image
  - PUT /api/visitors/:id - Update visitor name, notes, tags
  - PUT /api/visitors/:id/photo - Update visitor photo from event
  - DELETE /api/visitors/:id - Soft delete visitor
  - GET /api/visitors/:id/stats - Get visitor statistics (visit count, average confidence, etc.)
- Develop React visitor management UI components:
  - VisitorManagement container with search and dialogs
  - VisitorCard for displaying visitor info with actions
  - AddVisitorForm for adding visitors from events
  - EditVisitorForm for updating visitor information
- Extend ApiService with visitor management methods
- Integrate "Add to Visitors" button into event gallery face detections
- Connect visitor management API routes in server/src/index.ts

### Unknown Face Handling (Plan 3.4)
- Create unknown_face_detections table with full metadata (bbox, confidence, embedding vector, similarity scores, matched visitor info)
- Create unknown_face_alerts table for alert management with severity levels (low, medium, high, critical)
- Create unknown_face_patterns table for pattern analysis of recurring unknown faces
- Implement TypeORM models for UnknownFaceDetection, UnknownFaceAlert, UnknownFacePattern
- Build UnknownFaceService to:
  - Track unknown face detections from face recognition results
  - Generate alerts based on severity (time of day, confidence, frequency)
  - Allow marking unknown faces as known visitors
  - Allow dismissing detections
  - Acknowledge alerts
  - Retrieve unknown faces and active alerts with filtering and pagination
  - Update pattern tracking for recurring unknown faces
- Implement API routes for unknown face management:
  - GET /api/unknown-faces - Get unknown face detections with filtering
  - GET /api/unknown-faces/:id - Get unknown face details with associated alerts
  - PUT /api/unknown-faces/:id/mark-known - Mark as known visitor
  - PUT /api/unknown-faces/:id/dismiss - Dismiss unknown face
  - GET /api/unknown-faces/alerts - Get active alerts
  - PUT /api/unknown-faces/alerts/:id/acknowledge - Acknowledge alert
- Integrate unknown face tracking into face recognition flow in detection routes
- Develop React unknown faces gallery UI components:
  - UnknownFacesGallery container
  - UnknownFaceCard for displaying unknown face info with actions
  - MarkAsKnownForm for marking unknown faces as known
- Connect with existing notification system from Phase 2 to send alerts for critical unknown face detections

## Canonical References
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Roadmap References
- .planning/ROADMAP.md — Phase 3: Face Recognition goal and requirements
- .planning/REQUIREMENTS.md — FACE-01 to FACE-05 requirements

### Requirements Details
- .planning/REQUIREMENTS.md — Face recognition requirements specifications
  - FACE-01: Face embeddings stored with quality metadata
  - FACE-02: Face comparison uses cosine similarity with configurable threshold
  - FACE-03: User can manually add known visitor from event image
  - FACE-04: User can update known visitor name/photo from event
  - FACE-05: System marks face as "unknown" when no match above threshold

### Technical References
- `opencv-service/embedding_quality_analyzer.py` — Quality analysis for embeddings
- `opencv-service/cosine_similarity.py` — Cosine similarity implementation
- `opencv-service/enhanced_face_recognition.py` — Enhanced face recognition with configurable threshold
- `server/src/models/FaceEmbedding.ts` — Existing face embedding model (Plan 3.1)
- `server/src/routes/faceEmbeddingRoutes.ts` — Existing face embedding API routes (Plan 3.1)
- `server/src/routes/faceConfigRoutes.ts` — Existing face configuration API routes (Plan 3.2)
- `server/src/detection/motionTriggeredDetection.ts` — Face recognition integration point

## Code Context
## Existing Code Insights

### Reusable Assets
- Socket.io instance — Already configured for real-time communication
- User authentication system — JWT-based auth middleware exists for protecting routes
- Event creation workflow — Face detection already creates events in database
- Notification service — Existing NotificationService from Phase 2 can be used for unknown face alerts
- Logging system — Existing logger can be used for audit trails
- Database connection — Established PostgreSQL connection via TypeORM
- API route structure — Existing routes in server/src/routes/ follow REST conventions
- Frontend component library — shadcn/ui components available for consistent UI
- State management — React Query (@tanstack/react-query) available for server state
- React Router v6 — Available for URL management and navigation

### Established Patterns
- Service layer pattern — Existing services in server/src/services/ follow consistent structure
- TypeORM models — Database models follow established patterns with UUID primary keys and decorators
- Route organization — API routes in server/src/routes/ follow REST conventions with error handling
- Database migrations — Existing migrations in database/migrations/ follow naming convention and SQL format
- Frontend component structure — Components in frontend/src/components/ follow React best practices with hooks
- API service patterns — Existing ApiService in frontend/src/services/ follows REST client patterns

### Integration Points
- Face recognition flow — Hook into server/src/routes/detectionRoutes.ts after recognition results
- Notification service — Integrate with server/src/services/notificationService.ts for alert delivery
- Database — New tables will use same PostgreSQL connection as existing models
- API gateway — New routes will register in server/src/routes/index.ts
- Frontend routing — New components will integrate with existing visitor/gallery pages
- State management — New React Query hooks will follow existing patterns in frontend/src/hooks/

## Specific Ideas
## Specific Ideas
- Use quality thresholds to filter embeddings during recognition (only use high-quality embeddings)
- Implement embedding count limits per visitor to prevent uncontrolled growth
- Add facial liveness detection to prevent spoofing (future enhancement)
- Implement embedding encryption at rest for sensitive biometric data (future enhancement)
- Use Redis cache for frequent recognition lookups to improve performance
- Add embedding export/import functionality for backup and migration
- Implement visitor deduplication based on similarity of embeddings
- Add visitor merging capability when duplicate visitors are identified
- Implement batch processing for unknown face pattern analysis
- Add confidence scoring for unknown face matches to known visitors
- Implement temporal analysis for unknown face patterns (time of day, day of week)
- Add geographical analysis for unknown face patterns (camera location trends)
- Integrate with access control systems for known visitor automation (future enhancement)
- Add visitor privacy controls (GDPR compliance, data deletion requests)

## Deferred Ideas
## Deferred Ideas
- 3D face recognition for improved accuracy — Future phase (advanced biometrics)
- Emotion recognition from face detections — Future phase (behavioral analysis)
- Mask detection during pandemics — Future phase (health safety)
- Age and gender estimation from face detections — Future phase (demographics)
- Celebrity recognition for VIP detection — Future phase (specialized use cases)
- Integration with law enforcement databases for known offenders — Future phase (security)
- Real-time video streaming with face recognition overlays — Future phase (live monitoring)
- Augmented reality displays for visitor information — Future phase (enhanced UI)
- Voice recognition integration for multi-factor authentication — Future phase (multi-modal)
- Blockchain-based embedding storage for tamper-proof logs — Future phase (audit trail)
- Federated learning for improving recognition models across systems — Future phase (ML improvements)

---
*Phase: 03-face-recognition*
*Context gathered: 2026-03-19*