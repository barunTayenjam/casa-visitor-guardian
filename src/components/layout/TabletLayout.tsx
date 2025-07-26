import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Camera, Bell, BarChart3, Settings, Wifi, WifiOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useSocketContext } from '@/contexts/SocketContext';
import { useCameras } from '@/contexts/CameraContext';
import { AlertsPanel } from './AlertsPanel';

interface TabletLayoutProps {
  children?: React.ReactNode;
}

export const TabletLayout = ({ children }: TabletLayoutProps) => {
  const [showAlerts, setShowAlerts] = useState(false);
  const { connected, connectionStatus } = useSocketContext();
  const { cameras } = useCameras();
  
  const activeCameras = cameras.filter(c => c.status === 'online').length;
  const totalCameras = cameras.length;

  return (
    <div className="min-h-screen flex flex-col bg-background">
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
            onClick={() => setShowAlerts(true)}
            className="h-12 px-6"
          >
            <Bell className="h-5 w-5 mr-2" />
            Alerts
            <Badge variant="destructive" className="ml-2">
              3
            </Badge>
          </Button>

          <Button
            variant="outline"
            size="lg"
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

      {/* Alerts Panel */}
      <AlertsPanel 
        isOpen={showAlerts} 
        onClose={() => setShowAlerts(false)} 
      />
    </div>
  );
};