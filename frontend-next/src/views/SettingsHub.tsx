'use client';

import { useCallback } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useUrlSearchParams } from '@/hooks/useUrlSearchParams';
import { FileText, SlidersHorizontal } from 'lucide-react';
import { SectionWorkspace } from '@/components/layout/SectionWorkspace';
import SettingsPage from '@/views/Settings';
import LogsPage from '@/views/LogsPage';

const tabs = [
  { value: 'configuration', label: 'Configuration', icon: SlidersHorizontal },
  { value: 'logs', label: 'System logs', icon: FileText },
];

export default function SettingsHub() {
  const searchParams = useUrlSearchParams();
  const router = useRouter();
  const pathname = usePathname() ?? '/';
  const defaultTab = searchParams.get('view') === 'logs' ? 'logs' : 'configuration';

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
