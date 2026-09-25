import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { personService, type FaceCluster } from '@/services/api/personService';

interface FaceClustersResponse {
  success: boolean;
  clusters?: FaceCluster[];
  error?: string;
}

export function useFaceClusters() {
  return useQuery<FaceClustersResponse>({
    queryKey: ['faceClusters'],
    queryFn: () => personService.getFaceClusters(),
    staleTime: 60_000,
  });
}

export function useAssignClusterName() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ clusterId, name }: { clusterId: string; name: string }) =>
      personService.assignClusterName(clusterId, name),
    onSuccess: (response) => {
      if (response.success) {
        void queryClient.invalidateQueries({ queryKey: ['faceClusters'] });
      }
    },
  });
}
