# Casa Visitor Guardian - Home Security Camera System

## Overview

Casa Visitor Guardian is a comprehensive home security camera system that allows you to monitor and manage RTSP camera feeds with advanced features:

📹 **Live Streaming:** View real-time video feeds from multiple RTSP cameras with minimal latency  
🚨 **Motion Detection:** Intelligent detection of movement and visitors  
📸 **Automatic Capture:** Save high-quality snapshots when motion is detected  
📊 **Dashboard:** Web-based interface to monitor and review activity with customizable layouts  
📧 **Daily Reports:** Email summaries with visitor timestamps, images, and motion analytics  
🔍 **Searchable History:** Easily review past visitor events with advanced filtering options  
🔔 **Real-time Notifications:** Instant alerts when motion is detected  
📱 **Mobile Responsive:** Access your security system from any device with a responsive design  
🌙 **Night Mode:** Enhanced visibility in low-light conditions with automatic day/night mode switching  
🔄 **Auto-Recovery:** System auto-restarts stream connections if cameras disconnect

## Project Structure

This project consists of two main components:

1. **Frontend**: A React application built with TypeScript, Vite, shadcn-ui, and Tailwind CSS
2. **Backend**: A Node.js server that handles RTSP camera streams and provides a WebSocket API for real-time communication

## Getting Started

### Prerequisites

- Node.js v16+ and npm/yarn installed
- FFmpeg installed (for the backend streaming functionality)

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

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the LICENSE file for details.
