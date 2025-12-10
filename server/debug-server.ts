import express from 'express';
import http from 'http';
import cors from 'cors';

const app = express();

// Minimal middleware
app.use(cors());
app.use(express.json());

// Add request logging middleware to see where it hangs
app.use((req, res, next) => {
  console.log(`REQUEST: ${req.method} ${req.url}`);
  next();
});

// Basic routes - BEFORE any other routes
app.get('/health', (req, res) => {
  console.log('Health endpoint handler reached');
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

app.get('/test', (req, res) => {
  console.log('Test endpoint handler reached');
  res.json({ message: 'Test successful' });
});

// Create HTTP server
const server = http.createServer(app);

// Start server
const PORT = 9753;
server.listen(PORT, () => {
  console.log(`Debug server started on port ${PORT}`);
});