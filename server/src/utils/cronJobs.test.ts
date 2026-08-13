import { describe, it, expect, jest, afterEach } from '@jest/globals';

jest.mock('../database.js');
jest.mock('../services/timelapse/timelapseService.js', () => ({
  TimelapseService: jest.fn().mockImplementation(() => ({
    startSampler: jest.fn(),
    stitchDate: jest.fn().mockResolvedValue([]),
    stitchYesterday: jest.fn().mockResolvedValue([]),
    cleanupOldFiles: jest.fn().mockResolvedValue(0),
  })),
}));
jest.mock('../services/serviceRegistry.js', () => ({
  serviceRegistry: {
    getTimelapseService: jest.fn().mockReturnValue({
      startSampler: jest.fn(),
      stitchDate: jest.fn().mockResolvedValue([]),
      stitchYesterday: jest.fn().mockResolvedValue([]),
      cleanupOldFiles: jest.fn().mockResolvedValue(0),
    }),
    getStreamManager: jest.fn().mockReturnValue({
      getAllCameras: jest.fn().mockReturnValue([]),
    }),
  },
}));
jest.mock('../services/notificationService.js', () => ({
  default: {
    cleanupExpiredSubscriptions: jest.fn().mockResolvedValue(3),
  },
}));

describe('Cron Jobs', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should start scheduled jobs without throwing', async () => {
    const { startCronJobs } = await import('../utils/cronJobs.js');
    const io = { emit: jest.fn() } as any;

    expect(() => startCronJobs(io)).not.toThrow();
  });

  it('should run startup cleanup', async () => {
    const { runStartupCleanup } = await import('../utils/cronJobs.js');
    await expect(runStartupCleanup()).resolves.not.toThrow();
  });

  it('should run startup timelapse catchup', async () => {
    const { runStartupTimelapseCatchup } = await import('../utils/cronJobs.js');
    await expect(runStartupTimelapseCatchup()).resolves.not.toThrow();
  });
});
