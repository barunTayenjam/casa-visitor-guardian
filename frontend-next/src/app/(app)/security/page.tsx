import { Suspense } from 'react';
import type { Metadata } from 'next';
import SecurityPage from '@/views/SecurityPage';
import RouteLoading from '@/components/layout/LoadingRoute';

export const metadata: Metadata = { title: 'Security' };

export default function SecurityRoute() {
  return <Suspense fallback={<RouteLoading />}><SecurityPage /></Suspense>;
}
