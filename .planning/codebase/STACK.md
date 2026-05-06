# Technology Stack

**Analysis Date:** 2026-05-05

## Languages

**Primary:**
- TypeScript - All services (frontend, backend, OpenCV configuration)
- Python - OpenCV detection service

**Secondary:**
- SQL - Database migrations and TypeORM

## Runtime

**Environment:**
- Node.js 24.x (server, CLI tools)
- Python 3.x (OpenCV service)

**Package Manager:**
- npm 10.x (Node.js services)
- pip (Python service)
- Lockfiles: `package-lock.json`, `package-lock.json`, `requirements.txt`

## Frameworks

**Frontend:**
- React 18.3.1 - UI framework with TypeScript strict mode
- Vite 5.4.21 - Build tool and dev server
- TailwindCSS 3.4.18 - Utility-first CSS framework
- Radix UI - Unstyled component primitives (shadcn/ui pattern)
- React Router 6.x - Client-side routing

**Backend:**
- Express 5.2.1 - Web application framework
- TypeORM 0.3.28 - Database ORM
- Socket.io 4.7.2 - Real-time bidirectional communication

**OpenCV Service:**
- Flask 3.0.0 - Python web framework
- OpenCV 4.8.0+ - Computer vision (native cv2)
- NumPy - Numerical computing

**Testing:**
- Jest 30.x - Test runner for both frontend and backend
- React Testing Library - Component testing
- Supertest 7.x - HTTP endpoint testing

**Build/Dev:**
- tsx 4.x - TypeScript execution
- nodemon 3.x - Development hot reload

## Key Dependencies

**Frontend:**
- `@tanstack/react-query` 5.x - Server state management
- `socket.io-client` 4.x - Real-time communication
- `recharts` 2.x - Analytics charting
- `react-hook-form` 7.x - Form handling with Zod validation
- `lucide-react` - Icon library
- `date-fns` - Date manipulation

**Backend:**
- `typeorm` 0.3.28 - Database ORM
- `pg` 8.x - PostgreSQL driver
- `socket.io` 4.7.2 - Real-time server
- `jsonwebtoken` 9.x - JWT authentication
- `bcrypt` 6.x - Password hashing
- `speakeasy` 2.x - TOTP MFA
- `axios` 1.x - HTTP client
- `ffmpeg-static` 5.x - Bundled FFmpeg binary
- `flite-ocr` - Image processing
- `redis` 5.x - Caching and sessions
- `helmet` 8.x - Security headers
- `express-rate-limit` 8.x - Rate limiting
- `zod` 3.x - Schema validation

**OpenCV Service:**
- `opencv-contrib-python-headless` 4.8.0+ - Computer vision
- `face-recognition` 1.3.0 - Face detection and recognition
- `Pillow` 10.x - Image processing
- `psycopg2-binary` 2.9.9 - PostgreSQL driver
- `redis` 5.x+ - Caching layer

**Database:**
- PostgreSQL 15+ - Primary relational database
- SQLite 5.x - Local fallback for testing

## Configuration

**Environment:**
- Environment variables via dotenv
- Docker Compose for orchestration
- `docker-compose.yml` defines all service configurations

**Build:**
- `frontend/vite.config.ts` - Vite build configuration
- `server/tsconfig.json` - TypeScript configuration (strict mode)
- `frontend/tsconfig.app.json` - Frontend TypeScript

**Camera Configuration:**
- `server/cameras.json` - RTSP camera configurations with zones

## Platform Requirements

**Development:**
- Node.js 24.x
- Python 3.x with pip
- FFmpeg (system binary or bundled)
- PostgreSQL 15+

**Production:**
- Docker and Docker Compose
- Minimum 2GB RAM recommended
- Persistent storage for events and detections

---

*Stack analysis: 2026-05-05*