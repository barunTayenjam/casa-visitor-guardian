// Shared HTTP client infrastructure extracted from ApiService.ts
// Uses native fetch (no axios dependency needed)

// ==================== ERROR CLASSES ====================

export class ApiError extends Error {
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

export class NetworkError extends ApiError {
  constructor(message: string) {
    super(message);
    this.name = 'NetworkError';
  }
}

export class TimeoutError extends ApiError {
  constructor(message: string = 'Request timed out') {
    super(message);
    this.name = 'TimeoutError';
  }
}

// ==================== CONFIGURATION ====================

const isDev = import.meta.env.DEV;
// Use relative URLs — Vite proxies /api to backend in dev, nginx proxies in prod
export const API_URL = '/api';
export const BACKEND_URL = '';

// ==================== TOKEN MANAGEMENT ====================

let authToken: string | null = null;

export function getAuthToken(): string | null {
  return authToken ?? localStorage.getItem('auth_token');
}

export function setAuthToken(token: string | null): void {
  authToken = token;
  if (token) {
    localStorage.setItem('auth_token', token);
  } else {
    localStorage.removeItem('auth_token');
  }
}

// ==================== TOKEN REFRESH ====================

async function attemptTokenRefresh(): Promise<boolean> {
  const currentToken = getAuthToken();
  if (!currentToken) return false;
  try {
    const response = await fetch(`${API_URL}/auth/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${currentToken}`,
      },
    });
    const data = await response.json();
    if (data.success && data.token) {
      setAuthToken(data.token);
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

// ==================== CORE FETCH WITH RETRY ====================

export async function fetchWithRetry(
  url: string,
  options: RequestInit = {},
  retries = 3,
  isRetryAfterRefresh = false
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 120000); // 120s timeout for AI analysis

  try {
    const token = getAuthToken();
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...(token && { 'Authorization': `Bearer ${token}` }),
        ...options.headers,
      },
    });

    if (!response.ok) {
      let errorMessage = `HTTP error! status: ${response.status}`;
      let errorDetails: Record<string, unknown> = {};

      // Special handling for rate limiting
      if (response.status === 429) {
        errorMessage = 'Too many API requests, please try again later';
        throw new ApiError(errorMessage, response.status, errorMessage);
      }

      // Auto-refresh on 401 if we have a token and haven't already tried
      if (response.status === 401 && token && !isRetryAfterRefresh && !url.includes('/auth/')) {
        const refreshed = await attemptTokenRefresh();
        if (refreshed) {
          return fetchWithRetry(url, options, retries, true);
        }
      }

      try {
        const data = await response.json();
        errorMessage = data.error || errorMessage;
        errorDetails = data;

        // Special handling for "already streaming" case
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
    }

    return response;
  } catch (error) {
    clearTimeout(timeout);

    if (error instanceof Error && error.name === 'AbortError') {
      throw new TimeoutError();
    }

    if (retries > 0 && error instanceof Error && !error.message.includes('aborted')) {
      console.warn(`Request failed, retrying... (${retries} retries left)`, error.message);

      if (error.message.includes('429') || error.message.includes('Too Many Requests')) {
        await new Promise(resolve => setTimeout(resolve, 5000));
      } else if (error.message.includes('ECONNRESET') || error.message.includes('fetch')) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      } else {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      return fetchWithRetry(url, options, retries - 1, isRetryAfterRefresh);
    }

    if (error instanceof ApiError) {
      throw error;
    }

    throw new NetworkError(
      error instanceof Error ? error.message : 'Network error occurred'
    );
  } finally {
    clearTimeout(timeout);
  }
}

// ==================== HELPER METHODS ====================

export async function apiGet<T>(endpoint: string, params?: Record<string, unknown>): Promise<T> {
  let url = `${API_URL}${endpoint}`;
  if (params) {
    const filteredParams: Record<string, string> = {};
    Object.keys(params).forEach(key => {
      const value = params[key];
      if (value !== undefined && value !== null) {
        if (Array.isArray(value)) {
          filteredParams[key] = value.join(',');
        } else {
          filteredParams[key] = String(value);
        }
      }
    });

    const urlParams = new URLSearchParams(filteredParams);
    if (urlParams.toString()) {
      url += `?${urlParams.toString()}`;
    }
  }
  const response = await fetchWithRetry(url);
  return response.json();
}

export async function apiPost<T>(endpoint: string, body?: unknown): Promise<T> {
  const response = await fetchWithRetry(`${API_URL}${endpoint}`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
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
  const options: RequestInit = {
    method: 'DELETE',
  };
  if (body !== undefined) {
    options.body = JSON.stringify(body);
  }
  const response = await fetchWithRetry(`${API_URL}${endpoint}`, options);
  return response.json();
}

// ==================== EXPORTS ====================

// For consumers that expect an apiClient-like object
export const apiClient = {
  get: apiGet,
  post: apiPost,
  put: apiPut,
  delete: apiDelete,
  fetchWithRetry,
};
