import http from 'http';

console.log('Creating raw HTTP server...');

const server = http.createServer((req, res) => {
  console.log('Request received:', req.method, req.url);
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Hello World!');
});

console.log('HTTP server created');

const PORT = 9757;
const HOST = '127.0.0.1'; // Explicitly bind to localhost

server.listen(PORT, HOST)
  .on('listening', () => {
    console.log(`RAW HTTP server started on http://${HOST}:${PORT}`);
  })
  .on('error', (err) => {
    console.error('Server error:', err);
  });

console.log('Listen called...');