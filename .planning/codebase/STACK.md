# Technology Stack

> Generated: 2026-08-15 | Focus: Tech | Scope: full repo

## Languages & Runtimes

| Component | Language | Runtime | Version |
|-----------|----------|---------|---------|
| Frontend | TypeScript | Browser (React 18) | TS ^5.5.3 |
| Backend | TypeScript | Node.js (ESM) | TS ^5.9.3 |
| OpenCV Service | Python | CPython (Docker) | Flask 3.0.0 |
| Database | SQL (PostgreSQL) | PostgreSQL 15+ | 26 migrations |

## Frontend Stack (`frontend/`)

- **Framework**: React 18.3 with TypeScript, Vite 5.4 (SWC compiler via `@vitejs/plugin-react-swc`)
- **Styling**: TailwindCSS 3.4 + `@tailwindcss/typography`, PostCSS, Autoprefixer
- **UI**: Radix UI primitives (shadcn/ui pattern) in `frontend/src/components/ui/`
- **Build**: Vite → static files, served by backend in production
- **Type config**: `frontend/tsconfig.json` — strict mode, `@/*` path alias → `./src/*`
- **Testing**: Jest 30 + ts-jest + jsdom environment
- **Linting**: ESLint 9 (flat config) + Prettier 3.9

## Backend Stack (`server/`)

- **Framework**: Express 5.2, TypeScript ESM (`"type": "module"`, `nodenext` resolution)
- **ORM**: TypeORM 0.3.28 with PostgreSQL (`server/src/database.ts` — DataSource, entity auto-discovery from `server/src/models/`)
- **Realtime**: Socket.io 4.7 (frames + motion alerts), ws 8.18 (Python WS client)
- **Auth**: jsonwebtoken 9, bcrypt 6, speakeasy 2 (TOTP/MFA), qrcode
- **Security**: helmet 8, express-rate-limit 8, zod 3.25 (validation)
- **Files**: multer 2, sharp 0.34 (image processing), ffmpeg-static
- **Notifications**: web-push 3.6 (VAPID browser push)
- **Scheduling**: node-cron 4.2
- **Proxy**: http-proxy-middleware 4.1 (go2rtc proxy)
- **Other**: axios, compression, ioredis (optional, `REDIS_DISABLED=true`), debug, glob
- **Memory limit**: `--max-old-space-size=512` in start script

## OpenCV Service Stack (`opencv-service/`)

- **Framework**: Flask 3.0 + flask-cors + flask-limiter
- **Vision**: opencv-contrib-python-headless ≥4.8, InsightFace 0.7 (ArcFace), onnxruntime ≥1.15
- **Detection chain**: YOLOv8n → YOLOv5n → yolov4-tiny (OpenCV DNN fallback)
- **Tracking**: ByteTracker (Kalman filter multi-object tracking)
- **Realtime**: websockets ≥16 (publishes JPEG frames + JSON events to Node on :9090)
- **DB access**: psycopg2-binary (direct PostgreSQL)
- **Utilities**: numpy, Pillow, psutil, redis (optional)

## go2rtc (Streaming Bridge)

- **Image**: `alexxit/go2rtc:1.9.14` (external binary, not in-repo code)
- **Config**: `go2rtc.yaml` — RTSP sources (cam1/cam2), API :1984, WebRTC :8555
- **Entrypoint override**: `go2rtc-entrypoint.sh` (repo root)
- **Roles**: RTSP → WebRTC/MSE/HLS conversion, protocol bridge for frontend live view

## Infrastructure

- **Docker Compose** (`docker-compose.yml`): 4 services — postgres, backend, opencv, go2rtc on `sentryvision_network` (bridge)
- **Resource limits**: backend 512M/1CPU, opencv 1536M/2CPU, postgres 192M/0.5CPU, go2rtc 128M/0.5CPU
- **Dev compose**: `docker-compose.dev.yml` (referenced by npm scripts)
- **Timezone**: Asia/Kolkata (IST) across all services

## Ports

| Port | Service | Purpose |
|------|---------|---------|
| 9753 | Backend | Express API + static frontend + Socket.io |
| 8084 | OpenCV | Flask REST API |
| 9090 | OpenCV | WebSocket frame/event publisher |
| 1984 | go2rtc | HTTP API / WebRTC signaling |
| 8555 | go2rtc | WebRTC (TCP+UDP) |
| 5432 | PostgreSQL | Database |
| 5173 | Vite dev server | Frontend dev only |

## Key Config Files

| File | Purpose |
|------|---------|
| `package.json` | Root monorepo scripts (dev, build, test, docker) |
| `server/package.json` | Backend deps + scripts |
| `frontend/vite.config.ts` | Vite build + API proxy to :9753 |
| `server/cameras.json` | Camera RTSP URLs, zones, tracked objects (gitignored) |
| `server/cameras.example.json` | Camera config template |
| `go2rtc.yaml` | go2rtc stream sources + WebRTC candidates |
| `docker-compose.yml` | Production service topology |
| `.env.example` | Environment variable reference (extensive) |

## Dependency Notes

- Root `package.json` has `puppeteer ^25.5.0` as production dependency (utility/scripts usage)
- Redis is optional everywhere — in-memory cache fallback via `REDIS_DISABLED=true`
- Frontend tests exclude `src/tests/**` and `src/__tests__/**` from typecheck
- Server tsconfig excludes `src/**/*.test.ts` from build output
