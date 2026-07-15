# Technology Stack

**Last updated:** 2026-07-16
**Focus:** Tech stack analysis

## Languages

| Language | Version | Location |
|----------|---------|----------|
| TypeScript | ~5.5 (frontend), ~5.9 (backend) | `frontend/`, `server/` |
| Python | 3.11 | `opencv-service/` |
| JavaScript (ESM) | ES2022 | `scripts/`, `database/` |
| SQL | PostgreSQL dialect | `database/migrations/` |
| Shell | bash | `scripts/*.sh` |

## Runtime & Platform

- **Runtime:** Node.js 20.x (Alpine in Docker), Python 3.11 (slim in Docker)
- **Platform requirements:** PostgreSQL 15+, FFmpeg, OpenCV, CUDA-capable GPU (optional)
- **Timezone:** IST (Asia/Kolkata, UTC+5:30)
- **Memory limits:** Backend 512MB, OpenCV 1536MB, PostgreSQL 192MB, go2rtc 128MB

## Framework & Core Libraries

### Backend (`server/`)

| Name | Purpose | Version | Location |
|------|---------|---------|----------|
| Express 5 | HTTP server framework | ^5.2.1 | `server/package.json` |
| TypeORM | ORM / database layer | ^0.3.28 | `server/package.json` |
| Socket.io | WebSocket real-time communication | ^4.7.2 | `server/package.json` |
| Zod | Schema validation | ^3.25.76 | `server/package.json` |
| jsonwebtoken | JWT auth tokens | ^9.0.3 | `server/package.json` |
| pg | PostgreSQL native driver | ^8.16.3 | `server/package.json` |
| ioredis | Redis client | ^5.10.1 | `server/package.json` |
| ws | WebSocket client (Python bridge) | ^8.18.3 | `server/package.json` |
| node-cron | Scheduled task runner | ^4.2.1 | `server/package.json` |
| sharp | Image processing | ^0.34.5 | `server/package.json` |
| helmet | Security HTTP headers | ^8.1.0 | `server/package.json` |
| axios | HTTP client (OpenCV REST bridge) | ^1.13.2 | `server/package.json` |
| web-push | Web push notifications (VAPID) | ^3.6.7 | `server/package.json` |
| bcrypt | Password hashing | ^6.0.0 | `server/package.json` |
| speakeasy | TOTP / MFA | ^2.0.0 | `server/package.json` |
| qrcode | QR code generation (MFA setup) | ^1.5.4 | `server/package.json` |
| multer | File upload handling | ^2.0.2 | `server/package.json` |
| express-rate-limit | Rate limiting middleware | ^8.2.1 | `server/package.json` |

### Frontend (`frontend/`)

| Name | Purpose | Version | Location |
|------|---------|---------|----------|
| React 18 | UI framework | ^18.3.1 | `frontend/package.json` |
| React Router DOM v6 | Client-side routing | ^6.30.2 | `frontend/package.json` |
| Vite 5 | Build tool / dev server | ^5.4.21 | `frontend/package.json` |
| TailwindCSS | Utility CSS framework | ^3.4.18 | `frontend/package.json` |
| Radix UI (via shadcn/ui) | Accessible UI primitives | various | `frontend/package.json` |
| @tanstack/react-query | Server state management | ^5.90.12 | `frontend/package.json` |
| Recharts | Charting library | ^2.15.4 | `frontend/package.json` |
| framer-motion | Animation library | ^12.23.25 | `frontend/package.json` |
| socket.io-client | WebSocket client | ^4.8.1 | `frontend/package.json` |
| react-hook-form | Form state management | ^7.68.0 | `frontend/package.json` |
| zod | Schema validation | ^3.23.8 | `frontend/package.json` |
| date-fns | Date utilities | ^3.6.0 | `frontend/package.json` |
| sonner | Toast notifications | ^1.7.4 | `frontend/package.json` |
| lucide-react | Icon library | ^0.556.0 | `frontend/package.json` |
| @tanstack/react-virtual | Virtualized lists | ^3.14.4 | `frontend/package.json` |
| next-themes | Theme management | ^0.4.6 | `frontend/package.json` |

### OpenCV Service (`opencv-service/`)

| Name | Purpose | Version | Location |
|------|---------|---------|----------|
| Flask 3.0 | Python web framework | ==3.0.0 | `opencv-service/requirements.txt` |
| OpenCV (contrib-headless) | Computer vision (MOG2, YOLO, HOG) | >=4.8.0 | `opencv-service/requirements.txt` |
| InsightFace | Face recognition (ArcFace) | >=0.7.3,<0.8 | `opencv-service/requirements.txt` |
| ONNX Runtime | YOLO model inference | >=1.15.0 | `opencv-service/requirements.txt` |
| websockets | Python WebSocket server (port 9090) | >=16.0 | `opencv-service/requirements.txt` |
| psycopg2-binary | PostgreSQL adapter | >=2.9.9 | `opencv-service/requirements.txt` |
| redis | Redis cache client | >=5.0.0 | `opencv-service/requirements.txt` |
| NumPy | Numerical processing | >=1.24.0 | `opencv-service/requirements.txt` |
| Pillow | Image processing | >=10.0.0 | `opencv-service/requirements.txt` |
| flask-limiter | Rate limiting | ==3.5.0 | `opencv-service/requirements.txt` |
| psutil | System metrics | >=5.9.0 | `opencv-service/requirements.txt` |

### Database (`database/`)

| Name | Purpose | Version | Location |
|------|---------|---------|----------|
| PostgreSQL 15 | Relational database | 15-alpine (Docker) | `database/Dockerfile` |
| pg | Node.js PostgreSQL client | ^8.16.3 | `database/package.json` |

## Dependencies

### Backend Production Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| express | ^5.2.1 | HTTP framework |
| typeorm | ^0.3.28 | ORM |
| socket.io | ^4.7.2 | WebSocket server |
| pg | ^8.16.3 | PostgreSQL driver |
| ioredis | ^5.10.1 | Redis client |
| redis | ^5.10.0 | Redis client |
| jsonwebtoken | ^9.0.3 | JWT auth |
| zod | ^3.25.76 | Validation |
| axios | ^1.13.2 | HTTP client |
| bcrypt | ^6.0.0 | Password hashing |
| speakeasy | ^2.0.0 | TOTP MFA |
| web-push | ^3.6.7 | Web push notifications |
| sharp | ^0.34.5 | Image processing |
| helmet | ^8.1.0 | Security headers |
| cors | ^2.8.5 | CORS middleware |
| dotenv | ^17.2.3 | Env configuration |
| ws | ^8.18.3 | WebSocket client |
| node-cron | ^4.2.1 | Job scheduling |
| node-fetch | ^3.3.2 | HTTP fetch (NVIDIA API) |
| qrcode | ^1.5.4 | QR generation |
| multer | ^2.0.2 | File upload |
| express-rate-limit | ^8.2.1 | Rate limiting |
| http-proxy-middleware | ^4.1.0 | go2rtc proxy |
| ffmpeg-static | ^5.3.0 | Bundled FFmpeg |
| debug | ^4.4.3 | Debug logging |

### Frontend Production Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| react | ^18.3.1 | UI framework |
| react-dom | ^18.3.1 | DOM rendering |
| react-router-dom | ^6.30.2 | Routing |
| @tanstack/react-query | ^5.90.12 | Server state |
| socket.io-client | ^4.8.1 | WebSocket client |
| framer-motion | ^12.23.25 | Animations |
| recharts | ^2.15.4 | Charts |
| sonner | ^1.7.4 | Toasts |
| react-hook-form | ^7.68.0 | Forms |
| @hookform/resolvers | ^5.2.2 | Form validation resolvers |
| zod | ^3.23.8 | Validation |
| date-fns | ^3.6.0 | Date utils |
| lucide-react | ^0.556.0 | Icons |
| class-variance-authority | ^0.7.1 | Component variants |
| tailwind-merge | ^2.6.0 | Tailwind class merging |
| clsx | ^2.1.1 | Classname utilities |
| next-themes | ^0.4.6 | Theme switching |
| vaul | ^0.9.9 | Drawer component |
| cmdk | ^1.0.0 | Command menu |
| input-otp | ^1.2.4 | OTP input |
| embla-carousel-react | ^8.3.0 | Carousel |
| react-day-picker | ^8.10.1 | Date picker |
| react-resizable-panels | ^2.1.9 | Resizable panels |
| tailwindcss-animate | ^1.0.7 | Tailwind animation utilities |

### OpenCV Service Python Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| opencv-contrib-python-headless | >=4.8.0 | Computer vision |
| insightface | >=0.7.3,<0.8 | Face recognition (ArcFace) |
| onnxruntime | >=1.15.0 | YOLO inference |
| flask | ==3.0.0 | Python web framework |
| flask-cors | ==4.0.0 | CORS for Flask |
| flask-limiter | ==3.5.0 | Flask rate limiting |
| websockets | >=16.0 | WebSocket server |
| psycopg2-binary | >=2.9.9 | PostgreSQL adapter |
| redis | >=5.0.0 | Cache client |
| numpy | >=1.24.0 | Array processing |
| Pillow | >=10.0.0 | Image I/O |
| psutil | >=5.9.0 | System metrics |

### Testing Dependencies

| Package | Framework | Version | Location |
|---------|-----------|---------|----------|
| Jest | Both (FE+BE) | ^30.2.0 | root, `frontend/`, `server/` |
| ts-jest | Both | ^29.4.x | `frontend/`, `server/` |
| @testing-library/react | Frontend | ^16.3.2 | `frontend/` |
| @testing-library/jest-dom | Frontend | ^6.9.1 | `frontend/` |
| @testing-library/user-event | Frontend | ^14.6.1 | `frontend/` |
| supertest | Backend | ^7.1.4 | `server/` |
| jest-environment-jsdom | Frontend | ^30.4.1 | `frontend/` |
| jsdom | Frontend | ^27.4.0 | `frontend/` |
| tsx | Both | ^4.20.x | root, `server/` |
| ts-node | Backend | ^10.9.2 | `server/` |

## Configuration & Build

- **Build tool:** Vite 5 (frontend), tsc (backend), Flask dev server (Python)
- **Configuration files:**
  - `frontend/vite.config.ts` — Vite config + API proxy routes
  - `frontend/tailwind.config.ts` — TailwindCSS theme
  - `frontend/postcss.config.js` — PostCSS config
  - `frontend/eslint.config.js` — ESLint flat config (v9)
  - `server/tsconfig.json` — TypeScript config (nodenext modules)
  - `frontend/tsconfig.json` — TypeScript config (ESNext, JSX)
  - `server/jest.config.js` — Backend Jest config
  - `frontend/jest.config.ts` — Frontend Jest config
  - `docker-compose.yml` — All 5 services orchestration
  - `go2rtc.yaml` — RTSP to WebRTC bridge config
  - `opencv-service/pytest.ini` — Python test config
- **Environment variables:** `.env.example` (reference), `.env` (actual, gitignored), `docker-compose.yml` env blocks
- **Containerization:** Docker (multi-stage builds for backend + frontend)
- **Path aliases:** `@/*` → `frontend/src/*` (Vite resolve alias)

## Infrastructure

- **Database:** PostgreSQL 15+ — primary data store (TypeORM with 26 migrations)
- **Cache:** In-memory (primary), Redis (optional, disabled by default via `REDIS_DISABLED=true`)
- **Queue/Streaming:** Socket.io (real-time browser), WebSocket (Python↔Node bridge on port 9090), go2rtc (RTSP→WebRTC on port 8555)
- **Storage:** Local filesystem (`./data/detections`, `./public/events`, `./public/snapshots`, `./public/timelapse`)

## Feature Toggles & Configurable Options

- **Pipeline mode:** `legacy`, `dual`, `python-only` (default: python-only)
- **Low resource mode:** `LOW_RESOURCE_MODE=true` — reduces FFmpeg threads, FPS, resolution
- **Redis disabled:** `REDIS_DISABLED=true` — skip Redis entirely, use in-memory cache
- **Feature flags:** MFA, facial recognition, person detection, vehicle detection, license plate recognition

---

*Stack analysis: 2026-07-16*
