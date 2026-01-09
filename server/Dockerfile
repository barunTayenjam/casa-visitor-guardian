# Backend Dockerfile with tsx pre-installed
FROM node:20-alpine

# Install system dependencies
RUN apk add --no-cache \
    && npm install -g tsx

WORKDIR /app

# Copy package files
COPY package.json .
COPY package-lock.json .

# Install dependencies
RUN npm install

# Copy source code
COPY server/ ./src
COPY . .

# Expose port
EXPOSE 8082

# Start development server
CMD ["npx", "tsx", "src/index.ts"]