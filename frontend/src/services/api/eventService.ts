// Event-related API methods extracted from ApiService.ts
import { MotionEvent } from '@/types/security';
import { apiClient, fetchWithRetry, ApiError, NetworkError, API_URL } from './baseClient';

// ==================== TYPES ====================

interface DetectionData {
  confidence: number;
  boundingBox?: number[];
  class?: string;
}

interface RawDetection {
  class?: string;
  confidence?: number;
  label?: string;
  name?: string;
  isKnown?: boolean;
  bbox?: { x: number; y: number; width: number; height: number };
}

interface FaceDetectionData {
  confidence: number;
  boundingBox?: number[];
  personId?: string;
  personName?: string;
  isKnown?: boolean;
}

interface BackendMotionEvent {
  id: string;
  cameraId: string;
  timestamp: string;
  imagePath: string;
  confidence: number;
  duration: number;
  cameraName?: string;
  labels?: string[];
  location?: string;
  archived?: boolean;
  metadata?: Record<string, unknown>;
  filename?: string;
  event_type?: string;
  imageUrl?: string;
}

interface PaginationInfo {
  totalEvents: number;
  totalPages: number;
  currentPage: number;
  pageSize: number;
}

interface HistoricalEventsResponse {
  events: MotionEvent[];
  pagination: PaginationInfo;
}

interface EnhancedEvent {
  id: string;
  event_type: string;
  filename: string;
  timestamp: string;
  cameraId: string;
  confidence: number;
  metadata: Record<string, unknown>;
  imageUrl: string;
  persons_detected: number;
  faces_detected: number;
  known_faces_count: number;
  unknown_faces_count: number;
  object_detections: DetectionData[] | null;
  face_detections: FaceDetectionData[] | null;
}

interface EnhancedEventsResponse {
  success: boolean;
  events: EnhancedEvent[];
  pagination?: { totalEvents: number; totalPages: number; currentPage: number; pageSize: number };
}

interface DetectionFilters {
  startTime?: string;
  endTime?: string;
  cameraIds?: string[];
  detectionTypes?: string[];
  minConfidence?: number;
  limit?: number;
}

interface DetectionEvent {
  id: string;
  timestamp: string;
  cameraId: string;
  cameraName: string;
  imagePath: string;
  detectionType: 'person' | 'face' | 'object';
  confidence: number;
  boundingBox: { x: number; y: number; width: number; height: number };
  className?: string;
  personName?: string;
  isKnown?: boolean;
  metadata: Record<string, unknown>;
}

// Batch processing types
interface BatchTimeRange {
  label: string;
  value: { start: Date | string; end: Date | string };
}

interface BatchJob {
  id: string;
  status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
  startTime?: string;
  endTime?: string;
  progress: { total: number; processed: number; successful: number; failed: number; currentFile?: string };
  options: {
    timeRange: { start: string; end: string };
    cameraIds?: string[];
    detectionTypes: ('person' | 'face' | 'both')[];
    confidenceThreshold: number;
    saveResults: boolean;
    outputFormat: 'json' | 'csv' | 'database';
  };
  results?: { totalImages: number; personDetections: number; faceDetections: number; processingTime: number };
  error?: string;
}

interface BatchProcessingOptions {
  timeRange: { start: string; end: string };
  cameraIds?: string[];
  detectionTypes: ('person' | 'face' | 'both')[];
  confidenceThreshold: number;
  saveResults: boolean;
  outputFormat: 'json' | 'csv' | 'database';
}

interface BatchResults {
  jobId: string;
  status: string;
  totalProcessed: number;
  successfulDetections: number;
  failedDetections: number;
  results: Array<{ eventId: string; detections: unknown[] }>;
}

interface BatchStats {
  totalJobs: number;
  completedJobs: number;
  failedJobs: number;
  averageProcessingTime: number;
}

// ==================== EVENT SERVICE ====================

export const eventService = {
  async getDailyStats(): Promise<number> {
    try {
      const response = await fetchWithRetry(`${API_URL}/events/stats/today`);
      const data = await response.json();
      if (!data.success) {
        throw new ApiError(data.error || 'Failed to fetch daily stats', response.status, 'GET_DAILY_STATS_ERROR', data);
      }
      return data.count;
    } catch (error) {
      console.error('Error fetching daily stats:', error);
      return 0; // Return 0 if API fails, avoiding UI crashes
    }
  },

  async getMotionEvents(limit = 100): Promise<MotionEvent[]> {
    try {
      const response = await fetchWithRetry(`${API_URL}/events/motion?limit=${limit}`);
      const data = await response.json();
      if (!data.success || !data.events) {
        throw new ApiError(data.error || 'Failed to fetch motion events', response.status, 'GET_MOTION_EVENTS_ERROR', data);
      }
      return data.events.map((event: BackendMotionEvent) => ({
        ...event,
        timestamp: new Date(event.timestamp),
        cameraName: event.cameraName || event.cameraId || 'Unknown Camera',
        location: event.location || 'Unknown',
        labels: event.labels || ['motion'],
      }));
    } catch (error) {
      console.error('Error fetching motion events:', error);
      if (error instanceof ApiError) throw error;
      throw new ApiError('Failed to fetch motion events', 500, 'GET_MOTION_EVENTS_ERROR', { originalError: error instanceof Error ? error.message : String(error) });
    }
  },

  async getCameraMotionEvents(cameraId: string, limit = 20): Promise<MotionEvent[]> {
    try {
      const response = await fetchWithRetry(`${API_URL}/events/motion/${cameraId}?limit=${limit}`);
      const data = await response.json();
      if (!data.success || !data.events) {
        throw new ApiError(data.error || `Failed to fetch motion events for camera ${cameraId}`, response.status, 'GET_CAMERA_MOTION_EVENTS_ERROR', data);
      }
      return data.events.map((event: BackendMotionEvent) => ({
        ...event,
        timestamp: new Date(event.timestamp),
        cameraName: event.cameraName || event.cameraId || 'Unknown Camera',
        location: event.location || 'Unknown',
        labels: event.labels || ['motion'],
      }));
    } catch (error) {
      console.error(`Error fetching motion events for camera ${cameraId}:`, error);
      if (error instanceof ApiError) throw error;
      throw new ApiError(`Failed to fetch motion events for camera ${cameraId}`, 500, 'GET_CAMERA_MOTION_EVENTS_ERROR', { originalError: error instanceof Error ? error.message : String(error) });
    }
  },

  async getSnapshots(): Promise<string[]> {
    try {
      const response = await fetchWithRetry(`${API_URL}/events/snapshots`);
      const data = await response.json();
      if (!data.success) {
        throw new ApiError(data.error || 'Failed to fetch snapshots', response.status, 'GET_SNAPSHOTS_ERROR', data);
      }
      return data.files || [];
    } catch (error) {
      console.error('Error fetching snapshots:', error);
      if (error instanceof ApiError) throw error;
      throw new ApiError('Failed to fetch snapshots', 500, 'GET_SNAPSHOTS_ERROR', { originalError: error instanceof Error ? error.message : String(error) });
    }
  },

  async getEventsList(): Promise<string[]> {
    try {
      const response = await fetchWithRetry(`${API_URL}/events/list`);
      const data = await response.json();
      if (!data.success) {
        throw new ApiError(data.error || 'Failed to fetch events list', response.status, 'GET_EVENTS_ERROR', data);
      }
      return data.files || [];
    } catch (error) {
      console.error('Error fetching events list:', error);
      if (error instanceof ApiError) throw error;
      throw new ApiError('Failed to fetch events list', 500, 'GET_EVENTS_ERROR', { originalError: error instanceof Error ? error.message : String(error) });
    }
  },

  getEventImageUrl(filename: string): string {
    if (!filename) {
      throw new ApiError('Filename is required', 400, 'INVALID_FILENAME', { filename });
    }
    return `/events/${filename}`;
  },

  getSnapshotImageUrl(filename: string): string {
    if (!filename) {
      throw new ApiError('Filename is required', 400, 'INVALID_FILENAME', { filename });
    }
    return `/snapshots/${filename}`;
  },

  async getHistoricalEvents(options?: {
    page?: number; pageSize?: number; cameraId?: string; searchQuery?: string;
    startDate?: Date; endDate?: Date; sortBy?: string;
    detectionType?: 'all' | 'face' | 'person' | 'motion';
  }): Promise<HistoricalEventsResponse> {
    try {
      const params = new URLSearchParams();
      if (options?.page) params.append('page', options.page.toString());
      if (options?.pageSize) params.append('pageSize', options.pageSize.toString());
      if (options?.cameraId) params.append('cameraId', options.cameraId);
      if (options?.searchQuery) params.append('searchQuery', options.searchQuery);
      if (options?.startDate) params.append('startDate', options.startDate.toISOString());
      if (options?.endDate) params.append('endDate', options.endDate.toISOString());
      if (options?.sortBy) params.append('sortBy', options.sortBy);
      if (options?.detectionType && options.detectionType !== 'all') params.append('detectionType', options.detectionType);

      const response = await fetchWithRetry(`${API_URL}/events/list-enhanced?${params.toString()}`);
      const data = await response.json();

      if (!data.success || !data.events || !data.pagination) {
        throw new ApiError(data.error || 'Failed to fetch historical events', response.status, 'GET_HISTORICAL_EVENTS_ERROR', data);
      }

      const transformedEvents: MotionEvent[] = data.events.map((event: BackendMotionEvent) => {
        let filename = '';
        if (event.imagePath) {
          const pathParts = event.imagePath.split('/');
          filename = pathParts[pathParts.length - 1];
        } else if (event.filename) {
          filename = event.filename;
        }

        const detections = event.metadata?.detections
          ? (event.metadata.detections as RawDetection[]).map((det) => ({
              type: det.class ? det.class.toLowerCase() : 'object',
              confidence: det.confidence || 0,
              name: det.label || det.name,
              isKnown: det.isKnown || false,
              boundingBox: det.bbox ? { x: det.bbox.x, y: det.bbox.y, width: det.bbox.width, height: det.bbox.height } : undefined,
            }))
          : [];

        return {
          ...event,
          id: event.id,
          cameraId: event.cameraId || 'unknown',
          cameraName: event.cameraName || event.cameraId || 'Unknown Camera',
          location: event.location || 'Unknown',
          duration: event.duration || 0,
          labels: event.labels || (event.metadata?.detection_types as string[] | undefined) || (event.event_type === 'motion' ? ['motion'] : ['detection']),
          timestamp: event.timestamp ? new Date(event.timestamp) : ((event.metadata?.detected_at as string | undefined) ? new Date(event.metadata.detected_at as string) : new Date()),
          imageUrl: event.imageUrl || (filename ? this.getEventImageUrl(filename) : null),
          hasPersons: event.metadata?.hasPersons,
          personCount: event.metadata?.personCount || event.metadata?.persons_detected || 0,
          hasFaces: event.metadata?.hasFaces,
          faceCount: event.metadata?.faceCount || event.metadata?.faces_detected || 0,
          knownFaces: event.metadata?.knownFaces || event.metadata?.known_faces_count || 0,
          unknownFaces: event.metadata?.unknownFaces || event.metadata?.unknown_faces_count || 0,
          lightLevel: event.metadata?.lightLevel,
          motionArea: event.metadata?.motionArea,
          metadata: event.metadata,
          detections,
        };
      });

      return { events: transformedEvents, pagination: data.pagination };
    } catch (error) {
      console.error('Error fetching historical events:', error);
      if (error instanceof ApiError) throw error;
      throw new ApiError('Failed to fetch historical events', 500, 'GET_HISTORICAL_EVENTS_ERROR', { originalError: error instanceof Error ? error.message : String(error) });
    }
  },

  async archiveEvent(id: string): Promise<void> {
    try {
      const response = await fetchWithRetry(`${API_URL}/events/${id}/archive`, { method: 'POST' });
      const data = await response.json();
      if (!data.success) {
        throw new ApiError(data.error || `Failed to archive event ${id}`, response.status, 'ARCHIVE_EVENT_ERROR', data);
      }
    } catch (error) {
      console.error(`Error archiving event ${id}:`, error);
      if (error instanceof ApiError) throw error;
      throw new ApiError(`Failed to archive event ${id}`, 500, 'ARCHIVE_EVENT_ERROR', { originalError: error instanceof Error ? error.message : String(error) });
    }
  },

  async getEnhancedEventsList(options?: {
    limit?: number; page?: number; pageSize?: number; event_type?: string;
    camera_id?: string; start_date?: string; end_date?: string;
    searchQuery?: string; sortBy?: string;
    confidence?: 'all' | 'high' | 'medium' | 'low';
    faceStatus?: 'all' | 'has_faces' | 'known_faces' | 'unknown_faces' | 'no_faces';
  }): Promise<EnhancedEventsResponse> {
    try {
      const params = new URLSearchParams();
      if (options) {
        if (options.limit) params.append('limit', options.limit.toString());
        if (options.page) params.append('page', options.page.toString());
        if (options.pageSize) params.append('pageSize', options.pageSize.toString());
        if (options.event_type) params.append('event_type', options.event_type);
        if (options.camera_id) params.append('camera_id', options.camera_id);
        if (options.start_date) params.append('start_date', options.start_date);
        if (options.end_date) params.append('end_date', options.end_date);
        if (options.searchQuery) params.append('searchQuery', options.searchQuery);
        if (options.sortBy) params.append('sortBy', options.sortBy);

        // Map confidence level to min/max confidence (DB stores 0-1 range)
        if (options.confidence && options.confidence !== 'all') {
          switch (options.confidence) {
            case 'high':
              params.append('min_confidence', '0.8');
              break;
            case 'medium':
              params.append('min_confidence', '0.5');
              params.append('max_confidence', '0.8');
              break;
            case 'low':
              params.append('max_confidence', '0.5');
              break;
          }
        }

        if (options.faceStatus && options.faceStatus !== 'all') {
          params.append('face_status', options.faceStatus);
        }
      }

      const response = await apiClient.get<EnhancedEventsResponse>(`/events/list-enhanced?${params.toString()}`);
      if (!response.success) {
        throw new ApiError('Failed to get enhanced events', 400, 'GET_ENHANCED_EVENTS_ERROR');
      }
      return response;
    } catch (error) {
      console.error('Error fetching enhanced events list:', error);
      if (error instanceof ApiError) throw error;
      throw new ApiError('Failed to fetch enhanced events list', 500, 'GET_ENHANCED_EVENTS_ERROR', { originalError: error instanceof Error ? error.message : String(error) });
    }
  },

  async getDetectionHistory(filters: DetectionFilters): Promise<DetectionEvent[]> {
    try {
      const params = new URLSearchParams();
      if (filters.startTime) params.append('startDate', filters.startTime);
      if (filters.endTime) params.append('endDate', filters.endTime);
      if (filters.cameraIds && filters.cameraIds.length > 0) params.append('cameraId', filters.cameraIds[0]);
      if (filters.detectionTypes && filters.detectionTypes.length > 0) {
        const type = filters.detectionTypes[0];
        if (type === 'person') params.append('detectionType', 'person');
        else if (type === 'face') params.append('detectionType', 'face');
      }
      if (filters.minConfidence !== undefined) params.append('minConfidence', filters.minConfidence.toString());
      params.append('page', '1');
      if (filters.limit) params.append('pageSize', filters.limit.toString());

      const response = await fetchWithRetry(`${API_URL}/events/history?${params.toString()}`);
      const data = await response.json();

      if (!data.success || !data.events) {
        throw new ApiError(data.error || 'Failed to get detection history', response.status, 'GET_DETECTION_HISTORY_ERROR', data);
      }

      return data.events.map((event: {
        id: string; timestamp: string; cameraId: string; cameraName: string; original_filename: string;
        metadata?: { detectionType?: string; confidence?: number; boundingBox?: { x: number; y: number; width: number; height: number }; className?: string; label?: string; personName?: string; isKnown?: boolean };
      }) => {
        const detectionType = (event.metadata?.detectionType || 'person') as 'person' | 'face' | 'object';
        return {
          id: event.id,
          timestamp: event.timestamp,
          cameraId: event.cameraId,
          cameraName: event.cameraName,
          imagePath: this.getEventImageUrl(event.original_filename),
          detectionType,
          confidence: event.metadata?.confidence || 0,
          boundingBox: event.metadata?.boundingBox || { x: 0, y: 0, width: 0, height: 0 },
          className: event.metadata?.className,
          personName: event.metadata?.personName,
          isKnown: event.metadata?.isKnown,
          metadata: event.metadata || {},
        };
      });
    } catch (error) {
      console.error('Error fetching detection history:', error);
      if (error instanceof ApiError) throw error;
      throw new ApiError('Failed to get detection history', 500, 'GET_DETECTION_HISTORY_ERROR', { originalError: error instanceof Error ? error.message : String(error) });
    }
  },

  async getDetectionImage(imageId: string, includeOverlays: boolean = true): Promise<string> {
    try {
      const response = await apiClient.get<{ success: boolean; imageUrl: string }>(`/detections/image/${imageId}`, { overlays: includeOverlays });
      if (response.success) return response.imageUrl;
      throw new ApiError('Failed to get detection image', 400, 'GET_DETECTION_IMAGE_ERROR');
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError(`Failed to get detection image ${imageId}`, 500, 'GET_DETECTION_IMAGE_ERROR', { originalError: error instanceof Error ? error.message : String(error) });
    }
  },

  async analyzeEvent(eventId: string): Promise<{
    success: boolean; analysis: { summary: string; objects: string[]; persons: number; faces: number };
  }> {
    try {
      const response = await apiClient.post<{ success: boolean; analysis: { summary: string; objects: string[]; persons: number; faces: number } }>(`/events/${eventId}/analyze`);
      if (response.success) return response;
      throw new ApiError('Failed to analyze event', 400, 'ANALYZE_EVENT_ERROR');
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError(`Failed to analyze event ${eventId}`, 500, 'ANALYZE_EVENT_ERROR', { originalError: error instanceof Error ? error.message : String(error) });
    }
  },

  // ==================== BATCH PROCESSING ====================

  async getBatchTimeRanges(): Promise<BatchTimeRange[]> {
    try {
      const response = await apiClient.get<{ success: boolean; timeRanges: BatchTimeRange[] }>('/batch/time-ranges');
      if (response.success) return response.timeRanges;
      throw new ApiError('Failed to get batch time ranges', 400, 'GET_BATCH_TIME_RANGES_ERROR');
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError('Failed to get batch time ranges', 500, 'GET_BATCH_TIME_RANGES_ERROR', { originalError: error instanceof Error ? error.message : String(error) });
    }
  },

  async getBatchJobs(): Promise<BatchJob[]> {
    try {
      const response = await apiClient.get<{ success: boolean; jobs: BatchJob[] }>('/batch/jobs');
      if (response.success) return response.jobs;
      throw new ApiError('Failed to get batch jobs', 400, 'GET_BATCH_JOBS_ERROR');
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError('Failed to get batch jobs', 500, 'GET_BATCH_JOBS_ERROR', { originalError: error instanceof Error ? error.message : String(error) });
    }
  },

  async startBatchProcessing(options: BatchProcessingOptions): Promise<string> {
    try {
      const response = await apiClient.post<{ success: boolean; jobId: string }>('/batch/start', options);
      if (response.success) return response.jobId;
      throw new ApiError('Failed to start batch processing', 400, 'START_BATCH_ERROR');
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError('Failed to start batch processing', 500, 'START_BATCH_ERROR', { originalError: error instanceof Error ? error.message : String(error) });
    }
  },

  async cancelBatchJob(jobId: string): Promise<boolean> {
    try {
      const response = await apiClient.post<{ success: boolean; cancelled: boolean }>(`/batch/${jobId}/cancel`);
      return response.success && response.cancelled;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError(`Failed to cancel batch job ${jobId}`, 500, 'CANCEL_BATCH_ERROR', { originalError: error instanceof Error ? error.message : String(error) });
    }
  },

  async getBatchResults(jobId: string): Promise<BatchResults> {
    try {
      const response = await apiClient.get<{ success: boolean; results: BatchResults }>(`/batch/${jobId}/results`);
      if (response.success) return response.results;
      throw new ApiError('Failed to get batch results', 400, 'GET_BATCH_RESULTS_ERROR');
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError('Failed to get batch results', 500, 'GET_BATCH_RESULTS_ERROR', { originalError: error instanceof Error ? error.message : String(error) });
    }
  },

  async getBatchStats(): Promise<BatchStats> {
    try {
      const response = await apiClient.get<{ success: boolean; stats: BatchStats }>('/batch/stats');
      if (response.success) return response.stats;
      throw new ApiError('Failed to get batch stats', 400, 'GET_BATCH_STATS_ERROR');
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError('Failed to get batch stats', 500, 'GET_BATCH_STATS_ERROR', { originalError: error instanceof Error ? error.message : String(error) });
    }
  },

  async getBatchAvailableEvents(params: { startDate: string; endDate: string; cameraIds?: string[] }): Promise<{ count: number; events: Array<{ id: string; timestamp: string; cameraId: string }> }> {
    try {
      const queryParams = new URLSearchParams({ startDate: params.startDate, endDate: params.endDate });
      if (params.cameraIds) queryParams.append('cameraIds', params.cameraIds.join(','));
      const response = await apiClient.get<{ success: boolean; count: number; events: Array<{ id: string; timestamp: string; cameraId: string }> }>(`/batch/available-events?${queryParams.toString()}`);
      if (response.success) return { count: response.count, events: response.events };
      throw new ApiError('Failed to get available events', 400, 'GET_BATCH_AVAILABLE_EVENTS_ERROR');
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError('Failed to get available events', 500, 'GET_BATCH_AVAILABLE_EVENTS_ERROR', { originalError: error instanceof Error ? error.message : String(error) });
    }
  },

  async downloadBatchResults(jobId: string): Promise<void> {
    try {
      window.open(`${API_URL}/batch/${jobId}/download`, '_blank');
    } catch (error) {
      console.error(`Error downloading batch results for job ${jobId}:`, error);
      throw new ApiError('Failed to download batch results', 500, 'DOWNLOAD_BATCH_RESULTS_ERROR', { originalError: error instanceof Error ? error.message : String(error) });
    }
  },

  async getCalendarStats(year: number, month: number, cameraId?: string): Promise<{
    data: Record<string, { count: number; motion: number; face: number; persons: number; avgConfidence: number }>;
    summary: { totalEvents: number; totalPersons: number; avgConfidence: number };
  }> {
    try {
      const params = new URLSearchParams({ year: String(year), month: String(month) });
      if (cameraId && cameraId !== 'all') params.append('camera_id', cameraId);
      const response = await fetchWithRetry(`${API_URL}/events/stats/calendar?${params.toString()}`);
      const data = await response.json();
      if (!data.success) {
        throw new ApiError(data.error || 'Failed to fetch calendar stats', response.status, 'GET_CALENDAR_STATS_ERROR', data);
      }
      return { data: data.data, summary: data.summary };
    } catch (error) {
      console.error('Error fetching calendar stats:', error);
      return { data: {}, summary: { totalEvents: 0, totalPersons: 0, avgConfidence: 0 } };
    }
  },

  async getRangeStats(startDate: Date, endDate: Date, cameraId?: string): Promise<{
    totalEvents: number;
    motionEvents: number;
    faceEvents: number;
    totalPersons: number;
    totalFaces: number;
    knownFaces: number;
    unknownFaces: number;
    avgConfidence: number;
  }> {
    try {
      const params = new URLSearchParams({
        start_date: startDate.toISOString(),
        end_date: endDate.toISOString(),
      });
      if (cameraId && cameraId !== 'all') params.append('camera_id', cameraId);
      const response = await fetchWithRetry(`${API_URL}/events/stats/range?${params.toString()}`);
      const data = await response.json();
      if (!data.success) {
        throw new ApiError(data.error || 'Failed to fetch range stats', response.status, 'GET_RANGE_STATS_ERROR', data);
      }
      return data.stats;
    } catch (error) {
      console.error('Error fetching range stats:', error);
      return {
        totalEvents: 0,
        motionEvents: 0,
        faceEvents: 0,
        totalPersons: 0,
        totalFaces: 0,
        knownFaces: 0,
        unknownFaces: 0,
        avgConfidence: 0,
      };
    }
  },
};
