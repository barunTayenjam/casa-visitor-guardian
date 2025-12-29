FROM node:20-alpine

# Install system dependencies needed for OpenCV
RUN apk add --no-cache \
    python3 \
    py3-pip \
    make \
    g++ \
    git \
    curl \
    pkgconfig \
    libpng-dev \
    libjpeg-turbo-dev \
    opencv \
    py3-opencv \
    cmake \
    gfortran \
    build-base \
    && rm -rf /var/cache/apk/*

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# Create necessary directories
RUN mkdir -p /app/models /app/data/logs

# Copy model files from main server (will be mounted as volume)
# Models will be provided via volume mount in docker-compose

# Build TypeScript
RUN npm run build

# Set environment variables
ENV NODE_ENV=production
ENV OPENCV_PORT=8084

# Expose port
EXPOSE 8084

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD curl -f http://localhost:8084/health || exit 1

# Start the OpenCV service
CMD ["npm", "start"]