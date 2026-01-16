# Backend Dockerfile with tsx pre-installed for development
FROM node:20-alpine

# Install system dependencies
RUN apk add --no-cache \
    curl \
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

# Expose ports (API + Debug)
EXPOSE 9753 9754

# Start development server with watch mode
# tsx watch automatically restarts on file changes
CMD ["npx", "tsx", "watch", "--clear-screen=false", "src/index.ts"]