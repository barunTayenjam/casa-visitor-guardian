import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { faceClusterService, type FaceClustersResponse, type ClusteringStatusResponse } from '@/services/api/faceClusterService';

export function useFaceClusters() {
  return useQuery<FaceClustersResponse>({
    queryKey: ['faceClusters'],
    queryFn: () => faceClusterService.getFaceClusters(),
    staleTime: 60_000,
  });
}

export function useClusteringStatus(pollWhenRunning = true) {
  return useQuery<ClusteringStatusResponse>({
    queryKey: ['clusteringStatus'],
    queryFn: () => faceClusterService.getClusteringStatus(),
    refetchInterval: (query) => {
      const data = query.state.data;
      return pollWhenRunning && data?.status?.isRunning ? 5_000 : 30_000;
    },
    staleTime: 4_000,
  });
}

export function useAssignClusterName() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ clusterId, name }: { clusterId: string; name: string }) =>
      faceClusterService.assignClusterName(clusterId, name),
    onSuccess: (response) => {
      if (response.success) {
        void queryClient.invalidateQueries({ queryKey: ['faceClusters'] });
      }
    },
  });
}
