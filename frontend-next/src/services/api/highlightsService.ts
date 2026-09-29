import { apiClient, ApiError } from './baseClient';

/* ─── Types ─── */

export interface Highlight {
  id: string;
  filename: string;
  cameraId: string;
  timestamp: string;
  eventType: string;
  confidence: number;
  personsDetected: number;
  facesDetected: number;
  knownFacesCount: number;
  unknownFacesCount: number;
  objectDetections: Record<string, unknown>[];
  faceDetections: Record<string, unknown>[];
  imageUrl: string | null;
  metadata: Record<string, unknown>;
}

export interface HighlightsSummary {
  total: number;
  totalPersons: number;
  totalFaces: number;
  knownFaces: number;
}

export interface DaySummary {
  totalEvents: number;
  totalPersons: number;
  totalFaces: number;
  knownFaces: number;
  knownEvents: number;
  unknownEvents: number;
  nightEvents: number;
}

export interface HourlyCount {
  hour: number;
  count: number;
}

export interface HighlightsResponse {
  success: boolean;
  date: string;
  sort: string;
  highlights: Highlight[];
  summary: HighlightsSummary;
}

export interface SummaryResponse {
  success: boolean;
  date: string;
  summary: DaySummary;
  hourly: HourlyCount[];
}

export interface HighlightsQuery {
  sort?: 'recent' | 'persons' | 'faces' | 'unknown' | 'confidence';
  limit?: number;
}

/* ─── Service ─── */

export const highlightsService = {
  /** Get highlights list for a date with optional sort/limit. */
  async getHighlights(
    date: string,
    query?: HighlightsQuery,
  ): Promise<HighlightsResponse> {
    try {
      const params: Record<string, string | number> = {};
      if (query?.sort) params.sort = query.sort;
      if (query?.limit) params.limit = query.limit;

      const response = await apiClient.get<HighlightsResponse>(
        `/highlights/${date}`,
        params,
      );
      if (response.success) return response;
      throw new ApiError('Failed to fetch highlights', 400, 'GET_HIGHLIGHTS_ERROR');
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError('Failed to fetch highlights', 500, 'GET_HIGHLIGHTS_ERROR', {
        originalError: error instanceof Error ? error.message : String(error),
      });
    }
  },

  /** Get summary stats and hourly breakdown for a date. */
  async getSummary(date: string): Promise<SummaryResponse> {
    try {
      const response = await apiClient.get<SummaryResponse>(`/highlights/${date}/summary`);
      if (response.success) return response;
      throw new ApiError('Failed to fetch highlights summary', 400, 'GET_SUMMARY_ERROR');
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError('Failed to fetch highlights summary', 500, 'GET_SUMMARY_ERROR', {
        originalError: error instanceof Error ? error.message : String(error),
      });
    }
  },
};
