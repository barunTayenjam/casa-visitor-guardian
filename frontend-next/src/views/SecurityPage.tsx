'use client';

import { useCallback } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useUrlSearchParams } from '@/hooks/useUrlSearchParams';
import { Activity, Users } from 'lucide-react';
import { SectionWorkspace } from '@/components/layout/SectionWorkspace';
import PeoplePage from '@/views/PeoplePage';
import EventsPage from '@/views/EventsPage';

const tabs = [
  { value: 'people', label: 'People', icon: Users },
  { value: 'logs', label: 'Detection history', icon: Activity },
];

export default function SecurityPage() {
  const searchParams = useUrlSearchParams();
  const router = useRouter();
  const pathname = usePathname() ?? '/';
  const defaultTab = searchParams.get('view') === 'logs' ? 'logs' : 'people';

  const handleTabChange = useCallback(
    (value: string) => {
      const next = new URLSearchParams(searchParams);
      if (value === 'logs') next.set('view', 'logs');
      else next.delete('view');
      router.replace(`${pathname}?${next.toString()}`, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  return (
    <SectionWorkspace
      title="Security"
      description="Recognized people, visitor activity, and the detection history behind each decision."
      tabs={tabs}
      defaultTab={defaultTab}
      onTabChange={handleTabChange}
    >
      {(tab) => (tab === 'logs' ? <EventsPage embedded /> : <PeoplePage />)}
    </SectionWorkspace>
  );
}
