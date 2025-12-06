// Minimal SentryVision Backend with Authentication
const express = require("express");
const cors = require("cors");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const app = express();
const port = 9753;

// Mock user database
const users = [];

// Middleware
app.use(cors());
app.use(express.json());

// Generate JWT token
const generateToken = (user) => {
  return jwt.sign(
    { id: user.id, username: user.username },
    "your-jwt-access-secret-256-bit-here-change-this", // This should come from env
    { expiresIn: "1h" }
  );
};

// Login endpoint
app.post("/api/auth/login", async (req, res) => {
  const { username, password } = req.body;
  
  // Create demo admin user if doesn't exist
  const demoUser = users.find(u => u.username === "admin");
  if (!demoUser) {
    const hashedPassword = await bcrypt.hash("admin123", 10);
    users.push({
      id: 1,
      username: "admin",
      password: hashedPassword
    });
  }
  
  // Find user
  const user = users.find(u => u.username === username);
  if (!user) {
    return res.status(401).json({ error: "Invalid credentials" });
  }
  
  // Check password
  const validPassword = await bcrypt.compare(password, user.password);
  if (!validPassword) {
    return res.status(401).json({ error: "Invalid credentials" });
  }
  
  // Return token
  const token = generateToken(user);
  res.json({
    token,
    user: { id: user.id, username: user.username }
  });
});

// Register endpoint
app.post("/api/auth/register", async (req, res) => {
  const { username, password } = req.body;
  
  // Check if user exists
  if (users.find(u => u.username === username)) {
    return res.status(400).json({ error: "User already exists" });
  }
  
  // Hash password
  const hashedPassword = await bcrypt.hash(password, 10);
  
  // Create user
  const newUser = {
    id: users.length + 1,
    username,
    password: hashedPassword
  };
  
  users.push(newUser);
  
  const token = generateToken(newUser);
  res.json({
    token,
    user: { id: newUser.id, username: newUser.username }
  });
});

// Profile endpoint
app.get("/api/auth/profile", (req, res) => {
  // For demo, return mock profile
  res.json({
    id: 1,
    username: "admin",
    email: "admin@sentryvision.local",
    role: "admin"
  });
});

// Mock camera data
const mockCameras = [
  { id: 1, name: "Front Door", status: "online", type: "IP Camera" },
  { id: 2, name: "Backyard", status: "online", type: "IP Camera" },
  { id: 3, name: "Garage", status: "offline", type: "Web Camera" }
];

// API endpoints
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", message: "Backend is running" });
});

app.get("/", (req, res) => {
  res.json({ message: "SentryVision Backend API" });
});

app.get("/api/cameras", (req, res) => {
  res.json(mockCameras);
});

app.get("/api/stats", (req, res) => {
  res.json({
    totalCameras: mockCameras.length,
    onlineCameras: mockCameras.filter(c => c.status === "online").length,
    alertsToday: 3,
    storageUsed: "45.2 GB"
  });
});

app.get("/api/events", (req, res) => {
  res.json([
    { id: 1, camera: "Front Door", type: "motion", timestamp: new Date(), severity: "info" },
    { id: 2, camera: "Backyard", type: "person", timestamp: new Date(), severity: "warning" },
    { id: 3, camera: "Front Door", type: "motion", timestamp: new Date(), severity: "info" }
  ]);
});

app.listen(port, "0.0.0.0", () => {
  console.log(`SentryVision backend running on port ${port}`);
  console.log(`Demo credentials: admin / admin123`);
});