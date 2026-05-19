// Authentication-related API methods extracted from ApiService.ts
import { apiClient, fetchWithRetry, ApiError, API_URL } from './baseClient';

// ==================== AUTH SERVICE ====================

export const authService = {
  async login(username: string, password: string) {
    const response = await fetchWithRetry(`${API_URL}/auth/login`, {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
    return response.json();
  },

  async register(userData: { username: string; email: string; password: string; role?: 'admin' | 'user' | 'viewer' }) {
    const response = await fetchWithRetry(`${API_URL}/auth/register`, {
      method: 'POST',
      body: JSON.stringify(userData),
    });
    return response.json();
  },

  async getProfile() {
    const response = await fetchWithRetry(`${API_URL}/auth/profile`);
    return response.json();
  },

  async changePassword(currentPassword: string, newPassword: string) {
    const response = await fetchWithRetry(`${API_URL}/auth/change-password`, {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    return response.json();
  },

  async refreshToken() {
    const response = await fetchWithRetry(`${API_URL}/auth/refresh`, {
      method: 'POST',
    });
    return response.json();
  },

  async logout() {
    const response = await fetchWithRetry(`${API_URL}/auth/logout`, {
      method: 'POST',
    });
    return response.json();
  },

  async setupMFA(): Promise<{ success: boolean; secret: string; qrCode: string }> {
    try {
      const response = await apiClient.get<{ success: boolean; secret: string; qrCode: string }>('/auth/mfa/setup');
      if (response.success) return response;
      throw new ApiError('Failed to setup MFA', 400, 'MFA_SETUP_ERROR');
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError('Failed to setup MFA', 500, 'MFA_SETUP_ERROR', { originalError: error instanceof Error ? error.message : String(error) });
    }
  },

  async verifyMFA(code: string): Promise<{ success: boolean; message: string }> {
    try {
      const response = await apiClient.post<{ success: boolean; message: string }>('/auth/mfa/verify', { code });
      if (response.success) return response;
      throw new ApiError('MFA verification failed', 400, 'MFA_VERIFY_ERROR');
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError('MFA verification failed', 500, 'MFA_VERIFY_ERROR', { originalError: error instanceof Error ? error.message : String(error) });
    }
  },
};
