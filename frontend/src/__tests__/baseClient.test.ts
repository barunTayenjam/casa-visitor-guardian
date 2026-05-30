class ApiError extends Error {
  constructor(
    message: string,
    public status?: number,
    public code?: string,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

class NetworkError extends ApiError {
  constructor(message: string) {
    super(message);
    this.name = 'NetworkError';
  }
}

class TimeoutError extends ApiError {
  constructor(message: string = 'Request timed out') {
    super(message);
    this.name = 'TimeoutError';
  }
}

describe('ApiError classes', () => {
  it('ApiError has correct properties', () => {
    const err = new ApiError('test error', 400, 'BAD_REQUEST', { detail: 'x' });
    expect(err.message).toBe('test error');
    expect(err.status).toBe(400);
    expect(err.code).toBe('BAD_REQUEST');
    expect(err.details).toEqual({ detail: 'x' });
    expect(err.name).toBe('ApiError');
  });

  it('NetworkError extends ApiError', () => {
    const err = new NetworkError('network down');
    expect(err).toBeInstanceOf(ApiError);
    expect(err.message).toBe('network down');
    expect(err.name).toBe('NetworkError');
  });

  it('TimeoutError extends ApiError with default message', () => {
    const err = new TimeoutError();
    expect(err).toBeInstanceOf(ApiError);
    expect(err.message).toBe('Request timed out');
    expect(err.name).toBe('TimeoutError');
  });

  it('TimeoutError accepts custom message', () => {
    const err = new TimeoutError('custom timeout');
    expect(err.message).toBe('custom timeout');
  });
});

describe('Token management (localStorage)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('stores and retrieves auth token', () => {
    localStorage.setItem('auth_token', 'test-jwt');
    expect(localStorage.getItem('auth_token')).toBe('test-jwt');
  });

  it('removes auth token', () => {
    localStorage.setItem('auth_token', 'test-jwt');
    localStorage.removeItem('auth_token');
    expect(localStorage.getItem('auth_token')).toBeNull();
  });

  it('returns null when no token set', () => {
    expect(localStorage.getItem('auth_token')).toBeNull();
  });
});
