'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import RouteLoading from '@/components/layout/LoadingRoute';

export function LegacyRedirect({ destination }: { destination: string }) {
  const router = useRouter();
  useEffect(() => {
    const query = window.location.search;
    const separator = destination.includes('?') ? '&' : '?';
    router.replace(query ? `${destination}${separator}${query.slice(1)}` : destination);
  }, [destination, router]);
  return <RouteLoading />;
}
