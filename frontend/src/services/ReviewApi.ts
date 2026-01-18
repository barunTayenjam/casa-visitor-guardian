import apiService from './ApiService';

export interface ReviewSegment {
  id: string;
  camera: string;
  start_time: string;
  end_time: string;
  severity: 'alert' | 'detection';
  labels: string[];
  thumbnail_path: string | null;
  preview_path: string | null;
  data: {
    object_count?: number;
    objects?: Array<{
      id: string;
      label: string;
      last_seen: string;
      score: number;
    }>;
    regions?: Array<{ x: number; y: number; width: number; height: number }>;
    motion_boxes?: Array<{ x: number; y: number; width: number; height: number }>;
    has_clip?: boolean;
    has_snapshot?: boolean;
    plus_id?: string;
  };
  retain_indefinitely: boolean;
  created_at: string;
  reviewed?: boolean;
}

export interface ReviewQuery {
  camera?: string;
  after?: string;
  before?: string;
  severity?: 'alert' | 'detection';
  labels?: string[];
  reviewed?: boolean;
  limit?: number;
  offset?: number;
}

export interface TimelineEvent {
  id: string;
  timestamp: string;
  camera: string;
  source: string;
  source_id: string;
  class_type: string;
  data: Record<string, unknown>;
}

export interface TimelineQuery {
  camera?: string;
  after?: string;
  before?: string;
  sources?: string[];
  limit?: number;
}

export interface DetectionConfig {
  thresholds: Record<string, { min_score: number; threshold: number }>;
  labelmap: Record<string, string>;
  score_history_length: number;
}

class ReviewApiService {
  async getReviewSegments(query: ReviewQuery = {}): Promise<{
    segments: ReviewSegment[];
    total: number;
    hasMore: boolean;
  }> {
    const params: Record<string, unknown> = {};
    if (query.camera) params.camera = query.camera;
    if (query.after) params.after = query.after;
    if (query.before) params.before = query.before;
    if (query.severity) params.severity = query.severity;
    if (query.labels) params.labels = query.labels;
    if (query.limit) params.limit = query.limit;
    if (query.offset) params.offset = query.offset;

    const response = await apiService.get<{
      success: boolean;
      data: { segments: ReviewSegment[]; total: number; hasMore: boolean };
    }>('/review', params);

    return response.data;
  }

  async getReviewSegment(id: string): Promise<ReviewSegment> {
    const response = await apiService.get<{ success: boolean; data: ReviewSegment }>(`/review/${id}`);
    return response.data;
  }

  async getSegmentThumbnail(segmentId: string): Promise<string> {
    return `/api/review/${segmentId}/thumbnail.jpg`;
  }

  async getSegmentPreview(segmentId: string): Promise<string> {
    return `/api/review/${segmentId}/preview.mp4`;
  }

  async acknowledgeSegment(segmentId: string): Promise<void> {
    await apiService.post(`/review/${segmentId}/acknowledge`);
  }

  async generateReviewSegments(camera: string): Promise<void> {
    await apiService.post(`/review/generate/${camera}`);
  }

  async getTimeline(query: TimelineQuery = {}): Promise<{
    events: TimelineEvent[];
    summary: Record<string, number>;
  }> {
    const params: Record<string, unknown> = {};
    if (query.camera) params.camera = query.camera;
    if (query.after) params.after = query.after;
    if (query.before) params.before = query.before;
    if (query.sources) params.sources = query.sources;
    if (query.limit) params.limit = query.limit;

    const response = await apiService.get<{
      success: boolean;
      data: { events: TimelineEvent[]; summary: Record<string, number> };
    }>('/timeline', params);

    return response.data;
  }

  async getActiveObjects(camera: string): Promise<{
    objects: Array<{ id: string; label: string; lastSeen: string; score: number }>;
    count: number;
  }> {
    const response = await apiService.get<{
      success: boolean;
      data: { objects: Array<{ id: string; label: string; lastSeen: string; score: number }>; count: number };
    }>(`/timeline/active/${camera}`);

    return response.data;
  }

  async getAdaptiveRegions(camera: string): Promise<{ cells: string[]; last_update: string | null }> {
    const response = await apiService.get<{
      success: boolean;
      data: { cells: string[]; last_update: string | null };
    }>(`/timeline/regions/${camera}`);

    return response.data;
  }

  async clearAdaptiveRegions(camera: string): Promise<void> {
    await fetch(`/api/timeline/regions/${camera}`, { method: 'DELETE' });
  }

  async getDetectionConfig(camera?: string): Promise<DetectionConfig> {
    const params = camera ? { camera } : {};
    const response = await apiService.get<{
      success: boolean;
      data: DetectionConfig;
    }>('/detection/config', params);

    return response.data;
  }

  async updateDetectionConfig(config: Partial<DetectionConfig>, camera?: string): Promise<void> {
    const url = camera ? `/api/detection/config?camera=${camera}` : '/api/detection/config';
    await fetch(url, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
    });
  }

  async filterDetections(
    detections: Array<{ label: string; score: number; object_id?: string }>,
    camera?: string
  ): Promise<{
    filtered: Array<{ label: string; score: number; object_id?: string; filtered: boolean; reason?: string }>;
    config: DetectionConfig;
  }> {
    const response = await apiService.post<{
      success: boolean;
      data: {
        filtered: Array<{ label: string; score: number; object_id?: string; filtered: boolean; reason?: string }>;
        config: DetectionConfig;
      };
    }>('/detection/filter', { detections, camera });

    return response.data;
  }
}

export const reviewApi = new ReviewApiService();
export default reviewApi;
