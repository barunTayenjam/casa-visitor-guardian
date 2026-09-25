import { useQuery } from '@tanstack/react-query';
import { fetchDailyInsights, DailyInsights } from '@/services/api/insightsService';

export function useInsights(date: string) {
  return useQuery<DailyInsights>({
    queryKey: ['insights', date],
    queryFn: () => fetchDailyInsights(date),
    staleTime: 60_000,
    enabled: !!date,
  });
}
