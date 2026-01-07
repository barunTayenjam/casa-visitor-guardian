import { useMutation, useQueryClient, QueryClient } from '@tanstack/react-query';
import { apiService } from './ApiService';
import { MotionEvent } from '@/types/security';
import { useToast } from '@/hooks/use-toast';

export function useArchiveEvent() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (eventId: string) => {
      await apiService.archiveEvent(eventId);
    },
    onMutate: async (eventId) => {
      await queryClient.cancelQueries({ queryKey: ['events'] });

      const previousEvents = queryClient.getQueryData(['events']);

      queryClient.setQueryData(['events'], (old: any) => {
        if (!old) return old;
        if (Array.isArray(old)) {
          return old.filter((e: MotionEvent) => e.id !== eventId);
        }
        if (old.events && Array.isArray(old.events)) {
          return {
            ...old,
            events: old.events.filter((e: MotionEvent) => e.id !== eventId)
          };
        }
        return old;
      });

      return { previousEvents, eventId };
    },
    onError: (err, eventId, context) => {
      queryClient.setQueryData(['events'], (context as any)?.previousEvents);
      toast({
        title: 'Error',
        description: 'Failed to archive event',
        variant: 'destructive'
      });
    },
    onSuccess: (data, eventId) => {
      toast({
        title: 'Success',
        description: 'Event archived successfully'
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
    }
  });
}

export function useBatchArchiveEvents() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (eventIds: string[]) => {
      await Promise.all(eventIds.map(id => apiService.archiveEvent(id)));
    },
    onMutate: async (eventIds) => {
      await queryClient.cancelQueries({ queryKey: ['events'] });

      const previousEvents = queryClient.getQueryData(['events']);

      queryClient.setQueryData(['events'], (old: any) => {
        if (!old) return old;
        const idsSet = new Set(eventIds);
        if (Array.isArray(old)) {
          return old.filter((e: MotionEvent) => !idsSet.has(e.id));
        }
        if (old.events && Array.isArray(old.events)) {
          return {
            ...old,
            events: old.events.filter((e: MotionEvent) => !idsSet.has(e.id))
          };
        }
        return old;
      });

      return { previousEvents, eventIds };
    },
    onError: (err, eventIds, context) => {
      queryClient.setQueryData(['events'], (context as any)?.previousEvents);
      toast({
        title: 'Error',
        description: `Failed to archive ${eventIds.length} events`,
        variant: 'destructive'
      });
    },
    onSuccess: (data, eventIds) => {
      toast({
        title: 'Success',
        description: `${eventIds.length} events archived successfully`
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
    }
  });
}
