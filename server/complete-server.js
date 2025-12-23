import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Simple in-memory user store (for demo purposes)
const users = [
  {
    id: '1',
    username: 'admin',
    email: 'admin@sentryvision.local',
    password: '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj6hsxq9w5GS', // password: admin123
    role: 'admin',
    createdAt: new Date().toISOString()
  }
];

// Simple JWT-like token store
const tokens = new Map();

// Simple password hashing (for demo)
function hashPassword(password) {
  return crypto.createHash('sha256').update(password + 'sentryvision-salt').digest('hex');
}

// Generate simple token
function generateToken(user) {
  const token = crypto.randomBytes(32).toString('hex');
  tokens.set(token, { userId: user.id, expires: Date.now() + 24 * 60 * 60 * 1000 }); // 24 hours
  return token;
}

// Verify token
function verifyToken(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: 'No token provided' });
  }
  
  const token = authHeader.substring(7);
  const tokenData = tokens.get(token);
  
  if (!tokenData || tokenData.expires < Date.now()) {
    return res.status(401).json({ success: false, error: 'Invalid or expired token' });
  }
  
  req.user = users.find(u => u.id === tokenData.userId);
  next();
}

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

  // Parse body for POST requests
  let body = '';
  req.on('data', chunk => {
    body += chunk.toString();
  });
  
  req.on('end', () => {
    try {
      req.body = body ? JSON.parse(body) : {};
      handleRequest(req, res);
    } catch (error) {
      console.error('Error parsing body:', error);
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: 'Invalid JSON' }));
    }
  });
});

function handleRequest(req, res) {
  const url = req.url;
  
  // Health endpoint
  if (url === '/health' || url === '/api/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      status: 'ok', 
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    }));
    return;
  }

  // Auth endpoints
  if (url === '/api/auth/login' && req.method === 'POST') {
    const { username, password } = req.body;
    const user = users.find(u => u.username === username);
    
    if (!user || hashPassword(password) !== hashPassword('admin123')) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ 
        success: false, 
        error: 'Invalid credentials' 
      }));
      return;
    }
    
    const token = generateToken(user);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      success: true,
      data: {
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role
        },
        token,
        refreshToken: token // Same token for demo
      }
    }));
    return;
  }

  if (url === '/api/auth/profile') {
    // Mock profile response
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      success: true,
      data: {
        id: '1',
        username: 'admin',
        email: 'admin@sentryvision.local',
        role: 'admin',
        createdAt: new Date().toISOString()
      }
    }));
    return;
  }

  if (url === '/api/auth/register' && req.method === 'POST') {
    const { username, email, password } = req.body;
    
    // Check if user exists
    if (users.find(u => u.username === username || u.email === email)) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ 
        success: false, 
        error: 'User already exists' 
      }));
      return;
    }
    
    // Create new user
    const newUser = {
      id: String(users.length + 1),
      username,
      email,
      password: hashPassword(password),
      role: 'user',
      createdAt: new Date().toISOString()
    };
    
    users.push(newUser);
    const token = generateToken(newUser);
    
    res.writeHead(201, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      success: true,
      data: {
        user: {
          id: newUser.id,
          username: newUser.username,
          email: newUser.email,
          role: newUser.role
        },
        token,
        refreshToken: token
      }
    }));
    return;
  }

  // Motion events endpoint
  if (url === '/api/motion/events') {
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
    return;
  }

  // Events history endpoint
  if (url === '/api/events/history') {
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
    return;
  }

  // Serve static event files
  if (url?.startsWith('/events/')) {
    const filePath = path.join(__dirname, 'public', url);
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
    return;
  }

  // Default response
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ 
    message: 'SentryVision Complete Server',
    endpoints: ['/health', '/api/auth/login', '/api/auth/register', '/api/auth/profile', '/api/motion/events', '/api/events/history'],
    status: 'running'
  }));
}

const PORT = 9753;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Complete SentryVision server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`Login: http://localhost:${PORT}/api/auth/login`);
  console.log(`Motion events: http://localhost:${PORT}/api/motion/events`);
  console.log(`Events history: http://localhost:${PORT}/api/events/history`);
  console.log(`Default login: admin / admin123`);
});