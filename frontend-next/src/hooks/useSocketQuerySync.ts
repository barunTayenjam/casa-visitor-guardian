'use client';

import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import socketService from '@/services/SocketService';

export function useSocketQuerySync() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const invalidateEvents = () => {
      void queryClient.invalidateQueries({ queryKey: ['events'] });
      void queryClient.invalidateQueries({ queryKey: ['motionEvents'] });
    };
    const unsubscribers = [
      socketService.on('eventCreated', invalidateEvents),
      socketService.on('motionDetected', invalidateEvents),
      socketService.on('personDetected', invalidateEvents),
    ];
    return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
  }, [queryClient]);
}
