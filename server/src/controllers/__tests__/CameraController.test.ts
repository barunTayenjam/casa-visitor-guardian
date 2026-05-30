import { describe, it, expect, jest, beforeEach } from '@jest/globals';

jest.mock('../../utils/logger.js', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    apiRequest: jest.fn(),
    apiResponse: jest.fn(),
    apiError: jest.fn(),
    socketConnect: jest.fn(),
    socketDisconnect: jest.fn(),
    socketError: jest.fn(),
    streamRequest: jest.fn(),
    streamStop: jest.fn(),
    serverStart: jest.fn(),
    corsBlock: jest.fn(),
    motionDetected: jest.fn(),
    motionError: jest.fn(),
    performance: jest.fn(),
    memoryUsage: jest.fn(),
  },
}));

import { CameraController } from '../CameraController.js';
import { serviceRegistry } from '../../services/serviceRegistry.js';

function createMockRes(): any {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
}

describe('CameraController', () => {
  let controller: CameraController;
  let mockStreamManager: any;
  let spyGetStreamManager: any;

  beforeEach(() => {
    jest.restoreAllMocks();
    controller = new CameraController();

    mockStreamManager = {
      getAllCameras: jest.fn(),
      addCamera: jest.fn(),
      getCamera: jest.fn(),
      updateCamera: jest.fn(),
      removeCamera: jest.fn(),
    };

    spyGetStreamManager = jest.spyOn(serviceRegistry, 'getStreamManager').mockReturnValue(mockStreamManager);
  });

  describe('listAll', () => {
    it('should return cameras array with status 200', () => {
      mockStreamManager.getAllCameras.mockReturnValue([
        {
          id: 'cam1',
          name: 'Front Door',
          isActive: true,
          config: {
            nightMode: false,
            streams: [{ path: 'rtsp://example.com' }],
            objects: { track: ['person'] },
            zones: [],
          },
        },
      ]);

      const req: any = { ip: '127.0.0.1', get: jest.fn() };
      const res = createMockRes();

      controller.listAll(req, res);

      expect(spyGetStreamManager).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          cameras: expect.arrayContaining([
            expect.objectContaining({
              id: 'cam1',
              name: 'Front Door',
              status: 'online',
            }),
          ]),
        })
      );
    });

    it('should return empty cameras when streamManager not initialized', () => {
      spyGetStreamManager.mockReturnValue(null);

      const req: any = { ip: '127.0.0.1', get: jest.fn() };
      const res = createMockRes();

      controller.listAll(req, res);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          cameras: [],
        })
      );
    });
  });

  describe('getById', () => {
    it('should return 200 for existing camera', () => {
      const camera = { id: 'cam1', name: 'Front Door', isActive: true };
      mockStreamManager.getAllCameras.mockReturnValue([camera]);

      const req: any = { params: { id: 'cam1' } };
      const res = createMockRes();

      controller.getById(req, res);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          camera: expect.objectContaining({ id: 'cam1' }),
        })
      );
    });

    it('should return 404 for non-existent camera', () => {
      mockStreamManager.getAllCameras.mockReturnValue([]);

      const req: any = { params: { id: 'nonexistent' } };
      const res = createMockRes();

      controller.getById(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'Camera not found',
        })
      );
    });
  });

  describe('create', () => {
    it('should return 201 with cameraId for valid camera data', () => {
      mockStreamManager.addCamera.mockReturnValue('new-cam-id');

      const req: any = {
        body: {
          name: 'Back Yard',
          rtspUrl: 'rtsp://example.com/stream',
          frameRate: 5,
          resolution: '1920x1080',
        },
      };
      const res = createMockRes();

      controller.create(req, res);

      expect(mockStreamManager.addCamera).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Back Yard',
          enabled: true,
        })
      );
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          cameraId: 'new-cam-id',
        })
      );
    });
  });
});
