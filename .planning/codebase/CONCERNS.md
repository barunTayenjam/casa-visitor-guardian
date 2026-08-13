# Codebase Concerns

**Analysis Date:** 2026-08-13

## Tech Debt

**Logging Infrastructure:**
- Issue: logDatabase disabled, needs migration to PostgreSQL audit_logs
- Files: `server/src/utils/logger.ts:110`
- Impact: Audit logging incomplete, may miss security events
- Fix approach: Implement PostgreSQL audit_logs table and migrate logging

**Multiple Detection Services:**
- Issue: Duplicate detection implementations across services
- Files: `server/src/services/detection/consolidatedDetectionService.ts`, `server/src/detection/DetectionService.ts`, `server/src/detection/ConsolidatedDetectionService.ts`
- Impact: Confusion about which service to use, maintenance burden
- Fix approach: Consolidate to single detection service interface

**Error Handling Patterns:**
- Issue: Inconsistent use of `return null` for error cases
- Files: `server/src/services/cacheService.ts:134,138,217,221`, `server/src/streams/rtspManager.ts:418,423,440,446,560`, `server/src/controllers/NvidiaController.ts:91,184,185,348,349`
- Impact: Silent failures, hard to debug production issues
- Fix approach: Use Result<T> pattern or explicit error returns

## Known Bugs

**No TypeScript Test Suite:**
- Symptoms: Only JavaScript test file exists (`server/tests/simple.test.js`)
- Files: `server/tests/simple.test.js`
- Trigger: Running `npm test` executes Jest but coverage is minimal
- Workaround: None - testing gap is significant

## Security Considerations

**CORS Configuration:**
- Risk: Loose CORS policies may allow unauthorized access
- Files: `server/src/config/cors.ts`
- Current mitigation: Environment-based whitelist (`CORS_ORIGINS`)
- Recommendations: Validate all origins are HTTPS in production, add CSP headers

**Session Management:**
- Risk: Multiple session implementations (express-session, passport)
- Files: `server/src/config/session.ts`, `server/src/config/passport.ts`
- Current mitigation: Standard session configuration
- Recommendations: Audit session storage security, ensure proper timeout

**API Key Handling:**
- Risk: Multiple API key configs (OpenCV, OpenAI) may leak in logs
- Files: `server/src/config/index.ts:31-41`
- Current mitigation: Environment variables with defaults
- Recommendations: Mask sensitive keys in logs, rotate periodically

## Performance Bottlenecks

**RTSP Stream Memory:**
- Problem: RTSPManager keeps all active stream references in memory
- Files: `server/src/streams/rtspManager.ts:45`
- Cause: Map stores all Stream objects, no cleanup on disconnect
- Improvement path: Add LRU eviction or explicit stream cleanup

**Detection Pipeline:**
- Problem: Multiple detection services may run in parallel
- Files: `server/src/detection/ConsolidatedDetectionService.ts`
- Cause: Detection called from multiple routes without deduplication
- Improvement path: Implement detection request coalescing

## Fragile Areas

**Camera Configuration:**
- Files: `server/src/config/cameraLoader.ts`, `server/src/config/cameras.ts`
- Why fragile: Multiple camera config sources, potential conflicts
- Safe modification: Use CameraPersistence as single source of truth
- Test coverage: None

**Database Migrations:**
- Files: `server/src/database/migrations/`
- Why fragile: Manual migration scripts, no rollback mechanism
- Safe modification: Test migrations on staging first
- Test coverage: None

**WebSocket Events:**
- Files: `server/src/socket.ts`, `server/src/services/eventService.ts`
- Why fragile: Complex event emission across multiple services
- Safe modification: Document event contracts
- Test coverage: None

## Scaling Limits

**Active Streams:**
- Current capacity: ~10 concurrent RTSP streams
- Limit: Memory pressure at 4GB+ with 20+ streams
- Scaling path: Add stream pooling, limit max concurrent connections

**Detection Queue:**
- Current capacity: Single detection request at a time
- Limit: Queue buildup during high-traffic periods
- Scaling path: Implement request coalescing, add priority queue

## Dependencies at Risk

**TypeORM:**
- Risk: Heavy ORM overhead for simple operations
- Impact: Performance degradation at scale
- Migration plan: Consider lighter alternatives (Kysely) for read-heavy queries

**Socket.io:**
- Risk: Complex state management for room connections
- Impact: Memory leaks if connections not cleaned up
- Migration plan: Audit connection lifecycle, add health checks

## Missing Critical Features

**Rate Limiting Gaps:**
- Problem: No rate limiting on internal service calls
- Blocks: Abuse prevention for detection endpoints

**Request Validation:**
- Problem: Inconsistent input validation across routes
- Blocks: Security hardening, API stability

## Test Coverage Gaps

**Detection Pipeline:**
- What's not tested: End-to-end detection flow
- Files: `server/src/services/detection/*.ts`
- Risk: Detection failures may go unnoticed
- Priority: High

**Stream Management:**
- What's not tested: RTSP stream lifecycle, error recovery
- Files: `server/src/streams/rtspManager.ts`
- Risk: Stream failures may crash server
- Priority: High

**Database Operations:**
- What's not tested: Migration scripts, complex queries
- Files: `server/src/services/*.ts`
- Risk: Data corruption on schema changes
- Priority: Medium

---

*Concerns audit: 2026-08-13*
