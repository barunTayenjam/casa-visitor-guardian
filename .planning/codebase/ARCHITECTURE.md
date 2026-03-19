# System Architecture

## Overview
SentryVision follows a microservices-inspired architecture with clearly separated concerns:
- **Frontend**: React/TypeScript SPA for user interface
- **Backend**: Node.js/Express API server with TypeScript
- **Database**: PostgreSQL for persistent storage
- **Computer Vision Service**: Python/OpenCV service for detection algorithms
- **Real-time Communication**: Socket.IO for live updates
- **Caching Layer**: Redis for sessions and performance optimization

## Architectural Patterns

### Layered Architecture
The system employs a layered approach with separation of concerns:

1. **Presentation Layer** (Frontend)
   - React components with TypeScript
   - State management via React Query and Context API
   - Real-time updates via Socket.IO client
   - UI library: TailwindCSS + shadcn/ui (Radix UI primitives)

2. **Application Layer** (Backend)
   - RESTful API controllers (Express routes)
   - Business logic services
   - Data access layer (TypeORM repositories)
   - Cross-cutting concerns (authentication, validation, logging)

3. **Domain Layer**
   - TypeORM entities representing business concepts
   - Enumerated types and domain-specific logic
   - Validation rules and business invariants

4. **Infrastructure Layer**
   - Database configuration and connection pooling
   - External service integrations (OpenCV, Redis, email)
   - File system operations and storage management
   - Third-party API clients

### Microservice-Inspired Design
While not a pure microservices architecture, the system employs microservice principles:

- **OpenCV Service**: Independent Python service handling computer vision tasks
  - Communicates via HTTP REST API
  - Can be scaled independently based on CV workload
  - Technology isolation (Python vs Node.js/TS stack)

- **Modular Backend**: Backend organized into distinct service modules
  - Authentication service
  - Detection service
  - Notification service
  - Review service
  - Timeline service
  - Each service encapsulates related functionality

### Event-Driven Architecture
- **Internal Event Bus**: Custom event emitter for decoupled communication
- **Socket.IO Events**: Real-time bidirectional communication with clients
- **Message Queuing Concepts**: Batch processing with job queues
- **WebSocket Rooms**: Camera-specific communication channels

### Pipeline Architecture
Detection processing follows a pipeline pattern:
```
RTSP Stream → Frame Extraction → Motion Detection → 
Object Detection → Face Recognition → Result Aggregation → 
Storage & Alerting → Real-time Updates
```

Each stage can be enabled/disabled or replaced independently.

## Key Architectural Decisions

### Technology Stack Choices
1. **TypeScript Throughout**: 
   - Frontend and backend use TypeScript for type safety
   - Shared type definitions where applicable
   - Strict mode enabled project-wide

2. **React 18 + Vite**:
   - Modern React features (concurrent rendering, automatic batching)
   - Fast development server with HMR
   - Optimized production builds

3. **Node.js/Express Backend**:
   - Mature, well-understood platform
   - Excellent npm ecosystem
   - Good performance for I/O-heavy applications

4. **PostgreSQL Choice**:
   - Relational data fits the domain well
   - JSONB columns for flexible detection results
   - Strong ACID guarantees for security-critical data
   - Excellent tooling and community support

5. **Python/OpenCV for CV**:
   - Industry-standard computer vision library
   - Mature algorithms and community support
   - Easy integration with ML models

6. **Socket.IO for Real-time**:
   - Fallback mechanisms for proxy/load balancer compatibility
   - Room-based scoping for efficient broadcasting
   - Binary data support for video frames

### Data Flow Architecture
#### Detection Pipeline
1. **Stream Ingestion**: RTSPManager captures frames via FFmpeg
2. **Motion Analysis**: OpenCV service detects motion using MOG2
3. **Trigger Evaluation**: Motion triggers object/face detection
4. **Object Detection**: YOLO model identifies objects of interest
5. **Face Processing**: Face detection and recognition pipeline
6. **Result Normalization**: Standardized format for storage
7. **Persistence**: Events saved to PostgreSQL and filesystem
8. **Notification**: Alerts generated based on rules
9. **Broadcast**: Real-time updates sent to connected clients

#### Request Handling Flow
1. **HTTP Request**: Received by Express router
2. **Middleware**: CORS, parsing, validation, authentication
3. **Route Handler**: Controller validates input and delegates
4. **Service Layer**: Business logic executed
5. **Data Access**: TypeORM repositories interact with database
6. **Response**: Formatted JSON returned to client

### Scalability Considerations
#### Horizontal Scaling
- **Frontend**: Naturally scalable via CDN and load balancing
- **Backend**: Stateless services enable horizontal scaling
  - Requires Redis adapter for Socket.IO
  - Shared database with connection pooling
- **OpenCV Service**: CPU-intensive, can run multiple instances behind load balancer
- **Database**: Read replicas for analytics workloads
- **Redis**: Clustered deployment for session storage

#### Vertical Scaling
- **Increased Detection Frequency**: Higher FPS processing
- **More Concurrent Streams**: Increased worker threads/processes
- **Larger Models**: Upgrading YOLO/face recognition models
- **Extended Retention**: More storage for video archives

### Resilience Patterns
#### Fault Tolerance
- **Circuit Breaker**: Protects against failing external services
- **Retry Logic**: Exponential backoff for transient failures
- **Graceful Degradation**: Reduced functionality when services unavailable
- **Health Checks**: Liveness and readiness probes for orchestration

#### Data Protection
- **Database Transactions**: ACID properties for critical operations
- **Backup Strategies**: Regular database snapshots
- **File System Integrity**: Hash-based verification for critical files
- **Access Controls**: Principle of least privilege throughout

### Security Architecture
#### Defense in Depth
1. **Network Layer**: 
   - Internal service communication only exposed internally
   - External access limited to API gateway
   - Firewall rules restricting port access

2. **Application Layer**:
   - Authentication: JWT + refresh tokens + TOTP MFA
   - Authorization: Role-based access control (RBAC)
   - Input Validation: Zod schemas on all endpoints
   - Output Encoding: XSS prevention in templates
   - Security Headers: Helmet.js configuration

3. **Data Layer**:
   - Encryption at rest for sensitive data
   - Field-level encryption for PII where required
   - Secure database connections (SSL/TLS)
   - Principle of least privilege for database users

4. **Infrastructure Layer**:
   - Container security scanning
   - Minimal base images
   - Runtime security constraints
   - Secret management via environment variables

#### API Security
- **Rate Limiting**: Per-IP and per-user limits
- **CORS**: Strict origin whitelisting
- **Security Headers**: CSP, HSTS, X-Frame-Options, etc.
- **HTTP Methods**: Proper use of GET/POST/PUT/DELETE
- **Status Codes**: Semantic use of HTTP status codes

## Communication Patterns

### Synchronous Communication
#### HTTP/REST
- **Frontend →Backend**: JSON over HTTPS with JWT authentication
- **Backend →OpenCV Service**: HTTP JSON API for CV tasks
- **Backend →External Services**: Email, SMS, webhook providers
- **Database Queries**: TypeORM/PostgreSQL SQL communication

#### WebSocket/Socket.IO
- **Bidirectional**: Full-duplex communication channel
- **Events**: Typed events with structured payloads
- **Rooms**: Logical channels for camera-specific broadcasting
- **Binary Data**: Efficient transmission of video frames
- **Fallbacks**: Polling-based transports for incompatible proxies

### Asynchronous Communication
#### Message Queuing
- **Batch Processing**: Job queue for non-real-time tasks
- **Event Publishing**: Internal event bus for decoupled components
- **Scheduled Tasks**: Cron-based timing for maintenance operations

#### Streaming
- **Video Frames**: Continuous stream of processed frames
- **Detection Results**: Real-time stream of detection events
- **Analytics Data**: Periodic aggregation of metrics

## Deployment Architecture

### Containerized Deployment
#### Docker Services
1. **Frontend**: 
   - Node.js base with built React assets
   - Serves static files and handles client-side routing
   - Port: 5173

2. **Backend**:
   - Node.js with compiled TypeScript
   - Express API server and Socket.IO
   - Port: 9753

3. **OpenCV Service**:
   - Python base with OpenCV and dependencies
   - Flask REST API for computer vision
   - Port: 8084

4. **PostgreSQL**:
   - Official PostgreSQL image
   - Persistent volume for data storage
   - Port: 5432

5. **Redis**:
   - Official Redis image
   - Persistent volume for durability
   - Port: 6379

#### Container Orchestration
- **docker-compose.yml**: Defines service dependencies and networks
- **Health Checks**: Each service has liveness/readiness probes
- **Resource Limits**: CPU/memory constraints per container
- **Restart Policies**: Automatic recovery from failures
- **Logging**: JSON logging to stdout/stderr for aggregation

### Network Architecture
#### Internal Communication
- **Backend ↔ OpenCV Service**: HTTP over Docker network
- **Backend ↔ PostgreSQL**: TCP/IP over Docker network
- **Backend ↔ Redis**: TCP/IP over Docker network
- **Frontend ↔ Backend**: Proxied via Vite in dev, direct in prod

#### External Communication
- **Clients → Frontend**: HTTPS (HTTP in development)
- **Frontend → Backend**: Proxied API calls (same origin)
- **System → Email/SMS**: External SMTP/API providers
- **System → Web Push**: VAPID-authenticated push services
- **System → MQTT**: Optional IoT broker communication

### Storage Architecture
#### Persistent Volumes
- **PostgreSQL Data**: Database files and WAL logs
- **Redis Data**: In-memory dataset with AOF persistence
- **Uploaded Media**: Event images, snapshots, and recordings
- **Application Logs**: Debug and audit logs (optional persistence)

#### Ephemeral Storage
- **Container Filesystems**: Application code and temporary files
- **In-Memory Caches**: Frequently accessed data
- **Processing Buffers**: Video frame buffers during analysis

## Evolutionary Architecture

### Extension Points
#### Plug-in Architecture
- **Detection Algorithms**: Easy to add new CV models
- **Notification Channels**: Add email, SMS, Slack, etc.
- **Storage Backends**: Local, S3, GCS, Azure Blob
- **Authentication Providers**: LDAP, OAuth, SAML

#### API Extensibility
- **Versioning**: Path-based API versioning ready
- **Webhooks**: Outgoing integrations for third-party systems
- **Event Subscriptions**: External systems can subscribe to events
- **Custom Fields**: Extension mechanisms for domain-specific data

### Technical Debt Management
#### Identified Areas
1. **Service Coupling**: Direct HTTP calls to OpenCV service
   - Planned: Message queue abstraction

2. **Database Migrations**: Manual SQL files
   - Planned: Migration framework integration

3. **Configuration Management**: Multiple config sources
   - Planned: Centralized configuration service

4. **Error Handling**: Inconsistent patterns across services
   - Planned: Standardized error handling middleware

### Refactoring Opportunities
#### Short-term
1. **Repository Pattern Refinement**: Consistent interface usage
2. **Service Interface Extraction**: Better decoupling
3. **Configuration Consolidation**: Single source of truth
4. **Logging Standardization**: Uniform format and levels

#### Medium-term
1. **CQRS Implementation**: Separate read/write models
2. **Event Sourcing**: For audit-critical operations
3. **Microservice Boundaries**: Better service decomposition
4. **API Gateway**: Centralized API management

#### Long-term
1. **Cloud-Native Migration**: Kubernetes deployment
2. **Service Mesh**: Istio/Linkerd for traffic management
3. **Event Streaming**: Kafka/Pulsar for high-volume events
4. **AI/ML Platform**: Model management and experimentation