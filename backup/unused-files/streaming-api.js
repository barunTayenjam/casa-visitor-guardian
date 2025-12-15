import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { WebSocketServer } from 'ws';
import { spawn } from 'child_process';
import fs from 'fs';

// Simple in-memory storage
const cameras = new Map();
const streams = new Map();
const motionEvents = [];

// Create HTTP server
const server = http.createServer((req, res) => {
  console.log(`Request: ${req.method} ${req.url}`);
  
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }
  
  const url = req.url;
  
  // API Routes
  if (url === '/api/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      status: 'ok', 
      message: 'SentryVision API is running',
      timestamp: new Date().toISOString(),
      features: ['streaming', 'motion-detection', 'cameras', 'socket.io']
    }));
  } else if (url === '/api/cameras') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      cameras: Array.from(cameras.values()),
      count: cameras.size
    }));
  } else if (url === '/api/events') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      events: motionEvents.slice(-50), // Last 50 events
      count: motionEvents.length
    }));
  } else if (url?.startsWith('/api/stream/')) {
    const cameraId = url.split('/').pop();
    handleStreamRequest(cameraId, res);
  } else if (url?.startsWith('/api/detect/')) {
    const cameraId = url.split('/').pop();
    handleDetectionRequest(cameraId, res);
  } else {
    // Serve frontend or default response
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      message: 'SentryVision Monolithic Container',
      endpoints: ['/api/health', '/api/cameras', '/api/events', '/api/stream/:id', '/api/detect/:id'],
      status: 'running'
    }));
  }
});

// WebSocket server for real-time streaming
const wss = new WebSocketServer({ port: 9754 });
console.log('WebSocket server started on port 9754');

wss.on('connection', (ws) => {
  console.log('WebSocket client connected');
  
  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message.toString());
      console.log('Received:', data);
      
      if (data.type === 'requestStream') {
        handleStreamRequest(data.cameraId, null, ws);
      } else if (data.type === 'stopStream') {
        stopStream(data.cameraId);
      }
    } catch (error) {
      console.error('WebSocket message error:', error);
    }
  });
  
  ws.on('close', () => {
    console.log('WebSocket client disconnected');
  });
});

// Handle streaming requests
function handleStreamRequest(cameraId, res, ws = null, socket = null) {
  console.log(`Stream requested for camera: ${cameraId}`);
  
  // Simulate camera stream (in real implementation, this would connect to RTSP)
  const ffmpeg = spawn('ffmpeg', [
    '-f', 'lavfi',
    '-i', 'testsrc=duration=10:size=320x240:rate=30',
    '-f', 'mpegts',
    '-codec:v', 'mpeg1video',
    '-qscale:v', '3',
    '-'
  ]);
  
  streams.set(cameraId, ffmpeg);
  
  if (res) {
    // HTTP streaming response
    res.writeHead(200, {
      'Content-Type': 'video/mpeg',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    });
    
    ffmpeg.stdout.on('data', (data) => {
      res.write(data);
    });
    
    ffmpeg.on('close', () => {
      res.end();
      streams.delete(cameraId);
    });
  }
  
  if (ws) {
    // WebSocket streaming
    ffmpeg.stdout.on('data', (data) => {
      ws.send(JSON.stringify({
        type: 'frame',
        cameraId,
        data: data.toString('base64'),
        timestamp: new Date().toISOString()
      }));
    });
    
    ffmpeg.on('close', () => {
      streams.delete(cameraId);
      ws.send(JSON.stringify({
        type: 'streamEnded',
        cameraId,
        timestamp: new Date().toISOString()
      }));
    });
  }
  
  if (socket) {
    // Socket.IO streaming
    ffmpeg.stdout.on('data', (data) => {
      socket.emit('frame', {
        cameraId,
        data: data.toString('base64'),
        timestamp: new Date().toISOString()
      });
    });
    
    ffmpeg.on('close', () => {
      streams.delete(cameraId);
      socket.emit('streamEnded', {
        cameraId,
        timestamp: new Date().toISOString()
      });
    });
  }
}

// Handle motion detection
function handleDetectionRequest(cameraId, res) {
  console.log(`Detection requested for camera: ${cameraId}`);
  
  // Simulate motion detection
  const hasMotion = Math.random() > 0.7; // 30% chance of motion
  
  const event = {
    id: Date.now().toString(),
    cameraId,
    type: 'motion',
    detected: hasMotion,
    confidence: hasMotion ? Math.random() * 100 : 0,
    timestamp: new Date().toISOString(),
    snapshot: hasMotion ? `data:image/jpeg;base64,${generateTestImage()}` : null
  };
  
  motionEvents.push(event);
  
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(event));
}

// Generate test image (base64 encoded)
function generateTestImage() {
  // Simple 1x1 pixel JPEG in base64
  return '/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/2wBDAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/8AARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwA/8A8A';
}

// Stop stream
function stopStream(cameraId) {
  const stream = streams.get(cameraId);
  if (stream) {
    stream.kill();
    streams.delete(cameraId);
    console.log(`Stream stopped for camera: ${cameraId}`);
  }
}

// Add some test cameras
cameras.set('cam1', {
  id: 'cam1',
  name: 'Front Door',
  url: 'rtsp://example.com/front',
  status: 'online',
  location: 'Front Entrance'
});

cameras.set('cam2', {
  id: 'cam2', 
  name: 'Back Yard',
  url: 'rtsp://example.com/back',
  status: 'online',
  location: 'Back Yard'
});

// Start server
const PORT = 9753;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`SentryVision API server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/api/health`);
  console.log(`WebSocket: ws://localhost:9754`);
  console.log('Features: Streaming, Motion Detection, Camera Management');
});

// Create Socket.IO server for frontend compatibility
const io = new SocketIOServer(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

console.log('Socket.IO server initialized');

io.on('connection', (socket) => {
  console.log('Socket.IO client connected');
  
  socket.on('requestStream', (data) => {
    console.log('Stream request via Socket.IO:', data);
    handleStreamRequest(data.cameraId, null, null, socket);
  });
  
  socket.on('stopStream', (data) => {
    console.log('Stop stream via Socket.IO:', data);
    stopStream(data.cameraId);
  });
  
  socket.on('disconnect', () => {
    console.log('Socket.IO client disconnected');
  });
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('Shutting down gracefully...');
  streams.forEach(stream => stream.kill());
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('Shutting down gracefully...');
  streams.forEach(stream => stream.kill());
  process.exit(0);
});