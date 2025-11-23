import React from 'react';
import { Outlet } from 'react-router-dom';
import { SecuritySidebar } from './SecuritySidebar';

const SecurityLayoutMinimal = () => {
  return (
    <div className="min-h-screen flex w-full bg-background overflow-x-hidden max-w-full">
      <SecuritySidebar />
      <div className="flex-1 flex flex-col">
        <main className="flex-1 p-2 overflow-hidden overflow-x-hidden">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default SecurityLayoutMinimal;