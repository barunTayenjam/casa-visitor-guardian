# Technology Stack

**Analysis Date:** 2026-08-13

## Languages

**Primary:**
- TypeScript 5.9.3 - Backend server
- TypeScript 5.5.3 - Frontend
- Python 3.11 - OpenCV detection service

## Runtime

**Environment:**
- Node.js (via Docker) - Backend/Frontend
- Python 3.11 - OpenCV service

**Package Manager:**
- npm - All services
- Lockfile: present (`package-lock.json`)

## Frameworks

**Core:**
- Express 5.2.1 - Backend server
- React 18.3.1 - Frontend (Vite)
- Flask 3.0.0 - OpenCV service

**Testing:**
- Jest - Frontend and Backend
- Pytest (indicated by `pytest.ini`) - OpenCV service

**Build/Dev:**
- Vite 5.4.21 - Frontend
- Docker Compose - Orchestration
- tsc - TypeScript compilation

## Key Dependencies

**Critical:**
- socket.io - Backend/Frontend realtime communication
- typeorm - Backend ORM
- insightface - OpenCV face recognition
- puppeteer - Frontend/Testing
- go2rtc - RTSP to WebRTC bridge

**Infrastructure:**
- PostgreSQL - Main database
- Redis (indicated by `ioredis`) - Backend caching

## Configuration

**Environment:**
- `.env` and `docker-compose.yml` environment variables

**Build:**
- `package.json` scripts, `tsconfig.json`

## Platform Requirements

**Development:**
- Docker, Node.js, Python 3.11

**Production:**
- Docker/Docker Compose

---

*Stack analysis: 2026-08-13*
