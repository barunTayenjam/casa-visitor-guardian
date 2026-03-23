# SentryVision Technology Stack

## Overview

SentryVision is a home security system built with a modern full-stack architecture using TypeScript for both frontend and backend, Python for computer vision, and PostgreSQL for data persistence.

## Core Technologies

### Frontend

**Framework & Runtime**
- React 18.3.1 - UI framework with hooks and concurrent features
- TypeScript 5.5.3 - Type-safe JavaScript (strict mode disabled)
- Vite 5.4.21 - Fast build tool and dev server
- Node.js - JavaScript runtime

**Build Tools**
- @vitejs/plugin-react-swc 3.5.0 - Fast React refresh with SWC compiler
- TypeScript 5.5.3 - Static type checking
- ESLint 9.9.0 - Linting and code quality
- PostCSS 8.4.47 - CSS processing
- TailwindCSS 3.4.18 - Utility-first CSS framework
- Autoprefixer 10.4.20 - CSS vendor prefixes

**UI Component Libraries**
- Radix UI (shadcn/ui) - Headless UI primitives
  - @radix-ui/react-* (35+ component packages)
  - Unstyled, accessible components
  - Dialog, dropdown, tabs, accordion, toast, etc.
- Framer Motion 12.23.25 - Animation library
- Lucide React 0.556.0 - Icon library
- Sonner 1.7.4 - Toast notifications

**Data & State Management**
- @tanstack/react-query 5.90.12 - Server state management
- React Router DOM 6.30.2 - Client-side routing
- React Hook Form 7.68.0 - Form handling
- Zod 3.23.8 - Schema validation
- @hookform/resolvers 5.2.2 - Form validation integration
- date-fns 3.6.0 - Date manipulation
- Recharts 2.15.4 - Charting library

**Styling**
- TailwindCSS 3.4.18 - Utility-first CSS
- Tailwind Merge 2.6.0 - Tailwind class merging
- Tailwind CSS Animate 1.0.7 - Tailwind animations
- Class Variance Authority 0.7.1 - Component variant management
- clsx 2.1.1 - Conditional className utility
- next-themes 0.4.6 - Dark mode support

**Real-time Communication**
- Socket.io Client 4.8.1 - WebSocket client for live updates

**Utilities**
- cmdk 1.0.0 - Command palette component
- embla-carousel-react 8.3.0 - Carousel component
- react-day-picker 8.10.1 - Date picker
- react-resizable-panels 2.1.9 - Resizable layouts
- vaul 0.9.9 - Drawer/sheet component
- input-otp 1.2.4 - OTP input component
- qrcode 1.5.4 - QR code generation

**Testing**
- Jest 30.2.0 - Testing framework
- ts-jest 29.4.5 - TypeScript preprocessor
- jsdom 27.4.0 - DOM simulation
- Puppeteer 24.34.0 - E2E testing

### Backend

**Framework & Runtime**
- Node.js - JavaScript runtime
- Express 5.2.1 - Web application framework
- TypeScript 5.9.3 - Type-safe JavaScript (strict mode disabled)
- tsx 4.20.3 - TypeScript execution dev tool
- Nodemon 3.1.10 - Auto-restart on file changes

**Database & ORM**
- TypeORM 0.3.28 - Object-relational mapping
- pg (node-postgres) 8.16.3 - PostgreSQL client
- PostgreSQL 15+ - Relational database (Docker container)
- sqlite3 5.1.7 / sqlite 5.1.1 - SQLite for local caching
- better-sqlite3 12.5.0 - Synchronous SQLite

**Authentication & Security**
- jsonwebtoken 9.0.3 - JWT token generation/validation
- bcrypt 6.0.0 - Password hashing
- speakeasy 2.0.0 - TOTP MFA (Google Authenticator)
- Helmet 8.1.0 - Security headers
- express-rate-limit 8.2.1 - Rate limiting
- CORS 2.8.5 - Cross-origin resource sharing

**Real-time Communication**
- Socket.io 4.7.2 - WebSocket server for live streaming
- ws 8.18.3 - WebSocket library

**Video Processing**
- ffmpeg-static 5.3.0 - FFmpeg binary for RTSP stream processing
- FLV format - Video streaming format

**File Handling**
- Multer 2.0.2 - Multipart form data (file uploads)
- Sharp 0.34.5 - Image processing

**Job Scheduling**
- node-cron 4.2.1 - Cron job scheduler

**Caching**
- Redis 5.10.0 - Redis client for caching

**Notifications**
- nodemailer 7.0.11 - Email notifications
- web-push 3.6.7 - Web Push notifications

**Validation**
- Zod 3.25.76 - Schema validation
- class-validator 0.14.3 - Decorator-based validation
- express-validator 7.3.1 - Request validation middleware
- class-transformer 0.5.1 - Object transformation

**HTTP Client**
- axios 1.13.2 - HTTP client (for OpenCV service communication)
- node-fetch 3.3.2 - Fetch API

**Utilities**
- glob 13.0.0 - File pattern matching
- dotenv 17.2.3 - Environment variables
- debug 4.4.3 - Debug logging

**Testing**
- Jest 30.2.0 - Testing framework
- ts-jest 29.4.5 - TypeScript preprocessor
- Supertest 7.1.4 - HTTP endpoint testing

### Python OpenCV Service

**Framework**
- Flask 3.0.0 - Web framework
- Flask-CORS 4.0.0 - CORS support
- Flask-Limiter 3.5.0 - Rate limiting

**Computer Vision**
- opencv-contrib-python-headless 4.8.0+ - OpenCV with_contrib modules (headless)
- numpy 1.24.0+ - Numerical computing
- face-recognition 1.3.0+ - Face recognition library (dlib-based)
- Pillow 10.0.0+ - Image processing

**Database**
- psycopg2-binary 2.9.9+ - PostgreSQL adapter
- redis 5.0.0+ - Redis client

## DevOps & Infrastructure

### Containerization
- Docker & Docker Compose - Multi-container orchestration
- 5 services: frontend, backend, postgres, redis, opencv

### Database
- PostgreSQL 15 - Primary database
- Redis 7 Alpine - Caching and session storage

### Development Tools
- Git - Version control
- concurrently 9.1.2 - Run multiple npm scripts simultaneously
- wait-on 9.0.3 - Wait for services to be ready

## Configuration Files

**Frontend**
- `frontend/package.json` - Dependencies and scripts
- `frontend/tsconfig.json` - TypeScript configuration (ESNext, strict: false)
- `frontend/vite.config.ts` - Vite build configuration
- `frontend/tailwind.config.js` - TailwindCSS configuration
- `frontend/components.json` - shadcn/ui component configuration

**Backend**
- `server/package.json` - Dependencies and scripts
- `server/tsconfig.json` - TypeScript configuration (ES2022, strict: false)
- `server/cameras.json` - Camera configuration (RTSP URLs, zones, objects)

**Database**
- `database/package.json` - Migration dependencies
- `database/migrations/` - SQL migration files (14 migrations)

**Docker**
- `docker-compose.yml` - Multi-service orchestration
- Resource limits for low-spec systems (1 core, 2GB RAM)

## Runtime Configuration

**Frontend Environment Variables**
- `VITE_BACKEND_URL` - Backend API URL (default: http://localhost:9753)

**Backend Environment Variables**
- `NODE_ENV` - Environment (development/production)
- `PORT` - Server port (9753)
- `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` - PostgreSQL config
- `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` - JWT signing secrets
- `OPENCV_SERVICE_URL` - OpenCV service URL (http://opencv:8084)
- `DETECTIONS_DIR` - Detection images directory
- `TZ` - Timezone (Asia/Kolkata)

**Resource Optimization Settings**
- `LOW_RESOURCE_MODE` - Enable low-resource optimizations
- `FFMPEG_THREADS` - FFmpeg thread count (default: 2)
- `DEFAULT_FPS` - Default FPS (default: 2)
- `DEFAULT_RESOLUTION` - Default resolution (default: 640x360)
- `NODE_OPTIONS` - Node.js memory limit

## Port Configuration

| Service | Port | Purpose |
|---------|------|---------|
| Frontend | 5173 | React dev server (Vite) |
| Backend | 9753 | Express API server |
| OpenCV | 8084 | Python Flask service |
| PostgreSQL | 5432 | Database |
| Redis | 6379 | Cache/sessions |

## Build & Runtime

**Frontend Build**
- Vite dev server with HMR
- Production builds with Vite bundler
- Code splitting and lazy loading
- Proxy configuration for API routes

**Backend Build**
- TypeScript compilation to `dist/`
- ES modules (type: module)
- Nodemon for development with hot reload

**Python Service**
- Direct execution without build step
- Development mode with Flask debug enabled

## Testing Stack

**Frontend Tests**
- Jest with React Testing Library
- jsdom for DOM simulation
- Coverage reporting

**Backend Tests**
- Jest with Supertest
- Isolated test database schema
- 80% coverage threshold

## Dependencies by Layer

**Frontend Dependencies: 85+ packages**
- UI components: 35+ Radix UI packages
- State management: React Query, React Router
- Forms: React Hook Form, Zod
- Styling: TailwindCSS, Framer Motion

**Backend Dependencies: 50+ packages**
- Web: Express, Socket.io
- Database: TypeORM, pg
- Auth: JWT, bcrypt, speakeasy
- Video: FFmpeg, Sharp

**Python Dependencies: 9 packages**
- Web: Flask
- CV: OpenCV, face-recognition
- Data: PostgreSQL, Redis clients

## Version Pinning Strategy

- Most dependencies use exact versions (^)
- Root package.json manages workspace scripts
- Individual package.json for each service
- Docker ensures consistent runtime environments

## Technology Decisions

**Why React + TypeScript:**
- Type safety reduces bugs
- Large ecosystem and community
- Excellent developer experience with Vite

**Why Express + TypeORM:**
- Lightweight, flexible framework
- TypeORM provides good TypeScript integration
- Mature ecosystem with PostgreSQL support

**Why Flask + OpenCV:**
- OpenCV has excellent Python bindings
- Flask is lightweight for HTTP API
- Face recognition libraries work best in Python

**Why PostgreSQL:**
- ACID compliance for security data
- JSONB support for flexible detection data
- Excellent performance for event queries

**Why Redis:**
- Fast in-memory caching
- Session storage for authentication
- Pub/sub for real-time features

**Why Socket.io:**
- Automatic fallback (WebSocket → polling)
- Room-based messaging for cameras
- Reconnection handling

**Why Docker:**
- Consistent development environment
- Easy deployment
- Resource isolation and limits

## System Timezone

- **Timezone:** Asia/Kolkata (IST, UTC+5:30)
- All timestamps stored in IST
- Day/night detection modes based on IST time
