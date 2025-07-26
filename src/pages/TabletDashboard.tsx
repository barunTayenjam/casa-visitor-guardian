import { TabletCameraGrid } from '@/components/dashboard/TabletCameraGrid';
import { useState } from 'react';
import { Camera } from '@/types/security';

const TabletDashboard = () => {
  const [selectedCamera, setSelectedCamera] = useState<Camera | null>(null);

  return (
    <div className="h-full flex flex-col">
      <TabletCameraGrid onCameraSelect={setSelectedCamera} />
    </div>
  );
};

export default TabletDashboard;