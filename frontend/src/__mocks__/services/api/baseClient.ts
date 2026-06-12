export class ApiError extends Error {
  status?: number;
  code?: string;
  details?: Record<string, unknown>;
  constructor(message: string, status?: number, code?: string, details?: Record<string, unknown>) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export class NetworkError extends ApiError {
  constructor(message: string) { super(message); this.name = 'NetworkError'; }
}

export class TimeoutError extends ApiError {
  constructor(message: string = 'Request timed out') { super(message); this.name = 'TimeoutError'; }
}

export const API_URL = '/api';
export const BACKEND_URL = '';

let authToken: string | null = null;

export function getAuthToken(): string | null {
  return authToken ?? localStorage.getItem('auth_token');
}

export function setAuthToken(token: string | null): void {
  authToken = token;
  if (token) localStorage.setItem('auth_token', token);
  else localStorage.removeItem('auth_token');
}

export async function fetchWithRetry(url: string, options: RequestInit = {}, retries = 3): Promise<Response> {
  const response = await fetch(url, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options.headers },
  });
  if (!response.ok) throw new ApiError(`HTTP ${response.status}`, response.status);
  return response;
}

interface ApiClient {
  get: <T = unknown>(url: string, options?: RequestInit) => Promise<T>;
  post: <T = unknown>(url: string, body?: unknown, options?: RequestInit) => Promise<T>;
  put: <T = unknown>(url: string, body?: unknown, options?: RequestInit) => Promise<T>;
  delete: <T = unknown>(url: string, options?: RequestInit) => Promise<T>;
  fetchWithRetry: (url: string, options?: RequestInit, retries?: number) => Promise<Response>;
}

export const apiClient: ApiClient = {
  get: () => Promise.resolve({} as never),
  post: () => Promise.resolve({} as never),
  put: () => Promise.resolve({} as never),
  delete: () => Promise.resolve({} as never),
  fetchWithRetry,
};
