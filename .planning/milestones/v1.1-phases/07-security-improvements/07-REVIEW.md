---
status: reviewed
files_reviewed:
  - server/src/middleware/auth.ts
  - server/src/middleware/enhancedRateLimit.ts
  - server/src/middleware/validation.ts
  - server/src/middleware/rateLimit.ts
  - server/src/middleware/security.ts
findings:
  critical: 3
  warning: 12
  info: 7
total: 22
---

# Phase 07 — Security Improvements: Code Review

## Critical

### C-1: Race condition on rate limit counter increment — server/src/middleware/rateLimit.ts:44-46

The rate limit middleware follows a read-then-write pattern without any locking or atomic operation. Between `findOne` (line 32) and `save` (line 46), concurrent requests can read the same `existingCounter.count`, both increment in memory, and both write the same stale value. An attacker can send N simultaneous requests and have them count as 1, effectively bypassing the limit by a factor of N.

**Recommendation**: Use an atomic increment (`increment` in TypeORM / `UPDATE ... SET count = count + 1`) or wrap the check-and-increment in a serializable transaction or advisory lock.

### C-2: Race condition on new counter insertion — server/src/middleware/rateLimit.ts:86-92

Two concurrent requests for the same `(userId, endpoint)` with no existing window can both fail to `findOne`, both reach the `else` branch, and both `create`+`save` a new row. If the table lacks a unique constraint on these columns, duplicate rows accumulate silently; if one exists, the second save throws and the request is handed to the error handler where `next()` is called anyway (line 102), bypassing rate limiting entirely.

**Recommendation**: Use `INSERT ... ON CONFLICT` / `upsert` or acquire a database-level lock before the check.

### C-3: ReDoS vulnerability in XSS detection regex — server/src/middleware/security.ts:134

The regex `/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi` has nested quantifiers with overlapping bounds (the outer `*` around a group containing `*`). A crafted input like `<script<script<...<script` can trigger catastrophic backtracking, blocking the event loop for seconds or longer — a denial-of-service vector.

**Recommendation**: Replace with a simpler bounded match or use a ReDoS-safe parsing approach (e.g., `contains('<script')` + a proper HTML sanitizer). Add a guard against long inputs.

---

## Warning

### W-1: Logged-in username logged on every request — server/src/middleware/auth.ts:65

Every authenticated request logs the username and role at `info` level. In a high-traffic system this produces excessive noise and leaks usernames into persistent logs.

**Recommendation**: Demote to `debug` level, or log only on failed authentication attempts.

### W-2: `console.error` used instead of structured logger — server/src/middleware/enhancedRateLimit.ts:76,139

Two error handlers use `console.error` rather than the project's structured logger. This bypasses log levels, formatting, and any transport configuration.

**Recommendation**: Replace with `logger.error`.

### W-3: `skipSuccessfulRequests` / `skipFailedRequests` fields declared but never used — server/src/middleware/enhancedRateLimit.ts:22-23

The constructor stores these booleans but the `middleware()` method never reads them. The feature is dead code.

**Recommendation**: Implement the skip logic or remove the options.

### W-4: No recursion for nested body sanitization — server/src/middleware/validation.ts:509-515

`sanitizeInput` only iterates the top-level keys of `req.body`. Any nested objects or arrays have string fields left unsanitized, allowing stored XSS payloads to survive.

**Recommendation**: Use a recursive sanitizer or a library like `sanitize-html` / `DOMPurify`.

### W-5: Sanitization regex easily bypassed — server/src/middleware/validation.ts:494-498

The `sanitizeString` function uses a case-insensitive but pattern-fragile regex. Payloads like `<img src=x onerror=alert(1)>` are partially stripped (event handlers removed) but variations with HTML entities, nested tags, or `data:` URIs can slip through.

**Recommendation**: Use a well-audited sanitization library. Do not rely on regex for XSS prevention.

### W-6: No rate-limit key isolation for unauthenticated users — server/src/middleware/rateLimit.ts:19,34

`userId` is `null` for unauthenticated requests, so ALL unauthenticated traffic to the same endpoint shares a single counter. The IP address is not part of the key. One IP can exhaust the shared limit for all other unauthenticated users, or an attacker can spoof many IPs to inflate the count.

**Recommendation**: For unauthenticated requests, key on `(ip, endpoint)` instead of `(null, endpoint)`.

### W-7: Per-request database write on every API call — server/src/middleware/rateLimit.ts:46 and 83 and 92

Every API request writes to the `RateLimitCounter` table (increment or insert). At high throughput this creates significant database load and contention on the counter rows.

**Recommendation**: Batch writes, use Redis-based counters (e.g., `INCR` + `EXPIRE`), or at least use `UPDATE ... count = count + 1` instead of read-then-write.

### W-8: In-memory rate limiter does not scale across processes — server/src/middleware/security.ts:89

`createApiRateLimit` stores state in a local `Map`. Under clustering (Node.js `cluster`) or multi-instance deployments, each process has an independent counter, allowing N× the intended request limit.

**Recommendation**: Use the database- or Redis-backed rate limiter from `rateLimit.ts` or `enhancedRateLimit.ts` instead.

### W-9: Weak CSP includes `'unsafe-inline'` and `'unsafe-eval'` — server/src/middleware/security.ts:56

The Content-Security-Policy header allows `'unsafe-inline'` for scripts and styles and `'unsafe-eval'` for scripts. This neutralises CSP as an XSS mitigation.

**Recommendation**: Use nonces or hashes for inline scripts. Remove `'unsafe-eval'` unless absolutely required.

### W-10: API key validation leaks valid key count via linear scan — server/src/middleware/security.ts:186

`validApiKeys.includes(apiKey)` performs a linear comparison. While timing is noisy on a network, a local attacker could distinguish "key found early" vs. "key found late" vs. "not found" to enumerate valid keys.

**Recommendation**: Use a constant-time comparison or a `Set` (hash-based lookup, O(1), though still not constant-time). For a small number of keys the practical risk is low.

### W-11: SQL injection pattern block too narrow — server/src/middleware/security.ts:137-140

The suspicious-pattern detector only checks `union select`, `drop table`, `insert into`, `delete from`. Many SQLi variants (time-based blind, error-based, stacked queries, `INTO OUTFILE`, `INFORMATION_SCHEMA`, etc.) will pass through unblocked.

**Recommendation**: Remove SQLi pattern matching entirely and rely on parameterised queries (which the codebase already uses via TypeORM). The regex block provides a false sense of security.

### W-12: No CSRF protection — server/src/middleware/security.ts (entire file)

The security middleware does not implement any CSRF token validation or origin/referer checking. While JWT-in-header auth mitigates this for API calls, any cookie-based session fallback would be vulnerable.

**Recommendation**: Add a `SameSite=Strict` cookie policy on session cookies and/or validate `Origin` / `Referer` headers on state-changing requests.

---

## Info

### I-1: `res.removeHeader('X-Powered-By')` may be ineffective — server/src/middleware/security.ts:30

Express sets `X-Powered-By` in `res.send()` after middleware runs. `removeHeader` in middleware may be overridden by the framework later. The canonical approach is `app.disable('x-powered-by')`.

**Recommendation**: Use `app.disable('x-powered-by')` in the application entry point instead.

### I-2: `X-XSS-Protection` header is deprecated — server/src/middleware/security.ts:35

The `X-XSS-Protection: 1; mode=block` header is deprecated and removed from modern Chromium-based browsers. It can actually introduce XSS vulnerabilities in some edge cases.

**Recommendation**: Remove this header entirely.

### I-3: Number type validation is coercive — server/src/middleware/validation.ts:150

The `validateType('number')` check passes for string values that can be coerced to finite numbers (e.g., `"123"` passes as a valid number). Downstream code expecting `typeof === 'number'` may break.

**Recommendation**: Use `typeof value === 'number'` for strict type checking, and only coerce after validation passes.

### I-4: Email validation regex is simplistic — server/src/middleware/validation.ts:154

The email regex `/^[^\s@]+@[^\s@]+\.[^\s@]+$/` accepts many invalid email addresses (e.g., `a@b.c`). The codebase also has express-validator (which has proper email validation), but the custom schema path uses this weak pattern.

**Recommendation**: Use the express-validator `isEmail()` path for email validation, or adopt a standards-compliant regex.

### I-5: No rate-limit distinction between access and refresh tokens — server/src/middleware/auth.ts:41

`authService.verifyToken(token)` returns a payload regardless of token type. If the same function validates both access and refresh tokens, a compromised refresh token could be re-used as an access token.

**Recommendation**: Confirm that `verifyToken` checks token type, or add an explicit check that the token is an access token.

### I-6: `auth:${req.ip}` key generator may include port — server/src/middleware/enhancedRateLimit.ts:99

Depending on the Express/proxy configuration, `req.ip` may contain an IPv6 address or an IP with port suffix. This can create duplicate keys for the same client.

**Recommendation**: Normalize `req.ip` to ensure only the bare IP address is used.

### I-7: Duplicate rate-limit implementations — server/src/middleware/security.ts:80 vs server/src/middleware/enhancedRateLimit.ts:85

Both files export a `createApiRateLimit` function with identical semantics but different backends (in-memory vs. cache-service). This is confusing and risks one being used where the other was intended.

**Recommendation**: Consolidate into a single Redis-/cache-backed implementation. Remove the in-memory variant.
