# Phase 04: Storage Management - Discussion Phase

**Status**: 🟡 In Discussion
**Date**: 2026-03-18
**Phase**: 04 - Storage Management
**Participants**: Architecture Team

## Overview

Comprehensive end-to-end analysis of SentryVision's storage management requirements, current implementation, gaps, and implementation decisions for a production-ready storage system.

---

## 1. Current State Analysis

### 1.1 Storage Inventory

#### Filesystem Storage (Current)
```
server/data/
├── batch_processing.db    - 96K    (SQLite batch job metadata)
├── detections/            - 216K   (Events organized by YYYY-MM/)
├── events/                - 0B     (Empty, planned for motion events)
├── faces.db               - 44K    (Face recognition database)
├── logs.db                - 2.3G   (Huge! Logs accumulating)
├── snapshots/             - 0B     (Empty, planned for snapshots)
└── visitors.db            - 948K   (Visitor tracking database)

Total: 2.3 GB (98% is logs.db)
```

#### Database Storage (PostgreSQL)
- **17 tables** tracking events, visitors, batch jobs, reviews, etc.
- **1,050+ events** currently stored
- **detection_files** table exists (migration 003) with file tracking capability
- **storage_stats** table exists for daily statistics
- **retention_policies** table exists for configurable retention

#### Current Issues Identified

| Issue | Severity | Impact |
|-------|----------|--------|
| **logs.db is 2.3GB** | 🔴 Critical | Disk space exhaustion risk |
| **No log rotation** | 🔴 Critical | Unbounded growth continues |
| **detections/ only 216K** | 🟡 Low | Most data in old structure or lost |
| **Empty events/ & snapshots/** | 🟡 Medium | New structure not fully utilized |
| **No active cleanup** | 🟡 Medium | retention_policies table unused |
| **No storage monitoring** | 🟡 Medium | No alerts on space issues |

### 1.2 Database Schema Analysis

#### ✅ Existing Tables (Good Foundation)
```sql
-- File tracking (migration 003)
detection_files (
  file_uuid, file_type, camera_id, storage_path,
  file_size, file_hash, is_archived, is_deleted, metadata
)

-- Storage monitoring (migration 003)
storage_stats (
  stat_date, file_type, total_files, total_size,
  new_files, deleted_files, archived_files
)

-- Retention policies (migration 007)
retention_policies (
  camera, alerts_days, detections_days, previews_days,
  snapshots_days, events_days, retain_indefinitely
)
```

#### ❌ Missing Implementation
- Tables exist but **no code uses them**
- No active file indexing service
- No storage statistics calculation
- Retention policies not enforced
- Cleanup cron jobs not running

### 1.3 Configuration Analysis

#### Environment Variables (.env.example)
```env
# Lines 25-29: Storage Configuration
SNAPSHOTS_DIR=./public/snapshots    # Old path
EVENTS_DIR=./public/events          # Old path
MAX_STORAGE_GB=10                   # No enforcement
RETENTION_DAYS=30                   # No enforcement
```

#### Issues
- Paths reference old `public/` structure
- `MAX_STORAGE_GB` defined but not enforced
- `RETENTION_DAYS` defined but not enforced
- No `DETECTIONS_DIR` for new structure
- No `LOG_DIR` configuration

---

## 2. Requirements Analysis

### 2.1 Functional Requirements

#### FR1: Automated Log Management (Priority: P0)
- **Problem**: logs.db grows unbounded (currently 2.3GB)
- **Requirement**:
  - Implement log rotation (10MB per file, max 10 files)
  - Automatic cleanup of logs older than 7 days
  - Separate application logs from detection logs
  - Compress archived logs (gzip)
  - Alert when log directory exceeds 5GB

#### FR2: File Indexing & Tracking (Priority: P0)
- **Problem**: detection_files table exists but unused
- **Requirement**:
  - Index every file saved to detections/
  - Record file metadata (size, hash, camera, timestamp)
  - Update index on file creation, deletion, move
  - Query files by type, camera, date range
  - Validate file integrity using hashes

#### FR3: Retention Policy Enforcement (Priority: P1)
- **Problem**: retention_policies table exists but not enforced
- **Requirement**:
  - Per-camera retention configuration
  - Different retention for: alerts (30d), detections (7d), previews (7d), snapshots (30d), events (30d)
  - Configurable "indefinite retention" flag
  - Daily cleanup job to enforce policies
  - Soft delete with grace period (7 days) before hard delete

#### FR4: Storage Monitoring & Alerts (Priority: P1)
- **Problem**: storage_stats table exists but not populated
- **Requirement**:
  - Hourly job to calculate storage stats by file type
  - Track total files, total size, new/deleted counts
  - Alert when storage exceeds 80% of MAX_STORAGE_GB
  - Dashboard showing storage trends
  - Per-camera breakdown of storage usage

#### FR5: Archive Management (Priority: P2)
- **Problem**: No archiving of old data
- **Requirement**:
  - Move files older than retention period to archive/
  - Keep archive structure: archive/YYYY-MM/
  - Compress archived files older than 90 days
  - Database track archive status
  - Ability to restore from archive

#### FR6: Cleanup Automation (Priority: P1)
- **Problem**: Manual cleanup only
- **Requirement**:
  - Daily cleanup job based on retention policies
  - Cleanup temp files older than 1 hour
  - Cleanup failed batch results older than 7 days
  - Vacuum detection_files table monthly
  - Reclaim disk space after hard deletes

### 2.2 Non-Functional Requirements

#### NFR1: Performance
- File indexing must not block detection (async)
- Storage stats calculation < 5 seconds
- Cleanup job completes within maintenance window (2-4 AM)
- Database queries on detection_files must use indexes

#### NFR2: Scalability
- Support 10M+ files in detection_files table
- Handle 100GB+ of storage
- Support 100+ events per minute peak load
- Partition detection_files table by year-month

#### NFR3: Reliability
- Zero data loss (soft delete before hard delete)
- File integrity validation (SHA-256 hashes)
- Transactional database operations
- Automatic retry on transient failures

#### NFR4: Maintainability
- Clear logging of all storage operations
- Metrics for monitoring (Prometheus format)
- Health check endpoint for storage status
- Manual override capabilities

#### NFR5: Security
- Encrypt archived files at rest (AES-256)
- Audit log of all file deletions
- RBAC for file access (admin vs viewer)
- Sanitize file paths to prevent directory traversal

---

## 3. Implementation Decisions

### Decision 1: Log Management Strategy
**Status**: ✅ Decided
**Choice**: Implement Winston-based log rotation with daily cleanup

**Rationale**:
- Winston already used (server/src/utils/logger.ts:16-92)
- Supports built-in rotation (maxSize, maxFiles)
- Already has rotate logic (lines 49-91)
- Just needs configuration tuning and cron job for old file cleanup

**Implementation**:
```typescript
// logger.ts - Update configuration
transport: new transports.DailyRotateFile({
  filename: 'application-%DATE%.log',
  datePattern: 'YYYY-MM-DD',
  maxSize: '10m',
  maxFiles: '7d',  // Keep 7 days
  compress: true   // Gzip old files
})
```

### Decision 2: File Indexing Service
**Status**: ✅ Decided
**Choice**: Create dedicated FileIndexingService singleton

**Rationale**:
- Code already exists: server/src/services/fileIndexingService.ts
- Has async file operations (lines 93-432)
- Supports directory reading, file stats, hashing
- Needs integration with detection_files table

**Implementation**:
```typescript
// Singleton service
class FileIndexingService {
  async indexFile(filePath: string, metadata: FileMetadata): Promise<void>
  async queryFiles(filters: FileQuery): Promise<DetectionFile[]>
  async markDeleted(fileUuid: string): Promise<void>
  async calculateStats(date: Date): Promise<StorageStats>
}
```

### Decision 3: Retention Enforcement
**Status**: ✅ Decided
**Choice**: Cron-based daily cleanup with soft-delete cascade

**Rationale**:
- Cron jobs already exist (server/src/utils/cronJobs.ts)
- Archive function already implemented (lines 170-200)
- retention_policies table exists with per-camera config
- Needs activation and policy enforcement logic

**Implementation**:
```typescript
// cronJobs.ts - Add to existing cron schedule
cron.schedule('0 3 * * *', async () => {
  await retentionCleanupService.enforcePolicies();
});
```

### Decision 4: Storage Statistics
**Status**: ✅ Decided
**Choice**: Hourly calculation with database aggregation

**Rationale**:
- storage_stats table exists (migration 003)
- calculate_storage_stats function exists (migration 003:89-114)
- Just needs cron job to execute it hourly
- Add dashboard API endpoint

**Implementation**:
```typescript
// cronJobs.ts - Add hourly stats job
cron.schedule('0 * * * *', async () => {
  await storageService.calculateAndStoreStats();
});
```

### Decision 5: Database Optimization
**Status**: ✅ Decided
**Choice**: Partition detection_files by created_at (year-month)

**Rationale**:
- 10M+ files expected in production
- Partitioning improves query performance
- Easy to drop old partitions (hard delete)
- PostgreSQL native partitioning supported

**Implementation**:
```sql
-- Convert to partitioned table
CREATE TABLE detection_files_partitioned (
  -- Same columns
) PARTITION BY RANGE (created_at);

-- Create partitions
CREATE TABLE detection_files_2026_01 PARTITION OF detection_files_partitioned
  FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');
```

### Decision 6: Configuration Management
**Status**: ✅ Decided
**Choice**: Centralize in server/src/config/storage.config.ts

**Rationale**:
- Current config scattered across .env and code
- Need type-safe configuration
- Easy to validate on startup
- Support per-camera overrides

**Implementation**:
```typescript
// config/storage.config.ts
export interface StorageConfig {
  detectionsDir: string;
  archiveDir: string;
  logDir: string;
  maxStorageGB: number;
  retentionDays: number;
  enableCleanup: boolean;
  enableArchiving: boolean;
  cameraOverrides: Map<string, Partial<StorageConfig>>;
}
```

### Decision 7: Monitoring & Alerting
**Status**: ✅ Decided
**Choice**: Prometheus metrics + health endpoint + SMTP alerts

**Rationale**:
- Prometheus already industry standard
- Health check endpoint already exists (/api/health)
- SMTP configured for notifications
- Can integrate with existing notificationService

**Implementation**:
```typescript
// Metrics to expose
- storage_used_bytes (gauge)
- storage_available_bytes (gauge)
- storage_files_total (gauge)
- storage_cleanup_duration_seconds (histogram)
- storage_indexing_errors_total (counter)
```

---

## 4. Implementation Plan

### Phase 4.1: Log Management (P0) - 4 hours
**Deliverable**: Stop unbounded log growth

**Tasks**:
1. Update Winston configuration (maxSize: 10m, maxFiles: 7d)
2. Implement log compression (gzip)
3. Add cleanup cron for logs older than 7 days
4. Add log directory size alert (>5GB triggers email)
5. Update .env.example with LOG_DIR

**Acceptance**:
- logs.db stops growing at 2.3GB
- Old logs automatically deleted after 7 days
- New logs compressed and rotated
- Alert fires when directory exceeds 5GB

### Phase 4.2: File Indexing Activation (P0) - 6 hours
**Deliverable**: All new detection files indexed

**Tasks**:
1. Create DetectionFile entity (matches detection_files table)
2. Activate FileIndexingService singleton
3. Integrate indexing into:
   - optimizedMotionDetection.ts (line 765: writeFile)
   - motionTriggeredDetection.ts (event saves)
   - rtspManager.ts (snapshot saves, line 591)
   - batchProcessingService.ts (batch results)
4. Add file hash calculation (SHA-256)
5. Test indexing under load (100 events/min)

**Acceptance**:
- Every file saved has record in detection_files
- File metadata accurate (size, hash, path)
- Indexing doesn't block detection (async)
- Can query files by type, camera, date

### Phase 4.3: Retention Enforcement (P1) - 6 hours
**Deliverable**: Automated cleanup based on policies

**Tasks**:
1. Create RetentionPolicy entity
2. Create RetentionCleanupService
3. Implement policy enforcement logic:
   - Query retention_policies table
   - Find files older than retention period
   - Mark as deleted (soft delete)
   - Move to archive/ after grace period
   - Hard delete after archive retention
4. Add cron job (daily 3 AM)
5. Add admin API endpoints:
   - GET /api/storage/policies (list policies)
   - PUT /api/storage/policies/:camera (update)
   - POST /api/storage/cleanup (trigger manual)

**Acceptance**:
- Daily cleanup job runs successfully
- Files deleted according to retention policies
- Soft delete precedes hard delete (7 day grace)
- Archive organized by year-month
- Admin can override policies

### Phase 4.4: Storage Monitoring (P1) - 4 hours
**Deliverable**: Real-time storage visibility

**Tasks**:
1. Activate storage_stats calculation
2. Add cron job (hourly)
3. Create storage metrics:
   - Total storage used
   - Storage by file type
   - Storage by camera
   - Daily growth rate
4. Add API endpoint:
   - GET /api/storage/stats (current stats)
   - GET /api/storage/stats/history (trend data)
5. Add dashboard widget (React component)
6. Add alerting (80% threshold)

**Acceptance**:
- Hourly stats job populates storage_stats
- API returns accurate storage breakdown
- Dashboard shows storage trends
- Alert sent at 80% capacity
- Stats query < 2 seconds

### Phase 4.5: Database Optimization (P2) - 4 hours
**Deliverable**: Scale to 10M+ files

**Tasks**:
1. Partition detection_files by created_at (year-month)
2. Create indexes on partitioned table
3. Add automatic partition creation (cron monthly)
4. Add partition drop logic (for hard delete)
5. Optimize queries (use partition pruning)
6. VACUUM ANALYZE monthly

**Acceptance**:
- detection_files partitioned by month
- Queries use partition pruning (explain analyze)
- Old partitions dropped efficiently
- Performance maintained with 10M rows

### Phase 4.6: Validation & Testing (P1) - 4 hours
**Deliverable**: Production-ready system

**Tasks**:
1. Unit tests for FileIndexingService
2. Integration tests for RetentionCleanupService
3. Load test (1000 events/min)
4. File integrity validation (hash verification)
5. Recovery testing (restore from archive)
6. Performance testing (stats query time)
7. Documentation updates

**Acceptance**:
- All tests passing
- No data loss during cleanup
- File integrity validated
- Performance meets NFRs
- Documentation complete

---

## 5. Open Questions

### Q1: Archive Compression
**Question**: Should we compress archived files older than 90 days?
**Options**:
- A) Yes, gzip all files > 90 days (saves space, slower access)
- B) No, keep as-is (faster access, more space)
- C) Compress only batch results, keep events as-is

**Recommendation**: Option A - gzip is transparent to application, saves 60-80% space

### Q2: Database Partitioning Timeline
**Question**: When to partition detection_files table?
**Options**:
- A) Now (before it grows large)
- B) At 1M records
- C) At 5M records

**Recommendation**: Option A - partition now before migration complexity increases

### Q3: Cleanup Frequency
**Question**: How often to run retention cleanup?
**Options**:
- A) Daily (3 AM)
- B) Weekly (Sunday 3 AM)
- C) Hourly

**Recommendation**: Option A - daily balances load and freshness

### Q4: Soft Delete Grace Period
**Question**: How long to keep soft-deleted files before hard delete?
**Options**:
- A) 7 days
- B) 30 days
- C) Configurable per policy

**Recommendation**: Option A - 7 days sufficient for recovery, keeps storage in check

---

## 6. Risks & Mitigations

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| **Data loss during cleanup** | Low | Critical | Soft delete first, hash validation, 7-day grace period |
| **Performance degradation** | Medium | High | Async indexing, DB partitioning, query optimization |
| **Database corruption** | Low | Critical | Daily backups, transactional operations, integrity checks |
| **Disk space exhaustion** | Medium | High | 80% alert, log rotation, aggressive cleanup if needed |
| **Partitioning migration downtime** | Low | Medium | Schedule during low traffic, test in staging first |
| **Cron job failures** | Medium | Medium | Error alerts, retry logic, manual override available |

---

## 7. Success Criteria

### Must Have (P0)
- [ ] logs.db stops growing, rotated and compressed
- [ ] All new detection files indexed in database
- [ ] Retention cleanup automated (daily cron)
- [ ] Storage monitoring dashboard functional
- [ ] Alerts working (80% threshold)

### Should Have (P1)
- [ ] Archive management implemented
- [ ] Database partitioned for scale
- [ ] File integrity validation (hashes)
- [ ] Admin API for policy management
- [ ] Comprehensive test coverage

### Could Have (P2)
- [ ] Predictive storage analytics
- [ ] Automatic compression of old archives
- [ ] Multi-region backup
- [ ] S3 integration for cold storage

---

## 8. Next Steps

1. **Review this document** with architecture team
2. **Approve implementation plan**
3. **Phase 4.1 kickoff**: Log management (can start immediately)
4. **Create tasks** in project tracking system
5. **Schedule Phase 4.2-4.6** based on team availability

---

## Appendix A: File Inventory

```
Current Production Storage (as of 2026-03-18):
├── server/data/logs.db (2.3GB) 🔴 CRITICAL
├── server/data/visitors.db (948KB)
├── server/data/detections/ (216KB)
│   ├── 2026-01/ (events, snapshots, batch-results, temp)
│   └── archive/ (empty)
├── server/data/batch_processing.db (96KB)
├── server/data/faces.db (44KB)
├── server/data/events/ (0B) - Empty
└── server/data/snapshots/ (0B) - Empty

PostgreSQL Tables:
├── detection_files (0 rows - unused)
├── storage_stats (0 rows - unused)
├── retention_policies (0 rows - unused)
├── events (1,050+ rows)
├── visitor_timeline (active)
├── batch_jobs (active)
└── ... 17 total tables
```

## Appendix B: Environment Variables

```env
# Proposed additions to .env.example
# Storage Configuration
DETECTIONS_DIR=/app/data/detections
ARCHIVE_DIR=/app/data/detections/archive
LOG_DIR=/app/data/logs
MAX_STORAGE_GB=100
RETENTION_DAYS=30
CLEANUP_ENABLED=true
ARCHIVE_ENABLED=true

# Log Configuration
LOG_MAX_SIZE=10m
LOG_MAX_FILES=7d
LOG_COMPRESS=true
LOG_RETENTION_DAYS=7

# Monitoring
STORAGE_ALERT_THRESHOLD=0.8
STORAGE_ALERT_EMAIL=admin@example.com
```
