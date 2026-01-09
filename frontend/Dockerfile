# Frontend Dockerfile with vite pre-installed
FROM node:20-alpine

# Install system dependencies
RUN apk add --no-cache

WORKDIR /app

# Copy package files
COPY package.json .
COPY package-lock.json .

# Install dependencies
RUN npm install --force

# Copy source code
COPY . .

# Expose port
EXPOSE 5173

# Start development server
CMD ["npm", "run", "dev"]