import { CameraGrid } from '@/components/dashboard/CameraGrid';
import { MediaViewer } from '@/components/dashboard/MediaViewer';

const Dashboard = () => {
  return (
    <div className="w-full h-full relative">
      <CameraGrid />
      <MediaViewer />
    </div>
  );
};

export default Dashboard;
