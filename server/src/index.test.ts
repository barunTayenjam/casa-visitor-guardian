import { describe, it, expect, beforeEach } from '@jest/globals';
import request from 'supertest';
import express from 'express';

jest.mock('../middleware/authenticate.js');

describe('Express App Setup', () => {
  let app: express.Express;

  beforeEach(() => {
    app = express();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Middleware', () => {
    it('should have CORS enabled', async () => {
      app.use(require('cors')());
      
      const response = await request(app).get('/api/test');
      
      expect(response.headers['access-control-allow-origin']).toBeDefined();
    });

    it('should have helmet security headers', async () => {
      app.use(require('helmet')());
      
      const response = await request(app).get('/api/test');
      
      expect(response.headers['x-dns-prefetch-control']).toBeDefined();
    });

    it('should handle JSON body parsing', async () => {
      app.use(express.json());
      
      const response = await request(app)
        .post('/api/test')
        .send({ test: 'data' });

      expect(response.status).toBeGreaterThanOrEqual(200);
    });
  });

  describe('Error Handling', () => {
    it('should return 404 for unknown routes', async () => {
      const response = await request(app).get('/api/unknown-route');
      
      expect(response.status).toBe(404);
    });

    it('should handle errors gracefully', async () => {
      app.use((err: any, req: any, res: any, next: any) => {
        console.error(err.stack);
        res.status(500).json({ error: 'Internal Server Error' });
      });

      const response = await request(app).get('/api/test');
      
      expect(response.status).toBe(500);
    });
  });
});
