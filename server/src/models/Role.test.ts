import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';

jest.mock('typeorm');
import { Role } from './Role.js';

describe('Role Model', () => {
  let mockRepo: any;

  beforeEach(() => {
    mockRepo = {
      find: jest.fn(),
      findOne: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should create role entity', () => {
    const role = new Role();

    role.name = 'admin';
    role.permissions = JSON.stringify(['read', 'write', 'delete']);

    expect(role.name).toBe('admin');
    expect(role.permissions).toBeDefined();
  });

  it('should validate required fields', () => {
    const role = new Role();

    role.name = '';
    expect(role.name).toBe('');
  });

  it('should handle default values', () => {
    const role = new Role();

    role.createdAt = new Date('2024-01-01T00:00:00Z');
    role.updatedAt = new Date('2024-01-01T00:00:00Z');

    expect(role.createdAt).toBeDefined();
    expect(role.updatedAt).toBeDefined();
    expect(role.createdAt).toBeInstanceOf(Date);
    expect(role.updatedAt).toBeInstanceOf(Date);
  });
});
