import { Suspense } from 'react';
import type { Metadata } from 'next';
import SettingsHub from '@/views/SettingsHub';
import RouteLoading from '@/components/layout/LoadingRoute';

export const metadata: Metadata = { title: 'Settings' };

export default function SettingsRoute() {
  return <Suspense fallback={<RouteLoading />}><SettingsHub /></Suspense>;
}
