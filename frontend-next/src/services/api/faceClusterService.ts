// Face-cluster-related API methods
import { fetchWithRetry, ApiError, API_URL } from './baseClient';

// ==================== TYPES ====================

export interface FaceCluster {
  cluster_id: string;
  name: string | null;
  face_count: number;
  description: string | null;
  representative_image: string | null;
}

export interface FaceClustersResponse {
  success: boolean;
  clusters?: FaceCluster[];
  error?: string;
  message?: string;
}

export interface ClusteringStatus {
  isRunning: boolean;
  imagesScanned: number;
  totalImages: number;
  facesFound: number;
  clustersCreated: number;
  multiFaceClusters: number;
  lastUpdate: string;
  progressPercent: number;
  estimatedRemainingMinutes: number;
}

export interface ClusteringStatusResponse {
  success: boolean;
  status?: ClusteringStatus;
  error?: string;
}

// ==================== FACE CLUSTER SERVICE ====================

export const faceClusterService = {
  async getFaceClusters(): Promise<FaceClustersResponse> {
    try {
      const response = await fetchWithRetry(`${API_URL}/face-clusters`);
      const data = await response.json();

      if (!data.success) {
        throw new ApiError(
          data.error || 'Failed to fetch face clusters',
          response.status,
          'GET_FACE_CLUSTERS_ERROR',
          data,
        );
      }

      return data;
    } catch (error) {
      console.error('Error fetching face clusters:', error);
      if (error instanceof ApiError) throw error;
      throw new ApiError('Failed to fetch face clusters', 500, 'GET_FACE_CLUSTERS_ERROR', {
        originalError: error instanceof Error ? error.message : String(error),
      });
    }
  },

  getClusterImageUrl(clusterId: string): string {
    return `${API_URL}/face-clusters/image/${clusterId}`;
  },

  async assignClusterName(clusterId: string, name: string): Promise<FaceClustersResponse> {
    try {
      const response = await fetchWithRetry(`${API_URL}/face-clusters/${clusterId}/name`, {
        method: 'POST',
        body: JSON.stringify({ name }),
      });
      const data = await response.json();

      if (!data.success) {
        throw new ApiError(
          data.error || 'Failed to assign name',
          response.status,
          'ASSIGN_CLUSTER_NAME_ERROR',
          data,
        );
      }

      return data;
    } catch (error) {
      console.error(`Error assigning name to cluster ${clusterId}:`, error);
      if (error instanceof ApiError) throw error;
      throw new ApiError('Failed to assign name', 500, 'ASSIGN_CLUSTER_NAME_ERROR', {
        originalError: error instanceof Error ? error.message : String(error),
      });
    }
  },

  async getClusteringStatus(): Promise<ClusteringStatusResponse> {
    try {
      const response = await fetchWithRetry(`${API_URL}/face-clusters/clustering-status`);
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error fetching clustering status:', error);
      return { success: false, error: 'Failed to fetch status' };
    }
  },
};
