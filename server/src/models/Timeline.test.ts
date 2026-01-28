import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';

jest.mock('typeorm');

describe('Timeline Model', () => {
  let mockRepo: any;

  beforeEach(() => {
    mockRepo = {
      find: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should create timeline event entity', () => {
    const Timeline = require('./Timeline.js').Timeline;
    const event = new Timeline();
    
    event.source = 'tracked_object';
    event.class_type = 'person';
    event.camera = 'cam1';
    
    expect(event.source).toBe('tracked_object');
    expect(event.class_type).toBe('person');
    expect(event.camera).toBe('cam1');
  });

  it('should handle metadata', () => {
    const Timeline = require('./Timeline.js').Timeline;
    const event = new Timeline();
    const metadata = { object_id: '123', score: 0.95 };
    
    event.data = JSON.stringify(metadata);
    
    expect(event.data).toBe(JSON.stringify(metadata));
  });

  it('should validate timestamps', () => {
    const Timeline = require('./Timeline.js').Timeline;
    const event = new Timeline();
    
    event.timestamp = new Date('2024-01-15T10:30:00Z');
    
    expect(event.timestamp).toBeInstanceOf(Date);
    expect(event.timestamp.toISOString()).toContain('2024-01-15');
  });
});
