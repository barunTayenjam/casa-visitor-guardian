import http from 'http';

const server = http.createServer((req, res) => {
  console.log(`Request received: ${req.method} ${req.url}`);
  
  res.writeHead(200, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*'
  });
  
  if (req.url === '/test') {
    res.end(JSON.stringify({ message: 'Test successful', timestamp: new Date().toISOString() }));
  } else if (req.url === '/health') {
    res.end(JSON.stringify({ status: 'ok', timestamp: new Date().toISOString() }));
  } else {
    res.end(JSON.stringify({ message: 'Hello World' }));
  }
});

const PORT = 9755;
server.listen(PORT, () => {
  console.log(`Simple HTTP server started on port ${PORT}`);
});