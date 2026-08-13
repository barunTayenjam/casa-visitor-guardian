# External Integrations

**Analysis Date:** 2026-08-13

## APIs & External Services

**Detection:**
- NVIDIA API - Model inference (via `NVIDIA_API_KEY`)

**Streaming:**
- RTSP Camera Feeds - Ingested by `go2rtc`

## Data Storage

**Databases:**
- PostgreSQL - Persistence
  - Connection: `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `POSTGRES_PASSWORD`
  - Client: `typeorm`

**Caching:**
- Redis (Optional/configurable via `REDIS_DISABLED`)

## Authentication & Identity

**Auth Provider:**
- Custom (JWT-based)
  - Implementation: `jsonwebtoken` (access/refresh tokens), `bcrypt` (password hashing), `speakeasy` (2FA)

## Monitoring & Observability

**Error Tracking:**
- None detected

**Logs:**
- Local logs (`opencv.log`)

## CI/CD & Deployment

**Hosting:**
- Docker/Docker Compose

**CI Pipeline:**
- None detected

## Environment Configuration

**Required env vars:**
- `POSTGRES_PASSWORD`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `CREDENTIAL_ENCRYPTION_KEY`, `NVIDIA_API_KEY`

**Secrets location:**
- Environment variables (`.env` or Docker Compose)

## Webhooks & Callbacks

**Incoming:**
- RTSP streams

**Outgoing:**
- None detected

---

*Integration audit: 2026-08-13*
