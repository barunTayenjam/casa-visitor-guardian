import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { FileText, SlidersHorizontal } from 'lucide-react';
import { SectionWorkspace } from '@/components/layout/SectionWorkspace';
import SettingsPage from '@/pages/Settings';
import LogsPage from '@/pages/LogsPage';

const tabs = [
  { value: 'configuration', label: 'Configuration', icon: SlidersHorizontal },
  { value: 'logs', label: 'System logs', icon: FileText },
];

export default function SettingsHub() {
  const [searchParams, setSearchParams] = useSearchParams();
  const defaultTab = searchParams.get('view') === 'logs' ? 'logs' : 'configuration';

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
      title="Settings"
      description="Configure detection, notifications, storage, and system access."
      tabs={tabs}
      defaultTab={defaultTab}
      onTabChange={handleTabChange}
    >
      {(tab) => (tab === 'logs' ? <LogsPage /> : <SettingsPage />)}
    </SectionWorkspace>
  );
}
