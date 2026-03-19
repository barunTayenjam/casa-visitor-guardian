# External Integrations

## Databases
### PostgreSQL
- **Primary database** for all persistent data
- **Connection**: TypeORM ORM with PostgreSQL driver
- **Host**: `postgres` (Docker) or `localhost` (development)
- **Port**: 5432
- **Database name**: `sentryvision`
- **Username**: `sentryvision`
- **Password**: Configured via environment variables
- **Schema**: 17 tables including users, events, visitors, batch_jobs, review_segments
- **Connection pooling**: Built into TypeORM/pg
- **Migrations**: SQL-based migration files in `database/migrations/`
- **Access patterns**:
  - TypeORM repositories for standard CRUD operations
  - Raw SQL queries for complex analytics and reporting
  - Direct access via `AppDataSource` in backend services
- **Files**:
  - `server/src/database.js` - Connection setup
  - `server/src/models/` - TypeORM entities
  - `database/migrations/` - SQL migration files (001-008)
  - `server/src/services/` - Service layer using repositories

### Redis
- **In-memory store** for caching and session management
- **Connection**: node-redis client
- **Host**: `redis` (Docker) or `localhost` (development)
- **Port**: 6379
- **Usage**:
  - Session storage for JWT refresh tokens
  - Caching of frequent database queries
  - Rate limiting counters
  - Temporary detection results
- **Services**:
  - `server/src/services/redisCache.ts` - Wrapper for Redis operations
  - `server/src/middleware/rateLimit.ts` - Uses Redis for distributed rate limiting
  - `server/src/services/sessionManager.ts` - Manages user sessions
- **Configuration**:
  - Environment variables: `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD`
  - Connection pooling and retry logic

## Authentication & Authorization
### JWT (JSON Web Tokens)
- **Access tokens**: 15-minute expiry
- **Refresh tokens**: 7-day expiry with rotation
- **Storage**: HttpOnly cookies + Redis for refresh token tracking
- **Signing secrets**: `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` (environment variables)
- **Algorithms**: HS256
- **Files**:
  - `server/src/services/authenticationService.ts` - Token generation and validation
  - `server/src/middleware/auth.ts` - Express middleware for route protection
  - `server/src/routes/auth.ts` - Auth endpoints (login, refresh, logout, MFA)
  - `server/src/models/UserSession.ts` - Session tracking in database

### TOTP (Time-Based One-Time Password) MFA
- **Library**: Speakeasy (`^2.0.0`)
- **Implementation**: Google Authenticator compatible
- **Setup**: QR code generation for initial enrollment
- **Verification**: 6-digit codes with time window validation
- **Backup codes**: Generated during setup for account recovery
- **Files**:
  - `server/src/services/totpService.ts` - TOTP generation and verification
  - `server/src/routes/auth.ts` - MFA setup and verification endpoints
  - `server/src/models/User.ts` - Fields for MFA secret and backup codes

### Role-Based Access Control (RBAC)
- **Roles**: admin (full access), user (standard), viewer (read-only)
- **Permissions**: Stored in `roles` table with granular permissions
- **Middleware**: `requireUser`, `requireAdmin`, `optionalAuth` in `server/src/middleware/auth.ts`
- **Database**: `roles` table defines role hierarchy and permissions
- **Files**:
  - `server/src/models/Role.ts` - Role entity definition
  - `server/src/middleware/auth.ts` - Role-based route protection
  - `database/migrations/` - Initial role and permission setup

## External APIs & Services
### OpenCV Computer Vision Service
- **Protocol**: HTTP REST API
- **Host**: `opencv` (Docker) or `localhost` (development)
- **Port**: 8084
- **Framework**: Flask (Python)
- **Endpoints**:
  - `POST /detect/motion` - Motion detection on frames
  - `POST /detect/faces` - Face recognition and detection
  - `POST /detect/objects` - YOLO object detection
  - `GET /health` - Service health check
  - `POST /process/frame` - Full processing pipeline
- **Communication**:
  - `server/src/services/opencvMicroserviceClient.ts` - Wrapper for HTTP calls
  - Timeout handling and retry logic
  - Circuit breaker pattern for fault tolerance
- **Data exchange**: JSON with base64-encoded images or multipart/form-data
- **Security**: Internal network only (not exposed externally)

### FFmpeg (Video Processing)
- **Package**: `ffmpeg-static` (static builds)
- **Usage**: RTSP stream handling and processing
- **Functions**:
  - Stream capture from RTSP sources
  - Frame extraction for analysis
  - Video encoding for recording
  - Hardware acceleration where available
- **Integration**:
  - `server/src/streams/rtspManager.ts` - Main stream orchestration
  - `server/src/detection/optimizedMotionDetection.ts` - Frame processing
  - `server/src/detection/motionTriggeredDetection.ts` - Object/face triggering
- **Configuration**: Resolution, FPS, and codec settings per camera

### Email Service (SMTP)
- **Library**: Nodemailer (`^7.0.11`)
- **Purpose**: Alerts and notifications
- **Configuration**:
  - SMTP host, port, username, password via environment variables
  - TLS/SSL support
  - Template-based email content
- **Usage**:
  - Motion detection alerts
  - System maintenance notifications
  - Security alerts (failed logins, etc.)
  - Weekly/monthly activity reports
- **Files**:
  - `server/src/services/notificationService.ts` - Email sending abstraction
  - `server/src/services/visitorReportGenerator.ts` - Report generation
  - `server/src/services/visitorReportScheduler.ts` - Scheduled reports

### Web Push Notifications
- **Library**: web-push (`^3.6.7`)
- **Purpose**: Browser-based push notifications
- **VAPID keys**: Generated for application identification
- **Subscription management**: Client-side subscription storage
- **Files**:
  - `server/src/services/notificationService.ts` - Push notification sending
  - Frontend: Service worker and subscription management
  - `server/src/routes/notificationRoutes.ts` - API endpoints for subscriptions

### MQTT (Message Queuing Telemetry Transport)
- **Library**: mqtt (`implicit in mqttService`)
- **Purpose**: IoT device communication and lightweight messaging
- **Broker**: Configurable via environment variables
- **Usage**:
  - Integration with smart home devices
  - External trigger for recording modes
  - Status reporting to home automation systems
- **Files**:
  - `server/src/services/mqttService.ts` - MQTT client wrapper
  - `server/src/index.ts` - Service initialization
  - Topics: `sentryvision/#` for all system communications

## File System & Storage
### Local Storage
- **Structure**: Organized by year/month/event type
  - `data/detections/YYYY-MM/events/motion/` - Motion event images
  - `data/detections/YYYY-MM/events/face/` - Face detection images
  - `data/detections/YYYY-MM/snapshots/` - Manual snapshots
  - `public/snapshots/` - Web-accessible snapshots
- **Organization**: 
  - Year-month directories for easy archival and cleanup
  - Separate directories by event type for organization
  - Consistent naming: `{timestamp}_{cameraId}_{eventType}.jpg`
- **Cleanup**: Automated based on retention policies
- **Files**:
  - `server/src/config/index.js` - Path resolution utilities
  - `server/src/services/storageStatsService.ts` - Storage monitoring
  - `server/src/services/retentionPolicyService.ts` - Retention rule enforcement
  - `server/src/services/automatedCleanupService.ts` - File deletion jobs

### Temporary Storage
- **Location**: `server/src/data/` (in development) or container volumes
- **Purpose**: 
  - Processing intermediates
  - Upload handling (via Multer memory storage)
  - Batch processing temporary files
- **Cleanup**: Automatic after processing completion
- **Files**:
  - `server/src/utils/asyncFileOperations.ts` - Safe file operations
  - `server/src/utils/fileHash.ts` - Content-based file identification
  - Multer configuration in `server/src/routes/index.ts`

## Monitoring & Observability
### Health Checks
- **Liveness probe**: `GET /health` - Basic service availability
- **Readiness probe**: `GET /api/streams/health` - Stream processing status
- **OpenCV service**: `GET http://opencv:8084/health` - Computer vision service
- **Database**: Connection validation on startup
- **Redis**: Ping validation on startup

### Metrics Collection
- **Internal metrics**:
  - Detection performance and latency
  - Stream health and frame rates
  - Database query performance
  - Cache hit/miss ratios
- **Collection points**:
  - `server/src/detection/performanceMonitor.ts` - Detection timing
  - `server/src/streams/streamHealthMonitor.ts` - Stream statistics
  - `server/src/services/enhancedAnalyticsService.ts` - System analytics
- **Export**: Internal consumption for dashboards and alerting

### Logging
- **Library**: Winston-like custom logger
- **Files**:
  - `server/src/utils/logger.ts` - Centralized logging service
  - `server/src/utils/auditLogger.ts` - Security audit trail
- **Levels**: error, warn, info, debug
- **Output**: Console and file-based (in development)
- **Formatting**: JSON for production, human-readable for development
- **Rotation**: Size-based log rotation in production

## Development & Testing Tools
### Testing Frameworks
- **Jest**: Primary testing framework for both frontend and backend
  - Version: `^30.2.0`
  - Configuration: `jest.config.js` (root) and test-specific setups
  - Features: Mocking, coverage reporting, watch mode
- **React Testing Library**: Frontend component testing
  - Used with Jest for UI component tests
  - Files: `frontend/src/**/*.test.ts` and `*.test.tsx`
- **Supertest**: Backend API testing
  - Version: `^7.1.4`
  - HTTP assertion library for Express applications
  - Files: `server/src/**/*.test.ts`

### Development Tools
- **ESLint**: Code linting
  - Version: `^9.9.0`
  - Plugins: eslint-plugin-react-hooks, eslint-plugin-react-refresh
  - Configuration: Inherited from workspace settings
- **TypeScript Compiler**: Type checking
  - `tsc --noEmit` for type validation
  - Strict mode enabled project-wide
- **Prettier**: Code formatting (via ESLint integration)
- **Nodemon**: Backend development server with auto-restart
- **Vite**: Frontend development server with HMR
- **TSX**: Direct TypeScript execution for scripts

## Communication Protocols
### WebSocket (Socket.IO)
- **Purpose**: Real-time bidirectional communication
- **Version**: `^4.7.2` (server), `^4.8.1` (client)
- **Connection**: Upgraded from HTTP with heartbeat mechanism
- **Rooms**: Camera-specific (`camera-{cameraId}-{role}`)
- **Events**:
  - `requestStream` / `stopStream` - Client stream control
  - `frame` - Video frame delivery (binary data)
  - `motionDetected` - Motion event notifications
  - `objectDetected` - Object detection results
  - `faceDetected` - Face recognition results
  - `streamHealth` - Stream status updates
  - `notification` - System alerts and messages
- **Middleware**: Authentication verification on connection
- **Scaling**: Sticky sessions or Redis adapter for horizontal scaling

### HTTP/REST APIs
- **Backend**: Express.js serving JSON APIs
- **Frontend**: Axios HTTP client with interceptors
- **OpenCV Service**: Flask serving JSON APIs
- **Authentication**: Bearer tokens in Authorization header
- **Versioning**: Path-based (`/api/v1/`) though currently using `/api/`
- **Documentation**: Inline JSDoc and OpenAPI considerations
- **Validation**: Zod schemas for request/response validation
- **Error handling**: Consistent error response format
- **Rate limiting**: Per-IP and per-user limits with Redis backing

### File Uploads
- **Library**: Multer with memory storage
- **Limits**: 10MB file size limit
- **Processing**: Streams to avoid memory buildup
- **Validation**: File type and content validation
- **Storage**: Immediate processing or temporary storage
- **Endpoints**: Avatar uploads, snapshot exports, etc.

## Security Integrations
### Helmet.js
- **Package**: `helmet` (`^8.1.0`)
- **Purpose**: HTTP header security
- **Features**:
  - Content Security Policy (CSP)
  - X-Frame-Options protection
  - XSS protection
  - MIME type sniffing prevention
  - HSTS for HTTPS enforcement
- **Configuration**: Customized for application requirements
- **Location**: Applied as Express middleware in `server/src/index.ts`

### CORS (Cross-Origin Resource Sharing)
- **Package**: `cors` (`^2.8.5`)
- **Purpose**: Controlled cross-origin access
- **Configuration**: 
  - Specific origins: localhost development domains
  - Credentials: true for cookie-based authentication
  - Methods: GET, POST, PUT, DELETE, OPTIONS
  - Headers: Content-Type, Authorization, etc.
- **Security**: Whitelist approach rather than wildcard
- **Location**: Applied as Express middleware in `server/src/index.ts`

### Rate Limiting
- **Package**: `express-rate-limit` (`^8.2.1`)
- **Backend**: Redis-backed distributed rate limiting
- **Frontend**: Additional client-side debouncing
- **Default**: 100 requests per 15 minutes per IP
- **Stricter limits**:
  - Authentication endpoints: 5 attempts per 15 minutes
  - Stream endpoints: Higher limits for legitimate use
  - Upload endpoints: Bandwidth-based limiting
- **Custom limits**: Per-route configuration in `server/src/middleware/rateLimit.ts`
- **Headers**: X-RateLimit-* headers for client awareness

### Encryption & Hashing
- **Passwords**: Bcrypt (`^6.0.0`) with salt rounds
- **Tokens**: JSONWebToken (`^9.0.3`) with secret keys
- **Files**: AES encryption for sensitive file data
- **Database connection**: SSL/TLS for production connections
- **Environment variables**: Encrypted secrets in deployment
- **Files**:
  - `server/src/utils/encryption.ts` - Symmetric encryption utilities
  - `server/src/utils/passwordSecurity.ts` - Password hashing and validation
  - `server/src/services/credentialManager.ts` - Secure credential storage

## Data Flow & Integration Points
### Detection Pipeline
1. **RTSP Stream**: FFmpeg captures frames from camera
2. **Motion Detection**: OpenCV service analyzes frames for motion
3. **Event Trigger**: Motion detected -> HTTP request to OpenCV service
4. **Object Detection**: YOLO model identifies objects in frame
5. **Face Recognition**: Face encodings compared against known faces
6. **Result Aggregation**: Detection results normalized and stored
7. **Alert Generation**: Notifications sent based on rules
8. **Storage**: Images and metadata saved to filesystem/database
9. **Real-time Updates**: Socket.IO emits events to connected clients

### User Interaction Flow
1. **Frontend**: React application loads via Vite dev server
2. **API Calls**: Axios requests proxied to backend via Vite config
3. **Authentication**: JWT validation on protected routes
4. **Data Fetching**: React Query manages server state caching
5. **Real-time**: Socket.IO connection for live updates
6. **UI Updates**: React components re-render with new data
7. **User Actions**: Form submissions trigger API calls
8. **Optimistic Updates**: UI updates before server confirmation where appropriate

### Background Processing
1. **Scheduled Jobs**: Node Cron triggers maintenance tasks
2. **Batch Processing**: Asynchronous job queue for heavy operations
3. **Cleanup Services**: Automated deletion based on retention policies
4. **Analytics Aggregation**: Periodic computation of statistics
5. **Report Generation**: Scheduled creation of user reports
6. **Health Monitoring**: Continuous checking of service status

## Configuration Management
### Environment Variables
- **Backend**: `.env` file with defaults in `.env.example`
- **Frontend**: `VITE_*` prefixed variables exposed to React
- **Docker**: Environment variables defined in `docker-compose.yml`
- **OpenCV Service**: Environment-specific configuration
- **Validation**: Required variables checked on startup

### Configuration Files
- **cameras.json**: Camera definitions, RTSP URLs, zones, and detection settings
- **detectionConfig.ts**: Detection algorithm parameters and tuning
- **tsconfig.json**: TypeScript compiler options per service
- **jest.config.js**: Test configuration and setup
- **tailwind.config.ts**: Styling system customization
- **components.json**: shadcn/ui component configuration

## Third-Party Services (Potential/Future)
### Cloud Storage
- **AWS S3**: Planned for scalable video storage
- **Google Cloud Storage**: Alternative for media assets
- **Azure Blob Storage**: Enterprise storage option

### Monitoring & Analytics
- **Prometheus**: Metrics collection and alerting
- **Grafana**: Dashboard visualization
- **ELK Stack**: Log aggregation and analysis
- **Datadog**: Application performance monitoring

### Machine Learning
- **TensorFlow.js**: Potential for browser-based ML enhancements
- **PyTorch**: Advanced model training capabilities
- **ONNX**: Model interchange format for optimization

### Communication
- **Twilio**: SMS notifications for critical alerts
- **SendGrid**: Enhanced email delivery and tracking
- **Firebase Cloud Messaging**: Cross-platform push notifications

## Integration Patterns
### Service Layer Abstraction
- **Pattern**: All external services accessed through service interfaces
- **Benefits**: Easy mocking for testing, swap implementations
- **Examples**:
  - `opencvMicroserviceClient.ts` wraps OpenCV HTTP calls
  - `redisCache.ts` abstracts Redis operations
  - `notificationService.ts` combines email and push notifications
  - `mqttService.ts` encapsulates MQTT connectivity

### Dependency Injection
- **Pattern**: Services receive dependencies via constructor parameters
- **Framework**: Manual DI (not using a DI container)
- **Benefits**: Testability, loose coupling, clear dependencies
- **Examples**:
  - Services receive repositories, clients, and configuration
  - Circular dependencies avoided through careful design

### Event-Driven Architecture
- **Pattern**: Internal communication via event bus
- **Implementation**: Custom event emitter in `server/src/events/eventBus.ts`
- **Usage**: Decoupling of detection results from processing logic
- **Benefits**: Scalability, flexibility, easier extension

### Circuit Breaker Pattern
- **Pattern**: Fault tolerance for external service calls
- **Implementation**: Custom circuit breaker in `server/src/services/circuitBreaker.ts`
- **Usage**: Protects against cascading failures
- **Benefits**: System resilience, graceful degradation

### Retry Logic with Exponential Backoff
- **Pattern**: Transient failure handling
- **Implementation**: Retry service in `server/src/services/retryService.ts`
- **Usage**: Network calls, database operations, external APIs
- **Benefits**: Improved reliability, handling of temporary issues

## Configuration and Deployment
### Docker Integration
- **Build**: Multi-stage Dockerfiles for each service
- **Orchestration**: docker-compose.yml defines service dependencies
- **Networking**: Internal Docker network for service communication
- **Volumes**: Persistent storage for database and file uploads
- **Environment**: Per-service environment variables
- **Health checks**: Container-level health monitoring

### Kubernetes Readiness
- **Design**: Stateless services where possible
- **Configuration**: Environment-driven configuration
- **Storage**: Externalized persistent volumes
- **Readiness probes**: HTTP endpoints for health checking
- **Scaling considerations**: Stateless frontend, scalable backend workers

## Known Integration Issues & Limitations
### Current Limitations
1. **OpenCV Service Coupling**: Direct HTTP calls create tight coupling
   - Mitigation: Service interface abstraction
   - Improvement: Message queue for async communication

2. **Redis Dependency**: Rate limiting and sessions require Redis
   - Mitigation: Fallback to in-memory stores (reduced functionality)
   - Improvement: Optional Redis with graceful degradation

3. **FFmpeg Static Builds**: Platform-specific binaries may have issues
   - Mitigation: Testing across target platforms
   - Improvement: Dynamic FFmpeg installation with fallbacks

4. **WebSocket Scaling**: Socket.io requires sticky sessions or Redis adapter
   - Current: Single instance deployment
   - Planned: Redis adapter for horizontal scaling

### Resolved Issues
1. **CORS Configuration**: Initially blocked frontend API calls
   - Fixed: Specific origin whitelisting with credentials support

2. **Authentication Token Refresh**: Token expiration caused logout loops
   - Fixed: Automatic refresh token rotation and silent refresh

3. **File Descriptor Leaks**: Video streams not properly closed
   - Fixed: Improved resource management in RTSP handling

4. **Database Connection Exhaustion**: Connection pool not properly sized
   - Fixed: Tuned pool settings and connection cleanup

## Future Integration Opportunities
### Enhanced Monitoring
- **OpenTelemetry**: Distributed tracing across services
- **Prometheus Metrics**: Standardized metrics exposition
- **Health Checks**: Liveness and readiness probes for orchestration

### Improved Security
- **HashiCorp Vault**: Secret management and dynamic credentials
- **AWS IAM Roles**: For cloud service integrations
- **OIDC/OAuth2**: Third-party authentication providers

### Performance Enhancements
- **CDN Integration**: Static asset delivery optimization
- **Database Read Replicas**: For analytics workloads
- **Message Queues**: Kafka/RabbitMQ for event streaming
- **Caching Layers**: Multi-level caching (local, Redis, CDN)

### Extended Functionality
- **Video Doorbell Integration**: SIP/RTP protocol support
- **Home Assistant**: Deep integration with popular home automation
- **ONVIF Compliance**: Standard protocol for IP camera communication
- **AI Model Marketplace**: Plug-and-play detection models