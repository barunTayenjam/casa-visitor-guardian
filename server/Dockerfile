# Multi-stage build for backend
FROM node:20-alpine AS builder

# Install system dependencies for FFMPEG, canvas, and build tools
RUN apk add --no-cache \
    ffmpeg \
    python3 \
    py3-pip \
    make \
    g++ \
    git \
    cairo-dev \
    jpeg-dev \
    pango-dev \
    musl-dev \
    giflib-dev \
    pixman-dev \
    pangomm-dev \
    libjpeg-turbo-dev \
    freetype-dev \
    libpng-dev \
    cairo \
    pango \
    librsvg \
    pixman

# Set the working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install Python distutils for canvas build
RUN pip3 install setuptools --break-system-packages

# Install dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy source code
COPY src/ ./src/
COPY tsconfig.json ./

# Install dev dependencies for build
RUN npm install --only=dev

# Build the TypeScript application
RUN npm run build

# Production stage
FROM node:20-alpine AS production

# Install runtime dependencies
RUN apk add --no-cache \
    ffmpeg \
    cairo \
    pango \
    librsvg \
    pixman \
    jpeg \
    libpng \
    freetype

# Create app directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install only production dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy built application from builder stage
COPY --from=builder /app/dist ./dist

# Create necessary directories
RUN mkdir -p public/snapshots public/events

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Change ownership of app directory
RUN chown -R nodejs:nodejs /app

# Switch to non-root user
USER nodejs

# Expose the port
EXPOSE 9753

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:9753/api/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"

# Start the application
CMD ["node", "dist/index.js"]
