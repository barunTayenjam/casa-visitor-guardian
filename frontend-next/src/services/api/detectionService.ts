// Detection-related API methods extracted from ApiService.ts
import { apiClient, fetchWithRetry, ApiError, API_URL } from './baseClient';

// ==================== DETECTION SERVICE ====================

export const detectionService = {
  async triggerPersonDetection(cameraId: string): Promise<{
    success: boolean;
    message: string;
    detections?: Array<{ label: string; confidence: number }>;
  }> {
    try {
      const response = await apiClient.post<{
        success: boolean;
        message: string;
        detections?: Array<{ label: string; confidence: number }>;
      }>(`/detection/person/${cameraId}/trigger`);
      return {
        success: response.success,
        message: response.message,
        detections: response.detections,
      };
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError(
        'Failed to trigger person detection',
        500,
        'TRIGGER_PERSON_DETECTION_ERROR',
        { originalError: error instanceof Error ? error.message : String(error) },
      );
    }
  },

  async triggerFaceDetection(cameraId: string): Promise<{
    success: boolean;
    message: string;
    faces?: Array<{ name: string; confidence: number }>;
  }> {
    try {
      const response = await apiClient.post<{
        success: boolean;
        message: string;
        faces?: Array<{ name: string; confidence: number }>;
      }>(`/detection/face/${cameraId}/trigger`);
      return { success: response.success, message: response.message, faces: response.faces };
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError('Failed to trigger face detection', 500, 'TRIGGER_FACE_DETECTION_ERROR', {
        originalError: error instanceof Error ? error.message : String(error),
      });
    }
  },

  async getPersonDetectionSettings(): Promise<{
    enabled: boolean;
    model: string;
    confidenceThreshold: number;
    nmsThreshold: number;
  }> {
    try {
      const response = await apiClient.get<{
        success: boolean;
        settings: {
          enabled: boolean;
          model: string;
          confidenceThreshold: number;
          nmsThreshold: number;
        };
      }>('/detection/person/settings');
      if (response.success) return response.settings;
      throw new ApiError(
        'Failed to get person detection settings',
        400,
        'GET_PERSON_DETECTION_SETTINGS_ERROR',
      );
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError(
        'Failed to get person detection settings',
        500,
        'GET_PERSON_DETECTION_SETTINGS_ERROR',
        { originalError: error instanceof Error ? error.message : String(error) },
      );
    }
  },

  async updatePersonDetectionSettings(settings: {
    enabled?: boolean;
    model?: string;
    confidenceThreshold?: number;
    nmsThreshold?: number;
  }): Promise<{ success: boolean; message: string }> {
    try {
      const response = await apiClient.put<{ success: boolean; message: string }>(
        '/detection/person/settings',
        settings,
      );
      return response;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError(
        'Failed to update person detection settings',
        500,
        'UPDATE_PERSON_DETECTION_SETTINGS_ERROR',
        { originalError: error instanceof Error ? error.message : String(error) },
      );
    }
  },

  async getFacialRecognitionSettings(): Promise<{
    enabled: boolean;
    model: string;
    confidenceThreshold: number;
    distanceThreshold: number;
  }> {
    try {
      const response = await apiClient.get<{
        success: boolean;
        settings: {
          enabled: boolean;
          model: string;
          confidenceThreshold: number;
          distanceThreshold: number;
        };
      }>('/detection/face/settings');
      if (response.success) return response.settings;
      throw new ApiError(
        'Failed to get facial recognition settings',
        400,
        'GET_FACE_RECOGNITION_SETTINGS_ERROR',
      );
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError(
        'Failed to get facial recognition settings',
        500,
        'GET_FACE_RECOGNITION_SETTINGS_ERROR',
        { originalError: error instanceof Error ? error.message : String(error) },
      );
    }
  },

  async updateFacialRecognitionSettings(settings: {
    enabled?: boolean;
    model?: string;
    confidenceThreshold?: number;
    distanceThreshold?: number;
  }): Promise<{ success: boolean; message: string }> {
    try {
      const response = await apiClient.put<{ success: boolean; message: string }>(
        '/detection/face/settings',
        settings,
      );
      return response;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError(
        'Failed to update facial recognition settings',
        500,
        'UPDATE_FACE_RECOGNITION_SETTINGS_ERROR',
        { originalError: error instanceof Error ? error.message : String(error) },
      );
    }
  },

  async analyzeMotionWithDetection(
    cameraId: string,
    options: { imagePath: string },
  ): Promise<{
    success: boolean;
    detections: Array<{ label: string; confidence: number; bbox: number[] }>;
  }> {
    try {
      const response = await apiClient.post<{
        success: boolean;
        detections: Array<{ label: string; confidence: number; bbox: number[] }>;
      }>(`/motion/${cameraId}/analyze`, options);
      return response;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError(
        'Failed to analyze motion with detection',
        500,
        'ANALYZE_MOTION_WITH_DETECTION_ERROR',
        { originalError: error instanceof Error ? error.message : String(error) },
      );
    }
  },

  async analyzeEvent(eventId: string, useStoredImage = false): Promise<{
    success: boolean;
    message?: string;
    analysis?: {
      summary: string;
      persons: unknown[];
      vehicles: unknown[];
      activities: string[];
      overall_summary: string;
      sceneDescription?: string;
      threatAssessment?: { level: string; factors: string[]; confidence: number };
      detectedEntities?: {
        people: string[];
        vehicles: string[];
        animals: string[];
        objects: string[];
        actions?: string[];
      };
      recommendedActions?: string[];
      additionalObservations?: string[];
      boundingBoxes?: Array<{
        label: string;
        confidence: number;
        x: number;
        y: number;
        width: number;
        height: number;
      }>;
      processing_time_ms?: number;
      processingTime?: number;
      model?: string;
      modelUsed?: string;
    };
    event?: { id: string; eventType: string; cameraId: string; timestamp: string };
  }> {
    try {
      const response = await fetchWithRetry(`${API_URL}/nvidia/analyze-event`, {
        method: 'POST',
        body: JSON.stringify({ eventId, useStoredImage }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new ApiError(
          data.error || 'Failed to analyze event',
          (response as Response).status,
          'ANALYZE_EVENT_ERROR',
          data,
        );
      }
      return data;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError(`Failed to analyze event ${eventId}`, 500, 'ANALYZE_EVENT_ERROR', {
        originalError: error instanceof Error ? error.message : String(error),
      });
    }
  },

  async analyzeEventWithBboxes(eventId: string): Promise<{
    success: boolean;
    boxes: Array<{
      label: string;
      confidence: number;
      x: number;
      y: number;
      width: number;
      height: number;
    }>;
    sceneDescription?: string;
    rawAnalysis?: {
      people?: string[];
      vehicles?: string[];
      objects?: string[];
      animals?: string[];
    };
    annotatedImage?: string | null;
    metadata?: { processingTime: number; modelUsed: string };
  }> {
    try {
      const response = await fetchWithRetry(`${API_URL}/nvidia/analyze-event-with-bboxes`, {
        method: 'POST',
        body: JSON.stringify({ eventId, includeAnnotatedImage: false }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new ApiError(
          data.error || 'Failed to analyze event with bounding boxes',
          (response as Response).status,
          'ANALYZE_EVENT_BBOXES_ERROR',
          data,
        );
      }
      return data;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError(
        `Failed to analyze event bounding boxes for ${eventId}`,
        500,
        'ANALYZE_EVENT_BBOXES_ERROR',
        { originalError: error instanceof Error ? error.message : String(error) },
      );
    }
  },

  async getEventAnalysis(eventId: string): Promise<{
    success: boolean;
    analysis: {
      sceneDescription: string;
      summary?: string;
      threatAssessment?: { level: string; factors: string[]; confidence: number };
      detectedEntities?: {
        people: string[];
        vehicles: string[];
        animals: string[];
        objects: string[];
        actions?: string[];
      };
      recommendedActions?: string[];
      processing_time_ms?: number;
      model?: string;
    } | null;
    boxes: Array<{
      label: string;
      confidence: number;
      x: number;
      y: number;
      width: number;
      height: number;
    }>;
  }> {
    try {
      const response = await fetchWithRetry(`${API_URL}/nvidia/event-analysis/${eventId}`);
      const data = await response.json();
      if (!response.ok) {
        throw new ApiError(
          data.error || 'Failed to get event analysis',
          (response as Response).status,
          'GET_EVENT_ANALYSIS_ERROR',
          data,
        );
      }
      return data;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError(`Failed to get event analysis for ${eventId}`, 500, 'GET_EVENT_ANALYSIS_ERROR', {
        originalError: error instanceof Error ? error.message : String(error),
      });
    }
  },

  async redoDetection(data: {
    eventIds?: string[];
    cameraId?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<{ success: boolean; jobId: string }> {
    try {
      const response = await apiClient.post<{ success: boolean; jobId: string }>(
        '/detection-redo/rerun-detection',
        data,
      );
      return response;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError('Failed to redo detection', 500, 'REDO_DETECTION_ERROR', {
        originalError: error instanceof Error ? error.message : String(error),
      });
    }
  },

  async batchDetect(data: { eventIds: string[] }): Promise<{ success: boolean; jobId: string }> {
    try {
      const response = await apiClient.post<{ success: boolean; jobId: string }>(
        '/detection-redo/rerun-event-detection',
        data,
      );
      return response;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError('Failed to start batch detection', 500, 'BATCH_DETECT_ERROR', {
        originalError: error instanceof Error ? error.message : String(error),
      });
    }
  },

  async getDetectionImage(imageId: string, includeOverlays: boolean = true): Promise<string> {
    try {
      const response = await apiClient.get<{ success: boolean; imageUrl: string }>(
        `/detections/image/${imageId}`,
        { overlays: includeOverlays },
      );
      if (response.success) return response.imageUrl;
      throw new ApiError('Failed to get detection image', 400, 'GET_DETECTION_IMAGE_ERROR');
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError(
        `Failed to get detection image ${imageId}`,
        500,
        'GET_DETECTION_IMAGE_ERROR',
        { originalError: error instanceof Error ? error.message : String(error) },
      );
    }
  },

  async getMotionSettings(cameraId: string): Promise<{
    sensitivity: number;
    requiredConsecutiveFrames: number;
    minContourArea: number;
    useGaussianBlur: boolean;
    blurKernelSize: number;
    timeZones: Record<string, { start: string; end: string; sensitivityMultiplier: number }>;
  }> {
    try {
      const response = await apiClient.get<{
        settings: {
          sensitivity: number;
          requiredConsecutiveFrames: number;
          minContourArea: number;
          useGaussianBlur: boolean;
          blurKernelSize: number;
          timeZones: Record<string, { start: string; end: string; sensitivityMultiplier: number }>;
        };
      }>(`/detection/motion/settings`, { cameraId });
      return response.settings;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError('Failed to get motion settings', 500, 'GET_MOTION_SETTINGS_ERROR');
    }
  },

  async updateMotionSettings(
    cameraId: string,
    settings: {
      sensitivity?: number;
      requiredConsecutiveFrames?: number;
      minContourArea?: number;
      useGaussianBlur?: boolean;
      blurKernelSize?: number;
      timeZones?: Record<string, { start: string; end: string; sensitivityMultiplier: number }>;
    },
  ): Promise<{ success: boolean; message: string }> {
    try {
      const response = await apiClient.put<{ success: boolean; message: string }>(
        '/detection/motion/settings',
        { cameraId, ...settings },
      );
      return response;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError('Failed to update motion settings', 500, 'UPDATE_MOTION_SETTINGS_ERROR');
    }
  },
};
