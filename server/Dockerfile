# Backend Dockerfile with tsx pre-installed for development
FROM node:20-alpine

WORKDIR /app

# Install dependencies for native modules and timezone support
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    postgresql-client \
    tzdata

# Set timezone
ENV TZ=Asia/Kolkata

# Install dependencies (copy package files first for better caching)
COPY package*.json ./
RUN npm install

# Copy source code
COPY server/ ./src
COPY . .

# Expose ports (API + Debug)
EXPOSE 9753 9754

# Start development server with watch mode
# tsx watch automatically restarts on file changes
CMD ["npx", "tsx", "watch", "--clear-screen=false", "src/index.ts"]