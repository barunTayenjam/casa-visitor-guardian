import http from 'http';
import fs from 'fs';
import path from 'path';

const __filename = new URL(import.meta.url).pathname;
const __dirname = path.dirname(__filename);

// Load motion events from file system
function loadMotionEvents() {
  try {
    const eventsDir = path.join(__dirname, 'public/events');
    if (!fs.existsSync(eventsDir)) {
      console.log('Events directory not found:', eventsDir);
      return [];
    }
    
    const files = fs.readdirSync(eventsDir).filter(file => file.endsWith('.jpg'));
    console.log(`Found ${files.length} event files`);
    
    return files.slice(0, 50).map((filename, index) => {
      const filePath = path.join(eventsDir, filename);
      const stats = fs.statSync(filePath);
      
      // Extract camera ID from filename
      const cameraMatch = filename.match(/(cam\d+)_/);
      const cameraId = cameraMatch ? cameraMatch[1] : 'unknown';
      
      return {
        id: `motion_${index + 1}`,
        cameraId,
        timestamp: stats.mtime.toISOString(),
        imagePath: `/events/${filename}`,
        confidence: 0.7 + Math.random() * 0.3,
        duration: 2000 + Math.floor(Math.random() * 8000),
        cameraName: cameraId === 'cam1' ? 'Front Door' : 'Back Door',
        labels: filename.includes('faces') ? ['face', 'motion'] : ['motion'],
        location: cameraId === 'cam1' ? 'Front Entrance' : 'Back Entrance'
      };
    }).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  } catch (error) {
    console.error('Error loading motion events:', error);
    return [];
  }
}

// Serve static files (events images)
function serveStaticFile(req, res, filePath) {
  const fullPath = path.join(__dirname, filePath);
  if (fs.existsSync(fullPath)) {
    const ext = path.extname(fullPath);
    const contentType = ext === '.jpg' ? 'image/jpeg' : 'application/octet-stream';
    
    res.writeHead(200, { 
      'Content-Type': contentType,
      'Access-Control-Allow-Origin': '*'
    });
    fs.createReadStream(fullPath).pipe(res);
  } else {
    res.writeHead(404);
    res.end();
  }
}

const server = http.createServer((req, res) => {
  console.log(`${req.method} ${req.url}`);
  
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }
  
  // Health check
  if (req.url === '/health' || req.url === '/api/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      status: 'ok', 
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    }));
    return;
  }
  
  // Events API
  if (req.url === '/api/events/history' || req.url === '/api/motion/events') {
    const events = loadMotionEvents();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      success: true, 
      events: events,
      pagination: {
        currentPage: 1,
        pageSize: events.length,
        totalEvents: events.length,
        totalPages: 1
      }
    }));
    return;
  }
  
  // Test motion trigger
  if (req.url?.startsWith('/api/test/motion')) {
    const testEvent = {
      id: `test_motion_${Date.now()}`,
      cameraId: 'cam1',
      timestamp: new Date().toISOString(),
      imagePath: '/events/faces_cam1_1760618163997.jpg',
      confidence: 0.95,
      duration: 4000,
      cameraName: 'Front Door',
      labels: ['motion', 'test'],
      location: 'Front Entrance'
    };
    
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      success: true, 
      message: 'Manual motion event created',
      event: testEvent
    }));
    return;
  }
  
  // Serve static event images
  if (req.url?.startsWith('/events/')) {
    serveStaticFile(req, res, req.url);
    return;
  }
  
  // Default response
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ 
    message: 'SentryVision API Server',
    endpoints: ['/api/health', '/api/events/history', '/api/motion/events', '/api/test/motion'],
    status: 'running'
  }));
});

const PORT = 9753;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 SentryVision API Server started on port ${PORT}`);
  console.log(`📊 Events API: http://localhost:${PORT}/api/events/history`);
  console.log(`🖼️  Events images: http://localhost:${PORT}/events/`);
  console.log(`🔧 Health check: http://localhost:${PORT}/api/health`);
  console.log(`🧪 Test motion: http://localhost:${PORT}/api/test/motion`);
});