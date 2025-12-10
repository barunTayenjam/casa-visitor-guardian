import React from 'react';
import LogViewer from '@/components/LogDatabaseViewer';

export function SystemLogs() {
  return (
    <div className="min-h-screen bg-background">
      <LogViewer />
    </div>
  );
}

export default SystemLogs;