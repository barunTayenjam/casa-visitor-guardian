import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import { validate, validateCameraCreation, handleValidationErrors, sanitizeInput } from '../middleware/validation.js';

describe('Validation Middleware', () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use(express.json());
  });

  describe('Camera Validation', () => {
    it('should pass validation for valid camera data', async () => {
      app.post('/cameras', validateCameraCreation, handleValidationErrors, (req, res) => {
        res.status(201).json({ success: true, data: req.body });
      });

      const validCamera = {
        id: 'cam1',
        name: 'Front Door Camera',
        rtspUrl: 'rtsp://192.168.1.100:554/stream',
        username: 'admin',
        password: 'password123',
        frameRate: 15,
        resolution: '1920x1080',
        nightMode: false
      };

      const response = await request(app)
        .post('/cameras')
        .send(validCamera)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe('Front Door Camera');
    });

    it('should fail validation for invalid camera ID', async () => {
      app.post('/cameras', validateCameraCreation, handleValidationErrors, (req, res) => {
        res.status(201).json({ success: true });
      });

      const invalidCamera = {
        id: 'cam@1', // Invalid character
        name: 'Front Door Camera',
        rtspUrl: 'rtsp://192.168.1.100:554/stream'
      };

      const response = await request(app)
        .post('/cameras')
        .send(invalidCamera)
        .expect(400);

      expect(response.body.error).toBe('Validation failed');
      expect(response.body.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: 'id',
            message: 'Camera ID can only contain letters, numbers, underscores, and hyphens'
          })
        ])
      );
    });

    it('should fail validation for invalid RTSP URL', async () => {
      app.post('/cameras', validateCameraCreation, handleValidationErrors, (req, res) => {
        res.status(201).json({ success: true });
      });

      const invalidCamera = {
        id: 'cam1',
        name: 'Front Door Camera',
        rtspUrl: 'http://example.com' // Wrong protocol
      };

      const response = await request(app)
        .post('/cameras')
        .send(invalidCamera)
        .expect(400);

      expect(response.body.error).toBe('Validation failed');
      expect(response.body.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: 'rtspUrl',
            message: 'RTSP URL must be a valid RTSP/RTSPS URL'
          })
        ])
      );
    });

    it('should fail validation for missing required fields', async () => {
      app.post('/cameras', validateCameraCreation, handleValidationErrors, (req, res) => {
        res.status(201).json({ success: true });
      });

      const incompleteCamera = {
        id: 'cam1'
        // Missing name and rtspUrl
      };

      const response = await request(app)
        .post('/cameras')
        .send(incompleteCamera)
        .expect(400);

      expect(response.body.error).toBe('Validation failed');
      expect(response.body.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: 'name',
            message: 'Camera name must be between 1 and 100 characters'
          }),
          expect.objectContaining({
            field: 'rtspUrl',
            message: 'RTSP URL must be a valid RTSP/RTSPS URL'
          })
        ])
      );
    });
  });

  describe('Input Sanitization', () => {
    it('should sanitize malicious script tags', async () => {
      app.post('/sanitize', sanitizeInput, (req, res) => {
        res.json({ sanitized: req.body });
      });

      const maliciousInput = {
        name: '<script>alert("xss")</script>Camera',
        description: 'javascript:alert("xss")',
        html: '<iframe src="malicious.com"></iframe>'
      };

      const response = await request(app)
        .post('/sanitize')
        .send(maliciousInput)
        .expect(200);

      expect(response.body.sanitized.name).not.toContain('<script>');
      expect(response.body.sanitized.description).not.toContain('javascript:');
      expect(response.body.sanitized.html).not.toContain('<iframe>');
    });

    it('should trim whitespace from string inputs', async () => {
      app.post('/trim', sanitizeInput, (req, res) => {
        res.json({ trimmed: req.body });
      });

      const inputWithWhitespace = {
        name: '  Camera Name  ',
        description: '\tDescription with spaces\t'
      };

      const response = await request(app)
        .post('/trim')
        .send(inputWithWhitespace)
        .expect(200);

      expect(response.body.trimmed.name).toBe('Camera Name');
      expect(response.body.trimmed.description).toBe('Description with spaces');
    });
  });

  describe('Query Parameter Validation', () => {
    it('should validate query parameters', async () => {
      app.get('/events', 
        validate([
          query('cameraId').optional().matches(/^[a-zA-Z0-9_-]+$/),
          query('limit').optional().isInt({ min: 1, max: 100 })
        ]),
        handleValidationErrors,
        (req, res) => {
          res.json({ query: req.query });
        }
      );

      const response = await request(app)
        .get('/events?cameraId=cam1&limit=50')
        .expect(200);

      expect(response.body.query.cameraId).toBe('cam1');
      expect(response.body.query.limit).toBe('50');
    });

    it('should fail validation for invalid query parameters', async () => {
      app.get('/events', 
        validate([
          query('cameraId').optional().matches(/^[a-zA-Z0-9_-]+$/),
          query('limit').optional().isInt({ min: 1, max: 100 })
        ]),
        handleValidationErrors,
        (req, res) => {
          res.json({ query: req.query });
        }
      );

      const response = await request(app)
        .get('/events?cameraId=cam@1&limit=200')
        .expect(400);

      expect(response.body.error).toBe('Validation failed');
      expect(response.body.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: 'cameraId'
          }),
          expect.objectContaining({
            field: 'limit'
          })
        ])
      );
    });
  });
});