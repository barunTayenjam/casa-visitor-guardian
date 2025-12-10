import express from 'express';
import cors from 'cors';

const app = express();

// Basic middleware
app.use(cors());
app.use(express.json());

// Simple test endpoint - no middleware, no database, no logging
app.get('/test', (req, res) => {
  console.log('Test endpoint called');
  res.json({ message: 'Test successful', timestamp: new Date().toISOString() });
});

// Health endpoint
app.get('/health', (req, res) => {
  console.log('Health endpoint called');
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

const PORT = 9754;
app.listen(PORT, () => {
  console.log(`Minimal test server started on port ${PORT}`);
});