import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { eventService } from '@/services/api/eventService';
import { MotionEvent } from '@/types/security';

export function useEvents(limit?: number) {
  return useQuery({
    queryKey: ['events', limit],
    queryFn: () => eventService.getEnhancedEventsList({ limit }),
    staleTime: 10_000,
  });
}

export interface EventsListParams {
  page?: number;
  pageSize?: number;
  camera_id?: string;
  event_type?: string;
  min_confidence?: number;
  start_date?: string;
  end_date?: string;
  sortBy?: string;
}

export interface EventsListResult {
  events: MotionEvent[];
  totalPages: number;
}

export function useEventsList(params: EventsListParams) {
  return useQuery<EventsListResult>({
    queryKey: ['events', 'list', params],
    queryFn: async () => {
      const response = await eventService.getEnhancedEventsList(params);
      const events: MotionEvent[] = response.events.map((event) => ({
        id: event.id,
        cameraId: event.cameraId,
        cameraName: event.cameraName || `Camera ${event.cameraId}`,
        timestamp: new Date(event.timestamp),
        imageUrl: event.imageUrl || null,
        confidence: event.confidence,
        labels: event.labels || [event.event_type || 'motion'],
        location: event.cameraName || '',
        duration: 0,
        archived: false,
        metadata: event.metadata,
        detections: (event.object_detections || []).map((d) => ({
          type: (d.class === 'person' || d.class === 'face' ? d.class : 'object') as
            | 'person'
            | 'face'
            | 'object',
          confidence:
            typeof d.confidence === 'number' && d.confidence > 1 ? d.confidence / 100 : d.confidence,
          name: d.identity ?? undefined,
          isKnown: !!d.identity && d.identity !== 'unknown',
          boundingBox: {
            x: d.bbox?.x ?? 0,
            y: d.bbox?.y ?? 0,
            width: d.bbox?.width ?? 0,
            height: d.bbox?.height ?? 0,
          },
        })),
        personCount: event.persons_detected,
        faceCount: event.faces_detected,
        knownFaces: event.known_faces_count,
        unknownFaces: event.unknown_faces_count,
        severity: event.severity,
      }));
      return { events, totalPages: response.pagination?.totalPages ?? 1 };
    },
    staleTime: 10_000,
    placeholderData: keepPreviousData,
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
