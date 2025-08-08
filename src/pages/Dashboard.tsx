
import { SystemOverview } from '@/components/dashboard/SystemOverview';
import { CameraGrid } from '@/components/dashboard/CameraGrid';
import { RecentEvents } from '@/components/dashboard/RecentEvents';
import { AnalyticsChart } from '@/components/dashboard/AnalyticsChart';

const Dashboard = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Security Dashboard</h1>
        <p className="text-muted-foreground mt-2">
          Monitor your home security system and recent activity
        </p>
      </div>
      
      <SystemOverview />
      
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <CameraGrid />
        </div>
        <div className="md:col-span-1 lg:col-span-1">
          <RecentEvents />
        </div>
      </div>
      
      <AnalyticsChart />
    </div>
  );
};

export default Dashboard;
