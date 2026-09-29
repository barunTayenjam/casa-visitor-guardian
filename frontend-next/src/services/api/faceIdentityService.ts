// Live face-identity API methods (from event_detections, not face_clusters)
import { fetchWithRetry, ApiError, API_URL } from './baseClient';

// ==================== TYPES ====================

export interface FaceIdentity {
  identity: string;
  event_count: number;
  first_seen: string;
  last_seen: string;
  avg_confidence: number;
  has_embedding: boolean;
  representative_event_id: string | null;
  representative_image: string | null;
  camera_ids: string[];
}

export interface FaceIdentitiesResponse {
  success: boolean;
  identities?: FaceIdentity[];
  error?: string;
}

// ==================== FACE IDENTITY SERVICE ====================

export const faceIdentityService = {
  async getFaceIdentities(): Promise<FaceIdentitiesResponse> {
    try {
      const response = await fetchWithRetry(`${API_URL}/face-identities`);
      const data = await response.json();

      if (!data.success) {
        throw new ApiError(
          data.error || 'Failed to fetch face identities',
          response.status,
          'GET_FACE_IDENTITIES_ERROR',
          data,
        );
      }

      return data;
    } catch (error) {
      console.error('Error fetching face identities:', error);
      if (error instanceof ApiError) throw error;
      throw new ApiError('Failed to fetch face identities', 500, 'GET_FACE_IDENTITIES_ERROR', {
        originalError: error instanceof Error ? error.message : String(error),
      });
    }
  },

  async renameIdentity(identity: string, name: string): Promise<FaceIdentitiesResponse> {
    try {
      const response = await fetchWithRetry(`${API_URL}/face-identities/${identity}/name`, {
        method: 'POST',
        body: JSON.stringify({ name }),
      });
      const data = await response.json();

      if (!data.success) {
        throw new ApiError(
          data.error || 'Failed to rename identity',
          response.status,
          'RENAME_IDENTITY_ERROR',
          data,
        );
      }

      return data;
    } catch (error) {
      console.error(`Error renaming identity ${identity}:`, error);
      if (error instanceof ApiError) throw error;
      throw new ApiError('Failed to rename identity', 500, 'RENAME_IDENTITY_ERROR', {
        originalError: error instanceof Error ? error.message : String(error),
      });
    }
  },
};