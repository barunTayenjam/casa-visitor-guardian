import React from 'react';
import { MacDock } from './MacDock';

interface AppLayoutProps {
  children: React.ReactNode;
}

export const AppLayout: React.FC<AppLayoutProps> = ({ children }) => {
  return (
    <div className="flex min-h-[100dvh] flex-col">
      <main className="flex-1 pb-28 min-h-0">
        {children}
      </main>
      <MacDock />
    </div>
  );
};
