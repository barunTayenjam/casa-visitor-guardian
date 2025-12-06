# Frontend Podmanfile
# Multi-stage build for frontend optimized for Podman

# Stage 1: Build
FROM docker.io/library/node:20-alpine AS builder

# Set the working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies (use npm install if no lock file)
RUN npm install && npm cache clean --force

# Copy source code and config files
COPY src/ ./src/
COPY public/ ./public/
COPY index.html ./
COPY vite.config.ts ./
COPY tsconfig*.json ./
COPY tailwind.config.ts ./
COPY postcss.config.js ./
COPY components.json ./

# Build the React application
RUN npm run build

# Production stage with nginx (using specific version to avoid registry issues)
FROM docker.io/library/nginx:1.25-alpine AS production

# Install wget for health checks (alpine nginx doesn't include curl)
RUN apk add --no-cache wget

# Copy built assets from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy custom nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf.template

# Labels for Podman
LABEL name="sentryvision-frontend" \
      version="1.0" \
      description="SentryVision frontend service" \
      maintainer="SentryVision Team"

# Set default port if not provided
ENV NGINX_PORT=3000

# Expose the port (will be overridden by docker-compose)
EXPOSE ${NGINX_PORT}

# Create startup script to substitute environment variables
RUN echo '#!/bin/sh' > /docker-entrypoint.sh && \
    echo 'echo "Starting with NGINX_PORT=$NGINX_PORT"' >> /docker-entrypoint.sh && \
    echo 'envsubst "\$NGINX_PORT" < /etc/nginx/conf.d/default.conf.template > /etc/nginx/conf.d/default.conf' >> /docker-entrypoint.sh && \
    echo 'echo "Generated nginx config:"' >> /docker-entrypoint.sh && \
    echo 'cat /etc/nginx/conf.d/default.conf' >> /docker-entrypoint.sh && \
    echo 'nginx -g "daemon off;"' >> /docker-entrypoint.sh && \
    chmod +x /docker-entrypoint.sh

# Health check (use environment variable for port)
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:$NGINX_PORT/health || exit 1

# Start nginx with environment substitution
CMD ["/docker-entrypoint.sh"]