# Multi-stage build for SentryVision Frontend
# Optimized for production with security and performance in mind

# ===========================================
# Base Stage - Common dependencies
# ===========================================
FROM node:20-alpine AS base
# Install security updates
RUN apk update && apk upgrade && apk add --no-cache libc6-compat && \
    rm -rf /var/cache/apk/*
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
COPY --chown=node:node . .
# Set build environment variables
ENV NODE_ENV=production
ENV VITE_API_URL=http://localhost:9753
ENV VITE_WS_URL=ws://localhost:9753
# Build the React application
RUN npm run build && \
    # Remove source maps from production build
    rm -rf dist/**/*.map && \
    # Remove source files to keep image size small
    rm -rf src && \
    # Clean up npm cache
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
# Production Stage with Nginx
# ===========================================
FROM nginx:1.25-alpine AS production
# Install security updates and required packages
RUN apk update && apk upgrade && \
    apk add --no-cache \
    curl \
    dumb-init \
    tini \
    && rm -rf /var/cache/apk/*

# Remove default nginx website
RUN rm -rf /usr/share/nginx/html/*

# Create nginx user directory with proper permissions
RUN mkdir -p /var/cache/nginx /var/log/nginx /var/run /etc/nginx/conf.d && \
    chown -R nginx:nginx /var/cache/nginx /var/log/nginx /var/run /etc/nginx/conf.d

# Copy built assets from builder stage with proper ownership
COPY --from=builder --chown=nginx:nginx /app/dist /usr/share/nginx/html

# Set proper permissions for nginx html directory
RUN chown -R nginx:nginx /usr/share/nginx/html && \
    chmod -R 755 /usr/share/nginx/html

# Copy custom nginx configuration
COPY --chown=nginx:nginx nginx.conf /etc/nginx/conf.d/default.conf.template

# Create optimized nginx configuration
RUN echo 'worker_processes auto;' > /etc/nginx/nginx.conf && \
    echo 'error_log /dev/stderr warn;' >> /etc/nginx/nginx.conf && \
    echo 'pid /tmp/nginx.pid;' >> /etc/nginx/nginx.conf && \
    echo 'events {' >> /etc/nginx/nginx.conf && \
    echo '    worker_connections 1024;' >> /etc/nginx/nginx.conf && \
    echo '    use epoll;' >> /etc/nginx/nginx.conf && \
    echo '    multi_accept on;' >> /etc/nginx/nginx.conf && \
    echo '}' >> /etc/nginx/nginx.conf && \
    echo 'http {' >> /etc/nginx/nginx.conf && \
    echo '    include /etc/nginx/mime.types;' >> /etc/nginx/nginx.conf && \
    echo '    default_type application/octet-stream;' >> /etc/nginx/nginx.conf && \
    echo '    sendfile on;' >> /etc/nginx/nginx.conf && \
    echo '    tcp_nopush on;' >> /etc/nginx/nginx.conf && \
    echo '    tcp_nodelay on;' >> /etc/nginx/nginx.conf && \
    echo '    keepalive_timeout 65;' >> /etc/nginx/nginx.conf && \
    echo '    types_hash_max_size 2048;' >> /etc/nginx/nginx.conf && \
    echo '    server_tokens off;' >> /etc/nginx/nginx.conf && \
    echo '    add_header X-Frame-Options "SAMEORIGIN" always;' >> /etc/nginx/nginx.conf && \
    echo '    add_header X-XSS-Protection "1; mode=block" always;' >> /etc/nginx/nginx.conf && \
    echo '    add_header X-Content-Type-Options "nosniff" always;' >> /etc/nginx/nginx.conf && \
    echo '    add_header Referrer-Policy "no-referrer-when-downgrade" always;' >> /etc/nginx/nginx.conf && \
    echo '    add_header Content-Security-Policy "default-src '\''self'\'' http: https: data: blob: '\''unsafe-inline'\''" always;' >> /etc/nginx/nginx.conf && \
    echo '    gzip on;' >> /etc/nginx/nginx.conf && \
    echo '    gzip_vary on;' >> /etc/nginx/nginx.conf && \
    echo '    gzip_min_length 1024;' >> /etc/nginx/nginx.conf && \
    echo '    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;' >> /etc/nginx/nginx.conf && \
    echo '    include /etc/nginx/conf.d/*.conf;' >> /etc/nginx/nginx.conf && \
    echo '}' >> /etc/nginx/nginx.conf

# Don't create separate health.conf - it will be in default.conf

# Set environment variables
ENV NODE_ENV=production
ENV NGINX_PORT=80
ENV API_URL=http://localhost:9753
ENV WS_URL=ws://localhost:9753

# Create startup script for environment variable substitution
RUN echo '#!/bin/sh' > /docker-entrypoint.sh && \
    echo 'set -e' >> /docker-entrypoint.sh && \
    echo 'echo "Starting SentryVision Frontend..."' >> /docker-entrypoint.sh && \
    echo 'echo "Environment: $NODE_ENV"' >> /docker-entrypoint.sh && \
    echo 'echo "Nginx Port: $NGINX_PORT"' >> /docker-entrypoint.sh && \
    echo 'echo "API URL: $API_URL"' >> /docker-entrypoint.sh && \
    echo 'echo "WS URL: $WS_URL"' >> /docker-entrypoint.sh && \
    echo '' >> /docker-entrypoint.sh && \
    echo '# Substitute environment variables in nginx config' >> /docker-entrypoint.sh && \
    echo 'envsubst "\$NGINX_PORT" < /etc/nginx/conf.d/default.conf.template > /etc/nginx/conf.d/default.conf' >> /docker-entrypoint.sh && \
    echo '' >> /docker-entrypoint.sh && \
    echo '# Create API configuration file for frontend' >> /docker-entrypoint.sh && \
    echo 'echo "window.SENTRYVISION_CONFIG = {" > /usr/share/nginx/html/config.js' >> /docker-entrypoint.sh && \
    echo 'echo "  API_URL: \"'$API_URL'\"," >> /usr/share/nginx/html/config.js' >> /docker-entrypoint.sh && \
    echo 'echo "  WS_URL: \"'$WS_URL'\"," >> /usr/share/nginx/html/config.js' >> /docker-entrypoint.sh && \
    echo 'echo "  NODE_ENV: \"'$NODE_ENV'\"" >> /usr/share/nginx/html/config.js' >> /docker-entrypoint.sh && \
    echo 'echo "};" >> /usr/share/nginx/html/config.js' >> /docker-entrypoint.sh && \
    echo '' >> /docker-entrypoint.sh && \
    echo '# Start nginx with dumb-init' >> /docker-entrypoint.sh && \
    echo 'exec dumb-init nginx -g "daemon off;"' >> /docker-entrypoint.sh && \
    chmod +x /docker-entrypoint.sh

# Switch to nginx user for security
USER nginx

# Expose port
EXPOSE ${NGINX_PORT}

# Health check with wget (smaller than curl)
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:${NGINX_PORT}/health || exit 1

# Use tini as PID 1 for proper signal handling
ENTRYPOINT ["tini", "--"]

# Start nginx
CMD ["/docker-entrypoint.sh"]