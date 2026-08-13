---
mapped: 2026-08-13
focus: tech
---

# Technology Stack

> Generated from codebase analysis on 2026-08-13

## Languages & Runtimes

- **Node.js**: Primary runtime for `frontend` and `server`.
- **Python**: Primary runtime for `opencv-service` (detection, face recognition).
- **TypeScript**: Used for all `frontend` and `server` logic.
- **SQL**: Used for PostgreSQL database operations.

## Frameworks & Libraries

### Frontend
- **React 18**: Frontend UI framework.
- **Vite 5**: Build tool and dev server.
- **TailwindCSS**: CSS framework.
- **Radix UI / shadcn/ui**: UI primitives.
- **TanStack Query**: Data fetching/caching (`@tanstack/react-query`).
- **Socket.io-client**: Real-time communication.
- **Zod**: Validation.

### Backend
- **Express 5**: Backend API framework.
- **TypeORM**: ORM for PostgreSQL.
- **Socket.io**: Real-time server.
- **Axios**: HTTP client.
- **Sharp**: Image processing.

### OpenCV Service
- **Flask**: Python web framework.
- **OpenCV**: Object detection and frame processing.
- **InsightFace**: Face recognition.
- **ONNX Runtime**: Model inference.
- **NumPy**: Data processing.

## Build & Dev Tools

- **tsc (TypeScript Compiler)**: Backend type checking and compilation.
- **ESLint**: Linting for frontend/backend.
- **Jest / ts-jest**: Testing.
- **concurrently**: Running dev services.
- **wait-on**: Dependency checking during development.
- **tsx**: TypeScript execution tool.
- **nodemon**: Backend hot-reloading.

## Package Management

- **npm**: Package manager for frontend, server, and database projects.
- **pip**: Package manager for `opencv-service` via `requirements.txt`.

## Configuration

- **Environment Variables**: Managed via `.env` files.
- **Configuration Files**: `server/cameras.json`, `go2rtc.yaml`, `docker-compose.yml`, `frontend/vite.config.ts`.

## Infrastructure

- **Docker / Docker Compose**: Container orchestration.
- **PostgreSQL 15+**: Persistent storage.
- **go2rtc**: RTSP to WebRTC bridge.
- **FFmpeg**: RTSP streaming/processing support.
