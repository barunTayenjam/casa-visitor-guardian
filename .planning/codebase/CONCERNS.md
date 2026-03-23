# SentryVision Codebase Concerns

## Overview

This document tracks technical debt, known issues, security concerns, and areas requiring attention in the SentryVision codebase. Items are categorized by severity and impact.

## Severity Levels

- **Critical:** Immediate attention required (security, data loss)
- **High:** Important issues affecting functionality
- **Medium:** Technical debt and improvements
- **Low:** Nice-to-have improvements and optimizations

## Critical Concerns

### 1. RTSP Credentials Exposed in Configuration
**Location:** `server/cameras.json`
**Severity:** Critical
**Impact:** Security vulnerability

**Issue:**
RTSP camera credentials are embedded in URLs within `cameras.json`:
```json
"path": "rtsp://user:password@192.168.31.62:554/stream1"
```

**Risk:**
- Credentials stored in plaintext
- File may be accidentally committed to version control
- Anyone with file access can view camera feeds

**Recommendation:**
- Implement credential management system
- Encrypt credentials at rest
- Use environment variables or Docker secrets
- Add `cameras.json` to `.gitignore`

**Estimated Effort:** 4-8 hours

---

### 2. TypeScript Strict Mode Disabled
**Location:** `frontend/tsconfig.json`, `server/tsconfig.json`
**Severity:** High
**Impact:** Type safety, code quality

**Issue:**
Both frontend and backend have `strict: false`:
```json
{
  "compilerOptions": {
    "strict": false
  }
}
```

**Risk:**
- Reduced type safety
- Potential runtime errors
- Missed type-related bugs
- Lower code quality

**Impact Areas:**
- Implicit any types
- Null/undefined not properly checked
- Type inference may be incorrect

**Recommendation:**
- Enable strict mode incrementally
- Fix type errors one module at a time
- Start with new code, refactor old code
- Use `strictNullChecks` first

**Estimated Effort:** 20-40 hours

---

### 3. No Input Validation on Some Endpoints
**Location:** `server/src/routes/index.ts` (16,000+ lines)
**Severity:** High
**Impact:** Security, data integrity

**Issue:**
Some endpoints lack proper input validation:
```typescript
router.post('/endpoint', async (req, res) => {
  const data = req.body; // No validation!
  // Process data directly
});
```

**Risk:**
- SQL injection attempts
- XSS vulnerabilities
- Invalid data in database
- Crashes from malformed input

**Recommendation:**
- Add Zod validation to all endpoints
- Create validation schemas for all inputs
- Sanitize user input
- Use TypeORM parameterized queries (already done)

**Estimated Effort:** 10-15 hours

---

## High Severity Concerns

### 4. Giant Route File (16,000+ Lines)
**Location:** `server/src/routes/index.ts`
**Severity:** High
**Impact:** Maintainability

**Issue:**
Main routes file is too large (16,000+ lines), making it difficult to:
- Navigate and find code
- Review changes
- Test independently
- Maintain and update

**Recommendation:**
- Split into feature-based route files
- Create barrel exports
- Group related endpoints
- Already partially done (auth.ts, visitorRoutes.ts, etc.)

**Estimated Effort:** 8-12 hours

---

### 5. No Automated Testing for OpenCV Service
**Location:** `opencv-service/`
**Severity:** High
**Impact:** Code quality, regression bugs

**Issue:**
Python OpenCV service has no test coverage:
- No unit tests
- No integration tests
- Changes can break detection silently

**Risk:**
- Undetected bugs in detection logic
- Regression when updating CV libraries
- No confidence in changes

**Recommendation:**
- Add pytest tests
- Test detection functions
- Mock OpenCV operations
- Test face recognition pipeline

**Estimated Effort:** 15-20 hours

---

### 6. No Rate Limiting on Detection Endpoints
**Location:** `server/src/routes/detectionRoutes.ts`
**Severity:** High
**Impact:** Performance, DoS vulnerability

**Issue:**
Detection endpoints lack rate limiting:
```typescript
router.post('/detection/redo', async (req, res) => {
  // No rate limiting!
  // Could be abused to overload OpenCV service
});
```

**Risk:**
- Denial of Service attacks
- OpenCV service overload
- Resource exhaustion

**Recommendation:**
- Add rate limiting middleware
- Per-user rate limits
- Queue system for batch operations
- Circuit breaker pattern (partially implemented)

**Estimated Effort:** 4-6 hours

---

### 7. Sensitive Data in Environment Variables Not Protected
**Location:** `.env`, `.env.example`, `docker-compose.yml`
**Severity:** High
**Impact:** Security

**Issue:**
- JWT secrets in docker-compose.yml (development)
- No secrets management for production
- Environment variables may be logged

**Recommendation:**
- Use Docker secrets
- External secret management (HashiCorp Vault)
- Never log environment variables
- Rotate secrets regularly

**Estimated Effort:** 6-10 hours

---

## Medium Severity Concerns

### 8. No Frontend Component Tests
**Location:** `frontend/src/components/`
**Severity:** Medium
**Impact:** Code quality, regression bugs

**Issue:**
Frontend lacks component tests:
- No React Testing Library tests
- No component integration tests
- UI changes can break functionality

**Impact:**
- Undetected UI bugs
- Refactoring is risky
- No confidence in component changes

**Recommendation:**
- Add component tests for critical UI
- Test user interactions
- Test error boundaries
- Start with authentication components

**Estimated Effort:** 20-30 hours

---

### 9. Inconsistent Error Handling
**Location:** Throughout codebase
**Severity:** Medium
**Impact:** User experience, debugging

**Issue:**
Error handling patterns vary:
```typescript
// Pattern 1: Silent failure
try {
  await operation();
} catch (error) {
  console.error(error); // Only logged
}

// Pattern 2: Throw generic error
throw new Error('Operation failed');

// Pattern 3: Return error object
return { success: false, error: error.message };
```

**Recommendation:**
- Standardize error handling
- Create custom error classes
- Consistent error responses
- Proper error logging with context
- User-friendly error messages

**Estimated Effort:** 8-12 hours

---

### 10. No API Versioning
**Location:** `server/src/routes/`
**Severity:** Medium
**Impact:** API stability, backward compatibility

**Issue:**
All endpoints are at `/api/*` with no versioning:
```
/api/events
/api/visitors
/api/auth
```

**Risk:**
- Breaking changes affect all clients
- Can't maintain multiple API versions
- Difficult to deprecate features

**Recommendation:**
- Add versioning: `/api/v1/events`, `/api/v2/events`
- Document API changes
- Deprecation timeline for old versions
- Use feature flags for gradual rollout

**Estimated Effort:** 4-6 hours

---

### 11. No Request/Response Validation Logging
**Location:** Backend middleware
**Severity:** Medium
**Impact:** Debugging, security auditing

**Issue:**
- No request logging
- No response logging
- Difficult to debug issues in production
- No audit trail for API calls

**Recommendation:**
- Add request logging middleware
- Log response status codes
- Log errors with context
- Use structured logging (JSON)
- Implement audit logging (partially done in audit_logs table)

**Estimated Effort:** 6-8 hours

---

### 12. Large Video Frames Transmitted Over Socket.io
**Location:** `server/src/streams/rtspManager.ts`
**Severity:** Medium
**Impact:** Performance, bandwidth

**Issue:**
Full JPEG frames sent over WebSocket:
```typescript
io.to(room).emit('frame', frameBuffer); // Can be 50-100KB
```

**Impact:**
- High bandwidth usage
- Latency in streaming
- Browser performance issues
- Doesn't scale with multiple viewers

**Recommendation:**
- Compress frames further
- Use WebRTC for streaming
- Implement adaptive quality
- Consider HLS/DASH for video streaming
- Reduce frame rate for multiple viewers

**Estimated Effort:** 16-24 hours (WebRTC implementation)

---

### 13. No Database Connection Pooling Configuration
**Location:** `server/src/database.ts`
**Severity:** Medium
**Impact:** Performance, scalability

**Issue:**
TypeORM connection pool not explicitly configured:
```typescript
createConnection({
  type: 'postgres',
  // No pool size limits
});
```

**Risk:**
- Too many connections exhaust database
- Too few connections cause contention
- No control over connection lifecycle

**Recommendation:**
- Configure pool size (min/max)
- Set connection timeout
- Enable connection health checks
- Monitor pool usage

**Estimated Effort:** 2-4 hours

---

## Low Severity Concerns

### 14. No Frontend Error Boundary for All Routes
**Location:** `frontend/src/App.tsx`
**Severity:** Low
**Impact:** User experience

**Issue:**
Error boundary only wraps part of the app:
```typescript
<ErrorBoundary>
  {/* Some routes */}
</ErrorBoundary>
```

**Recommendation:**
- Wrap entire app in ErrorBoundary
- Add fallback UI for errors
- Report errors to logging service
- Recovery mechanisms

**Estimated Effort:** 2-3 hours

---

### 15. No Health Check for Database
**Location:** Backend health endpoints
**Severity:** Low
**Impact:** Monitoring, reliability

**Issue:**
Health check doesn't verify database connection:
```typescript
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' }); // No DB check!
});
```

**Recommendation:**
- Check database connection
- Check Redis connection
- Check OpenCV service
- Return overall health status

**Estimated Effort:** 2-3 hours

---

### 16. No Request Caching for Expensive Operations
**Location:** Backend services
**Severity:** Low
**Impact:** Performance

**Issue:**
Frequent database queries not cached:
- Analytics queries
- Event statistics
- Visitor counts

**Recommendation:**
- Add Redis caching for expensive queries
- Cache invalidation strategy
- Cache warming for common queries
- Monitor cache hit rates

**Estimated Effort:** 6-8 hours

---

### 17. No API Documentation
**Location:** Backend routes
**Severity:** Low
**Impact:** Developer experience

**Issue:**
- No OpenAPI/Swagger docs
- No API reference
- Endpoints not documented

**Recommendation:**
- Add Swagger/OpenAPI specification
- Auto-generate documentation
- Include request/response examples
- Document authentication requirements

**Estimated Effort:** 8-12 hours

---

### 18. No Frontend Performance Monitoring
**Location:** Frontend
**Severity:** Low
**Impact:** User experience, optimization

**Issue:**
- No Core Web Vitals tracking
- No performance metrics
- Can't identify slow components

**Recommendation:**
- Add Web Vitals tracking
- Monitor bundle size
- Track component render times
- Use React DevTools Profiler

**Estimated Effort:** 4-6 hours

---

### 19. No Automated Dependency Updates
**Location:** `package.json` files
**Severity:** Low
**Impact:** Security, maintenance

**Issue:**
- Dependencies updated manually
- May miss security patches
- Outdated packages

**Recommendation:**
- Use Dependabot or Renovate
- Automate dependency updates
- Auto-merge minor updates
- Require approval for major updates

**Estimated Effort:** 2-3 hours (setup)

---

### 20. Code Duplication in Detection Logic
**Location:** `server/src/detection/`
**Severity:** Low
**Impact:** Maintainability

**Issue:**
Three different motion detection implementations:
- `optimizedMotionDetection.ts` (988 lines)
- `simpleMotionDetection.ts` (138 lines)
- `motionTriggeredDetection.ts` (664 lines)

**Recommendation:**
- Consolidate into single implementation
- Remove unused code
- Document why multiple implementations exist
- Choose best approach

**Estimated Effort:** 8-12 hours

---

## Security Concerns

### Authentication & Authorization

**Concern:** JWT secrets in docker-compose.yml
- **Severity:** High
- **Fix:** Use Docker secrets or environment variables

**Concern:** No account lockout after failed login attempts
- **Severity:** Medium
- **Fix:** Implement account lockout after N failed attempts

**Concern:** MFA bypass possible in some flows
- **Severity:** Medium
- **Fix:** Ensure MFA is required for all sensitive operations

### Data Protection

**Concern:** Face embeddings stored without encryption
- **Severity:** Medium
- **Impact:** Biometric data privacy
- **Fix:** Encrypt embeddings at rest

**Concern:** No data anonymization for analytics
- **Severity:** Low
- **Impact:** Privacy compliance
- **Fix:** Anonymize user data in analytics

### Input Validation

**Concern:** File upload not properly validated
- **Severity:** High
- **Fix:** Validate file types, sizes, content

**Concern:** SQL injection risk in custom queries
- **Severity:** Medium
- **Fix:** Use parameterized queries everywhere

---

## Performance Concerns

### Database Performance

**Concern:** No indexes on frequently queried columns
- **Severity:** Medium
- **Fix:** Add indexes on timestamp, camera_id, event_type

**Concern:** N+1 query problem in some endpoints
- **Severity:** Medium
- **Fix:** Use TypeORM relations and eager loading

**Concern:** No query result caching
- **Severity:** Low
- **Fix:** Cache common queries in Redis

### Application Performance

**Concern:** Synchronous image processing blocks event loop
- **Severity:** Medium
- **Fix:** Use worker threads for CPU-intensive operations

**Concern:** No connection pooling for PostgreSQL
- **Severity:** Medium
- **Fix:** Configure TypeORM connection pool

**Concern:** Large frames sent over WebSocket
- **Severity:** Medium
- **Fix:** Compress frames, use WebRTC

### Frontend Performance

**Concern:** No code splitting for routes
- **Severity:** Low
- **Fix:** Use React.lazy() for all routes

**Concern:** No image optimization
- **Severity:** Low
- **Fix:** Use WebP format, lazy loading

---

## Scalability Concerns

### Horizontal Scaling

**Concern:** No session affinity configuration
- **Severity:** Medium
- **Fix:** Configure sticky sessions for Socket.io

**Concern:** In-memory state can't be shared across instances
- **Severity:** High
- **Fix:** Move state to Redis

**Concern:** No load balancing strategy documented
- **Severity:** Low
- **Fix:** Document load balancer configuration

### Vertical Scaling

**Concern:** Resource limits not optimized
- **Severity:** Low
- **Fix:** Tune Docker resource limits

**Concern:** No auto-scaling configuration
- **Severity:** Low
- **Fix:** Add horizontal pod autoscaler (Kubernetes)

---

## Maintainability Concerns

### Code Quality

**Concern:** TypeScript strict mode disabled
- **Severity:** High
- **Impact:** Type safety, code quality

**Concern:** Large files (16,000+ lines)
- **Severity:** Medium
- **Impact:** Navigation, review

**Concern:** Inconsistent code style
- **Severity:** Low
- **Impact:** Readability

### Documentation

**Concern:** No API documentation
- **Severity:** Low
- **Impact:** Developer experience

**Concern:** Minimal code comments
- **Severity:** Low
- **Impact:** Understanding complex logic

**Concern:** No architecture decision records (ADRs)
- **Severity:** Low
- **Impact:** Historical context

### Testing

**Concern:** Low test coverage
- **Severity:** Medium
- **Impact:** Regression bugs

**Concern:** No E2E tests
- **Severity:** Medium
- **Impact:** Integration issues

**Concern:** No performance tests
- **Severity:** Low
- **Impact:** Performance regressions

---

## Technical Debt Summary

### High Priority (Address within 1-2 sprints)
1. RTSP credentials encryption
2. TypeScript strict mode (incremental)
3. Input validation on all endpoints
4. Rate limiting on detection endpoints
5. Automated testing for OpenCV service

### Medium Priority (Address within 1-2 months)
6. Split large route file
7. Frontend component tests
8. Standardize error handling
9. API versioning
10. Request/response logging
11. Database connection pooling
12. WebRTC for video streaming

### Low Priority (Address as time permits)
13. API documentation (Swagger)
14. Performance monitoring
15. Dependency update automation
16. Consolidate detection implementations
17. Health check improvements
18. Request caching

---

## Recommendations by Category

### Security
1. Encrypt RTSP credentials
2. Use Docker secrets
3. Add rate limiting
4. Validate all inputs
5. Implement account lockout
6. Encrypt face embeddings

### Performance
1. Add database indexes
2. Configure connection pooling
3. Implement caching (Redis)
4. Use WebRTC for streaming
5. Optimize frame compression
6. Add code splitting

### Maintainability
1. Enable TypeScript strict mode
2. Split large files
3. Standardize error handling
4. Add API documentation
5. Increase test coverage
6. Consolidate duplicate code

### Scalability
1. Move state to Redis
2. Configure session affinity
3. Optimize resource limits
4. Document scaling strategy
5. Add load balancing

---

## Mitigation Strategies

### Short-term (1-2 weeks)
- Add rate limiting to critical endpoints
- Enable TypeScript strict mode for new code
- Add input validation to high-risk endpoints
- Document critical APIs

### Medium-term (1-2 months)
- Refactor large route files
- Increase test coverage to 80%
- Implement proper error handling
- Add caching layer

### Long-term (3-6 months)
- Migrate to WebRTC for streaming
- Enable full TypeScript strict mode
- Implement comprehensive logging
- Add E2E tests

---

## Tracking

**Last Updated:** March 23, 2026
**Next Review:** May 23, 2026

**Action Items:**
1. Prioritize concerns by business impact
2. Assign owners to each concern
3. Create tasks for high-priority items
4. Schedule regular technical debt sprints
5. Review and update this document quarterly
