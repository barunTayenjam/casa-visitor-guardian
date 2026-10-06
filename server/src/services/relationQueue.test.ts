import { describe, it, expect, jest, beforeEach, beforeAll } from '@jest/globals';

jest.unstable_mockModule('../database.js', () => ({
  AppDataSource: {
    query: jest.fn(),
  },
}));

jest.unstable_mockModule('../utils/logger.js', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

const getEventRelationsMock = jest.fn();
jest.unstable_mockModule('./relationAnalysisService.js', () => ({
  relationAnalysisService: { getEventRelations: getEventRelationsMock },
}));

describe('relationQueue', () => {
  let AppDataSource: { query: jest.Mock };
  let mod: typeof import('./relationQueue.js');

  beforeAll(async () => {
    const dbMod = await import('../database.js');
    AppDataSource = dbMod.AppDataSource;
    mod = await import('./relationQueue.js');
  });

  beforeEach(() => {
    AppDataSource.query.mockReset();
    getEventRelationsMock.mockReset();
    AppDataSource.query.mockResolvedValue([]);
  });

  it('enqueue inserts with conflict tolerance', async () => {
    await mod.enqueueRelationJob('11111111-1111-4111-8111-111111111111');

    const call = AppDataSource.query.mock.calls[0];
    expect(call[0]).toContain('INSERT INTO relation_jobs');
    expect(call[0]).toContain('ON CONFLICT (event_id) DO NOTHING');
    expect(call[1]).toEqual(['11111111-1111-4111-8111-111111111111']);
  });

  it('straggler sweep only targets snapshot events with NULL relations', async () => {
    AppDataSource.query.mockResolvedValue([{ event_id: 'a' }, { event_id: 'b' }]);

    const count = await mod.enqueueStragglers(7, 500);

    expect(count).toBe(2);
    const sql = AppDataSource.query.mock.calls[0][0];
    expect(sql).toContain('e.relations IS NULL');
    expect(sql).toContain("e.file_path IS NOT NULL AND e.file_path <> ''");
    expect(sql).toContain('NOT EXISTS');
  });

  it('tick claims jobs and marks them done after analysis', async () => {
    AppDataSource.query.mockImplementation((sql: string) => {
      if (sql.includes('FOR UPDATE SKIP LOCKED')) {
        // TypeORM wraps UPDATE...RETURNING as [rows, rowCount]
        return [
          [
            { id: 1, event_id: '11111111-1111-4111-8111-111111111111', attempts: 1 },
            { id: 2, event_id: '22222222-2222-4222-8222-222222222222', attempts: 1 },
          ],
          2,
        ];
      }
      return [];
    });
    getEventRelationsMock.mockResolvedValue({ relations: [{ predicate: 'near' }], source: 'computed' });

    const processed = await mod.runRelationWorkerTick();

    expect(processed).toBe(2);
    expect(getEventRelationsMock).toHaveBeenCalledTimes(2);
    expect(getEventRelationsMock).toHaveBeenCalledWith('11111111-1111-4111-8111-111111111111');
    const doneUpdates = AppDataSource.query.mock.calls.filter((c) =>
      String(c[0]).includes("SET status = 'done'"),
    );
    expect(doneUpdates).toHaveLength(2);
  });

  it('accepts plain-array claim shapes from non-typeorm drivers', async () => {
    AppDataSource.query.mockImplementation((sql: string) => {
      if (sql.includes('FOR UPDATE SKIP LOCKED')) {
        return [{ id: 5, event_id: '33333333-3333-4333-8333-333333333333', attempts: 1 }];
      }
      return [];
    });
    getEventRelationsMock.mockResolvedValue({ relations: [], source: 'cache' });

    const processed = await mod.runRelationWorkerTick();

    expect(processed).toBe(1);
    expect(getEventRelationsMock).toHaveBeenCalledWith('33333333-3333-4333-8333-333333333333');
  });

  it('failed jobs below max attempts requeue with backoff', async () => {
    AppDataSource.query.mockImplementation((sql: string) => {
      if (sql.includes('FOR UPDATE SKIP LOCKED')) {
        return [{ id: 7, event_id: '11111111-1111-4111-8111-111111111111', attempts: 2 }];
      }
      return [];
    });
    getEventRelationsMock.mockRejectedValue(new Error('sidecar down'));

    await mod.runRelationWorkerTick();

    const retry = AppDataSource.query.mock.calls.find((c) =>
      String(c[0]).includes("SET status = 'pending', next_attempt_at"),
    );
    expect(retry).toBeDefined();
    expect(retry![1][1]).toBe('30');
    expect(retry![1][2]).toBe('sidecar down');
  });

  it('failed jobs at max attempts become terminal', async () => {
    AppDataSource.query.mockImplementation((sql: string) => {
      if (sql.includes('FOR UPDATE SKIP LOCKED')) {
        return [{ id: 9, event_id: '11111111-1111-4111-8111-111111111111', attempts: 5 }];
      }
      return [];
    });
    getEventRelationsMock.mockRejectedValue(new Error('still down'));

    await mod.runRelationWorkerTick();

    const fail = AppDataSource.query.mock.calls.find((c) =>
      String(c[0]).includes("SET status = 'failed'"),
    );
    expect(fail).toBeDefined();
  });

  it('tick with empty queue does no analysis work', async () => {
    AppDataSource.query.mockResolvedValue([]);

    const processed = await mod.runRelationWorkerTick();

    expect(processed).toBe(0);
    expect(getEventRelationsMock).not.toHaveBeenCalled();
  });
});
