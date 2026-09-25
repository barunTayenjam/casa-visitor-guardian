export class ApiError extends Error {
  constructor(
    message: string,
    public status?: number,
    public code?: string,
    public details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export class NetworkError extends ApiError {
  constructor(message: string) {
    super(message);
    this.name = 'NetworkError';
  }
}

export class TimeoutError extends ApiError {
  constructor(message = 'Request timed out') {
    super(message);
    this.name = 'TimeoutError';
  }
}

export const API_URL = '/api';
export const BACKEND_URL = '';
const isDevelopment =
  typeof window !== 'undefined' &&
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

export const AUTH_TOKEN_EVENT = 'sentryvision:auth-token';

let authToken: string | null = null;

export function getAuthToken(): string | null {
  if (authToken) return authToken;
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem('auth_token');
}

export function setAuthToken(token: string | null): void {
  authToken = token;
  if (typeof window === 'undefined') return;
  if (token) window.localStorage.setItem('auth_token', token);
  else window.localStorage.removeItem('auth_token');
  window.dispatchEvent(new CustomEvent<string | null>(AUTH_TOKEN_EVENT, { detail: token }));
}

async function attemptTokenRefresh(): Promise<boolean> {
  const currentToken = getAuthToken();
  if (!currentToken) return false;
  try {
    const response = await fetch(`${API_URL}/auth/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${currentToken}`,
      },
    });
    const data = await response.json();
    if (data.success && data.token) {
      setAuthToken(data.token);
      return true;
    }
  } catch {
    return false;
  }
  return false;
}

export async function fetchWithRetry(
  url: string,
  options: RequestInit = {},
  retries = 3,
  isRetryAfterRefresh = false,
  timeoutMs = 120_000,
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const token = getAuthToken();
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
      },
    });

    if (response.ok) return response;

    let errorMessage = `HTTP error! status: ${response.status}`;
    let errorDetails: Record<string, unknown> = {};

    if (response.status === 429) {
      throw new ApiError('Too many API requests, please try again later', response.status);
    }

    if (response.status === 401 && token && !isRetryAfterRefresh && !url.includes('/auth/')) {
      const refreshed = await attemptTokenRefresh();
      if (refreshed) return fetchWithRetry(url, options, retries, true, timeoutMs);
    }

    try {
      const data = await response.json();
      errorMessage = data.error || errorMessage;
      errorDetails = data;
      if (data.error && data.error.includes('already streaming')) {
        return new Response(JSON.stringify(data), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    } catch {
      errorMessage = response.statusText || errorMessage;
    }

    throw new ApiError(errorMessage, response.status, 'API_ERROR', errorDetails);
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') throw new TimeoutError();

    if (retries > 0 && error instanceof Error && error instanceof ApiError === false) {
      if (isDevelopment) console.warn(`Request failed, retrying (${retries} left)`, error.message);
      const delay = error.message.includes('429') || error.message.includes('Too Many Requests')
        ? 5_000
        : error.message.includes('ECONNRESET') || error.message.includes('fetch')
          ? 2_000
          : 1_000;
      await new Promise((resolve) => setTimeout(resolve, delay));
      return fetchWithRetry(url, options, retries - 1, isRetryAfterRefresh, timeoutMs);
    }

    if (error instanceof ApiError) throw error;
    throw new NetworkError(error instanceof Error ? error.message : 'Network error occurred');
  } finally {
    clearTimeout(timeout);
  }
}

export async function apiGet<T>(endpoint: string, params?: Record<string, unknown>): Promise<T> {
  let url = `${API_URL}${endpoint}`;
  if (params) {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value === undefined || value === null) return;
      query.set(key, Array.isArray(value) ? value.join(',') : String(value));
    });
    const serialized = query.toString();
    if (serialized) url += `?${serialized}`;
  }
  const response = await fetchWithRetry(url);
  return response.json();
}

export async function apiPost<T>(endpoint: string, body?: unknown, timeoutMs = 120_000): Promise<T> {
  const response = await fetchWithRetry(
    `${API_URL}${endpoint}`,
    {
      method: 'POST',
      body: JSON.stringify(body),
    },
    3,
    false,
    timeoutMs,
  );
  return response.json();
}

export async function apiPut<T>(endpoint: string, body?: unknown): Promise<T> {
  const response = await fetchWithRetry(`${API_URL}${endpoint}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  });
  return response.json();
}

export async function apiDelete<T>(endpoint: string, body?: unknown): Promise<T> {
  const options: RequestInit = { method: 'DELETE' };
  if (body !== undefined) options.body = JSON.stringify(body);
  const response = await fetchWithRetry(`${API_URL}${endpoint}`, options);
  return response.json();
}

export const apiClient = {
  get: apiGet,
  post: apiPost,
  put: apiPut,
  delete: apiDelete,
  fetchWithRetry,
};
