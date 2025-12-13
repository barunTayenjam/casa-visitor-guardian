import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 9754;

// Serve static files from public directory
app.use('/events', express.static(path.join(__dirname, 'server/public/events')));
app.use('/snapshots', express.static(path.join(__dirname, 'server/public/snapshots')));
app.use('/public', express.static(path.join(__dirname, 'server/public')));

// Test endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Static file server running' });
});

app.listen(PORT, () => {
  console.log(`Static file server running on port ${PORT}`);
  console.log(`Events: http://localhost:${PORT}/events/`);
  console.log(`Snapshots: http://localhost:${PORT}/snapshots/`);
});