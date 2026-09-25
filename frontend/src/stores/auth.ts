import { create } from 'zustand';
import { authService } from '@/services/api/authService';
import { setAuthToken } from '@/services/api/baseClient';

export interface User {
  id: string;
  username: string;
  email: string;
  role: 'admin' | 'user' | 'viewer';
  isActive: boolean;
  lastLogin?: string;
  createdAt: string;
  updatedAt: string;
}

const TOKEN_REFRESH_THRESHOLD_MS = 5 * 60 * 1000;
const TOKEN_CHECK_INTERVAL_MS = 60 * 1000;

function getTokenExpiry(token: string): number | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = JSON.parse(atob(parts[1]));
    return payload.exp ? payload.exp * 1000 : null;
  } catch {
    return null;
  }
}

export const isTokenExpired = (token: string): boolean => {
  const expiry = getTokenExpiry(token);
  return !expiry || Date.now() >= expiry;
};

export const isTokenExpiringSoon = (token: string): boolean => {
  const expiry = getTokenExpiry(token);
  if (!expiry) return true;
  return Date.now() >= expiry - TOKEN_REFRESH_THRESHOLD_MS;
};

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  initialized: boolean;
  initialize: () => Promise<void>;
  login: (username: string, password: string) => Promise<void>;
  register: (data: {
    username: string;
    email: string;
    password: string;
    role?: 'admin' | 'user' | 'viewer';
  }) => Promise<void>;
  logout: () => Promise<void>;
  completeLogin: (user: User, token: string) => void;
  clearError: () => void;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  refreshToken: () => Promise<string | null>;
  startTokenRefreshTimer: () => void;
  stopTokenRefreshTimer: () => void;
}

let refreshTimer: ReturnType<typeof setInterval> | null = null;
let initializePromise: Promise<void> | null = null;
let refreshPromise: Promise<string | null> | null = null;

function storeToken(token: string) {
  localStorage.setItem('auth_token', token);
  setAuthToken(token);
}

function clearToken() {
  localStorage.removeItem('auth_token');
  setAuthToken(null);
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: localStorage.getItem('auth_token'),
  isAuthenticated: false,
  isLoading: !!localStorage.getItem('auth_token'),
  error: null,
  initialized: false,

  initialize: async () => {
    if (get().initialized) return;
    if (initializePromise) return initializePromise;

    initializePromise = (async () => {
      const token = get().token;
      if (!token) {
        set({ initialized: true, isLoading: false });
        return;
      }
      try {
        setAuthToken(token);
        if (isTokenExpired(token)) {
          const newToken = await get().refreshToken();
          if (!newToken) {
            clearToken();
            set({ user: null, token: null, isAuthenticated: false, isLoading: false, initialized: true });
            return;
          }
        }
        const response = await authService.getProfile();
        if (response.success && response.user) {
          set({ user: response.user, isAuthenticated: true, isLoading: false, initialized: true });
          get().startTokenRefreshTimer();
        } else {
          clearToken();
          set({ user: null, token: null, isAuthenticated: false, isLoading: false, initialized: true });
        }
      } catch {
        clearToken();
        set({ user: null, token: null, isAuthenticated: false, isLoading: false, initialized: true });
      }
    })();

    try {
      await initializePromise;
    } finally {
      initializePromise = null;
    }
  },

  login: async (username, password) => {
    set({ isLoading: true, error: null });
    try {
      const response = await authService.login(username, password);
      if (response.success && response.user && response.token) {
        storeToken(response.token);
        set({
          user: response.user,
          token: response.token,
          isAuthenticated: true,
          isLoading: false,
          error: null,
        });
        get().startTokenRefreshTimer();
      } else {
        set({ isLoading: false, error: response.error || 'Login failed' });
      }
    } catch (err) {
      set({ isLoading: false, error: err instanceof Error ? err.message : 'Login failed' });
    }
  },

  register: async (userData) => {
    set({ isLoading: true, error: null });
    try {
      const response = await authService.register(userData);
      if (response.success && response.user && response.token) {
        storeToken(response.token);
        set({
          user: response.user,
          token: response.token,
          isAuthenticated: true,
          isLoading: false,
          error: null,
        });
      } else {
        set({ isLoading: false, error: response.error || 'Registration failed' });
      }
    } catch (err) {
      set({ isLoading: false, error: err instanceof Error ? err.message : 'Registration failed' });
    }
  },

  logout: async () => {
    try {
      if (get().token) await authService.logout();
    } catch {
      set({ error: null });
    } finally {
      get().stopTokenRefreshTimer();
      clearToken();
      set({ user: null, token: null, isAuthenticated: false, error: null });
    }
  },

  completeLogin: (user, token) => {
    storeToken(token);
    set({ user, token, isAuthenticated: true, isLoading: false, error: null });
    get().startTokenRefreshTimer();
  },

  clearError: () => set({ error: null }),

  changePassword: async (currentPassword, newPassword) => {
    const response = await authService.changePassword(currentPassword, newPassword);
    if (!response.success) {
      throw new Error(response.error || 'Password change failed');
    }
  },

  refreshToken: async () => {
    if (refreshPromise) return refreshPromise;

    const token = get().token;
    if (!token) return null;

    refreshPromise = (async () => {
      try {
        setAuthToken(token);
        const response = await authService.refreshToken();
        if (get().token !== token) return null;
        if (response.success && response.token) {
          storeToken(response.token);
          set({ token: response.token });
          return response.token;
        }
        return null;
      } catch {
        return null;
      }
    })();

    try {
      return await refreshPromise;
    } finally {
      refreshPromise = null;
    }
  },

  startTokenRefreshTimer: () => {
    if (refreshTimer) return;
    refreshTimer = setInterval(() => {
      const { token, isAuthenticated, refreshToken, user } = get();
      if (!isAuthenticated || !token) return;
      if (isTokenExpiringSoon(token)) {
        refreshToken().then((newToken) => {
          if (!newToken) {
            get().stopTokenRefreshTimer();
            clearToken();
            useAuthStore.setState({ user: null, token: null, isAuthenticated: false });
          } else if (user) {
            authService.getProfile().then((r) => {
              if (r.success && r.user) useAuthStore.setState({ user: r.user });
            });
          }
        });
      }
    }, TOKEN_CHECK_INTERVAL_MS);
  },

  stopTokenRefreshTimer: () => {
    if (refreshTimer) {
      clearInterval(refreshTimer);
      refreshTimer = null;
    }
  },
}));
