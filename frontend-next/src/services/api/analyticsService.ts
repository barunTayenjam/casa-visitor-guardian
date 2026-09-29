// Analytics time-series API methods (hourly / weekly / monthly).
// Daily insights live in insightsService.ts (fetchDailyInsights); storage
// lives in systemService.ts (getStorageStats) — not duplicated here.
import { fetchWithRetry, ApiError, API_URL } from './baseClient';
import { fetchDailyInsights, type DailyInsights } from './insightsService';

// ==================== TYPES ====================

export interface HourCount {
  hour: number;
  count: number;
}

export interface DayCount {
  date: string;
  count: number;
}

export interface WeekCount {
  week: string;
  count: number;
}

// ==================== ANALYTICS SERVICE ====================

export const analyticsService = {
  async getHourly(startDate?: string, endDate?: string): Promise<HourCount[]> {
    try {
      const params = new URLSearchParams();
      if (startDate) params.set('startDate', startDate);
      if (endDate) params.set('endDate', endDate);
      const queryString = params.toString();
      const url = `${API_URL}/analytics/hourly${queryString ? `?${queryString}` : ''}`;
      const response = await fetchWithRetry(url);
      const data = (await response.json()) as {
        success: boolean;
        hourlyData?: Array<{ hour: number | string; count: number | string }>;
        error?: string;
      };
      if (!data.success || !data.hourlyData) {
        throw new ApiError(
          data.error || 'Failed to fetch hourly analytics',
          response.status,
          'GET_HOURLY_ANALYTICS_ERROR',
          data as unknown as Record<string, unknown>,
        );
      }
      return data.hourlyData.map((h) => ({
        hour: typeof h.hour === 'string' ? parseInt(h.hour, 10) : h.hour,
        count: typeof h.count === 'string' ? parseInt(h.count, 10) : h.count,
      }));
    } catch (error) {
      console.error('Error fetching hourly analytics:', error);
      if (error instanceof ApiError) throw error;
      throw new ApiError('Failed to fetch hourly analytics', 500, 'GET_HOURLY_ANALYTICS_ERROR', {
        originalError: error instanceof Error ? error.message : String(error),
      });
    }
  },

  async getWeekly(): Promise<{ totalEvents: number; dailyBreakdown: DayCount[] }> {
    try {
      const response = await fetchWithRetry(`${API_URL}/analytics/weekly`);
      const data = (await response.json()) as {
        success: boolean;
        weeklyData?: {
          totalEvents: number;
          dailyBreakdown: Array<{ date: string; count: number }>;
        };
        error?: string;
      };
      if (!data.success || !data.weeklyData) {
        throw new ApiError(
          data.error || 'Failed to fetch weekly analytics',
          response.status,
          'GET_WEEKLY_ANALYTICS_ERROR',
          data as unknown as Record<string, unknown>,
        );
      }
      return data.weeklyData;
    } catch (error) {
      console.error('Error fetching weekly analytics:', error);
      if (error instanceof ApiError) throw error;
      throw new ApiError('Failed to fetch weekly analytics', 500, 'GET_WEEKLY_ANALYTICS_ERROR', {
        originalError: error instanceof Error ? error.message : String(error),
      });
    }
  },

  async getMonthly(): Promise<{ totalEvents: number; weeklyBreakdown: WeekCount[] }> {
    try {
      const response = await fetchWithRetry(`${API_URL}/analytics/monthly`);
      const data = (await response.json()) as {
        success: boolean;
        monthlyData?: {
          totalEvents: number;
          weeklyBreakdown: Array<{ week: string; count: number }>;
        };
        error?: string;
      };
      if (!data.success || !data.monthlyData) {
        throw new ApiError(
          data.error || 'Failed to fetch monthly analytics',
          response.status,
          'GET_MONTHLY_ANALYTICS_ERROR',
          data as unknown as Record<string, unknown>,
        );
      }
      return data.monthlyData;
    } catch (error) {
      console.error('Error fetching monthly analytics:', error);
      if (error instanceof ApiError) throw error;
      throw new ApiError('Failed to fetch monthly analytics', 500, 'GET_MONTHLY_ANALYTICS_ERROR', {
        originalError: error instanceof Error ? error.message : String(error),
      });
    }
  },

  // Thin passthrough — canonical daily query lives in insightsService.
  async getDaily(date: string): Promise<DailyInsights> {
    return fetchDailyInsights(date);
  },
};
