import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { eventService } from '@/services/api/eventService';

export function useEvents(limit?: number) {
  return useQuery({
    queryKey: ['events', limit],
    queryFn: () => eventService.getEnhancedEventsList({ limit }),
    staleTime: 10_000,
  });
}

export function useMotionEvents(limit?: number) {
  return useQuery({
    queryKey: ['motionEvents', limit],
    queryFn: () => eventService.getMotionEvents(limit),
    staleTime: 10_000,
  });
}

export function useCalendarStats(year: number, month: number, cameraId?: string) {
  return useQuery({
    queryKey: ['calendarStats', year, month, cameraId],
    queryFn: () => eventService.getCalendarStats(year, month, cameraId),
    staleTime: 60_000,
    enabled: !!year && !!month,
  });
}

export function useArchiveEvent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => eventService.archiveEvent(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      queryClient.invalidateQueries({ queryKey: ['motionEvents'] });
    },
  });
}
