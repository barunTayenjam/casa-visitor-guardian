# Directory Structure

## Root Level
```
home-security-non-docker/
├── .planning/                    # Project planning documents
│   ├── codebase/                 # Codebase mapping documents (this folder)
│   ├── phases/                   # GSD phase documents
│   ├── research/                 # Research materials
│   ├── config.json               # GSD configuration
│   ├── STATE.md                  # Current project state
│   ├── ROADMAP.md                # Project roadmap
│   ├── REQUIREMENTS.md           # Project requirements
│   ├── PROJECT.md                # Project overview
│   └── MILESTONE_*.md            # Milestone documents
├── frontend/                     # React/TypeScript frontend application
├── server/                       # Node.js/Express backend application
├── opencv-service/               # Python OpenCV computer vision service
├── database/                     # PostgreSQL database migrations
├── data/                         # Storage for detection images and events
├── public/                       # Static assets served directly
├── scripts/                      # Utility scripts
├── docs/                         # Documentation files
├── docker-compose.yml            # Docker Compose orchestration
├── package.json                  # Root package.json with workspace scripts
├── package-lock.json             # Locked dependencies
├── .env.example                  # Environment variables template
├── .gitignore                    # Git ignore rules
└── README.md                     # Project overview
```

## Frontend Structure (`/frontend`)
```
frontend/
├── src/                          # Source code
│   ├── components/               # Reusable UI components
│   │   ├── dashboard/            # Dashboard-specific components
│   │   │   ├── CameraGrid.tsx
│   │   │   ├── RecentDetectionsCarousel.tsx
│   │   │   └── SystemOverview.tsx
│   │   ├── analytics/            # Chart and analytics components
│   │   ├── ui/                   # shadcn/ui components (Radix UI primitives)
│   │   │   ├── accordion/
│   │   │   ├── alert-dialog/
│   │   │   ├── avatar/
│   │   │   ├── command/
│   │   │   ├── context-menu/
│   │   │   ├── dropdown-menu/
│   │   │   └── ... (many more Radix-based components)
│   │   └── layout/               # Layout components (headers, footers, etc.)
│   ├── pages/                    # Route-level components
│   │   ├── Dashboard.tsx         # Main dashboard view
│   │   ├── Gallery.tsx           # Event gallery viewer
│   │   ├── VisitorTimeline.tsx   # Visitor tracking timeline
│   │   ├── Review.tsx            # Event review interface
│   │   └── Settings.tsx          # User and system settings
│   ├── services/                 # API service layer
│   │   └── ApiService.ts         # Centralized API client
│   ├── contexts/                 # React context providers
│   │   ├── CameraContext.tsx     # Camera state management
│   │   ├── SocketContext.tsx     # Socket.IO connection management
│   │   └── AuthContext.tsx       # Authentication state management
│   ├── hooks/                    # Custom React hooks
│   │   ├── useReview.ts          # Review segment hooks
│   │   ├── use-toast.ts          # Toast notification hook
│   │   ├── useWakeLock.ts        # Wake lock prevention
│   │   ├── useKeyboardShortcuts.ts # Keyboard shortcut handling
│   │   └── ... (other custom hooks)
│   ├── types/                    # TypeScript type definitions
│   │   └── security.ts           # Security-related types
│   ├── lib/                      # Utility functions
│   │   ├── utils.ts              # General utilities
│   │   └── logger.ts             # Logging utility
│   ├── styles/                   # Styling-related files
│   │   └── design-tokens.ts      # CSS design tokens
│   ├── tests/                    # Test setup files
│   │   └── setup.ts              # Jest test configuration
│   ├── App.tsx                   # Root application component
│   ├── main.tsx                  # Entry point
│   ├── index.css                 # Global CSS styles
│   └── App.css                   # Component-level CSS
├── vite.config.ts                # Vite configuration
├── tailwind.config.ts            # TailwindCSS configuration
├── postcss.config.js             # PostCSS configuration
├── components.json               # shadcn/ui configuration
├── tsconfig.json                 # TypeScript configuration (inherited from Vite)
├── package.json                  # Frontend dependencies
├── package-lock.json             # Frontend locked dependencies
├── .eslintrc.js                  # ESLint configuration
├── .prettierrc                   # Prettier configuration
└── index.html                    # HTML template
```

## Backend Structure (`/server`)
```
server/
├── src/                          # Source code
│   ├── routes/                   # API route handlers
│   │   ├── index.ts              # Main API routes (large file)
│   │   ├── auth.ts               # Authentication endpoints
│   │   ├── visitorRoutes.ts      # Visitor management endpoints
│   │   ├── detectionRoutes.ts    # Object/face detection endpoints
│   │   ├── reviewRoutes.ts       # Review segment endpoints
│   │   ├── timelineRoutes.ts     # Timeline query endpoints
│   │   ├── storageRoutes.ts      # Storage management endpoints
│   │   ├── notificationRoutes.ts # Notification endpoints
│   │   ├── batchRoutes.ts        # Batch processing endpoints
│   │   ├── faceConfigRoutes.ts   # Face recognition configuration
│   │   ├── faceEmbeddingRoutes.ts # Face embedding management
│   │   └── cleanup.ts            # Cleanup operations
│   ├── services/                 # Business logic services
│   │   ├── authenticationService.ts # Auth logic (JWT, MFA, etc.)
│   │   ├── detectionService.ts   # Detection coordination
│   │   ├── reviewService.ts      # Review segment management
│   │   ├── timelineService.ts    # Timeline event management
│   │   ├── notificationService.ts # Email and push notifications
│   │   ├── visitorAnalyticsService.ts # Visitor analytics
│   │   ├── batchProcessingService.ts # Async job processing
│   │   ├── storageStatsService.ts # Storage monitoring
│   │   ├── retentionPolicyService.ts # Data retention policies
│   │   ├── automatedCleanupService.ts # File cleanup jobs
│   │   ├── opencvMicroserviceClient.ts # OpenCV service communication
│   │   ├── mqttService.ts        # MQTT communication
│   │   ├── circuitBreaker.ts     # Fault tolerance pattern
│   │   ├── retryService.ts       # Retry logic with backoff
│   │   ├── auditService.ts       # Audit logging
│   │   ├── credentialManager.ts  # Secure credential storage
│   │   ├── baseService.ts        # Base service class
│   │   └── ... (other specialized services)
│   ├── models/                   # TypeORM entities
│   │   ├── User.ts               # User account entity
│   │   ├── Event.ts              # Motion/event detection entity
│   │   ├── Visitor.ts            # Visitor tracking entity
│   │   ├── Role.ts               # Role definitions
│   │   ├── UserSession.ts        # JWT session tracking
│   │   ├── UserReviewStatus.ts   # Review tracking per user
│   │   ├── ReviewSegment.ts      # Bundled review periods
│   │   ├── BatchJob.ts           # Async processing jobs
│   │   ├── Timeline.ts           # Timeline events
│   │   ├── AdaptiveRegion.ts     # Spatial detection zones
│   │   ├── DetectionConfig.ts    # Detection configuration storage
│   │   ├── SystemSettings.ts     # System configuration
│   │   ├── StorageStats.ts       # Storage usage statistics
│   │   ├── RetentionPolicy.ts    # Data retention rules
│   │   ├── FaceEmbedding.ts      # Face recognition embeddings
│   │   ├── NotificationLog.ts    # Notification delivery tracking
│   │   ├── NotificationPreferences.ts # User notification preferences
│   │   ├── NotificationSubscription.ts # Notification subscriptions
│   │   └── index.ts              # Export all entities
│   ├── middleware/               # Express middleware
│   │   ├── auth.ts               # JWT verification and role checking
│   │   ├── validation.ts         # Request validation with Zod
│   │   ├── rateLimit.ts          # Rate limiting (Redis-backed)
│   │   ├── enhancedRateLimit.ts  # Enhanced rate limiting
│   │   └── security.ts           # Additional security middleware
│   ├── detection/                # Motion detection algorithms
│   │   ├── optimizedMotionDetection.ts    # Main detection (988 lines)
│   │   ├── simpleMotionDetection.ts       # Basic detection (138 lines)
│   │   ├── motionTriggeredDetection.ts    # Object/face detection trigger (664 lines)
│   │   ├── objectDetection.ts             # YOLO object detection
│   │   ├── cleanupService.ts              # Event cleanup service
│   │   ├── performanceMonitor.ts          # Detection performance tracking
│   │   ├── metricsCollector.ts            # Metrics collection
│   │   └── alertingSystem.ts              # Alert generation
│   ├── streams/                  # RTSP stream management
│   │   ├── rtspManager.ts        # Main stream orchestrator
│   │   ├── streamManager.ts      # Stream management utilities
│   │   └── streamHealthMonitor.ts # Stream health monitoring
│   ├── config/                   # Configuration files
│   │   ├── index.ts              # Main configuration export
│   │   └── detectionConfig.ts    # Detection algorithm parameters
│   ├── utils/                    # Utility functions
│   │   ├── logger.ts             # Logging service
│   │   ├── auditLogger.ts        # Security audit logging
│   │   ├── passwordSecurity.ts   # Password hashing and validation
│   │   ├── encryption.ts         # Symmetric encryption utilities
│   │   ├── jwtService.ts         # JWT handling
│   │   ├── fileHash.ts           # Content-based file identification
│   │   ├── asyncFileOperations.ts # Safe file operations
│   │   ├── detectionDataNormalizer.ts # Detection result normalization
│   │   ├── credentialManager.ts  # Secure credential storage
│   │   ├── testImageGenerator.ts # Test image generation
│   │   └── ... (other utilities)
│   ├── migrations/               # TypeORM migration files
│   │   ├── 1702340575345-CreateEventsTable.ts
│   │   ├── AddDetectionIndexes1706582400000.ts
│   │   ├── AddMissingEventColumns1738512000000.ts
│   │   └── ... (other migrations)
│   ├── index.ts                  # Application entry point
│   ├── database.ts               # Database connection setup
│   └── events/                   # Custom event bus
│       └── eventBus.ts           # Decoupled event communication
├── tests/                        # Backend tests
│   ├── setup.ts                  # Jest test configuration
│   ├── setup.test.ts             # Test setup verification
│   ├── basic.test.ts             # Basic functionality tests
│   ├── services/                 # Service layer tests
│   │   ├── authenticationService.test.ts
│   │   ├── basic.test.ts
│   │   └── ... (other service tests)
│   ├── routes/                   # Route handler tests
│   │   ├── auth.test.ts
│   │   ├── batchDetection.test.ts
│   │   ├── reviewRoutes.test.ts
│   │   └── visitorRoutes.test.ts
│   └── utils/                    # Utility tests
│       ├── fileHash.test.ts
│       ├── encryption.test.ts
│       ├── cronJobs.test.ts
│       └── logger.test.ts
├── scripts/                      # Utility scripts
│   ├── runBatchProcessing.ts     # Batch processing execution
│   ├── detectFromFiles.ts        # Detection from saved files
│   ├── addTestDetectionData.ts   # Add test detection data
│   ├── init-batch-db.js          # Initialize batch processing DB
│   ├── migrate-unified-storage.ts # Storage migration
│   ├── add-known-person.ts       # Add known person to DB
│   └── create-test-image.ts      # Create test image
├── Dockerfile                    # Backend container definition
├── tsconfig.json                 # TypeScript configuration (strict)
├── jest.config.js                # Jest testing configuration
├── package.json                  # Backend dependencies
├── package-lock.json             # Backend locked dependencies
├── .env.example                  # Environment variables template
└── cameras.json                  # Camera configuration (RTSP, zones)
```

## OpenCV Service Structure (`/opencv-service`)
```
opencv-service/
├── app.py                        # Main Flask application (~1,200 lines)
├── improved_face_recognition.py  # Face recognition engine
├── requirements.txt              # Python dependencies
├── Dockerfile                    # Container definition
├── models/                       # ML model files (YOLO, etc.)
├── known_faces/                  # Known face embeddings
│   └── *.npy                     # Face encoding files
├── data/                         # Temporary detection data
│   ├── events/                   # Processed event data
│   └── snapshots/                # Temporary snapshots
└── README.md                     # Service documentation
```

## Database Structure (`/database`)
```
database/
├── migrations/                   # SQL migration files
│   ├── 001_create_users_table.sql
│   ├── 002_create_roles_table.sql
│   ├── 003_create_events_table.sql
│   ├── 004_create_visitor_timeline_table.sql
│   ├── 005_create_timeline_table.sql
│   ├── 006_create_review_segments_table.sql
│   ├── 007_create_batch_jobs_table.sql
│   └── 008_create_storage_stats_table.sql
├── run-migrations.ts             # Migration runner script
├── package.json                  # Database dependencies
├── package-lock.json             # Database locked dependencies
└── tsconfig.json                 # TypeScript configuration
```

## Data Storage Structure (`/data`)
```
data/
└── detections/                   # Main detection storage
    ├── YYYY-MM/                  # Year-month directories
    │   ├── events/               # Motion event images
    │   │   ├── motion/           # Motion detection images
    │   │   ├── face/             # Face detection images
    │   │   └── object/           # Object detection images
    │   └── snapshots/            # Manual snapshots
    └── ... (more year-month directories)
```

## Public Assets Structure (`/public`)
```
public/
├── snapshots/                    # Web-accessible snapshots
├── favicon.ico                   # Browser favicon
├── logo.png                      # Application logo
└── ... (other static assets)
```

## Key Structural Patterns

### Separation of Concerns
1. **By Concern**: Frontend, backend, CV service, database separated
2. **By Layer**: Routes → Services → Models → Infrastructure
3. **By Function**: Authentication, detection, review, timeline, notifications
4. **By Technology**: TypeScript/JS, Python, SQL, Docker configuration

### Import/Export Patterns
- **Barrel Exports**: `index.ts` files export all related modules
- **Path Aliases**: Frontend uses `@/` alias via Vite configuration
- **Relative Imports**: Backend uses relative paths with `.ts` extensions
- **Type-only Imports**: Using `import type` for TypeScript-only imports

### Naming Conventions
- **Files**: camelCase for TypeScript/JavaScript (.ts, .tsx, .js)
- **Directories**: kebab-case for multi-word directory names
- **Components**: PascalCase for React components (.tsx)
- **Services**: camelCase with Service suffix (.ts)
- **Models**: PascalCase for TypeORM entities (.ts)
- **Middleware**: camelCase with Middleware suffix (.ts)
- **Utils**: camelCase for utility functions (.ts)
- **Tests**: Same name as source with .test.ts suffix
- **Config files**: camelCase or descriptive names with .ts/.js/.json
- **SQL files**: snake_case with numeric prefixes for ordering

### Architectural Boundaries
1. **Frontend-Backend**: Communication via REST API and Socket.IO
2. **Backend-OpenCV Service**: HTTP JSON API communication
3. **Backend-Database**: TypeORM ORM with PostgreSQL driver
4. **Backend-Redis**: Direct client connection for caching/sessions
5. **Backend-File System**: Local storage for detection images
6. **Internal Services**: Well-defined interfaces with dependency injection

### Scalability Considerations
- **Stateless Services**: Backend services designed for horizontal scaling
- **Shared Nothing**: Minimal shared state between service instances
- **Externalized State**: Database, Redis, and file storage for persistence
- **Async Processing**: Job queues for non-realtime operations
- **Caching Layers**: Redis for frequently accessed data
- **CDN Ready**: Frontend build outputs suitable for CDN serving

### Deployment Structure
- **Container per Service**: Each major component in its own Docker container
- **Network Isolation**: Internal Docker network for service communication
- **Volume Mounts**: Persistent storage for database and uploaded files
- **Environment Variables**: Configuration per container via env vars
- **Health Checks**: Liveness and readiness probes for each service
- **Resource Limits**: CPU/memory constraints defined in docker-compose