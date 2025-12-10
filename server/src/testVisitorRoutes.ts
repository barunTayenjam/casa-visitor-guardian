import express from 'express';

export function addTestVisitorRoute(app: express.Application): void {
  console.log('*** ADDING SIMPLE TEST VISITOR ROUTE ***');
  
  // Add directly to app (not through router)
  app.get('/api/visitors/simple-test', (req, res) => {
    try {
      console.log('*** SIMPLE TEST HIT ***');
      console.log('Request method:', req.method);
      console.log('Request URL:', req.url);
      console.log('Request headers:', req.headers);
      
      res.json({
        success: true,
        message: 'Simple test route working',
        timestamp: new Date().toISOString(),
        requestInfo: {
          method: req.method,
          url: req.url,
          headers: Object.fromEntries(Object.entries(req.headers)),
          ip: req.ip,
          userAgent: req.get('User-Agent')
        }
      });
    } catch (error) {
      console.error('Error in simple test:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });
  
  console.log('*** SIMPLE TEST VISITOR ROUTE ADDED ***');
}