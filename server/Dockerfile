# Multi-stage build for SentryVision Backend
# Optimized for production with security and performance in mind

# ===========================================
# Base Stage - Common dependencies
# ===========================================
FROM node:20-alpine AS base
# Install security updates first
RUN apk update && apk upgrade && \
    apk add --no-cache \
    ffmpeg \
    ffmpeg-dev \
    python3 \
    make \
    g++ \
    git \
    ca-certificates \
    && rm -rf /var/cache/apk/*
# Create app directory with proper permissions
RUN mkdir -p /app && chown -R node:node /app
WORKDIR /app

# ===========================================
# Dependencies Stage
# ===========================================
FROM base AS deps
# Copy package files
COPY --chown=node:node package*.json ./
# Install dependencies with npm ci for reproducible builds
RUN npm ci --only=production && npm cache clean --force && \
    rm -rf ~/.npm

# ===========================================
# Builder Stage
# ===========================================
FROM base AS builder
# Copy package files
COPY --chown=node:node package*.json ./
# Install all dependencies including dev dependencies
RUN npm ci
# Copy source code
COPY --chown=node:node src/ ./src/
COPY --chown=node:node tsconfig.json ./
COPY --chown=node:node models/ ./models/
# Build TypeScript
RUN npm run build && \
    # Remove source maps from production build
    find dist -name "*.map" -type f -delete && \
    # Clean up dev dependencies
    npm cache clean --force

# ===========================================
# Security Scanning Stage
# ===========================================
FROM base AS security
# Install security scanning tools
RUN apk add --no-cache \
    curl \
    wget \
    nmap \
    && rm -rf /var/cache/apk/*
# Placeholder for security scans
RUN echo "Security scanning stage - add vulnerability scanning here"

# ===========================================
# Production Stage
# ===========================================
FROM node:20-alpine AS production
# Install runtime dependencies only and security updates
RUN apk update && apk upgrade && \
    apk add --no-cache \
    ffmpeg \
    curl \
    dumb-init \
    tini \
    ca-certificates \
    su-exec \
    && rm -rf /var/cache/apk/*

# Create app user with proper UID/GID and no shell
RUN addgroup -g 1001 -S sentryvision && \
    adduser -S sentryvision -u 1001 -G sentryvision -s /bin/false

# Set working directory
WORKDIR /app

# Copy package files
COPY --chown=sentryvision:sentryvision package*.json ./
# Install all dependencies including tsx for production TypeScript execution
RUN npm ci && npm cache clean --force && \
    rm -rf ~/.npm

# Copy source files for tsx execution
COPY --chown=sentryvision:sentryvision src/ ./src/
COPY --chown=sentryvision:sentryvision tsconfig.json ./
COPY --chown=sentryvision:sentryvision models/ ./models/

# Create necessary directories with proper permissions
RUN mkdir -p \
    public/snapshots \
    public/events \
    logs \
    logs/audit \
    uploads \
    temp \
    /app/.cache && \
    chown -R sentryvision:sentryvision /app && \
    chmod 750 /app && \
    chmod 750 /app/public && \
    chmod 750 /app/logs && \
    chmod 750 /app/logs/audit && \
    chmod 750 /app/uploads && \
    chmod 750 /app/temp && \
    # Create logs.db file for SQLite logging
    touch /app/logs/logs.db && \
    chown sentryvision:sentryvision /app/logs/logs.db

# Set up proper file descriptors
RUN echo "fs.file-max = 65536" >> /etc/sysctl.conf && \
    mkdir -p /etc/security/limits.d && \
    echo "* soft nofile 65536" >> /etc/security/limits.d/sentryvision.conf && \
    echo "* hard nofile 65536" >> /etc/security/limits.d/sentryvision.conf

# Set environment variables
ENV NODE_ENV=production
ENV PORT=9753
ENV TZ=UTC

# Add health check script before switching user
RUN echo '#!/bin/sh' > /healthcheck.sh && \
    echo 'set -e' >> /healthcheck.sh && \
    echo 'wget --no-verbose --tries=1 --spider http://localhost:9753/health || exit 1' >> /healthcheck.sh && \
    chmod +x /healthcheck.sh

# Switch to non-root user for security
USER sentryvision

# Expose port
EXPOSE 9753

# Health check with wget (smaller than curl)
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD /healthcheck.sh

# Use tini as PID 1 for proper signal handling
ENTRYPOINT ["tini", "--"]

# Start the application with tsx for direct TypeScript execution
CMD ["npx", "tsx", "src/index.ts"]

# ===========================================
# Development Stage
# ===========================================
FROM base AS development
# Install runtime dependencies for development including process management
RUN apk add --no-cache \
    ffmpeg \
    curl \
    dumb-init \
    tini \
    ca-certificates \
    su-exec \
    && rm -rf /var/cache/apk/*

# Install all dependencies including dev dependencies
COPY --chown=node:node package*.json ./
RUN npm ci

# Copy source code
COPY --chown=node:node src/ ./src/
COPY --chown=node:node tsconfig.json ./
COPY --chown=node:node models/ ./models/

# Set development environment variables
ENV NODE_ENV=development
ENV PORT=9753
ENV TZ=UTC

# Create necessary directories with proper permissions
RUN mkdir -p \
    public/snapshots \
    public/events \
    logs \
    logs/audit \
    uploads \
    temp \
    /app/.cache && \
    chown -R node:node /app && \
    chmod 750 /app && \
    chmod 750 /app/public && \
    chmod 750 /app/logs && \
    chmod 750 /app/logs/audit && \
    chmod 750 /app/uploads && \
    chmod 750 /app/temp && \
    # Create logs.db file for SQLite logging
    touch /app/logs/logs.db && \
    chown node:node /app/logs/logs.db

# Switch to node user
USER node

# Expose port
EXPOSE 9753

# Use tini as PID 1 for proper signal handling
ENTRYPOINT ["tini", "--"]

# Start the application in development mode with tsx from node_modules
CMD ["npx", "tsx", "src/index.ts"]