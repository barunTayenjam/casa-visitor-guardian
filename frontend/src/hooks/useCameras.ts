import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { cameraService } from '@/services/api/cameraService';
import { Camera } from '@/types/security';

export function useCameras() {
  return useQuery({
    queryKey: ['cameras'],
    queryFn: () => cameraService.getCameras(),
    staleTime: 30_000,
  });
}

export function useUpdateCamera() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<Camera> }) =>
      cameraService.updateCamera(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cameras'] });
    },
  });
}
