# Phase 7: Security Improvements - Implementation Plan

**Created:** 2026-03-26
**Status:** Ready for implementation
**Estimated Duration:** 2-3 days

## Phase Boundary

Implement critical security fixes: encrypt RTSP camera credentials at rest, add rate limiting to detection endpoints, and validate all API inputs to prevent injection attacks.

## Implementation Overview

This phase addresses three critical security vulnerabilities:

1. **RTSP Credential Encryption** - Encrypt camera credentials stored in `server/cameras.json`
2. **Rate Limiting** - Add user-based rate limiting to detection/batch endpoints
3. **Input Validation** - Add Zod schemas to all API endpoints

---

## Part 1: RTSP Credential Encryption

### 1.1 Setup Infrastructure

**Task:** Create encryption service and database migration

**Files to create:**
- `server/src/services/credentialEncryption.ts` - Encryption/decryption service
- `database/migrations/009_credential_encryption.sql` - Migration for encrypted format

**Implementation:**
- Use AES-256-GCM for authenticated encryption
- Derive key from `CREDENTIAL_ENCRYPTION_KEY` env var using PBKDF2
- Store encrypted format: `{"encrypted": "base64", "iv": "base64", "tag": "base64"}`
- Add `CREDENTIAL_ENCRYPTION_KEY` to `.env` and `docker-compose.yml`

**Acceptance criteria:**
- Encryption service can encrypt/decrypt RTSP URLs
- Key derivation uses PBKDF2 with 100,000 iterations
- Unit tests for encryption/decryption

**References:**
- `.planning/codebase/CONCERNS.md:16-38` - RTSP credentials exposure
- `.planning/codebase/STACK.md` - crypto library availability

### 1.2 Create Migration Script

**Task:** One-time migration script to encrypt all credentials

**Files to create:**
- `server/src/scripts/migrateCredentials.ts` - Migration script

**Implementation:**
- Read `server/cameras.json`
- For each camera, encrypt RTSP URL
- Replace plaintext with encrypted format
- Create backup before migration: `server/cameras.json.backup`
- Log success/failure for each camera
- Support dry-run mode with `--dry-run` flag

**Acceptance criteria:**
- Script encrypts all camera credentials
- Backup file created
- Can run with dry-run flag
- Logs migration results

**Usage:**
```bash
cd server
npm run build
node dist/scripts/migrateCredentials.js --dry-run  # Test first
node dist/scripts/migrateCredentials.js            # Run migration
```

### 1.3 Update Camera Configuration Loader

**Task:** Modify `server/src/config/index.ts` to decrypt credentials at runtime

**Files to modify:**
- `server/src/config/index.ts` - Camera config loader

**Implementation:**
- Check if credential is encrypted (has "encrypted" field)
- If encrypted, decrypt using credentialEncryption service
- If plaintext, log warning and use as-is (backward compatibility)
- If decryption fails, fall back to plaintext with error log
- Pass decrypted RTSP URL to stream manager

**Acceptance criteria:**
- Loads encrypted credentials successfully
- Falls back to plaintext with warnings
- Logs security events appropriately

**References:**
- `.planning/codebase/STRUCTURE.md` - Config loader location

### 1.4 Add Security Events Logging

**Task:** Create audit logging for security events

**Files to create:**
- `database/migrations/010_security_events.sql` - Security events table
- `server/src/models/SecurityEvent.ts` - TypeORM model

**Implementation:**
- Table columns: id, timestamp, event_type, user_id, details
- Event types: CREDENTIAL_DECRYPTION_FAILED, PLAINTEXT_CREDENTIALS_DETECTED
- Log to security_events table on credential events
- Use existing logger utility

**Acceptance criteria:**
- Security events table created
- Logs credential decryption failures
- Logs plaintext credential usage
- Can query security events by type

**References:**
- `.planning/codebase/TESTING.md` - Test structure

### 1.5 Testing and Validation

**Task:** Test credential encryption and migration

**Tests to create:**
- `server/tests/services/credentialEncryption.test.ts` - Encryption service tests
- `server/tests/integration/credentialMigration.test.ts` - Migration integration test

**Test cases:**
- Encrypt and decrypt RTSP URL correctly
- Handle malformed encrypted data
- Fallback to plaintext when decryption fails
- Migration script creates backup
- Migration script preserves camera configuration

**Acceptance criteria:**
- 80% test coverage
- All tests pass
- Migration tested on staging data

---

## Part 2: Rate Limiting

### 2.1 Create Rate Limit Infrastructure

**Task:** Create rate limit counter table and middleware

**Files to create:**
- `database/migrations/011_rate_limit_counters.sql` - Rate limit table
- `server/src/models/RateLimitCounter.ts` - TypeORM model
- `server/src/middleware/rateLimit.ts` - Rate limiting middleware

**Implementation:**
- Table columns: id, user_id, endpoint, count, window_start
- Middleware uses JWT user_id from auth middleware
- Sliding window algorithm
- Query database for current count
- Increment count on each request
- Delete expired records (older than window)
- Return 429 with Retry-After header when limit exceeded

**Acceptance criteria:**
- Rate limit table created
- Middleware checks user request count
- Returns 429 when limit exceeded
- Includes Retry-After header

**References:**
- `.planning/codebase/CONCERNS.md:182-197` - No rate limiting issue
- `.planning/codebase/STRUCTURE.md` - Middleware location

### 2.2 Configure Rate Limits by Endpoint Type

**Task:** Define rate limit tiers for different endpoint types

**Files to create:**
- `server/src/config/rateLimits.ts` - Rate limit configuration

**Configuration:**
```typescript
const RATE_LIMITS = {
  STANDARD: { requests: 100, window: 15 * 60 * 1000 }, // 100 per 15 min
  DETECTION: { requests: 10, window: 60 * 1000 },      // 10 per minute
  BATCH: { requests: 5, window: 60 * 60 * 1000 },      // 5 per hour
}
```

**Implementation:**
- Map endpoint patterns to rate limit tiers
- `/api/detection/*` → DETECTION
- `/api/batch/*` → BATCH
- Other authenticated endpoints → STANDARD
- Make configurable via environment variables

**Acceptance criteria:**
- Rate limits configurable per endpoint type
- Environment variables override defaults
- Documentation for configuration

### 2.3 Apply Rate Limiting to Protected Endpoints

**Task:** Add rate limit middleware to detection and batch routes

**Files to modify:**
- `server/src/routes/detectionRoutes.ts` - Detection endpoints
- `server/src/routes/batchDetection.ts` - Batch endpoints
- `server/src/routes/index.ts` - Other critical endpoints

**Implementation:**
- Add rate limit middleware to router before route handlers
- Use appropriate tier for each route (DETECTION, BATCH, STANDARD)
- Skip rate limiting for health checks and public endpoints
- Log rate limit violations to security_events table

**Acceptance criteria:**
- All detection endpoints have rate limiting
- All batch endpoints have rate limiting
- Health checks not rate limited
- Rate limit violations logged

**References:**
- `.planning/codebase/STRUCTURE.md` - Route locations

### 2.4 Add Rate Limit Cleanup Job

**Task:** Create scheduled job to clean up expired rate limit records

**Files to create:**
- `server/src/services/rateLimitCleanup.ts` - Cleanup service

**Implementation:**
- Run every hour using node-cron
- Delete rate_limit_counters older than 1 hour
- Log cleanup statistics

**Acceptance criteria:**
- Cleanup job runs hourly
- Removes expired rate limit records
- Logs cleanup results

### 2.5 Testing and Validation

**Task:** Test rate limiting functionality

**Tests to create:**
- `server/tests/middleware/rateLimit.test.ts` - Rate limit middleware tests
- `server/tests/integration/rateLimitIntegration.test.ts` - Integration tests

**Test cases:**
- Allow requests within limit
- Block requests exceeding limit
- Return 429 with Retry-After header
- Different limits per endpoint type
- Sliding window accuracy
- Cleanup job removes expired records

**Acceptance criteria:**
- 80% test coverage
- All tests pass
- Manual testing with API client

---

## Part 3: Input Validation

### 3.1 Create Validation Schema Library

**Task:** Create centralized Zod schemas for all API inputs

**Files to create:**
- `server/src/schemas/validationSchemas.ts` - Shared validation schemas

**Implementation:**
- Create schemas for all request bodies and query params
- Group by endpoint or domain (auth, events, visitors, detection, etc.)
- Export reusable schema components (pagination, dates, IDs)
- Use Zod for runtime validation with TypeScript inference

**Example schemas:**
```typescript
export const eventListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
  eventType: z.enum(['motion', 'object', 'face']).optional(),
  cameraId: z.enum(['cam1', 'cam2']).optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
})
```

**Acceptance criteria:**
- Schemas for all API endpoints
- Reusable common schemas
- TypeScript types inferred from schemas

**References:**
- `.planning/codebase/CONCERNS.md:78-100` - No input validation issue
- `.planning/codebase/STACK.md` - Zod availability

### 3.2 Create Validation Middleware

**Task:** Create middleware to validate requests using Zod schemas

**Files to create:**
- `server/src/middleware/validation.ts` - Validation middleware

**Implementation:**
- Generic validation middleware factory
- Accepts Zod schema and validation target (body, query, params)
- Returns 400 with validation errors if invalid
- Logs validation failures to security_events
- Integrates with existing error middleware

**Acceptance criteria:**
- Middleware validates request data
- Returns 400 on validation failure
- Includes validation error details
- Logs validation failures

### 3.3 Apply Validation to All Endpoints

**Task:** Add validation middleware to all routes in `server/src/routes/index.ts`

**File to modify:**
- `server/src/routes/index.ts` - Main routes file (16,000+ lines)

**Implementation:**
- For each endpoint, identify required schema
- Add validation middleware before route handler
- Validate query params, request bodies, and URL params
- Remove any existing manual validation code
- Test each endpoint with invalid inputs

**Acceptance criteria:**
- All endpoints have input validation
- Invalid inputs rejected with 400
- Valid inputs processed normally
- Manual validation code removed

**References:**
- `.planning/codebase/STRUCTURE.md` - Route organization
- `.planning/codebase/CONVENTIONS.md` - Middleware chain pattern

### 3.4 Testing and Validation

**Task:** Test input validation across all endpoints

**Tests to create:**
- `server/tests/middleware/validation.test.ts` - Validation middleware tests
- `server/tests/integration/validationIntegration.test.ts` - Integration tests

**Test cases:**
- Valid inputs pass validation
- Invalid inputs return 400
- Validation error messages are clear
- SQL injection attempts blocked
- XSS attempts blocked
- Path traversal attempts blocked

**Acceptance criteria:**
- 80% test coverage
- All tests pass
- Security test cases pass

---

## Integration and Deployment

### 4.1 Update Environment Configuration

**Task:** Add new environment variables

**Files to modify:**
- `server/.env.example` - Environment variable template
- `docker-compose.yml` - Docker environment variables

**Variables to add:**
```
CREDENTIAL_ENCRYPTION_KEY=<32-byte random key>
RATE_LIMIT_STANDARD_REQUESTS=100
RATE_LIMIT_STANDARD_WINDOW=900000
RATE_LIMIT_DETECTION_REQUESTS=10
RATE_LIMIT_DETECTION_WINDOW=60000
RATE_LIMIT_BATCH_REQUESTS=5
RATE_LIMIT_BATCH_WINDOW=3600000
```

**Acceptance criteria:**
- All env vars documented
- .env.example updated
- docker-compose.yml includes defaults

### 4.2 Update Documentation

**Task:** Document security changes

**Files to create:**
- `docs/SECURITY.md` - Security documentation

**Content:**
- Credential encryption process
- How to generate encryption key
- How to run credential migration
- Rate limiting configuration
- Input validation overview
- Troubleshooting common issues

**Acceptance criteria:**
- Complete security documentation
- Migration steps documented
- Configuration documented

### 4.3 Deployment and Testing

**Task:** Deploy to production and validate

**Steps:**
1. Create backup of `server/cameras.json`
2. Run database migrations
3. Build and deploy updated services
4. Run credential migration script
5. Verify camera streams work
6. Test rate limiting with API client
7. Test input validation with malformed requests
8. Monitor security_events table
9. Verify system stability

**Rollback plan:**
- Restore `server/cameras.json.backup` if migration fails
- Revert database migrations if needed
- Fall back to plaintext credentials (supported during transition)

**Acceptance criteria:**
- All security fixes deployed
- Camera streams working
- Rate limiting active
- Input validation working
- No critical errors in logs

---

## Success Criteria

Phase 7 is complete when:

1. **RTSP credentials encrypted at rest**
   - All camera credentials in `server/cameras.json` are encrypted
   - Encryption key stored in environment variable
   - Decryption works correctly at runtime
   - Fallback to plaintext if decryption fails

2. **Rate limiting active on critical endpoints**
   - Detection endpoints limited to 10 requests/minute
   - Batch endpoints limited to 5 requests/hour
   - Other endpoints limited to 100 requests/15 minutes
   - 429 responses with Retry-After header

3. **Input validation on all API endpoints**
   - All endpoints validate request inputs
   - Invalid inputs rejected with 400
   - Zod schemas defined for all inputs
   - Injection attempts blocked

4. **Testing complete**
   - Unit tests for all new services
   - Integration tests for rate limiting
   - Security test cases pass
   - 80% code coverage threshold met

5. **Documentation updated**
   - Security documentation created
   - Migration steps documented
   - Configuration documented

---

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Migration breaks camera streams | High | Backup before migration; fallback to plaintext; test on staging |
| Rate limit too restrictive | Medium | Make configurable; monitor violations; adjust thresholds |
| Validation breaks existing clients | Medium | Test with real API clients; clear error messages |
| Performance degradation | Low | Database indexes on rate_limit_counters; efficient queries |
| Encryption key compromised | High | Use Docker secrets in production; rotate keys periodically |

---

## Dependencies

**Required before starting:**
- Phase 6 complete
- Database backups created
- Development environment ready

**Blocks:**
- Phase 8 (depends on stable security baseline)

---

## Notes

- Focus on critical security fixes only
- Deferred ideas belong in future phases
- Maintain backward compatibility during transition
- Monitor security_events table after deployment
- Plan to remove plaintext fallback after validation period

*Phase: 07-security-improvements-fix-critical-vulnerabilities-rtsp-credentials-rate-limiting-input-validation*
*Plan created: 2026-03-26*
