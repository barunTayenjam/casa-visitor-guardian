# Phase 04: Storage Management - Implementation Decisions

**Version**: 1.0
**Date**: 2026-03-18
**Status**: Decisions Captured

---

## Overview

This document captures all implementation decisions made during the GSD discussion phase for storage management. Each decision includes the choice made, rationale, alternatives considered, and implications.

---

## Decision Log

### Decision 001: Log Management Strategy
**Status**: ✅ Approved
**Category**: Architecture
**Priority**: P0 (Critical)

**Problem**: logs.db is 2.3GB and growing unbounded

**Decision Made**: Implement Winston-based log rotation with daily cleanup

**Rationale**:
- Winston already integrated (server/src/utils/logger.ts)
- Built-in rotation support (maxSize, maxFiles, datePattern)
- Existing code has rotation logic (lines 49-91) just needs tuning
- Industry-standard solution with proven reliability

**Alternatives Considered**:
1. **Logrotate (Linux system level)** - Rejected due to Docker container constraints
2. **Custom rotation script** - Rejected due to maintenance overhead
3. **External logging service (ELK)** - Rejected due to complexity for this use case

**Implementation Details**:
```typescript
// Update server/src/utils/logger.ts
const transport = new transports.DailyRotateFile({
  filename: 'application-%DATE%.log',
  datePattern: 'YYYY-MM-DD',
  maxSize: '10m',
  maxFiles: '7d',
  compress: true,
  dirname: config.storage.logDir
});

// Add cleanup cron
cron.schedule('0 2 * * *', async () => {
  await cleanupOldLogs(logDir, 7); // Delete logs older than 7 days
});
```

**Implications**:
- **Positive**: Stops unbounded growth, reduces storage by 60-80%
- **Negative**: Requires 2-4 hour implementation effort
- **Risk**: Low (Winston well-tested)
- **Dependencies**: Winston library (already in use)

**Metrics**:
- Target: logs.db < 1GB within 7 days
- Current: 2.3GB
- Compression ratio: 60-80%

---

### Decision 002: File Indexing Service Architecture
**Status**: ✅ Approved
**Category**: Architecture
**Priority**: P0 (Critical)

**Problem**: detection_files table exists but unused, no file tracking

**Decision Made**: Create dedicated FileIndexingService singleton with async queue

**Rationale**:
- Code already exists (server/src/services/fileIndexingService.ts)
- Has async file operations (lines 93-432)
- Supports directory reading, stats, hashing
- Singleton pattern ensures single indexing queue
- Async processing doesn't block detection

**Alternatives Considered**:
1. **Inline indexing in detection modules** - Rejected (blocks detection)
2. **Message queue (RabbitMQ/Redis)** - Rejected (overkill, adds dependency)
3. **Batch indexing every hour** - Rejected (too stale, risk of data loss)

**Implementation Details**:
```typescript
// server/src/services/fileIndexingService.ts
class FileIndexingService {
  private indexingQueue: Map<string, FileMetadata> = new Map();

  async indexFile(filePath: string, metadata: FileMetadata): Promise<void> {
    // Async, non-blocking
    this.indexingQueue.set(filePath, metadata);
    await this.processQueue();
  }

  async processQueue(): Promise<void> {
    // Batch insert into detection_files table
  }
}

export const fileIndexingService = FileIndexingService.getInstance();
```

**Integration Points**:
- optimizedMotionDetection.ts:765 (writeFile callback)
- motionTriggeredDetection.ts (event saves)
- rtspManager.ts:591 (snapshot saves)
- batchProcessingService.ts (batch results)

**Implications**:
- **Positive**: 100% file tracking, fast queries, integrity checks
- **Negative**: Adds 10-50ms overhead per detection
- **Risk**: Medium (queue overflow under heavy load)
- **Mitigation**: Queue size monitoring, backpressure handling

**Metrics**:
- Target: < 50ms indexing overhead
- Target: 100% coverage (all files indexed)
- Target: < 1 second from file save to DB record

---

### Decision 003: Retention Enforcement Mechanism
**Status**: ✅ Approved
**Category**: Architecture
**Priority**: P1 (High)

**Problem**: retention_policies table exists but not enforced

**Decision Made**: Cron-based daily cleanup with soft-delete cascade

**Rationale**:
- Cron infrastructure exists (server/src/utils/cronJobs.ts)
- Archive function already implemented (lines 170-200)
- retention_policies table has per-camera configuration
- Soft delete provides recovery window
- Daily schedule balances load and freshness

**Alternatives Considered**:
1. **Real-time deletion on event creation** - Rejected (adds latency)
2. **Weekly cleanup** - Rejected (storage grows too much)
3. **Manual admin trigger only** - Rejected (not automated)

**Implementation Details**:
```typescript
// server/src/services/retentionCleanupService.ts
async enforcePolicies(): Promise<CleanupResult> {
  const policies = await RetentionPolicy.find();
  const results = [];

  for (const policy of policies) {
    const files = await DetectionFile.find({
      where: {
        cameraId: policy.camera,
        createdAt: LessThan(new Date(Date.now() - policy.detectionsDays * 86400000))
      }
    });

    // Soft delete first
    await DetectionFile.update(files.map(f => f.id), { isDeleted: true });

    // Move to archive after grace period
    await archiveFiles(files);

    // Hard delete after archive retention
    await hardDeleteArchivedFiles(policy);
  }
}

// cronJobs.ts - Add to existing cron schedule
cron.schedule('0 3 * * *', async () => {
  await retentionCleanupService.enforcePolicies();
});
```

**Cleanup Flow**:
1. **Day 0**: File created
2. **Day N (retention period)**: Soft delete (isDeleted=true)
3. **Day N+7**: Move to archive/
4. **Day N+7+archive_retention**: Hard delete (file + DB record)

**Implications**:
- **Positive**: Automated, policy-driven, per-camera flexibility
- **Negative**: 7-day grace period uses extra storage
- **Risk**: Low (soft delete prevents data loss)
- **Dependencies**: RetentionPolicy entity, cron scheduler

**Metrics**:
- Target: Daily cleanup completes in < 1 hour
- Target: Zero data loss (verified by hashes)
- Target: Storage growth = linear (not unbounded)

---

### Decision 004: Storage Statistics Approach
**Status**: ✅ Approved
**Category**: Architecture
**Priority**: P1 (High)

**Problem**: storage_stats table exists but not populated

**Decision Made**: Hourly calculation with database aggregation

**Rationale**:
- storage_stats table exists (migration 003)
- calculate_storage_stats function exists (migration 003:89-114)
- Hourly granularity provides good balance
- Database aggregation is fast with indexes
- Enables trend analysis and alerting

**Alternatives Considered**:
1. **Real-time stats on every file operation** - Rejected (too expensive)
2. **Daily stats only** - Rejected (not timely enough for alerts)
3. **Filesystem-based stats** - Rejected (doesn't track by type/camera)

**Implementation Details**:
```typescript
// server/src/services/storageStatsService.ts
async calculateAndStoreStats(): Promise<void> {
  const stats = await DetectionFile
    .createQueryBuilder('file')
    .select('file.fileType', 'fileType')
    .addSelect('COUNT(*)', 'totalFiles')
    .addSelect('SUM(file.fileSize)', 'totalSize')
    .where('file.createdAt >= :today', { today: startOfDay() })
    .groupBy('file.fileType')
    .getRawMany();

  for (const stat of stats) {
    await StorageStats.insert({
      statDate: new Date(),
      fileType: stat.fileType,
      totalFiles: parseInt(stat.totalFiles),
      totalSize: parseInt(stat.totalSize),
      calculatedAt: new Date()
    });
  }
}

// cronJobs.ts
cron.schedule('0 * * * *', async () => {
  await storageStatsService.calculateAndStoreStats();
});
```

**API Endpoints**:
```typescript
GET /api/storage/stats
// Returns current stats by file type

GET /api/storage/stats/history?days=30
// Returns historical trend data
```

**Implications**:
- **Positive**: Real-time visibility, trend analysis, alerting
- **Negative**: Hourly overhead (minimal with indexes)
- **Risk**: Low (fast query with proper indexes)
- **Dependencies**: StorageStats entity, cron scheduler

**Metrics**:
- Target: Calculation < 5 seconds
- Target: API response < 2 seconds
- Target: Dashboard refresh < 3 seconds

---

### Decision 005: Database Partitioning Strategy
**Status**: ✅ Approved
**Category**: Performance
**Priority**: P2 (Medium)

**Problem**: detection_files table will grow to 10M+ rows

**Decision Made**: Partition detection_files by created_at (year-month)

**Rationale**:
- PostgreSQL native partitioning supported
- Partition pruning improves query performance
- Easy to drop old partitions (hard delete)
- Monthly partition size manageable (~1M rows)
- Can schedule automatic partition creation

**Alternatives Considered**:
1. **No partitioning (rely on indexes)** - Rejected (performance degrades > 5M rows)
2. **Partition by camera_id** - Rejected (uneven distribution)
3. **Sharding across databases** - Rejected (overkill for current scale)

**Implementation Details**:
```sql
-- Convert to partitioned table
CREATE TABLE detection_files_partitioned (
  -- Same columns as detection_files
) PARTITION BY RANGE (created_at);

-- Create partitions
CREATE TABLE detection_files_2026_01 PARTITION OF detection_files_partitioned
  FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');

CREATE TABLE detection_files_2026_02 PARTITION OF detection_files_partitioned
  FOR VALUES FROM ('2026-02-01') TO ('2026-03-01');

-- Automatic partition creation (cron monthly)
CREATE OR REPLACE FUNCTION create_monthly_partition()
RETURNS void AS $$
DECLARE
  partition_name text;
  start_date text;
  end_date text;
BEGIN
  partition_name := 'detection_files_' || to_char(CURRENT_DATE + interval '1 month', 'YYYY_MM');
  start_date := to_char(CURRENT_DATE + interval '1 month', 'YYYY-MM') || '-01';
  end_date := to_char(CURRENT_DATE + interval '2 months', 'YYYY-MM') || '-01';

  EXECUTE format(
    'CREATE TABLE IF NOT EXISTS %I PARTITION OF detection_files_partitioned FOR VALUES FROM (%L) TO (%L)',
    partition_name, start_date, end_date
  );
END;
$$ LANGUAGE plpgsql;

-- Drop old partition (after hard delete)
DROP TABLE IF EXISTS detection_files_2024_12;
```

**Migration Strategy**:
1. Create partitioned table alongside existing table
2. Backfill data from old table to partitioned table
3. Switch queries to use partitioned table
4. Drop old table after validation period
5. Downtime: < 1 hour during switch

**Implications**:
- **Positive**: Queries remain fast at 10M+ rows, easy cleanup
- **Negative**: 1-time migration effort (4 hours)
- **Risk**: Medium (migration complexity)
- **Mitigation**: Test in staging, use backup

**Metrics**:
- Target: Query time < 2 seconds at 10M rows
- Target: Partition pruning used (verify with EXPLAIN)
- Target: Partition drop < 1 second

---

### Decision 006: Configuration Management
**Status**: ✅ Approved
**Category**: Developer Experience
**Priority**: P1 (High)

**Problem**: Configuration scattered across .env and code

**Decision Made**: Centralize in server/src/config/storage.config.ts

**Rationale**:
- Type-safe configuration with TypeScript interfaces
- Single source of truth
- Easy to validate on startup
- Support per-camera overrides
- Better testability (can mock config)

**Alternatives Considered**:
1. **Keep using .env only** - Rejected (no type safety, scattered)
2. **Runtime config API** - Rejected (adds complexity)
3. **Hardcode defaults** - Rejected (not flexible)

**Implementation Details**:
```typescript
// server/src/config/storage.config.ts
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

export const storageConfig: StorageConfig = {
  detectionsDir: process.env.DETECTIONS_DIR || '/app/data/detections',
  archiveDir: process.env.ARCHIVE_DIR || '/app/data/detections/archive',
  logDir: process.env.LOG_DIR || '/app/data/logs',
  maxStorageGB: parseInt(process.env.MAX_STORAGE_GB || '100'),
  retentionDays: parseInt(process.env.RETENTION_DAYS || '30'),
  enableCleanup: process.env.CLEANUP_ENABLED === 'true',
  enableArchiving: process.env.ARCHIVE_ENABLED === 'true',
  cameraOverrides: new Map()
};

// Validation on startup
export function validateStorageConfig(): void {
  if (!storageConfig.detectionsDir) {
    throw new Error('DETECTIONS_DIR not configured');
  }
  // ... more validation
}
```

**Environment Variables**:
```env
# Add to .env.example
DETECTIONS_DIR=/app/data/detections
ARCHIVE_DIR=/app/data/detections/archive
LOG_DIR=/app/data/logs
MAX_STORAGE_GB=100
RETENTION_DAYS=30
CLEANUP_ENABLED=true
ARCHIVE_ENABLED=true
```

**Implications**:
- **Positive**: Type-safe, centralized, testable
- **Negative**: Migration effort to update all references
- **Risk**: Low (backward compatible with .env)
- **Dependencies**: None

---

### Decision 007: Monitoring & Alerting Strategy
**Status**: ✅ Approved
**Category**: Operations
**Priority**: P1 (High)

**Problem**: No visibility into storage issues

**Decision Made**: Prometheus metrics + health endpoint + SMTP alerts

**Rationale**:
- Prometheus industry standard for metrics
- Health endpoint already exists (/api/health)
- SMTP already configured for notifications
- Can integrate with existing notificationService
- Grafana dashboard for visualization

**Alternatives Considered**:
1. **Custom metrics only** - Rejected (no standard integration)
2. **CloudWatch/Azure Monitor** - Rejected (cloud-specific)
3. **Email alerts only** - Rejected (no trends or graphs)

**Implementation Details**:
```typescript
// Metrics to expose
const metrics = {
  storage_used_bytes: new Gauge({
    name: 'storage_used_bytes',
    help: 'Total storage used in bytes',
    labelNames: ['file_type', 'camera']
  }),
  storage_available_bytes: new Gauge({
    name: 'storage_available_bytes',
    help: 'Available storage in bytes'
  }),
  storage_cleanup_duration_seconds: new Histogram({
    name: 'storage_cleanup_duration_seconds',
    help: 'Duration of cleanup operations',
    buckets: [1, 5, 10, 30, 60, 300]
  }),
  storage_indexing_errors_total: new Counter({
    name: 'storage_indexing_errors_total',
    help: 'Total indexing errors'
  })
};

// Update /api/health endpoint
app.get('/api/health', async (req, res) => {
  const storageHealth = await storageService.getHealth();
  res.json({
    status: 'ok',
    storage: storageHealth,
    timestamp: new Date()
  });
});

// Alert integration
async function checkStorageThreshold(): Promise<void> {
  const stats = await storageService.getStats();
  const usagePercent = stats.usedBytes / stats.totalBytes;

  if (usagePercent >= 0.8) {
    await notificationService.sendAlert({
      type: 'STORAGE_WARNING',
      message: `Storage at ${usagePercent * 100}%`,
      severity: usagePercent >= 0.9 ? 'critical' : 'warning'
    });
  }
}
```

**Dashboard Widgets**:
1. Storage gauge (total used vs available)
2. Storage by file type (pie chart)
3. Storage by camera (bar chart)
4. Daily growth trend (line chart)
5. Cleanup duration (histogram)

**Implications**:
- **Positive**: Real-time visibility, proactive alerts, trend analysis
- **Negative**: Adds Prometheus dependency
- **Risk**: Low (Prometheus mature and stable)
- **Dependencies**: prom-client library, Grafana

**Metrics**:
- Target: Alert triggers at 80%, 90%, 95%
- Target: Metrics scraped every 15 seconds
- Target: Dashboard refresh < 3 seconds

---

### Decision 008: Archive Compression Policy
**Status**: ✅ Approved
**Category**: Storage Optimization
**Priority**: P2 (Medium)

**Problem**: Archive grows indefinitely

**Decision Made**: Compress archived files older than 90 days with gzip

**Rationale**:
- gzip is transparent to application (auto-decompress on read)
- Saves 60-80% space on images
- 90-day threshold balances access speed vs space
- Still searchable via database (metadata uncompressed)

**Alternatives Considered**:
1. **No compression** - Rejected (wastes space)
2. **Compress all archived files immediately** - Rejected (slows archive operation)
3. **Use specialized image compression (WebP)** - Rejected (adds complexity)

**Implementation Details**:
```typescript
// cron job - Weekly
cron.schedule('0 5 * * 0', async () => {
  const ninetyDaysAgo = new Date(Date.now() - 90 * 86400000);
  const files = await DetectionFile.find({
    where: {
      isArchived: true,
      createdAt: LessThan(ninetyDaysAgo)
    }
  });

  for (const file of files) {
    if (!file.storagePath.endsWith('.gz')) {
      await compressFile(file.storagePath);
      await DetectionFile.update(file.id, {
        storagePath: file.storagePath + '.gz'
      });
    }
  }
});

async function compressFile(filePath: string): Promise<void> {
  const gzip = createGzip();
  const source = createReadStream(filePath);
  const dest = createWriteStream(filePath + '.gz');
  await pipeline(source, gzip, dest);
  await unlink(filePath);
}
```

**Implications**:
- **Positive**: Saves 60-80% space, transparent to app
- **Negative**: Slower access to compressed files (decompress on read)
- **Risk**: Low (gzip mature and stable)
- **Dependencies**: Node.js zlib (built-in)

**Metrics**:
- Target: 60-80% space savings
- Target: Decompression overhead < 100ms per file

---

### Decision 009: Soft Delete Grace Period
**Status**: ✅ Approved
**Category**: Data Protection
**Priority**: P1 (High)

**Problem**: Need recovery window before hard delete

**Decision Made**: 7-day grace period for soft-deleted files

**Rationale**:
- 7 days sufficient for user recovery
- Keeps storage growth in check (not too long)
- Balances data protection vs storage efficiency
- Aligns with industry standards (Gmail, Dropbox)

**Alternatives Considered**:
1. **No grace period (hard delete immediately)** - Rejected (risk of data loss)
2. **30 days** - Rejected (uses too much storage)
3. **Configurable per user** - Rejected (adds complexity)

**Implementation Details**:
```typescript
// Cleanup flow with grace period
async enforceRetentionPolicy(policy: RetentionPolicy): Promise<void> {
  const retentionDate = new Date(Date.now() - policy.detectionsDays * 86400000);

  // Step 1: Soft delete (mark isDeleted=true)
  await DetectionFile.update(
    { createdAt: LessThan(retentionDate), isDeleted: false },
    { isDeleted: true, deletedAt: new Date() }
  );

  // Step 2: After 7 days, move to archive
  const gracePeriodDate = new Date(Date.now() - 7 * 86400000);
  const filesToArchive = await DetectionFile.find({
    where: {
      isDeleted: true,
      deletedAt: LessThan(gracePeriodDate)
    }
  });
  await archiveFiles(filesToArchive);

  // Step 3: After archive retention, hard delete
  const archiveRetentionDate = new Date(Date.now() - policy.archiveRetentionDays * 86400000);
  await DetectionFile.delete({
    isArchived: true,
    archivedAt: LessThan(archiveRetentionDate)
  });
}
```

**User Recovery**:
```typescript
// Admin API to restore soft-deleted files
POST /api/storage/files/:fileUuid/restore
async restoreFile(fileUuid: string): Promise<void> {
  await DetectionFile.update({ fileUuid }, { isDeleted: false, deletedAt: null });
}
```

**Implications**:
- **Positive**: Recovery window, data protection
- **Negative**: Extra storage for 7 days
- **Risk**: Low (proven pattern)

---

### Decision 010: Partitioning Timeline
**Status**: ✅ Approved
**Category**: Migration Planning
**Priority**: P2 (Medium)

**Problem**: When to partition detection_files table?

**Decision Made**: Partition now before data grows large

**Rationale**:
- Current data is small (216K detections)
- Easier to partition small table (faster migration)
- Avoids complexity of partitioning large table later
- Can test partitioning with minimal risk
- Ready for production scale

**Alternatives Considered**:
1. **Partition at 1M records** - Rejected (migration harder)
2. **Partition at 5M records** - Rejected (migration very hard)
3. **Never partition** - Rejected (won't scale)

**Implementation Timeline**:
1. **Week 1**: Create partitioned table in development
2. **Week 2**: Test partitioning with sample data
3. **Week 3**: Plan migration (backup, downtime, validation)
4. **Week 4**: Execute migration in staging
5. **Week 5**: Execute migration in production (1-hour downtime)

**Migration Steps**:
```sql
-- Step 1: Create partitioned table
CREATE TABLE detection_files_partitioned (...) PARTITION BY RANGE (created_at);

-- Step 2: Create initial partitions
CREATE TABLE detection_files_2026_01 PARTITION OF detection_files_partitioned ...
CREATE TABLE detection_files_2026_02 PARTITION OF detection_files_partitioned ...

-- Step 3: Backfill data
INSERT INTO detection_files_partitioned SELECT * FROM detection_files;

-- Step 4: Validate
SELECT COUNT(*) FROM detection_files;
SELECT COUNT(*) FROM detection_files_partitioned;
-- Counts must match

-- Step 5: Switch tables (downtime starts)
ALTER TABLE detection_files RENAME TO detection_files_old;
ALTER TABLE detection_files_partitioned RENAME TO detection_files;

-- Step 6: Update foreign keys
-- ... update dependent tables ...

-- Step 7: Validate application
-- ... test queries, endpoints ...

-- Step 8: Drop old table (after 7 days)
DROP TABLE detection_files_old;
```

**Implications**:
- **Positive**: Scales to 10M+ rows, ready for production
- **Negative**: 1-hour downtime, 4-week effort
- **Risk**: Medium (migration complexity)
- **Mitigation**: Test in staging, use backup, rollback plan

---

## Summary of Decisions

| ID | Decision | Priority | Impact | Risk |
|----|----------|----------|--------|------|
| 001 | Winston log rotation | P0 | Stops 2.3GB growth | Low |
| 002 | FileIndexingService | P0 | 100% file tracking | Medium |
| 003 | Daily retention cleanup | P1 | Automated cleanup | Low |
| 004 | Hourly storage stats | P1 | Real-time visibility | Low |
| 005 | Database partitioning | P2 | Scales to 10M rows | Medium |
| 006 | Centralized config | P1 | Type-safe, maintainable | Low |
| 007 | Prometheus monitoring | P1 | Proactive alerts | Low |
| 008 | Gzip archive compression | P2 | 60-80% space savings | Low |
| 009 | 7-day soft delete grace | P1 | Recovery window | Low |
| 010 | Partition now vs later | P2 | Easier migration | Medium |

---

## Dependencies Between Decisions

```
Decision 002 (FileIndexingService)
    ↓
Decision 003 (Retention Cleanup)
    ↓
Decision 004 (Storage Stats)
    ↓
Decision 007 (Monitoring & Alerts)

Decision 001 (Log Rotation)
    ↓
Independent (can start immediately)

Decision 005 (Partitioning)
    ↓
Enables Decision 002 (better indexing performance)

Decision 006 (Centralized Config)
    ↓
Supports all other decisions (consistent configuration)
```

---

## Risks and Mitigations

| Risk | Decision | Impact | Mitigation |
|------|----------|--------|------------|
| **Queue overflow** | 002 (Indexing) | Files not indexed | Monitor queue size, backpressure handling |
| **Performance degradation** | 003 (Cleanup) | Slow queries during cleanup | Run during low traffic (3 AM) |
| **Partitioning downtime** | 005 (Partitioning) | 1-hour outage | Schedule weekend 2-4 AM, communicate to users |
| **False alerts** | 007 (Monitoring) | Alert fatigue | Rate limiting, validation before alert |
| **Data loss during migration** | 010 (Partitioning) | Critical | Backup, dry-run, validation, rollback plan |

---

## Next Steps

1. ✅ **Review all decisions** with architecture team
2. ✅ **Approve decisions** for implementation
3. **Phase 4.1 kickoff**: Implement Decision 001 (Log Rotation) - can start immediately
4. **Phase 4.2 kickoff**: Implement Decision 002 (File Indexing) - depends on config (Decision 006)
5. **Phase 4.3 kickoff**: Implement Decision 003 (Retention Cleanup) - depends on indexing (Decision 002)
6. **Phase 4.4 kickoff**: Implement Decisions 004, 007 (Monitoring) - depends on cleanup (Decision 003)
7. **Phase 4.5 kickoff**: Implement Decisions 005, 010 (Partitioning) - can run in parallel

---

## Appendix A: Decision Matrix

| Decision | Effort | Value | Risk | Priority | Order |
|----------|--------|-------|------|----------|-------|
| 001 | 2-4 hours | Critical | Low | P0 | 1st |
| 006 | 2 hours | High | Low | P1 | 1st (parallel) |
| 002 | 6 hours | Critical | Medium | P0 | 2nd |
| 003 | 6 hours | High | Low | P1 | 3rd |
| 004 | 4 hours | High | Low | P1 | 4th |
| 007 | 4 hours | High | Low | P1 | 4th (parallel) |
| 009 | Included in 003 | High | Low | P1 | 3rd (with 003) |
| 008 | 2 hours | Medium | Low | P2 | 5th |
| 005 | 4 hours | Medium | Medium | P2 | 6th |
| 010 | Included in 005 | High | Medium | P2 | 6th (with 005) |

**Total Effort**: 36-42 hours (4.5-5 weeks with 1 developer)

---

## Appendix B: Technology Choices

| Component | Technology | Justification |
|-----------|------------|---------------|
| **Logging** | Winston | Already integrated, proven reliability |
| **Indexing** | Custom service with TypeORM | Leverages existing ORM, async queue |
| **Cron** | node-cron | Already integrated, simple scheduling |
| **Hashing** | Node.js crypto (SHA-256) | Built-in, fast, secure |
| **Compression** | Node.js zlib (gzip) | Built-in, transparent, 60-80% savings |
| **Monitoring** | Prometheus + Grafana | Industry standard, rich ecosystem |
| **Alerting** | SMTP (existing notificationService) | Reuses existing infrastructure |
| **Partitioning** | PostgreSQL native partitioning | Built-in, efficient, well-documented |

---

## Appendix C: Rollback Plans

### Decision 001 (Log Rotation)
**Rollback**: Revert logger.ts to old config
**Data Loss**: None (old logs remain)
**Downtime**: None

### Decision 002 (File Indexing)
**Rollback**: Disable indexing integration points
**Data Loss**: None (DB records can be recreated)
**Downtime**: None (graceful degradation)

### Decision 003 (Retention Cleanup)
**Rollback**: Disable cron job
**Data Loss**: None (soft-deleted files can be restored)
**Downtime**: None

### Decision 005 (Partitioning)
**Rollback**: Switch back to detection_files_old table
**Data Loss**: None (backfill creates copy)
**Downtime**: 30 minutes (switch back)

---

**Document Status**: Complete - All major decisions captured and approved
