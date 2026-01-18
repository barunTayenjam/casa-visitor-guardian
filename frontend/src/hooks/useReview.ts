import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import reviewApi from '../services/ReviewApi';

export function useReviewSegments(query: Parameters<typeof reviewApi.getReviewSegments>[0] = {}) {
  return useQuery({
    queryKey: ['review-segments', query],
    queryFn: () => reviewApi.getReviewSegments(query),
    refetchInterval: 5000,
  });
}

export function useReviewSegment(id: string) {
  return useQuery({
    queryKey: ['review-segment', id],
    queryFn: () => reviewApi.getReviewSegment(id),
    enabled: !!id,
  });
}

export function useAcknowledgeSegment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (segmentId: string) => reviewApi.acknowledgeSegment(segmentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['review-segments'] });
    },
  });
}

export function useGenerateReviewSegments() {
  return useMutation({
    mutationFn: (camera: string) => reviewApi.generateReviewSegments(camera),
  });
}

export function useTimeline(query: Parameters<typeof reviewApi.getTimeline>[0] = {}) {
  return useQuery({
    queryKey: ['timeline', query],
    queryFn: () => reviewApi.getTimeline(query),
    refetchInterval: 5000,
  });
}

export function useActiveObjects(camera: string) {
  return useQuery({
    queryKey: ['active-objects', camera],
    queryFn: () => reviewApi.getActiveObjects(camera),
    refetchInterval: 1000,
    enabled: !!camera,
  });
}

export function useAdaptiveRegions(camera: string) {
  return useQuery({
    queryKey: ['adaptive-regions', camera],
    queryFn: () => reviewApi.getAdaptiveRegions(camera),
    enabled: !!camera,
  });
}

export function useClearAdaptiveRegions() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (camera: string) => reviewApi.clearAdaptiveRegions(camera),
    onSuccess: (_, camera) => {
      queryClient.invalidateQueries({ queryKey: ['adaptive-regions', camera] });
    },
  });
}

export function useDetectionConfig(camera?: string) {
  return useQuery({
    queryKey: ['detection-config', camera],
    queryFn: () => reviewApi.getDetectionConfig(camera),
  });
}

export function useUpdateDetectionConfig() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ config, camera }: { config: Parameters<typeof reviewApi.updateDetectionConfig>[0]; camera?: string }) =>
      reviewApi.updateDetectionConfig(config, camera),
    onSuccess: (_, { camera }) => {
      queryClient.invalidateQueries({ queryKey: ['detection-config', camera] });
      queryClient.invalidateQueries({ queryKey: ['detection-config'] });
    },
  });
}
