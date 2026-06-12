# ---- Frontend build stage ----
FROM node:20-alpine AS frontend-builder
WORKDIR /build
COPY frontend/package*.json ./
RUN npm install --force --no-audit --no-fund
COPY frontend/ .
RUN npm run build

# ---- Backend build stage ----
FROM node:20-alpine AS backend-builder
RUN apk add --no-cache python3 make g++
WORKDIR /build
COPY server/package*.json ./
RUN npm install --no-audit --no-fund
COPY server/ .
RUN npm run build

# ---- Runtime stage ----
FROM node:20-alpine
RUN apk add --no-cache \
    curl \
    ffmpeg \
    postgresql-client \
    tzdata

ENV TZ=Asia/Kolkata \
    NODE_ENV=production

WORKDIR /app

COPY --from=backend-builder /build/dist ./dist
COPY --from=backend-builder /build/node_modules ./node_modules
COPY --from=frontend-builder /build/dist ./public
COPY server/package*.json ./

RUN chown -R node:node /app

USER node

EXPOSE 9753

ENV NODE_OPTIONS="--max-old-space-size=512"

CMD ["node", "dist/index.js"]
