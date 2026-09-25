import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { BarChart3, Film } from 'lucide-react';
import { SectionWorkspace } from '@/components/layout/SectionWorkspace';
import InsightsPage from '@/pages/InsightsPage';
import TimelapsePage from '@/pages/TimelapsePage';

const tabs = [
  { value: 'overview', label: 'Overview', icon: BarChart3 },
  { value: 'timelapse', label: 'Timelapse', icon: Film },
];

export default function AnalyticsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const defaultTab = searchParams.get('view') === 'timelapse' ? 'timelapse' : 'overview';

  const handleTabChange = useCallback(
    (value: string) => {
      const next = new URLSearchParams(searchParams);
      if (value === 'timelapse') next.set('view', 'timelapse');
      else next.delete('view');
      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams],
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
