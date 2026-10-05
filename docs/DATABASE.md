# Database

PostgreSQL 15+ with TypeORM, 26 migrations, in `database/migrations/`.

## Quick Start

```bash
cd database
npm install
npm run migrate        # Run all pending migrations
```

Or in Docker: migrations run automatically via `/docker-entrypoint-initdb.d`.

## Connection

```bash
psql -h localhost -U sentryvision -d sentryvision
# Password from POSTGRES_PASSWORD env var
```

## Schema Overview

### Core Detection

| Table | Purpose |
|-------|---------|
| `events` | Detection events (UUID PK, timestamp, camera_id, event_type, confidence, image_path, persons_detected, faces_detected, object_detections JSONB, face_detections JSONB, analysis JSONB) |
| `detection_configs` | Per-camera or global detection configuration |
| `detection_files` | File index for detection images (metadata JSONB) |
| `face_embeddings` | Face vectors for InsightFace recognition |

### Authentication

| Table | Purpose |
|-------|---------|
| `users` | User accounts (username, email, password hash, MFA secret, role, status) |
| `roles` | Hierarchical permissions (admin, user, viewer) |
| `user_sessions` | JWT sessions (access + refresh tokens, device/IP tracking) |
| `password_history` | Prevents password reuse |
| `audit_logs` | Tamper-detectable audit trail with digital signatures |

### Tracking & Timeline

| Table | Purpose |
|-------|---------|
| `visitor_timeline` | Face recognition visitor tracking |
| `timeline` | Event timeline entries |

### Notifications

| Table | Purpose |
|-------|---------|
| `notification_subscriptions` | Web Push subscriptions (VAPID) |
| `notification_preferences` | Per-user notification settings |
| `notification_logs` | Delivery log for audit |

### System

| Table | Purpose |
|-------|---------|
| `system_settings` | Global system configuration |
| `retention_policies` | Data retention rules |
| `storage_stats` | Storage usage tracking |
| `batch_jobs` | Async processing queue |
| `review_segments` | Video review workflow |
| `user_review_status` | Per-user review state |

### Security

| Table | Purpose |
|-------|---------|
| `security_events` | Security incident log |
| `rate_limit_counters` | API rate limit tracking |

## Key Queries

```sql
-- Events today
SELECT COUNT(*) FROM events
WHERE timestamp >= CURRENT_DATE AT TIME ZONE 'Asia/Kolkata';

-- Events by camera
SELECT camera_id, COUNT(*) FROM events
WHERE timestamp >= NOW() - INTERVAL '1 day'
GROUP BY camera_id;

-- Detection stats
SELECT
  event_type,
  COUNT(*) AS count,
  AVG(confidence) AS avg_confidence
FROM events
WHERE timestamp >= NOW() - INTERVAL '7 days'
GROUP BY event_type;

-- Face recognition clusters
SELECT person_name, COUNT(*) AS detections
FROM events, jsonb_array_elements(face_detections) AS fd
WHERE fd->>'isKnown' = 'true'
GROUP BY person_name
ORDER BY detections DESC;

-- Storage usage
SELECT pg_database_size('sentryvision');

-- Event with analysis
SELECT id, event_type, confidence,
       analysis->>'threatAssessment' AS threat,
       analysis->'detectedEntities'->'people' AS people
FROM events
WHERE analysis IS NOT NULL
ORDER BY timestamp DESC LIMIT 10;
```

## Migrations

```bash
# Run all pending
npm run migrate

# Check status
npx typeorm migration:show -d src/data-source.ts
```

### Adding a Migration

1. Create `database/migrations/YYYYMMDDHHMMSS-description.sql`
2. Write SQL `CREATE TABLE` / `ALTER TABLE`
3. Add to TypeORM runner
4. Test with `npm run migrate`
5. Commit both migration file and dependent code

## Indexes

Key performance indexes on `events`:

```sql
CREATE INDEX idx_events_timestamp ON events (timestamp DESC);
CREATE INDEX idx_events_camera_id ON events (camera_id);
CREATE INDEX idx_events_event_type ON events (event_type);
CREATE INDEX idx_events_confidence ON events (confidence);
CREATE INDEX idx_events_persons ON events (persons_detected) WHERE persons_detected > 0;
CREATE INDEX idx_events_faces ON events (faces_detected) WHERE faces_detected > 0;
```

## Backup

```bash
# Full backup
pg_dump -h localhost -U sentryvision sentryvision > backup_$(date +%Y%m%d).sql

# Restore
psql -h localhost -U sentryvision sentryvision < backup_20260924.sql
```

## Low-Resource Tuning

Docker Compose defaults for 2GB RAM hardware:

| Setting | Value | Purpose |
|---------|-------|---------|
| `shared_buffers` | 48MB | 25% of available RAM |
| `max_connections` | 15 | Sufficient for single-user |
| `work_mem` | 2MB | Per-sort memory |
| `maintenance_work_mem` | 16MB | VACUUM, index build |
| `huge_pages` | off | Avoids memory overhead |
| `effective_cache_size` | 96MB | OS page cache estimate |
