import React from 'react';
import { CameraGrid } from '@/components/dashboard/CameraGrid';

const StreamDashboard = () => {
  return (
    <div className="relative w-full h-screen bg-black overflow-hidden">
      {/* Main Stream View */}
      <div className="absolute inset-0">
        <CameraGrid compact={false} />
      </div>

      {/* Simple overlay */}
      <div className="absolute top-4 left-4 bg-black/50 text-white px-3 py-2 rounded">
        Live Camera Feeds
      </div>
    </div>
  );
};

export default StreamDashboard;