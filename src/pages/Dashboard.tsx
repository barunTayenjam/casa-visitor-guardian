import { CameraGrid } from '@/components/dashboard/CameraGrid';
import { MediaViewer } from '@/components/dashboard/MediaViewer';
import { useState } from 'react';
import { MotionEvent } from '@/types/security';

const Dashboard = () => {
  const [selectedEvent, setSelectedEvent] = useState<MotionEvent | null>(null);

  return (
    <div className="w-full h-full relative flex flex-col">
      {/* Main content area - Camera Grid */}
      <div className="flex-1 p-4 overflow-auto">
        <CameraGrid />
      </div>

      {/* Media Viewer (Historical Events) in the footer */}
      <MediaViewer
        selectedEvent={selectedEvent}
        onClose={() => setSelectedEvent(null)}
        onSelectEvent={setSelectedEvent}
      />
    </div>
  );
};

export default Dashboard;
