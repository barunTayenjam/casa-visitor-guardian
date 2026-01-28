import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { Event } from './Event.js';

describe('Event Model', () => {
  let mockAppDataSource: any;

  beforeEach(() => {
    mockAppDataSource = {
      getRepository: jest.fn().mockReturnValue({
        create: jest.fn(),
        findOne: jest.fn(),
        find: jest.fn(),
        save: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      }),
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Event entity', () => {
    it('should create a new Event instance', () => {
      const event = new Event();
      event.event_type = 'motion';
      event.file_path = '/path/to/snapshot.jpg';
      event.camera_id = 'cam1';
      
      expect(event.event_type).toBe('motion');
      expect(event.file_path).toBe('/path/to/snapshot.jpg');
      expect(event.camera_id).toBe('cam1');
    });

    it('should set default values', () => {
      const event = new Event();
      
      expect(event.thumbnail_path).toBeNull();
      expect(event.metadata).toBeNull();
    });

    it('should handle metadata JSON', () => {
      const event = new Event();
      const metadata = {
        object_count: 3,
        confidence: 0.85,
        objects: ['person', 'car']
      };
      
      event.metadata = JSON.stringify(metadata);
      
      expect(event.metadata).toBe(JSON.stringify(metadata));
    });
  });

  describe('Event types', () => {
    it('should support motion event type', () => {
      const event = new Event();
      event.event_type = 'motion';
      
      expect(event.event_type).toBe('motion');
    });

    it('should support person detection event type', () => {
      const event = new Event();
      event.event_type = 'person';
      
      expect(event.event_type).toBe('person');
    });

    it('should support car detection event type', () => {
      const event = new Event();
      event.event_type = 'car';
      
      expect(event.event_type).toBe('car');
    });
  });
});
