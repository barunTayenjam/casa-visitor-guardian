import { describe, it, expect, beforeEach, jest } from '@jest/globals';

jest.mock('typeorm');
jest.mock('../database.js');

describe('Database Initialization', () => {
  let mockDataSource: any;

  beforeEach(() => {
    mockDataSource = {
      initialize: jest.fn().mockResolvedValue(undefined),
      isInitialized: jest.fn().mockReturnValue(true),
      destroy: jest.fn().mockResolvedValue(undefined),
      synchronize: jest.fn().mockResolvedValue(undefined),
    };

    jest.doMock('../database.js', () => mockDataSource);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  it('should initialize database', async () => {
    const database = require('../database.js');
    await database.initializeDatabase();

    expect(mockDataSource.initialize).toHaveBeenCalled();
  });

  it('should check if initialized', async () => {
    const database = require('../database.js');
    const isInitialized = database.isDatabaseInitialized();

    expect(isInitialized).toBe(true);
  });

  it('should destroy connection', async () => {
    const database = require('../database.js');
    await database.closeDatabase();

    expect(mockDataSource.destroy).toHaveBeenCalled();
  });
});
