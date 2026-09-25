import { Suspense } from 'react';
import type { Metadata } from 'next';
import AnalyticsPage from '@/views/AnalyticsPage';
import RouteLoading from '@/components/layout/LoadingRoute';

export const metadata: Metadata = { title: 'Analytics' };

export default function AnalyticsRoute() {
  return <Suspense fallback={<RouteLoading />}><AnalyticsPage /></Suspense>;
}
