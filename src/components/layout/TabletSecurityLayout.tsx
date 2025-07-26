import { TabletLayout } from './TabletLayout';
import { BottomTabBar } from './BottomTabBar';
import { Outlet } from 'react-router-dom';

export const TabletSecurityLayout = () => {
  return (
    <div className="h-screen flex flex-col">
      <div className="flex-1 flex flex-col">
        <TabletLayout>
          <Outlet />
        </TabletLayout>
      </div>
      <BottomTabBar />
    </div>
  );
};