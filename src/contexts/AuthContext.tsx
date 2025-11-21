import React, { createContext, useContext, useReducer, useEffect, useCallback, ReactNode } from 'react';
import ApiService, { ApiError } from '@/services/ApiService';
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

// Provider
export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(authReducer, initialState);

  // Validate token and get user profile
  const validateToken = useCallback(async (token: string) => {
    try {
      logger.info('Validating authentication token', 'AUTH', { hasToken: !!token });
      ApiService.setAuthToken(token);
      const response = await ApiService.getProfile();
      
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
        localStorage.removeItem('auth_token');
        ApiService.setAuthToken(null);
        dispatch({ type: 'LOGOUT' });
      }
    } catch (error) {
      logger.error('Token validation failed', 'AUTH', error);
      localStorage.removeItem('auth_token');
      ApiService.setAuthToken(null);
      dispatch({ type: 'LOGOUT' });
    }
  }, []);

  // Initialize auth state from stored token
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const token = localStorage.getItem('auth_token');
        
        if (token) {
          logger.info('Initializing authentication with stored token', 'AUTH');
          dispatch({ type: 'SET_LOADING', payload: true });
          
          try {
            await validateToken(token);
          } catch (error) {
            // Handle validation timeout or failure
            logger.error('Token validation failed or timed out', 'AUTH', error);
            localStorage.removeItem('auth_token');
            ApiService.setAuthToken(null);
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
  }, [validateToken]);

  // Login
  const login = useCallback(async (username: string, password: string) => {
    dispatch({ type: 'AUTH_START' });
    
    try {
      const response = await ApiService.login(username, password);

      if (response.success && response.user && response.token) {
        localStorage.setItem('auth_token', response.token);
        ApiService.setAuthToken(response.token);
        
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
  }, []);

  // Register
  const register = useCallback(async (userData: RegisterData) => {
    dispatch({ type: 'AUTH_START' });
    
    try {
      const response = await ApiService.register(userData);

      if (response.success && response.user && response.token) {
        localStorage.setItem('auth_token', response.token);
        ApiService.setAuthToken(response.token);
        
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
  }, []);

  // Logout
  const logout = useCallback(async () => {
    try {
      if (state.token) {
        await ApiService.logout();
      }
    } catch (error) {
      // Continue with logout even if API call fails
      console.error('Logout API call failed:', error);
    } finally {
      localStorage.removeItem('auth_token');
      ApiService.setAuthToken(null);
      dispatch({ type: 'LOGOUT' });
    }
  }, [state.token]);

  // Clear error
  const clearError = useCallback(() => {
    dispatch({ type: 'CLEAR_ERROR' });
  }, []);

  // Refresh token
  const refreshToken = useCallback(async () => {
    if (!state.token) return;

    try {
      const response = await ApiService.refreshToken();
      
      if (response.success && response.token) {
        localStorage.setItem('auth_token', response.token);
        ApiService.setAuthToken(response.token);
        dispatch({
          type: 'REFRESH_TOKEN',
          payload: response.token,
        });
      }
    } catch (error) {
      // If refresh fails, logout
      logout();
    }
  }, [state.token, logout]);

  // Change password
  const changePassword = useCallback(async (currentPassword: string, newPassword: string) => {
    try {
      const response = await ApiService.changePassword(currentPassword, newPassword);

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