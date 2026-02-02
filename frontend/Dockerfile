# Frontend Dockerfile with vite pre-installed
FROM node:20-alpine

# Install system dependencies and timezone support
RUN apk add --no-cache \
    curl \
    tzdata

# Set timezone to IST
ENV TZ=Asia/Kolkata

WORKDIR /app

# Copy package files
COPY package.json .

# Install dependencies
RUN npm install --force

# Copy source code
COPY . .

# Expose port
EXPOSE 5173

# Start development server
CMD ["npm", "run", "dev"]