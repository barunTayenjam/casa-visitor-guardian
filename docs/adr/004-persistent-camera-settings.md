# ADR-004: Persistent Camera Settings with PostgreSQL JSONB

**Status**: Proposed

**Date**: 2026-05-31

**Deciders**: Architect

---

#### Context

Three categories of user-configurable settings are stored exclusively in JavaScript in-memory Maps and plain objects — they are lost on every server restart:

1. **Per-camera motion settings** (`detection-operations.ts:150`): sensitivity, requiredConsecutiveFrames, minContourArea, useGaussianBlur, blurKernelSize, timeZones — stored in a module-level `const new Map<string, MotionSettings>()`
2. **Per-camera object detection settings** (`consolidatedDetectionService.ts:44`): enabled, sensitivity, cooldownPeriod, minConfidence, maxDetections, targetClasses — stored in `Map<string, ObjectDetectionSettings>`
3. **Global facial recognition settings** (`consolidatedDetectionService.ts:45`): enabled, minConfidence, recognitionThreshold, minFaceSize — stored as a plain object property

Additionally, system **alerts** (`inMemoryStateService.ts:92`) are held in a capped in-memory array and are permanently lost on restart — there is no `alerts` table in PostgreSQL.

The existing `system_settings` table already proves the pattern: the `SettingsController` reads from DB on init and writes on update, with an in-memory read-through cache. This works and should be replicated.

The most important quality attributes are **durability** (settings must survive restarts) and **simplicity** (minimal new infrastructure — no Redis dependency for this).

#### Decision

We will create a **single `camera_settings` JSONB table** for all per-camera settings and an **`alerts` table** for alert persistence.

**Camera Settings approach:**
- Table: `camera_settings(camera_id UUID PK, settings JSONB NOT NULL DEFAULT '{}', updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`
- One row per camera. The JSONB blob contains all setting types under separate keys:
  ```json
  {
    "motion": { "sensitivity": 90, "requiredConsecutiveFrames": 3, ... },
    "objectDetection": { "enabled": true, "minConfidence": 0.5, ... }
  }
  ```
- On server startup, all settings are loaded into the in-memory Maps (existing data structures remain for fast access)
- On settings update via PUT endpoint, both the DB row and the in-memory Map are updated atomically
- The `ConsolidatedDetectionService` gains a `loadFromDb()` method called at startup, and its update methods write to both DB and memory

**Alerts approach:**
- Table: `alerts(id UUID PK DEFAULT gen_random_uuid(), type VARCHAR(50) NOT NULL, severity VARCHAR(20) NOT NULL, message TEXT NOT NULL, camera_id UUID, acknowledged BOOLEAN DEFAULT FALSE, created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ)`
- `InMemoryStateService` writes new alerts to DB in addition to the in-memory ring buffer
- On startup, the ring buffer is repopulated from the last 100 DB alerts
- Old alerts are pruned by the existing `retentionPolicyService`

#### Alternatives Considered

| Alternative | Description | Pros | Cons | Reason Rejected |
|---|---|---|---|---|
| Dedicated tables per setting (motion_settings, detection_settings, face_settings) | Separate normalized tables | Clean schema, typed columns, FK constraints | 3 migrations, more ORM entities, JOINs on every settings load | Over-engineered for what is essentially key-value data per camera |
| Redis-only persistence | Store settings as Redis hashes/key-value | Fast, already have Redis | Redis can lose data on restart (RDB/AOF config-dependent), adds operational dependency for settings durability | Settings are too important to depend on Redis availability |
| File-based JSON persistence | Write settings to a JSON file on disk | No DB dependency, simple | No transactional safety, no backup strategy, race conditions on concurrent writes | Not production-grade for user configuration |
| Single `system_settings` table with discriminator column | One table with type/category column | One migration | Complex queries, mixed global and per-camera data in one table | Less clean than separate JSONB approach |

#### Consequences

**Positive**:
- All per-camera settings survive server restarts
- JSONB is flexible — adding new setting fields requires no migration, just default values
- Existing in-memory Maps remain as read-through caches — zero impact on hot-path performance
- Follows the proven pattern from `SettingsController` + `system_settings` table
- Alerts are persisted and survive restarts

**Negative**:
- JSONB fields are not type-checked at the DB level — validation must happen in application code
- Settings API responses include a DB write latency on PUT (mitigated: DB writes are fast for single-row JSONB updates)
- One more migration to run

**Risks**:
- Race condition: two concurrent PUT requests could overwrite each other's changes. Mitigation: use `UPDATE ... WHERE updated_at = :previous_timestamp` optimistic locking, or use a per-camera write lock.

**Follow-up actions**:
- [ ] Create migration: `CREATE TABLE camera_settings (camera_id UUID PRIMARY KEY, settings JSONB NOT NULL DEFAULT '{}', updated_at TIMESTAMPTZ DEFAULT NOW())`
- [ ] Create migration: `CREATE TABLE alerts (...)` with indexes on `(camera_id, created_at DESC)` and `(acknowledged, created_at DESC)`
- [ ] Refactor `detection-operations.ts` motionSettingsStore to delegate to ConsolidatedDetectionService with DB backing
- [ ] Add `loadFromDb()` to `ConsolidatedDetectionService`, called on server startup
- [ ] Update all PUT settings handlers to write DB + in-memory
- [ ] Wire `InMemoryStateService` to persist alerts to PostgreSQL
- [ ] Repopulate in-memory ring buffers from DB on startup
- [ ] Add retention cleanup for old alerts (use existing retentionPolicyService)
