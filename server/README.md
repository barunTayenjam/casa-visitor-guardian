# SentryVision Backend

This is the backend server for the SentryVision system, handling RTSP camera streams, motion detection, and notifications.

## Features

- RTSP Stream Processing with ffmpeg
- Real-time streaming to web clients via Socket.io
- Motion detection using OpenCV
- Automatic snapshots when motion is detected
- Daily email reports with visitor statistics
- REST API for camera management and event retrieval

## Prerequisites

Before you can run this server, you'll need:

- Node.js 16+ and npm/yarn
- OpenCV dependencies (required for motion detection)

### Installing OpenCV Dependencies

#### macOS
```bash
brew install opencv
```

#### Ubuntu/Debian
```bash
sudo apt-get update
sudo apt-get install -y build-essential cmake libopencv-dev
```

## Installation

1. Clone the repository (if you haven't already)
2. Navigate to the server directory:

```bash
cd server
```

3. Install dependencies:

```bash
npm install
```

4. Create a `.env` file based on the `.env.example`:

```bash
cp .env.example .env
```

5. Edit the `.env` file with your specific configuration

## Running the Server

### Development Mode

```bash
npm run dev
```

This will start the server in development mode with hot-reloading.

### Production Mode

First, build the TypeScript code:

```bash
npm run build
```

Then start the server:

```bash
npm start
```

## API Endpoints

### Cameras

- `GET /api/cameras` - Get all cameras
- `GET /api/cameras/:id` - Get a specific camera
- `POST /api/cameras` - Add a new camera
- `PUT /api/cameras/:id` - Update a camera
- `DELETE /api/cameras/:id` - Delete a camera
- `POST /api/cameras/:id/stream/start` - Start streaming from a camera
- `POST /api/cameras/:id/stream/stop` - Stop streaming from a camera
- `POST /api/cameras/:id/snapshot` - Take a snapshot from a camera
- `POST /api/cameras/:id/night-mode` - Toggle night mode for a camera

### Motion Detection

- `GET /api/motion/:cameraId/settings` - Get motion detection settings
- `PUT /api/motion/:cameraId/settings` - Update motion detection settings
- `GET /api/motion/events` - Get all motion events
- `GET /api/motion/:cameraId/events` - Get motion events for a specific camera

## Websocket Events

Connect to the Socket.io server to receive real-time updates:

### Client to Server

- `requestStream` - Request to receive stream for a camera
- `stopStream` - Stop receiving stream for a camera

### Server to Client

- `frame` - New frame from a camera
- `motionDetected` - Motion detected on a camera
- `motionSnapshot` - High-resolution snapshot of detected motion
- `dailyReport` - Daily summary report

## Adding RTSP Cameras

To add your RTSP cameras, you can either:

1. Use the REST API to add cameras dynamically
2. Edit the default cameras in the `rtspManager.ts` file

RTSP URL formats usually look like:

```
rtsp://username:password@camera-ip:port/stream
```

For example:
```
rtsp://username:password@192.168.1.100:554/stream1
```

Check your camera's documentation for the exact RTSP URL format.
