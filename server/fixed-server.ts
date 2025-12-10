import express from 'express';
import http from 'http';

const app = express();
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

const server = http.createServer(app);

// Use Promise-based approach to ensure proper binding
const startServer = () => {
  return new Promise((resolve, reject) => {
    server.on('error', reject);
    server.listen(9753, () => {
      console.log(`Server started successfully on port 9753`);
      resolve(server);
    });
  });
};

startServer().catch(error => {
  console.error('Failed to start server:', error);
  process.exit(1);
});