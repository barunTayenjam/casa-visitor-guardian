# SentryVision Database Setup

This directory contains the PostgreSQL database schema and migration scripts for SentryVision.

## Prerequisites

- PostgreSQL 12+ installed and running
- Node.js 18+ installed

## Environment Variables

Set the following environment variables before running migrations:

```bash
export DB_HOST=localhost
export DB_PORT=5432
export DB_NAME=sentryvision
export DB_USER=postgres
export DB_PASSWORD=your_password
```

## Installation

1. Install dependencies:
```bash
npm install
```

2. Create the database:
```sql
CREATE DATABASE sentryvision;
```

3. Run migrations:
```bash
npm run migrate
```

## Database Schema

The migration creates the following tables:

### Users Table
- Comprehensive user management with roles, MFA support
- Account status tracking (active, inactive, suspended, locked)
- Password reset and email verification functionality
- Failed login attempt tracking with automatic lockout

### Roles Table
- Hierarchical permission system using JSONB
- System and custom role support
- Audit trail for role changes

### Sessions Table
- JWT token management with refresh tokens
- Device and IP tracking
- Session expiration and cleanup
- Concurrent session limits

### Audit Logs Table
- Comprehensive audit trail with structured data
- Change tracking with old/new values
- Severity levels and metadata support
- Digital signatures for integrity verification

### Password History Table
- Prevents password reuse
- Configurable history retention
- Automatic cleanup of old entries

## Features

- **Security**: Password hashing with bcrypt, MFA support, account lockout
- **Audit**: Complete audit trail with tamper detection
- **Performance**: Optimized indexes for common queries
- **Compliance**: Data retention policies and privacy controls
- **Scalability**: Connection pooling and query optimization

## Migration Management

The migration system includes:
- Automatic checksum verification
- Rollback support
- Batch processing
- Error handling and retry logic
- Detailed logging

## Security Considerations

- All passwords are hashed with bcrypt (14 rounds)
- MFA secrets are encrypted
- Audit logs are digitally signed
- Sensitive data is excluded from logs
- Connection encryption supported