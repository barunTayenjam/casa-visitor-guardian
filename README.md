# SentryVision

> Version 1.6.0 — Resource-optimized home security with real-time AI detection.

Real-time camera security system: RTSP → go2rtc → Python (MOG2 + YOLOv8n + InsightFace) → PostgreSQL. Streams via WebRTC or MSE/Canvas fallback through any browser. Runs on 2GB RAM / 2-core hardware.

## One-Click Install

```bash
curl -fsSL https://raw.githubusercontent.com/anomalyco/home-security-non-docker/main/scripts/install.sh | bash
```

Or from a local clone:

```bash
bash scripts/install.sh
```

The script auto-detects your LAN IP, generates secure secrets, builds containers, and waits for everything to be healthy. Add cameras later from the web UI.

**Default login**: `admin` / `admin123` (change on first login)

---

## Architecture

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   Browser    │◄───►│   Backend    │◄───►│  OpenCV Svc  │◄───►│    go2rtc    │
│   WebRTC/MSE │     │   Express 5  │     │   Flask      │     │  RTSP proxy  │
│    :9753     │     │   :9753      │     │   :8084      │     │  :8555/:1984 │
└──────────────┘     └──────┬───────┘     └──────────────┘     └──────┬───────┘
                            │                                         │
                     ┌──────▼──────┐                          ┌──────▼──────┐
                     │  PostgreSQL │                          │   Camera    │
                     │   :5432     │                          │   RTSP      │
                     └─────────────┘                          └─────────────┘
```

| Service | Stack | Port |
|---------|-------|------|
| Backend (serves frontend + API) | Express 5 + TypeScript + TypeORM + Socket.io | 9753 |
| Frontend (static, served by backend) | React 18 + TypeScript + Vite + TailwindCSS + Radix UI | 9753 |
| OpenCV | Python Flask + MOG2 + YOLOv8n ONNX + InsightFace + ByteTracker | 8084 / 9090 |
| go2rtc | RTSP → WebRTC bridge | 8555 (WebRTC) / 1984 (API) |
| Database | PostgreSQL 15+ (26 migrations) | 5432 |
| Cache | In-memory (Redis optional) | — |

**Key design decisions:**
- **Frontend merged into backend**: Single container serves both static files and API — one less container, simpler deployment.
- **Redis removed by default**: In-memory cache replaces Redis — saves ~150MB RAM on low-end hardware. Set `REDIS_DISABLED=true`.
- **go2rtc as RTSP gateway**: Cameras (especially TP-LINK) allow only 1 concurrent RTSP connection. go2rtc holds it; Python consumes the re-stream.
- **Python for vision, Node.js for web**: Two-runtime architecture is correct — Python owns real-time OpenCV pipeline, Node.js owns API/DB/delivery.
- **WebRTC → MSE → canvas fallback**: WebRTC works on LAN (lowest latency); MSE via WebSocket fMP4 works through Cloudflare Tunnel (TCP-only); canvas fallback from Python pipeline as last resort.

### Detection Pipeline

```
Camera RTSP → go2rtc → FFmpegReader (BGR24) → MotionGate (MOG2)
  → YOLOv8n ONNX (class whitelist: person/car/dog/cat/etc)
  → ByteTracker (Kalman filter tracking)
  → IdentityEnrichment (InsightFace ArcFace)
  → WebSocketPublisher → Node.js → PostgreSQL
```

- **MotionGate**: MOG2 background subtraction (pixel threshold: 500, 10-frame warmup)
- **YOLOv8n**: ~215ms inference, 80-class COCO filtered to security-relevant classes
- **ByteTracker**: Kalman filter multi-object tracking with lifecycle management
- **Face recognition**: InsightFace ArcFace with 30s identity cache

## Quick Start

### Docker (Recommended — Production Mode)

```bash
git clone <repo-url> && cd home-security-non-docker
# Edit go2rtc.yaml or server/cameras.json with your RTSP URLs
docker compose up -d --build
```

### Local Development

```bash
# Backend (handles both API + frontend serving in production)
cd server
npm install && npm run dev    # :9753

# Frontend (standalone dev server with HMR)
cd frontend
npm install && npm run dev    # :5173 (proxies API to :9753)
```

### Camera Setup

Add cameras via the web UI (Settings → Cameras) or edit `server/cameras.json` directly:

```json
{
  "id": "cam1",
  "name": "Front Door",
  "streams": [{
    "path": "rtsp://user:pass@192.168.1.100:554/stream1",
    "roles": ["live", "detect", "record"],
    "width": 1920, "height": 1080, "fps": 2
  }],
  "objects": { "track": ["person", "car", "dog", "cat"] }
}
```

## Service URLs

| Service | URL |
|---------|-----|
| Web UI | http://localhost:9753 |
| go2rtc admin | http://localhost:1984 |
| OpenCV health | http://localhost:8084/health |

## Project Structure

```
├── frontend/                # React SPA (served by backend in production)
├── server/                  # Express 5 backend (API + static files + Socket.io)
│   └── src/
│       ├── controllers/     # MVC controllers
│       ├── routes/          # Express route definitions
│       ├── services/        # Business logic
│       ├── models/          # TypeORM entities
│       ├── middleware/       # Auth, validation, rate limiting
│       ├── streams/         # RTSP manager, stream health monitor
│       └── index.ts         # Bootstrap (go2rtc proxy, WebSocket upgrade, CSP)
├── opencv-service/          # Python OpenCV detection pipeline
│   ├── rtsp_ingestion/      # Core pipeline (FFmpegReader, MotionGate, YOLO, Tracker)
│   ├── models/              # ONNX weights
│   └── download_yolov8.py   # Model download script
├── database/
│   └── migrations/          # PostgreSQL migrations (001-026)
├── scripts/
│   ├── install.sh           # One-click install script
│   ├── diagnose.sh          # System diagnostics
│   ├── health.sh            # Service health monitoring
│   └── ...
├── go2rtc.yaml              # RTSP stream definitions + WebRTC config
├── docker-compose.yml       # 4 services (no separate frontend container)
└── .env                     # Auto-generated by install.sh
```

## Environment Variables

Key variables in `.env`:

| Variable | Default | Description |
|----------|---------|-------------|
| `POSTGRES_PASSWORD` | (required) | Database password |
| `JWT_ACCESS_SECRET` | (required) | JWT signing secret |
| `REDIS_DISABLED` | `true` | Skip Redis, use in-memory cache |
| `LOW_RESOURCE_MODE` | `true` | Lower memory/CPU limits |
| `DEFAULT_FPS` | `2` | Detection pipeline frames per second |
| `SEED_ADMIN_PASSWORD` | `admin123` | First-run admin password |

## Commands

```bash
# Docker
docker compose up -d         # Start all services
docker compose logs -f       # Follow logs
docker compose down          # Stop
bash scripts/install.sh      # One-click install or update

# Development
npm run dev                  # Frontend HMR (:5173)
npm run dev:server           # Backend (:9753)
npm run dev:full             # Both

# Quality
npm run lint                 # ESLint (frontend)
npm run typecheck            # TypeScript check (frontend)
npm run test                 # Jest (frontend)

# Diagnostics
bash scripts/diagnose.sh     # Camera connectivity, ports, FFmpeg
bash scripts/health.sh       # Service health monitoring
```

## Security

- JWT access (15 min) / refresh (7 days) tokens
- TOTP MFA (Google Authenticator compatible)
- Role-based access (admin, user, viewer)
- BCrypt password hashing with history tracking
- Zod input validation on all endpoints
- Rate limiting per endpoint
- Helmet.js security headers
- Full audit logging of sensitive operations

## Troubleshooting

| Problem | Fix |
|---------|-----|
| No frames from camera | Camera may reject multiple RTSP connections. go2rtc holds the single slot; verify `go2rtc.yaml` is correct. |
| OpenCV not connecting | `curl http://localhost:8084/health` — check Docker logs |
| Port conflicts | Ensure ports 9753, 8084, 9090, 8555, 1984, 5432 are free |
| WebRTC not working on LAN | Verify candidates in `go2rtc.yaml` match your LAN IP |

## License

Private project.
