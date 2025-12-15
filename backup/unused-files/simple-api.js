import http from 'http';

// Simple HTTP server for testing
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
      message: 'SentryVision Simple API is running',
      timestamp: new Date().toISOString(),
      features: ['basic-api', 'health-check']
    }));
  } else if (url === '/api/cameras') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      cameras: [
        { id: 'cam1', name: 'Front Door', status: 'online', location: 'Front Entrance' },
        { id: 'cam2', name: 'Back Yard', status: 'online', location: 'Back Yard' }
      ],
      count: 2
    }));
  } else if (url === '/api/events') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      events: [
        { id: '1', cameraId: 'cam1', type: 'motion', timestamp: new Date().toISOString() },
        { id: '2', cameraId: 'cam2', type: 'motion', timestamp: new Date().toISOString() }
      ],
      count: 2
    }));
  } else {
    // Serve default response
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      message: 'SentryVision Ultra-Simple Container',
      endpoints: ['/api/health', '/api/cameras', '/api/events'],
      status: 'running'
    }));
  }
});

// Start server
const PORT = 9753;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 SentryVision Ultra-Simple API running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
  console.log(`📹 Cameras: http://localhost:${PORT}/api/cameras`);
  console.log(`📊 Events: http://localhost:${PORT}/api/events`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('Shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('Shutting down gracefully...');
  process.exit(0);
});