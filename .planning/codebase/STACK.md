# Technology Stack

**Analysis Date:** 2026-05-15

## Languages

**Primary:**
- TypeScript 5.5+ (strict: false) — Frontend UI, Backend API server, database models, all route/service logic
- Python 3.11 — OpenCV computer vision service (face recognition, YOLO object detection, motion detection)

**Secondary:**
- SQL — PostgreSQL migration files (`database/migrations/*.sql`)
- Shell (Bash) — Startup scripts (`start-all-services.sh`, `deploy-to-manjaro.sh`), diagnostic scripts
- YAML — Docker Compose orchestration (`docker-compose.yml`)

## Runtime

**Environment:**
- Node.js 20 (Alpine-based Docker images) — Frontend & Backend
- Python 3.11-slim — OpenCV service
- PostgreSQL 15 (Alpine) — Database engine
- Redis 7 (Alpine) — Cache layer

**Package Manager:**
- npm — All Node.js packages (root, `frontend/`, `server/`, `database/`)
- pip — Python dependencies (`opencv-service/requirements.txt`)
- Lockfile: `package-lock.json` present at root level

## Frameworks

**Core:**
- React 18.3 — Frontend SPA (`frontend/`)
- Express 5.2 — Backend API server (`server/`)
- Flask 3.0 — Python OpenCV microservice (`opencv-service/`)
- TypeORM 0.3 — Database ORM, entity definitions, repository pattern (`server/src/models/`, `server/src/database.ts`)

**Testing:**
- Jest 30 — Test runner for both frontend and backend
- ts-jest 29 — TypeScript Jest transformer
- Supertest 7 — HTTP integration tests (backend)
- React Testing Library — Frontend component tests

**Build/Dev:**
- Vite 5.4 — Frontend dev server, HMR, build toolchain (`frontend/vite.config.ts`)
- @vitejs/plugin-react-swc — SWC-based React transform for fast HMR
- tsx — TypeScript execution for dev mode (backend)
- nodemon — Backend file watcher (wraps tsx)
- concurrently — Parallel dev server startup
- wait-on — Service readiness checks

## Key Dependencies

**Critical (Frontend):**
- `@tanstack/react-query` 5.90 — Server state management, data fetching/caching
- `socket.io-client` 4.8 — Real-time camera streaming & event notifications
- `react-router-dom` 6.30 — Client-side routing
- `recharts` 2.15 — Analytics charts & data visualization
- `tailwindcss` 3.4 + `tailwindcss-animate` — Utility-first CSS
- `@radix-ui/*` (20+ packages) — Accessible headless UI primitives (shadcn/ui pattern)
- `framer-motion` 12.23 — Animation library
- `zod` 3.23 — Schema validation (used with react-hook-form via `@hookform/resolvers`)
- `react-hook-form` 7.68 — Form state management
- `sonner` 1.7 — Toast notifications
- `cmdk` 1.0 — Command palette component

**Critical (Backend):**
- `socket.io` 4.7 — WebSocket server for camera streaming & live events
- `jsonwebtoken` 9.0 — JWT token generation/verification
- `bcrypt` 6.0 / `bcryptjs` 3.0 — Password hashing (native + pure JS fallback)
- `axios` 1.13 — HTTP client for OpenCV service communication
- `ioredis` 5.10 — Redis client for caching
- `pg` 8.16 — PostgreSQL driver (used by TypeORM)
- `sharp` 0.34 — Image processing/resizing
- `ffmpeg-static` 5.3 — Bundled FFmpeg binary for RTSP stream processing
- `multer` 2.0 — File upload handling
- `web-push` 3.6 — Web Push notification delivery
- `nodemailer` 7.0 — Email sending (configured but not actively imported in routes)
- `speakeasy` 2.0 — TOTP MFA generation/verification
- `qrcode` 1.5 — QR code generation for MFA setup
- `helmet` 8.1 — HTTP security headers
- `express-rate-limit` 8.2 — API rate limiting
- `node-cron` 4.2 — Scheduled tasks (retention, cleanup)
- `zod` 3.25 — Input validation schemas

**Critical (OpenCV Service):**
- `opencv-contrib-python-headless` 4.8+ — Computer vision (motion detection, YOLO inference, face detection)
- `numpy` 1.24+ — Numerical operations on image arrays
- `face-recognition` 1.3+ — Face embedding generation and comparison
- `flask-cors` 4.0 — CORS for Flask API
- `flask-limiter` 3.5 — Rate limiting for detection endpoints
- `psycopg2-binary` 2.9+ — Direct PostgreSQL access (detection cache)
- `redis` 5.0+ — Caching layer
- `Pillow` 10.0+ — Image I/O

**ML Models (on disk):**
- YOLOv3 (`yolov3.cfg`, `yolov3.weights`) — Object detection
- YOLOv4-tiny (`yolov4-tiny.cfg`, `yolov4-tiny.weights`) — Lightweight object detection
- YOLOv5n (`yolov5n.onnx`) — ONNX format object detection
- Caffe SSD face detector (`res10_300x300_ssd_iter_140000_fp16.caffemodel`, `deploy.prototxt`)
- Haar cascade face detector (`haarcascade_frontalface_default.xml` — bundled in models)

## Configuration

**Environment:**
- `.env` files at project root — secrets and config (NEVER commit)
- `.env.example` — comprehensive template with 200+ variables (many aspirational/unused)
- `.env.production` — production-specific overrides
- `server/cameras.json` — camera RTSP URLs, zones, detection parameters
- Environment variables drive all runtime config (`server/src/config/index.ts`)

**Build:**
- `frontend/vite.config.ts` — Vite dev server proxy, path aliases (`@/` → `./src/`)
- `frontend/tsconfig.json` — ES2020 target, bundler module resolution
- `server/tsconfig.json` — ES2022 target, nodenext module resolution
- `frontend/tailwind.config.ts` — Custom color theme, animations, shadcn/ui CSS variable patterns
- `frontend/components.json` — shadcn/ui component generator config
- `frontend/eslint.config.js` — ESLint flat config with TypeScript + React rules
- `frontend/postcss.config.js` — PostCSS with Tailwind + Autoprefixer
- `jest.config.js` — Root and per-package Jest configuration

**Path Aliases:**
- Frontend: `@/*` → `frontend/src/*` (configured in `tsconfig.json` + `vite.config.ts`)
- Backend: Relative imports with `.js` extension (ES modules)

## Platform Requirements

**Development:**
- Docker + Docker Compose (recommended)
- Node.js 20+ (for non-Docker development)
- Python 3.11+ with pip (for non-Docker OpenCV service)
- FFmpeg (system package or ffmpeg-static)
- PostgreSQL 15+
- Redis 7+

**Production:**
- Docker Compose orchestrates 5 services: `postgres`, `backend`, `frontend`, `redis`, `opencv`
- systemd service file provided (`sentryvision.service`) for auto-start
- Target: 1-core, 2GB RAM systems (LOW_RESOURCE_MODE=true by default)
- nginx reverse proxy (`nginx.conf`) for production static serving + API proxy
- Timezone: IST (Asia/Kolkata, UTC+5:30) — hardcoded in Docker env vars and systemd service

**Resource Limits (Docker defaults):**
- PostgreSQL: 0.5 CPU, 512MB RAM
- Backend: 1.5 CPU, 3584MB RAM, Node heap 2560MB
- Frontend: No explicit limits
- Redis: 0.1 CPU, 64MB RAM
- OpenCV: 0.5 CPU, 768MB RAM

---

*Stack analysis: 2026-05-15*
