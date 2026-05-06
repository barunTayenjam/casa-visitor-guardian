# Codebase Concerns

**Analysis Date:** 2026-05-05

## Overview

This document tracks technical debt, known issues, security concerns, performance bottlenecks, and operational risks in the SentryVision codebase. Items are categorized by severity and type.

---

## Security Considerations

### Critical

**RTSP Credentials Exposed in Configuration**
- **Files:** `server/cameras.json`
- **Issue:** Camera credentials embedded in plaintext URLs: `rtsp://user:password@192.168.31.62:554/stream1`
- **Risk:** Credentials may be accidentally committed to version control; anyone with file access can view camera feeds
- **Recommendation:** Implement credential management system, encrypt credentials at rest, use environment variables or Docker secrets

**JWT Secrets in Docker Compose**
- **Files:** `docker-compose.yml`
- **Issue:** JWT secrets hardcoded in development configuration
- **Risk:** Credentials exposed in container configuration
- **Recommendation:** Use Docker secrets or environment variables; never commit secrets to version control

**File Upload Validation Gaps**
- **Files:** `server/src/routes/index.ts` (line 33-38: multer config)
- **Issue:** File upload endpoints may not properly validate file types, sizes, and content
- **Risk:** Malicious file upload could compromise system
- **Recommendation:** Add comprehensive file validation middleware

### High

**CORS with Multiple Hardcoded Origins**
- **Files:** `server/src/index.ts` (line 46), `server/src/config/index.ts`
- **Issue:** CORS configured with hardcoded IP addresses: `'http://192.168.31.99:5173', 'http://192.168.31.99:8082'`
- **Risk:** Origin validation relies on IP addresses which may change
- **Recommendation:** Use environment variable for CORS origins; implement proper origin validation

**No Rate Limiting on Detection Endpoints**
- **Files:** `server/src/routes/detectionRoutes.ts`, `server/src/routes/index.ts`
- **Issue:** Detection endpoints lack rate limiting; could be abused to overload OpenCV service
- **Risk:** Denial of Service attacks; OpenCV service overload; resource exhaustion
- **Recommendation:** Add rate limiting middleware; implement per-user limits; consider queue system for batch operations

**Sensitive Data in Environment Variables**
- **Files:** Throughout `server/src/config/`
- **Issue:** 136+ environment variable accesses; secrets may be logged
- **Risk:** Secret exposure through logs
- **Recommendation:** Never log environment variables; use proper secret management

### Medium

**Face Embeddings Stored Without Encryption**
- **Files:** `server/src/services/advancedFaceRecognitionService.ts`
- **Issue:** Biometric data (face embeddings) stored in plaintext
- **Risk:** Privacy violation; biometric data exposure
- **Recommendation:** Encrypt embeddings at rest

**SQL Injection Risk in Custom Queries**
- **Files:** `server/src/routes/index.ts` (lines 62-72, 173-200+)
- **Issue:** Raw SQL queries with direct parameter interpolation in some places
- **Risk:** SQL injection attacks
- **Recommendation:** Use parameterized queries everywhere; verify all user inputs

---

## Performance Bottlenecks

### High

**Massive Route File (5,132 Lines)**
- **Files:** `server/src/routes/index.ts`
- **Issue:** Single route file contains 5,132 lines with 241 try-catch blocks; difficult to navigate and maintain
- **Impact:** Maintainability issues; longer loading times; difficult to test
- **Recommendation:** Split into feature-based route files; create barrel exports

**Socket.io Frame Transmission**
- **Files:** `server/src/streams/rtspManager.ts`
- **Issue:** Full JPEG frames (50-100KB each) sent over WebSocket to multiple clients
- **Impact:** High bandwidth usage; latency in streaming; browser performance issues; doesn't scale
- **Recommendation:** Compress frames; implement adaptive quality; consider WebRTC for production

### Medium

**No Database Connection Pooling Configuration**
- **Files:** `server/src/database.ts` (line 21-32)
- **Issue:** TypeORM connection pool not explicitly configured; no min/max limits
- **Risk:** Too many connections exhaust database; too few connections cause contention
- **Recommendation:** Configure pool size; set connection timeout; enable health checks

**Three Duplicate Motion Detection Implementations**
- **Files:**
  - `server/src/detection/optimizedMotionDetection.ts` (988 lines)
  - `server/src/detection/simpleMotionDetection.ts` (138 lines)
  - `server/src/detection/motionTriggeredDetection.ts` (664 lines)
- **Issue:** Redundant code paths; maintenance overhead
- **Recommendation:** Consolidate into single implementation; document rationale for each approach

**Synchronous Image Processing**
- **Files:** `server/src/services/automatedCleanupService.ts`, `server/src/detection/`
- **Issue:** CPU-intensive operations run synchronously, blocking event loop
- **Risk:** Application responsiveness degradation
- **Recommendation:** Use worker threads for CPU-intensive operations

### Low

**No Request Caching for Expensive Operations**
- **Files:** Throughout backend
- **Issue:** Analytics queries, event statistics, and visitor counts not cached
- **Impact:** Repeated expensive database queries
- **Recommendation:** Add Redis caching; implement cache invalidation strategy

**No Code Splitting for Frontend Routes**
- **Files:** `frontend/src/App.tsx`
- **Issue:** All routes loaded upfront; no lazy loading
- **Impact:** Larger initial bundle; slower load times
- **Recommendation:** Use React.lazy() for all routes

---

## Technical Debt

### High

**TypeScript Strict Mode Disabled**
- **Files:** `frontend/tsconfig.json`, `server/tsconfig.json`
- **Issue:** Both frontend and backend have `"strict": false`
- **Impact:** Reduced type safety; potential runtime errors; implicit any types
- **Recommendation:** Enable strict mode incrementally; start with strictNullChecks

**No Automated Testing for OpenCV Service**
- **Files:** `opencv-service/`
- **Issue:** Python service has zero test coverage; no pytest, no unit tests
- **Risk:** Undetected bugs in detection logic; regression when updating CV libraries
- **Recommendation:** Add pytest tests; test detection functions; mock OpenCV operations

### Medium

**Inconsistent Error Handling**
- **Files:** Throughout codebase; particularly `server/src/routes/index.ts` (241 try-catch blocks)
- **Issue:** Three patterns observed: silent failure, generic error throw, error object return
- **Impact:** User experience issues; difficult debugging
- **Recommendation:** Standardize error handling; create custom error classes; consistent error responses

**No API Versioning**
- **Files:** `server/src/routes/`
- **Issue:** All endpoints at `/api/*` with no versioning
- **Risk:** Breaking changes affect all clients; can't maintain multiple versions
- **Recommendation:** Add versioning: `/api/v1/events`, `/api/v2/events`

**No Frontend Component Tests**
- **Files:** `frontend/src/components/`
- **Issue:** No React Testing Library tests; no component integration tests
- **Impact:** Undetected UI bugs; risky refactoring
- **Recommendation:** Add component tests for critical UI; test user interactions

### Low

**Code Duplication in Detection Logic**
- **Files:** `server/src/detection/` (three implementations)
- **Issue:** Multiple implementations of same functionality
- **Recommendation:** Consolidate; remove unused code

**No API Documentation**
- **Files:** Backend routes
- **Issue:** No OpenAPI/Swagger docs
- **Recommendation:** Auto-generate documentation

---

## Operational Concerns

### High

**In-Memory State Can't Scale Across Instances**
- **Files:** `server/src/routes/index.ts` (lines 92-95: recentEvents, alerts stored in memory)
- **Issue:** Recent events and alerts stored in memory; can't share across multiple instances
- **Risk:** State lost on restart; can't scale horizontally
- **Recommendation:** Move state to Redis; implement session affinity

**Limited Health Check**
- **Files:** `server/src/index.ts` (health endpoint)
- **Issue:** Health check doesn't verify database, Redis, or OpenCV service connections
- **Risk:** System reports healthy when critical services down
- **Recommendation:** Check all dependencies; return comprehensive health status

### Medium

**No Request/Response Logging**
- **Files:** Backend middleware
- **Issue:** No structured request logging; difficult to debug production issues
- **Recommendation:** Add request logging middleware; use structured JSON logging

**Cleanup Service Needs Verification**
- **Files:** `server/src/services/automatedCleanupService.ts` (537 lines)
- **Issue:** Recently implemented (image cleanup automation); may have edge cases
- **Risk:** Data loss if cleanup logic incorrect; preserved files may be deleted
- **Recommendation:** Verify cleanup logic thoroughly; add logging for cleanup operations; test retention policy enforcement

### Low

**No Automated Dependency Updates**
- **Files:** `package.json` files
- **Issue:** Dependencies updated manually; may miss security patches
- **Recommendation:** Use Dependabot or Renovate

**No Performance Monitoring**
- **Files:** Frontend, Backend
- **Issue:** No Core Web Vitals tracking; no backend metrics
- **Recommendation:** Add monitoring; track key metrics

---

## Recent Changes (Not Fully Documented)

### Frontend Consolidation
- **Files:** `frontend/src/pages/*.new.tsx` (DayHighlights.new.tsx, EventsPage.new.tsx, etc.)
- **Issue:** Multiple new page versions created with `.new.tsx` suffix; indicates ongoing refactoring
- **Concern:** Old files may not be cleaned up; potential code duplication
- **Recommendation:** Complete consolidation; remove old files after validation

### Mobile UX
- **Files:** `frontend/src/lib/utils.ts` (line 107: isMobile utility)
- **Issue:** Basic mobile detection exists but limited mobile-specific UX improvements
- **Concern:** Touch interactions may not be optimized; responsive layouts incomplete
- **Recommendation:** Add comprehensive mobile support; test on actual devices

### Image Cleanup Automation
- **Files:** `server/src/services/automatedCleanupService.ts`
- **Status:** Implemented with storage stats, retention policies, and scheduled cleanup
- **Concern:** Needs production verification; edge cases around AI-analyzed images preservation
- **Recommendation:** Monitor cleanup runs; verify retention logic; test file deletion paths

---

## Concerns by Priority

### Immediate (This Sprint)
1. RTSP credentials encryption
2. Rate limiting on detection endpoints
3. Health check improvements (check all dependencies)

### Short-Term (1-2 Months)
4. TypeScript strict mode for new code
5. Split large route file
6. Input validation on all endpoints
7. Standardize error handling

### Medium-Term (2-4 Months)
8. Implement caching layer (Redis)
9. Frontend component tests
10. API versioning
11. WebSocket frame compression

### Long-Term (4-6 Months)
12. Enable full TypeScript strict mode
13. WebRTC implementation for streaming
14. OpenCV service test coverage
15. Comprehensive monitoring

---

## Additional Findings

**Database Configuration:**
- **File:** `server/src/database.ts`
- **Good:** synchronize set to false (production-safe)
- **Concern:** No explicit pool configuration; no connection timeout settings

**Authentication:**
- **File:** `server/src/services/authenticationService.ts`, `server/src/services/totpService.ts`
- **Good:** TOTP MFA implemented; password history tracking
- **Concern:** Backup codes stored with encryption key from environment

**Logging:**
- **File:** `server/src/utils/logger.ts` (line 110: TODO comment about audit_logs migration)
- **Concern:** Audit logging to database not fully implemented

---

*Last Updated: 2026-05-05*

*Next Review: 2026-06-05*