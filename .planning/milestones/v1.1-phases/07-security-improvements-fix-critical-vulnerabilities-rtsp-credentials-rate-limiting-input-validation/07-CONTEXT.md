# Phase 7: Security improvements - Context

**Gathered:** 2026-03-23
**Status:** Ready for planning

## Phase Boundary

Implement critical security fixes for the SentryVision home security system: encrypt RTSP camera credentials at rest, add rate limiting to prevent abuse of detection endpoints, and validate all API inputs to prevent injection attacks. This is a security hardening phase focused on production vulnerabilities identified in codebase analysis.

## Implementation Decisions

### Credential Migration Strategy

**Migration Approach:** Big bang migration
- Encrypt all RTSP camera credentials at once in a single operation
- Update credential storage format from plaintext to encrypted
- Require system restart after migration
- Accept upfront risk: if something breaks, both cameras are down until fixed
- Rationale: User has full-time capacity and wants security fix completed quickly

**Backward Compatibility:** Encrypted with fallback
- Support both plaintext and encrypted credential formats during migration
- Try encrypted format first, fall back to plaintext if decryption fails
- Log warnings when plaintext credentials are detected (but don't block)
- Allows testing and verification before committing to encrypted-only
- Gradual transition: eventually disable plaintext support after validation period

**Key Storage:** Environment variable
- Store master encryption key in `CREDENTIAL_ENCRYPTION_KEY` environment variable
- Simple approach that works with Docker secrets and existing env system
- No additional config files to manage
- Key never committed to git
- Alternative considered: Docker secrets (more secure but adds deployment complexity)

**Failure Handling:** Fall back to plaintext
- If credential decryption fails for a camera, attempt to use plaintext credentials
- Log error but continue with camera stream
- Maintain system uptime even with corrupt encrypted data
- User prioritizes availability over strict security during migration
- This is a temporary fallback; plan to remove once encryption is validated

### Rate Limiting Scope

**Protected Endpoints:** Critical endpoints only
- Apply rate limiting only to expensive/abusable endpoints
- Target endpoints: `/api/detection/*`, `/api/batch/*`, face recognition endpoints
- Exclude: health checks, static assets, public event listings
- Minimize overhead while protecting critical paths
- Rationale: Detection operations are CPU-intensive (OpenCV processing) and most vulnerable to abuse

**Rate Limit Strategy:** User-based limits only
- Rate limit based on JWT user identity (from authentication middleware)
- No IP-based rate limiting
- Limits apply per authenticated user, not per connection
- Assumes all critical endpoints already require authentication
- Simpler implementation, no need to track IP addresses
- Consideration: Unauthenticated endpoints remain unprotected (acceptable trade-off)

**Thresholds:** Tiered limits (to be configured)
- Standard endpoints: 100 requests per 15 minutes
- Detection endpoints: 10 requests per minute
- Batch operations: 5 requests per hour
- User can adjust these via configuration after deployment
- Reasonable balance between security and usability
- Exact values configurable via environment variables

**Storage Backend:** Database
- Store rate limit counters in PostgreSQL database
- Use existing TypeORM connection and models
- Create `rate_limit_counters` table with user_id, endpoint, count, window_start
- Persistent across restarts (unlike in-memory)
- Slower than Redis but uses existing infrastructure
- Alternative considered: Redis (faster but adds service dependency)

**Enforcement:** 429 response
- Return HTTP 429 (Too Many Requests) when limit exceeded
- Include `Retry-After` header with seconds until reset
- Standard, client-friendly response
- Allows clients to implement automatic retry logic
- Include JSON error body with details: `{ "error": "Rate limit exceeded", "retryAfter": 60 }`
- Follow HTTP specification for rate limiting

## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Security Vulnerabilities
- `.planning/codebase/CONCERNS.md` — Complete list of 20 documented security and technical debt issues
  - Critical: RTSP credentials exposed in `server/cameras.json` (lines 16-38)
  - High: No input validation on some endpoints (lines 78-100)
  - High: No rate limiting on detection endpoints (lines 182-197)
  - High: Sensitive data in environment variables not protected (lines 231-244)

### Technology Stack
- `.planning/codebase/STACK.md` — Technology stack and dependencies
  - Express rate-limit: Already installed (v8.2.1)
  - PostgreSQL: Available for rate limit counter storage
  - Zod: Available for input validation schemas

### Code Structure
- `.planning/codebase/STRUCTURE.md` — Directory layout and code organization
  - Route locations: `server/src/routes/` (main, detection, batch)
  - Middleware location: `server/src/middleware/` (auth, rateLimit, validation)
  - Configuration: `server/src/config/index.ts` (cameras.json loader)

### Code Conventions
- `.planning/codebase/CONVENTIONS.md` — Code style and patterns
  - Service layer pattern in `server/src/services/`
  - TypeORM models with decorators
  - Middleware chain for route handlers

### Testing Requirements
- `.planning/codebase/TESTING.md` — Test structure and coverage requirements
  - Backend testing: Jest + Supertest
  - 80% coverage threshold
  - Integration tests for rate limiting

### Project Context
- `.planning/PROJECT.md` — SentryVision system overview
- `.planning/REQUIREMENTS.md` — v1 and v2 requirements
- `.planning/STATE.md` — Project status and phase progress

## Existing Code Insights

### Reusable Assets
- **Express rate-limit middleware (8.2.1):** Already installed, can be configured for user-based limiting
- **PostgreSQL connection:** TypeORM already configured, can add `rate_limit_counters` table
- **JWT authentication:** Existing `authMiddleware` can provide user identity for rate limiting
- **Zod validation (v3.25.76):** Available for input validation schemas
- **Service layer pattern:** `server/src/services/` has established patterns for new security services
- **Logger utility:** `server/src/utils/logger.js` can be used for security audit logging
- **Error handling:** Existing error middleware can be extended for security errors

### Established Patterns
- **Middleware chain:** Routes use `router.use(middleware)` pattern — security middleware fits naturally
- **TypeORM models:** Entities use UUID primary keys, `@Column()` decorators — apply to `RateLimitCounter` model
- **Environment variables:** System already uses `.env` files for configuration — add `CREDENTIAL_ENCRYPTION_KEY`
- **Database migrations:** SQL migrations in `database/migrations/` follow naming convention — create migration for rate limit table
- **Route organization:** API routes in `server/src/routes/` follow REST conventions — security routes fit existing structure

### Integration Points
- **Camera configuration:** `server/src/config/index.ts` loads `server/cameras.json` — integrate credential encryption here
- **Detection routes:** `server/src/routes/detectionRoutes.ts` — add rate limiting middleware to these endpoints
- **Batch routes:** `server/src/routes/batchDetection.ts` — add rate limiting middleware
- **Main routes:** `server/src/routes/index.ts` (16,000+ lines) — apply input validation schemas
- **Database:** Create new TypeORM model `RateLimitCounter` and migration for table creation
- **Authentication:** Use existing JWT from `req.user` in rate limiting middleware
- **API gateway:** Register new security middleware in route setup

### Security Considerations
- **Credential encryption:** Use AES-256-GCM for authenticated encryption
- **Key derivation:** Derive encryption key from `CREDENTIAL_ENCRYPTION_KEY` using PBKDF2
- **Rate limit precision:** Use sliding window or token bucket for accurate rate limiting
- **Input validation:** Create Zod schemas for all request bodies and query parameters
- **Error messages:** Don't leak internal system information in error responses
- **Audit logging:** Log all security events (rate limit hits, validation failures, decryption errors)

## Specific Ideas

- **Credential migration script:** Create one-time migration script that encrypts all RTSP credentials in `server/cameras.json` and updates format
- **Format change:** Store encrypted credentials as `{"encrypted": "base64-ciphertext", "iv": "base64-iv", "tag": "base64-auth-tag"}` instead of plaintext URL
- **Runtime decryption:** Decrypt credentials in `server/src/config/index.ts` when loading camera configuration, before passing to FFmpeg
- **Rollback plan:** Keep backup of original `cameras.json` before migration; can revert by restoring backup if needed
- **Rate limit cleanup:** Job to delete expired rate limit counter records (older than 1 hour)
- **Validation schemas:** Create shared Zod schemas file `server/src/schemas/validationSchemas.ts` for reuse across routes
- **Security headers:** Enhance Helmet.js configuration to add additional security headers
- **Audit log table:** Create `security_events` table to track rate limit violations, validation failures, and decryption errors
- **Monitoring:** Add metrics for rate limit hits per user, endpoint (use existing logging for now)

## Deferred Ideas

- **API versioning:** Add `/api/v1/` prefix to endpoints — belongs in separate API evolution phase
- **Rate limiting for all endpoints:** Protect all API endpoints, not just critical ones — future enhancement
- **IP-based rate limiting:** Add IP-based limits for unauthenticated endpoints — additional security layer
- **Distributed rate limiting:** Use Redis for rate limit counters — performance improvement for multi-instance deployments
- **Captcha integration:** Add CAPTCHA for suspicious request patterns — bot protection
- **Web application firewall:** Integrate WAF for additional protection — advanced security feature
- **Security audit logging:** Comprehensive audit logging for all security events — separate security monitoring phase
- **Penetration testing:** Security audit and penetration testing — validation phase after fixes
- **TypeScript strict mode:** Enable strict mode for better type safety — separate code quality phase
- **Input sanitization:** Add content security policy headers, XSS protection — frontend security phase

---

*Phase: 07-security-improvements-fix-critical-vulnerabilities-rtsp-credentials-rate-limiting-input-validation*
*Context gathered: 2026-03-23*
