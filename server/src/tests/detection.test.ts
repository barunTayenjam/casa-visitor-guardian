import OpenCVProcessor from '../detection/opencvProcessor';
import { ObjectDetectionService, objectDetectionService } from '../detection/objectDetection';
import { FacialRecognitionService, facialRecognitionService } from '../detection/facialRecognition';
import { SimpleMotionDetector } from '../detection/simpleMotionDetection';
import { OptimizedMotionDetector } from '../detection/optimizedMotionDetection';
import { StreamManager } from '../streams/rtspManager';
import { Server } from 'socket.io';

// Mock dependencies
jest.mock('../streams/rtspManager');
jest.mock('socket.io');

describe('Detection Services', () => {
  let streamManager: jest.Mocked<StreamManager>;
  let io: jest.Mocked<Server>;

  beforeAll(async () => {
    // It's important to initialize the processor to load OpenCV
    await OpenCVProcessor.initialize();

    // Wait for the services to be ready
    await Promise.all([
      new Promise<void>(resolve => objectDetectionService.on('modelLoaded', resolve)),
      new Promise<void>(resolve => facialRecognitionService.on('ready', resolve)),
    ]);
  }, 30000); // 30s timeout for model loading

  beforeEach(() => {
    streamManager = new StreamManager({} as any) as jest.Mocked<StreamManager>;
    io = new Server() as jest.Mocked<Server>;
  });

  describe('OpenCVProcessor', () => {
    it('should initialize without errors', () => {
      expect(OpenCVProcessor.isInitialized()).toBe(true);
    });
  });

  describe('SimpleMotionDetector', () => {
    it('should create an instance', () => {
      const detector = new SimpleMotionDetector(streamManager, io);
      expect(detector).toBeInstanceOf(SimpleMotionDetector);
    });
  });

  describe('OptimizedMotionDetector', () => {
    it('should create an instance', () => {
      const detector = new OptimizedMotionDetector(streamManager, io);
      expect(detector).toBeInstanceOf(OptimizedMotionDetector);
    });
  });

  describe('ObjectDetectionService', () => {
    it('should be a singleton instance', () => {
      expect(objectDetectionService).toBeInstanceOf(ObjectDetectionService);
    });

    it('should be ready', () => {
      expect(objectDetectionService.isReady()).toBe(true);
    });
  });

  describe('FacialRecognitionService', () => {
    it('should be a singleton instance', () => {
      expect(facialRecognitionService).toBeInstanceOf(FacialRecognitionService);
    });

    it('should be ready', () => {
      // This might be false if the DB or models are not ready,
      // but we are testing the class instantiation.
      // In a real test, we would mock the dependencies.
      expect(facialRecognitionService.isReady()).toBe(true);
    });
  });
});
