import { TabletEventViewer } from '@/components/dashboard/TabletEventViewer';
import { useState } from 'react';
import { MotionEvent } from '@/types/security';

const TabletEvents = () => {
  const [selectedEvent, setSelectedEvent] = useState<MotionEvent | null>(null);

  return (
    <div className="h-full">
      <TabletEventViewer onEventSelect={setSelectedEvent} />
    </div>
  );
};

export default TabletEvents;