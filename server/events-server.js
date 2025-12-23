import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
  
  if (req.url === '/health' || req.url === '/api/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      status: 'ok', 
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    }));
  } else if (req.url === '/api/motion/events') {
    // Handle motion events endpoint
    try {
      const eventsDir = path.join(__dirname, 'public', 'events');
      let events = [];
      
      if (fs.existsSync(eventsDir)) {
        const files = fs.readdirSync(eventsDir).filter(file => file.endsWith('.jpg'));
        events = files.map(file => {
          const parts = file.split('_');
          const timestamp = parts[2]?.replace('.jpg', '') || new Date().toISOString();
          return {
            id: file,
            event_type: parts[0] || 'motion',
            file_path: `/events/${file}`,
            timestamp: new Date(timestamp.replace(/T(\d+)-(\d+)-(\d+)Z/, 'T$1:$2:$3.000Z')),
            camera_id: parts[1]?.replace('cam', '') || '1',
            confidence: 0.85,
            labels: [parts[0] || 'motion']
          };
        }).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      }
      
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        data: events,
        total: events.length
      }));
    } catch (error) {
      console.error('Error getting motion events:', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: false,
        error: 'Failed to get motion events'
      }));
    }
  } else if (req.url === '/api/events/history') {
    // Handle events history endpoint (same as motion events for now)
    try {
      const eventsDir = path.join(__dirname, 'public', 'events');
      let events = [];
      
      if (fs.existsSync(eventsDir)) {
        const files = fs.readdirSync(eventsDir).filter(file => file.endsWith('.jpg'));
        events = files.map(file => {
          const parts = file.split('_');
          const timestamp = parts[2]?.replace('.jpg', '') || new Date().toISOString();
          return {
            id: file,
            event_type: parts[0] || 'motion',
            file_path: `/events/${file}`,
            timestamp: new Date(timestamp.replace(/T(\d+)-(\d+)-(\d+)Z/, 'T$1:$2:$3.000Z')),
            camera_id: parts[1]?.replace('cam', '') || '1',
            confidence: 0.85,
            labels: [parts[0] || 'motion']
          };
        }).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      }
      
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        data: events,
        pagination: {
          page: 1,
          pageSize: events.length,
          total: events.length,
          totalPages: 1
        }
      }));
    } catch (error) {
      console.error('Error getting historical events:', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: false,
        error: 'Failed to get historical events'
      }));
    }
  } else if (req.url?.startsWith('/events/')) {
    // Serve static event files
    const filePath = path.join(__dirname, 'public', req.url);
    if (fs.existsSync(filePath)) {
      const stat = fs.statSync(filePath);
      res.writeHead(200, { 
        'Content-Type': 'image/jpeg',
        'Content-Length': stat.size
      });
      fs.createReadStream(filePath).pipe(res);
    } else {
      res.writeHead(404);
      res.end('File not found');
    }
  } else {
    // Default response
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      message: 'SentryVision Events Server',
      endpoints: ['/health', '/api/motion/events', '/api/events/history'],
      status: 'running'
    }));
  }
});

const PORT = 9753;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Events server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`Motion events: http://localhost:${PORT}/api/motion/events`);
  console.log(`Events history: http://localhost:${PORT}/api/events/history`);
});