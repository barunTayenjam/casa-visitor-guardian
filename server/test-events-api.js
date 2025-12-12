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
      return [];
    }
    
    const files = fs.readdirSync(eventsDir).filter(file => file.endsWith('.jpg'));
    
    return files.slice(0, 20).map((filename, index) => {
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
  
  if (req.url === '/health' || req.url === '/api/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      status: 'ok', 
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    }));
    return;
  }
  
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
  
  // Default response
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ 
    message: 'SentryVision API Server',
    endpoints: ['/api/health', '/api/events/history', '/api/motion/events', '/api/test/motion']
  }));
});

const PORT = 9753;
server.listen(PORT, () => {
  console.log(`🚀 SentryVision API Server started on port ${PORT}`);
  console.log(`📊 Events API: http://localhost:${PORT}/api/events/history`);
  console.log(`🔧 Health check: http://localhost:${PORT}/api/health`);
  console.log(`🧪 Test motion: http://localhost:${PORT}/api/test/motion`);
});