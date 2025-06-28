console.log('*** SIMPLE TEST SERVER STARTING ***');

import express from 'express';
import http from 'http';

console.log('*** BASIC MODULES LOADED ***');

const app = express();
const server = http.createServer(app);

const PORT = 9753;

app.get('/test', (req, res) => {
  res.json({ message: 'Test server working!' });
});

server.listen(PORT, () => {
  console.log(`*** TEST SERVER RUNNING ON PORT ${PORT} ***`);
  console.log('*** If you see this, basic Node.js setup is working ***');
});