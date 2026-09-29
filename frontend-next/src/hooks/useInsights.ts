import { useQuery } from '@tanstack/react-query';
import { fetchDailyInsights, DailyInsights } from '@/services/api/insightsService';
import { analyticsService } from '@/services/api/analyticsService';
import { highlightsService, type SummaryResponse } from '@/services/api/highlightsService';

export function useInsights(date: string) {
  return useQuery<DailyInsights>({
    queryKey: ['insights', date],
    queryFn: () => fetchDailyInsights(date),
    staleTime: 60_000,
    enabled: !!date,
  });
}

export function useHourlyAnalytics(startDate?: string, endDate?: string) {
  return useQuery({
    queryKey: ['analytics', 'hourly', startDate, endDate],
    queryFn: () => analyticsService.getHourly(startDate, endDate),
    staleTime: 60_000,
  });
}

export function useWeeklyAnalytics() {
  return useQuery({
    queryKey: ['analytics', 'weekly'],
    queryFn: () => analyticsService.getWeekly(),
    staleTime: 60_000,
  });
}

export function useMonthlyAnalytics() {
  return useQuery({
    queryKey: ['analytics', 'monthly'],
    queryFn: () => analyticsService.getMonthly(),
    staleTime: 60_000,
  });
}

export function useHighlightsSummary(date: string) {
  return useQuery<SummaryResponse>({
    queryKey: ['highlights', 'summary', date],
    queryFn: () => highlightsService.getSummary(date),
    staleTime: 60_000,
    enabled: !!date,
  });
}
