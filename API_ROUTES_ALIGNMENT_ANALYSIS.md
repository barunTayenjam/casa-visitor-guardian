# API Routes & Functionality Alignment - Implementation Plan

## Date: January 2, 2026

## Executive Summary

Comprehensive implementation plan to align all API routes and functionality with the new unified storage structure (`data/detections/YYYY-MM/`). This plan addresses **37 old path references** across **9 files** with detailed code changes and testing procedures.

## Current State

### ✅ Completed (Foundation)
1. Database tables created (`detection_files`, `batch_jobs`, `batch_result_items`)
2. Config helper functions implemented (`getDetectionsPath()`, `getEventPath()`)
3. File migration completed (31,731 files moved)
4. Batch results in database (6 jobs, 37 MB saved)

### ⚠️ Issues Found (37 references)
- API routes using old paths
- Batch processing saving to JSON instead of database
- Detection modules using hardcoded temp paths
- Stream manager using old snapshot paths
- Cron jobs cleaning old directories

## Implementation Plan

### Phase 1: API Routes Update (Priority: CRITICAL)

**File**: `server/src/routes/index.ts`
**Estimated Time**: 2-3 hours
**Changes Required**: 15 locations

#### Change 1: Remove Old EVENTS_DIR Constant

**Line 31** - Delete:
```typescript
const EVENTS_DIR = path.join(process.cwd(), 'public', 'events');
```

**Add Import** (After line 28):
```typescript
import { getDetectionsPath, getEventPath } from '../config/index.js';
```

#### Change 2: Remove Old Directory Creation

**Lines 34-36** - Delete:
```typescript
if (!fs.existsSync(EVENTS_DIR)) {
  fs.mkdirSync(EVENTS_DIR, { recursive: true });
}
```

**Replace with**:
```typescript
// No longer needed - unified structure uses getDetectionsPath()
```

#### Change 3: Update Static File Serving

**Line 36** - Replace:
```typescript
app.use('/events', express.static('public/events'));
app.use('/snapshots', express.static('public/snapshots'));
```

**With**:
```typescript
app.use('/events', express.static('data/detections'));
app.use('/snapshots', express.static('data/detections'));
```

**Note**: Both routes serve same directory with different URL prefixes - maintains backward compatibility

#### Change 4: Update Event Image Serving

**Line 1556** - Replace:
```typescript
const imagePath = path.join(EVENTS_DIR, filename);
```

**With**:
```typescript
const eventDate = new Date();
const eventsPath = getEventPath('faces', eventDate);
const imagePath = path.join(eventsPath, filename);
```

**Better Approach** - Use database lookup:
```typescript
// First, get file from database
const file = await db.query(
  'SELECT * FROM detection_files WHERE original_filename = $1 AND is_deleted = false',
  [filename]
);

if (file.rows.length === 0) {
  return res.status(404).json({ success: false, error: 'File not found' });
}

const filePath = file.rows[0].storage_path;
res.sendFile(filePath);
```

#### Change 5: Update Snapshot Listing

**Line 1579** - Replace:
```typescript
const snapshotsDir = path.join(__dirname, '../../public/snapshots');
```

**With**:
```typescript
const snapshotDate = new Date();
const snapshotsPath = getDetectionsPath('snapshots', snapshotDate);
```

#### Change 6: Update Snapshot File Path

**Line 1654** - Replace:
```typescript
const filePath = path.join(snapshotsDir, file);
```

**With**:
```typescript
const filePath = path.join(snapshotsPath, file);
```

#### Change 7: Remove Batch Results JSON Saving

**Line 2797** - Replace entire section:
```typescript
const outputPath = path.join(__dirname, '../../public/batch-results', `${jobId}.json`);
await fs.writeFile(outputPath, JSON.stringify(results));
```

**With**:
```typescript
// Save results to database only
const batchJobId = await db.query(
  'SELECT id FROM batch_jobs WHERE job_uuid = $1',
  [jobId]
);

if (batchJobId.rows.length === 0) {
  throw new Error('Batch job not found');
}

// Insert result items
for (const result of results) {
  await db.query(`
    INSERT INTO batch_result_items (
      batch_job_id, filename, timestamp, camera_id,
      persons_detected, faces_detected, detection_data
    ) VALUES ($1, $2, $3, $4, $5, $6, $7)
  `, [
    batchJobId.rows[0].id,
    result.filename,
    result.timestamp,
    result.cameraId,
    result.persons?.length || 0,
    result.faces?.length || 0,
    JSON.stringify(result)
  ]);
}
```

#### Change 8-15: Update All EventsDir References

Replace all occurrences of:
```typescript
const eventsDir = EVENTS_DIR;
```

With appropriate calls to:
```typescript
const eventsDir = getDetectionsPath('events', new Date());
// or
const eventsDir = getEventPath('faces', new Date());
// or
const eventsDir = getEventPath('motion', new Date());
```

---

### Phase 2: Batch Processing Service Update (Priority: HIGH)

**File**: `server/src/services/batchProcessingService.ts`
**Estimated Time**: 2-3 hours
**Changes Required**: 8 locations

#### Change 1: Update Directory Initialization

**Line 81-82** - Replace:
```typescript
this.eventsDir = path.join(appRoot, 'public', 'events');
this.outputDir = path.join(appRoot, 'public', 'batch-results');
```

**With**:
```typescript
import { getDetectionsPath } from '../config/index.js';

this.eventsDir = getDetectionsPath('events', new Date());
this.outputDir = getDetectionsPath('batch', new Date());
```

#### Change 2: Remove Directory Creation

**Lines 85-86** - Delete:
```typescript
if (!fs.existsSync(this.eventsDir)) {
  fs.mkdirSync(this.eventsDir, { recursive: true });
}
```

**With**:
```typescript
// No longer needed - directories created by migration
```

#### Change 3: Update Batch Results Directory

**Line 156** - Replace:
```typescript
const batchResultsDir = path.join(__dirname, '../../public/batch-results');
```

**With**:
```typescript
const batchResultsDir = getDetectionsPath('batch', new Date());
```

#### Change 4: Remove JSON File Loading

**Lines 158-227** - Delete entire section:
```typescript
const files = fs.readdirSync(batchResultsDir).filter(f => f.endsWith('.json'));
// ... all the JSON file loading logic
```

**With**:
```typescript
// Load from database instead
const batchJobs = await db.query(`
  SELECT * FROM batch_jobs
  WHERE status = 'completed'
  ORDER BY created_at DESC
  LIMIT 100
`);
```

#### Change 5: Update Available Events Query

**Line 259** - Replace:
```typescript
const files = fs.readdirSync(this.eventsDir);
```

**With**:
```typescript
// Query from database
const events = await db.query(`
  SELECT
    df.file_uuid,
    df.original_filename as filename,
    df.capture_timestamp as timestamp,
    df.camera_id as cameraId,
    df.storage_path as filePath,
    df.file_size as size
  FROM detection_files df
  WHERE df.file_type IN ('event_face', 'event_motion')
    AND df.is_deleted = false
  ORDER BY df.capture_timestamp DESC
  LIMIT 10000
`);

return events.rows;
```

#### Change 6: Remove JSON File Saving

**Line 2797** - Replace:
```typescript
const outputPath = path.join(this.outputDir, `${jobId}.json`);
await fs.writeFile(outputPath, JSON.stringify(results));
```

**With**:
```typescript
// Save to database batch_result_items table
const batchJobId = jobId; // Use jobId returned from create_batch_job

for (const result of results) {
  await db.query(`
    INSERT INTO batch_result_items (
      batch_job_id, filename, timestamp, camera_id,
      persons_detected, faces_detected, detection_data
    ) VALUES ($1, $2, $3, $4, $5, $6, $7)
  `, [
    batchJobId,
    result.filename,
    result.timestamp,
    result.cameraId,
    result.persons?.length || 0,
    result.faces?.length || 0,
    JSON.stringify(result)
  ]);
}
```

#### Change 7-8: Update All Path References

Replace remaining old path references with config helper functions.

---

### Phase 3: Cron Jobs Update (Priority: HIGH)

**File**: `server/src/utils/cronJobs.ts`
**Estimated Time**: 1-2 hours
**Changes Required**: 2 locations

#### Change 1: Update Cleanup Directory Paths

**Lines 143-145** - Replace:
```typescript
const directories = [
  path.join(__dirname, '../../public/snapshots'),
  path.join(__dirname, '../../public/events')
];
```

**With**:
```typescript
import { getDetectionsPath } from '../config/index.js';

const cleanupDate = new Date();
const directories = [
  getDetectionsPath('snapshots', cleanupDate),
  getEventPath('faces', cleanupDate),
  getEventPath('motion', cleanupDate)
];
```

#### Change 2: Update Cleanup to Use Database

**Lines 156-64** - Replace entire cleanup function:
```typescript
function cleanupOldFiles() {
  const maxAge = 30 * 24 * 60 * 60 * 1000;
  
  // Mark files as archived in database
  db.query(`
    UPDATE detection_files
    SET is_archived = true
    WHERE created_at < NOW() - INTERVAL '${maxAge}ms'
      AND is_archived = false
      AND is_deleted = false
  `);

  // Get archived files for filesystem cleanup
  const archivedFiles = await db.query(`
    SELECT storage_path FROM detection_files
    WHERE is_archived = true
      AND is_deleted = false
    LIMIT 10000
  `);

  // Move files to archive
  for (const file of archivedFiles.rows) {
    const archivePath = getArchivePath(new Date(file.created_at));
    await fs.mkdir(path.dirname(archivePath), { recursive: true });
    await fs.rename(file.storage_path, archivePath);

    // Update storage_path in database
    await db.query(`
      UPDATE detection_files
      SET storage_path = $1
      WHERE file_uuid = $2
    `, [archivePath, file.file_uuid]);
  }
}
```

---

### Phase 4: Detection Modules Update (Priority: MEDIUM)

**Files**:
- `server/src/detection/optimizedMotionDetection.ts`
- `server/src/detection/motionTriggeredDetection.ts`
- `server/src/detection/facialRecognitionOpenCV.ts`
- `server/src/detection/objectDetectionOpenCV.ts`

**Estimated Time**: 2-3 hours

#### Change 1: Update Temp Directory Paths

Replace all occurrences of:
```typescript
const tempDir = '/app/public/events/temp';
```

**With**:
```typescript
import { getDetectionsPath } from '../config/index.js';

const tempDir = getDetectionsPath('temp', new Date());
```

#### Change 2: Update Events Directory

Replace all occurrences of:
```typescript
const eventsDir = path.join(process.cwd(), 'public', 'events');
```

**With**:
```typescript
const eventsDir = getEventPath('faces', new Date());
// or
const eventsDir = getEventPath('motion', new Date());
```

#### Change 3: Remove Old Directory Creation

Remove any lines creating old directory structure.

---

### Phase 5: Stream Manager Update (Priority: MEDIUM)

**File**: `server/src/streams/rtspManager.ts`
**Estimated Time**: 1-2 hours
**Changes Required**: 7 locations

#### Change 1: Update Snapshots Directory

**Line 31** - Replace:
```typescript
const snapshotsDir = config.storage.snapshotsDir;
```

**With**:
```typescript
import { getDetectionsPath } from '../config/index.js';

const snapshotDate = new Date();
const snapshotsPath = getDetectionsPath('snapshots', snapshotDate);
```

#### Change 2: Remove Old Directory Creation

**Lines 35-36** - Delete:
```typescript
if (!fs.existsSync(snapshotsDir)) {
  fs.mkdirSync(snapshotsDir, { recursive: true });
}
```

**With**:
```typescript
// No longer needed - directories exist from migration
```

#### Change 3: Update Snapshot File Paths

**Lines 643, 649, 700** - Replace:
```typescript
const filepath = path.join(snapshotsDir, filename);
return `/snapshots/${filename}`;
imagePath: `/snapshots/motion_${cameraId}_${Date.now()}.jpg`
```

**With**:
```typescript
const filepath = path.join(snapshotsPath, filename);
const year = new Date().getFullYear();
const month = String(new Date().getMonth() + 1).padStart(2, '0');
return `/snapshots/${year}-${month}/${filename}`;
imagePath: path.join(snapshotsPath, `motion_${cameraId}_${Date.now()}.jpg`);
```

---

### Phase 6: Visitor Analytics Update (Priority: MEDIUM)

**File**: `server/src/services/visitorAnalyticsService.ts`
**Estimated Time**: 1-2 hours
**Changes Required**: 2 locations

#### Change 1: Update Directory Initialization

**Line 70** - Replace:
```typescript
this.eventsDir = path.join(__dirname, '../../public/events');
this.batchResultsDir = path.join(__dirname, '../../public/batch-results');
```

**With**:
```typescript
import { getDetectionsPath } from '../config/index.js';

this.eventsDir = getEventPath('faces', new Date());
this.batchResultsDir = getDetectionsPath('batch', new Date());
```

#### Change 2: Remove Old Directory Creation

Remove any lines creating old directories.

#### Change 3: Query Database Instead of Files

Replace file system queries with database queries from `detection_files` and `batch_jobs` tables.

---

### Phase 7: Testing (Priority: HIGH)

**Estimated Time**: 2-3 hours

#### Test 1: API Endpoints
```bash
# Test event image serving
curl http://localhost:8082/api/events/image/faces_cam1_1760618163997.jpg

# Test snapshots list
curl http://localhost:8082/api/snapshots/list

# Test batch results
curl http://localhost:8082/api/batch-results/list
```

#### Test 2: File Operations
```javascript
// Test file saving
const detectionService = require('./services/detectionService.js');
await detectionService.saveDetection({
  type: 'event_face',
  cameraId: 'cam1',
  image: buffer,
  metadata: { confidence: 0.95 }
});

// Verify file is in correct location
const fs = require('fs');
const path = require('path');
const expectedPath = '/app/data/detections/2026-01/events/faces/faces_cam1_1234567890.jpg';
console.log(fs.existsSync(expectedPath));
```

#### Test 3: Batch Processing
```javascript
// Test batch job creation
const batchService = require('./services/batchProcessingService.js');
const jobId = await batchService.createBatchJob({
  timeRangeStart: '2026-01-01T00:00:00Z',
  timeRangeEnd: '2026-01-02T00:00:00Z',
  detectionTypes: ['both'],
  confidenceThreshold: 0.7
});

// Verify in database
const db = require('./database.js');
const job = await db.query('SELECT * FROM batch_jobs WHERE job_uuid = $1', [jobId]);
console.log('Batch job:', job);
```

#### Test 4: Cleanup Jobs
```bash
# Run cleanup manually
curl -X POST http://localhost:8082/api/cleanup/run

# Verify archived files
docker exec sentryvision-db psql -U sentryvision -d sentryvision -c "SELECT COUNT(*) FROM detection_files WHERE is_archived = true;"
```

---

### Phase 8: Rollback Plan

**If Issues Occur**:
1. Stop application
2. Restore from git: `git checkout HEAD -- server/src/`
3. Remove new database tables: `docker exec sentryvision-db psql -U sentryvision -d sentryvision < database/migrations/rollback_004.sql`
4. Restart application
5. Verify old paths work

**Rollback Script**: Create `database/migrations/rollback_004_batch_results.sql`
```sql
DROP TABLE IF EXISTS batch_jobs CASCADE;
DROP TABLE IF EXISTS batch_result_items CASCADE;
```

---

## Execution Order

### Recommended Sequence
1. **Phase 1** - API Routes (CRITICAL - affects all endpoints)
2. **Phase 2** - Batch Processing (HIGH - affects detection storage)
3. **Phase 7** - Testing (HIGH - validate after each phase)
4. **Phase 3** - Cron Jobs (HIGH - cleanup automation)
5. **Phase 4** - Detection Modules (MEDIUM - affects temp files)
6. **Phase 7** - Testing (HIGH - final validation)
7. **Phase 5** - Stream Manager (MEDIUM - affects snapshots)
8. **Phase 6** - Visitor Analytics (MEDIUM - analytics only)

### Parallel Work
- Phases 1-4: Sequential (each depends on previous)
- Phases 5-6: Can be done in parallel with Phase 2-3
- Phase 7: After all code changes

---

## Success Criteria

### Phase 1: API Routes
- [ ] No hardcoded path constants
- [ ] All endpoints use config helpers
- [ ] Static files served from data/detections
- [ ] Database queries for file lookups
- [ ] No batch results JSON files

### Phase 2: Batch Processing
- [ ] Uses getDetectionsPath() helper
- [ ] Results stored in database only
- [ ] No JSON file creation
- [ ] batch_jobs table populated
- [ ] batch_result_items populated

### Phase 3: Cron Jobs
- [ ] Uses config helpers
- [ ] Database-based cleanup
- [ ] Archive path used correctly
- [ ] No filesystem scanning for cleanup

### Phase 4: Detection Modules
- [ ] Uses getDetectionsPath('temp')
- [ ] No hardcoded paths
- [ ] Temp files in correct location

### Phase 5: Stream Manager
- [ ] Uses getDetectionsPath('snapshots')
- [ ] Snapshot files in correct location
- [ ] URL paths include year-month

### Phase 6: Visitor Analytics
- [ ] Uses getEventPath()
- [ ] Batch results from database
- [ ] No JSON file access

### Phase 7: Testing
- [ ] All API endpoints working
- [ ] Files saved to correct locations
- [ ] Batch processing functional
- [ ] Cleanup jobs working
- [ ] Database queries correct
- [ ] No errors in logs

---

## Code Quality Checks

### Before Deployment
- [ ] Run `npm run lint` - fix all errors
- [ ] Run `npm run typecheck` - fix all type errors
- [ ] No `any` types (use proper types)
- [ ] No console.log statements (use logger)
- [ ] Error handling on all file operations
- [ ] Database transactions where needed
- [ ] No SQL injection risks (use parameterized queries)

### Database Query Best Practices
- [ ] All queries use parameterized statements
- [ ] Indexes exist for all query columns
- [ ] Connection pooling configured
- [ ] Query timeouts set
- [ ] Result limits on SELECT queries

---

## Monitoring & Validation

### Health Check Endpoints
Add monitoring endpoints:
```typescript
app.get('/api/storage/health', (req, res) => {
  const stats = {
    detectionsDir: config.storage.detectionsDir,
    eventsDir: getEventPath('faces', new Date()),
    snapshotsDir: getDetectionsPath('snapshots', new Date()),
    databaseConnected: true,
    lastMigrationCheck: new Date().toISOString()
  };
  res.json(stats);
});

app.get('/api/storage/stats', (req, res) => {
  const dbStats = await db.query(`
    SELECT
      file_type,
      COUNT(*) as count,
      SUM(file_size) as total_size
    FROM detection_files
    WHERE is_deleted = false
    GROUP BY file_type
  `);
  res.json(dbStats.rows);
});
```

### Logging Requirements
- Log all file operations (create, move, delete)
- Log all database errors
- Log path resolution with old/new values
- Log performance metrics (file save times)

---

## Deployment Checklist

### Pre-Deployment
- [ ] All changes committed to git
- [ ] Create backup branch: `git checkout -b backup-before-alignment`
- [ ] Run all tests: `npm test`
- [ ] Build project: `npm run build`
- [ ] Review all changes with team

### Deployment
- [ ] Stop current application
- [ ] Deploy new code
- [ ] Run database migrations if needed
- [ ] Start application
- [ ] Verify health endpoints
- [ ] Monitor logs for errors

### Post-Deployment
- [ ] Test all API endpoints
- [ ] Verify file paths in logs
- [ ] Check database records
- [ ] Validate cleanup jobs run
- [ ] Performance test batch processing
- [ ] Monitor memory usage

### Validation Period
- [ ] Monitor for 24 hours
- [ ] Check error rates
- [ ] Validate file storage structure
- [ ] Verify database queries
- [ ] Review logs for issues

### Cleanup (After 7 Days)
- [ ] Remove old directories if stable
- [ ] Delete migration scripts
- [ ] Update AGENTS.md with new structure
- [ ] Archive validation logs
- [ ] Create rollback point: `git tag pre-alignment-v1`

---

## Risk Mitigation

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| API endpoint failure | Medium | HIGH | Staged deployment, health checks |
| File path errors | Low | HIGH | Comprehensive testing, validation |
| Database connection issues | Low | HIGH | Connection pooling, retries |
| Performance degradation | Medium | MEDIUM | Monitoring, indexing |
| Data loss | Very Low | CRITICAL | Backups, transactions, dry-run |

---

## Timeline Summary

| Phase | Description | Estimated Time | Dependencies |
|-------|-------------|----------------|--------------|
| 1 | API Routes Update | 2-3 hours | None |
| 2 | Batch Processing Update | 2-3 hours | Phase 1 |
| 3 | Cron Jobs Update | 1-2 hours | None |
| 4 | Detection Modules Update | 2-3 hours | Phase 1-2 |
| 5 | Stream Manager Update | 1-2 hours | Phase 1 |
| 6 | Visitor Analytics Update | 1-2 hours | Phase 1 |
| 7 | Testing & Validation | 2-3 hours | All code changes |
| 8 | Deployment & Monitoring | 1-2 hours | All phases complete |

**Total Estimated Time**: 12-20 hours

**Recommended Approach**: Complete in 2-3 days with testing after each phase

---

## Contact & Support

**Documentation**:
- AGENTS.md - Project overview
- POSTGRESQL_IMPLEMENTATION.md - Database setup
- UNIFIED_STORAGE_MIGRATION_GUIDE.md - Storage migration guide
- BATCH_RESULTS_DB_MIGRATION.md - Batch results migration
- This document - Implementation plan

**Issue Tracking**:
- Create GitHub issue for tracking alignment progress
- Reference this document in all pull requests
- Tag with `storage-alignment` and `priority:critical`

---

## Quick Reference

### Config Helpers Available
```typescript
getDetectionsPath('events' | 'snapshots' | 'batch' | 'temp', date)
getEventPath('faces' | 'motion', date)
getArchivePath(date)
```

### Database Tables
```sql
detection_files     -- All detection metadata
batch_jobs         -- Batch job metadata
batch_result_items -- Individual batch results
```

### URL Structure
```
/events/           → data/detections/ (all event types)
/snapshots/        → data/detections/ (all snapshots)
/batch-results/    → Query from database
```

---

## Appendix: Complete File List

### Files to Update
1. server/src/routes/index.ts (15 changes)
2. server/src/services/batchProcessingService.ts (8 changes)
3. server/src/utils/cronJobs.ts (2 changes)
4. server/src/detection/optimizedMotionDetection.ts (1 change)
5. server/src/detection/motionTriggeredDetection.ts (1 change)
6. server/src/detection/facialRecognitionOpenCV.ts (1 change)
7. server/src/detection/objectDetectionOpenCV.ts (1 change)
8. server/src/streams/rtspManager.ts (7 changes)
9. server/src/services/visitorAnalyticsService.ts (2 changes)

### Total Changes: ~38 locations

---

**Status**: 📋 READY FOR IMPLEMENTATION
**Next Step**: Begin Phase 1 - API Routes Update
**Estimated Completion**: 2-3 days with full testing
