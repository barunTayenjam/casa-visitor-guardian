// System-related API methods extracted from ApiService.ts
import { apiClient, fetchWithRetry, ApiError, API_URL } from './baseClient';

// ==================== TYPES ====================

interface DetectionStats {
  totalDetections: number;
  personDetections: number;
  faceDetections: number;
  objectDetections: number;
  averageConfidence: number;
}

interface TimeSeriesData {
  timestamp: string;
  count: number;
}

interface CameraPerformance {
  cameraId: string;
  cameraName: string;
  uptime: number;
  fps: number;
  droppedFrames: number;
  errorRate: number;
}

// ==================== SYSTEM SERVICE ====================

export const systemService = {
  async getHealth(): Promise<{
    status: string;
    uptime: number;
    issues: string[];
    cameras: { total: number; online: number; offline: number };
    memory: { used: number; total: number };
    events: { recent: number; today: number };
  }> {
    try {
      const response = await fetchWithRetry(`${API_URL}/system/health`);
      const data = await response.json();
      if (!data.success || !data.health) {
        throw new ApiError(data.error || 'Failed to fetch system health', response.status, 'GET_HEALTH_ERROR', data);
      }
      return data.health;
    } catch (error) {
      console.error('Error fetching system health:', error);
      if (error instanceof ApiError) throw error;
      throw new ApiError('Failed to fetch system health', 500, 'GET_HEALTH_ERROR', { originalError: error instanceof Error ? error.message : String(error) });
    }
  },

  async getStats(): Promise<{
    totalEvents: number;
    totalCameras: number;
    activeCameras: number;
    knownVisitors: number;
    storageUsed: number;
    storageTotal: number;
  }> {
    try {
      const response = await fetchWithRetry(`${API_URL}/stats`);
      const data = await response.json();
      if (!data.success || !data.stats) {
        throw new ApiError(data.error || 'Failed to fetch system stats', response.status, 'GET_STATS_ERROR', data);
      }
      return data.stats;
    } catch (error) {
      console.error('Error fetching system stats:', error);
      if (error instanceof ApiError) throw error;
      throw new ApiError('Failed to fetch system stats', 500, 'GET_STATS_ERROR', { originalError: error instanceof Error ? error.message : String(error) });
    }
  },

  async getSystemOverview(): Promise<{
    systemName: string;
    version: string;
    uptime: number;
    cameras: number;
    events: number;
    health: string;
  }> {
    try {
      const response = await apiClient.get<{ success: boolean; overview: { systemName: string; version: string; uptime: number; cameras: number; events: number; health: string } }>('/system/overview');
      if (response.success) return response.overview;
      throw new ApiError('Failed to get system overview', 400, 'GET_SYSTEM_OVERVIEW_ERROR');
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError('Failed to get system overview', 500, 'GET_SYSTEM_OVERVIEW_ERROR', { originalError: error instanceof Error ? error.message : String(error) });
    }
  },

  async getHourlyAnalytics(startDate?: string, endDate?: string): Promise<{ hour: number; count: number }[]> {
    try {
      const params = new URLSearchParams();
      if (startDate) params.set('startDate', startDate);
      if (endDate) params.set('endDate', endDate);
      const queryString = params.toString();
      const url = `${API_URL}/analytics/hourly${queryString ? `?${queryString}` : ''}`;
      const response = await fetchWithRetry(url);
      const data = await response.json();
      if (!data.success || !data.hourlyData) {
        throw new ApiError(data.error || 'Failed to fetch hourly analytics', response.status, 'GET_HOURLY_ANALYTICS_ERROR', data);
      }
      return data.hourlyData;
    } catch (error) {
      console.error('Error fetching hourly analytics:', error);
      if (error instanceof ApiError) throw error;
      throw new ApiError('Failed to fetch hourly analytics', 500, 'GET_HOURLY_ANALYTICS_ERROR', { originalError: error instanceof Error ? error.message : String(error) });
    }
  },

  async getWeeklyAnalytics(): Promise<{ totalEvents: number; dailyBreakdown: { date: string; count: number }[] }> {
    try {
      const response = await fetchWithRetry(`${API_URL}/analytics/weekly`);
      const data = await response.json();
      if (!data.success || !data.weeklyData) {
        throw new ApiError(data.error || 'Failed to fetch weekly analytics', response.status, 'GET_WEEKLY_ANALYTICS_ERROR', data);
      }
      return data.weeklyData;
    } catch (error) {
      console.error('Error fetching weekly analytics:', error);
      if (error instanceof ApiError) throw error;
      throw new ApiError('Failed to fetch weekly analytics', 500, 'GET_WEEKLY_ANALYTICS_ERROR', { originalError: error instanceof Error ? error.message : String(error) });
    }
  },

  async getMonthlyAnalytics(): Promise<{ totalEvents: number; weeklyBreakdown: { week: string; count: number }[] }> {
    try {
      const response = await fetchWithRetry(`${API_URL}/analytics/monthly`);
      const data = await response.json();
      if (!data.success || !data.monthlyData) {
        throw new ApiError(data.error || 'Failed to fetch monthly analytics', response.status, 'GET_MONTHLY_ANALYTICS_ERROR', data);
      }
      return data.monthlyData;
    } catch (error) {
      console.error('Error fetching monthly analytics:', error);
      if (error instanceof ApiError) throw error;
      throw new ApiError('Failed to fetch monthly analytics', 500, 'GET_MONTHLY_ANALYTICS_ERROR', { originalError: error instanceof Error ? error.message : String(error) });
    }
  },

  async getStorageStats(): Promise<{ storageUsed: number; storageTotal: number }> {
    try {
      const response = await fetchWithRetry(`${API_URL}/analytics/storage`);
      const data = await response.json();
      if (!data.success || (data.storageUsed === undefined)) {
        throw new ApiError(data.error || 'Failed to fetch storage stats', response.status, 'GET_STORAGE_STATS_ERROR', data);
      }
      return { storageUsed: data.storageUsed, storageTotal: data.storageTotal };
    } catch (error) {
      console.error('Error fetching storage stats:', error);
      if (error instanceof ApiError) throw error;
      throw new ApiError('Failed to fetch storage stats', 500, 'GET_STORAGE_STATS_ERROR', { originalError: error instanceof Error ? error.message : String(error) });
    }
  },

  async getOpenCVStatus(): Promise<{
    status: string; version: string; modelsLoaded: boolean; gpuAvailable: boolean;
  }> {
    try {
      const response = await apiClient.get<{ success: boolean; status: string; version: string; modelsLoaded: boolean; gpuAvailable: boolean }>('/opencv/status');
      if (response.success) {
        return { status: response.status, version: response.version, modelsLoaded: response.modelsLoaded, gpuAvailable: response.gpuAvailable };
      }
      throw new ApiError('Failed to get OpenCV status', 400, 'GET_OPENCV_STATUS_ERROR');
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError('Failed to get OpenCV status', 500, 'GET_OPENCV_STATUS_ERROR', { originalError: error instanceof Error ? error.message : String(error) });
    }
  },

  async getDetectionStats(): Promise<DetectionStats> {
    try {
      const response = await apiClient.get<{ success: boolean; stats: DetectionStats }>('/system/detection/stats');
      if (response.success) return response.stats;
      throw new ApiError('Failed to get detection stats', 400, 'GET_DETECTION_STATS_ERROR');
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError('Failed to get detection stats', 500, 'GET_DETECTION_STATS_ERROR', { originalError: error instanceof Error ? error.message : String(error) });
    }
  },

  async getDetectionTimeSeries(timeRange: string): Promise<TimeSeriesData[]> {
    try {
      const response = await apiClient.get<{ success: boolean; data: TimeSeriesData[] }>(`/system/detection/timeseries/${timeRange}`);
      if (response.success) return response.data;
      throw new ApiError('Failed to get detection time series', 400, 'GET_DETECTION_TIMESERIES_ERROR');
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError('Failed to get detection time series', 500, 'GET_DETECTION_TIMESERIES_ERROR', { originalError: error instanceof Error ? error.message : String(error) });
    }
  },

  async getCameraPerformance(): Promise<CameraPerformance[]> {
    try {
      const response = await apiClient.get<{ success: boolean; performance: CameraPerformance[] }>('/system/cameras/performance');
      if (response.success) return response.performance;
      throw new ApiError('Failed to get camera performance', 400, 'GET_CAMERA_PERFORMANCE_ERROR');
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError('Failed to get camera performance', 500, 'GET_CAMERA_PERFORMANCE_ERROR', { originalError: error instanceof Error ? error.message : String(error) });
    }
  },

  async getDayHighlights(date: string, options?: { limit?: number; sort?: 'recent' | 'persons' | 'faces' | 'unknown' | 'confidence' }): Promise<{
    success: boolean;
    date: string;
    sort: string;
    highlights: Array<{
      id: string; filename: string; cameraId: string; timestamp: string; eventType: string;
      confidence: number; personsDetected: number; facesDetected: number; knownFacesCount: number;
      unknownFacesCount: number; objectDetections: Record<string, unknown>[]; faceDetections: Record<string, unknown>[];
      imageUrl: string; metadata: Record<string, unknown>;
    }>;
    summary: { total: number; totalPersons: number; totalFaces: number; knownFaces: number };
  }> {
    try {
      const params: Record<string, string | number> = {};
      if (options?.limit) params.limit = options.limit;
      if (options?.sort) params.sort = options.sort;

      const response = await apiClient.get<{
        success: boolean; date: string; sort: string;
        highlights: Array<{
          id: string; filename: string; cameraId: string; timestamp: string; eventType: string;
          confidence: number; personsDetected: number; facesDetected: number; knownFacesCount: number;
          unknownFacesCount: number; objectDetections: Record<string, unknown>[]; faceDetections: Record<string, unknown>[];
          imageUrl: string; metadata: Record<string, unknown>;
        }>;
        summary: { total: number; totalPersons: number; totalFaces: number; knownFaces: number };
      }>(`/highlights/${date}`, params);

      if (response.success) return response;
      throw new ApiError('Failed to get day highlights', 400, 'GET_DAY_HIGHLIGHTS_ERROR');
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError('Failed to get day highlights', 500, 'GET_DAY_HIGHLIGHTS_ERROR', { originalError: error instanceof Error ? error.message : String(error) });
    }
  },

  async getDaySummary(date: string): Promise<{
    success: boolean;
    date: string;
    summary: { totalEvents: number; totalPersons: number; totalFaces: number; knownFaces: number; nightEvents: number };
    hourly: Array<{ hour: number; count: number }>;
  }> {
    try {
      const response = await apiClient.get<{
        success: boolean; date: string;
        summary: { totalEvents: number; totalPersons: number; totalFaces: number; knownFaces: number; nightEvents: number };
        hourly: Array<{ hour: number; count: number }>;
      }>(`/highlights/${date}/summary`);

      if (response.success) return response;
      throw new ApiError('Failed to get day summary', 400, 'GET_DAY_SUMMARY_ERROR');
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError('Failed to get day summary', 500, 'GET_DAY_SUMMARY_ERROR', { originalError: error instanceof Error ? error.message : String(error) });
    }
  },
};
