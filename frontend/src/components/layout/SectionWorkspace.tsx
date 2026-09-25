import { useCallback, useEffect, useState, type ComponentType, type ReactNode } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

export interface SectionTab {
  value: string;
  label: string;
  icon?: ComponentType<{ className?: string }>;
}

interface SectionWorkspaceProps {
  title: string;
  description: string;
  tabs: SectionTab[];
  defaultTab: string;
  children: (activeTab: string) => ReactNode;
  onTabChange?: (value: string) => void;
}

export function SectionWorkspace({
  title,
  description,
  tabs,
  defaultTab,
  children,
  onTabChange,
}: SectionWorkspaceProps) {
  const [activeTab, setActiveTab] = useState(defaultTab);

  useEffect(() => {
    setActiveTab(defaultTab);
  }, [defaultTab]);

  const handleTabChange = useCallback(
    (value: string) => {
      setActiveTab(value);
      onTabChange?.(value);
    },
    [onTabChange],
  );

  return (
    <Tabs
      value={activeTab}
      onValueChange={handleTabChange}
      className="flex h-full min-h-0 flex-col bg-background"
    >
      <header className="shrink-0 border-b border-white/[0.06] bg-[#0A0A0B] px-4 py-4 sm:px-6">
        <div className="mx-auto flex max-w-7xl flex-col gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-[-0.03em] text-[#ECECEC]">{title}</h1>
            <p className="mt-1 text-sm text-[#A1A1A8]">{description}</p>
          </div>
          <TabsList className="h-9 w-full justify-start gap-1 rounded-[4px] border-white/[0.06] bg-[#121215] p-1 backdrop-blur-none sm:w-fit">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <TabsTrigger
                  key={tab.value}
                  value={tab.value}
                  className={cn(
                    'h-7 rounded-[3px] px-3 text-xs text-[#6B6B73] transition-colors data-[state=active]:bg-[#1A1A1D] data-[state=active]:text-[#ECECEC] data-[state=active]:shadow-none',
                    'focus-visible:ring-1 focus-visible:ring-[#5E6AD2]',
                  )}
                >
                  {Icon ? <Icon className="mr-1.5 h-3.5 w-3.5" /> : null}
                  {tab.label}
                </TabsTrigger>
              );
            })}
          </TabsList>
        </div>
      </header>
      {tabs.map((tab) => (
        <TabsContent
          key={tab.value}
          value={tab.value}
          className="mt-0 min-h-0 flex-1 overflow-hidden focus-visible:ring-0"
        >
          {children(tab.value)}
        </TabsContent>
      ))}
    </Tabs>
  );
}
