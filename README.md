<p align="center">
  <img src="https://raw.githubusercontent.com/barunTayenjam/casa-visitor-guardian/main/docs/assets/logo.svg" alt="SentryVision" width="180" />
</p>

<h1 align="center">SentryVision</h1>

<p align="center">
  <strong>Enterprise-grade home security. Self-hosted. Zero cloud. Total sovereignty.</strong>
</p>

<p align="center">
  <a href="#-quick-start"><strong>Quick Start</strong></a> •
  <a href="#-architecture"><strong>Architecture</strong></a> •
  <a href="#-capabilities"><strong>Capabilities</strong></a> •
  <a href="#-docs"><strong>Documentation</strong></a> •
  <a href="https://github.com/barunTayenjam/casa-visitor-guardian/blob/main/DOCS.md"><strong>Full Docs</strong></a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/version-1.7.1-blue?style=flat-square" />
  <img src="https://img.shields.io/badge/license-MIT-green?style=flat-square" />
  <img src="https://img.shields.io/badge/docker-ready-blue?style=flat-square&logo=docker" />
  <img src="https://img.shields.io/badge/self--hosted-100%25-orange?style=flat-square" />
  <img src="https://img.shields.io/badge/cloud--free-yes-success?style=flat-square" />
</p>

---

## Why SentryVision?

| Traditional Cloud Cameras | SentryVision |
|---------------------------|--------------|
| 📹 Footage leaves your network | 🔒 **100% local — nothing ever leaves** |
| 💸 Monthly subscriptions forever | 💰 **One-time hardware, zero recurring cost** |
| ☁️ Vendor lock-in, API changes | 🛠 **You own the stack, you control the roadmap** |
| 🎯 Basic motion alerts | 🧠 **AI: person/vehicle/animal + face recognition** |
| 📱 App-only access | 🌐 **Browser, API, Webhooks, Home Assistant** |
| 📊 Limited retention | 📈 **Unlimited retention, 25+ analytics dimensions** |

**Built for the self-hosted community.** Runs on a Raspberry Pi 4, Intel NUC, or any Docker-capable hardware. One-click install. Production-grade.

---

## <a id="capabilities"></a>🚀 Capabilities

### Real-Time Intelligence
| Feature | Description |
|---------|-------------|
| **Multi-Object Detection** | YOLOv8n ONNX — person, car, dog, cat @ 215ms inference |
| **Human Verification** | Tiered pipeline: YOLO ≥0.90 → Face → MediaPipe pose → score floor |
| **Face Recognition** | InsightFace ArcFace, 30s identity cache, visitor timeline |
| **ByteTracker** | Kalman filter multi-object tracking with lifecycle management |
| **MotionGate** | MOG2 background subtraction (500px threshold, 10-frame warmup) |

### Live Streaming
- **WebRTC** — Sub-200ms latency on LAN
- **MSE/fMP4** — Works through Cloudflare Tunnel, Tailscale, VPN (TCP-only)
- **Canvas Fallback** — Last resort, zero-config
- **Adaptive FPS** — Scales by viewer count (1–30 FPS)

### Analytics & Intelligence
- **Daily Insights Dashboard** — 25+ dimensions: detection patterns, dwell time, visitor frequency, camera health
- **AI Chat (Ask)** — Natural language queries: *"Show me all cars after 10pm last week"*
- **Event Timeline** — Smart filters, related events, AI scene analysis
- **Timelapse** — Full-resolution stitching from detection snapshots

### Enterprise Features
- **Multi-User + RBAC** — Admin/User/Viewer roles
- **TOTP MFA** — Google Authenticator compatible
- **JWT Auth** — 15min access / 7day refresh tokens
- **Audit Logging** — Full trail of sensitive operations
- **Rate Limiting** — Per-endpoint protection
- **Helmet.js** — Security headers by default

---

## <a id="architecture"></a>🏗 Architecture

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Browser   │◄───►│  Backend    │◄───►│  OpenCV Svc │◄───►│   go2rtc    │
│  WebRTC/MSE │     │  Express 5  │     │   Flask     │     │  RTSP Proxy │
│    :9753    │     │    :9753    │     │    :8084    │     │ :8555/:1984 │
└─────────────┘     └──────┬──────┘     └─────────────┘     └──────┬──────┘
                           │                                        │
                    ┌──────▼──────┐                         ┌────────▼────────┐
                    │ PostgreSQL  │                         │    Camera RTSP  │
                    │   :5432     │                         │   (TP-LINK,     │
                    │  (26 migr)  │                         │   Reolink, etc) │
                    └─────────────┘                         └─────────────────┘
```

### Design Decisions That Matter

| Decision | Rationale |
|----------|-----------|
| **Single Container (Backend + Frontend)** | One deploy target, simpler networking, smaller attack surface |
| **No Redis by Default** | In-memory cache saves ~150MB RAM; Redis optional (`REDIS_DISABLED=false`) |
| **go2rtc as RTSP Gateway** | Cameras allow 1 RTSP connection; go2rtc holds it, Python consumes re-stream |
| **Python for Vision, Node.js for Web** | Correct two-runtime split: Python owns OpenCV pipeline, Node owns API/DB |
| **WebRTC → MSE → Canvas** | Progressive enhancement: best latency → broad compatibility → guaranteed fallback |

### Detection Pipeline (Runs Entirely in Python)

```
Camera RTSP → go2rtc → FFmpegReader (BGR24 @ 640×360, 5 FPS)
    → MotionGate (MOG2, 500px threshold, 10-frame warmup)
    → YOLOv8n ONNX (COCO filtered to security classes)
    → ByteTracker (Kalman filter, track lifecycle: started/updated/ended)
    → IdentityEnrichment (InsightFace ArcFace, 30s cache)
    → HumanVerifier (tiered: YOLO ≥0.90 → face → MediaPipe → floor 0.55)
    → WebSocketPublisher → Node.js → PostgreSQL
```

---

## <a id="quick-start"></a>⚡ Quick Start

### One-Line Install (Recommended)
```bash
curl -fsSL https://raw.githubusercontent.com/barunTayenjam/casa-visitor-guardian/main/scripts/install.sh | bash
```
Auto-detects LAN IP, generates secrets, builds containers, verifies health. Add cameras from the Web UI.

### Docker Compose (Manual)
```bash
git clone https://github.com/barunTayenjam/casa-visitor-guardian.git
cd casa-visitor-guardian
cp .env.example .env   # Edit with your secrets
docker compose up -d --build
```

### Local Development
```bash
# Backend (API + static files + Socket.io)
cd server && npm install && npm run dev    # :9753

# Frontend (Vite HMR, proxies to :9753)
cd frontend && npm install && npm run dev  # :5173
```

### Default Credentials
| Role | Username | Password |
|------|----------|----------|
| Admin | `admin` | `admin123` *(change on first login)* |

---

## 📸 Screenshots

<p align="center">
  <img src="https://raw.githubusercontent.com/barunTayenjam/casa-visitor-guardian/main/docs/assets/dashboard.png" alt="Dashboard" width="45%" />
  <img src="https://raw.githubusercontent.com/barunTayenjam/casa-visitor-guardian/main/docs/assets/events.png" alt="Events" width="45%" />
</p>

<p align="center">
  <img src="https://raw.githubusercontent.com/barunTayenjam/casa-visitor-guardian/main/docs/assets/analytics.png" alt="Analytics" width="45%" />
  <img src="https://raw.githubusercontent.com/barunTayenjam/casa-visitor-guardian/main/docs/assets/ask.png" alt="AI Chat" width="45%" />
</p>

---

## <a id="docs"></a>📚 Documentation

| Document | Description |
|----------|-------------|
| [`DOCS.md`](./DOCS.md) | Complete documentation index |
| [`PRODUCT.md`](./PRODUCT.md) | Product vision, users, capabilities |
| [`API-SOURCE-OF-TRUTH.md`](./API-SOURCE-OF-TRUTH.md) | All API endpoints |
| [`BACKEND.md`](./BACKEND.md) | Express API, routes, services |
| [`FRONTEND.md`](./FRONTEND.md) | React app, pages, services |
| [`DATABASE.md`](./DATABASE.md) | Schema, migrations, queries |
| [`OPENCV-SERVICE.md`](./OPENCV-SERVICE.md) | Python detection pipeline |
| [`SECURITY.md`](./SECURITY.md) | Auth, rate limiting, headers |
| [`CONTRIBUTING.md`](./CONTRIBUTING.md) | Dev workflow, conventions |

---

## 🛠 Tech Stack

| Layer | Technology | Version |
|-------|------------|---------|
| **Frontend** | React + TypeScript + Vite + TailwindCSS + Radix UI | 18 / 5 / 3.4 / 1.1 |
| **Backend** | Express + TypeScript + TypeORM + Socket.io | 5 / 5.5 / 0.3 / 4.7 |
| **OpenCV Service** | Flask + OpenCV + ONNX Runtime + InsightFace | 3.0 / 4.8 / 1.16 / 0.7 |
| **RTSP Proxy** | go2rtc | 1.9+ |
| **Database** | PostgreSQL | 15+ |
| **Cache** | In-memory (Redis optional) | — |
| **Container** | Docker + Docker Compose | 24+ / 2.24+ |

---

## 📊 System Requirements

| Resource | Minimum | Recommended |
|----------|---------|-------------|
| **RAM** | 2 GB | 4 GB+ |
| **CPU** | 2 cores (ARM64/x64) | 4 cores |
| **Storage** | 10 GB | 50 GB+ (for retention) |
| **Network** | LAN | Gigabit LAN + VPN/Tailscale |

---

## 🔧 Configuration

Key `.env` variables (auto-generated by install script):

```bash
# Database
POSTGRES_PASSWORD=<secure-random>
DB_HOST=postgres
DB_PORT=5432
DB_NAME=sentryvision
DB_USER=sentryvision

# Auth
JWT_ACCESS_SECRET=<secure-random>
JWT_REFRESH_SECRET=<secure-random>
TOTP_SECRET=<secure-random>

# Services
OPENCV_SERVICE_URL=http://opencv:8084
GO2RTC_PUBLIC_URL=http://go2rtc:1984
REDIS_DISABLED=true

# Detection
PERSON_MIN_CONFIDENCE=0.45
DEFAULT_FPS=2
OPENCV_CPU_LIMIT=6.0

# Camera RTSP (set via Web UI or cameras.json)
CAM1_RTSP_URL=rtsp://user:pass@ip:554/stream1
CAM2_RTSP_URL=rtsp://user:pass@ip:554/stream1
```

---

## 🧪 Quality Gates

```bash
# Frontend
npm run lint          # ESLint
npm run typecheck     # TypeScript strict check
npm run test          # Jest (coverage)

# Backend
cd server && npm run lint:server
cd server && npm run build
cd server && npm run test:server

# Full CI (runs on every PR)
docker compose -f docker-compose.ci.yml up --build --abort-on-container-exit
```

---

## 🤝 Contributing

We welcome PRs from the self-hosted community. See [`CONTRIBUTING.md`](./CONTRIBUTING.md) for:

- Code conventions (TypeScript, file naming, imports)
- Branch/PR workflow
- Testing requirements
- Architecture rules (detection in Python only, etc.)

---

## 📄 License

MIT License — see [`LICENSE`](./LICENSE) for details.

---

## 🙏 Acknowledgments

Built on the shoulders of giants:
- [YOLOv8](https://github.com/ultralytics/ultralytics) — Ultralytics
- [InsightFace](https://github.com/deepinsight/insightface) — DeepInsight
- [go2rtc](https://github.com/AlexxIT/go2rtc) — AlexxIT
- [ByteTrack](https://github.com/ifzhang/ByteTrack) — IFZHANG
- [shadcn/ui](https://ui.shadcn.com/) — shadcn
- [Radix UI](https://www.radix-ui.com/) — Radix

---

<p align="center">
  <strong>Star this repo if SentryVision secures your home.</strong><br />
  <em>Made with ❤️ for the self-hosted community.</em>
</p>