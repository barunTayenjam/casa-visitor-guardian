# Phase 04: Storage Management - Requirements Specification

**Version**: 1.0
**Date**: 2026-03-18
**Status**: Requirements Finalized

---

## 1. Overview

This document captures the detailed requirements for Phase 04: Storage Management, addressing critical storage issues in SentryVision including unbounded log growth (2.3GB), lack of file indexing, and missing retention policy enforcement.

---

## 2. Current Problems

### Problem 1: Unbounded Log Growth 🔴 CRITICAL
- **Current State**: logs.db is 2.3GB and growing
- **Impact**: Risk of disk exhaustion, degraded performance
- **Root Cause**: No log rotation or cleanup
- **Evidence**: server/data/logs.db = 2.3GB (98% of total storage)

### Problem 2: Unused Database Infrastructure 🟡 MEDIUM
- **Current State**: detection_files, storage_stats, retention_policies tables exist but unused
- **Impact**: No file tracking, no storage visibility, no automated cleanup
- **Root Cause**: Database schema created (migration 003, 007) but never activated
- **Evidence**: 0 rows in detection_files, storage_stats, retention_policies

### Problem 3: No Retention Enforcement 🟡 MEDIUM
- **Current State**: Old files never deleted
- **Impact**: Unbounded storage growth
- **Root Cause**: No cleanup automation
- **Evidence**: detections/ only 216K, old structure not cleaned up

### Problem 4: No Storage Monitoring 🟡 MEDIUM
- **Current State**: Blind to storage usage
- **Impact**: No alerts before space exhaustion
- **Root Cause**: storage_stats table not populated
- **Evidence**: No storage metrics exposed

---

## 3. Functional Requirements

### FR-LOG-001: Automatic Log Rotation
**Priority**: P0 (Critical)
**Description**: Implement log rotation to prevent unbounded growth

**Requirements**:
- Rotate logs when size exceeds 10MB
- Keep maximum 7 days of logs
- Compress rotated logs with gzip
- Store logs in dedicated LOG_DIR
- Support application and detection logs separately

**Acceptance Criteria**:
- logs.db stops growing at 2.3GB
- New logs created in LOG_DIR with date pattern
- Logs older than 7 days automatically deleted
- Compressed logs save 60-80% space
- Application logs separated from detection logs

**Dependencies**:
- Winston logger (already in use)
- Update server/src/utils/logger.ts

### FR-LOG-002: Log Cleanup Automation
**Priority**: P0 (Critical)
**Description**: Automated cleanup of old logs

**Requirements**:
- Daily cron job at 2 AM
- Delete log files older than RETENTION_DAYS (default 7)
- Compress logs older than 1 day
- Alert if log directory exceeds 5GB
- Maintain log of cleanup operations

**Acceptance Criteria**:
- Cron job runs daily without manual intervention
- Old logs deleted automatically
- Cleanup logged to audit_logs table
- Alert email sent when threshold exceeded
- No orphaned log files

### FR-INDEX-001: File Indexing Service
**Priority**: P0 (Critical)
**Description**: Index every detection file in database

**Requirements**:
- Index on file creation (async, non-blocking)
- Record metadata: file_uuid, type, camera, path, size, hash, timestamp
- Support file types: event_face, event_motion, snapshot, batch_result, temp
- Calculate SHA-256 hash for integrity
- Update index on file move, delete, archive

**Acceptance Criteria**:
- 100% of new files indexed within 1 second of creation
- Metadata accurate (hash verification passes)
- Indexing doesn't block detection (<50ms overhead)
- Can query files by type, camera, date range
- Database contains accurate file count

**Dependencies**:
- DetectionFile entity (TypeORM)
- FileIndexingService singleton
- Integration points: optimizedMotionDetection, motionTriggeredDetection, rtspManager, batchProcessingService

### FR-INDEX-002: File Query API
**Priority**: P1 (High)
**Description**: Query indexed files with filters

**Requirements**:
- REST API endpoint: GET /api/storage/files
- Query parameters: fileType, cameraId, startDate, endDate, isArchived, isDeleted
- Pagination support (page, pageSize)
- Sorting options (timestamp, size, camera)
- Response includes metadata and URLs

**Acceptance Criteria**:
- API returns filtered file list
- Query time < 2 seconds for 1M records
- Pagination works correctly
- Filters can be combined
- Metadata includes detection results (objects, faces, confidence)

### FR-RETENTION-001: Policy Enforcement
**Priority**: P1 (High)
**Description**: Enforce retention policies automatically

**Requirements**:
- Daily cron job at 3 AM
- Query retention_policies table for per-camera rules
- Support retention types: alerts (30d), detections (7d), previews (7d), snapshots (30d), events (30d)
- Soft delete first (mark is_deleted=true)
- Move to archive after grace period (7 days)
- Hard delete after archive retention
- Support "indefinite retention" flag

**Acceptance Criteria**:
- Policies enforced daily without manual intervention
- Per-camera overrides respected
- Soft delete precedes hard delete (7-day grace)
- Archive organized by year-month
- Audit trail of all deletions

**Dependencies**:
- RetentionPolicy entity (TypeORM)
- RetentionCleanupService
- Cron job scheduler

### FR-RETENTION-002: Policy Management API
**Priority**: P1 (High)
**Description**: Admin API for managing retention policies

**Requirements**:
- GET /api/storage/policies - List all policies
- PUT /api/storage/policies/:camera - Update policy
- POST /api/storage/cleanup - Trigger manual cleanup
- GET /api/storage/cleanup/status - Get cleanup status
- RBAC: Admin only

**Acceptance Criteria**:
- Admin can view all policies
- Admin can update per-camera retention
- Manual cleanup triggered on demand
- Status shows progress and results
- Non-admin requests rejected with 403

### FR-MONITOR-001: Storage Statistics Calculation
**Priority**: P1 (High)
**Description**: Calculate and store storage statistics

**Requirements**:
- Hourly cron job
- Calculate stats by file type and camera
- Metrics: total_files, total_size, new_files, deleted_files, archived_files
- Store in storage_stats table
- Keep 90 days of history

**Acceptance Criteria**:
- Hourly job populates storage_stats
- Stats accurate (verified against filesystem)
- Historical data maintained for 90 days
- Query time < 1 second
- Stats used for dashboard and alerts

### FR-MONITOR-002: Storage Monitoring Dashboard
**Priority**: P1 (High)
**Description**: Real-time storage visibility

**Requirements**:
- Dashboard widget showing:
  - Total storage used (gauge)
  - Storage by file type (pie chart)
  - Storage by camera (bar chart)
  - Daily growth trend (line chart)
  - Time to exhaustion (projection)
- Auto-refresh every 60 seconds
- Alert when storage exceeds 80%

**Acceptance Criteria**:
- Dashboard displays all metrics
- Charts render correctly with sample data
- Auto-refresh works
- Alert banner appears at 80%
- Data loads in < 3 seconds

### FR-MONITOR-003: Storage Alerting
**Priority**: P1 (High)
**Description**: Alert on storage issues

**Requirements**:
- Alert thresholds: 80% (warning), 90% (critical), 95% (emergency)
- Email alerts to STORAGE_ALERT_EMAIL
- Include details: usage, trend, top contributors
- Retry failed alerts 3 times
- Rate limit: max 1 alert per hour

**Acceptance Criteria**:
- Alerts sent at thresholds
- Email contains actionable information
- Alerts retry on failure
- No alert spam (rate limited)
- Alert logged to notification_log

### FR-ARCHIVE-001: Archive Management
**Priority**: P2 (Medium)
**Description**: Move old files to archive

**Requirements**:
- Move files older than retention to archive/YYYY-MM/
- Maintain detection_files records (update is_archived=true)
- Compress archived files older than 90 days (gzip)
- Support restore from archive
- Periodically verify archive integrity

**Acceptance Criteria**:
- Old files moved to archive
- Archive structure organized by date
- Compressed files save space
- Restore operation works
- Integrity checks pass

### FR-CLEANUP-001: Temp File Cleanup
**Priority**: P1 (High)
**Description**: Clean up temporary files

**Requirements**:
- Delete temp files older than 1 hour
- Cleanup failed batch results older than 7 days
- Run hourly
- Log cleanup operations

**Acceptance Criteria**:
- Temp files cleaned up hourly
- No stale temp files > 1 hour
- Failed batch results removed after 7 days
- Cleanup logged to audit

### FR-PERF-001: Database Partitioning
**Priority**: P2 (Medium)
**Description**: Partition detection_files for scale

**Requirements**:
- Partition by created_at (year-month)
- Auto-create partitions monthly
- Drop old partitions after hard delete
- Optimize queries for partition pruning

**Acceptance Criteria**:
- detection_files partitioned
- Queries use partition pruning
- Old partitions dropped efficiently
- Performance maintained at 10M rows

---

## 4. Non-Functional Requirements

### NFR-PERF-001: Indexing Performance
**Requirement**: File indexing must not block detection
- Async indexing with queue
- Max 50ms overhead per detection
- Handle 100 events/minute peak load

### NFR-PERF-002: Query Performance
**Requirement**: Storage queries must be fast
- File list query: < 2 seconds (1M records)
- Stats calculation: < 5 seconds
- Dashboard load: < 3 seconds

### NFR-PERF-003: Cleanup Performance
**Requirement**: Cleanup must complete in maintenance window
- Daily cleanup: < 1 hour
- Run during low traffic (2-4 AM)
- Minimal impact on system performance

### NFR-SCALE-001: Storage Scale
**Requirement**: Support production-scale storage
- Handle 10M+ files in detection_files
- Support 100GB+ of storage
- Support 100+ events/minute peak
- Scale to 10+ cameras

### NFR-RELIABILITY-001: Data Integrity
**Requirement**: Zero data loss
- SHA-256 hash for every file
- Integrity verification on access
- Soft delete before hard delete
- Transactional database operations

### NFR-RELIABILITY-002: Availability
**Requirement**: System must remain available
- Async operations (no blocking)
- Graceful degradation on errors
- Automatic retry on transient failures
- No single point of failure

### NFR-MAINT-001: Monitoring
**Requirement**: Comprehensive observability
- Prometheus metrics for storage operations
- Structured logging (JSON format)
- Health check endpoint
- Audit trail for deletions

### NFR-MAINT-002: Debugging
**Requirement**: Easy troubleshooting
- Clear error messages
- Request IDs for tracing
- Detailed operation logs
- Manual override capabilities

### NFR-SEC-001: Access Control
**Requirement**: Secure file access
- RBAC for file operations (admin, user, viewer)
- Sanitize file paths (prevent traversal)
- Audit log of all deletions
- Encrypt archived files (AES-256)

### NFR-SEC-002: Data Protection
**Requirement**: Protect sensitive data
- Encrypt files at rest (optional)
- Secure hash calculation
- No credentials in logs
- GDPR compliance (right to deletion)

---

## 5. Technical Requirements

### TR-001: Technology Stack
- **Database**: PostgreSQL 15+ (already in use)
- **ORM**: TypeORM (already in use)
- **Logger**: Winston (already in use)
- **Cron**: node-cron (already in use)
- **Hash**: Node.js crypto (built-in)

### TR-002: Database Schema
**Existing tables to activate**:
- detection_files (migration 003)
- storage_stats (migration 003)
- retention_policies (migration 007)

**New entities required**:
- DetectionFile (TypeORM entity for detection_files)
- RetentionPolicy (TypeORM entity for retention_policies)
- StorageStats (TypeORM entity for storage_stats)

**Indexes required**:
- idx_detection_files_file_type
- idx_detection_files_camera_id
- idx_detection_files_capture_timestamp
- idx_detection_files_created_at
- idx_detection_files_is_archived
- idx_detection_files_is_deleted
- idx_storage_stats_stat_date
- idx_storage_stats_file_type

### TR-003: Environment Variables
```env
# Required additions
DETECTIONS_DIR=/app/data/detections
ARCHIVE_DIR=/app/data/detections/archive
LOG_DIR=/app/data/logs
MAX_STORAGE_GB=100
RETENTION_DAYS=30
CLEANUP_ENABLED=true
ARCHIVE_ENABLED=true

# Log configuration
LOG_MAX_SIZE=10m
LOG_MAX_FILES=7d
LOG_COMPRESS=true
LOG_RETENTION_DAYS=7

# Monitoring
STORAGE_ALERT_THRESHOLD=0.8
STORAGE_ALERT_EMAIL=admin@example.com
```

### TR-004: API Endpoints
**New endpoints required**:
- GET /api/storage/files - List files with filters
- GET /api/storage/files/:fileUuid - Get file metadata
- DELETE /api/storage/files/:fileUuid - Soft delete file
- POST /api/storage/files/archive - Archive files
- GET /api/storage/policies - List retention policies
- PUT /api/storage/policies/:camera - Update policy
- POST /api/storage/cleanup - Trigger manual cleanup
- GET /api/storage/cleanup/status - Cleanup status
- GET /api/storage/stats - Current storage stats
- GET /api/storage/stats/history - Historical stats

### TR-005: Cron Jobs
**Required cron schedules**:
- 0 2 * * * - Log cleanup (daily 2 AM)
- 0 3 * * * - Retention enforcement (daily 3 AM)
- 0 * * * * - Storage statistics (hourly)
- 0 * * * * - Temp file cleanup (hourly)
- 0 4 * * 0 - Database vacuum (weekly 4 AM Sunday)

### TR-006: File Naming Convention
**Standardized format**: `{type}_{camera}_{timestamp}.{ext}`

Examples:
- event_face_cam1_1760618163997.jpg
- event_motion_cam1_1735206400000Z.jpg
- snapshot_cam1_1735206400000Z.jpg
- batch_1767021276777_2fdx549in.json
- temp_1767021276777_cam1.jpg

### TR-007: Directory Structure
```
/data/
├── detections/
│   ├── YYYY-MM/
│   │   ├── events/
│   │   │   ├── faces/
│   │   │   └── motion/
│   │   ├── snapshots/
│   │   ├── batch-results/
│   │   └── temp/
│   └── archive/
│       └── YYYY-MM/
├── logs/
│   ├── application-YYYY-MM-DD.log
│   ├── detection-YYYY-MM-DD.log
│   └── archive/
└── database/
    └── postgres/
```

---

## 6. Constraints

### CONSTR-001: Downtime
- Max 1 hour downtime for database partitioning migration
- Schedule during low traffic (weekend 2-4 AM)

### CONSTR-002: Backward Compatibility
- Maintain support for old file paths during transition
- API must remain stable for existing clients

### CONSTR-003: Resource Limits
- Cron jobs must not exceed 20% CPU
- Memory usage must stay within container limits

### CONSTR-004: Data Protection
- No hard delete without 7-day soft delete period
- All deletions must be auditable

### CONSTR-005: Compliance
- Support GDPR "right to be forgotten"
- Maintain audit logs for 90 days

---

## 7. Assumptions

### ASSUM-001: Infrastructure
- PostgreSQL database available and accessible
- Filesystem supports POSIX permissions
- Sufficient disk space for transition period (2x current)

### ASSUM-002: Operations
- Maintenance window available (2-4 AM daily)
- Team available for deployment and monitoring
- Backup strategy in place

### ASSUM-003: Growth Rate
- Storage growth: ~1GB per month per camera
- Event rate: ~50 events/day per camera
- Scale to 10 cameras in production

---

## 8. Dependencies

### DEP-001: Internal
- Detection services (optimizedMotionDetection, motionTriggeredDetection)
- Stream manager (rtspManager)
- Batch processing service
- Notification service (for alerts)

### DEP-002: External
- PostgreSQL 15+
- Node.js 18+
- Docker (for containerized deployment)

### DEP-003: Documentation
- AGENTS.md (to be updated)
- API documentation (to be created)
- Runbooks (to be created)

---

## 9. Acceptance Criteria Summary

### Phase 4.1: Log Management (P0)
- ✅ logs.db stops growing
- ✅ New logs rotated and compressed
- ✅ Old logs deleted after 7 days
- ✅ Alert at 5GB log directory

### Phase 4.2: File Indexing (P0)
- ✅ All new files indexed
- ✅ Metadata accurate (hash verified)
- ✅ Indexing async (<50ms overhead)
- ✅ Query API functional

### Phase 4.3: Retention Enforcement (P1)
- ✅ Daily cleanup job running
- ✅ Policies enforced per camera
- ✅ Soft delete → Archive → Hard delete flow
- ✅ Admin API functional

### Phase 4.4: Storage Monitoring (P1)
- ✅ Hourly stats calculated
- ✅ Dashboard displaying metrics
- ✅ Alerts working (80% threshold)
- ✅ API endpoints functional

### Phase 4.5: Database Optimization (P2)
- ✅ detection_files partitioned
- ✅ Queries using partition pruning
- ✅ Old partitions dropped efficiently
- ✅ Performance maintained at scale

### Phase 4.6: Validation (P1)
- ✅ All tests passing
- ✅ No data loss
- ✅ Performance meets NFRs
- ✅ Documentation complete

---

## 10. Success Metrics

### Metric 1: Storage Growth Rate
- **Target**: < 5GB/month per camera (with retention)
- **Baseline**: Currently unbounded

### Metric 2: Log Directory Size
- **Target**: < 1GB (with rotation)
- **Baseline**: 2.3GB and growing

### Metric 3: File Index Coverage
- **Target**: 100% of new files indexed
- **Baseline**: 0% (not implemented)

### Metric 4: Cleanup Automation
- **Target**: 100% automated (zero manual cleanup)
- **Baseline**: 0% (manual only)

### Metric 5: Storage Visibility
- **Target**: Real-time metrics on dashboard
- **Baseline**: No visibility

### Metric 6: Query Performance
- **Target**: < 2 seconds for 1M records
- **Baseline**: N/A (no indexing)

---

## 11. Open Questions

### Q1: Archive Compression
**Status**: Pending decision
**Impact**: Storage savings vs access speed
**Recommendation**: Compress files > 90 days (Option A)

### Q2: Partitioning Timeline
**Status**: Pending decision
**Impact**: Migration complexity
**Recommendation**: Partition now before data grows (Option A)

### Q3: Cleanup Frequency
**Status**: Pending decision
**Impact**: System load vs data freshness
**Recommendation**: Daily at 3 AM (Option A)

### Q4: Grace Period Duration
**Status**: Pending decision
**Impact**: Recovery window vs storage growth
**Recommendation**: 7 days (Option A)

---

## 12. Change Log

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-03-18 | Architecture Team | Initial requirements specification |
