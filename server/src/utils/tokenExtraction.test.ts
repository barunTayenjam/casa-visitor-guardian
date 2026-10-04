import { describe, it, expect } from '@jest/globals';
import { extractBearerToken } from './tokenExtraction.js';

describe('extractBearerToken', () => {
  it('extracts token from valid Bearer header', () => {
    const req = { headers: { authorization: 'Bearer abc123' } } as any;
    expect(extractBearerToken(req)).toBe('abc123');
  });

  it('returns null when Authorization header is missing', () => {
    const req = { headers: {} } as any;
    expect(extractBearerToken(req)).toBeNull();
  });

  it('returns null for non-Bearer schemes', () => {
    const req = { headers: { authorization: 'Basic dXNlcjpwYXNz' } } as any;
    expect(extractBearerToken(req)).toBeNull();
  });

  it('handles array Authorization headers from raw upgrade requests', () => {
    const req = { headers: { authorization: ['Bearer multi-token'] } } as any;
    expect(extractBearerToken(req)).toBe('multi-token');
  });
});