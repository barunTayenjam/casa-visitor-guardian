# Storage Management System - Implementation Summary

## Overview

The Storage Management System has been successfully implemented with all 4 plans completed in dependency order:
- **Plan 4.1**: Storage Statistics Tracking
- **Plan 4.2**: Retention Policy Engine
- **Plan 4.3**: Automated Cleanup Service
- **Plan 4.4**: Storage Monitoring API

## Architecture

### Database Schema

#### storage_stats Table
Tracks storage usage across different categories and cameras:
- `id`: UUID primary key
- `camera`: Camera name (null for global stats)
- `category`: Type of data (alerts, detections, previews, snapshots, events, global)
- `total_bytes`: Total storage used in bytes
- `file_count`: Number of files
- `oldest_file_days`: Age of oldest file in days
- `growth_rate_mb_per_day`: Average daily growth rate
- `breakdown`: JSONB breakdown by file type
- `last_calculated_at`: Timestamp of last calculation
- `created_at`, `updated_at`: Tracking timestamps

Indexes:
- `idx_storage_stats_camera`: For camera-based queries
- `idx_storage_stats_category`: For category filtering
- `idx_storage_stats_last_calculated`: For time-based queries
- `idx_storage_stats_created_at`: For historical analysis
- Unique constraints on camera+category combinations

#### retention_policies Table (Enhanced)
Already existed, now fully utilized:
- Per-camera and global retention policies
- Configurable retention days per category
- Indefinite retention option

### Services

#### 1. StorageStatsService
**File**: `server/src/services/storageStatsService.ts`

**Features**:
- Automatic storage calculation for all categories
- Camera-specific and global statistics
- Growth rate tracking (7-day moving average)
- File type breakdown
- Storage projection (predicts when storage will be full)
- Event-driven updates via EventEmitter

**Key Methods**:
- `initialize()`: Sets up storage stats tracking
- `calculateAllStats()`: Calculates stats for all categories/cameras
- `getStorageStats(camera?, category?)`: Query stats with filters
- `getGlobalStorageStats()`: Returns aggregated global statistics
- `getStorageProjection(days)`: Predicts future storage usage

#### 2. RetentionPolicyService
**File**: `server/src/services/retentionPolicyService.ts`

**Features**:
- Global and per-camera retention policies
- Configurable retention periods per category
- Expired file detection
- Automatic cleanup based on retention rules
- Policy inheritance (cameras inherit from global)

**Key Methods**:
- `getPolicy(camera?)`: Get retention policy for camera/global
- `updatePolicy(camera, config)`: Update retention settings
- `getExpiredFiles(camera?, category?)`: Find files past retention
- `applyRetentionPolicy(camera?, category?)`: Delete expired files
- `getRetentionSummary(camera?)`: Get cleanup summary

#### 3. AutomatedCleanupService
**File**: `server/src/services/automatedCleanupService.ts`

**Features**:
- Scheduled cleanup (default: 2 AM daily)
- Storage threshold-based cleanup (80% warning, 90% critical)
- Manual cleanup trigger
- Cleanup history tracking
- Aggressive cleanup mode for critical storage

**Key Methods**:
- `runAutomaticCleanup()`: Execute scheduled cleanup
- `runManualCleanup(camera?, category?)`: Trigger immediate cleanup
- `getCleanupHistory(limit)`: Retrieve cleanup history
- `getCleanupStats()`: Get cleanup statistics
- `cleanupByStorageThreshold()`: Auto-cleanup when storage full

**Cleanup Modes**:
- **Standard**: Deletes expired files based on retention policy
- **Aggressive**: Removes oldest 10% of files when storage critical

### API Routes

**Base Path**: `/api/storage`

#### Storage Statistics
- `GET /stats/overview`: Global storage overview with projection
- `GET /stats/detailed`: Detailed stats by camera/category
- `GET /stats/projection`: Storage projection for N days
- `POST /stats/recalculate`: Trigger stats recalculation

#### Retention Policies
- `GET /retention/policies`: List all retention policies
- `GET /retention/policies/:camera`: Get specific policy
- `PUT /retention/policies/:camera`: Update policy
- `DELETE /retention/policies/:camera`: Delete camera-specific policy
- `GET /retention/summary`: Get expired files summary
- `POST /retention/apply`: Apply retention policy immediately

#### Cleanup Operations
- `POST /cleanup/run`: Run manual cleanup
- `GET /cleanup/status`: Get cleanup status and history

#### Health & Monitoring
- `GET /health`: Overall storage system health

## Configuration

### Environment Variables
```bash
# Storage directories
DETECTIONS_DIR=/app/data/detections

# Cleanup schedule (cron format)
CLEANUP_SCHEDULE=0 2 * * *  # 2 AM daily

# Maximum storage (GB)
MAX_STORAGE_GB=100

# Timezone
TZ=Asia/Kolkata
```

### Default Retention Periods
- **Alerts**: 30 days
- **Detections**: 7 days
- **Previews**: 7 days
- **Snapshots**: 30 days
- **Events**: 30 days

## Usage Examples

### Get Storage Overview
```bash
curl http://localhost:9753/api/storage/stats/overview
```

Response:
```json
{
  "success": true,
  "data": {
    "storage": {
      "totalBytes": 5368709120,
      "totalGB": "5.00",
      "totalFiles": 1250,
      "percentageUsed": "5.00",
      "oldestFileDays": 45,
      "breakdown": {
        "alerts": { "bytes": 1073741824, "count": 500, "percentage": 20.0 },
        "detections": { "bytes": 2147483648, "count": 500, "percentage": 40.0 }
      }
    },
    "projection": {
      "projectedGB": "8.50",
      "willExceedCapacity": false,
      "daysUntilFull": 180
    },
    "cleanup": {
      "inProgress": false
    }
  }
}
```

### Update Retention Policy
```bash
curl -X PUT http://localhost:9753/api/storage/retention/policies/cam1 \
  -H "Content-Type: application/json" \
  -d '{
    "alertsDays": 60,
    "detectionsDays": 14,
    "snapshotsDays": 45
  }'
```

### Run Manual Cleanup
```bash
curl -X POST http://localhost:9753/api/storage/cleanup/run \
  -H "Content-Type: application/json" \
  -d '{
    "camera": "cam1",
    "category": "alerts"
  }'
```

### Get Cleanup History
```bash
curl http://localhost:9753/api/storage/cleanup/status
```

## Integration with Main Application

The storage management services are initialized in `server/src/index.ts`:

```typescript
// Import services
import { storageStatsService } from './services/storageStatsService.js';
import { retentionPolicyService } from './services/retentionPolicyService.js';
import { automatedCleanupService } from './services/automatedCleanupService.js';
import storageRoutes from './routes/storageRoutes.js';

// Register routes
app.use('/api/storage', storageRoutes);

// Initialize services
await storageStatsService.initialize();
await retentionPolicyService.initialize();
await automatedCleanupService.initialize();

// Make services globally available
(global as any).storageStatsService = storageStatsService;
(global as any).retentionPolicyService = retentionPolicyService;
(global as any).automatedCleanupService = automatedCleanupService;
```

## Testing

Comprehensive test suite created at `server/src/routes/storageRoutes.test.ts`:

```bash
cd server
npm test -- storageRoutes.test.ts
```

Test coverage includes:
- Storage statistics endpoints
- Retention policy CRUD operations
- Manual cleanup execution
- Storage projection calculations
- Health check endpoints

## Monitoring & Alerts

### Storage Thresholds
- **Healthy**: < 80% storage used
- **Warning**: 80-90% storage used
- **Critical**: > 90% storage used

### Automatic Actions
- At 80%: Log warning, prepare for cleanup
- At 90%: Run aggressive cleanup (remove oldest 10%)
- Daily at 2 AM: Run standard cleanup (remove expired files)

### Events Emitted
Services emit events for monitoring:
- `statsUpdated`: Storage statistics recalculated
- `policyUpdated`: Retention policy changed
- `policyDeleted`: Retention policy removed
- `retentionApplied`: Retention cleanup executed
- `cleanupCompleted`: Automatic cleanup finished
- `manualCleanupCompleted`: Manual cleanup finished
- `cleanupError`: Cleanup operation failed

## Performance Considerations

### Optimization Strategies
1. **Efficient Scanning**: Directory scanning with configurable max depth
2. **Caching**: Stats cached until next recalculation
3. **Batch Operations**: File deletions batched for efficiency
4. **Async Processing**: Non-blocking cleanup operations
5. **Selective Queries**: Indexed queries for fast lookups

### Resource Usage
- **Memory**: Minimal (stats stored in DB, not memory)
- **CPU**: Low (background processing)
- **I/O**: Moderate during cleanup operations
- **Network**: Low (local database access)

## Future Enhancements

Potential improvements:
1. **Compression**: Automatic file compression for old data
2. **Archival**: Move old data to cold storage (S3, Glacier)
3. **Quotas**: Per-camera storage quotas
4. **Smart Cleanup**: ML-based cleanup prioritization
5. **Real-time Monitoring**: WebSocket updates for storage changes
6. **Multi-tier Storage**: Hot/warm/cold storage tiers

## Troubleshooting

### Common Issues

**Issue**: Storage stats not updating
**Solution**: Check if `storageStatsService` is initialized. Manually trigger recalculation:
```bash
curl -X POST http://localhost:9753/api/storage/stats/recalculate
```

**Issue**: Cleanup not running automatically
**Solution**: Verify `CLEANUP_SCHEDULE` env var and check service initialization in logs.

**Issue**: High storage usage despite cleanup
**Solution**: Check if `retain_indefinitely` is set to true. Update retention policies to shorter periods.

### Database Queries

Check storage stats:
```sql
SELECT camera, category, 
       total_bytes / 1024 / 1024 / 1024 as total_gb,
       file_count,
       oldest_file_days,
       growth_rate_mb_per_day
FROM storage_stats
ORDER BY camera, category;
```

Check retention policies:
```sql
SELECT camera, 
       alerts_days, detections_days, previews_days,
       snapshots_days, events_days, retain_indefinitely
FROM retention_policies
ORDER BY camera NULLS LAST;
```

## Migration

Database migration file: `database/migrations/014_recreate_storage_stats.sql`

Apply migration:
```bash
docker exec -i sentryvision-postgres psql -U sentryvision -d sentryvision < database/migrations/014_recreate_storage_stats.sql
```

## Conclusion

The Storage Management System provides comprehensive storage tracking, flexible retention policies, and automated cleanup capabilities. The system is production-ready with full API coverage, testing, and monitoring integration.

All 4 plans have been successfully implemented and integrated into the main application.
