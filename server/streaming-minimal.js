import http from 'http';
import { spawn } from 'child_process';

// In-memory storage
const cameras = new Map();
const streams = new Map();
const motionEvents = [];

// Initialize cameras
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
      message: 'SentryVision Streaming API is running',
      timestamp: new Date().toISOString(),
      features: ['streaming', 'motion-detection', 'cameras', 'event-storage']
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
  } else if (url === '/api/test/stream') {
    // Test endpoint to generate motion events
    generateTestEvents();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      message: 'Generated test motion events',
      totalEvents: motionEvents.length
    }));
  } else {
    // Serve default response
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      message: 'SentryVision Streaming Container',
      endpoints: [
        '/api/health', 
        '/api/cameras', 
        '/api/events', 
        '/api/stream/:id', 
        '/api/detect/:id',
        '/api/test/stream'
      ],
      status: 'running',
      eventCount: motionEvents.length
    }));
  }
});

// Handle streaming requests
function handleStreamRequest(cameraId, res) {
  console.log(`Stream requested for camera: ${cameraId}`);
  
  // Simulate camera stream using FFmpeg test pattern
  const ffmpeg = spawn('ffmpeg', [
    '-f', 'lavfi',
    '-i', 'testsrc=duration=10:size=320x240:rate=10',
    '-f', 'mpegts',
    '-codec:v', 'mpeg1video',
    '-qscale:v', '3',
    '-'
  ]);
  
  streams.set(cameraId, ffmpeg);
  
  // HTTP streaming response
  res.writeHead(200, {
    'Content-Type': 'video/mpeg',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive'
  });
  
  ffmpeg.stdout.on('data', (data) => {
    res.write(data);
  });
  
  ffmpeg.on('close', (code) => {
    console.log(`FFmpeg process closed with code ${code}`);
    res.end();
    streams.delete(cameraId);
  });
  
  ffmpeg.on('error', (error) => {
    console.error('FFmpeg error:', error);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Streaming failed' }));
    streams.delete(cameraId);
  });
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
    snapshot: hasMotion ? generateTestImage() : null
  };
  
  // Save event to memory (in real app, would save to database)
  motionEvents.push(event);
  
  console.log(`Motion event created: ${event.detected ? 'DETECTED' : 'NO MOTION'} (confidence: ${event.confidence.toFixed(1)}%)`);
  
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(event));
}

// Generate test events
function generateTestEvents() {
  const cameraIds = ['cam1', 'cam2'];
  for (let i = 0; i < 5; i++) {
    const cameraId = cameraIds[Math.floor(Math.random() * cameraIds.length)];
    const event = {
      id: (Date.now() + i).toString(),
      cameraId,
      type: 'motion',
      detected: Math.random() > 0.3,
      confidence: Math.random() * 100,
      timestamp: new Date(Date.now() - i * 60000).toISOString(), // Spread over last 5 minutes
      snapshot: generateTestImage()
    };
    motionEvents.push(event);
  }
  console.log(`Generated 5 test motion events. Total events: ${motionEvents.length}`);
}

// Generate test image (base64 encoded)
function generateTestImage() {
  // Simple 1x1 pixel JPEG in base64
  return '/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/2wBDAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/8AARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwA/8A8A';
}

// Start server
const PORT = 9753;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 SentryVision Streaming API running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
  console.log(`📹 Cameras: http://localhost:${PORT}/api/cameras`);
  console.log(`📊 Events: http://localhost:${PORT}/api/events`);
  console.log(`🎥 Stream: http://localhost:${PORT}/api/stream/cam1`);
  console.log(`🔍 Detection: http://localhost:${PORT}/api/detect/cam1`);
  console.log(`🧪 Test Events: http://localhost:${PORT}/api/test/stream`);
  console.log('Features: Real FFmpeg Streaming, Motion Detection, Event Storage');
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