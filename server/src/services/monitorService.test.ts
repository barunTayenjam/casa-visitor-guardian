import { describe, it, expect, jest, beforeEach, beforeAll } from '@jest/globals';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';

jest.unstable_mockModule('../database.js', () => ({
  AppDataSource: { query: jest.fn() },
}));

jest.unstable_mockModule('../utils/logger.js', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

jest.unstable_mockModule('./serviceRegistry.js', () => ({
  serviceRegistry: { getPythonWsClient: jest.fn() },
}));

const notifySystemAlertMock = jest.fn();
jest.unstable_mockModule('./notificationService.js', () => ({
  default: { notifySystemAlert: notifySystemAlertMock },
}));

describe('monitorService', () => {
  let AppDataSource: { query: jest.Mock };
  let serviceRegistry: { getPythonWsClient: jest.Mock };
  let mod: typeof import('./monitorService.js');

  beforeAll(async () => {
    const dbMod = await import('../database.js');
    AppDataSource = dbMod.AppDataSource;
    const regMod = await import('./serviceRegistry.js');
    serviceRegistry = regMod.serviceRegistry;
    mod = await import('./monitorService.js');
  });

  beforeEach(() => {
    AppDataSource.query.mockReset();
    notifySystemAlertMock.mockReset();
    serviceRegistry.getPythonWsClient.mockReset();
    AppDataSource.query.mockResolvedValue([{ n: 0 }]);
    serviceRegistry.getPythonWsClient.mockReturnValue({ connected: true });
    mod.resetMonitorAlertState();
  });

  it('getDiskUsage reports real filesystem values', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sv-disk-'));
    const usage = await mod.getDiskUsage(dir);
    fs.rmSync(dir, { recursive: true });

    expect(usage).not.toBeNull();
    expect(usage!.totalBytes).toBeGreaterThan(0);
    expect(usage!.freeBytes).toBeGreaterThan(0);
    expect(usage!.freePercent).toBeGreaterThan(0);
    expect(usage!.freePercent).toBeLessThanOrEqual(100);
  });

  it('getDiskUsage returns null for missing directory', async () => {
    expect(await mod.getDiskUsage('/nonexistent-path-xyz')).toBeNull();
  });

  it('alerts once on low disk and dedupes within cooldown', async () => {
    const lowDisk: import('./monitorService.js').DiskUsage = {
      freeBytes: 4e9,
      totalBytes: 100e9,
      freePercent: 4,
    };
    const fakeProvider = jest.fn().mockResolvedValue(lowDisk);

    const first = await mod.runMonitorChecks('/data', fakeProvider);
    const second = await mod.runMonitorChecks('/data', fakeProvider);

    expect(first.diskAlerted).toBe(true);
    expect(second.diskAlerted).toBe(false);
    expect(notifySystemAlertMock).toHaveBeenCalledTimes(1);
    expect(notifySystemAlertMock.mock.calls[0][0]).toBe('Low disk space');
  });

  it('does not alert on healthy disk', async () => {
    const result = await mod.runMonitorChecks(os.tmpdir());

    expect(result.diskAlerted).toBe(false);
    expect(notifySystemAlertMock).not.toHaveBeenCalled();
  });

  it('alerts when the detection pipeline is disconnected', async () => {
    serviceRegistry.getPythonWsClient.mockReturnValue({ connected: false });

    const result = await mod.runMonitorChecks(os.tmpdir());

    expect(result.pipelineConnected).toBe(false);
    expect(result.pipelineAlerted).toBe(true);
    expect(notifySystemAlertMock).toHaveBeenCalledWith(
      'Detection pipeline offline',
      expect.any(String),
    );
  });

  it('latches failed-job alerts until the queue recovers', async () => {
    AppDataSource.query.mockResolvedValue([{ n: 3 }]);

    const first = await mod.runMonitorChecks(os.tmpdir());
    const second = await mod.runMonitorChecks(os.tmpdir());
    AppDataSource.query.mockResolvedValue([{ n: 0 }]);
    const recovered = await mod.runMonitorChecks(os.tmpdir());
    AppDataSource.query.mockResolvedValue([{ n: 1 }]);
    const again = await mod.runMonitorChecks(os.tmpdir());

    expect(first.failedJobsAlerted).toBe(true);
    expect(second.failedJobsAlerted).toBe(false);
    expect(recovered.failedJobsAlerted).toBe(false);
    expect(again.failedJobsAlerted).toBe(true);
    expect(notifySystemAlertMock).toHaveBeenCalledTimes(2);
  });
});
