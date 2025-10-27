# SentryVision - Smart Home Security System

## Overview

SentryVision is an intelligent home security camera system that provides comprehensive monitoring and management of RTSP camera feeds with advanced AI-powered features:

### 🎥 **Live Camera Monitoring**
- **Multi-Camera Grid View:** Monitor multiple RTSP cameras simultaneously with customizable layouts
- **Real-time Streaming:** Low-latency video feeds with FPS monitoring and connection status
- **Enhanced Camera Streams:** Advanced stream management with resolution, uptime, and performance metrics
- **Single Camera Focus:** Full-screen view for detailed monitoring of individual cameras

### 🤖 **AI-Powered Detection**
- **Person Detection:** Advanced AI algorithms to detect human presence with confidence scoring
- **Face Recognition:** Identify and track faces with known/unknown classification
- **Motion Detection:** Intelligent movement detection with customizable sensitivity thresholds
- **Real-time Alerts:** Instant notifications when detection events occur
- **Detection Control Panel:** Toggle and configure detection types with confidence thresholds

### 📊 **Advanced Analytics & Insights**
- **Activity Analytics:** Hourly, daily, weekly, and monthly activity charts and trends
- **Camera Performance Analytics:** Event frequency analysis per camera with visual charts
- **Response Time Monitoring:** Track system performance and alert response times
- **Statistical Dashboards:** Comprehensive metrics and KPIs for security monitoring
- **Customizable Time Ranges:** Analyze data across flexible time periods

### 📸 **Media Management**
- **Motion Event Gallery:** Organized gallery of all detected motion events with timestamps
- **Snapshot Management:** Manual and automatic snapshot capture with organization
- **Media Viewer:** High-resolution image viewing with download capabilities
- **Batch Processing:** Process historical images for retrospective analysis
- **Smart Search:** Filter media by camera, time range, and detection type

### 🔧 **Batch Processing & Automation**
- **Historical Analysis:** Process batches of historical images for person and face detection
- **Job Management:** Queue, monitor, and manage batch processing jobs with progress tracking
- **Multiple Output Formats:** Export results in JSON, CSV, or database formats
- **Confidence Filtering:** Configure detection confidence thresholds for batch processing
- **Automated Scheduling:** Set up recurring batch processing jobs

### 🎛️ **System Control & Automation**
- **Quick Actions Panel:** One-click system arming/disarming, recording control, and mode switching
- **Automated Recording:** Configure automatic recording based on detection events
- **Night Vision Mode:** Automatic switching between day and night modes
- **System Health Monitoring:** Real-time system status, CPU, memory, and network monitoring
- **Auto-Recovery:** Automatic reconnection and recovery from camera disconnections

### 📱 **Comprehensive Event Management**
- **Event Timeline:** Chronological view of all security events with detailed information
- **Advanced Filtering:** Search events by camera, time range, detection type, and confidence
- **Event Details:** Detailed event information including images, timestamps, and detection data
- **Archive Management:** Archive and export events for long-term storage
- **Pagination & Navigation:** Efficient browsing through large event histories

### ⚙️ **Configuration & Settings**
- **Camera Configuration:** Easy RTSP camera setup with connection testing and validation
- **System Settings:** Comprehensive configuration for general, storage, and notification preferences
- **Storage Management:** Configure retention policies, auto-cleanup, and compression settings
- **Notification Management:** Email and push notification configuration with quiet hours
- **System Logs:** Real-time log viewing with filtering and download capabilities

### 🔐 **Security & Reliability**
- **User Authentication:** Secure login and session management
- **Data Encryption:** Encrypted communication and storage
- **Backup & Recovery:** Automated system backups and configuration export
- **Health Monitoring:** Continuous system health checks and alerts
- **Error Handling:** Comprehensive error management and recovery mechanisms

### 🌐 **Accessibility & Integration**
- **Responsive Design:** Works seamlessly on desktop, tablet, and mobile devices
- **WebSocket Integration:** Real-time updates and live data streaming
- **API Access:** RESTful API for integration with other systems
- **Docker Support:** Containerized deployment for easy setup and scaling
- **Cross-Platform:** Compatible with Windows, macOS, and Linux systems

## Project Architecture

This project is built with a modern, scalable architecture consisting of several integrated components:

### **Frontend Application** (React/TypeScript)
- **Framework:** React 18 with TypeScript for type safety and modern development
- **Build Tool:** Vite for fast development and optimized production builds
- **UI Library:** shadcn/ui components with Tailwind CSS for responsive, modern design
- **State Management:** React Context for global state and TanStack Query for server state
- **Real-time Communication:** Socket.io client for live updates and WebSocket connections
- **Routing:** React Router for SPA navigation and protected routes
- **Charts & Analytics:** Recharts for data visualization and analytics dashboards

### **Backend Server** (Node.js/Express)
- **Runtime:** Node.js with Express.js for RESTful API endpoints
- **TypeScript:** Full TypeScript implementation for type safety
- **Real-time Communication:** Socket.io for WebSocket connections and live updates
- **Stream Processing:** FFmpeg integration for RTSP stream handling and video processing
- **AI/ML Integration:** Computer vision capabilities for person and face detection
- **Database:** Configurable database support for event and media storage
- **Task Scheduling:** Automated batch processing and system maintenance tasks

### **Core Components**

#### **Camera Management System**
- RTSP stream handling with automatic reconnection
- Multi-camera support with individual configuration
- Real-time status monitoring and health checks
- Stream quality optimization and bandwidth management

#### **AI Detection Engine**
- Person detection using advanced machine learning models
- Face recognition with known/unknown classification
- Motion detection with customizable sensitivity
- Confidence scoring and threshold management
- Batch processing for historical analysis

#### **Event Management**
- Real-time event capture and storage
- Advanced filtering and search capabilities
- Event categorization and tagging
- Archive and export functionality
- Timeline visualization and navigation

#### **Media Processing Pipeline**
- Automatic image capture on detection events
- Image optimization and storage management
- Batch processing for historical media
- Multi-format export capabilities
- Smart compression and retention policies

#### **Analytics & Reporting**
- Real-time analytics dashboards
- Historical trend analysis
- Performance metrics and KPI tracking
- Custom report generation
- Data visualization with interactive charts

#### **System Administration**
- User authentication and authorization
- System health monitoring
- Configuration management
- Log management and debugging
- Backup and recovery systems

## Getting Started

### Prerequisites

- Node.js v16+ and npm/yarn installed
- FFmpeg installed (for the backend streaming functionality)
- Docker and Docker Compose (for containerized deployment)

### Installation

1. Clone the repository
   ```sh
   git clone <YOUR_GIT_URL>
   cd sentryvision
   ```

2. Install frontend dependencies
   ```sh
   npm install
   ```

3. Install backend dependencies
   ```sh
   cd server
   npm install
   ```

### Running the Application

1. Start the backend server
   ```sh
   # In the server directory
   npm run dev
   ```

2. Start the frontend development server
   ```sh
   # In the root directory
   npm run dev
   ```

3. Access the application at http://localhost:5173

### Docker Deployment

Simple Docker setup with fixed ports for easy deployment:

#### Quick Start (Recommended)
```sh
# Run the startup script
./start-docker.sh
```

#### Manual Docker Commands
```sh
# Standard deployment (port 3020)
docker-compose up --build

# Development mode (port 5173) - with hot reloading
docker-compose -f docker-compose.dev.yml up --build
```

#### Port Configuration
The application uses these ports:
- **Frontend**: `http://localhost:3020`
- **Backend**: `http://localhost:9753`

If you need different ports, edit the `.env` file:
```bash
FRONTEND_PORT=3020
NGINX_PORT=3020
BACKEND_PORT=9753
```

## Configuration

### Backend Configuration

The backend uses a `.env` file for configuration. Create a `.env` file in the `server` directory based on the `.env.example` file:

```
# Server configuration
PORT=3000
FRONTEND_URL=http://localhost:5173

# Email configuration for notifications and reports
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@example.com
SMTP_PASS=your-password
EMAIL_SENDER=security-system@example.com
EMAIL_RECIPIENT=your-email@example.com
```

### Adding RTSP Cameras

You can add RTSP cameras in two ways:

1. **Via the Web Interface**: Use the "Add Camera" feature in the dashboard

2. **Directly in the Code**: Edit the `defaultCameras` array in `server/src/streams/rtspManager.ts`

```typescript
const defaultCameras = [
  {
    id: 'cam1',
    name: 'Front Door',
    rtspUrl: 'rtsp://username:password@camera-ip:port/stream',
    frameRate: 15,
    resolution: '640x480',
    nightMode: false
  }
];
```

## Technology Stack

### Frontend Technologies
- **Vite** - Next generation frontend tooling for fast development and optimized builds
- **TypeScript** - Type-safe JavaScript development with enhanced developer experience
- **React 18** - Modern React with concurrent features and hooks
- **shadcn/ui** - High-quality, accessible UI components with Radix UI primitives
- **Tailwind CSS** - Utility-first CSS framework for rapid UI development
- **Socket.io Client** - Real-time bidirectional event-based communication
- **TanStack Query** - Powerful server state management and data fetching
- **React Router** - Declarative routing for single-page applications
- **Recharts** - Composable charting library for data visualization

### Backend Technologies
- **Node.js** - High-performance JavaScript runtime
- **Express.js** - Fast, unopinionated web framework for Node.js
- **TypeScript** - Type-safe backend development with full IntelliSense
- **Socket.io** - Real-time WebSocket communication and event handling
- **FFmpeg** - Multimedia processing and RTSP stream handling
- **node-cron** - Task scheduling and automation
- **Multer** - File upload handling and multipart form data processing
- **Cors** - Cross-origin resource sharing middleware
- **Dotenv** - Environment variable management

### AI/ML Technologies
- **TensorFlow.js** - Machine learning in the browser and Node.js
- **OpenCV** - Computer vision library for image processing
- **Face-api.js** - Face detection and recognition models
- **Custom ML Models** - Trained models for person detection and motion analysis

### DevOps & Deployment
- **Docker** - Containerization for consistent deployment environments
- **Docker Compose** - Multi-container application orchestration
- **Nginx** - Reverse proxy and static file serving
- **PM2** - Production process manager for Node.js applications

## API Endpoints

SentryVision provides a comprehensive REST API for managing all aspects of the security system:

### Camera Management
- `GET /api/cameras` - Retrieve all configured cameras
- `GET /api/cameras/:id` - Get specific camera details and status
- `POST /api/cameras` - Add a new RTSP camera configuration
- `PUT /api/cameras/:id` - Update existing camera settings
- `DELETE /api/cameras/:id` - Remove a camera from the system

### Stream Control
- `POST /api/cameras/:id/stream/start` - Start streaming from a camera
- `POST /api/cameras/:id/stream/stop` - Stop camera streaming
- `POST /api/cameras/:id/snapshot` - Capture manual snapshot from camera
- `GET /api/cameras/:id/stream/status` - Get current stream status and metrics

### Event Management
- `GET /api/events` - Retrieve security events with filtering and pagination
- `GET /api/events/:id` - Get detailed event information
- `POST /api/events/search` - Advanced event search with multiple criteria
- `DELETE /api/events/:id` - Delete specific event
- `GET /api/events/stats` - Get event statistics and analytics

### Detection & AI
- `POST /api/detection/person` - Trigger person detection on image
- `POST /api/detection/face` - Perform face recognition analysis
- `POST /api/detection/motion` - Analyze motion in image or video
- `GET /api/detection/models` - List available AI models
- `POST /api/detection/batch` - Submit batch processing job

### Batch Processing
- `GET /api/batch/jobs` - List all batch processing jobs
- `POST /api/batch/jobs` - Create new batch processing job
- `GET /api/batch/jobs/:id` - Get job status and progress
- `DELETE /api/batch/jobs/:id` - Cancel batch processing job
- `GET /api/batch/results/:id` - Retrieve batch processing results

### Media Management
- `GET /api/media` - List media files with filtering
- `GET /api/media/:id` - Get media file metadata
- `POST /api/media/upload` - Upload media files
- `DELETE /api/media/:id` - Delete media file
- `GET /api/media/download/:id` - Download media file

### System Administration
- `GET /api/system/overview` - Get system overview and statistics
- `GET /api/system/health` - Check system health and performance
- `GET /api/system/logs` - Retrieve system logs
- `POST /api/system/config` - Update system configuration
- `GET /api/system/config` - Get current system configuration

### Analytics & Reporting
- `GET /api/analytics/activity` - Get activity analytics data
- `GET /api/analytics/cameras` - Get camera performance analytics
- `GET /api/analytics/detection` - Get detection accuracy statistics
- `POST /api/analytics/export` - Export analytics data
- `GET /api/analytics/trends` - Get trend analysis data

### WebSocket Events
Real-time updates are provided through WebSocket connections:
- `camera_status` - Camera connection status updates
- `detection_event` - Real-time detection notifications
- `system_alert` - System health and performance alerts
- `batch_progress` - Batch processing job progress updates
- `media_ready` - New media available notifications

## Development

### Project Structure

```
sentryvision/
├── src/                    # Frontend React application
│   ├── components/         # Reusable UI components
│   │   ├── ui/            # shadcn/ui components
│   │   ├── CameraGrid.tsx
│   │   ├── Dashboard.tsx
│   │   └── ...
│   ├── hooks/             # Custom React hooks
│   ├── services/          # API services and utilities
│   ├── types/             # TypeScript type definitions
│   └── ...
├── server/                # Backend Node.js application
│   ├── src/              # Backend source code
│   │   ├── streams/      # RTSP stream management
│   │   ├── detection/    # AI detection services
│   │   ├── events/      # Event handling
│   │   └── ...
│   └── ...
├── docker-compose.yml     # Docker configuration
├── Dockerfile            # Container definition
└── README.md            # This file
```

### Development Workflow

1. **Frontend Development**
   ```bash
   npm run dev          # Start frontend dev server
   npm run build        # Build for production
   npm run lint         # Run ESLint
   ```

2. **Backend Development**
   ```bash
   cd server
   npm run dev          # Start backend dev server
   npm run build        # Build for production
   npm run test         # Run tests
   ```

3. **Full Stack Development**
   ```bash
   npm run dev:full     # Start both frontend and backend
   ```

### Code Style and Conventions

- **TypeScript**: Strict type checking with proper interfaces
- **React**: Functional components with hooks
- **Naming**: PascalCase for components, camelCase for variables
- **Comments**: JSDoc style for functions and classes
- **Error Handling**: Comprehensive error handling with custom error classes

## Contributing

We welcome contributions to SentryVision! Please follow these guidelines:

### How to Contribute

1. **Fork the Repository**
2. **Create a Feature Branch** (`git checkout -b feature/amazing-feature`)
3. **Commit Your Changes** (`git commit -m 'Add amazing feature'`)
4. **Push to the Branch** (`git push origin feature/amazing-feature`)
5. **Open a Pull Request**

### Development Guidelines

- Follow the existing code style and conventions
- Write comprehensive tests for new features
- Update documentation for any API changes
- Ensure all existing tests pass before submitting

### Reporting Issues

Use the GitHub Issues page to report bugs or request features. Please include:
- Clear description of the issue
- Steps to reproduce
- Expected behavior
- Environment information (OS, Node.js version, etc.)

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

For support, please open an issue in the GitHub repository or contact the development team.
