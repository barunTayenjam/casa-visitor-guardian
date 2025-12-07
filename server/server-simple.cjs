const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Health check endpoint for Docker
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    version: '1.0.0-test'
  });
});

app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    version: '1.0.0-test'
  });
});

app.get('/api/test', (req, res) => {
  res.json({ 
    message: 'Backend is working!',
    timestamp: new Date().toISOString()
  });
});

// Camera endpoints
app.get('/api/cameras', (req, res) => {
  const cameras = [
    {
      id: 'cam1',
      name: 'Front Door',
      rtspUrl: 'rtsp://192.168.1.100:554/stream1',
      status: 'online',
      lastSeen: new Date().toISOString(),
      thumbnail: null,
      frameRate: 15,
      resolution: '1920x1080',
      nightMode: false,
      motionDetection: true
    },
    {
      id: 'cam2',
      name: 'Back Door',
      rtspUrl: 'rtsp://192.168.1.101:554/stream1',
      status: 'online',
      lastSeen: new Date().toISOString(),
      thumbnail: null,
      frameRate: 15,
      resolution: '1920x1080',
      nightMode: false,
      motionDetection: true
    }
  ];
  res.json(cameras);
});

app.post('/api/cameras/:id/stream/start', (req, res) => {
  const { id } = req.params;
  console.log(`Starting stream for camera ${id}`);
  res.json({ success: true, message: `Stream started for camera ${id}` });
});

app.post('/api/cameras/:id/stream/stop', (req, res) => {
  const { id } = req.params;
  console.log(`Stopping stream for camera ${id}`);
  res.json({ success: true, message: `Stream stopped for camera ${id}` });
});

// Auth endpoints
app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;
  console.log(`Login attempt for user: ${username}`);
  
  // Simple authentication for testing
  if (username === 'admin' && password === 'admin') {
    res.json({
      success: true,
      data: {
        user: {
          id: '1',
          username: 'admin',
          email: 'admin@sentryvision.local',
          role: 'admin'
        },
        token: 'mock-jwt-token-for-testing',
        refreshToken: 'mock-refresh-token'
      }
    });
  } else {
    res.status(401).json({
      success: false,
      error: 'Invalid credentials'
    });
  }
});

app.post('/api/auth/register', (req, res) => {
  const { username, email, password } = req.body;
  console.log(`Registration attempt for user: ${username}`);
  
  res.json({
    success: true,
    data: {
      user: {
        id: '2',
        username,
        email,
        role: 'user'
      }
    }
  });
});

app.get('/api/auth/me', (req, res) => {
  res.json({
    success: true,
    data: {
      user: {
        id: '1',
        username: 'admin',
        email: 'admin@sentryvision.local',
        role: 'admin'
      }
    }
  });
});

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 9753;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Test server running on port ${PORT}`);
});