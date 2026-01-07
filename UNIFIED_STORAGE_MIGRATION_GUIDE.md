# Unified Storage Migration with PostgreSQL - Implementation Guide

## Overview

This guide explains how to implement the unified storage migration plan with PostgreSQL database integration for tracking all detection files.

## Prerequisites

1. PostgreSQL database running
2. Node.js installed
3. All current data backed up

## Implementation Steps

### Step 1: Backup Current Data

```bash
# Create backup directory
mkdir -p backups/$(date +%Y%m%d)

# Backup server/public directories
cp -r server/public backups/$(date +%Y%m%d)/
cp -r public backups/$(date +%Y%m%d)/

# Verify backup
ls -la backups/$(date +%Y%m%d)
```

### Step 2: Run Database Migration

```bash
cd database

# Run the migration to create new tables
npm run migrate

# Or run directly
psql -U sentryvision -d sentryvision < migrations/003_create_detection_files_table.sql
```

### Step 3: Update Configuration

Add to `.env` file:

```env
# Unified storage configuration
DETECTIONS_DIR=/app/data/detections
DETECTIONS_RETENTION_DAYS=30
DETECTIONS_ARCHIVE_PATH=/app/data/detections/archive
ENABLE_FILE_INDEXING=true
FILE_INDEX_ON_SAVE=true
```

### Step 4: Test Migration Script (Dry Run)

```bash
cd server

# Test migration without moving files
npx tsx scripts/migrate-unified-storage.ts --dry-run

# Review the output and check for any issues
```

### Step 5: Execute Migration

```bash
# Stop the application first
# (Stop all running services)

# Execute actual migration
npx tsx scripts/migrate-unified-storage.ts

# Verify results
ls -la data/detections/
```

### Step 6: Update Application Code

After migration, update services to use new storage paths and database indexing.

**Example usage in detection services:**

```typescript
import { getDetectionsPath, getEventPath } from '../config/index.js';
import { FileIndexingService } from '../services/fileIndexingService.js';

// Save a face detection event
const captureDate = new Date();
const eventPath = getEventPath('faces', captureDate);
const filename = `event_face_cam1_${captureDate.getTime()}.jpg`;
const filePath = path.join(eventPath, filename);

// Save file
await fs.writeFile(filePath, imageBuffer);

// Index in database
await fileIndexingService.indexFile({
  fileType: 'event_face',
  cameraId: 'cam1',
  originalFilename: filename,
  storagePath: filePath,
  fileSize: imageBuffer.length,
  fileHash: await fileIndexingService.calculateFileHash(filePath),
  captureTimestamp: captureDate,
  metadata: {
    confidence: 0.95,
    objects: ['person'],
    detectionTime: captureDate.toISOString()
  }
});
```

### Step 7: Update Cron Jobs

Update cleanup jobs in `server/src/utils/cronJobs.ts` to use new structure:

```typescript
import { getDetectionsPath } from '../config/index.js';

async function cleanupOldFiles() {
  const retentionDays = 30;
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

  // Archive old files
  const filesToArchive = await fileIndexingService.getFilesForArchive(retentionDays);

  for (const file of filesToArchive) {
    const archivePath = getArchivePath(file.captureTimestamp || new Date());
    await fs.mkdir(archivePath, { recursive: true });
    await fs.rename(file.storagePath, path.join(archivePath, path.basename(file.storagePath)));
    await fileIndexingService.markAsArchived(file.fileUuid!);
  }

  // Mark old files as deleted in database
  await fileIndexingService.archiveOldFiles(retentionDays);
}
```

### Step 8: Update API Endpoints

Add new endpoints in `server/src/routes/index.ts`:

```typescript
// Get files with filters
app.get('/api/files', async (req, res) => {
  const filters = {
    fileType: req.query.fileType as string,
    cameraId: req.query.cameraId as string,
    startDate: req.query.startDate ? new Date(req.query.startDate as string) : undefined,
    endDate: req.query.endDate ? new Date(req.query.endDate as string) : undefined
  };

  const files = await fileIndexingService.queryFiles(filters);
  res.json({ success: true, data: files });
});

// Get storage statistics
app.get('/api/files/stats', async (req, res) => {
  const stats = await fileIndexingService.getStorageStats();
  res.json({ success: true, data: stats });
});

// Search files
app.post('/api/files/search', async (req, res) => {
  const { searchTerm, filters } = req.body;
  const results = await fileIndexingService.searchFiles(searchTerm, filters);
  res.json({ success: true, data: results });
});
```

### Step 9: Update Docker Volumes

Update `docker-compose.yml` to mount new unified storage:

```yaml
volumes:
  - ./data/detections:/app/data/detections          # New unified storage
  - ./data/detections/archive:/app/data/detections/archive
  # Old volumes can be removed after validation
  # - ./server/public:/app/server/public
```

### Step 10: Validate Migration

```bash
# Check database for indexed files
psql -U sentryvision -d sentryvision -c "SELECT COUNT(*) FROM detection_files;"

# Check directory structure
find data/detections -type d | head -20

# Verify files exist
find data/detections -type f | wc -l

# Test API endpoints
curl http://localhost:8082/api/files/stats
```

### Step 11: Cleanup Old Directories (After Validation)

```bash
# Wait 7 days to ensure everything is working
# Then remove old directories

# Remove old public directories
rm -rf server/public/events
rm -rf server/public/snapshots
rm -rf server/public/batch-results
rm -rf server/public/motion

rm -rf public/events
rm -rf public/snapshots
rm -rf public/batch-results
```

## Rollback Plan

If migration fails:

```bash
# Stop application

# Restore from backup
cp -r backups/$(date +%Y%m%d)/server/public/* server/public/
cp -r backups/$(date +%Y%m%d)/public/* public/

# Drop new database tables
psql -U sentryvision -d sentryvision -c "DROP TABLE IF EXISTS detection_files, batch_jobs, storage_stats;"

# Revert code changes
git checkout .

# Restart application
```

## Monitoring

After migration, monitor:

1. **Database Performance**: Check query times on `detection_files` table
2. **File Access**: Verify files can be saved and retrieved
3. **Cleanup Jobs**: Ensure cron jobs are running correctly
4. **Storage Growth**: Monitor storage usage per month

### Useful SQL Queries

```sql
-- Check files per type
SELECT file_type, COUNT(*), SUM(file_size)/1024/1024 as size_mb
FROM detection_files
WHERE is_deleted = FALSE
GROUP BY file_type;

-- Check files per camera
SELECT camera_id, COUNT(*), SUM(file_size)/1024/1024 as size_mb
FROM detection_files
WHERE is_deleted = FALSE
GROUP BY camera_id;

-- Check files by month
SELECT
  DATE_TRUNC('month', created_at) as month,
  COUNT(*) as file_count,
  SUM(file_size)/1024/1024 as size_mb
FROM detection_files
WHERE is_deleted = FALSE
GROUP BY month
ORDER BY month DESC;

-- Find orphaned files (files in DB but not on disk)
SELECT file_uuid, storage_path
FROM detection_files
WHERE is_deleted = FALSE
  AND NOT EXISTS (
    SELECT 1 FROM pg_stat_file(storage_path)
    WHERE isfile = TRUE
  );

-- Find files on disk not in DB (manual check)
-- Compare: ls -la data/detections/ vs SELECT COUNT(*) FROM detection_files
```

## File Structure After Migration

```
app/data/detections/
├── 2025-01/
│   ├── events/
│   │   ├── faces/
│   │   │   └── event_face_cam1_1735689600000.jpg
│   │   └── motion/
│   │       └── event_motion_cam1_1735689600000.jpg
│   ├── snapshots/
│   │   └── snapshot_cam1_1735689600000.jpg
│   ├── batch-results/
│   │   └── batch_1767021276777_2fdx549in.json
│   └── temp/
├── 2025-02/
└── archive/
    └── 2024-12/
        ├── events/
        ├── snapshots/
        └── batch-results/
```

## Troubleshooting

### Issue: Migration fails with "Permission denied"

**Solution:**
```bash
# Ensure correct permissions
chmod -R 755 data/detections
chown -R <user>:<user> data/detections
```

### Issue: Database connection fails

**Solution:**
```bash
# Check PostgreSQL is running
sudo systemctl status postgresql

# Test connection
psql -U sentryvision -d sentryvision -c "SELECT 1;"

# Check connection string in .env
```

### Issue: Large number of failed file moves

**Solution:**
```bash
# Check available disk space
df -h

# Check for corrupted files
find data/detections -type f -size 0
```

### Issue: Database queries are slow

**Solution:**
```sql
-- Analyze tables
ANALYZE detection_files;
ANALYZE batch_jobs;
ANALYZE storage_stats;

-- Reindex if needed
REINDEX TABLE detection_files;
```

## Performance Tuning

### PostgreSQL Configuration

Add to `postgresql.conf`:

```conf
# Increase shared buffers for better caching
shared_buffers = 256MB

# Increase work memory for queries
work_mem = 4MB

# Increase maintenance work memory
maintenance_work_mem = 64MB

# Effective cache size (typically 50-75% of RAM)
effective_cache_size = 1GB
```

### File System

- Use ext4 or XFS for better performance with large numbers of files
- Enable journaling for data integrity
- Consider SSD for better I/O performance

## Next Steps

1. ✅ Create database tables (migration 003)
2. ✅ Create FileIndexingService
3. ✅ Create migration script
4. ⏳ Update all services to use new paths
5. ⏳ Update detection modules
6. ⏳ Update API routes
7. ⏳ Update cron jobs
8. ⏳ Test in staging environment
9. ⏳ Execute migration in production
10. ⏳ Monitor and validate

## Contact

For issues or questions, refer to:
- `UNIFIED_STORAGE_MIGRATION_PLAN.md` - Complete migration plan
- `AGENTS.md` - Project documentation
- `POSTGRESQL_IMPLEMENTATION.md` - Database setup guide
