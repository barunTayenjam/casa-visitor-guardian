# Multi-stage build for SentryVision Backend
# Optimized for production with security and performance in mind

# ===========================================
# Base Stage - Common dependencies
# ===========================================
FROM node:20-alpine AS base
RUN apk add --no-cache \
    ffmpeg \
    ffmpeg-dev \
    python3 \
    make \
    g++ \
    git
WORKDIR /app

# ===========================================
# Dependencies Stage
# ===========================================
FROM base AS deps
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# ===========================================
# Builder Stage
# ===========================================
FROM base AS builder
COPY package*.json ./
RUN npm ci
COPY src/ ./src/
COPY tsconfig.json ./
COPY models/ ./models/
RUN npm run build

# ===========================================
# Production Stage
# ===========================================
FROM node:20-alpine AS production

# Install runtime dependencies only
RUN apk add --no-cache \
    ffmpeg \
    curl \
    dumb-init \
    && rm -rf /var/cache/apk/*

# Create app user with proper UID/GID
RUN addgroup -g 1001 -S sentryvision && \
    adduser -S sentryvision -u 1001 -G sentryvision

# Set working directory
WORKDIR /app

# Copy package files and install production dependencies
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# Copy built application from builder stage
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/models ./models

# Create necessary directories with proper permissions
RUN mkdir -p \
    public/snapshots \
    public/events \
    logs \
    uploads \
    temp && \
    chown -R sentryvision:sentryvision /app

# Switch to non-root user
USER sentryvision

# Expose port
EXPOSE 9753

# Set environment variables
ENV NODE_ENV=production
ENV PORT=9753

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:9753/api/health || exit 1

# Use dumb-init as PID 1
ENTRYPOINT ["dumb-init", "--"]

# Start the application
CMD ["node", "dist/index.js"]