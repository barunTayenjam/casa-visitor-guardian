// Complete SentryVision Backend for Podman Testing
// With authentication, API endpoints, and mock data

const express = require("express");
const cors = require("cors");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const app = express();
const port = 9753;

// In-memory user store
const users = [];

// Mock data
const cameras = [
  { id: 1, name: "Front Door", status: "online", type: "IP Camera", location: "Main Entrance" },
  { id: 2, name: "Backyard", status: "online", type: "IP Camera", location: "Back Yard" },
  { id: 3, name: "Garage", status: "offline", type: "Web Camera", location: "Garage" },
  { id: 4, name: "Living Room", status: "online", type: "IP Camera", location: "Downstairs" }
];

const events = [
  { id: 1, cameraId: 1, cameraName: "Front Door", type: "motion", timestamp: new Date(Date.now() - 3600000), severity: "info", thumbnail: "/events/motion_front_001.jpg" },
  { id: 2, cameraId: 2, cameraName: "Backyard", type: "person", timestamp: new Date(Date.now() - 7200000), severity: "warning", thumbnail: "/events/person_back_001.jpg" },
  { id: 3, cameraId: 1, cameraName: "Front Door", type: "motion", timestamp: new Date(Date.now() - 1800000), severity: "info", thumbnail: "/events/motion_front_002.jpg" }
];

// Middleware
app.use(cors());
app.use(express.json());

// JWT secret (in production, this should be from env)
const JWT_SECRET = "your-jwt-access-secret-256-bit-here-change-this";

// Generate JWT token
const generateToken = (user) => {
  return jwt.sign(
    { id: user.id, username: user.username },
    JWT_SECRET,
    { expiresIn: "24h" }
  );
};

// Auth middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: "Access token required" });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: "Invalid token" });
    }
    req.user = user;
    next();
  });
};

// Authentication endpoints
app.post("/api/auth/login", async (req, res) => {
  const { username, password } = req.body;
  
  // Create demo admin if doesn't exist
  let user = users.find(u => u.username === "admin");
  if (!user) {
    const hashedPassword = await bcrypt.hash("admin123", 10);
    user = {
      id: 1,
      username: "admin",
      password: hashedPassword,
      role: "admin"
    };
    users.push(user);
  }
  
  // Find user
  const foundUser = users.find(u => u.username === username);
  if (!foundUser) {
    return res.status(401).json({ error: "Invalid credentials" });
  }
  
  // Check password
  const validPassword = await bcrypt.compare(password, foundUser.password);
  if (!validPassword) {
    return res.status(401).json({ error: "Invalid credentials" });
  }
  
  // Return token
  const token = generateToken(foundUser);
  res.json({
    success: true,
    token,
    user: { 
      id: foundUser.id, 
      username: foundUser.username, 
      role: foundUser.role 
    },
    expiresIn: "24h"
  });
});

app.post("/api/auth/register", async (req, res) => {
  const { username, password, email } = req.body;
  
  // Check if user exists
  if (users.find(u => u.username === username)) {
    return res.status(400).json({ error: "Username already exists" });
  }
  
  // Hash password
  const hashedPassword = await bcrypt.hash(password, 10);
  
  // Create user
  const newUser = {
    id: users.length + 1,
    username,
    password: hashedPassword,
    email: email || `${username}@sentryvision.local`,
    role: "user"
  };
  
  users.push(newUser);
  
  const token = generateToken(newUser);
  res.json({
    success: true,
    token,
    user: { 
      id: newUser.id, 
      username: newUser.username, 
      role: newUser.role 
    },
    expiresIn: "24h"
  });
});

app.post("/api/auth/logout", (req, res) => {
  // In a real app, you'd blacklist the token
  res.json({ success: true, message: "Logged out successfully" });
});

app.get("/api/auth/profile", authenticateToken, (req, res) => {
  res.json({
    success: true,
    profile: {
      id: req.user.id,
      username: "admin",
      email: "admin@sentryvision.local",
      role: "admin",
      createdAt: new Date(),
      lastLogin: new Date()
    }
  });
});

// API endpoints (protected)
app.get("/api/cameras", authenticateToken, (req, res) => {
  res.json({
    success: true,
    data: cameras
  });
});

app.get("/api/events", authenticateToken, (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const cameraId = req.query.cameraId ? parseInt(req.query.cameraId) : null;
  
  let filteredEvents = events;
  if (cameraId) {
    filteredEvents = events.filter(e => e.cameraId === cameraId);
  }
  
  const start = (page - 1) * limit;
  const paginatedEvents = filteredEvents.slice(start, start + limit);
  
  res.json({
    success: true,
    data: paginatedEvents,
    pagination: {
      page,
      limit,
      total: filteredEvents.length,
      totalPages: Math.ceil(filteredEvents.length / limit)
    }
  });
});

app.get("/api/stats", authenticateToken, (req, res) => {
  res.json({
    success: true,
    data: {
      totalCameras: cameras.length,
      onlineCameras: cameras.filter(c => c.status === 'online').length,
      alertsToday: 3,
      eventsThisWeek: 12,
      storageUsed: "45.2 GB",
      storageTotal: "500 GB",
      systemUptime: "12 days",
      cpuUsage: 15.2,
      memoryUsage: 68.5
    }
  });
});

app.get("/api/settings", authenticateToken, (req, res) => {
  res.json({
    success: true,
    data: {
      general: {
        siteName: "SentryVision",
        timezone: "UTC",
        language: "en-US"
      },
      notifications: {
        emailAlerts: true,
        smsAlerts: false,
        motionDetection: true,
        sensitivity: "medium"
      },
      recording: {
        quality: "high",
        continuous: false,
        motionOnly: true,
        retentionDays: 30
      },
      security: {
        twoFactorAuth: false,
        sessionTimeout: 24,
        maxLoginAttempts: 5
      }
    }
  });
});

// Health and base endpoints
app.get("/api/health", (req, res) => {
  res.json({ 
    status: "ok", 
    message: "Backend is running",
    timestamp: new Date(),
    uptime: process.uptime(),
    memory: process.memoryUsage()
  });
});

app.get("/", (req, res) => {
  res.json({ 
    message: "SentryVision Backend API",
    version: "1.0.0",
    status: "running"
  });
});

// Error handling
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: "Internal server error" });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: "Endpoint not found" });
});

app.listen(port, "0.0.0.0", () => {
  console.log(`🚀 SentryVision Backend running on port ${port}`);
  console.log(`📱 Frontend URL: http://localhost:3000`);
  console.log(`🔧 Backend URL: http://localhost:9753`);
  console.log(`👤 Demo Credentials: admin / admin123`);
  console.log(`📊 API Docs: http://localhost:9753/api/health`);
});