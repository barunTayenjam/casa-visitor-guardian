# Technology Stack

## Languages
- **TypeScript** (Primary language for frontend and backend)
  - Strict mode enabled
  - All files use `.ts` or `.tsx` extension
  - Used in frontend (`frontend/src/**/*.tsx`), backend (`server/src/**/*.ts`)
- **Python** (OpenCV service for computer vision)
  - Used in `opencv-service/` directory
  - Version: 3.x+ (based on Flask 3.0.0)
- **JavaScript/Node.js** (Runtime environment)
  - Backend: Node.js with ES modules
  - Frontend: Vite with React 18
- **SQL** (Database queries and migrations)
  - PostgreSQL 15+
  - Migration files in `database/migrations/` (SQL format)

## Runtime & Platform
- **Node.js** (Backend runtime)
  - Version: Based on devDependencies showing `@types/node`: "^24.10.1"
  - ES Modules syntax (`import/export`)
- **Vite** (Frontend build tool and dev server)
  - Version: "^5.4.21"
  - Features: Fast HMR, optimized builds, proxy configuration
- **Flask** (Python OpenCV service)
  - Version: 3.0.0
  - Running on port 8084
- **PostgreSQL** (Database)
  - Version: 15+
  - Host: postgres (in Docker), localhost (local dev)
  - Port: 5432
- **Redis** (Caching and sessions)
  - Version: >=5.0.0
  - Port: 6379

## Frameworks & Libraries

### Frontend
- **React 18** (UI library)
  - Version: "^18.3.1"
  - Strict mode enabled
- **Vite** (Build tool)
  - Version: "^5.4.21"
- **TailwindCSS** (Styling)
  - Version: "^3.4.18"
  - Configured via `tailwind.config.ts`
- **shadcn/ui** (UI components)
  - Built on Radix UI primitives
  - Configured via `components.json`
- **Radix UI** (Primitive UI components)
  - Various versions (accordion, alert-dialog, etc.)
- **React Query** (State management)
  - Version: "^5.90.12"
  - For server state caching and synchronization
- **Socket.IO Client** (Real-time communication)
  - Version: "^4.8.1"
  - For live camera streams and notifications
- **Recharts** (Charts and data visualization)
  - Version: "^2.15.4"
  - Used in analytics components
- **React Hook Form** (Form handling)
  - Version: "^7.68.0"
  - With Zod validation via `@hookform/resolvers`
- **Zod** (Schema validation)
  - Version: "^3.23.8"
  - Used for form validation and API request validation
- **Framer Motion** (Animations)
  - Version: "^12.23.25"
- **Sonner** (Toast notifications)
  - Version: "^1.7.4"
- **Lodash** (Utility functions)
  - Implicit through various dependencies
- **Date-fns** (Date manipulation)
  - Version: "^3.6.0"
- **Axios** (HTTP client)
  - Version: "^1.13.2"
  - Used in backend services

### Backend
- **Node.js** (Runtime)
  - ES Modules syntax
- **Express** (Web framework)
  - Version: "^5.2.1"
  - REST API and middleware
- **Socket.IO** (Real-time server)
  - Version: "^4.7.2"
  - WebSocket connections for live streams
- **TypeORM** (ORM)
  - Version: "^0.3.28"
  - PostgreSQL integration with TypeScript entities
- **Helmet** (Security middleware)
  - Version: "^8.1.0"
  - Security headers (CSP, X-Frame-Options, etc.)
- **CORS** (Cross-origin resource sharing)
  - Version: "^2.8.5"
  - Configured for specific origins
- **Express Rate Limit** (Rate limiting)
  - Version: "^8.2.1"
  - Default: 100 requests per 15 minutes
- **Express Validator** (Request validation)
  - Version: "^7.3.1"
  - Based on validator.js
- **Bcrypt** (Password hashing)
  - Version: "^6.0.0"
  - For secure password storage
- **JSONWebToken** (Authentication)
  - Version: "^9.0.3"
  - JWT access and refresh tokens
- **Speakeasy** (TOTP/MFA)
  - Version: "^2.0.0"
  - Google Authenticator compatible MFA
- **Multer** (File upload handling)
  - Version: "^2.0.2"
  - For handling multipart/form-data
- **Sharp** (Image processing)
  - Version: "^0.34.5"
  - For image resizing and optimization
- **Node Cron** (Task scheduling)
  - Version: "^4.2.1"
  - For scheduled cleanup jobs
- **Axios** (HTTP client)
  - Version: "^1.13.2"
  - For communicating with OpenCV service
- **Node Fetch** (HTTP client)
  - Version: "^3.3.2"
  - Alternative HTTP client
- **Web Push** (Push notifications)
  - Version: "^3.6.7"
  - For browser push notifications
- **WS** (WebSocket library)
  - Version: "^8.18.3"
  - Low-level WebSocket support
- **Dotenv** (Environment variables)
  - Version: "^17.2.3"
  - Loading .env files

### OpenCV Service
- **Flask** (Web framework)
  - Version: 3.0.0
  - REST API for computer vision services
- **Flask-CORS** (CORS handling)
  - Version: 4.0.0
- **Flask-Limiter** (Rate limiting)
  - Version: 3.5.0
- **OpenCV** (Computer vision)
  - Version: >=4.8.0
  - Package: `opencv-contrib-python-headless`
- **NumPy** (Numerical computing)
  - Version: >=1.24.0
  - Used with OpenCV for matrix operations
- **Face Recognition** (Face recognition library)
  - Version: >=1.3.0
  - Built on dlib, provides face encodings
- **Pillow** (Image processing)
  - Version: >=10.0.0
  - Python Imaging Library fork
- **Psycopg2** (PostgreSQL adapter)
  - Version: >=2.9.9
  - For direct database connections
- **Redis** (Caching)
  - Version: >=5.0.0
  - Python Redis client

## Build Tools & Dev Dependencies
- **TypeScript Compiler** (tsc)
  - Version: "^5.5.3" (frontend), "^5.9.3" (backend)
  - Strict mode enabled
- **ESLint** (Linting)
  - Version: "^9.9.0"
  - With React and TypeScript plugins
- **Prettier** (Code formatting)
  - Configured via ESLint
- **Jest** (Testing framework)
  - Version: "^30.2.0"
  - With ts-jest for TypeScript
- **TS-Jest** (TypeScript preprocessor for Jest)
  - Version: "^29.4.5"
- **Supertest** (HTTP testing)
  - Version: "^7.1.4"
  - For testing Express APIs
- **Nodemon** (Development server)
  - Version: "^3.1.10"
  - For automatic backend restarts
- **TSX** (TypeScript execution)
  - Version: "^4.20.3"
  - For running TypeScript directly
- **Concurrently** (Process management)
  - Version: "^9.1.2"
  - For running multiple npm scripts
- **Wait-on** (Dependency waiting)
  - Version: "^9.0.3"
  - For waiting on services to be ready
- **Vite Plugin React SWC** (React compilation)
  - Version: "^3.5.0"
  - For fast React refresh

## Configuration Files
- **package.json** (Dependency management)
  - Root: Workspace scripts
  - Frontend: `frontend/package.json`
  - Backend: `server/package.json`
  - Database: `database/package.json`
- **tsconfig.json** (TypeScript configuration)
  - Backend: `server/tsconfig.json`
  - Frontend: Inherited from Vite
- **vite.config.ts** (Vite configuration)
  - Frontend dev server and build settings
  - Proxy configuration for API calls
- **tailwind.config.ts** (TailwindCSS configuration)
  - Custom colors, plugins, and settings
- **components.json** (shadcn/ui configuration)
  - UI component customization
- **.env.example** (Environment variables template)
  - Backend configuration template
- **docker-compose.yml** (Container orchestration)
  - Defines all services and their dependencies
- **cameras.json** (Camera configuration)
  - RTSP URLs, zones, and detection settings
- **jest.config.js** (Jest testing configuration)
  - Test setup and coverage settings

## External Services & Infrastructure
- **Docker** (Containerization)
  - Used for all services: frontend, backend, OpenCV, PostgreSQL, Redis
  - Multi-stage builds for optimization
- **Docker Compose** (Orchestration)
  - Single command deployment of all services
  - Volume mounts for persistent data
- **PostgreSQL** (Primary database)
  - Data persistence for users, events, visitors, etc.
  - Connection pooling via pg library
- **Redis** (In-memory store)
  - Session storage and caching
  - Pub/sub for real-time features
- **FFmpeg** (Video processing)
  - Static builds via `ffmpeg-static` package
  - Used for RTSP stream processing
  - Hardware acceleration where available

## Development Workflow Tools
- **Git** (Version control)
  - Hosted on GitHub
  - Standard GitHub flow
- **npm** (Package manager)
  - Workspace support for monorepo-like structure
- **VS Code** (Primary IDE)
  - Recommended extensions in documentation
- **ESLint + Prettier** (Code quality)
  - Automated formatting and linting
- **TypeScript** (Type safety)
  - Strict mode throughout codebase
- **Jest** (Testing)
  - Unit and integration tests
  - Coverage tracking

## Key Architectural Decisions
1. **Monorepo-like structure** with separate package.json files for different services
2. **Strict TypeScript** throughout for type safety
3. **Modular architecture** with clear separation of concerns
4. **Real-time capabilities** via Socket.IO for live streams
5. **Microservice approach** for OpenCV service (separate Python service)
6. **Database-first design** with TypeORM entities matching PostgreSQL schema
7. **Security-first** with JWT, MFA, helmet, rate limiting, and input validation
8. **Performance conscious** with caching, lazy loading, and optimized algorithms
9. **Extensible design** with clear interfaces for adding new detection types
10. **DevOps friendly** with Docker Compose for consistent environments