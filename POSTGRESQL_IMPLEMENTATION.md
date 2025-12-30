# PostgreSQL Database Implementation

## Overview

SentryVision now uses **PostgreSQL** for persistent database storage instead of in-memory only storage.

## What Changed

### 1. Docker Compose Configuration
- **Before**: PostgreSQL was commented out, using `localhost:5432` (external DB)
- **After**: PostgreSQL 15 Alpine container enabled with `postgres` service name

### 2. New PostgreSQL Tables

#### `batch_jobs` - Tracks batch processing jobs
```sql
- id: Unique batch job identifier
- status: queued | running | completed | failed | cancelled
- start_time / end_time: Job execution times
- total_images / processed_images / successful_images / failed_images: Counters
- person_detections / face_detections: Detection counts
- processing_time_ms: Total processing time
- options_json: Job configuration
```

#### `processed_images` - Stores detection results for each image
```sql
- id: Unique image result ID
- job_id: References batch_jobs table
- filename / file_path: Image file information
- camera_id / image_timestamp: Image metadata
- person_count / face_count / known_face_count / unknown_face_count: Detection summaries
- detection_json: Full detection results (persons, faces, bounding boxes)
- file_hash: For duplicate detection
```

#### `detection_cache` - OpenCV detection cache (PostgreSQL version)
```sql
- file_hash: SHA-256 hash of image
- object_detections / face_detections: JSON arrays
- file_modified: For cache invalidation
```

### 3. Migrations

Created PostgreSQL migrations:
- `001_create_user_management.sql` - Users, roles, sessions, audit logs
- `002_create_detection_cache_postgres.sql` - Detection cache (PostgreSQL)
- `003_create_events_table.sql` - Events table
- `004_create_batch_processing.sql` - Batch jobs and processed images

### 4. New Database Service

Created `server/src/services/batchProcessingDatabasePostgres.ts`:
- PostgreSQL-based batch processing storage
- TypeORM integration with AppDataSource
- Full CRUD operations for batch jobs and processed images
- Duplicate detection via file hashing
- Analytics and statistics queries

## How to Use

### Start with PostgreSQL

```bash
./start-with-postgres.sh
```

This will:
1. Stop existing containers
2. Start PostgreSQL container with persistent volume
3. Start SentryVision backend & frontend
4. Wait for PostgreSQL to be ready
5. Display connection info

### Run Migrations

```bash
cd database
npm run migrate
```

Or manually:
```bash
cd database
node run-migrations.ts
```

### Stop Everything

```bash
docker-compose -f docker-compose.opencv.yml down
```

### View Logs

```bash
docker-compose -f docker-compose.opencv.yml logs -f
```

## Connection Details

**From within Docker:**
- Host: `postgres`
- Port: `5432`
- Database: `sentryvision`
- User: `sentryvision`
- Password: `sentryvision123`

**From host machine:**
- Host: `localhost`
- Port: `5432`
- Same credentials

## Environment Variables

```yaml
DB_HOST=postgres              # Changed from localhost
DB_PORT=5432
DB_NAME=sentryvision
DB_USER=sentryvision
DB_PASSWORD=sentryvision123
DATABASE_URL=postgresql://sentryvision:sentryvision123@postgres:5432/sentryvision
```

## API Endpoints

### Batch Processing
- `POST /api/detection/batch-process` - Start batch (saves to DB)
- `GET /api/detection/batch-progress/:batchId` - Get progress (reads from DB)
- `GET /api/detection/today-events` - Get today's event count

### Advanced Batch Processing
- `GET /api/batch/available-events` - Get available events
- `POST /api/batch/start` - Start worker-based batch
- `GET /api/batch/jobs/:jobId` - Get job details
- `GET /api/batch/jobs/:jobId/results` - Get job results
- `DELETE /api/batch/jobs/:jobId/cancel` - Cancel running job
- `GET /api/batch/summary` - Get batch statistics

## Database Features

### Persistence
- Batch jobs are saved and survive server restarts
- Detection results are queryable
- Historical data retained for analytics

### Duplicate Detection
- File hashing prevents reprocessing same images
- `ON CONFLICT DO NOTHING` on processed_images

### Performance
- Indexed columns for fast queries
- JSONB for flexible detection data storage
- Connection pooling via TypeORM

### Cleanup
- Old jobs can be cleaned up (30 days default)
- Volume persistence across container restarts

## Troubleshooting

### PostgreSQL won't start
```bash
# Check logs
docker-compose -f docker-compose.opencv.yml logs postgres

# Recreate volume (WARNING: deletes data!)
docker volume rm sentryvision_postgres_data
docker-compose -f docker-compose.opencv.yml up -d
```

### Database connection errors
```bash
# Check PostgreSQL is ready
docker-compose -f docker-compose.opencv.yml exec postgres pg_isready -U sentryvision

# Check network
docker network ls
docker network inspect sentryvision_sentryvision-network
```

### Migrations fail
```bash
# Check migration files exist
ls -la database/migrations/

# Run manually
cd database
node run-migrations.ts

# Check TypeORM connection
node -e "import('./src/database.js').then(m => m.initializeDatabase())"
```

### Access PostgreSQL directly
```bash
# Connect to PostgreSQL in container
docker-compose -f docker-compose.opencv.yml exec postgres psql -U sentryvision -d sentryvision

# From host
psql -h localhost -p 5432 -U sentryvision -d sentryvision
```

## Data Management

### Backup Database
```bash
docker-compose -f docker-compose.opencv.yml exec postgres pg_dump -U sentryvision sentryvision > backup.sql
```

### Restore Database
```bash
docker-compose -f docker-compose.opencv.yml exec -T postgres psql -U sentryvision sentryvision < backup.sql
```

### Clear Batch Results
```bash
# From psql
DELETE FROM batch_jobs WHERE created_at < NOW() - INTERVAL '30 days';
DELETE FROM processed_images WHERE processed_at < NOW() - INTERVAL '30 days';
```

## Next Steps

1. ✅ PostgreSQL container enabled
2. ✅ Migrations created
3. ✅ Batch processing updated to use PostgreSQL
4. 🔄 Fix TypeScript errors in routes/index.ts
5. 🔄 Update frontend to fetch batch results from database
6. 🔄 Add batch results viewer page
7. 🔄 Add analytics dashboard for batch processing

## Migration Notes

### SQLite to PostgreSQL
The old SQLite-based detection cache migration has been replaced with PostgreSQL version:
- `INTEGER PRIMARY KEY AUTOINCREMENT` → `SERIAL PRIMARY KEY`
- `DATETIME` → `TIMESTAMP`
- `TEXT (JSON)` → `JSONB` (better for queries)
- Added proper constraints and indexes

### Data Migration (if needed)
To migrate existing SQLite data to PostgreSQL:
```bash
# Export from SQLite
sqlite3 data/batch_processing.db .dump > sqlite_dump.sql

# Convert and import to PostgreSQL
# (Requires manual conversion of types)
psql -h localhost -U sentryvision -d sentryvision < converted_dump.sql
```
