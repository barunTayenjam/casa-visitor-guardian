# Unified Storage Migration Plan with PostgreSQL Integration

## Executive Summary

This document outlines the plan to unify all detection and event storage in SentryVision into a single folder structure organized by year-month, with all persisted data tracked in PostgreSQL. This will simplify maintenance, improve performance, enable efficient querying, and make data management more efficient.

## Current Storage Structure Analysis

### Existing Directories and Content

| Directory | Size | Purpose | File Count | Status |
|-----------|------|---------|------------|--------|
| `server/public/events/` | 1.8G | Face & motion detection images | 1.8M files | **Active** |
| `server/public/snapshots/` | 463M | Manual/periodic snapshots | 463K files | **Active** |
| `server/public/batch-results/` | 37M | Batch processing results | 6 files | **Active** |
| `server/public/motion/` | 17K | Motion detection files | 1 file | **Active** |
| `server/public/temp/` | - | Temporary files | - | Active |
| `public/events/` | 36M | Additional motion events | ~2K files | **Active** |
| `public/snapshots/` | 42M | Additional snapshots | ~1K files | **Active** |
| `public/batch-results/` | - | Batch results (empty) | - | Empty |
| `data/events/` | 4K | Event storage (empty) | - | Empty |
| `data/snapshots/` | 8K | Snapshot storage (empty) | - | Empty |

### Total Storage Used
- **Active data**: ~2.4 GB
- **Total directories**: 10+
- **Duplicated paths**: `public/` and `server/public/`

### Current File Naming Patterns

1. **Events/Face Detection**: `{type}_{camera}_{timestamp}.{ext}`
   - Example: `faces_cam1_1760618163997.jpg`
   - Example: `motion_cam1_1735206400000Z.jpg`

2. **Snapshots**: `snapshot_{camera}_{ISO-date-string}.{ext}`
   - Example: `snapshot_cam1_2025-07-05T15-20-10-648Z.jpg`

3. **Batch Results**: `batch_batch_{timestamp}_{id}_{ISO-date-string}.json`
   - Example: `batch_batch_1767021276777_2fdx549in_2025-12-29T17-25-14-366Z.json`

### Issues with Current Structure

1. **No Database Tracking**: File metadata not stored in database
2. **Fragmented Storage**: Files scattered across multiple directories
3. **Duplication**: Similar data stored in both `public/` and `server/public/`
4. **Poor Performance**: 1.8M files in a single directory causes filesystem slowdown
5. **Difficult Maintenance**: Cleanup and archiving are complex
6. **No Organization**: Files not grouped by date, making old data hard to manage
7. **Inconsistent Paths**: Some code uses `public/`, some uses `server/public/`
8. **No Querying**: Cannot search/filter files efficiently without DB

## Proposed Unified Storage Structure with PostgreSQL

### New Directory Layout (Simplified)

```
/data/detections/
├── 2025-01/
│   ├── events/
│   │   ├── faces/
│   │   └── motion/
│   ├── snapshots/
│   ├── batch-results/
│   └── temp/
├── 2025-02/
├── 2025-12/
├── 2026-01/
└── archive/
    └── 2024-12/
```

### Database Schema Design

```sql
-- Detection files table to track all persisted media
CREATE TABLE detection_files (
    id SERIAL PRIMARY KEY,
    file_uuid UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
    file_type VARCHAR(50) NOT NULL CHECK (file_type IN ('event_face', 'event_motion', 'snapshot', 'batch_result', 'temp')),
    camera_id VARCHAR(100),
    original_filename VARCHAR(500),
    storage_path VARCHAR(1000) NOT NULL,
    file_size BIGINT,
    file_hash VARCHAR(64), -- SHA-256 for integrity
    capture_timestamp TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    is_archived BOOLEAN DEFAULT FALSE,
    is_deleted BOOLEAN DEFAULT FALSE,
    metadata JSONB, -- Flexible storage for detection results, confidence, etc.
    INDEX idx_file_type (file_type),
    INDEX idx_camera_id (camera_id),
    INDEX idx_capture_timestamp (capture_timestamp),
    INDEX idx_created_at (created_at),
    INDEX idx_is_archived (is_archived),
    INDEX idx_is_deleted (is_deleted),
    INDEX idx_storage_path (storage_path)
);

-- Batch jobs table to track batch processing
CREATE TABLE batch_jobs (
    id SERIAL PRIMARY KEY,
    job_uuid UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
    job_type VARCHAR(50) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    total_files INTEGER DEFAULT 0,
    processed_files INTEGER DEFAULT 0,
    failed_files INTEGER DEFAULT 0,
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    error_message TEXT,
    result_path VARCHAR(1000), -- Path to batch result JSON file
    metadata JSONB
);

-- Storage statistics table for monitoring
CREATE TABLE storage_stats (
    id SERIAL PRIMARY KEY,
    stat_date DATE NOT NULL UNIQUE,
    file_type VARCHAR(50) NOT NULL,
    total_files INTEGER DEFAULT 0,
    total_size BIGINT DEFAULT 0,
    new_files INTEGER DEFAULT 0,
    deleted_files INTEGER DEFAULT 0,
    archived_files INTEGER DEFAULT 0,
    calculated_at TIMESTAMP DEFAULT NOW()
);

-- Triggers for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_detection_files_updated_at BEFORE UPDATE ON detection_files
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

### Benefits of New Structure

1. **Unified Storage**: All detection data in one logical location
2. **Database Tracking**: Every file indexed in PostgreSQL for fast queries
3. **Simple Organization**: Year-month format is clean and easy to understand
4. **Performance**: Directory splitting by month improves filesystem performance
5. **Easy Cleanup**: Can delete/archive by month using DB queries
6. **Metadata Storage**: All detection data (confidence, objects, etc.) in DB
7. **Search & Filter**: Query files by type, camera, date range, etc.
8. **Integrity Checks**: File hashes for corruption detection
9. **Scalable**: Structure works for years of data
10. **Statistics**: Track storage usage over time

### Environment Variables

```env
# Unified storage configuration
DETECTIONS_DIR=/app/data/detections
DETECTIONS_RETENTION_DAYS=30
DETECTIONS_ARCHIVE_PATH=/app/data/detections/archive
ENABLE_FILE_INDEXING=true
FILE_INDEX_ON_SAVE=true
```

### File Naming Standardization

All files will follow: `{type}_{camera}_{timestamp}.{ext}`

- **Events (Face)**: `event_face_cam1_1760618163997.jpg`
- **Events (Motion)**: `event_motion_cam1_1735206400000Z.jpg`
- **Snapshots**: `snapshot_cam1_1735206400000Z.jpg`
- **Batch**: `batch_1767021276777_2fdx549in.json`
- **Temp**: `temp_1767021276777_cam1.jpg`

### Database Integration Points

1. **On File Save**: Insert record into `detection_files` table
2. **On File Read**: Query database for metadata before accessing file
3. **On File Delete**: Mark as deleted in database (soft delete)
4. **On Archive**: Mark as archived in database and move file
5. **On Cleanup**: Use DB queries to find old files
6. **Statistics**: Hourly job to calculate storage stats

## Migration Strategy

### Phase 1: Database Preparation (Low Risk)

1. **Create Database Tables**
   - Run migration to add new tables
   - Create indexes for performance
   - Set up triggers and functions
   - Test table creation in staging

2. **Create Database Service**
   - `server/src/services/fileIndexingService.ts`
   - Methods: `indexFile()`, `getFileMetadata()`, `queryFiles()`, `markDeleted()`, `markArchived()`
   - Handle connection pooling and error handling

3. **Update Configuration**
   - Add new environment variables to `.env.example`
   - Update `server/src/config/index.ts` with new paths
   - Add database integration flags
   - Create helper functions for path generation

### Phase 2: Code Updates (Medium Risk)

4. **Update Services with Database Integration**
   - `server/src/services/eventImageClassifier.ts` - Index classification results
   - `server/src/services/batchProcessingService.ts` - Track batch jobs and results
   - `server/src/services/visitorAnalyticsService.ts` - Query indexed files
   - `server/src/services/visitorDatabasePostgres.ts` - Integrate with file indexing

5. **Update Detection Modules**
   - `server/src/detection/optimizedMotionDetection.ts` - Index motion events
   - `server/src/detection/motionTriggeredDetection.ts` - Index triggered events
   - `server/src/detection/objectDetectionOpenCV.ts` - Index object detections
   - `server/src/detection/facialRecognitionOpenCV.ts` - Index face detections

6. **Update Routes with Database Queries**
   - `server/src/routes/index.ts` - Serve files with DB metadata
   - `server/src/routes/batchDetection.ts` - Track batch jobs in DB
   - Add new endpoints for file search/filtering

7. **Create File Indexing Service**
   - Background job to index existing files
   - Incremental indexing for new files
   - Error handling and retry logic

### Phase 3: Migration Execution (High Risk)

8. **Create Migration Script with Database**
   - Script to parse file timestamps
   - Calculate file hashes
   - Move files to new structure
   - Insert all file records into `detection_files`
   - Generate migration report
   - Validate data integrity

9. **Execute Migration**
   - Stop application
   - Run migration script (dry-run first)
   - Verify database records
   - Verify all files moved
   - Check counts match

10. **Deploy Code Changes**
    - Deploy updated code
    - Start application
    - Monitor for errors
    - Verify new files being indexed

### Phase 4: Post-Migration

11. **Validation**
    - Verify database records match files
    - Check all endpoints working
    - Test search/filter queries
    - Monitor performance improvements
    - Verify file integrity checks working

12. **Cleanup Old Directories**
    - Remove old directories after validation period (7 days)
    - Update docker-compose volumes

13. **Create Statistics Jobs**
    - Hourly job to update storage_stats
    - Daily job to cleanup old files based on DB
    - Weekly job to verify file integrity

14. **Documentation Update**
    - Update AGENTS.md with new structure
    - Update deployment documentation
    - Create migration rollback plan
    - Document database schema

## Code Changes Required

### 1. Config Updates (server/src/config/index.ts)

```typescript
export interface StorageConfig {
  detectionsDir: string;
  retentionDays: number;
  archivePath: string;
  enableFileIndexing: boolean;
  fileIndexOnSave: boolean;
}

export const getDetectionsPath = (type: 'events' | 'snapshots' | 'batch' | 'temp', date: Date = new Date()): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const yearMonth = `${year}-${month}`;
  const typePath = type === 'events' ? 'events/faces' : type;
  return path.join(config.storage.detectionsDir, yearMonth, typePath);
};

export const getArchivePath = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const yearMonth = `${year}-${month}`;
  return path.join(config.storage.archivePath, yearMonth);
};
```

### 2. File Indexing Service (server/src/services/fileIndexingService.ts)

```typescript
export interface DetectionFileRecord {
  fileUuid: string;
  fileType: 'event_face' | 'event_motion' | 'snapshot' | 'batch_result' | 'temp';
  cameraId?: string;
  originalFilename: string;
  storagePath: string;
  fileSize: number;
  fileHash: string;
  captureTimestamp: Date;
  metadata?: Record<string, any>;
}

export class FileIndexingService {
  async indexFile(record: DetectionFileRecord): Promise<void>
  async getFileMetadata(fileUuid: string): Promise<DetectionFileRecord | null>
  async queryFiles(filters: {
    fileType?: string;
    cameraId?: string;
    startDate?: Date;
    endDate?: Date;
    isArchived?: boolean;
  }): Promise<DetectionFileRecord[]>
  async markAsDeleted(fileUuid: string): Promise<void>
  async markAsArchived(fileUuid: string): Promise<void>
  async calculateFileHash(filePath: string): Promise<string>
  async getStorageStats(): Promise<StorageStats>
}
```

### 3. Migration Script Structure

```typescript
interface MigrationResult {
  totalFiles: number;
  movedFiles: number;
  indexedFiles: number;
  failedFiles: number;
  failedIndexing: number;
  errors: string[];
  databaseErrors: string[];
}

async function migrateStorageWithDatabase(
  sourceDir: string,
  targetType: 'events' | 'snapshots' | 'batch'
): Promise<MigrationResult>

async function indexExistingFiles(detectionsDir: string): Promise<{
  totalFiles: number;
  indexedFiles: number;
  failedFiles: number;
}>
```

## Database Queries Examples

```sql
-- Get all motion events for camera 1 in last 24 hours
SELECT * FROM detection_files
WHERE file_type = 'event_motion'
  AND camera_id = 'cam1'
  AND capture_timestamp > NOW() - INTERVAL '24 hours'
  AND is_deleted = FALSE
ORDER BY capture_timestamp DESC;

-- Get storage statistics by type
SELECT
  file_type,
  COUNT(*) as file_count,
  SUM(file_size) as total_size
FROM detection_files
WHERE is_deleted = FALSE
GROUP BY file_type;

-- Archive files older than 30 days
UPDATE detection_files
SET is_archived = TRUE
WHERE created_at < NOW() - INTERVAL '30 days'
  AND is_archived = FALSE;

-- Find files for cleanup
SELECT * FROM detection_files
WHERE created_at < NOW() - INTERVAL '30 days'
  AND is_archived = FALSE
  AND is_deleted = FALSE;
```

## API Endpoints

### New Endpoints for File Management

```typescript
// Get files with filters
GET /api/files?fileType=event_motion&cameraId=cam1&startDate=2025-01-01&endDate=2025-01-31

// Get file metadata
GET /api/files/:fileUuid

// Delete file (soft delete)
DELETE /api/files/:fileUuid

// Archive files
POST /api/files/archive

// Get storage statistics
GET /api/files/stats

// Search files by metadata
POST /api/files/search
```

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Data loss during migration | Low | High | Full backup, dry-run mode, verify file hashes |
| Database connection issues | Medium | High | Connection pooling, retry logic, fallback to file-only |
| Application downtime | Medium | Medium | Schedule during low traffic, use rolling update |
| Performance degradation | Low | Medium | Monitor during migration, optimize indexes |
| Code bugs in new paths | Medium | High | Comprehensive testing, staging environment |
| Permission issues | Low | Medium | Verify permissions upfront |
| Database sync issues | Low | High | Implement verification jobs, reconcile mismatches |

## Rollback Plan

1. Stop application
2. Restore backup to original locations
3. Drop new database tables
4. Revert code changes (git checkout)
5. Restart application
6. Verify all systems working

## Success Criteria

- [ ] All files migrated to new structure
- [ ] All files indexed in PostgreSQL
- [ ] Zero data loss
- [ ] Database queries working correctly
- [ ] Application fully functional
- [ ] Performance improved (directory listing faster)
- [ ] Search/filter endpoints working
- [ ] File integrity checks passing
- [ ] Storage statistics accurate
- [ ] Old directories successfully removed
- [ ] Documentation updated

## Timeline Estimate

- Phase 1 (Database): 3-4 hours
- Phase 2 (Code): 6-8 hours
- Phase 3 (Migration): 3-4 hours
- Phase 4 (Post-Migration): 2-3 hours

**Total: 14-19 hours**

## Next Steps

1. Review and approve this plan
2. Review database schema design
3. Schedule migration window
4. Create backup plan
5. Begin Phase 1: Database table creation
6. Develop file indexing service
7. Test database integration in staging
8. Execute full migration
