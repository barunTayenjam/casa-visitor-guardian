'use client';

import { useCallback } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useUrlSearchParams } from '@/hooks/useUrlSearchParams';
import { BarChart3, Film } from 'lucide-react';
import { SectionWorkspace } from '@/components/layout/SectionWorkspace';
import InsightsPage from '@/views/InsightsPage';
import TimelapsePage from '@/views/TimelapsePage';

const tabs = [
  { value: 'overview', label: 'Overview', icon: BarChart3 },
  { value: 'timelapse', label: 'Timelapse', icon: Film },
];

export default function AnalyticsPage() {
  const searchParams = useUrlSearchParams();
  const router = useRouter();
  const pathname = usePathname() ?? '/';
  const defaultTab = searchParams.get('view') === 'timelapse' ? 'timelapse' : 'overview';

  const handleTabChange = useCallback(
    (value: string) => {
      const next = new URLSearchParams(searchParams);
      if (value === 'timelapse') next.set('view', 'timelapse');
      else next.delete('view');
      router.replace(`${pathname}?${next.toString()}`, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  return (
    <SectionWorkspace
      title="Analytics"
      description="Daily activity, threat patterns, and time-lapse review across your cameras."
      tabs={tabs}
      defaultTab={defaultTab}
      onTabChange={handleTabChange}
    >
      {(tab) => (tab === 'timelapse' ? <TimelapsePage /> : <InsightsPage />)}
    </SectionWorkspace>
  );
}
