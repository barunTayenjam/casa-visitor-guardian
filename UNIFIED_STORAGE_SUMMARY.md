# Unified Storage Migration - Planning Complete

## Summary

Comprehensive planning phase completed for unifying SentryVision's detection storage system with PostgreSQL database integration.

## What Was Created

### 1. Migration Plan Document
**File**: `UNIFIED_STORAGE_MIGRATION_PLAN.md`

Complete migration strategy including:
- Current storage analysis (10+ directories, ~2.4 GB scattered)
- New simplified structure using `YYYY-MM` format (e.g., `2025-01`)
- Database schema design for tracking all files
- 4-phase migration strategy
- Risk assessment and rollback plan
- Timeline: 14-19 hours

### 2. Database Migration Script
**File**: `database/migrations/003_create_detection_files_table.sql`

PostgreSQL tables created:
- `detection_files` - Track all media files with metadata
- `batch_jobs` - Track batch processing jobs
- `storage_stats` - Daily storage statistics
- Helper functions for archiving, cleanup, stats
- Indexes for performance optimization

### 3. File Indexing Service
**File**: `server/src/services/fileIndexingService.ts`

Service features:
- Index files in database with metadata
- Query files by type, camera, date range
- Search files by filename/camera
- Archive and delete operations
- Calculate file hashes (SHA-256)
- Storage statistics and metrics
- Orphaned record cleanup

### 4. Migration Script
**File**: `server/scripts/migrate-unified-storage.ts`

Script capabilities:
- Parse existing files from old structure
- Move files to new `YYYY-MM` structure
- Calculate file hashes
- Index all files in database
- Dry-run mode for testing
- Progress reporting
- Error handling and reporting

### 5. Implementation Guide
**File**: `UNIFIED_STORAGE_MIGRATION_GUIDE.md`

Step-by-step instructions:
- Backup procedures
- Database migration execution
- Configuration updates
- Migration script usage (dry-run & production)
- Code update examples
- API endpoint examples
- Validation and cleanup steps
- Troubleshooting guide

### 6. Updated Configuration
**File**: `server/src/config/index.ts`

New config properties:
- `detectionsDir` - Unified storage location
- `retentionDays` - Retention policy
- `archivePath` - Archive location
- `enableFileIndexing` - Enable DB tracking
- `fileIndexOnSave` - Index on file save

New helper functions:
- `getDetectionsPath()` - Get path by type & date
- `getEventPath()` - Get path for faces/motion
- `getArchivePath()` - Get archive path by date
- `getStoragePathFromFile()` - Map file types to paths

## New Storage Structure

```
/data/detections/
├── 2025-01/
│   ├── events/
│   │   ├── faces/         # Face detection images
│   │   └── motion/       # Motion detection images
│   ├── snapshots/         # Manual snapshots
│   ├── batch-results/      # Batch processing JSON
│   └── temp/             # Temporary files
├── 2025-02/
└── archive/              # Old data
    └── 2024-12/
```

## Database Integration

All persisted files will be tracked in PostgreSQL:

```sql
detection_files table fields:
- file_uuid: Unique identifier
- file_type: event_face | event_motion | snapshot | batch_result | temp
- camera_id: Source camera
- original_filename: Original file name
- storage_path: Full filesystem path
- file_size: Size in bytes
- file_hash: SHA-256 for integrity
- capture_timestamp: When detection occurred
- metadata: JSONB for detection results, confidence, etc.
- is_archived: Archive status
- is_deleted: Soft delete flag
```

## Benefits

1. **Unified Storage**: Single location for all detection data
2. **Simplified Organization**: Clean `YYYY-MM` format
3. **Database Tracking**: Every file indexed for fast queries
4. **Performance**: Directory splitting by month improves filesystem performance
5. **Search & Filter**: Query by type, camera, date, metadata
6. **Easy Cleanup**: Archive/delete by month using DB queries
7. **Integrity Checks**: File hashes for corruption detection
8. **Statistics**: Track storage usage over time

## Current Status

### Completed ✅
1. Analysis of current storage structure
2. Comprehensive migration plan documentation
3. Database schema design and migration script
4. File indexing service implementation
5. Migration script with dry-run support
6. Configuration updates with helper functions
7. Implementation guide with examples

### Remaining ⏳
1. Update detection services to use new paths
2. Update route handlers for new structure
3. Update cron jobs for new cleanup logic
4. Test migration in staging environment
5. Execute production migration

## Quick Start Commands

### Dry Run Test
```bash
cd server
npx tsx scripts/migrate-unified-storage.ts --dry-run
```

### Execute Migration
```bash
# 1. Backup data
mkdir -p backups/$(date +%Y%m%d)
cp -r server/public public backups/$(date +%Y%m%d)/

# 2. Run database migration
cd database
psql -U sentryvision -d sentryvision < migrations/003_create_detection_files_table.sql

# 3. Execute file migration
cd server
npx tsx scripts/migrate-unified-storage.ts
```

## Key Features

### Database Queries
```sql
-- Get motion events for camera 1 in last 24 hours
SELECT * FROM detection_files
WHERE file_type = 'event_motion'
  AND camera_id = 'cam1'
  AND capture_timestamp > NOW() - INTERVAL '24 hours'
  AND is_deleted = FALSE;

-- Get storage statistics by type
SELECT file_type, COUNT(*), SUM(file_size)
FROM detection_files
WHERE is_deleted = FALSE
GROUP BY file_type;
```

### API Endpoints (to be implemented)
```
GET  /api/files?fileType=event_motion&cameraId=cam1
GET  /api/files/:fileUuid
POST /api/files/search
GET  /api/files/stats
```

## Next Steps

1. **Review**: Review all created documents and code
2. **Approve**: Get approval for migration plan
3. **Schedule**: Schedule maintenance window
4. **Test**: Run dry-run migration
5. **Deploy**: Execute database migration
6. **Migrate**: Run file migration script
7. **Update**: Deploy code changes for new paths
8. **Validate**: Verify everything works
9. **Cleanup**: Remove old directories after validation

## Files Created/Modified

| File | Type | Status |
|------|------|--------|
| `UNIFIED_STORAGE_MIGRATION_PLAN.md` | Documentation | ✅ Created |
| `database/migrations/003_create_detection_files_table.sql` | Database | ✅ Created |
| `server/src/services/fileIndexingService.ts` | Service | ✅ Created |
| `server/scripts/migrate-unified-storage.ts` | Script | ✅ Created |
| `UNIFIED_STORAGE_MIGRATION_GUIDE.md` | Documentation | ✅ Created |
| `server/src/config/index.ts` | Configuration | ✅ Updated |

## Risk Assessment

| Risk | Level | Mitigation |
|------|--------|------------|
| Data loss during migration | HIGH | Full backup, dry-run mode, file hashes |
| Database sync issues | MEDIUM | Verification jobs, reconcile mismatches |
| Application downtime | MEDIUM | Schedule during low traffic |
| Performance issues | LOW | Monitor, optimize indexes |
| Code bugs | MEDIUM | Comprehensive testing, staging |

## Support Documents

- `UNIFIED_STORAGE_MIGRATION_PLAN.md` - Complete plan
- `UNIFIED_STORAGE_MIGRATION_GUIDE.md` - Implementation guide
- `AGENTS.md` - Project documentation
- `POSTGRESQL_IMPLEMENTATION.md` - Database setup

---

**Status**: Planning complete, ready for testing phase
**Estimated Timeline**: 14-19 hours total (planning done, execution remaining)
**Last Updated**: 2025-01-02
