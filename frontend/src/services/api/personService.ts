import { apiGet, apiPost } from './baseClient';

export interface FaceCluster {
  cluster_id: string;
  name: string | null;
  face_count: number;
  event_ids: string[];
  first_seen: string;
  last_seen: string;
  representative_image: string;
}

interface FaceClustersResponse {
  success: boolean;
  clusters?: FaceCluster[];
  error?: string;
  message?: string;
}

class PersonService {
  async getFaceClusters(): Promise<FaceClustersResponse> {
    try {
      return await apiGet<FaceClustersResponse>('/face-clusters');
    } catch (error) {
      return { success: false, clusters: [], error: 'Failed to fetch face clusters' };
    }
  }

  async assignClusterName(clusterId: string, name: string): Promise<FaceClustersResponse> {
    try {
      return await apiPost<FaceClustersResponse>(`/face-clusters/${clusterId}/name`, { name });
    } catch (error) {
      return { success: false, error: 'Failed to assign name' };
    }
  }
}

export const personService = new PersonService();
