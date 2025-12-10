import React, { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { SidebarProvider, useSidebar } from '@/components/ui/sidebar';
import { SecuritySidebar } from './SecuritySidebar';
import { SecurityHeader } from './SecurityHeader';
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
    <div className="min-h-screen flex w-full bg-background overflow-x-hidden max-w-full">
      <SecuritySidebar />
      <div className="flex-1 flex flex-col">
        <SecurityHeader 
          onToggleSidebar={handleToggleSidebar}
          onToggleAlerts={() => setShowAlerts(prev => !prev)}
        />
        <main className="flex-1 p-2 overflow-hidden overflow-x-hidden">
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

export const SecurityLayout = ({ children }: { children?: React.ReactNode }) => {
  return (
    <SidebarProvider>
      <SecurityContent />
    </SidebarProvider>
  );
};
