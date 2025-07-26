import { Outlet } from 'react-router-dom';
import { Camera, Settings, Wifi, WifiOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useSocketContext } from '@/contexts/SocketContext';
import { useCameras } from '@/contexts/CameraContext';
import { useNavigate } from 'react-router-dom';
import { TabletDebug } from '../debug/TabletDebug';
// import { useDebug } from '@/contexts/DebugContext';

interface TabletLayoutProps {
  children?: React.ReactNode;
}

export const TabletLayout = ({ children }: TabletLayoutProps) => {
  const { connected, connectionStatus } = useSocketContext();
  const { cameras } = useCameras();
  const navigate = useNavigate();
  // const { debugEnabled } = useDebug();
  const debugEnabled = false;
  
  const activeCameras = cameras.filter(c => c.status === 'online').length;
  const totalCameras = cameras.length;

  return (
    <div className="flex flex-col bg-background h-full">
      {/* Minimal Header */}
      <header className="flex items-center justify-between p-4 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3">
            <Camera className="h-8 w-8 text-primary" />
            <h1 className="text-2xl font-bold">Casa Security</h1>
          </div>
          
          {/* Connection Status */}
          <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-muted">
            {connected ? (
              <Wifi className="h-4 w-4 text-green-500" />
            ) : (
              <WifiOff className="h-4 w-4 text-red-500" />
            )}
            <span className="text-sm font-medium">
              {connected ? 'Live' : connectionStatus}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* Camera Status */}
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="font-medium">{activeCameras}/{totalCameras}</span>
            <span>cameras online</span>
          </div>

          {/* Quick Actions */}
          <Button
            variant="outline"
            size="lg"
            onClick={() => {
              console.log('Settings button clicked, navigating to /settings');
              window.location.href = '/settings';
            }}
            className="h-12 px-6"
          >
            <Settings className="h-5 w-5 mr-2" />
            Settings
          </Button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 overflow-hidden">
        {children || <Outlet />}
      </main>

      {/* Debug Panel */}
      {debugEnabled && <TabletDebug />}
    </div>
  );
};