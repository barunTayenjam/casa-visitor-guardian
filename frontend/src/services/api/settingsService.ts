// Settings-related API methods extracted from ApiService.ts
import { apiClient, fetchWithRetry, ApiError, API_URL } from './baseClient';

// ==================== TYPES ====================

interface GeneralSettings {
  systemName: string;
  timezone: string;
  language: string;
  theme: string;
  autoBackup: boolean;
  backupFrequency: string;
}

interface StorageSettings {
  retentionDays: number;
  maxStorageGB: number;
  autoCleanup: boolean;
  compressionEnabled: boolean;
  compressionQuality: number;
}

interface NotificationSettings {
  emailEnabled: boolean;
  emailAddress: string;
  pushEnabled: boolean;
  pushSoundEnabled: boolean;
  quietHoursEnabled: boolean;
  quietHoursStart: string;
  quietHoursEnd: string;
}

interface SystemSettings {
  general: GeneralSettings;
  storage: StorageSettings;
  notifications: NotificationSettings;
}

export interface DetectionConfig {
  enabled: boolean;
  sensitivity: number;
  minArea: number;
  cooldownPeriod: number;
  objects: string[];
  zones: Array<{ id: string; name: string; enabled: boolean }>;
  lowResourceMode?: boolean;
  ffmpegThreads?: number;
}

// ==================== SETTINGS SERVICE ====================

export const settingsService = {
  async getSettings(): Promise<SystemSettings> {
    try {
      const response = await fetchWithRetry(`${API_URL}/settings`);
      const data = await response.json();
      if (!data.success || !data.settings) {
        throw new ApiError(data.error || 'Failed to fetch system settings', response.status, 'GET_SETTINGS_ERROR', data);
      }
      return data.settings;
    } catch (error) {
      console.error('Error fetching system settings:', error);
      if (error instanceof ApiError) throw error;
      throw new ApiError('Failed to fetch system settings', 500, 'GET_SETTINGS_ERROR', { originalError: error instanceof Error ? error.message : String(error) });
    }
  },

  async updateSettings(settings: Partial<SystemSettings>): Promise<SystemSettings> {
    try {
      const response = await fetchWithRetry(`${API_URL}/settings`, {
        method: 'PUT',
        body: JSON.stringify(settings),
      });
      const data = await response.json();
      if (!data.success || !data.settings) {
        throw new ApiError(data.error || 'Failed to update system settings', response.status, 'UPDATE_SETTINGS_ERROR', data);
      }
      return data.settings;
    } catch (error) {
      console.error('Error updating system settings:', error);
      if (error instanceof ApiError) throw error;
      throw new ApiError('Failed to update system settings', 500, 'UPDATE_SETTINGS_ERROR', { originalError: error instanceof Error ? error.message : String(error) });
    }
  },

  async getDetectionConfig(camera?: string): Promise<DetectionConfig> {
    try {
      const endpoint = camera ? `/detection/${camera}` : '/detection';
      const response = await apiClient.get<{ success: boolean; config: DetectionConfig }>(endpoint);
      if (response.success) return response.config;
      throw new ApiError('Failed to get detection config', 400, 'GET_DETECTION_CONFIG_ERROR');
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError('Failed to get detection config', 500, 'GET_DETECTION_CONFIG_ERROR', { originalError: error instanceof Error ? error.message : String(error) });
    }
  },

  async updateDetectionConfig(data: Partial<DetectionConfig> & { cameraId?: string }): Promise<DetectionConfig> {
    try {
      const { cameraId, ...configData } = data;
      const endpoint = cameraId ? `/detection/${cameraId}` : '/detection';
      const response = await apiClient.put<{ success: boolean; config: DetectionConfig }>(endpoint, configData);
      if (response.success) return response.config;
      throw new ApiError('Failed to update detection config', 400, 'UPDATE_DETECTION_CONFIG_ERROR');
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError('Failed to update detection config', 500, 'UPDATE_DETECTION_CONFIG_ERROR', { originalError: error instanceof Error ? error.message : String(error) });
    }
  },

  async getSystemLogs(level?: string, limit?: number): Promise<Array<{ timestamp: string; level: string; message: string; context?: string }>> {
    try {
      const params = new URLSearchParams();
      if (level) params.append('level', level);
      if (limit) params.append('limit', limit.toString());
      const response = await fetchWithRetry(`${API_URL}/system/logs?${params}`);
      const data = await response.json();
      if (!data.success || !data.logs) {
        throw new ApiError(data.error || 'Failed to fetch system logs', response.status, 'GET_SYSTEM_LOGS_ERROR', data);
      }
      return data.logs;
    } catch (error) {
      console.error('Error fetching system logs:', error);
      if (error instanceof ApiError) throw error;
      throw new ApiError('Failed to fetch system logs', 500, 'GET_SYSTEM_LOGS_ERROR', { originalError: error instanceof Error ? error.message : String(error) });
    }
  },

  async clearSystemLogs(): Promise<void> {
    try {
      const response = await fetchWithRetry(`${API_URL}/system/logs`, { method: 'DELETE' });
      const data = await response.json();
      if (!data.success) {
        throw new ApiError(data.error || 'Failed to clear system logs', response.status, 'CLEAR_SYSTEM_LOGS_ERROR', data);
      }
    } catch (error) {
      console.error('Error clearing system logs:', error);
      if (error instanceof ApiError) throw error;
      throw new ApiError('Failed to clear system logs', 500, 'CLEAR_SYSTEM_LOGS_ERROR', { originalError: error instanceof Error ? error.message : String(error) });
    }
  },

  async getAlerts(): Promise<Array<{
    id: string; type: 'motion' | 'camera' | 'system'; severity: 'info' | 'warning' | 'error';
    message: string; timestamp: string; acknowledged: boolean; cameraId?: string;
  }>> {
    try {
      const response = await fetchWithRetry(`${API_URL}/alerts`);
      const data = await response.json();
      if (!data.success || !data.alerts) {
        throw new ApiError(data.error || 'Failed to fetch alerts', response.status, 'GET_ALERTS_ERROR', data);
      }
      return data.alerts.map((alert: { timestamp: string }) => ({
        ...alert,
        timestamp: new Date(alert.timestamp) as unknown as string,
      }));
    } catch (error) {
      console.error('Error fetching alerts:', error);
      if (error instanceof ApiError) throw error;
      throw new ApiError('Failed to fetch alerts', 500, 'GET_ALERTS_ERROR', { originalError: error instanceof Error ? error.message : String(error) });
    }
  },

  async acknowledgeAlert(id: string): Promise<void> {
    try {
      const response = await fetchWithRetry(`${API_URL}/alerts/${id}/acknowledge`, { method: 'POST' });
      const data = await response.json();
      if (!data.success) {
        throw new ApiError(data.error || `Failed to acknowledge alert ${id}`, response.status, 'ACKNOWLEDGE_ALERT_ERROR', data);
      }
    } catch (error) {
      console.error(`Error acknowledging alert ${id}:`, error);
      if (error instanceof ApiError) throw error;
      throw new ApiError(`Failed to acknowledge alert ${id}`, 500, 'ACKNOWLEDGE_ALERT_ERROR', { originalError: error instanceof Error ? error.message : String(error) });
    }
  },

  async deleteAlert(id: string): Promise<void> {
    try {
      const response = await fetchWithRetry(`${API_URL}/alerts/${id}`, { method: 'DELETE' });
      const data = await response.json();
      if (!data.success) {
        throw new ApiError(data.error || `Failed to delete alert ${id}`, response.status, 'DELETE_ALERT_ERROR', data);
      }
    } catch (error) {
      console.error(`Error deleting alert ${id}:`, error);
      if (error instanceof ApiError) throw error;
      throw new ApiError(`Failed to delete alert ${id}`, 500, 'DELETE_ALERT_ERROR', { originalError: error instanceof Error ? error.message : String(error) });
    }
  },
};
