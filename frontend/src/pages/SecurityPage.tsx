import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Activity, Users } from 'lucide-react';
import { SectionWorkspace } from '@/components/layout/SectionWorkspace';
import PeoplePage from '@/pages/PeoplePage';
import EventsPage from '@/pages/EventsPage';

const tabs = [
  { value: 'people', label: 'People', icon: Users },
  { value: 'logs', label: 'Detection history', icon: Activity },
];

export default function SecurityPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const defaultTab = searchParams.get('view') === 'logs' ? 'logs' : 'people';

  const handleTabChange = useCallback(
    (value: string) => {
      const next = new URLSearchParams(searchParams);
      if (value === 'logs') next.set('view', 'logs');
      else next.delete('view');
      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams],
  );

  return (
    <SectionWorkspace
      title="Security"
      description="Recognized people, visitor activity, and the detection history behind each decision."
      tabs={tabs}
      defaultTab={defaultTab}
      onTabChange={handleTabChange}
    >
      {(tab) => (tab === 'logs' ? <EventsPage /> : <PeoplePage />)}
    </SectionWorkspace>
  );
}
