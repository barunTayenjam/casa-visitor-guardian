import { TabletLayout } from './TabletLayout';
import { BottomTabBar } from './BottomTabBar';

export const TabletSecurityLayout = () => {
  return (
    <div className="h-screen flex flex-col">
      <div className="flex-1 flex flex-col">
        <TabletLayout />
      </div>
      <BottomTabBar />
    </div>
  );
};