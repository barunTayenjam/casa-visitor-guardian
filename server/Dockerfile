# Backend Dockerfile with tsx pre-installed for development
FROM node:20-alpine

# Install dependencies for native modules and timezone support
RUN apk add --no-cache \
    curl \
    ffmpeg \
    python3 \
    make \
    g++ \
    postgresql-client \
    tzdata

# Set timezone
ENV TZ=Asia/Kolkata

WORKDIR /app

# Install dependencies (copy package files first for better caching)
COPY package*.json ./
RUN npm install && \
    chown -R node:node /app

# Copy source code
COPY server/ ./src
COPY . .

# Create non-root user and set ownership
RUN chown -R node:node /app

# Switch to non-root user
USER node

# Expose ports
EXPOSE 9753

# Start development server with watch mode
CMD ["npx", "tsx", "watch", "--clear-screen=false", "src/index.ts"]
ENV NODE_OPTIONS="--max-old-space-size=2560"
