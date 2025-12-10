import express from 'express';
import http from 'http';

console.log('Starting debug server...');

const app = express();

console.log('Express app created');

// NO middleware at all - just raw routes

app.get('/health', (req, res) => {
  console.log('Health endpoint called!');
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ status: 'ok', message: 'Health check passed' }));
});

app.get('/test', (req, res) => {
  console.log('Test endpoint called!');
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ message: 'Test successful' }));
});

console.log('Routes configured');

const server = http.createServer(app);

console.log('HTTP server created');

const PORT = 9756;
server.listen(PORT, () => {
  console.log(`BARE server started on port ${PORT}`);
  console.log('Server should be responding now...');
});