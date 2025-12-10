# Multi-stage build for SentryVision Frontend
# Optimized for production with Vite build system

# ===========================================
# Base Stage - Common dependencies
# ===========================================
FROM node:20-alpine AS base
# Install security updates and required packages
RUN apk update && apk upgrade && apk add --no-cache libc6-compat && \
    rm -rf /var/cache/apk/*
# Create app directory with proper permissions
WORKDIR /app

# ===========================================
# Dependencies Stage
# ===========================================
FROM base AS deps
# Copy package files
COPY package*.json ./
# Install dependencies with npm ci for reproducible builds
RUN npm ci --only=production && npm cache clean --force

# ===========================================
# Builder Stage
# ===========================================
FROM base AS builder
# Copy package files
COPY package*.json ./
# Install all dependencies including dev dependencies
RUN npm ci
# Copy source code
COPY . .
# Set build environment variables
ENV NODE_ENV=production
# Build the React application with Vite
RUN npm run build
# Remove source maps from production build to reduce size
RUN rm -rf dist/**/*.map

# ===========================================
# Production Stage with Nginx
# ===========================================
FROM nginx:1.25-alpine AS production
# Install security updates and required packages
RUN apk update && apk upgrade && \
    apk add --no-cache curl && \
    rm -rf /var/cache/apk/*

# Remove default nginx website
RUN rm -rf /usr/share/nginx/html/*

# Copy built assets from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy optimized nginx configuration for frontend
COPY docker/nginx/frontend.conf /etc/nginx/conf.d/default.conf

# Copy entrypoint script
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

# Set entrypoint
ENTRYPOINT ["/docker-entrypoint.sh"]

# Set proper permissions
RUN chown -R nginx:nginx /usr/share/nginx/html && \
    chmod -R 755 /usr/share/nginx/html

# Set environment variables
ENV NODE_ENV=production
ENV NGINX_PORT=80

# Expose port
EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:80/health || exit 1

# Start nginx
CMD ["nginx", "-g", "daemon off;"]