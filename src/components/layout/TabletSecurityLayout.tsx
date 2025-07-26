import { TabletLayout } from './TabletLayout';
import { BottomTabBar } from './BottomTabBar';

export const TabletSecurityLayout = () => {
  return (
    <div className="h-screen flex flex-col">
      <TabletLayout />
      <BottomTabBar />
    </div>
  );
};