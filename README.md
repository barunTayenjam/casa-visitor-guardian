# Casa Visitor Guardian - Home Security Camera System

## 🎯 Project Status (Current State)

**Last Updated:** January 2025  
**Overall Status:** ✅ **FUNCTIONAL** - Core features working, some advanced features in development

### ✅ **WORKING FEATURES**
- ✅ **Live RTSP Streaming** - Multiple camera feeds with real-time display
- ✅ **Frontend Dashboard** - React-based UI with responsive design  
- ✅ **Backend API** - Express server with REST endpoints
- ✅ **WebSocket Communication** - Real-time updates via Socket.IO
- ✅ **Camera Management** - Add/edit/delete cameras via web interface
- ✅ **Motion Detection** - Basic motion detection with snapshot capture
- ✅ **Event History** - View and browse historical motion events
- ✅ **Docker Deployment** - Containerized setup with nginx proxy
- ✅ **File Storage** - Automatic snapshot and event image storage

### ⚠️ **PARTIALLY WORKING / ISSUES**
- ⚠️ **Person Detection** - TensorFlow.js integration has native library issues on macOS
- ⚠️ **Batch Person Detection** - Frontend button exists but backend processing disabled
- ⚠️ **Face Recognition** - Module exists but not fully integrated
- ⚠️ **Email Notifications** - Configuration exists but needs SMTP setup

### ❌ **NOT IMPLEMENTED / BROKEN**
- ❌ **AI Person Recognition** - TensorFlow native binaries failing to load
- ❌ **Advanced Analytics** - Person counting and identification features
- ❌ **Mobile Push Notifications** - Only web notifications working
- ❌ **Cloud Storage Integration** - Only local file storage available

## Overview

Casa Visitor Guardian is a home security camera system that allows you to monitor and manage RTSP camera feeds with the following capabilities:

📹 **Live Streaming:** View real-time video feeds from multiple RTSP cameras  
🚨 **Motion Detection:** Basic movement detection with snapshot capture  
📸 **Automatic Capture:** Save snapshots when motion is detected  
📊 **Dashboard:** Web-based interface to monitor camera feeds  
🔍 **Event History:** Review past motion events with filtering  
🔔 **Real-time Updates:** Live notifications via WebSocket  
📱 **Mobile Responsive:** Access from any device  
🔄 **Auto-Recovery:** Automatic stream reconnection

## 🏗️ Project Architecture

### **Frontend** (`/`)
- **Framework:** React 18 + TypeScript + Vite
- **UI Library:** shadcn-ui components + Tailwind CSS  
- **State Management:** React Context + TanStack Query
- **Real-time:** Socket.IO client for live updates
- **Routing:** React Router for navigation
- **Port:** 5173 (dev) / 3020 (production)

### **Backend** (`/server`)
- **Runtime:** Node.js + Express + TypeScript
- **Streaming:** FFmpeg for RTSP processing
- **Real-time:** Socket.IO server for WebSocket communication  
- **Storage:** Local file system for images/events
- **AI/ML:** TensorFlow.js (currently disabled due to native library issues)
- **Port:** 9753

### **Key Components**
```
├── Frontend (React + TypeScript)
│   ├── Dashboard - Camera grid and controls
│   ├── Events - Motion event history
│   ├── Settings - Camera and system configuration
│   └── Components - Reusable UI components
│
├── Backend (Node.js + Express)
│   ├── RTSP Manager - Camera stream handling
│   ├── Motion Detection - Basic movement detection
│   ├── Person Detection - AI detection (disabled)
│   ├── API Routes - REST endpoints
│   └── Socket.IO - Real-time communication
│
└── Docker Setup
    ├── nginx - Reverse proxy
    ├── Frontend container
    └── Backend container
```

## Getting Started

### Prerequisites

- Node.js v16+ and npm/yarn installed
- FFmpeg installed (for the backend streaming functionality)
- Docker and Docker Compose (for containerized deployment)

### Installation

1. Clone the repository
   ```sh
   git clone <YOUR_GIT_URL>
   cd casa-visitor-guardian
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

## Technologies Used

### Frontend
- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS
- Socket.io client for real-time updates

### Backend
- Node.js
- Express
- TypeScript
- Socket.io for WebSocket communication
- FFmpeg for RTSP stream processing
- node-cron for scheduled tasks

## API Endpoints

The backend provides various REST API endpoints for managing cameras and retrieving events:

- `GET /api/cameras`: Get all cameras
- `GET /api/cameras/:id`: Get a specific camera
- `POST /api/cameras`: Add a new camera
- `PUT /api/cameras/:id`: Update a camera
- `POST /api/cameras/:id/stream/start`: Start streaming from a camera
- `POST /api/cameras/:id/stream/stop`: Stop streaming from a camera
- `POST /api/cameras/:id/snapshot`: Take a snapshot from a camera
- `GET /api/motion/events`: Get recent motion events
- `GET /api/system/overview`: Get system overview and statistics

## 🔧 Current Issues & Troubleshooting

### **Known Issues**

#### 1. TensorFlow.js Person Detection (macOS)
**Problem:** `dlopen failed: Library not loaded: libtensorflow.2.dylib`
**Status:** ❌ Blocking AI features
**Workaround:** Person detection is disabled, basic motion detection still works
**Solution:** Need to rebuild TensorFlow native binaries or use alternative AI library

#### 2. Batch Person Detection Button
**Problem:** Frontend button exists but backend processing fails
**Status:** ⚠️ UI works, processing doesn't
**Cause:** Depends on TensorFlow.js which is currently broken
**Workaround:** Manual image analysis via API endpoints

#### 3. Email Notifications
**Problem:** SMTP configuration required
**Status:** ⚠️ Feature exists but not configured
**Solution:** Set up SMTP credentials in server/.env file

### **Development Status**

#### ✅ Stable Components
- RTSP streaming pipeline
- React frontend with shadcn-ui
- Express API server
- Docker containerization
- Basic motion detection
- File storage system

#### 🚧 In Development
- AI-powered person detection
- Advanced analytics dashboard
- Email notification system
- Face recognition features

#### 📋 TODO List
- [ ] Fix TensorFlow.js native library issues
- [ ] Implement alternative AI detection (OpenCV?)
- [ ] Add cloud storage integration
- [ ] Mobile app development
- [ ] Advanced alert system
- [ ] User authentication system

## 🚀 Quick Start

### **Recommended: Docker Deployment**
```bash
# Clone and start
git clone <repository-url>
cd casa-visitor-guardian
./start-docker.sh
```
Access at: http://localhost:3020

### **Development Mode**
```bash
# Frontend (Terminal 1)
npm install
npm run dev

# Backend (Terminal 2)  
cd server
npm install
npm run dev
```
Access at: http://localhost:5173

## 📊 Feature Matrix

| Feature | Status | Frontend | Backend | Notes |
|---------|--------|----------|---------|-------|
| Live Streaming | ✅ Working | ✅ | ✅ | RTSP via FFmpeg |
| Camera Management | ✅ Working | ✅ | ✅ | Add/Edit/Delete |
| Motion Detection | ✅ Working | ✅ | ✅ | Basic pixel diff |
| Event History | ✅ Working | ✅ | ✅ | File-based storage |
| Person Detection | ❌ Broken | ✅ | ❌ | TensorFlow issues |
| Face Recognition | ❌ Disabled | ⚠️ | ⚠️ | Module exists |
| Email Alerts | ⚠️ Partial | ✅ | ⚠️ | Needs SMTP config |
| Mobile App | ❌ None | ❌ | ❌ | Web responsive only |

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

### **Priority Areas for Contribution**
1. Fix TensorFlow.js native library issues on macOS
2. Implement alternative AI detection methods
3. Add comprehensive test coverage
4. Improve error handling and logging
5. Mobile app development

## License

This project is licensed under the MIT License - see the LICENSE file for details.
