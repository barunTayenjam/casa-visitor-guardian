import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';

jest.mock('../database.js');

describe('Cron Jobs', () => {
  let mockAppDataSource: any;
  let mockRepo: any;

  beforeEach(() => {
    mockAppDataSource = {
      getRepository: jest.fn().mockReturnValue({
        find: jest.fn(),
        update: jest.fn(),
        save: jest.fn(),
        delete: jest.fn(),
      }),
    };
    
    jest.mock('../database.js', () => ({
      AppDataSource: mockAppDataSource,
    }));

    mockRepo = mockAppDataSource.getRepository();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should define scheduled jobs', () => {
    const { scheduledJobs } = require('../utils/cronJobs.js');
    
    expect(scheduledJobs).toBeInstanceOf(Array);
    expect(scheduledJobs.length).toBeGreaterThan(0);
  });

  it('should have job configuration', () => {
    const { scheduledJobs } = require('../utils/cronJobs.js');
    const job = scheduledJobs[0];
    
    expect(job).toHaveProperty('name');
    expect(job).toHaveProperty('schedule');
    expect(job).toHaveProperty('handler');
  });

  it('should execute cleanup job handler', async () => {
    const { cleanupJob } = require('../utils/cronJobs.js');
    
    await cleanupJob();
    
    expect(mockRepo.find).toHaveBeenCalled();
  });

  it('should cleanup old events', async () => {
    const { cleanupOldEvents } = require('../utils/cronJobs.js');
    
    mockRepo.find.mockResolvedValue([
      { id: '1', timestamp: new Date('2023-01-01') }
    ]);
    
    await cleanupOldEvents(30);
    
    expect(mockRepo.find).toHaveBeenCalled();
  });
});
