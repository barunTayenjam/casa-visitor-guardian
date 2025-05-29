import { Outlet } from 'react-router-dom';
import { SidebarProvider, useSidebar } from '@/components/ui/sidebar';
import { SecuritySidebar } from './SecuritySidebar';
import { SecurityHeader } from './SecurityHeader';
import { useState, useEffect } from 'react';
import { AlertsPanel } from './AlertsPanel';

const SecurityContent = () => {
  const { setOpen, toggleSidebar } = useSidebar();
  const [showAlerts, setShowAlerts] = useState(false);
  
  // Collapse sidebar on mount
  useEffect(() => {
    setOpen(false);
  }, [setOpen]);

  const handleToggleSidebar = () => {
    toggleSidebar();
  };

  return (
    <div className="min-h-screen flex w-full bg-background">
      <SecuritySidebar />
      <div className="flex-1 flex flex-col">
        <SecurityHeader 
          onToggleSidebar={handleToggleSidebar}
          onToggleAlerts={() => setShowAlerts(prev => !prev)}
        />
        <main className="flex-1 p-2 overflow-hidden">
          <Outlet />
        </main>
        <AlertsPanel 
          isOpen={showAlerts} 
          onClose={() => setShowAlerts(false)} 
        />
      </div>
    </div>
  );
};

export const SecurityLayout = () => {
  return (
    <SidebarProvider>
      <SecurityContent />
    </SidebarProvider>
  );
};
