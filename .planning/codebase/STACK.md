# Technology Stack

**Analysis Date:** 2026-05-06

## Languages

**Primary:**
- TypeScript 5.5–5.9 — Frontend UI, backend API server, database models, and all Node.js services
- JavaScript (ES2022 modules) — Build configuration, test setup, root-level orchestration scripts

**Secondary:**
- Python 3.11 — OpenCV detection service (Flask app, face recognition, motion detection, YOLO inference)
- SQL — Database migrations (26 migration files in `database/migrations/`)

## Runtime

**Environment:**
- Node.js 20 (Alpine-based Docker images) — Frontend dev server, backend API server
- Python 3.11-slim (Docker image) — OpenCV service container
- Host system: Node.js 25.9.0, Python 3.14.4 (development machine)

**Package Manager:**
- npm — All JavaScript/TypeScript packages
- Lockfile: `package-lock.json` present at root level
- pip — Python packages for opencv-service (`opencv-service/requirements.txt`)

## Frameworks

**Core:**
- Express 5.2.1 — Backend REST API server and HTTP framework (`server/src/index.ts`)
- React 18.3.1 — Frontend UI library (`frontend/src/`)
- Flask 3.0.0 — Python OpenCV detection service (`opencv-service/app.py`)

**Real-time Communication:**
- Socket.IO 4.7–4.8 — Bidirectional streaming and live event notifications between backend and frontend

**Database ORM:**
- TypeORM 0.3.28 — PostgreSQL entity definitions, repositories, and data access (`server/src/models/`, `server/src/database.ts`)
- pg 8.16.3 — Direct PostgreSQL driver (used alongside TypeORM for raw SQL queries)

**Testing:**
- Jest 30.2.0 — Test runner for both frontend and backend
- ts-jest 29.4.5 — TypeScript compilation for Jest
- Supertest 7.1.4 — HTTP endpoint testing for backend
- React Testing Library — Frontend component testing (via jest-environment-jsdom)

**Build/Dev:**
- Vite 5.4.21 — Frontend dev server, HMR, and production builds (`frontend/vite.config.ts`)
- @vitejs/plugin-react-swc — SWC-based React transform for fast builds
- tsx 4.20+ — TypeScript execution for backend development (replaces ts-node)
- nodemon 3.1.10 — Backend file watcher for hot reload during development
- TypeScript compiler (tsc) — Backend production builds to `dist/`

## Key Dependencies

**Frontend UI:**
- TailwindCSS 3.4.18 — Utility-first CSS framework (`frontend/tailwind.config.ts`)
- Radix UI — Headless accessible UI primitives (20+ component packages via shadcn/ui pattern)
- Recharts 2.15.4 — Chart library for analytics dashboards
- Framer Motion 12.23.25 — Animation library
- Lucide React 0.556.0 — Icon library
- React Router DOM 6.30.2 — Client-side routing
- @tanstack/react-query 5.90.12 — Server state management and data fetching
- React Hook Form 7.68.0 + Zod 3.23.8 — Form handling and validation
- cmdk 1.0.0 — Command palette component
- date-fns 3.6.0 — Date utility library

**Backend Core:**
- jsonwebtoken 9.0.3 — JWT token generation and verification
- bcrypt 6.0.0 / bcryptjs — Password hashing (bcrypt for native, bcryptjs as fallback)
- helmet 8.1.0 — HTTP security headers middleware
- express-rate-limit 8.2.1 — Rate limiting middleware
- express-validator 7.3.1 — Request validation
- multer 2.0.2 — File upload handling
- cors 2.8.5 — Cross-origin resource sharing
- dotenv 17.2.3 — Environment variable loading
- axios 1.13.2 — HTTP client for inter-service communication (OpenCV service)
- node-cron 4.2.1 — Scheduled task execution
- sharp 0.34.5 — Image processing and thumbnail generation
- zod 3.25.76 — Schema validation for API inputs

**Backend Media & Streaming:**
- ffmpeg-static 5.3.0 — Static FFmpeg binary for RTSP stream processing
- ws 8.18.3 — WebSocket library (used alongside Socket.IO)

**Backend Notifications & Messaging:**
- web-push 3.6.7 — Web Push notification delivery (VAPID protocol)
- nodemailer 7.0.11 — Email sending (SMTP support, placeholder implementation)
- speakeasy 2.0.0 — TOTP-based MFA code generation

**Python/OpenCV Service:**
- opencv-contrib-python-headless >=4.8.0 — Computer vision with extra modules (YOLO, face detection)
- numpy >=1.24.0 — Numerical computing
- face-recognition >=1.3.0 — Face recognition with dlib backend
- Pillow >=10.0.0 — Image processing
- psycopg2-binary >=2.9.9 — PostgreSQL client for Python
- flask-cors 4.0.0 — CORS support for Flask
- flask-limiter 3.5.0 — Rate limiting for Flask endpoints
- redis >=5.0.0 — Caching client for Python service

## Configuration

**Environment:**
- Environment variables via `.env` files (multiple: `.env`, `.env.local`, `.env.production`, `.env.deploy`)
- `.env.example` templates at root and `server/.env.example`
- Docker Compose environment sections for container-level configuration
- `server/cameras.json` — Camera RTSP URLs, resolution, detection zones, motion parameters
- All config loaded through `server/src/config/index.ts` — single `AppConfig` typed object

**Build:**
- `frontend/vite.config.ts` — Vite dev server proxy rules, path aliases (`@/` → `frontend/src/`)
- `frontend/tailwind.config.ts` — Tailwind theme with shadcn/ui CSS variable pattern, custom `security` color palette
- `frontend/eslint.config.js` — ESLint with TypeScript, React hooks, and React refresh plugins
- `frontend/postcss.config.js` — PostCSS with Tailwind and Autoprefixer
- `server/tsconfig.json` — TypeScript targeting ES2022, NodeNext modules, decorators enabled
- `jest.config.js` (root) — Jest for backend tests with ts-jest ESM preset, 80% coverage threshold
- `server/jest.config.js` — Server-specific Jest configuration

**Docker:**
- `docker-compose.yml` — 5-service orchestration (postgres, backend, frontend, redis, opencv)
- `server/Dockerfile` — Node 20 Alpine with Python3, make, g++, postgresql-client
- `frontend/Dockerfile` — Node 20 Alpine with curl, tzdata
- `opencv-service/Dockerfile` — Python 3.11-slim with OpenCV system dependencies
- `database/Dockerfile` — PostgreSQL 15 Alpine
- `nginx.conf` — Production reverse proxy with gzip, security headers, SPA routing

**Systemd:**
- `sentryvision.service` — Systemd unit file for Docker Compose auto-start

## Platform Requirements

**Development:**
- Node.js 20+ (tested on 25.9.0)
- Python 3.11+ (tested on 3.14.4)
- npm 11+
- Docker & Docker Compose (optional, for containerized development)
- FFmpeg (bundled via ffmpeg-static npm package)
- PostgreSQL 15+ (via Docker or local installation)
- Redis 7+ (via Docker, optional — falls back to in-memory cache)
- RTSP camera streams accessible on local network

**Production:**
- Docker Compose on Linux (target: Manjaro/Arch-based systems)
- systemd for service management (`sentryvision.service`)
- Nginx as reverse proxy (`nginx.conf`)
- Network access to RTSP cameras (192.168.31.x LAN)
- Timezone: IST (Asia/Kolkata, UTC+5:30) — configured across all containers
- Resource-optimized: supports 1-core, 2GB RAM systems via `LOW_RESOURCE_MODE`

---

*Stack analysis: 2026-05-06*
