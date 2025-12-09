# Multi-stage build for SentryVision Frontend
# Optimized for production with security and performance in mind

# ===========================================
# Base Stage - Common dependencies
# ===========================================
FROM node:20-alpine AS base
RUN apk add --no-cache libc6-compat
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
COPY . .

# Set build environment variables
ENV NODE_ENV=production
ENV VITE_API_URL=http://localhost:9753
ENV VITE_WS_URL=ws://localhost:9753

# Build the React application
RUN npm run build

# ===========================================
# Production Stage with Nginx
# ===========================================
FROM nginx:1.25-alpine AS production

# Install required packages
RUN apk add --no-cache \
    curl \
    dumb-init

# Create nginx user directory
RUN mkdir -p /var/cache/nginx /var/log/nginx /var/run && \
    chown -R nginx:nginx /var/cache/nginx /var/log/nginx /var/run

# Copy built assets from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy custom nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf.template

# Create health check endpoint
RUN echo 'location /health { access_log off; return 200 "healthy\n"; add_header Content-Type text/plain; }' > /etc/nginx/conf.d/health.conf.template

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
    echo 'envsubst < /etc/nginx/conf.d/health.conf.template > /etc/nginx/conf.d/health.conf' >> /docker-entrypoint.sh && \
    echo '' >> /docker-entrypoint.sh && \
    echo '# Create API configuration file for frontend' >> /docker-entrypoint.sh && \
    echo 'cat > /usr/share/nginx/html/config.js << EOF' >> /docker-entrypoint.sh && \
    echo 'window.SENTRYVISION_CONFIG = {' >> /docker-entrypoint.sh && \
    echo '  API_URL: "'\''$API_URL'\'',' >> /docker-entrypoint.sh && \
    echo '  WS_URL: "'\''$WS_URL'\'',' >> /docker-entrypoint.sh && \
    echo '  NODE_ENV: "'\''$NODE_ENV'\''"' >> /docker-entrypoint.sh && \
    echo '};' >> /docker-entrypoint.sh && \
    echo 'EOF' >> /docker-entrypoint.sh && \
    echo '' >> /docker-entrypoint.sh && \
    echo 'echo "Generated nginx configuration:"' >> /docker-entrypoint.sh && \
    echo 'cat /etc/nginx/conf.d/default.conf' >> /docker-entrypoint.sh && \
    echo '' >> /docker-entrypoint.sh && \
    echo 'echo "Generated frontend configuration:"' >> /docker-entrypoint.sh && \
    echo 'cat /usr/share/nginx/html/config.js' >> /docker-entrypoint.sh && \
    echo '' >> /docker-entrypoint.sh && \
    echo '# Start nginx with dumb-init' >> /docker-entrypoint.sh && \
    echo 'exec dumb-init nginx -g "daemon off;"' >> /docker-entrypoint.sh && \
    chmod +x /docker-entrypoint.sh

# Switch to nginx user
USER nginx

# Expose port
EXPOSE ${NGINX_PORT}

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:${NGINX_PORT}/health || exit 1

# Use dumb-init as PID 1
ENTRYPOINT ["dumb-init", "--"]

# Start nginx
CMD ["/docker-entrypoint.sh"]