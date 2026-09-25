import { Suspense } from 'react';
import type { Metadata } from 'next';
import EventsPage from '@/views/EventsPage';
import RouteLoading from '@/components/layout/LoadingRoute';

export const metadata: Metadata = { title: 'Events' };

export default function EventsRoute() {
  return <Suspense fallback={<RouteLoading />}><EventsPage /></Suspense>;
}
