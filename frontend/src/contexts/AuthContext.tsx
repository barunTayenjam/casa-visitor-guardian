import React, { createContext, useContext, useReducer, useEffect, useCallback, useRef, ReactNode } from 'react';
import { authService } from '@/services/api/authService';
import { ApiError, setAuthToken } from '@/services/api/baseClient';
import { logger } from '@/lib/logger';

// Types
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

export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

export interface AuthContextType extends AuthState {
  login: (username: string, password: string) => Promise<void>;
  register: (userData: RegisterData) => Promise<void>;
  logout: () => void;
  clearError: () => void;
  refreshToken: () => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
}

export interface RegisterData {
  username: string;
  email: string;
  password: string;
  role?: 'admin' | 'user' | 'viewer';
}

// Action types
type AuthAction =
  | { type: 'AUTH_START' }
  | { type: 'AUTH_SUCCESS'; payload: { user: User; token: string } }
  | { type: 'AUTH_FAILURE'; payload: string }
  | { type: 'LOGOUT' }
  | { type: 'CLEAR_ERROR' }
  | { type: 'REFRESH_TOKEN'; payload: string }
  | { type: 'SET_LOADING'; payload: boolean };

// Initial state
const token = localStorage.getItem('auth_token');
const initialState: AuthState = {
  user: null,
  token,
  isAuthenticated: false,
  isLoading: !!token, // Start with loading true if there's a token to validate
  error: null,
};

// Reducer
function authReducer(state: AuthState, action: AuthAction): AuthState {
  switch (action.type) {
    case 'AUTH_START':
      return {
        ...state,
        isLoading: true,
        error: null,
      };
    case 'AUTH_SUCCESS':
      return {
        ...state,
        user: action.payload.user,
        token: action.payload.token,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      };
    case 'AUTH_FAILURE':
      return {
        ...state,
        user: null,
        token: null,
        isAuthenticated: false,
        isLoading: false,
        error: action.payload,
      };
    case 'LOGOUT':
      return {
        ...state,
        user: null,
        token: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,
      };
    case 'CLEAR_ERROR':
      return {
        ...state,
        error: null,
      };
    case 'REFRESH_TOKEN':
      return {
        ...state,
        token: action.payload,
      };
    case 'SET_LOADING':
      return {
        ...state,
        isLoading: action.payload,
      };
    default:
      return state;
  }
}

// Context
const AuthContext = createContext<AuthContextType | undefined>(undefined);

const TOKEN_REFRESH_THRESHOLD_MS = 5 * 60 * 1000; // Refresh 5 minutes before expiry
const TOKEN_CHECK_INTERVAL_MS = 60 * 1000; // Check every minute

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

function isTokenExpired(token: string): boolean {
  const expiry = getTokenExpiry(token);
  if (!expiry) return true;
  return Date.now() >= expiry;
}

function isTokenExpiringSoon(token: string): boolean {
  const expiry = getTokenExpiry(token);
  if (!expiry) return true;
  return Date.now() >= (expiry - TOKEN_REFRESH_THRESHOLD_MS);
}

// Provider
export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(authReducer, initialState);
  const refreshTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isRefreshingRef = useRef(false);

  const clearAuthStorage = useCallback(() => {
    localStorage.removeItem('auth_token');
    setAuthToken(null);
  }, []);

  const storeAuth = useCallback((token: string) => {
    localStorage.setItem('auth_token', token);
    setAuthToken(token);
  }, []);

  // Validate token and get user profile
  const validateToken = useCallback(async (token: string) => {
    try {
      logger.info('Validating authentication token', 'AUTH', { hasToken: !!token });
      setAuthToken(token);
      const response = await authService.getProfile();
      
      if (response.success && response.user) {
        logger.info('Authentication successful', 'AUTH', { 
          userId: response.user.id, 
          username: response.user.username,
          role: response.user.role 
        });
        dispatch({
          type: 'AUTH_SUCCESS',
          payload: {
            user: response.user,
            token,
          },
        });
      } else {
        logger.warn('Invalid authentication token', 'AUTH', { response });
        clearAuthStorage();
        dispatch({ type: 'LOGOUT' });
      }
    } catch (error) {
      logger.error('Token validation failed', 'AUTH', error);
      clearAuthStorage();
      dispatch({ type: 'LOGOUT' });
    }
  }, [clearAuthStorage]);

  // Try to refresh an expired/expiring token
  const tryRefreshToken = useCallback(async (token: string): Promise<string | null> => {
    if (isRefreshingRef.current) return null;
    isRefreshingRef.current = true;

    try {
      logger.info('Attempting token refresh', 'AUTH', { expired: isTokenExpired(token) });
      setAuthToken(token);
      const response = await authService.refreshToken();
      
      if (response.success && response.token) {
        logger.info('Token refreshed successfully', 'AUTH');
        storeAuth(response.token);
        dispatch({
          type: 'REFRESH_TOKEN',
          payload: response.token,
        });
        return response.token;
      }
      
      logger.warn('Token refresh returned no token', 'AUTH');
      return null;
    } catch (error) {
      logger.error('Token refresh failed', 'AUTH', error);
      return null;
    } finally {
      isRefreshingRef.current = false;
    }
  }, [storeAuth]);

  // Initialize auth state from stored token
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const token = localStorage.getItem('auth_token');
        
        if (token) {
          logger.info('Initializing authentication with stored token', 'AUTH', {
            expired: isTokenExpired(token),
            expiringSoon: isTokenExpiringSoon(token)
          });
          dispatch({ type: 'SET_LOADING', payload: true });
          
          if (isTokenExpired(token)) {
            // Token is expired - try to refresh it before giving up
            const newToken = await tryRefreshToken(token);
            if (newToken) {
              await validateToken(newToken);
            } else {
              logger.info('Stored token expired and refresh failed, requiring re-login', 'AUTH');
              clearAuthStorage();
              dispatch({ type: 'LOGOUT' });
            }
          } else if (isTokenExpiringSoon(token)) {
            // Token is valid but expiring soon - validate and refresh in background
            await validateToken(token);
            tryRefreshToken(token).catch(() => {});
          } else {
            await validateToken(token);
          }
        } else {
          logger.info('No stored authentication token found', 'AUTH');
        }
      } catch (error) {
        logger.error('Auth initialization error', 'AUTH', error);
      } finally {
        dispatch({ type: 'SET_LOADING', payload: false });
      }
    };

    initializeAuth();
  }, [validateToken, tryRefreshToken, clearAuthStorage]);

  // Proactive token refresh timer
  useEffect(() => {
    if (refreshTimerRef.current) {
      clearInterval(refreshTimerRef.current);
      refreshTimerRef.current = null;
    }

    if (!state.isAuthenticated || !state.token) return;

    refreshTimerRef.current = setInterval(() => {
      if (!state.token) return;

      if (isTokenExpiringSoon(state.token)) {
        logger.info('Token expiring soon, proactively refreshing', 'AUTH');
        tryRefreshToken(state.token).then((newToken) => {
          if (newToken) {
            validateToken(newToken).catch(() => {});
          }
        }).catch(() => {});
      }
    }, TOKEN_CHECK_INTERVAL_MS);

    return () => {
      if (refreshTimerRef.current) {
        clearInterval(refreshTimerRef.current);
        refreshTimerRef.current = null;
      }
    };
  }, [state.isAuthenticated, state.token, tryRefreshToken, validateToken]);

  // Login
  const login = useCallback(async (username: string, password: string) => {
    dispatch({ type: 'AUTH_START' });
    
    try {
      const response = await authService.login(username, password);

      if (response.success && response.user && response.token) {
        storeAuth(response.token);
        
        dispatch({
          type: 'AUTH_SUCCESS',
          payload: {
            user: response.user,
            token: response.token,
          },
        });
      } else {
        dispatch({
          type: 'AUTH_FAILURE',
          payload: response.error || 'Login failed',
        });
      }
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Login failed';
      dispatch({
        type: 'AUTH_FAILURE',
        payload: message,
      });
    }
  }, [storeAuth]);

  // Register
  const register = useCallback(async (userData: RegisterData) => {
    dispatch({ type: 'AUTH_START' });
    
    try {
      const response = await authService.register(userData);

      if (response.success && response.user && response.token) {
        storeAuth(response.token);
        
        dispatch({
          type: 'AUTH_SUCCESS',
          payload: {
            user: response.user,
            token: response.token,
          },
        });
      } else {
        dispatch({
          type: 'AUTH_FAILURE',
          payload: response.error || 'Registration failed',
        });
      }
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Registration failed';
      dispatch({
        type: 'AUTH_FAILURE',
        payload: message,
      });
    }
  }, [storeAuth]);

  // Logout
  const logout = useCallback(async () => {
    try {
      if (state.token) {
        await authService.logout();
      }
    } catch (error) {
      // Continue with logout even if API call fails
      console.error('Logout API call failed:', error);
    } finally {
      clearAuthStorage();
      dispatch({ type: 'LOGOUT' });
    }
  }, [state.token, clearAuthStorage]);

  // Clear error
  const clearError = useCallback(() => {
    dispatch({ type: 'CLEAR_ERROR' });
  }, []);

  // Refresh token (manual trigger)
  const refreshToken = useCallback(async () => {
    if (!state.token) return;

    const newToken = await tryRefreshToken(state.token);
    if (newToken) {
      await validateToken(newToken);
    } else {
      logout();
    }
  }, [state.token, tryRefreshToken, validateToken, logout]);

  // Change password
  const changePassword = useCallback(async (currentPassword: string, newPassword: string) => {
    try {
      const response = await authService.changePassword(currentPassword, newPassword);

      if (!response.success) {
        throw new Error(response.error || 'Password change failed');
      }
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Password change failed';
      throw new Error(message);
    }
  }, []);

  const value: AuthContextType = {
    ...state,
    login,
    register,
    logout,
    clearError,
    refreshToken,
    changePassword,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// Hook
export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export default AuthContext;