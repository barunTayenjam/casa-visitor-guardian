import http from 'http';

const server = http.createServer((req, res) => {
  console.log(`Request: ${req.method} ${req.url}`);
  
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }
  
  if (req.url === '/api/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      status: 'ok', 
      message: 'SentryVision API is running',
      timestamp: new Date().toISOString()
    }));
  } else if (req.url === '/test') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ message: 'Test successful', timestamp: new Date().toISOString() }));
  } else {
    // For any other route, try to serve the frontend
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      message: 'SentryVision Monolithic Container',
      endpoints: ['/api/health', '/test'],
      status: 'running'
    }));
  }
});

const PORT = 9753;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Simple API server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/api/health`);
});