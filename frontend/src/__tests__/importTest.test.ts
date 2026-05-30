import { describe, it, expect } from '@jest/globals';
import { API_URL } from '../services/api/baseClient.js';

describe('Import Test', () => {
  it('should import API_URL', () => {
    expect(API_URL).toBe('/api');
  });
});
