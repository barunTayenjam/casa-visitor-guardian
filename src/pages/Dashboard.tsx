import { CameraGrid } from '@/components/dashboard/CameraGrid';
import { TabletCameraGrid } from '@/components/dashboard/TabletCameraGrid';
import { SimpleTest } from '@/components/debug/SimpleTest';
import { RecentEvents } from '@/components/dashboard/RecentEvents';
import { SystemOverview } from '@/components/dashboard/SystemOverview';
import { useState } from 'react';
import { MotionEvent } from '@/types/security';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Maximize2, Grid3X3, LayoutGrid } from 'lucide-react';
import { useSocketContext } from '@/contexts/SocketContext';
import { useCameras } from '@/contexts/CameraContext';

const Dashboard = () => {
  const [selectedEvent, setSelectedEvent] = useState<MotionEvent | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'single' | 'overview'>('grid');
  const { connected, connectionStatus } = useSocketContext();
  const { cameras } = useCameras();

  const activeCameras = cameras.filter(c => c.status === 'online');

  return (
    <div className="h-full">
      <TabletCameraGrid />
    </div>
  );
};

export default Dashboard;
