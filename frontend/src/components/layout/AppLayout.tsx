import React from 'react';
import { MacDock } from './MacDock';

interface AppLayoutProps {
  children: React.ReactNode;
}

export const AppLayout: React.FC<AppLayoutProps> = ({ children }) => {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Page Content */}
      <main className="flex-1 pb-20">
        {children}
      </main>

      {/* macOS-style Dock Navigation */}
      <MacDock />
    </div>
  );
};
