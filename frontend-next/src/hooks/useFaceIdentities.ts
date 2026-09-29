import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { faceIdentityService, type FaceIdentitiesResponse } from '@/services/api/faceIdentityService';

export function useFaceIdentities() {
  return useQuery<FaceIdentitiesResponse>({
    queryKey: ['faceIdentities'],
    queryFn: () => faceIdentityService.getFaceIdentities(),
    staleTime: 30_000,
  });
}

export function useRenameIdentity() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ identity, name }: { identity: string; name: string }) =>
      faceIdentityService.renameIdentity(identity, name),
    onSuccess: (response) => {
      if (response.success) {
        void queryClient.invalidateQueries({ queryKey: ['faceIdentities'] });
      }
    },
  });
}