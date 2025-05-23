
import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { SidebarProvider } from '@/components/ui/sidebar';
import { SecuritySidebar } from './SecuritySidebar';
import { SecurityHeader } from './SecurityHeader';
import { AlertsPanel } from './AlertsPanel';

export const SecurityLayout = () => {
  const [alertsPanelOpen, setAlertsPanelOpen] = useState(false);

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <SecuritySidebar />
        <div className="flex-1 flex flex-col">
          <SecurityHeader 
            onToggleAlerts={() => setAlertsPanelOpen(!alertsPanelOpen)} 
          />
          <main className="flex-1 p-6 overflow-auto">
            <Outlet />
          </main>
        </div>
        <AlertsPanel 
          isOpen={alertsPanelOpen} 
          onClose={() => setAlertsPanelOpen(false)} 
        />
      </div>
    </SidebarProvider>
  );
};
