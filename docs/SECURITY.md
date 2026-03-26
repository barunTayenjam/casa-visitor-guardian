# Security Documentation

## Overview

SentryVision implements multiple layers of security to protect your home security system. This document describes the security features, configuration, and best practices.

## Table of Contents

1. [RTSP Credential Encryption](#rtsp-credential-encryption)
2. [Rate Limiting](#rate-limiting)
3. [Input Validation](#input-validation)
4. [Authentication & Authorization](#authentication--authorization)
5. [Audit Logging](#audit-logging)
6. [Security Best Practices](#security-best-practices)
7. [Troubleshooting](#troubleshooting)

---

## RTSP Credential Encryption

### Overview

All RTSP camera credentials stored in `server/cameras.json` are encrypted at rest using AES-256-GCM (Galois/Counter Mode), providing authenticated encryption with additional data.

### Encryption Details

- **Algorithm**: AES-256-GCM
- **Key Derivation**: PBKDF2 with 100,000 iterations
- **Key Source**: `CREDENTIAL_ENCRYPTION_KEY` environment variable
- **Encrypted Format**: JSON object with `encrypted`, `iv`, `tag`, and `version` fields

### Configuration

Generate a secure encryption key:

```bash
# Generate 32-byte random key (base64 encoded)
openssl rand -base64 32
```

Set the environment variable:

```bash
export CREDENTIAL_ENCRYPTION_KEY="your-generated-key-here"
```

Add to `server/.env`:
```
CREDENTIAL_ENCRYPTION_KEY=your-generated-key-here
```

### Credential Migration

When you first enable credential encryption, migrate your existing plaintext credentials:

```bash
cd server
npm run build

# Test migration (dry-run)
node dist/scripts/migrateCredentials.js --dry-run

# Run actual migration (creates backup)
node dist/scripts/migrateCredentials.js
```

The migration script:
- Creates a backup at `server/cameras.json.backup`
- Encrypts all RTSP URLs in the configuration
- Logs results to console and `security_events` table
- Supports dry-run mode for testing

### Runtime Decryption

Credentials are automatically decrypted at runtime when:
- System starts
- Camera streams are accessed
- RTSP connections are established

If decryption fails:
- Error is logged to `security_events` table as `CREDENTIAL_DECRYPTION_FAILED`
- Fallback to plaintext with warning (for backward compatibility)
- Stream fails to start

### Security Events

The following security events are logged:
- `CREDENTIAL_DECRYPTION_FAILED`: Decryption error occurred
- `PLAINTEXT_CREDENTIALS_DETECTED`: Unencrypted credentials found

### Troubleshooting

**Issue**: Camera streams fail to start after migration
- Check `CREDENTIAL_ENCRYPTION_KEY` is set correctly
- Verify key length (minimum 32 characters)
- Check logs for `CREDENTIAL_DECRYPTION_FAILED` events
- Restore from backup if needed: `cp server/cameras.json.backup server/cameras.json`

**Issue**: Migration fails
- Verify `CREDENTIAL_ENCRYPTION_KEY` is set
- Check file permissions on `server/cameras.json`
- Ensure database is accessible
- Review logs in `server/logs/` directory

---

## Rate Limiting

### Overview

PostgreSQL-backed rate limiting prevents abuse of API endpoints by tracking request counts per user.

### Rate Limit Tiers

| Tier | Requests | Window | Endpoints |
|------|----------|--------|-----------|
| STANDARD | 100 | 15 minutes | Most API endpoints |
| DETECTION | 10 | 1 minute | Detection endpoints |
| BATCH | 5 | 1 hour | Batch processing |

### Configuration

Override default rate limits via environment variables:

```bash
# Standard tier (default: 100 requests / 15 minutes)
RATE_LIMIT_STANDARD_REQUESTS=100
RATE_LIMIT_STANDARD_WINDOW=900000

# Detection tier (default: 10 requests / 1 minute)
RATE_LIMIT_DETECTION_REQUESTS=10
RATE_LIMIT_DETECTION_WINDOW=60000

# Batch tier (default: 5 requests / 1 hour)
RATE_LIMIT_BATCH_REQUESTS=5
RATE_LIMIT_BATCH_WINDOW=3600000
```

### Response Headers

Rate limit responses include:
- `X-RateLimit-Limit`: Maximum requests allowed
- `X-RateLimit-Remaining`: Requests remaining in current window
- `Retry-After`: Seconds until rate limit resets (when 429 returned)

### Rate Limit Exceeded

When rate limit is exceeded:
- HTTP 429 (Too Many Requests) response
- `Retry-After` header indicates wait time
- Event logged to `security_events` table
- User must wait before retrying

### Excluded Endpoints

The following endpoints are NOT rate limited:
- `/api/health` - Health checks
- `/api/status` - Status checks
- `/api/healthcheck` - Health checks

### Cleanup

Expired rate limit records are automatically cleaned up:
- Cleanup runs every hour
- Removes records older than 1 hour
- Logs cleanup statistics

### Troubleshooting

**Issue**: Legitimate requests are rate limited
- Check rate limit tier configuration
- Increase limits if necessary for your use case
- Monitor `security_events` table for violations

**Issue**: Rate limit database grows too large
- Verify cleanup job is running: Check logs for "Rate limit cleanup complete"
- Manually trigger cleanup via service if needed
- Adjust cleanup frequency in `rateLimitCleanup.ts`

---

## Input Validation

### Overview

All API endpoints use Zod schemas to validate request inputs, preventing injection attacks and ensuring data integrity.

### Validation Layers

1. **Schema Definition**: Zod schemas define valid input types and constraints
2. **Runtime Validation**: Middleware validates requests before processing
3. **Security Logging**: Validation failures logged to `security_events` table

### Validated Inputs

- **Request Bodies**: JSON payloads
- **Query Parameters**: URL query strings
- **Route Parameters**: URL path parameters

### Common Validations

- UUID validation for IDs
- Pagination limits (max 100 items per page)
- Date/time strings (ISO 8601 format)
- String lengths and patterns
- Numeric ranges
- Enum values

### Example Schemas

```typescript
// Event list query parameters
eventListQuerySchema = paginationSchema.extend({
  eventType: z.enum(['motion', 'object', 'face']).optional(),
  cameraId: z.enum(['cam1', 'cam2']).optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional()
})

// UUID validation
uuidSchema = z.string().uuid()
```

### Security Benefits

- **SQL Injection Prevention**: Strict type checking and parameterized queries
- **XSS Prevention**: Input sanitization and encoding
- **Path Traversal Prevention**: UUID validation for file access
- **DoS Prevention**: Input size limits and validation costs

### Validation Error Response

When validation fails:
```json
{
  "error": "Validation failed",
  "message": "Invalid input data",
  "details": [
    {
      "field": "query.cameraId",
      "message": "Invalid enum value. Expected 'cam1' | 'cam2'",
      "code": "invalid_enum_value"
    }
  ]
}
```

### Troubleshooting

**Issue**: Valid requests are rejected with validation error
- Check input matches schema exactly
- Verify required fields are present
- Check data types (string vs number)
- Review enum values for valid options

---

## Authentication & Authorization

### JWT Tokens

- **Access Token**: 15 minute expiration
- **Refresh Token**: 7 day expiration
- **Algorithm**: RS256 (asymmetric)

### Multi-Factor Authentication (MFA)

- TOTP-based (Google Authenticator compatible)
- Setup via `/api/auth/mfa/setup`
- Verification via `/api/auth/mfa/verify`
- Required for admin users

### Password Security

- Minimum 12 characters
- BCrypt hashing (12 rounds)
- Password history tracking
- Complexity requirements enforced

### Roles & Permissions

| Role | Permissions |
|------|-------------|
| admin | Full access including user management |
| user | Standard access, no user management |
| viewer | Read-only access |

---

## Audit Logging

### Security Events Table

All security-related events are logged to the `security_events` table:

| Column | Description |
|--------|-------------|
| id | UUID primary key |
| timestamp | Event timestamp |
| event_type | Type of security event |
| user_id | Associated user (optional) |
| ip_address | Client IP address |
| details | Additional event data (JSONB) |

### Event Types

- `CREDENTIAL_DECRYPTION_FAILED`: Decryption error
- `PLAINTEXT_CREDENTIALS_DETECTED`: Unencrypted credentials
- `RATE_LIMIT_EXCEEDED`: Rate limit violation
- `VALIDATION_FAILED`: Input validation failure
- `UNAUTHORIZED_ACCESS_ATTEMPT`: Authentication failure
- `SUSPICIOUS_ACTIVITY`: Anomalous behavior

### Querying Security Events

```sql
-- Recent credential events
SELECT * FROM security_events
WHERE event_type IN ('CREDENTIAL_DECRYPTION_FAILED', 'PLAINTEXT_CREDENTIALS_DETECTED')
ORDER BY timestamp DESC
LIMIT 100;

-- Rate limit violations by user
SELECT user_id, COUNT(*) as violations
FROM security_events
WHERE event_type = 'RATE_LIMIT_EXCEEDED'
GROUP BY user_id
ORDER BY violations DESC;
```

---

## Security Best Practices

### Production Deployment

1. **Use Strong Secrets**
   - Generate cryptographically random keys
   - Use unique secrets per environment
   - Rotate keys periodically (90 days recommended)

2. **Enable HTTPS**
   - Use valid SSL/TLS certificates
   - Redirect HTTP to HTTPS
   - Configure HSTS headers

3. **Database Security**
   - Use strong database passwords
   - Restrict database network access
   - Enable SSL for database connections

4. **Environment Variables**
   - Never commit secrets to version control
   - Use `.env` files (in `.gitignore`)
   - Use Docker secrets or vault systems

5. **Network Security**
   - Use firewall rules to restrict access
   - Deploy behind reverse proxy (nginx)
   - Enable DDoS protection

### Operational Security

1. **Regular Updates**
   - Keep dependencies updated
   - Apply security patches promptly
   - Monitor security advisories

2. **Monitoring**
   - Monitor `security_events` table regularly
   - Set up alerts for suspicious activity
   - Review audit logs weekly

3. **Backup & Recovery**
   - Regular database backups
   - Test restoration procedures
   - Store backups securely (encrypted)

4. **Access Control**
   - Use principle of least privilege
   - Regularly review user permissions
   - Disable unused accounts

---

## Troubleshooting

### Common Issues

**Issue**: "Encryption key validation failed"
- Verify `CREDENTIAL_ENCRYPTION_KEY` is set
- Check key length (minimum 32 characters)
- Regenerate key if corrupted

**Issue**: "Rate limit exceeded"
- Check current request count in database
- Wait for window to expire (check Retry-After header)
- Increase limits if needed for your use case

**Issue**: "Validation failed"
- Review validation error details
- Check input matches expected schema
- Verify required fields are present

**Issue**: Security events not being logged
- Verify database connection
- Check `security_events` table exists
- Review database permissions

### Getting Help

- Check logs: `server/logs/` directory
- Review security events: `security_events` table
- Enable debug logging if needed
- Report security issues privately

---

## Additional Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [CWE Top 25](https://cwe.mitre.org/top25/)
- [Security Best Practices](https://cheatsheetseries.owasp.org/cheatsheets/Nodejs_Security_Cheat_Sheet.html)

---

*Last Updated: 2026-03-26*
*Phase: 07 - Security Improvements*
